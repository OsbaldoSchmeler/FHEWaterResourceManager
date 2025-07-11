const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 Starting Water Resource Manager deployment...\n");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("📋 Deployment Details:");
  console.log("━".repeat(50));
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Account Balance: ${hre.ethers.formatEther(balance)} ETH`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}`);
  console.log("━".repeat(50));

  // Check if we have enough balance
  if (balance < hre.ethers.parseEther("0.01")) {
    console.warn("⚠️  Warning: Low balance. You may not have enough ETH for deployment.");
  }

  console.log("\n📦 Deploying WaterResourceManager contract...");

  // Get the contract factory
  const WaterResourceManager = await hre.ethers.getContractFactory("WaterResourceManager");

  // Deploy the contract
  const startTime = Date.now();
  const waterManager = await WaterResourceManager.deploy();

  // Wait for deployment to finish
  await waterManager.waitForDeployment();
  const contractAddress = await waterManager.getAddress();
  const deployTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n✅ Contract deployed successfully in ${deployTime}s`);
  console.log("\n📍 Deployment Information:");
  console.log("━".repeat(50));
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Transaction Hash: ${waterManager.deploymentTransaction().hash}`);
  console.log(`Block Number: ${(await waterManager.deploymentTransaction().wait()).blockNumber}`);
  console.log(`Deployer (Authority): ${deployer.address}`);
  console.log("━".repeat(50));

  // Verify contract state
  console.log("\n🔍 Verifying contract state...");
  const authority = await waterManager.authority();
  const currentPeriod = await waterManager.currentAllocationPeriod();

  console.log(`Authority Address: ${authority}`);
  console.log(`Current Allocation Period: ${currentPeriod}`);
  console.log(`✅ Contract state verified`);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    contractName: "WaterResourceManager",
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    authorityAddress: authority,
    deploymentTransaction: waterManager.deploymentTransaction().hash,
    blockNumber: (await waterManager.deploymentTransaction().wait()).blockNumber,
    timestamp: new Date().toISOString(),
    compiler: {
      solidity: "0.8.24",
      optimizer: true,
      runs: 200
    },
    etherscanUrl: hre.network.name === "sepolia"
      ? `https://sepolia.etherscan.io/address/${contractAddress}`
      : `https://etherscan.io/address/${contractAddress}`
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Save deployment info to JSON file
  const deploymentFile = path.join(
    deploymentsDir,
    `${hre.network.name}-deployment.json`
  );
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);

  // Display next steps
  console.log("\n📝 Next Steps:");
  console.log("━".repeat(50));
  console.log("1. Verify the contract on Etherscan:");
  console.log(`   npm run verify`);
  console.log("\n2. Interact with the contract:");
  console.log(`   npm run interact`);
  console.log("\n3. Run simulations:");
  console.log(`   npm run simulate`);
  console.log("━".repeat(50));

  if (hre.network.name === "sepolia") {
    console.log(`\n🔗 View on Etherscan: ${deploymentInfo.etherscanUrl}`);
  }

  console.log("\n✨ Deployment completed successfully!\n");
}

// Error handling
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
