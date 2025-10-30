// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract WaterResourceManager is SepoliaConfig {

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
    }

    struct AllocationPeriod {
        uint256 startTime;
        uint256 endTime;
        euint32 totalAvailableWater;
        bool distributionCompleted;
        uint32 participatingRegions;
        mapping(uint32 => bool) regionParticipated;
    }

    struct WaterRequest {
        euint32 requestedAmount;
        euint32 justificationScore;
        bool isProcessed;
        uint256 timestamp;
        address requester;
    }

    mapping(uint32 => Region) public regions;
    mapping(uint32 => AllocationPeriod) public allocationPeriods;
    mapping(uint32 => mapping(uint32 => WaterRequest)) public waterRequests;
    mapping(address => uint32) public regionManagers;
    mapping(uint32 => uint32[]) public regionsByPeriod;

    uint32 public totalRegions;
    uint32 public nextRegionId = 1;

    event RegionRegistered(uint32 indexed regionId, string name, address manager);
    event AllocationPeriodStarted(uint32 indexed periodId, uint256 startTime);
    event WaterRequested(uint32 indexed regionId, uint32 indexed periodId, address requester);
    event WaterAllocated(uint32 indexed regionId, uint32 indexed periodId, uint32 amount);
    event AllocationCompleted(uint32 indexed periodId, uint32 totalRegions);
    event EmergencyAllocation(uint32 indexed regionId, uint32 amount);

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

    function submitWaterRequest(
        uint32 _requestedAmount,
        uint32 _justificationScore
    ) external duringAllocationPeriod {
        uint32 regionId = regionManagers[msg.sender];
        require(regionId > 0, "Not a registered region manager");
        require(_requestedAmount > 0, "Invalid requested amount");
        require(_justificationScore >= 1 && _justificationScore <= 100, "Justification score must be 1-100");

        AllocationPeriod storage period = allocationPeriods[currentAllocationPeriod];
        require(!period.regionParticipated[regionId], "Region already submitted request");

        euint32 encryptedRequest = FHE.asEuint32(_requestedAmount);
        euint32 encryptedJustification = FHE.asEuint32(_justificationScore);

        waterRequests[currentAllocationPeriod][regionId] = WaterRequest({
            requestedAmount: encryptedRequest,
            justificationScore: encryptedJustification,
            isProcessed: false,
            timestamp: block.timestamp,
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

    function processAllocation() external onlyAuthority duringAllocationPeriod {
        AllocationPeriod storage period = allocationPeriods[currentAllocationPeriod];
        require(period.participatingRegions > 0, "No participating regions");
        require(!period.distributionCompleted, "Distribution already completed");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(period.totalAvailableWater);
        FHE.requestDecryption(cts, this.processAllocationCallback.selector);
    }

    function processAllocationCallback(
        uint256 requestId,
        uint32 totalWater,
        bytes[] memory signatures
    ) external {
        FHE.checkSignatures(requestId, abi.encode(signatures), abi.encodePacked(msg.sender));

        AllocationPeriod storage period = allocationPeriods[currentAllocationPeriod];
        require(!period.distributionCompleted, "Distribution already completed");

        _distributeWaterBasedOnPriority(totalWater);

        period.distributionCompleted = true;

        emit AllocationCompleted(currentAllocationPeriod, period.participatingRegions);
    }

    function _distributeWaterBasedOnPriority(uint32 totalWater) private {
        uint32[] storage regionIds = regionsByPeriod[currentAllocationPeriod];
        uint32 remainingWater = totalWater;

        for (uint i = 0; i < regionIds.length && remainingWater > 0; i++) {
            uint32 regionId = regionIds[i];
            WaterRequest storage request = waterRequests[currentAllocationPeriod][regionId];

            if (!request.isProcessed) {
                uint32 allocatedAmount = _calculateAllocation(regionId, remainingWater);

                if (allocatedAmount > 0) {
                    euint32 encryptedAllocation = FHE.asEuint32(allocatedAmount);
                    regions[regionId].allocatedAmount = encryptedAllocation;

                    FHE.allowThis(encryptedAllocation);
                    FHE.allow(encryptedAllocation, regions[regionId].manager);

                    remainingWater -= allocatedAmount;
                    request.isProcessed = true;

                    emit WaterAllocated(regionId, currentAllocationPeriod, allocatedAmount);
                }
            }
        }
    }

    function _calculateAllocation(uint32 regionId, uint32 availableWater) private view returns (uint32) {
        if (availableWater == 0) return 0;

        uint32 baseAllocation = availableWater / 10;
        return baseAllocation > 0 ? baseAllocation : 1;
    }

    function emergencyWaterAllocation(
        uint32 regionId,
        uint32 emergencyAmount
    ) external onlyAuthority validRegion(regionId) {
        require(emergencyAmount > 0, "Invalid emergency amount");

        euint32 encryptedEmergencyAmount = FHE.asEuint32(emergencyAmount);
        regions[regionId].allocatedAmount = encryptedEmergencyAmount;
        regions[regionId].lastUpdateTime = block.timestamp;

        FHE.allowThis(encryptedEmergencyAmount);
        FHE.allow(encryptedEmergencyAmount, regions[regionId].manager);

        emit EmergencyAllocation(regionId, emergencyAmount);
    }

    function getRegionInfo(uint32 regionId) external view validRegion(regionId) returns (
        string memory name,
        bool isActive,
        uint256 lastUpdateTime,
        address manager
    ) {
        Region storage region = regions[regionId];
        return (
            region.name,
            region.isActive,
            region.lastUpdateTime,
            region.manager
        );
    }

    function getCurrentPeriodInfo() external view returns (
        uint32 periodId,
        uint256 startTime,
        uint256 endTime,
        bool distributionCompleted,
        uint32 participatingRegions,
        bool isActive
    ) {
        if (currentAllocationPeriod == 0) {
            return (0, 0, 0, false, 0, false);
        }

        AllocationPeriod storage period = allocationPeriods[currentAllocationPeriod];
        return (
            currentAllocationPeriod,
            period.startTime,
            period.endTime,
            period.distributionCompleted,
            period.participatingRegions,
            isAllocationPeriodActive()
        );
    }

    function getRegionRequestStatus(uint32 regionId) external view validRegion(regionId) returns (
        bool hasSubmittedRequest,
        bool isProcessed,
        uint256 timestamp
    ) {
        if (currentAllocationPeriod == 0) {
            return (false, false, 0);
        }

        AllocationPeriod storage period = allocationPeriods[currentAllocationPeriod];
        WaterRequest storage request = waterRequests[currentAllocationPeriod][regionId];

        return (
            period.regionParticipated[regionId],
            request.isProcessed,
            request.timestamp
        );
    }

    function deactivateRegion(uint32 regionId) external onlyAuthority validRegion(regionId) {
        regions[regionId].isActive = false;
        totalRegions--;
    }

    function updateRegionManager(uint32 regionId, address newManager) external onlyAuthority validRegion(regionId) {
        require(newManager != address(0), "Invalid manager address");

        address oldManager = regions[regionId].manager;
        regions[regionId].manager = newManager;

        delete regionManagers[oldManager];
        regionManagers[newManager] = regionId;
    }
}