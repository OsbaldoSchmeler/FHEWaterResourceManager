# Water Resource Manager - API Reference

## Contract Functions

### Administrative Functions

#### registerRegion
Register a new water resource region with the system.

```solidity
function registerRegion(
    string calldata name,
    uint32 _priorityLevel,
    address _manager
) external onlyAuthority returns (uint32 regionId)
```

**Parameters:**
- `name`: Human-readable region name (non-empty string)
- `_priorityLevel`: Priority level (1-10, higher = more important)
- `_manager`: Address of the region manager (non-zero)

**Returns:**
- `regionId`: Unique identifier assigned to the region (starting from 1)

**Requirements:**
- Caller must be authority
- Region name cannot be empty
- Manager address must be non-zero
- Priority must be between 1 and 10

**Events:**
- `RegionRegistered(regionId, name, manager)`

**Example:**
```javascript
await contract.registerRegion("North Basin", 8, managerAddress);
// Returns: 1
```

---

#### startAllocationPeriod
Begin a new water allocation period.

```solidity
function startAllocationPeriod(
    uint32 _totalAvailableWater,
    uint256 _durationHours
) external onlyAuthority
```

**Parameters:**
- `_totalAvailableWater`: Total water units available for allocation
- `_durationHours`: Period duration in hours (1-168)

**Requirements:**
- Caller must be authority
- No active allocation period already running
- Water amount must be > 0
- Duration must be 1-168 hours (1 week max)

**Events:**
- `AllocationPeriodStarted(periodId, blockTimestamp)`

**Note:** Total water is encrypted before storage; only authority with proper decryption keys can see actual amounts.

**Example:**
```javascript
await contract.startAllocationPeriod(1000000, 72); // 72 hours
```

---

#### deactivateRegion
Deactivate a region, preventing further water requests.

```solidity
function deactivateRegion(uint32 regionId) external onlyAuthority validRegion(regionId)
```

**Parameters:**
- `regionId`: ID of region to deactivate

**Requirements:**
- Caller must be authority
- Region must exist and be active

**Events:**
- State change recorded with timestamp in region data

**Example:**
```javascript
await contract.deactivateRegion(1);
```

---

#### updateRegionManager
Change the manager address for a region.

```solidity
function updateRegionManager(
    uint32 regionId,
    address newManager
) external onlyAuthority validRegion(regionId)
```

**Parameters:**
- `regionId`: ID of region to update
- `newManager`: New manager address (non-zero)

**Requirements:**
- Caller must be authority
- Region must exist
- New manager address must be non-zero

**Audit Trail:**
- Old manager mapping deleted
- New manager mapping created
- Last update timestamp recorded

**Example:**
```javascript
await contract.updateRegionManager(1, newManagerAddress);
```

---

### Region Manager Functions

#### submitWaterRequest
Submit a water request during an active allocation period.

```solidity
function submitWaterRequest(
    uint32 _requestedAmount,
    uint32 _justificationScore
) external duringAllocationPeriod
```

**Parameters:**
- `_requestedAmount`: Water units requested (encrypted)
- `_justificationScore`: Justification for request (1-100)

**Requirements:**
- Caller must be a registered region manager
- Allocation period must be active
- Requested amount > 0 and reasonable
- Justification score between 1-100
- Region hasn't already submitted for this period

**Timeout Protection:**
- Request becomes invalid after 7 days
- Eligible for refund if not processed

**Events:**
- `WaterRequested(regionId, periodId, requester)`

**Example:**
```javascript
// Region manager submits request for 5000 units with score 85
await contract.submitWaterRequest(5000, 85);
```

**Privacy Note:** Amount and score are encrypted using FHE; even contract cannot see plaintext values.

---

#### claimDecryptionFailureRefund
Claim refund if decryption failed for an allocation period.

```solidity
function claimDecryptionFailureRefund(uint32 periodId) external
```

**Parameters:**
- `periodId`: ID of the failed allocation period

**Requirements:**
- Period must be marked as decryption failed
- Caller must be a region manager
- Region must have submitted request for this period
- Refund not already claimed

**Events:**
- `RefundProcessed(regionId, periodId, 0)`

**Example:**
```javascript
await contract.claimDecryptionFailureRefund(1);
```

**Off-chain Processing:** Event is emitted for relayer to process actual fund return.

---

### Allocation Processing Functions

#### processAllocation
Request decryption and begin allocation process (Gateway callback mode).

```solidity
function processAllocation() external onlyAuthority duringAllocationPeriod
```

**Requirements:**
- Caller must be authority
- Period must be active and have participating regions
- Distribution not already completed
- No decryption already pending

**Timeout Protection:**
- Records request timestamp for 1-day timeout tracking
- Can trigger `claimDecryptionTimeout()` if not completed in time

**Events:**
- `DecryptionRequested(requestId, periodId)`

**Gateway Integration:**
1. Contract requests decryption from Gateway
2. Gateway decrypts total water amount
3. Gateway calls `processAllocationCallback()` with result

**Example:**
```javascript
await contract.processAllocation();
```

---

#### processAllocationCallback
Callback function for Gateway to return decryption results.

```solidity
function processAllocationCallback(
    uint256 requestId,
    uint32 totalWater,
    bytes[] memory signatures
) external
```

**Parameters:**
- `requestId`: Unique decryption request identifier
- `totalWater`: Decrypted total water amount
- `signatures`: Gateway signatures for verification

**Requirements:**
- Signatures must be valid (verified via FHE.checkSignatures)
- Request must be valid and not already processed
- Distribution not completed

**Security Checks:**
- Signature verification prevents unauthorized callbacks
- Input validation ensures reasonable water amounts
- Double-processing protection via `decryptionRequests[requestId].completed`

**Processing:**
1. Verifies Gateway signatures
2. Validates water amount
3. Distributes water to regions based on priority
4. Marks period as completed

**Events:**
- `AllocationCompleted(periodId, totalRegions)` or
- `DecryptionFailed(periodId, timestamp)` if water = 0

**Example (called by Gateway relayer):**
```javascript
// Only Gateway relayer calls this
await contract.processAllocationCallback(
    requestId,
    totalWaterAmount,
    signatures
);
```

---

#### claimDecryptionTimeout
Claim refund if decryption takes too long (>1 day).

```solidity
function claimDecryptionTimeout(uint32 periodId) external
```

**Parameters:**
- `periodId`: ID of allocation period

**Requirements:**
- Decryption request must exist for this period
- Distribution not yet completed
- At least 1 day has passed since decryption request

**Timeout Protection:**
- Prevents permanent locking of water allocation
- Automatic refund eligibility after 1 day

**Events:**
- `TimeoutProtectionTriggered(periodId)`
- Calls `RefundProcessed` events for each region

**Example:**
```javascript
// Call after 1 day if decryption hasn't completed
await contract.claimDecryptionTimeout(1);
```

---

#### emergencyWaterAllocation
Authority can directly allocate water without decryption (emergency only).

```solidity
function emergencyWaterAllocation(
    uint32 regionId,
    uint32 emergencyAmount
) external onlyAuthority validRegion(regionId)
```

**Parameters:**
- `regionId`: Target region
- `emergencyAmount`: Water to allocate (reasonable bounds)

**Requirements:**
- Caller must be authority
- Region must exist and be active
- Amount > 0 and reasonable

**Access Control:**
- Only authority can use
- Bypasses normal allocation process
- Intended for crisis situations only

**Events:**
- `EmergencyAllocation(regionId, amount)`

**Example:**
```javascript
// Emergency allocation of 50000 units to region 1
await contract.emergencyWaterAllocation(1, 50000);
```

---

### View Functions

#### getCurrentPeriodInfo
Get information about the current allocation period.

```solidity
function getCurrentPeriodInfo() external view returns (
    uint32 periodId,
    uint256 startTime,
    uint256 endTime,
    bool distributionCompleted,
    uint32 participatingRegions,
    bool isActive,
    bool decryptionFailed,
    uint256 decryptionRequestId
)
```

**Returns:**
- `periodId`: Current allocation period ID
- `startTime`: Period start timestamp (Unix time)
- `endTime`: Period end timestamp (Unix time)
- `distributionCompleted`: Whether water has been distributed
- `participatingRegions`: Number of regions with submitted requests
- `isActive`: Whether period is currently active
- `decryptionFailed`: Whether decryption failed (refund eligible)
- `decryptionRequestId`: ID of pending decryption request (0 if none)

**Example:**
```javascript
const info = await contract.getCurrentPeriodInfo();
console.log(`Period ${info.periodId} active: ${info.isActive}`);
console.log(`Participating regions: ${info.participatingRegions}`);
```

---

#### getRegionInfo
Get information about a specific region.

```solidity
function getRegionInfo(uint32 regionId) external view validRegion(regionId) returns (
    string memory name,
    bool isActive,
    uint256 lastUpdateTime,
    address manager,
    uint256 lockedAmount
)
```

**Parameters:**
- `regionId`: ID of region to query

**Returns:**
- `name`: Region name
- `isActive`: Whether region can submit requests
- `lastUpdateTime`: Timestamp of last update
- `manager`: Address of region manager
- `lockedAmount`: Currently allocated/locked water units

**Example:**
```javascript
const info = await contract.getRegionInfo(1);
console.log(`${info.name} managed by ${info.manager}`);
console.log(`Locked water: ${info.lockedAmount}`);
```

---

#### getRegionRequestStatus
Get request status for a region in a specific period.

```solidity
function getRegionRequestStatus(
    uint32 regionId,
    uint32 periodId
) external view validRegion(regionId) returns (
    bool hasSubmittedRequest,
    bool isProcessed,
    bool refundClaimed,
    uint256 timestamp,
    uint256 requestTimeout
)
```

**Parameters:**
- `regionId`: ID of region
- `periodId`: ID of allocation period

**Returns:**
- `hasSubmittedRequest`: Whether region submitted for this period
- `isProcessed`: Whether allocation has been completed
- `refundClaimed`: Whether refund already claimed
- `timestamp`: When request was submitted
- `requestTimeout`: When request expires (7 days from submission)

**Example:**
```javascript
const status = await contract.getRegionRequestStatus(1, 1);
console.log(`Request processed: ${status.isProcessed}`);
console.log(`Refund claimed: ${status.refundClaimed}`);
```

---

#### getDecryptionStatus
Get status of decryption request for timeout tracking.

```solidity
function getDecryptionStatus(uint32 periodId) external view returns (
    uint256 requestTime,
    uint256 timeSinceRequest,
    bool timedOut,
    bool decryptionFailed
)
```

**Parameters:**
- `periodId`: ID of allocation period

**Returns:**
- `requestTime`: When decryption was requested (0 if not requested)
- `timeSinceRequest`: Seconds elapsed since request
- `timedOut`: Whether 1-day timeout has been reached
- `decryptionFailed`: Whether decryption failed

**Timeout Thresholds:**
- Timeout triggered when `timeSinceRequest >= 86400` (1 day)
- After timeout, regions eligible for `claimDecryptionTimeout()`

**Example:**
```javascript
const decryptStatus = await contract.getDecryptionStatus(1);
if (decryptStatus.timedOut) {
    console.log("Decryption timed out - regions can claim refund");
}
```

---

#### getPeriodParticipants
Get list of all regions participating in a period.

```solidity
function getPeriodParticipants(uint32 periodId) external view returns (uint32[] memory)
```

**Parameters:**
- `periodId`: ID of allocation period

**Returns:**
- Array of region IDs that submitted requests

**Audit Purpose:**
- Transparency on who participated
- Verify period completeness

**Example:**
```javascript
const participants = await contract.getPeriodParticipants(1);
console.log(`Regions in period 1: ${participants.join(', ')}`);
```

---

#### canClaimTimeoutRefund
Check if a region is eligible to claim timeout refund.

```solidity
function canClaimTimeoutRefund(uint32 periodId, address manager) external view returns (bool)
```

**Parameters:**
- `periodId`: ID of allocation period
- `manager`: Address of region manager

**Returns:**
- `true` if region can claim refund, `false` otherwise

**Eligibility Requirements:**
- Region must have submitted request for period
- Refund not already claimed
- Decryption request made
- 1 day passed since decryption request

**Example:**
```javascript
const eligible = await contract.canClaimTimeoutRefund(1, managerAddress);
if (eligible) {
    await contract.claimDecryptionTimeout(1);
}
```

---

#### isAllocationPeriodActive
Check if allocation period is currently active.

```solidity
function isAllocationPeriodActive() public view returns (bool)
```

**Returns:**
- `true` if there is an active allocation period

**Conditions for Active:**
- Current period ID > 0
- Current time >= start time
- Current time <= end time
- Distribution not completed

**Example:**
```javascript
if (await contract.isAllocationPeriodActive()) {
    await contract.submitWaterRequest(5000, 85);
}
```

---

## Event Reference

### RegionRegistered
```solidity
event RegionRegistered(uint32 indexed regionId, string name, address manager)
```
Emitted when new region is registered.

---

### AllocationPeriodStarted
```solidity
event AllocationPeriodStarted(uint32 indexed periodId, uint256 startTime)
```
Emitted when authority starts new allocation period.

---

### WaterRequested
```solidity
event WaterRequested(uint32 indexed regionId, uint32 indexed periodId, address requester)
```
Emitted when region submits water request.

---

### WaterAllocated
```solidity
event WaterAllocated(uint32 indexed regionId, uint32 indexed periodId, uint32 amount)
```
Emitted when water is allocated to a region.

---

### AllocationCompleted
```solidity
event AllocationCompleted(uint32 indexed periodId, uint32 totalRegions)
```
Emitted when entire allocation period completes successfully.

---

### EmergencyAllocation
```solidity
event EmergencyAllocation(uint32 indexed regionId, uint32 amount)
```
Emitted when authority makes emergency allocation.

---

### DecryptionRequested
```solidity
event DecryptionRequested(uint256 indexed requestId, uint32 indexed periodId)
```
Emitted when decryption is requested from Gateway.

---

### DecryptionFailed
```solidity
event DecryptionFailed(uint32 indexed periodId, uint256 timestamp)
```
Emitted when Gateway returns zero/invalid decryption result.

---

### RefundProcessed
```solidity
event RefundProcessed(uint32 indexed regionId, uint32 indexed periodId, uint256 amount)
```
Emitted when refund is claimed by region.

---

### TimeoutProtectionTriggered
```solidity
event TimeoutProtectionTriggered(uint32 indexed periodId)
```
Emitted when 1-day timeout reached and refunds processed.

---

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Not authorized" | Non-authority called admin function | Use authority address |
| "Not region manager" | Non-manager called manager function | Use registered manager address |
| "Region not active" | Region deactivated | Activate region or use different region |
| "Invalid region ID" | Region doesn't exist | Check valid region ID range |
| "Not during allocation period" | Called outside active period | Start period first |
| "No participating regions" | No regions submitted requests | Have regions submit requests |
| "Distribution already completed" | Already distributed | Create new period |
| "Decryption already requested" | Already requested decryption | Wait for callback |
| "Invalid requested amount" | Amount invalid (0 or too large) | Use valid amount (1 to 2^31-1) |
| "Justification score must be 1-100" | Score out of range | Use score between 1-100 |
| "Region already submitted request" | Duplicate request | Only one request per period per region |
| "Timeout not reached" | Too early for timeout refund | Wait 1 day from decryption request |
| "No decryption request" | No decryption requested yet | Authority must call processAllocation() first |
| "No decryption failure for this period" | Period didn't fail | Check period status |
| "Refund already claimed" | Already claimed refund | Can only claim once |

---

## Integration Guide

### With Frontend
```javascript
// Check if can submit request
if (await contract.isAllocationPeriodActive()) {
    const tx = await contract.submitWaterRequest(
        requestAmount,
        justificationScore
    );
    const receipt = await tx.wait();
    // Listen for WaterRequested event
}

// Check status
const status = await contract.getRegionRequestStatus(regionId, periodId);
if (!status.isProcessed) {
    // Still waiting for allocation
}
```

### With Gateway Relayer
```javascript
// Listen for DecryptionRequested event
contract.on('DecryptionRequested', async (requestId, periodId) => {
    // Off-chain decryption
    const totalWater = await decryptData(...);

    // Call callback with signatures
    await contract.processAllocationCallback(
        requestId,
        totalWater,
        signatures
    );
});
```

### With Monitoring/Audit
```javascript
// Monitor all events
contract.on('*', (event) => {
    console.log(`Period ${event.args?.periodId}: ${event.event}`);
    logAuditEvent(event);
});

// Check period status regularly
const status = await contract.getDecryptionStatus(periodId);
if (status.timedOut && !status.decryptionFailed) {
    console.log("Timeout protection should be triggered");
}
```

---

## Constants

```solidity
uint256 public constant DECRYPTION_TIMEOUT = 1 days;    // 86400 seconds
uint256 public constant REQUEST_TIMEOUT = 7 days;       // 604800 seconds
uint256 private constant PRIVACY_MULTIPLIER_MASK = 0xFFFFFFFF;
```

---

## Gas Estimates

| Function | Approx Gas |
|----------|-----------|
| registerRegion | 100,000 |
| startAllocationPeriod | 80,000 |
| submitWaterRequest | 80,000 |
| processAllocation | 120,000 |
| processAllocationCallback | 150,000 |
| claimDecryptionTimeout | 60,000 |
| claimDecryptionFailureRefund | 50,000 |
| emergencyWaterAllocation | 90,000 |
| getRegionInfo | 5,000 (view) |
| getCurrentPeriodInfo | 5,000 (view) |

---

## Version Information

- **Solidity Version**: ^0.8.24
- **FHEVM Version**: Latest
- **Network**: Sepolia (with FHEVM support)

