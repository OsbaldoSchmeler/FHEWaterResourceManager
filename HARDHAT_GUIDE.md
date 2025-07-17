# 🛠️ Hardhat Development Framework Guide

## Complete Guide to Water Resource Management Platform Development

This guide covers everything you need to know about developing, testing, and deploying smart contracts using the Hardhat framework.

---

## 📋 Table of Contents

- [Introduction](#introduction)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Best Practices](#best-practices)

---

## 🎯 Introduction

This project uses **Hardhat** as the primary development framework for Ethereum smart contracts. Hardhat provides:

- ✅ Built-in local blockchain for testing
- ✅ Advanced debugging with console.log
- ✅ TypeScript support
- ✅ Gas reporting and optimization
- ✅ Contract verification on Etherscan
- ✅ Comprehensive plugin ecosystem

---

## 📁 Project Structure

```
water-resource-management-platform/
├── contracts/                    # Solidity smart contracts
│   └── WaterResourceManager.sol  # Main contract
├── scripts/                      # Deployment and interaction scripts
│   ├── deploy.js                 # Deployment script
│   ├── verify.js                 # Etherscan verification
│   ├── interact.js               # Interactive CLI
│   └── simulate.js               # Workflow simulations
├── test/                         # Test files (to be added)
│   └── WaterResourceManager.test.js
├── deployments/                  # Deployment records (auto-generated)
│   └── sepolia-deployment.json
├── artifacts/                    # Compiled contracts (auto-generated)
├── cache/                        # Hardhat cache (auto-generated)
├── hardhat.config.js             # Hardhat configuration
├── package.json                  # Dependencies and scripts
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
├── README.md                     # Project overview
├── DEPLOYMENT.md                 # Deployment guide
└── HARDHAT_GUIDE.md             # This file
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs:
- Hardhat framework
- Ethers.js v6
- OpenZeppelin contracts
- FHEVM libraries
- Testing utilities
- Verification plugins

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 3. Compile Contracts

```bash
npm run compile
```

Expected output:
```
Compiled 1 Solidity file successfully (evm target: cancun)
```

### 4. Deploy to Network

```bash
npm run deploy
```

---

## 🔄 Development Workflow

### Step 1: Write Smart Contracts

Place your Solidity files in `contracts/`:

```solidity
// contracts/MyContract.sol
pragma solidity ^0.8.24;

contract MyContract {
    // Your code here
}
```

### Step 2: Compile

```bash
npm run compile
```

Hardhat will:
- Compile all contracts in `contracts/`
- Generate artifacts in `artifacts/`
- Create TypeChain types (if enabled)
- Report any compilation errors

### Step 3: Write Tests

Create test files in `test/`:

```javascript
// test/WaterResourceManager.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WaterResourceManager", function () {
  it("Should deploy successfully", async function () {
    const WaterResourceManager = await ethers.getContractFactory("WaterResourceManager");
    const contract = await WaterResourceManager.deploy();
    await contract.waitForDeployment();

    expect(await contract.getAddress()).to.be.properAddress;
  });
});
```

### Step 4: Run Tests

```bash
npm test
```

### Step 5: Deploy

```bash
# Deploy to Sepolia testnet
npm run deploy

# Deploy to local network
npm run deploy:local
```

### Step 6: Verify

```bash
npm run verify
```

### Step 7: Interact

```bash
npm run interact
```

---

## 📜 Available Scripts

### Compilation

```bash
# Compile all contracts
npm run compile

# Clean and recompile
npm run clean && npm run compile
```

### Testing

```bash
# Run all tests
npm test

# Run tests with gas reporting
REPORT_GAS=true npm test

# Run tests with coverage
npm run coverage
```

### Deployment

```bash
# Deploy to Sepolia testnet
npm run deploy

# Deploy to local network
npm run deploy:local

# Start local Hardhat node
npm run node
```

### Verification

```bash
# Verify on Etherscan
npm run verify
```

### Interaction

```bash
# Interactive CLI
npm run interact

# Run simulations
npm run simulate

# Run emergency scenario
npm run simulate emergency
```

### Utilities

```bash
# Clean artifacts and cache
npm run clean

# Open Hardhat console
npx hardhat console --network sepolia

# Check Hardhat version
npx hardhat --version

# List all tasks
npx hardhat help
```

---

## 🧪 Testing

### Writing Tests

Hardhat uses Mocha and Chai for testing:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("WaterResourceManager", function () {
  // Deploy fixture for reuse
  async function deployContractFixture() {
    const [authority, manager1, manager2] = await ethers.getSigners();

    const WaterResourceManager = await ethers.getContractFactory("WaterResourceManager");
    const contract = await WaterResourceManager.deploy();
    await contract.waitForDeployment();

    return { contract, authority, manager1, manager2 };
  }

  describe("Deployment", function () {
    it("Should set the right authority", async function () {
      const { contract, authority } = await loadFixture(deployContractFixture);
      expect(await contract.authority()).to.equal(authority.address);
    });
  });

  describe("Region Management", function () {
    it("Should register a new region", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await expect(
        contract.registerRegion("Test Region", 5, manager1.address)
      ).to.emit(contract, "RegionRegistered");
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/WaterResourceManager.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test

# Run with coverage
npx hardhat coverage
```

### Test Best Practices

1. **Use fixtures** for contract deployment
2. **Test edge cases** and error conditions
3. **Check events** are emitted correctly
4. **Verify state changes** after transactions
5. **Test access control** and permissions
6. **Use descriptive test names**
7. **Organize tests** into logical groups

---

## 🚀 Deployment

### Network Configuration

Networks are configured in `hardhat.config.js`:

```javascript
networks: {
  hardhat: {
    chainId: 1337,
  },
  localhost: {
    url: "http://127.0.0.1:8545",
    chainId: 1337,
  },
  sepolia: {
    url: process.env.SEPOLIA_RPC_URL,
    accounts: [process.env.PRIVATE_KEY],
    chainId: 11155111,
  },
}
```

### Deployment Script

The `scripts/deploy.js` script:

1. Gets deployer account
2. Checks balance
3. Deploys contract
4. Verifies deployment
5. Saves deployment info
6. Displays next steps

### Custom Deployment

Create custom deployment scripts:

```javascript
// scripts/deploy-custom.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying with account:", deployer.address);

  const Contract = await hre.ethers.getContractFactory("YourContract");
  const contract = await Contract.deploy(/* constructor args */);

  await contract.waitForDeployment();
  console.log("Contract deployed to:", await contract.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Run it:
```bash
npx hardhat run scripts/deploy-custom.js --network sepolia
```

---

## 🔧 Hardhat Configuration

### Basic Configuration

```javascript
// hardhat.config.js
module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
```

### Advanced Configuration

```javascript
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun"
    },
  },
  networks: {
    // Network configs
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
```

### Configuration Options

- **solidity**: Compiler version and settings
- **networks**: Network configurations
- **paths**: Custom directory paths
- **mocha**: Test runner configuration
- **gasReporter**: Gas usage reporting
- **etherscan**: Verification settings

---

## 🎯 Hardhat Tasks

### Using Built-in Tasks

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Clean artifacts
npx hardhat clean

# Start local node
npx hardhat node

# Open console
npx hardhat console

# List accounts
npx hardhat accounts

# Check balance
npx hardhat balance --account 0xYourAddress
```

### Creating Custom Tasks

Add to `hardhat.config.js`:

```javascript
task("balance", "Prints an account's balance")
  .addParam("account", "The account's address")
  .setAction(async (taskArgs, hre) => {
    const balance = await hre.ethers.provider.getBalance(taskArgs.account);
    console.log(hre.ethers.formatEther(balance), "ETH");
  });
```

Use it:
```bash
npx hardhat balance --account 0x1234...
```

---

## 💡 Best Practices

### Contract Development

1. ✅ Use latest stable Solidity version
2. ✅ Enable optimizer for production
3. ✅ Follow naming conventions
4. ✅ Add NatSpec comments
5. ✅ Implement access control
6. ✅ Emit events for important actions
7. ✅ Use custom errors (gas efficient)

### Testing

1. ✅ Achieve >90% code coverage
2. ✅ Test all public functions
3. ✅ Test edge cases and errors
4. ✅ Use fixtures for setup
5. ✅ Mock external dependencies
6. ✅ Test gas consumption
7. ✅ Test upgrade scenarios

### Deployment

1. ✅ Test on local network first
2. ✅ Deploy to testnet before mainnet
3. ✅ Verify contracts on Etherscan
4. ✅ Save deployment information
5. ✅ Document deployment process
6. ✅ Use multisig for mainnet
7. ✅ Monitor after deployment

### Security

1. ✅ Audit smart contracts
2. ✅ Use established libraries (OpenZeppelin)
3. ✅ Check for reentrancy
4. ✅ Validate all inputs
5. ✅ Use SafeMath (pre-0.8.0)
6. ✅ Implement circuit breakers
7. ✅ Test with fuzzing tools

---

## 🐛 Debugging

### Using console.log

```solidity
import "hardhat/console.sol";

contract MyContract {
    function myFunction(uint256 value) public {
        console.log("Value is:", value);
    }
}
```

### Stack Traces

Hardhat provides detailed error traces:

```
Error: VM Exception while processing transaction: reverted with reason string 'Not authorized'
    at WaterResourceManager.registerRegion (contracts/WaterResourceManager.sol:97)
    at processTicksAndRejections (node:internal/process/task_queues:96:5)
```

### Debugging Tips

1. Use `console.log` in contracts
2. Check transaction receipts
3. Use `try/catch` for external calls
4. Enable detailed error messages
5. Use Hardhat Network's verbose mode
6. Check gas estimates

---

## 📊 Gas Optimization

### Enable Gas Reporter

```javascript
// hardhat.config.js
gasReporter: {
  enabled: true,
  currency: "USD",
  gasPrice: 21,
}
```

Run tests:
```bash
REPORT_GAS=true npm test
```

### Optimization Techniques

1. ✅ Use `calldata` instead of `memory` for function parameters
2. ✅ Pack storage variables
3. ✅ Use custom errors instead of strings
4. ✅ Cache array length in loops
5. ✅ Use `immutable` and `constant`
6. ✅ Avoid unnecessary storage writes
7. ✅ Use events instead of storage

---

## 🔌 Plugins

This project uses these Hardhat plugins:

- **@nomicfoundation/hardhat-toolbox**: All-in-one plugin
- **@nomicfoundation/hardhat-verify**: Etherscan verification
- **hardhat-gas-reporter**: Gas usage reporting
- **solidity-coverage**: Code coverage

### Installing Additional Plugins

```bash
npm install --save-dev @plugin-name
```

Add to config:
```javascript
require("@plugin-name");
```

---

## 📚 Resources

### Documentation

- **Hardhat Docs**: https://hardhat.org/docs
- **Ethers.js Docs**: https://docs.ethers.org
- **Solidity Docs**: https://docs.soliditylang.org

### Learning

- **Hardhat Tutorial**: https://hardhat.org/tutorial
- **Smart Contract Best Practices**: https://consensys.github.io/smart-contract-best-practices/
- **Solidity by Example**: https://solidity-by-example.org

### Tools

- **Remix IDE**: https://remix.ethereum.org
- **Tenderly**: https://tenderly.co
- **Etherscan**: https://etherscan.io

---

## 🆘 Troubleshooting

### Common Issues

**Issue**: `Error HH8: There's one or more errors in your config file`
**Solution**: Check hardhat.config.js syntax

**Issue**: `Error: Cannot find module 'hardhat'`
**Solution**: Run `npm install`

**Issue**: `Error: Invalid private key`
**Solution**: Check PRIVATE_KEY in .env (no 0x prefix)

**Issue**: `Error: insufficient funds`
**Solution**: Get test ETH from faucet

**Issue**: Compilation fails
**Solution**: Check Solidity version compatibility

---

## 🎓 Next Steps

1. ✅ Complete the Quick Start guide
2. ✅ Write comprehensive tests
3. ✅ Deploy to local network
4. ✅ Deploy to Sepolia testnet
5. ✅ Verify on Etherscan
6. ✅ Audit smart contracts
7. ✅ Plan mainnet deployment

---

**Happy Building! 🚀**

For questions or issues, check the [Hardhat documentation](https://hardhat.org/docs) or open an issue on GitHub.
