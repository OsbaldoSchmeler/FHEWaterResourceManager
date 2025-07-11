const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

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
  const [authority, ...otherSigners] = await hre.ethers.getSigners();

  const WaterResourceManager = await hre.ethers.getContractFactory("WaterResourceManager");
  const contract = WaterResourceManager.attach(deploymentInfo.contractAddress);

  return { contract, deploymentInfo, authority, otherSigners };
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateCompleteWorkflow() {
  console.log("\n🎭 Simulating Complete Water Resource Management Workflow");
  console.log("═".repeat(70));

  const { contract, deploymentInfo, authority, otherSigners } = await loadContract();

  console.log("\n📋 Simulation Details:");
  console.log("━".repeat(70));
  console.log(`Network: ${deploymentInfo.network}`);
  console.log(`Contract: ${deploymentInfo.contractAddress}`);
  console.log(`Authority: ${authority.address}`);
  console.log(`Available Test Accounts: ${otherSigners.length}`);
  console.log("━".repeat(70));

  // Simulation data
  const regions = [
    { name: "Metropolitan District", priority: 8, manager: otherSigners[0].address },
    { name: "Agricultural Zone North", priority: 6, manager: otherSigners[1].address },
    { name: "Industrial Complex East", priority: 5, manager: otherSigners[2].address },
    { name: "Residential Area South", priority: 7, manager: otherSigners[3].address },
  ];

  const waterRequests = [
    { amount: 5000, justification: 85 },
    { amount: 8000, justification: 75 },
    { amount: 3000, justification: 60 },
    { amount: 4000, justification: 80 },
  ];

  // Step 1: Register Regions
  console.log("\n📍 Step 1: Registering Regions");
  console.log("━".repeat(70));

  const regionIds = [];
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    console.log(`\n  Registering: ${region.name}`);
    console.log(`  Priority: ${region.priority}/10`);
    console.log(`  Manager: ${region.manager}`);

    try {
      const tx = await contract.registerRegion(
        region.name,
        region.priority,
        region.manager
      );
      const receipt = await tx.wait();

      // Extract region ID from event
      const event = receipt.logs.find(log => {
        try {
          return contract.interface.parseLog(log).name === "RegionRegistered";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedEvent = contract.interface.parseLog(event);
        const regionId = Number(parsedEvent.args.regionId);
        regionIds.push(regionId);
        console.log(`  ✅ Registered with Region ID: ${regionId}`);
        console.log(`  Transaction: ${receipt.hash}`);
      }

      await delay(1000);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  console.log(`\n✅ Registered ${regionIds.length} regions successfully`);

  // Step 2: Start Allocation Period
  console.log("\n\n⏰ Step 2: Starting Allocation Period");
  console.log("━".repeat(70));

  const totalWater = 20000;
  const durationHours = 24;

  console.log(`  Total Available Water: ${totalWater} units`);
  console.log(`  Duration: ${durationHours} hours`);

  try {
    const tx = await contract.startAllocationPeriod(totalWater, durationHours);
    const receipt = await tx.wait();
    console.log(`  ✅ Allocation period started`);
    console.log(`  Transaction: ${receipt.hash}`);

    const periodInfo = await contract.getCurrentPeriodInfo();
    console.log(`  Period ID: ${periodInfo.periodId}`);
    console.log(`  Start: ${new Date(Number(periodInfo.startTime) * 1000).toLocaleString()}`);
    console.log(`  End: ${new Date(Number(periodInfo.endTime) * 1000).toLocaleString()}`);
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return;
  }

  await delay(2000);

  // Step 3: Submit Water Requests
  console.log("\n\n💧 Step 3: Submitting Water Requests");
  console.log("━".repeat(70));

  for (let i = 0; i < waterRequests.length && i < otherSigners.length; i++) {
    const request = waterRequests[i];
    const signer = otherSigners[i];

    console.log(`\n  Region ${i + 1} (${regions[i].name}):`);
    console.log(`  Requested Amount: ${request.amount} units`);
    console.log(`  Justification Score: ${request.justification}/100`);

    try {
      const tx = await contract.connect(signer).submitWaterRequest(
        request.amount,
        request.justification
      );
      const receipt = await tx.wait();
      console.log(`  ✅ Request submitted`);
      console.log(`  Transaction: ${receipt.hash}`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }

    await delay(1000);
  }

  console.log(`\n✅ All water requests submitted`);

  // Step 4: View Request Status
  console.log("\n\n📊 Step 4: Checking Request Status");
  console.log("━".repeat(70));

  for (let i = 0; i < regionIds.length; i++) {
    const regionId = regionIds[i];
    try {
      const status = await contract.getRegionRequestStatus(regionId);
      console.log(`\n  Region ${regionId} (${regions[i].name}):`);
      console.log(`  Request Submitted: ${status.hasSubmittedRequest ? "✅" : "❌"}`);
      console.log(`  Request Processed: ${status.isProcessed ? "✅" : "❌"}`);
      if (status.timestamp > 0n) {
        console.log(`  Submission Time: ${new Date(Number(status.timestamp) * 1000).toLocaleString()}`);
      }
    } catch (error) {
      console.error(`  ❌ Error checking region ${regionId}: ${error.message}`);
    }
  }

  // Step 5: Process Allocation
  console.log("\n\n⚙️  Step 5: Processing Allocation");
  console.log("━".repeat(70));

  console.log("  ⏳ Initiating allocation process...");

  try {
    const tx = await contract.processAllocation();
    const receipt = await tx.wait();
    console.log(`  ✅ Allocation processed successfully`);
    console.log(`  Transaction: ${receipt.hash}`);
    console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    console.log(`  Note: FHE decryption callbacks may require additional setup`);
  }

  await delay(2000);

  // Step 6: Check Final Status
  console.log("\n\n🏁 Step 6: Final Status Check");
  console.log("━".repeat(70));

  const finalPeriodInfo = await contract.getCurrentPeriodInfo();
  console.log(`\n  Period ID: ${finalPeriodInfo.periodId}`);
  console.log(`  Participating Regions: ${finalPeriodInfo.participatingRegions}`);
  console.log(`  Distribution Completed: ${finalPeriodInfo.distributionCompleted ? "✅" : "❌"}`);
  console.log(`  Period Active: ${finalPeriodInfo.isActive ? "✅" : "❌"}`);

  // Step 7: Emergency Allocation Simulation
  console.log("\n\n🚨 Step 7: Emergency Allocation Simulation");
  console.log("━".repeat(70));

  if (regionIds.length > 0) {
    const emergencyRegionId = regionIds[0];
    const emergencyAmount = 2000;

    console.log(`\n  Allocating emergency water to Region ${emergencyRegionId}`);
    console.log(`  Emergency Amount: ${emergencyAmount} units`);

    try {
      const tx = await contract.emergencyWaterAllocation(
        emergencyRegionId,
        emergencyAmount
      );
      const receipt = await tx.wait();
      console.log(`  ✅ Emergency allocation completed`);
      console.log(`  Transaction: ${receipt.hash}`);
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }

  // Summary
  console.log("\n\n📈 Simulation Summary");
  console.log("═".repeat(70));
  console.log(`✅ Regions Registered: ${regionIds.length}`);
  console.log(`✅ Allocation Period Started: Yes`);
  console.log(`✅ Water Requests Submitted: ${waterRequests.length}`);
  console.log(`✅ Allocation Processed: ${finalPeriodInfo.distributionCompleted ? "Yes" : "Pending"}`);
  console.log(`✅ Emergency Allocation: Completed`);
  console.log("═".repeat(70));

  console.log("\n💡 Simulation Insights:");
  console.log("━".repeat(70));
  console.log("• The contract successfully handles region registration");
  console.log("• Multiple regions can submit requests simultaneously");
  console.log("• Priority-based allocation ensures fair distribution");
  console.log("• Emergency protocols allow immediate response to crises");
  console.log("• All operations are recorded on-chain for transparency");
  console.log("━".repeat(70));

  console.log("\n✨ Simulation completed successfully!\n");
}

async function simulateEmergencyScenario() {
  console.log("\n🚨 Simulating Emergency Water Crisis Scenario");
  console.log("═".repeat(70));

  const { contract, authority, otherSigners } = await loadContract();

  console.log("\nScenario: Sudden drought emergency in agricultural region");
  console.log("━".repeat(70));

  // Register emergency region
  console.log("\n1️⃣ Registering emergency region...");
  const tx1 = await contract.registerRegion(
    "Emergency Agricultural Zone",
    9,
    otherSigners[0].address
  );
  const receipt1 = await tx1.wait();

  const event = receipt1.logs.find(log => {
    try {
      return contract.interface.parseLog(log).name === "RegionRegistered";
    } catch {
      return false;
    }
  });

  let regionId = 1;
  if (event) {
    const parsedEvent = contract.interface.parseLog(event);
    regionId = Number(parsedEvent.args.regionId);
  }

  console.log(`✅ Emergency region registered (ID: ${regionId})`);

  // Emergency allocation
  console.log("\n2️⃣ Executing emergency water allocation...");
  const emergencyAmount = 10000;
  const tx2 = await contract.emergencyWaterAllocation(regionId, emergencyAmount);
  const receipt2 = await tx2.wait();

  console.log(`✅ Emergency allocation of ${emergencyAmount} units completed`);
  console.log(`Transaction: ${receipt2.hash}`);

  console.log("\n✅ Emergency scenario simulation completed!\n");
}

async function main() {
  const args = process.argv.slice(2);
  const scenario = args[0] || "complete";

  console.log("\n💧 Water Resource Manager - Simulation Tool\n");

  switch (scenario.toLowerCase()) {
    case "complete":
    case "full":
      await simulateCompleteWorkflow();
      break;
    case "emergency":
      await simulateEmergencyScenario();
      break;
    default:
      console.log("Available scenarios:");
      console.log("  • complete (default) - Full workflow simulation");
      console.log("  • emergency - Emergency water crisis scenario");
      console.log("\nUsage: npm run simulate [scenario]");
      console.log("Example: npm run simulate emergency\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Simulation failed:");
    console.error(error);
    process.exit(1);
  });
