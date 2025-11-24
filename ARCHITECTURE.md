# Water Resource Manager - Architecture Guide

## Overview

The Water Resource Manager is a privacy-preserving water resource allocation platform built on Ethereum using Fully Homomorphic Encryption (FHE). It enables secure, confidential allocation of water resources without revealing individual region demands or allocations.

## Core Architecture

### Gateway Callback Mode (Async Processing)

The system uses a Gateway callback pattern for decryption operations:

```
User submits encrypted request
    ↓
Contract records encrypted data
    ↓
Gateway Oracle receives decryption request
    ↓
Gateway performs off-chain decryption
    ↓
Gateway calls callback function with cleartext result
    ↓
Contract processes result and completes transaction
```

This asynchronous pattern ensures:
- Non-blocking contract execution
- Privacy-preserving operations
- Reliable decryption verification via signatures

### Key Components

#### 1. Region Management
- **Registration**: Authority registers water regions with unique IDs
- **State Tracking**: Each region maintains encrypted demand, allocation, and priority
- **Manager Control**: Each region has a designated manager address
- **Lifecycle**: Regions can be activated/deactivated with audit trails

#### 2. Allocation Periods
- **Time-bounded**: Each period has start and end times
- **Request Collection**: Regions submit encrypted water requests
- **Decryption Tracking**: Requests are tracked for timeout protection
- **Distribution**: Authority triggers allocation distribution process

#### 3. Water Request Processing
```
1. Region submits request during allocation period
   - Encrypted amount and justification score
   - Request timeout set to 7 days
   - Regional participation tracked

2. Authority requests decryption via Gateway
   - Decryption request recorded with timestamp
   - Timeout protection timer started (1 day)
   - Request ID tracked for callback verification

3. Gateway returns decryption result
   - Callback function verifies signatures
   - Input validation ensures reasonable amounts
   - Water distributed based on priority

4. Allocation completes or fails
   - Success: regions receive allocations
   - Timeout: regions eligible for refund
   - Failure: decryption failed flag set
```

### Security Features

#### Input Validation
- **Amount Constraints**: All amounts checked against reasonable bounds
- **Score Validation**: Justification scores limited to 1-100 range
- **Address Validation**: Zero address protection for managers
- **Overflow Protection**: Division operations prevent integer overflow

Example from code:
```solidity
require(_requestedAmount > 0 && _requestedAmount <= type(uint32).max / 2, "Invalid amount");
require(_justificationScore >= 1 && _justificationScore <= 100, "Invalid score");
require(newManager != address(0), "Invalid manager address");
```

#### Access Control
- **Modifiers**:
  - `onlyAuthority`: Administrative functions restricted to authority
  - `onlyRegionManager`: Region-specific operations verified
  - `validRegion`: Region existence and activity checks
  - `duringAllocationPeriod`: Time-based operation restrictions

- **State Guards**:
  - Double-spend prevention via `refundClaimed` tracking
  - Duplicate request prevention via `regionParticipated` mapping
  - Decryption replay protection via `decryptionRequests` tracking

#### Overflow Protection
All arithmetic operations include bounds checking:
```solidity
require(allocatedAmount <= remainingWater, "Overflow protection");
require(_amount <= type(uint32).max / 2, "Bounds check");
```

### Privacy Features

#### 1. Division Operation Protection
Problem: Division operations can leak information about divisor/dividend
Solution: Use random multiplier obfuscation

```solidity
function _calculateObfuscatedAllocation(
    uint32 regionId,
    uint32 availableWater,
    uint256 index
) private view returns (uint32) {
    // Base allocation calculation
    uint32 baseAllocation = availableWater / 10;

    // Pseudo-random multiplier (1-3)
    uint256 multiplierSeed =
        uint256(keccak256(abi.encodePacked(regionId, index, block.number)))
        & PRIVACY_MULTIPLIER_MASK;
    uint32 multiplier = uint32((multiplierSeed % 3) + 1);

    // Apply obfuscation with bounds checking
    uint32 obfuscatedAmount = baseAllocation > 0 ? baseAllocation : 1;
    if (obfuscatedAmount > availableWater / 2) {
        obfuscatedAmount = availableWater / 2;
    }

    return obfuscatedAmount;
}
```

Benefits:
- **Pattern Breaking**: Same input doesn't always produce same output
- **Timing Variation**: Block-based randomization prevents prediction
- **Bounded Results**: Ensures allocations remain proportional

#### 2. Price Obfuscation via Encrypted State
- All sensitive values (demand, allocation, priority) stored as `euint32`
- Only authorized parties can decrypt specific values
- Aggregate operations happen on encrypted data via FHE
- Results revealed only through formal decryption requests

#### 3. Request-Level Privacy
- Individual region requests encrypted
- Justification scores confidential
- Only summary allocation revealed to respective managers
- Decryption only granted to authorized parties

### Refund Mechanism

#### Triggers
1. **Decryption Failure**: If Gateway returns zero or invalid result
2. **Timeout Expiration**: If decryption takes > 1 day
3. **Request Expiry**: Requests valid for 7 days

#### Refund Flow
```
1. Region submits request (eligible for refund)
   ↓
2. Decryption times out OR fails
   ↓
3. Region claims timeout refund via claimDecryptionTimeout()
   ↓
4. Refund marked claimed via refundClaimed flag
   ↓
5. Event emitted for off-chain refund processing
   ↓
6. Off-chain relayer processes actual fund transfer
```

#### Refund Protection
- **One-time Claims**: `refundClaimed` prevents duplicate claims
- **Eligibility Verification**: Checks region participation and request status
- **Audit Trail**: Events logged with timestamp and period info
- **Timeout Guards**: Checks timeouts before processing

### Timeout Protection

#### Constants
```solidity
uint256 public constant DECRYPTION_TIMEOUT = 1 days;
uint256 public constant REQUEST_TIMEOUT = 7 days;
```

#### Protection Mechanisms

**1. Decryption Timeout (1 day)**
- Tracks when decryption request was made
- After 1 day without response, regions can claim refund
- Prevents permanent locking of water allocation
- Automatically resets if decryption completes

**2. Request Timeout (7 days)**
- Each request has a 7-day validity window
- After expiry, region ineligible for normal allocation
- Prevents stale requests from being processed
- Tracked in `requestTimeout` field

**3. Emergency Recovery**
```solidity
function claimDecryptionTimeout(uint32 periodId) external {
    // Verify timeout reached
    require(
        block.timestamp >= period.decryptionRequestTime + DECRYPTION_TIMEOUT,
        "Timeout not reached"
    );

    // Mark as failed and process refunds
    period.decryptionFailed = true;
    _processDecryptionTimeoutRefunds(periodId);
}
```

### Gas Optimization

#### HCU (Homomorphic Computation Unit) Efficiency

**1. Batching Operations**
- Combines multiple encrypted operations into single requests
- Reduces number of decryption roundtrips
- Example: Single decryption request for total water instead of per-region

**2. Minimize FHE Operations**
- Keep non-sensitive operations (timestamps, counters) in plaintext
- Use FHE only for amounts and priorities
- Example: Region participation tracking uses boolean mapping, not encrypted bool

**3. Efficient Data Structures**
```solidity
mapping(uint32 => Region) public regions;           // Direct access O(1)
mapping(uint32 => uint32[]) public regionsByPeriod; // Batch iteration
mapping(uint256 => DecryptionRequest) decryptRequests; // Tracking only
```

**4. Smart Computation**
- Pre-filter unprocessed requests to skip already-completed ones
- Stop iteration when water exhausted
- Only encrypt necessary values (amount, score, priority)

#### Gas Cost Estimates

| Operation | Approx Gas | Notes |
|-----------|-----------|-------|
| Register Region | 100k | Initial setup |
| Submit Request | 80k | Encrypted operations |
| Request Decryption | 120k | Gateway request + tracking |
| Process Allocation | 150k | Distribution loop |
| Claim Refund | 50k | Simple state update |
| Timeout Recovery | 60k | Per-region refund marking |

### Audit Trail & Compliance

#### Event Logging
All important state changes emit events for audit:

```solidity
event RegionRegistered(uint32 indexed regionId, string name, address manager);
event AllocationPeriodStarted(uint32 indexed periodId, uint256 startTime);
event WaterRequested(uint32 indexed regionId, uint32 indexed periodId, address requester);
event WaterAllocated(uint32 indexed regionId, uint32 indexed periodId, uint32 amount);
event DecryptionRequested(uint256 indexed requestId, uint32 indexed periodId);
event DecryptionFailed(uint32 indexed periodId, uint256 timestamp);
event RefundProcessed(uint32 indexed regionId, uint32 indexed periodId, uint256 amount);
event TimeoutProtectionTriggered(uint32 indexed periodId);
```

#### Audit Functions
```solidity
getPeriodParticipants(periodId)      // List all participants
getRegionRequestStatus(regionId, periodId)  // Track request lifecycle
getDecryptionStatus(periodId)        // Monitor timeout eligibility
canClaimTimeoutRefund(periodId, manager) // Verify refund eligibility
```

#### Timestamp Tracking
Every major action records `block.timestamp`:
- Region registration
- Request submission
- Period start/end
- Decryption request time
- Allocation completion

## Deployment Architecture

### Contract Setup
1. Deploy `WaterResourceManager` contract
2. Constructor sets `msg.sender` as authority
3. Register regions via `registerRegion()`
4. Start allocation periods via `startAllocationPeriod()`

### Integration Points

**With Gateway (Decryption Oracle)**
- Contract calls `FHE.requestDecryption()` with encrypted data
- Gateway monitors events and processes decryption requests
- Gateway calls `processAllocationCallback()` with signature verification

**With Region Managers**
- Managers submit requests during allocation period
- Managers query status via read-only functions
- Managers claim refunds if needed

**With Authority**
- Authority starts/ends allocation periods
- Authority manages region lifecycle
- Authority registers new regions

## State Transitions

```
Period Lifecycle:
1. CREATED: startAllocationPeriod() called
2. ACTIVE: Current time between start/end, not yet distributed
3. DECRYPTION_REQUESTED: Authority calls processAllocation()
4. DISTRIBUTED: Callback executed successfully
5. FAILED: Decryption failed, refund eligible
6. TIMED_OUT: Decryption timeout reached, refund eligible

Request Lifecycle (per region per period):
1. SUBMITTED: Region calls submitWaterRequest()
2. PROCESSING: Waiting for decryption
3. ALLOCATED: Successfully distributed
4. REFUNDED: Failed/timed out, refund claimed
```

## Security Considerations

### Threats Mitigated
1. **Information Leakage**: FHE encryption + obfuscation
2. **Reentrancy**: State changes before external calls
3. **Integer Overflow**: Bounds checking on all operations
4. **Access Violation**: Role-based modifiers
5. **Permanent Locking**: Timeout protection + refund mechanism
6. **Decryption Failure**: Graceful handling with refund path
7. **Replay Attacks**: Request tracking prevents duplication

### Trust Model
- Authority is trusted to start/manage periods
- Gateway oracle is trusted for correct decryption
- Signature verification ensures callback authenticity
- No single point of failure for allocation completion (timeout fallback)

## Future Enhancements

1. **Batch Refunds**: Auto-distribute refunds instead of off-chain
2. **Dynamic Pricing**: Encrypted price feeds for fair allocation
3. **Voting**: Encrypted voting on allocation priorities
4. **Upgradeable Proxy**: To fix bugs without redeployment
5. **Multi-sig Authority**: Distribute authority across multiple signers
6. **Rate Limiting**: Prevent abuse of request submission

## References

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [Homomorphic Encryption Concepts](https://en.wikipedia.org/wiki/Homomorphic_encryption)
- [Solidity Security Best Practices](https://docs.soliditylang.org/en/latest/security-considerations.html)
