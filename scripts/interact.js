const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function loadContract() {
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
  const [signer] = await hre.ethers.getSigners();

  const WaterResourceManager = await hre.ethers.getContractFactory("WaterResourceManager");
  const contract = WaterResourceManager.attach(deploymentInfo.contractAddress);

  return { contract, deploymentInfo, signer };
}

async function displayMenu() {
  console.log("\n" + "═".repeat(60));
  console.log("         Water Resource Manager - Interaction Menu");
  console.log("═".repeat(60));
  console.log("\n📊 Management Operations:");
  console.log("  1. Register New Region");
  console.log("  2. Start Allocation Period");
  console.log("  3. Submit Water Request");
  console.log("  4. Process Allocation");
  console.log("  5. Emergency Water Allocation");
  console.log("\n🔍 Query Operations:");
  console.log("  6. View Contract Info");
  console.log("  7. Get Region Details");
  console.log("  8. Get Current Period Info");
  console.log("  9. Check Region Request Status");
  console.log("\n⚙️  Administrative:");
  console.log("  10. Update Region Manager");
  console.log("  11. Deactivate Region");
  console.log("\n  0. Exit");
  console.log("\n" + "═".repeat(60));
}

async function registerRegion(contract) {
  console.log("\n📝 Register New Region");
  console.log("━".repeat(50));

  const name = await question("Enter region name: ");
  const priority = await question("Enter priority level (1-10): ");
  const manager = await question("Enter manager address: ");

  console.log("\n⏳ Registering region...");
  const tx = await contract.registerRegion(name, parseInt(priority), manager);
  const receipt = await tx.wait();

  console.log(`✅ Region registered successfully!`);
  console.log(`Transaction: ${receipt.hash}`);

  // Get the region ID from event
  const event = receipt.logs.find(log => {
    try {
      return contract.interface.parseLog(log).name === "RegionRegistered";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsedEvent = contract.interface.parseLog(event);
    console.log(`Region ID: ${parsedEvent.args.regionId}`);
  }
}

async function startAllocationPeriod(contract) {
  console.log("\n🚀 Start Allocation Period");
  console.log("━".repeat(50));

  const totalWater = await question("Enter total available water: ");
  const duration = await question("Enter duration in hours (1-168): ");

  console.log("\n⏳ Starting allocation period...");
  const tx = await contract.startAllocationPeriod(
    parseInt(totalWater),
    parseInt(duration)
  );
  const receipt = await tx.wait();

  console.log(`✅ Allocation period started!`);
  console.log(`Transaction: ${receipt.hash}`);
}

async function submitWaterRequest(contract) {
  console.log("\n💧 Submit Water Request");
  console.log("━".repeat(50));

  const requestedAmount = await question("Enter requested water amount: ");
  const justificationScore = await question("Enter justification score (1-100): ");

  console.log("\n⏳ Submitting water request...");
  const tx = await contract.submitWaterRequest(
    parseInt(requestedAmount),
    parseInt(justificationScore)
  );
  const receipt = await tx.wait();

  console.log(`✅ Water request submitted!`);
  console.log(`Transaction: ${receipt.hash}`);
}

async function processAllocation(contract) {
  console.log("\n⚙️  Process Allocation");
  console.log("━".repeat(50));

  const confirm = await question("Process allocation for current period? (yes/no): ");

  if (confirm.toLowerCase() === "yes") {
    console.log("\n⏳ Processing allocation...");
    const tx = await contract.processAllocation();
    const receipt = await tx.wait();

    console.log(`✅ Allocation processed!`);
    console.log(`Transaction: ${receipt.hash}`);
  } else {
    console.log("❌ Allocation processing cancelled");
  }
}

async function emergencyAllocation(contract) {
  console.log("\n🚨 Emergency Water Allocation");
  console.log("━".repeat(50));

  const regionId = await question("Enter region ID: ");
  const amount = await question("Enter emergency water amount: ");

  console.log("\n⏳ Processing emergency allocation...");
  const tx = await contract.emergencyWaterAllocation(
    parseInt(regionId),
    parseInt(amount)
  );
  const receipt = await tx.wait();

  console.log(`✅ Emergency allocation completed!`);
  console.log(`Transaction: ${receipt.hash}`);
}

async function viewContractInfo(contract, signer) {
  console.log("\n📊 Contract Information");
  console.log("━".repeat(50));

  const authority = await contract.authority();
  const currentPeriod = await contract.currentAllocationPeriod();
  const totalRegions = await contract.totalRegions();
  const isActive = await contract.isAllocationPeriodActive();

  console.log(`Authority: ${authority}`);
  console.log(`Your Address: ${signer.address}`);
  console.log(`You are ${authority === signer.address ? "✅" : "❌"} the authority`);
  console.log(`Current Period: ${currentPeriod}`);
  console.log(`Total Regions: ${totalRegions}`);
  console.log(`Allocation Active: ${isActive ? "✅ Yes" : "❌ No"}`);
}

async function getRegionDetails(contract) {
  console.log("\n🏘️  Region Details");
  console.log("━".repeat(50));

  const regionId = await question("Enter region ID: ");

  try {
    const info = await contract.getRegionInfo(parseInt(regionId));
    console.log(`\nRegion Name: ${info.name}`);
    console.log(`Manager: ${info.manager}`);
    console.log(`Active: ${info.isActive ? "✅ Yes" : "❌ No"}`);
    console.log(`Last Update: ${new Date(Number(info.lastUpdateTime) * 1000).toLocaleString()}`);
  } catch (error) {
    console.error("❌ Error fetching region details:", error.message);
  }
}

async function getCurrentPeriodInfo(contract) {
  console.log("\n📅 Current Period Information");
  console.log("━".repeat(50));

  const info = await contract.getCurrentPeriodInfo();

  if (info.periodId === 0n) {
    console.log("❌ No allocation period has been started yet");
  } else {
    console.log(`Period ID: ${info.periodId}`);
    console.log(`Start Time: ${new Date(Number(info.startTime) * 1000).toLocaleString()}`);
    console.log(`End Time: ${new Date(Number(info.endTime) * 1000).toLocaleString()}`);
    console.log(`Distribution Completed: ${info.distributionCompleted ? "✅ Yes" : "❌ No"}`);
    console.log(`Participating Regions: ${info.participatingRegions}`);
    console.log(`Status: ${info.isActive ? "✅ Active" : "❌ Inactive"}`);
  }
}

async function checkRegionRequestStatus(contract) {
  console.log("\n📋 Region Request Status");
  console.log("━".repeat(50));

  const regionId = await question("Enter region ID: ");

  try {
    const status = await contract.getRegionRequestStatus(parseInt(regionId));
    console.log(`\nRequest Submitted: ${status.hasSubmittedRequest ? "✅ Yes" : "❌ No"}`);
    console.log(`Request Processed: ${status.isProcessed ? "✅ Yes" : "❌ No"}`);
    if (status.timestamp > 0n) {
      console.log(`Submission Time: ${new Date(Number(status.timestamp) * 1000).toLocaleString()}`);
    }
  } catch (error) {
    console.error("❌ Error fetching request status:", error.message);
  }
}

async function updateRegionManager(contract) {
  console.log("\n👤 Update Region Manager");
  console.log("━".repeat(50));

  const regionId = await question("Enter region ID: ");
  const newManager = await question("Enter new manager address: ");

  console.log("\n⏳ Updating region manager...");
  const tx = await contract.updateRegionManager(parseInt(regionId), newManager);
  const receipt = await tx.wait();

  console.log(`✅ Region manager updated!`);
  console.log(`Transaction: ${receipt.hash}`);
}

async function deactivateRegion(contract) {
  console.log("\n🔒 Deactivate Region");
  console.log("━".repeat(50));

  const regionId = await question("Enter region ID: ");
  const confirm = await question(`Deactivate region ${regionId}? (yes/no): `);

  if (confirm.toLowerCase() === "yes") {
    console.log("\n⏳ Deactivating region...");
    const tx = await contract.deactivateRegion(parseInt(regionId));
    const receipt = await tx.wait();

    console.log(`✅ Region deactivated!`);
    console.log(`Transaction: ${receipt.hash}`);
  } else {
    console.log("❌ Deactivation cancelled");
  }
}

async function main() {
  console.log("\n💧 Water Resource Manager - Interactive CLI\n");

  const { contract, deploymentInfo, signer } = await loadContract();

  console.log("📋 Connection Details:");
  console.log("━".repeat(50));
  console.log(`Network: ${deploymentInfo.network}`);
  console.log(`Contract: ${deploymentInfo.contractAddress}`);
  console.log(`Your Address: ${signer.address}`);
  console.log("━".repeat(50));

  let exit = false;

  while (!exit) {
    await displayMenu();
    const choice = await question("\nSelect an option: ");

    try {
      switch (choice) {
        case "1":
          await registerRegion(contract);
          break;
        case "2":
          await startAllocationPeriod(contract);
          break;
        case "3":
          await submitWaterRequest(contract);
          break;
        case "4":
          await processAllocation(contract);
          break;
        case "5":
          await emergencyAllocation(contract);
          break;
        case "6":
          await viewContractInfo(contract, signer);
          break;
        case "7":
          await getRegionDetails(contract);
          break;
        case "8":
          await getCurrentPeriodInfo(contract);
          break;
        case "9":
          await checkRegionRequestStatus(contract);
          break;
        case "10":
          await updateRegionManager(contract);
          break;
        case "11":
          await deactivateRegion(contract);
          break;
        case "0":
          exit = true;
          console.log("\n👋 Goodbye!\n");
          break;
        default:
          console.log("\n❌ Invalid option. Please try again.");
      }
    } catch (error) {
      console.error("\n❌ Error:", error.message);
    }

    if (!exit) {
      await question("\nPress Enter to continue...");
    }
  }

  rl.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error);
    rl.close();
    process.exit(1);
  });
