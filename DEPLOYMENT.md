# 🚀 Deployment Guide

## Water Resource Management Platform - Deployment Documentation

This document provides comprehensive information about deploying and managing the Water Resource Manager smart contract.

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Deployment Process](#deployment-process)
- [Verification](#verification)
- [Contract Interaction](#contract-interaction)
- [Deployed Contracts](#deployed-contracts)
- [Network Information](#network-information)
- [Troubleshooting](#troubleshooting)

---

## ⚙️ Prerequisites

Before deploying the contract, ensure you have:

- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **MetaMask** or another Ethereum wallet
- **Test ETH** on Sepolia testnet ([Get from faucet](https://sepoliafaucet.com/))
- **Etherscan API Key** ([Get from Etherscan](https://etherscan.io/apis))
- **Sepolia RPC URL** (optional, default provided)

---

## 📦 Installation

1. **Clone or navigate to the project directory:**
```bash
cd water-resource-management-platform
```

2. **Install dependencies:**
```bash
npm install
```

3. **Verify installation:**
```bash
npx hardhat --version
```

---

## 🔧 Configuration

### 1. Environment Setup

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your credentials:

```env
# Private key of deployer account (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Sepolia testnet RPC URL
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com

# Etherscan API key for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key

# Optional: Enable gas reporting
REPORT_GAS=false
```

**Security Warning:** Never commit your `.env` file to version control!

---

## 🚀 Deployment Process

### Step 1: Compile Contracts

```bash
npm run compile
```

Expected output:
```
✔ Compiled 1 Solidity file successfully
```

### Step 2: Deploy to Network

#### Deploy to Sepolia Testnet:
```bash
npm run deploy
```

#### Deploy to Local Network:
```bash
# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy
npm run deploy:local
```

### Step 3: Save Deployment Information

The deployment script automatically saves information to:
```
deployments/sepolia-deployment.json
```

This file contains:
- Contract address
- Deployer address
- Transaction hash
- Block number
- Timestamp
- Etherscan URL

---

## ✅ Verification

### Verify on Etherscan

After deployment, verify your contract:

```bash
npm run verify
```

This will:
- Submit contract source code to Etherscan
- Verify compiler settings match
- Enable public interaction through Etherscan UI

### Manual Verification

If automatic verification fails:

```bash
npx hardhat verify --network sepolia CONTRACT_ADDRESS
```

---

## 🔗 Contract Interaction

### Using Interactive CLI

Start the interactive interface:

```bash
npm run interact
```

Available operations:
- Register new regions
- Start allocation periods
- Submit water requests
- Process allocations
- Emergency allocations
- View contract information
- Query region details

### Using Simulation Scripts

Run complete workflow simulation:

```bash
npm run simulate
```

Run emergency scenario:

```bash
npm run simulate emergency
```

### Direct Interaction with Hardhat Console

```bash
npx hardhat console --network sepolia
```

Then in console:
```javascript
const WaterResourceManager = await ethers.getContractFactory("WaterResourceManager");
const contract = WaterResourceManager.attach("CONTRACT_ADDRESS");

// Check authority
const authority = await contract.authority();
console.log("Authority:", authority);

// Check current period
const period = await contract.getCurrentPeriodInfo();
console.log("Period:", period);
```

---

## 📍 Deployed Contracts

### Sepolia Testnet

| Item | Details |
|------|---------|
| **Contract Name** | WaterResourceManager |
| **Contract Address** | `0x4E2c3faE5165E4d5f9E2dEcFEA50e84399157b76` |
| **Network** | Ethereum Sepolia Testnet |
| **Chain ID** | 11155111 |
| **Compiler Version** | 0.8.24 |
| **Optimization** | Enabled (200 runs) |
| **License** | MIT |

**Etherscan Links:**
- **Contract**: [View on Etherscan](https://sepolia.etherscan.io/address/0x4E2c3faE5165E4d5f9E2dEcFEA50e84399157b76)
- **Transactions**: [View Transactions](https://sepolia.etherscan.io/address/0x4E2c3faE5165E4d5f9E2dEcFEA50e84399157b76#transactions)

---

## 🌐 Network Information

### Ethereum Sepolia Testnet

| Parameter | Value |
|-----------|-------|
| **Network Name** | Sepolia |
| **Chain ID** | 11155111 |
| **Currency Symbol** | ETH |
| **Block Explorer** | https://sepolia.etherscan.io |
| **RPC URL** | https://ethereum-sepolia-rpc.publicnode.com |

### Getting Test ETH

1. **Alchemy Sepolia Faucet**: https://sepoliafaucet.com/
2. **Infura Sepolia Faucet**: https://infura.io/faucet/sepolia
3. **Chainlink Faucet**: https://faucets.chain.link/sepolia

---

## 🔍 Contract Features

### Core Functionality

- **Region Management**: Register and manage water distribution regions
- **Allocation Periods**: Time-bound water distribution cycles
- **Privacy-Preserving**: FHE encryption for sensitive data
- **Priority-Based**: Fair allocation based on priority levels
- **Emergency Response**: Immediate allocation for crisis situations

### Access Control

- **Authority**: Contract deployer with admin privileges
- **Region Managers**: Manage individual regions
- **Public Views**: Anyone can query public information

### Events

- `RegionRegistered`: New region added
- `AllocationPeriodStarted`: New period initiated
- `WaterRequested`: Request submitted
- `WaterAllocated`: Allocation completed
- `AllocationCompleted`: Period finalized
- `EmergencyAllocation`: Emergency water distributed

---

## 🛠️ Troubleshooting

### Common Issues

#### 1. Deployment Fails with "Insufficient Funds"

**Solution:**
- Check wallet balance: https://sepolia.etherscan.io
- Get test ETH from faucets
- Reduce gas price in hardhat.config.js

#### 2. Verification Fails

**Solutions:**
- Wait 2-3 minutes after deployment
- Check ETHERSCAN_API_KEY is correct
- Verify on Etherscan website manually
- Check if already verified

#### 3. "Network not found" Error

**Solution:**
- Check SEPOLIA_RPC_URL in .env
- Try alternative RPC: `https://rpc.sepolia.org`
- Verify network configuration in hardhat.config.js

#### 4. Transaction Timeout

**Solutions:**
- Increase timeout in hardhat.config.js (mocha section)
- Check network congestion
- Increase gas price

#### 5. "Nonce too high" Error

**Solution:**
```bash
# Reset account nonce
npx hardhat clean
# Or reset MetaMask account
```

### Getting Help

- **Hardhat Docs**: https://hardhat.org/docs
- **Ethers.js Docs**: https://docs.ethers.org
- **FHEVM Docs**: https://docs.zama.ai/fhevm

---

## 📊 Gas Costs (Estimated)

| Operation | Gas Used | Cost (at 30 gwei) |
|-----------|----------|-------------------|
| Contract Deployment | ~3,500,000 | ~0.105 ETH |
| Register Region | ~200,000 | ~0.006 ETH |
| Start Allocation Period | ~150,000 | ~0.0045 ETH |
| Submit Water Request | ~180,000 | ~0.0054 ETH |
| Process Allocation | ~300,000 | ~0.009 ETH |
| Emergency Allocation | ~120,000 | ~0.0036 ETH |

*Note: Actual costs vary with network conditions*

---

## 🔐 Security Considerations

### Best Practices

1. **Never share your private key**
2. **Use separate wallets for mainnet and testnet**
3. **Verify all contract addresses before interaction**
4. **Test thoroughly on testnet before mainnet**
5. **Keep dependencies updated**
6. **Audit smart contracts before production**

### Contract Security Features

- Role-based access control
- Input validation on all functions
- Reentrancy protection (where applicable)
- Fully Homomorphic Encryption for privacy
- Comprehensive event logging

---

## 📈 Monitoring & Analytics

### Track Your Deployment

1. **Etherscan Dashboard**: Monitor transactions and events
2. **Hardhat Console**: Direct contract queries
3. **Event Logs**: Track all contract activities
4. **Gas Reporter**: Analyze transaction costs

### Useful Commands

```bash
# Check contract code on Etherscan
npm run verify

# View all transactions
# Visit: https://sepolia.etherscan.io/address/YOUR_CONTRACT

# Monitor events in real-time
npx hardhat run scripts/monitor-events.js --network sepolia
```

---

## 🚀 Next Steps

After successful deployment:

1. ✅ Verify contract on Etherscan
2. ✅ Register initial regions
3. ✅ Set up region managers
4. ✅ Start first allocation period
5. ✅ Test water request workflow
6. ✅ Monitor system performance
7. ✅ Document operational procedures

---

## 📚 Additional Resources

### Documentation

- **Project README**: ./README.md
- **Contract Source**: ./contracts/WaterResourceManager.sol
- **Test Suite**: ./test/ (to be added)

### Scripts

- **deploy.js**: Main deployment script
- **verify.js**: Etherscan verification
- **interact.js**: Interactive CLI tool
- **simulate.js**: Workflow simulation

### External Links

- **Live Demo**: https://water-resource-manager.vercel.app/
- **GitHub**: https://github.com/OsbaldoSchmeler/WaterResourceManager
- **FHE Technology**: https://www.zama.ai/

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-10 | Initial deployment on Sepolia |

---

## 📧 Support

For questions or issues:
- Open an issue on GitHub
- Check documentation at /docs
- Review Hardhat troubleshooting guide

---

**Last Updated**: October 2024
**Maintained By**: Water Resource Management Team
**License**: MIT
