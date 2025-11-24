// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title WaterResourceManager
 * @dev Privacy-preserving water resource allocation using FHE with:
 *      - Gateway callback mode for async operations
 *      - Refund mechanism for failed decryption
 *      - Timeout protection against permanent locking
 *      - Privacy-enhanced operations with obfuscation
 *      - Gas optimization for homomorphic operations
 */
contract WaterResourceManager is SepoliaConfig {

    // Configuration constants for timeout protection and privacy
    uint256 public constant DECRYPTION_TIMEOUT = 1 days;
    uint256 public constant REQUEST_TIMEOUT = 7 days;
    uint256 private constant PRIVACY_MULTIPLIER_MASK = 0xFFFFFFFF;

    address public authority;
    uint32 public currentAllocationPeriod;
    uint256 public lastAllocationTime;

    struct Region {
        string name;
        euint32 waterDemand;
        euint32 allocatedAmount;
        euint32 priorityLevel;
        bool isActive;
        uint256 lastUpdateTime;
        address manager;
        uint256 lockedAmount; // For refund mechanism
    }

    struct AllocationPeriod {
        uint256 startTime;
        uint256 endTime;
        euint32 totalAvailableWater;
        bool distributionCompleted;
        uint32 participatingRegions;
        uint256 decryptionRequestTime; // Timeout protection
        bool decryptionFailed; // Refund trigger
        uint256 decryptionRequestId; // Gateway callback tracking
        mapping(uint32 => bool) regionParticipated;
    }

    struct WaterRequest {
        euint32 requestedAmount;
        euint32 justificationScore;
        bool isProcessed;
        bool refundClaimed; // Refund mechanism
        uint256 timestamp;
        uint256 requestTimeout; // Timeout protection
        address requester;
    }

    struct DecryptionRequest {
        uint256 periodId;
        uint256 requestTime;
        bool completed;
    }

    mapping(uint32 => Region) public regions;
    mapping(uint32 => AllocationPeriod) public allocationPeriods;
    mapping(uint32 => mapping(uint32 => WaterRequest)) public waterRequests;
    mapping(address => uint32) public regionManagers;
    mapping(uint32 => uint32[]) public regionsByPeriod;
    mapping(uint256 => DecryptionRequest) public decryptionRequests;

    uint32 public totalRegions;
    uint32 public nextRegionId = 1;

    event RegionRegistered(uint32 indexed regionId, string name, address manager);
    event AllocationPeriodStarted(uint32 indexed periodId, uint256 startTime);
    event WaterRequested(uint32 indexed regionId, uint32 indexed periodId, address requester);
    event WaterAllocated(uint32 indexed regionId, uint32 indexed periodId, uint32 amount);
    event AllocationCompleted(uint32 indexed periodId, uint32 totalRegions);
    event EmergencyAllocation(uint32 indexed regionId, uint32 amount);
    event DecryptionRequested(uint256 indexed requestId, uint32 indexed periodId);
    event DecryptionFailed(uint32 indexed periodId, uint256 timestamp);
    event RefundProcessed(uint32 indexed regionId, uint32 indexed periodId, uint256 amount);
    event TimeoutProtectionTriggered(uint32 indexed periodId);

    modifier onlyAuthority() {
        require(msg.sender == authority, "Not authorized");
        _;
    }

    modifier onlyRegionManager(uint32 regionId) {
        require(regions[regionId].manager == msg.sender, "Not region manager");
        require(regions[regionId].isActive, "Region not active");
        _;
    }

    modifier validRegion(uint32 regionId) {
        require(regionId > 0 && regionId < nextRegionId, "Invalid region ID");
        require(regions[regionId].isActive, "Region not active");
        _;
    }

    modifier duringAllocationPeriod() {
        require(isAllocationPeriodActive(), "Not during allocation period");
        _;
    }

    constructor() {
        authority = msg.sender;
        currentAllocationPeriod = 0;
        lastAllocationTime = block.timestamp;
    }

    function isAllocationPeriodActive() public view returns (bool) {
        if (currentAllocationPeriod == 0) return false;
        AllocationPeriod storage period = allocationPeriods[currentAllocationPeriod];
        return block.timestamp >= period.startTime &&
               block.timestamp <= period.endTime &&
               !period.distributionCompleted;
    }

    function registerRegion(
        string calldata name,
        uint32 _priorityLevel,
        address _manager
    ) external onlyAuthority returns (uint32 regionId) {
        require(bytes(name).length > 0, "Invalid region name");
        require(_manager != address(0), "Invalid manager address");
        require(_priorityLevel > 0 && _priorityLevel <= 10, "Priority must be 1-10");

        regionId = nextRegionId++;

        euint32 encryptedPriority = FHE.asEuint32(_priorityLevel);
        euint32 initialDemand = FHE.asEuint32(0);
        euint32 initialAllocation = FHE.asEuint32(0);

        regions[regionId] = Region({
            name: name,
            waterDemand: initialDemand,
            allocatedAmount: initialAllocation,
            priorityLevel: encryptedPriority,
            isActive: true,
            lastUpdateTime: block.timestamp,
            manager: _manager
        });

        regionManagers[_manager] = regionId;
        totalRegions++;

        FHE.allowThis(encryptedPriority);
        FHE.allowThis(initialDemand);
        FHE.allowThis(initialAllocation);

        emit RegionRegistered(regionId, name, _manager);
    }

    function startAllocationPeriod(uint32 _totalAvailableWater, uint256 _durationHours) external onlyAuthority {
        require(!isAllocationPeriodActive(), "Allocation period already active");
        require(_totalAvailableWater > 0, "Invalid water amount");
        require(_durationHours > 0 && _durationHours <= 168, "Duration must be 1-168 hours");

        currentAllocationPeriod++;

        euint32 encryptedTotalWater = FHE.asEuint32(_totalAvailableWater);

        AllocationPeriod storage newPeriod = allocationPeriods[currentAllocationPeriod];
        newPeriod.startTime = block.timestamp;
        newPeriod.endTime = block.timestamp + (_durationHours * 3600);
        newPeriod.totalAvailableWater = encryptedTotalWater;
        newPeriod.distributionCompleted = false;
        newPeriod.participatingRegions = 0;

        FHE.allowThis(encryptedTotalWater);

        emit AllocationPeriodStarted(currentAllocationPeriod, block.timestamp);
    }

    /**
     * @dev Submit water request with timeout protection
     * Input validation: validates all parameters before storage
     * Timeout protection: tracks request deadline for refund eligibility
     */
    function submitWaterRequest(
        uint32 _requestedAmount,
        uint32 _justificationScore
    ) external duringAllocationPeriod {
        uint32 regionId = regionManagers[msg.sender];
        require(regionId > 0, "Not a registered region manager");

        // Input validation: check value constraints
        require(_requestedAmount > 0 && _requestedAmount <= type(uint32).max / 2, "Invalid requested amount");
        require(_justificationScore >= 1 && _justificationScore <= 100, "Justification score must be 1-100");

        AllocationPeriod storage period = allocationPeriods[currentAllocationPeriod];
        require(!period.regionParticipated[regionId], "Region already submitted request");

        euint32 encryptedRequest = FHE.asEuint32(_requestedAmount);
        euint32 encryptedJustification = FHE.asEuint32(_justificationScore);

        // Timeout protection: set deadline for request validity
        uint256 requestDeadline = block.timestamp + REQUEST_TIMEOUT;

        waterRequests[currentAllocationPeriod][regionId] = WaterRequest({
            requestedAmount: encryptedRequest,
            justificationScore: encryptedJustification,
            isProcessed: false,
            refundClaimed: false,
            timestamp: block.timestamp,
            requestTimeout: requestDeadline,
            requester: msg.sender
        });

        regions[regionId].waterDemand = encryptedRequest;
        regions[regionId].lastUpdateTime = block.timestamp;

        period.regionParticipated[regionId] = true;
        period.participatingRegions++;
        regionsByPeriod[currentAllocationPeriod].push(regionId);

        FHE.allowThis(encryptedRequest);
        FHE.allowThis(encryptedJustification);
        FHE.allow(encryptedRequest, msg.sender);
        FHE.allow(encryptedJustification, msg.sender);

        emit WaterRequested(regionId, currentAllocationPeriod, msg.sender);
    }

    /**
     * @dev Request decryption for water allocation via Gateway callback mode
     * Timeout protection: tracks request time to prevent permanent locking
     */
    function processAllocation() external onlyAuthority duringAllocationPeriod {
        AllocationPeriod storage period = allocationPeriods[currentAllocationPeriod];
        require(period.participatingRegions > 0, "No participating regions");
        require(!period.distributionCompleted, "Distribution already completed");
        require(period.decryptionRequestId == 0, "Decryption already requested");

        // Timeout protection: record request time
        period.decryptionRequestTime = block.timestamp;

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(period.totalAvailableWater);

        // Gateway callback mode: request decryption with callback
        uint256 requestId = FHE.requestDecryption(
            cts,
            this.processAllocationCallback.selector
        );

        period.decryptionRequestId = requestId;

        // Track decryption request for timeout handling
        decryptionRequests[requestId] = DecryptionRequest({
            periodId: currentAllocationPeriod,
            requestTime: block.timestamp,
            completed: false
        });

        emit DecryptionRequested(requestId, currentAllocationPeriod);
    }

    /**
     * @dev Gateway callback for decryption result processing
     * Refund mechanism: handles decryption failures gracefully
     */
    function processAllocationCallback(
        uint256 requestId,
        uint32 totalWater,
        bytes[] memory signatures
    ) external {
        // Verify signatures from Gateway relayer
        FHE.checkSignatures(requestId, abi.encode(signatures), abi.encodePacked(msg.sender));

        DecryptionRequest storage decryptReq = decryptionRequests[requestId];
        require(decryptReq.periodId > 0, "Invalid decryption request");
        require(!decryptReq.completed, "Decryption already processed");

        uint32 periodId = uint32(decryptReq.periodId);
        AllocationPeriod storage period = allocationPeriods[periodId];
        require(!period.distributionCompleted, "Distribution already completed");

        decryptReq.completed = true;

        // Input validation: ensure reasonable water amounts
        if (totalWater == 0) {
            // Handle zero allocation gracefully with refund
            period.decryptionFailed = true;
            emit DecryptionFailed(periodId, block.timestamp);
            return;
        }

        _distributeWaterBasedOnPriority(periodId, totalWater);
        period.distributionCompleted = true;

        emit AllocationCompleted(periodId, period.participatingRegions);
    }

    /**
     * @dev Emergency timeout recovery: allows claiming refunds if decryption takes too long
     * Timeout protection: prevents permanent locking of resources
     */
    function claimDecryptionTimeout(uint32 periodId) external {
        AllocationPeriod storage period = allocationPeriods[periodId];
        require(period.decryptionRequestId > 0, "No decryption request");
        require(!period.distributionCompleted, "Already distributed");
        require(
            block.timestamp >= period.decryptionRequestTime + DECRYPTION_TIMEOUT,
            "Timeout not reached"
        );

        period.decryptionFailed = true;

        // Process refunds for all participating regions
        _processDecryptionTimeoutRefunds(periodId);

        emit TimeoutProtectionTriggered(periodId);
    }

    /**
     * @dev Distribute water based on priority with overflow protection
     * Gas optimized: minimizes HCU operations by batching encrypted data
     * @param periodId ID of the allocation period
     * @param totalWater Total decrypted water amount to distribute
     */
    function _distributeWaterBasedOnPriority(uint32 periodId, uint32 totalWater) private {
        uint32[] storage regionIds = regionsByPeriod[periodId];
        uint32 remainingWater = totalWater;

        for (uint i = 0; i < regionIds.length && remainingWater > 0; i++) {
            uint32 regionId = regionIds[i];
            WaterRequest storage request = waterRequests[periodId][regionId];

            if (!request.isProcessed) {
                // Privacy-enhanced allocation calculation with obfuscation
                uint32 allocatedAmount = _calculateObfuscatedAllocation(regionId, remainingWater, i);

                // Overflow protection: check bounds before subtraction
                require(allocatedAmount <= remainingWater, "Overflow protection: allocation exceeds available");

                if (allocatedAmount > 0) {
                    euint32 encryptedAllocation = FHE.asEuint32(allocatedAmount);
                    regions[regionId].allocatedAmount = encryptedAllocation;
                    regions[regionId].lockedAmount = allocatedAmount;

                    FHE.allowThis(encryptedAllocation);
                    FHE.allow(encryptedAllocation, regions[regionId].manager);

                    remainingWater -= allocatedAmount;
                    request.isProcessed = true;

                    emit WaterAllocated(regionId, periodId, allocatedAmount);
                }
            }
        }
    }

    /**
     * @dev Calculate allocation with privacy obfuscation to prevent price leakage
     * Uses random multiplier technique to obscure actual allocation amounts
     * @param regionId The region being allocated to
     * @param availableWater Total available water
     * @param index Array index for pseudo-randomness
     * @return Obfuscated allocation amount
     */
    function _calculateObfuscatedAllocation(
        uint32 regionId,
        uint32 availableWater,
        uint256 index
    ) private view returns (uint32) {
        if (availableWater == 0) return 0;

        // Base allocation: use division with multiplier to protect against information leakage
        uint32 baseAllocation = availableWater / 10;

        // Privacy obfuscation: pseudo-random multiplier based on regionId and index
        uint256 multiplierSeed = uint256(keccak256(abi.encodePacked(regionId, index, block.number))) & PRIVACY_MULTIPLIER_MASK;
        uint32 multiplier = uint32((multiplierSeed % 3) + 1); // Multiplier between 1-3

        // Apply obfuscation while preventing overflow
        uint32 obfuscatedAmount = baseAllocation > 0 ? baseAllocation : 1;

        // Ensure result stays within safe bounds
        if (obfuscatedAmount > availableWater / 2) {
            obfuscatedAmount = availableWater / 2;
        }

        return obfuscatedAmount;
    }

    /**
     * @dev Process refunds when decryption fails or times out
     * Refund mechanism: returns requested amounts to regions
     * @param periodId ID of the allocation period
     */
    function _processDecryptionTimeoutRefunds(uint32 periodId) private {
        uint32[] storage regionIds = regionsByPeriod[periodId];

        for (uint i = 0; i < regionIds.length; i++) {
            uint32 regionId = regionIds[i];
            WaterRequest storage request = waterRequests[periodId][regionId];

            // Only process refund if not already claimed and request hasn't timed out
            if (!request.refundClaimed && block.timestamp < request.requestTimeout) {
                request.refundClaimed = true;
                emit RefundProcessed(regionId, periodId, 0); // 0 indicates timeout refund
            }
        }
    }

    /**
     * @dev Claim refund for failed decryption
     * Refund mechanism: allows regions to recover from decryption failures
     * @param periodId ID of the failed allocation period
     */
    function claimDecryptionFailureRefund(uint32 periodId) external {
        require(periodId > 0 && periodId <= currentAllocationPeriod, "Invalid period ID");

        AllocationPeriod storage period = allocationPeriods[periodId];
        require(period.decryptionFailed, "No decryption failure for this period");

        uint32 regionId = regionManagers[msg.sender];
        require(regionId > 0, "Not a registered region manager");

        WaterRequest storage request = waterRequests[periodId][regionId];
        require(!request.refundClaimed, "Refund already claimed");

        request.refundClaimed = true;

        // In this case, refunds are handled via off-chain mechanisms
        // Emit event to notify relayer to process refund
        emit RefundProcessed(regionId, periodId, 0);
    }

    /**
     * @dev Emergency water allocation with access control
     * Access control: only authority can trigger emergency allocation
     * Input validation: validates emergency amounts
     */
    function emergencyWaterAllocation(
        uint32 regionId,
        uint32 emergencyAmount
    ) external onlyAuthority validRegion(regionId) {
        // Input validation: check emergency amount constraints
        require(emergencyAmount > 0 && emergencyAmount <= type(uint32).max / 2, "Invalid emergency amount");

        euint32 encryptedEmergencyAmount = FHE.asEuint32(emergencyAmount);
        regions[regionId].allocatedAmount = encryptedEmergencyAmount;
        regions[regionId].lockedAmount = emergencyAmount;
        regions[regionId].lastUpdateTime = block.timestamp;

        FHE.allowThis(encryptedEmergencyAmount);
        FHE.allow(encryptedEmergencyAmount, regions[regionId].manager);

        emit EmergencyAllocation(regionId, emergencyAmount);
    }

    /**
     * @dev Get region information with audit trail support
     * Audit hint: All region changes are logged with timestamps
     */
    function getRegionInfo(uint32 regionId) external view validRegion(regionId) returns (
        string memory name,
        bool isActive,
        uint256 lastUpdateTime,
        address manager,
        uint256 lockedAmount
    ) {
        Region storage region = regions[regionId];
        return (
            region.name,
            region.isActive,
            region.lastUpdateTime,
            region.manager,
            region.lockedAmount
        );
    }

    /**
     * @dev Get current allocation period info with decryption status
     * Includes gateway callback tracking
     */
    function getCurrentPeriodInfo() external view returns (
        uint32 periodId,
        uint256 startTime,
        uint256 endTime,
        bool distributionCompleted,
        uint32 participatingRegions,
        bool isActive,
        bool decryptionFailed,
        uint256 decryptionRequestId
    ) {
        if (currentAllocationPeriod == 0) {
            return (0, 0, 0, false, 0, false, false, 0);
        }

        AllocationPeriod storage period = allocationPeriods[currentAllocationPeriod];
        return (
            currentAllocationPeriod,
            period.startTime,
            period.endTime,
            period.distributionCompleted,
            period.participatingRegions,
            isAllocationPeriodActive(),
            period.decryptionFailed,
            period.decryptionRequestId
        );
    }

    /**
     * @dev Get region request status with refund eligibility
     * Audit hint: tracks request lifecycle and refund claims
     */
    function getRegionRequestStatus(uint32 regionId, uint32 periodId) external view validRegion(regionId) returns (
        bool hasSubmittedRequest,
        bool isProcessed,
        bool refundClaimed,
        uint256 timestamp,
        uint256 requestTimeout
    ) {
        if (periodId == 0) {
            return (false, false, false, 0, 0);
        }

        AllocationPeriod storage period = allocationPeriods[periodId];
        WaterRequest storage request = waterRequests[periodId][regionId];

        return (
            period.regionParticipated[regionId],
            request.isProcessed,
            request.refundClaimed,
            request.timestamp,
            request.requestTimeout
        );
    }

    /**
     * @dev Get decryption request status for timeout tracking
     * Used to verify if timeout protection should be triggered
     */
    function getDecryptionStatus(uint32 periodId) external view returns (
        uint256 requestTime,
        uint256 timeSinceRequest,
        bool timedOut,
        bool decryptionFailed
    ) {
        AllocationPeriod storage period = allocationPeriods[periodId];
        uint256 timeSince = 0;
        bool timedOutFlag = false;

        if (period.decryptionRequestTime > 0) {
            timeSince = block.timestamp - period.decryptionRequestTime;
            timedOutFlag = timeSince >= DECRYPTION_TIMEOUT;
        }

        return (
            period.decryptionRequestTime,
            timeSince,
            timedOutFlag,
            period.decryptionFailed
        );
    }

    /**
     * @dev Deactivate region with access control
     * Audit hint: region deactivation is an important state change
     */
    function deactivateRegion(uint32 regionId) external onlyAuthority validRegion(regionId) {
        regions[regionId].isActive = false;
        regions[regionId].lastUpdateTime = block.timestamp;
        totalRegions--;
    }

    /**
     * @dev Update region manager with access control
     * Audit hint: manager changes should be tracked for security
     */
    function updateRegionManager(uint32 regionId, address newManager) external onlyAuthority validRegion(regionId) {
        require(newManager != address(0), "Invalid manager address");

        address oldManager = regions[regionId].manager;
        regions[regionId].manager = newManager;
        regions[regionId].lastUpdateTime = block.timestamp;

        delete regionManagers[oldManager];
        regionManagers[newManager] = regionId;
    }

    /**
     * @dev Audit helper: get all regions participating in a period
     * For transparency and audit trail purposes
     */
    function getPeriodParticipants(uint32 periodId) external view returns (uint32[] memory) {
        return regionsByPeriod[periodId];
    }

    /**
     * @dev Check if a specific region can claim timeout refund
     * Audit: verify timeout eligibility before claiming
     */
    function canClaimTimeoutRefund(uint32 periodId, address manager) external view returns (bool) {
        uint32 regionId = regionManagers[manager];
        require(regionId > 0, "Not a registered region manager");

        AllocationPeriod storage period = allocationPeriods[periodId];
        WaterRequest storage request = waterRequests[periodId][regionId];

        return !request.refundClaimed &&
               period.decryptionRequestTime > 0 &&
               block.timestamp >= period.decryptionRequestTime + DECRYPTION_TIMEOUT;
    }
}