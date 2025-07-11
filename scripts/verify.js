const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🔍 Starting contract verification on Etherscan...\n");

  // Load deployment info
  const deploymentFile = path.join(
    __dirname,
    "..",
    "deployments",
    `${hre.network.name}-deployment.json`
  );

  if (!fs.existsSync(deploymentFile)) {
    console.error(`❌ Deployment file not found: ${deploymentFile}`);
    console.log("Please deploy the contract first using: npm run deploy");
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  console.log("📋 Verification Details:");
  console.log("━".repeat(50));
  console.log(`Network: ${deploymentInfo.network}`);
  console.log(`Contract: ${deploymentInfo.contractName}`);
  console.log(`Address: ${deploymentInfo.contractAddress}`);
  console.log("━".repeat(50));

  // Check if we have Etherscan API key
  if (!process.env.ETHERSCAN_API_KEY) {
    console.error("\n❌ ETHERSCAN_API_KEY not found in environment variables");
    console.log("Please add ETHERSCAN_API_KEY to your .env file");
    process.exit(1);
  }

  try {
    console.log("\n📤 Submitting contract for verification...");
    console.log("This may take a few moments...\n");

    // Verify the contract
    await hre.run("verify:verify", {
      address: deploymentInfo.contractAddress,
      constructorArguments: [],
    });

    console.log("\n✅ Contract verified successfully!");
    console.log("\n🔗 View verified contract:");
    console.log(`   ${deploymentInfo.etherscanUrl}`);

    // Update deployment info with verification status
    deploymentInfo.verified = true;
    deploymentInfo.verifiedAt = new Date().toISOString();
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n💾 Verification status updated in deployment file");

  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("\n✅ Contract is already verified on Etherscan");
      console.log(`🔗 ${deploymentInfo.etherscanUrl}`);
    } else {
      console.error("\n❌ Verification failed:");
      console.error(error.message);

      // Common errors and solutions
      console.log("\n💡 Troubleshooting:");
      console.log("━".repeat(50));
      console.log("1. Make sure ETHERSCAN_API_KEY is set correctly");
      console.log("2. Wait a few blocks after deployment before verifying");
      console.log("3. Ensure the contract address is correct");
      console.log("4. Check if the network is supported");
      console.log("━".repeat(50));

      process.exit(1);
    }
  }

  console.log("\n✨ Verification process completed!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error during verification:");
    console.error(error);
    process.exit(1);
  });
