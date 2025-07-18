# ⚡ Quick Start Guide

## Get Started in 5 Minutes

This guide will help you quickly set up and deploy the Water Resource Management Platform.

---

## 🚀 Installation

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env  # or use your preferred editor
```

Required variables:
- `PRIVATE_KEY` - Your wallet private key (no 0x prefix)
- `SEPOLIA_RPC_URL` - Ethereum Sepolia RPC endpoint
- `ETHERSCAN_API_KEY` - Etherscan API key for verification

---

## 🔨 Development Commands

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm test
```

### Deploy to Sepolia

```bash
npm run deploy
```

### Verify on Etherscan

```bash
npm run verify
```

### Interact with Contract

```bash
npm run interact
```

### Run Simulations

```bash
npm run simulate
```

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Compile smart contracts |
| `npm test` | Run test suite |
| `npm run deploy` | Deploy to Sepolia testnet |
| `npm run deploy:local` | Deploy to local network |
| `npm run verify` | Verify on Etherscan |
| `npm run interact` | Interactive CLI |
| `npm run simulate` | Run workflow simulation |
| `npm run node` | Start local Hardhat node |
| `npm run clean` | Clean artifacts and cache |

---

## 🎯 Quick Workflow

### 1. Local Development

```bash
# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy locally
npm run deploy:local

# Terminal 3: Run tests
npm test
```

### 2. Testnet Deployment

```bash
# Compile contracts
npm run compile

# Deploy to Sepolia
npm run deploy

# Verify contract
npm run verify

# Interact with contract
npm run interact
```

### 3. Testing Workflow

```bash
# Run all tests
npm test

# Run with gas reporting
REPORT_GAS=true npm test

# Run with coverage
npm run coverage
```

---

## 📍 Project Structure

```
water-resource-management-platform/
├── contracts/               # Smart contracts
│   └── WaterResourceManager.sol
├── scripts/                # Deployment scripts
│   ├── deploy.js           # Main deployment
│   ├── verify.js           # Etherscan verification
│   ├── interact.js         # Interactive CLI
│   └── simulate.js         # Simulations
├── test/                   # Test files
│   └── WaterResourceManager.test.js
├── hardhat.config.js       # Hardhat configuration
└── package.json            # Dependencies
```

---

## 🔑 Getting Test ETH

Visit these faucets to get Sepolia test ETH:

1. **Alchemy Faucet**: https://sepoliafaucet.com/
2. **Infura Faucet**: https://infura.io/faucet/sepolia
3. **Chainlink Faucet**: https://faucets.chain.link/sepolia

---

## 🔗 Useful Links

- **Hardhat Docs**: https://hardhat.org/docs
- **Etherscan Sepolia**: https://sepolia.etherscan.io
- **FHE Documentation**: https://docs.zama.ai/fhevm

---

## 🆘 Common Issues

### Issue: "Insufficient funds"
**Solution**: Get test ETH from faucets

### Issue: "Network not found"
**Solution**: Check `SEPOLIA_RPC_URL` in .env

### Issue: "Invalid private key"
**Solution**: Ensure private key has no `0x` prefix

### Issue: Compilation fails
**Solution**: Run `npm run clean` then `npm run compile`

---

## 📚 Next Steps

1. ✅ Read [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment guide
2. ✅ Read [HARDHAT_GUIDE.md](./HARDHAT_GUIDE.md) for framework details
3. ✅ Review contract in [contracts/WaterResourceManager.sol](./contracts/WaterResourceManager.sol)
4. ✅ Check tests in [test/WaterResourceManager.test.js](./test/WaterResourceManager.test.js)

---

## 💡 Tips

- Always test on local network first
- Deploy to testnet before mainnet
- Verify contracts on Etherscan
- Save deployment addresses
- Monitor gas costs

---

**Ready to build? Let's go! 🚀**
