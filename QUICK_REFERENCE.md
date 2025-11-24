# Water Resource Manager - Quick Reference Guide

## What Was Enhanced?

This document provides a quick reference to all enhancements made to the Water Resource Manager smart contract.

---

## 🎯 Core Features

### 1. Gateway Callback Mode ✅
**What**: Async decryption requests with callback-based processing
**Where**: `processAllocation()` + `processAllocationCallback()`
**Why**: Prevents contract locking during decryption
**How to use**: Authority calls `processAllocation()`, Gateway responds with callback

### 2. Refund Mechanism ✅
**What**: Failed/timed-out allocations trigger automatic refunds
**Where**: `claimDecryptionFailureRefund()` + `claimDecryptionTimeout()`
**Why**: Protects users from lost funds on system failures
**How to use**: Region calls `claimDecryptionFailureRefund()` after failure flag set

### 3. Timeout Protection ✅
**What**: 1-day decryption timeout + 7-day request validity
**Where**: `DECRYPTION_TIMEOUT` + `REQUEST_TIMEOUT` constants
**Why**: Prevents permanent locking of resources
**How to use**: Automatic - regions call `claimDecryptionTimeout()` after 1 day

### 4. Privacy Obfuscation ✅
**What**: Random multiplier technique + FHE encryption
**Where**: `_calculateObfuscatedAllocation()` + FHE structs
**Why**: Prevents information leakage from division operations
**How to use**: Automatic - applied during allocation calculation

### 5. Security Hardening ✅
**What**: Input validation, access control, overflow protection
**Where**: All functions with modifiers + bounds checks
**Why**: Prevents edge cases and unauthorized access
**How to use**: Built-in - just use the contract normally

### 6. Gas Optimization ✅
**What**: Batch decryption requests, minimize FHE operations
**Where**: All functions, especially `processAllocation()`
**Why**: Reduces HCU (Homomorphic Computation Unit) cost
**How to use**: Automatic - contract uses efficient patterns

### 7. Audit Trail ✅
**What**: Comprehensive event logging for all operations
**Where**: Events + view functions with timestamps
**Why**: Enables transparency and compliance
**How to use**: Monitor events or call view functions to check status

---

## 📋 Key Functions

### For Authority

```solidity
// Start allocation period
startAllocationPeriod(uint32 _totalAvailableWater, uint256 _durationHours)

// Request decryption from Gateway
processAllocation()

// Emergency allocation
emergencyWaterAllocation(uint32 regionId, uint32 emergencyAmount)

// Manage regions
registerRegion(string name, uint32 priority, address manager)
deactivateRegion(uint32 regionId)
updateRegionManager(uint32 regionId, address newManager)
```

### For Region Managers

```solidity
// Submit encrypted request
submitWaterRequest(uint32 _requestedAmount, uint32 _justificationScore)

// Claim refund on failure
claimDecryptionFailureRefund(uint32 periodId)

// Claim refund on timeout (after 1 day)
claimDecryptionTimeout(uint32 periodId)

// Check status
getRegionInfo(uint32 regionId)
getRegionRequestStatus(uint32 regionId, uint32 periodId)
getDecryptionStatus(uint32 periodId)
canClaimTimeoutRefund(uint32 periodId, address manager)
```

### For Monitoring

```solidity
// Get current period info
getCurrentPeriodInfo()

// List period participants
getPeriodParticipants(uint32 periodId)

// Check all decryption status
getDecryptionStatus(uint32 periodId)

// Verify timeout eligibility
canClaimTimeoutRefund(uint32 periodId, address manager)
```

---

## 🔄 Workflow Example

### Normal Allocation Flow
```
1. Authority calls startAllocationPeriod()
   ↓
2. Regions call submitWaterRequest() during period
   ↓
3. Authority calls processAllocation()
   ↓
4. Gateway decrypts and calls processAllocationCallback()
   ↓
5. Regions receive allocations
   SUCCESS ✅
```

### Failure Recovery Flow
```
1. Authority calls startAllocationPeriod()
   ↓
2. Regions call submitWaterRequest() during period
   ↓
3. Authority calls processAllocation()
   ↓
4. Gateway fails/times out
   ↓
5. Authority calls claimDecryptionTimeout() after 1 day
   ↓
6. Regions call claimDecryptionFailureRefund()
   RECOVERY ✅
```

---

## ⏱️ Important Timeouts

| Timeout | Duration | Purpose | Action |
|---------|----------|---------|--------|
| DECRYPTION_TIMEOUT | 1 day | Prevents permanent locking | Call `claimDecryptionTimeout()` |
| REQUEST_TIMEOUT | 7 days | Request validity window | Refund claim ineligible after |
| Period Duration | 1-168 hours | Allocation period length | Set during `startAllocationPeriod()` |

---

## 🔒 Privacy Implementation

### What's Encrypted (Private)
- Water demand amounts (`euint32 waterDemand`)
- Priority levels (`euint32 priorityLevel`)
- Justification scores (`euint32 justificationScore`)
- Allocation amounts (during computation)

### What's Public (Transparent)
- Region registration and status
- Period start/end times
- Transaction metadata
- Final allocations (after authorized decryption)

### What's Obfuscated (Protected)
- Division operation results (random multiplier 1-3)
- Allocation calculation details (block-based randomization)
- Individual request patterns (FHE encryption masks)

---

## 📊 Event Monitoring

```solidity
// Listen for allocation completion
DecryptionRequested(uint256 requestId, uint32 periodId)

// Detect failures
DecryptionFailed(uint32 periodId, uint256 timestamp)

// Track refunds
RefundProcessed(uint32 regionId, uint32 periodId, uint256 amount)

// Emergency recovery
TimeoutProtectionTriggered(uint32 periodId)
```

---

## 🚨 Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Not authorized" | Non-authority function call | Use authority address |
| "Region not active" | Region deactivated | Register new region or reactivate |
| "Not during allocation period" | Called outside active period | Wait for new period or start one |
| "Timeout not reached" | Too early for timeout refund | Wait 1 day from decryption request |
| "Refund already claimed" | Already claimed refund | Can only claim once per period |
| "Decryption already requested" | Already requested decryption | Wait for callback or timeout |

---

## 💾 Key Data Fields

### Region Struct
- `name`: Region identifier
- `waterDemand`: Encrypted current demand
- `allocatedAmount`: Encrypted allocation result
- `priorityLevel`: Encrypted priority (1-10)
- `isActive`: Active/inactive status
- `manager`: Manager address
- `lockedAmount`: Currently allocated units (NEW)

### AllocationPeriod Struct
- `startTime`: Period start timestamp
- `endTime`: Period end timestamp
- `totalAvailableWater`: Encrypted total water
- `distributionCompleted`: Completion status
- `participatingRegions`: Number of participants
- `decryptionRequestTime`: When decryption requested (NEW)
- `decryptionFailed`: Failure flag (NEW)
- `decryptionRequestId`: Links to Gateway request (NEW)

### WaterRequest Struct
- `requestedAmount`: Encrypted amount requested
- `justificationScore`: Encrypted score (1-100)
- `isProcessed`: Processing status
- `timestamp`: Submission time
- `refundClaimed`: Refund status (NEW)
- `requestTimeout`: Validity deadline (NEW)

---

## 🔧 Constants

```solidity
uint256 DECRYPTION_TIMEOUT = 1 days;        // 86,400 seconds
uint256 REQUEST_TIMEOUT = 7 days;            // 604,800 seconds
uint256 PRIVACY_MULTIPLIER_MASK = 0xFFFFFFFF;
```

---

## 📈 Gas Estimates

- **registerRegion**: 100,000 gas
- **startAllocationPeriod**: 80,000 gas
- **submitWaterRequest**: 80,000 gas
- **processAllocation**: 120,000 gas
- **processAllocationCallback**: 150,000 gas
- **claimDecryptionTimeout**: 60,000 gas
- **emergencyWaterAllocation**: 90,000 gas

---

## 🔍 View Functions for Status Checking

```solidity
// Check current period status
(periodId, start, end, completed, regions, active, failed, requestId) =
    getCurrentPeriodInfo()

// Check region status
(name, active, lastUpdate, manager, locked) =
    getRegionInfo(regionId)

// Check request status
(submitted, processed, claimed, timestamp, timeout) =
    getRegionRequestStatus(regionId, periodId)

// Check decryption status
(requestTime, elapsed, timedOut, failed) =
    getDecryptionStatus(periodId)

// Check refund eligibility
eligible = canClaimTimeoutRefund(periodId, manager)
```

---

## 🎓 Common Scenarios

### Scenario 1: Normal Allocation
1. Authority: `startAllocationPeriod(1000000, 72)` - 72 hours
2. Regions: `submitWaterRequest(50000, 85)` - Amount and score
3. Authority: `processAllocation()` - Trigger decryption
4. Gateway: Calls `processAllocationCallback()` - Returns result
5. Done: Regions receive allocations
**Timeout Risk**: None (normal completion)

### Scenario 2: Decryption Timeout
1. Authority: `startAllocationPeriod(1000000, 72)`
2. Regions: `submitWaterRequest(50000, 85)`
3. Authority: `processAllocation()` - Request decryption
4. Gateway: FAILURE or TIMEOUT
5. Wait: 1 day passes...
6. Authority: `claimDecryptionTimeout(periodId)` - Trigger recovery
7. Regions: `claimDecryptionFailureRefund(periodId)` - Claim refund
**Recovery**: Automatic after 1 day

### Scenario 3: Emergency Allocation
1. Crisis detected: Water needed immediately
2. Authority: `emergencyWaterAllocation(regionId, amount)` - Direct allocation
3. Done: Region receives water immediately
**Bypass**: Skips normal allocation process
**Use Case**: Natural disaster, emergency response

---

## 📚 Documentation Map

| Document | Purpose | Read When |
|----------|---------|-----------|
| ARCHITECTURE.md | Understand system design | Understanding how it works |
| API.md | Learn all functions | Implementing integration |
| ENHANCEMENTS.md | See what's new | Learning about features |
| IMPLEMENTATION_SUMMARY.md | Get complete overview | Verifying all features |
| QUICK_REFERENCE.md | Quick lookup | Quick answers (this file) |

---

## ✅ Implementation Checklist

- ✅ Gateway callback mode for async operations
- ✅ Refund mechanism for decryption failures
- ✅ Timeout protection (1 day + 7 day)
- ✅ Input validation on all functions
- ✅ Access control with modifiers
- ✅ Overflow protection on arithmetic
- ✅ Privacy obfuscation for divisions
- ✅ Price obfuscation via FHE
- ✅ Gas optimization for HCU
- ✅ Comprehensive audit trail
- ✅ Complete documentation

---

## 🚀 Getting Started

### To Deploy
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### To Verify
```bash
npx hardhat run scripts/verify.js --network sepolia
```

### To Interact
```bash
npx hardhat run scripts/interact.js --network sepolia
```

---

## 📞 Support

- See ARCHITECTURE.md for design questions
- See API.md for function specifications
- See ENHANCEMENTS.md for feature details
- Check inline code comments for implementation details

---

**Version**: 1.0
**Date**: November 2025
**Status**: ✅ Complete and Documented

