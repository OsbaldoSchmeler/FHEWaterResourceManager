const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("WaterResourceManager - Extended Tests", function () {
  // Deployment fixture
  async function deployContractFixture() {
    const signers = await ethers.getSigners();

    const WaterResourceManager = await ethers.getContractFactory("WaterResourceManager");
    const contract = await WaterResourceManager.deploy();
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    return {
      contract,
      contractAddress,
      authority: signers[0],
      alice: signers[1],
      bob: signers[2],
      carol: signers[3],
      dave: signers[4],
    };
  }

  describe("Multiple Region Management", function () {
    it("Should register multiple regions with different priorities", async function () {
      const { contract, alice, bob, carol } = await loadFixture(deployContractFixture);

      await contract.registerRegion("High Priority Region", 9, alice.address);
      await contract.registerRegion("Medium Priority Region", 5, bob.address);
      await contract.registerRegion("Low Priority Region", 2, carol.address);

      expect(await contract.totalRegions()).to.equal(3);
    });

    it("Should handle concurrent region registrations", async function () {
      const { contract, alice, bob, carol } = await loadFixture(deployContractFixture);

      await Promise.all([
        contract.registerRegion("Region A", 5, alice.address),
        contract.registerRegion("Region B", 6, bob.address),
        contract.registerRegion("Region C", 7, carol.address),
      ]);

      expect(await contract.totalRegions()).to.equal(3);
    });

    it("Should maintain correct region IDs sequence", async function () {
      const { contract, alice, bob } = await loadFixture(deployContractFixture);

      await contract.registerRegion("First Region", 5, alice.address);
      const info1 = await contract.getRegionInfo(1);
      expect(info1.name).to.equal("First Region");

      await contract.registerRegion("Second Region", 6, bob.address);
      const info2 = await contract.getRegionInfo(2);
      expect(info2.name).to.equal("Second Region");
    });

    it("Should allow same manager for different regions", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, alice.address);
      // Note: Current implementation updates regionManagers mapping
      // This test checks the actual behavior
      await contract.registerRegion("Region 2", 6, alice.address);

      expect(await contract.totalRegions()).to.equal(2);
    });
  });

  describe("Allocation Period Lifecycle", function () {
    it("Should track period timestamps correctly", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      const beforeTime = await time.latest();
      await contract.startAllocationPeriod(10000, 24);
      const afterTime = await time.latest();

      const periodInfo = await contract.getCurrentPeriodInfo();
      expect(periodInfo.startTime).to.be.gte(beforeTime);
      expect(periodInfo.startTime).to.be.lte(afterTime);
    });

    it("Should calculate correct end time", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      const duration = 48; // 48 hours
      await contract.startAllocationPeriod(10000, duration);

      const periodInfo = await contract.getCurrentPeriodInfo();
      const expectedEndTime = Number(periodInfo.startTime) + (duration * 3600);

      expect(periodInfo.endTime).to.equal(expectedEndTime);
    });

    it("Should allow starting new period after previous completes", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      // Start first period
      await contract.startAllocationPeriod(10000, 1); // 1 hour

      // Fast forward past the period
      await time.increase(3601); // 1 hour + 1 second

      // Should be able to start new period
      await expect(contract.startAllocationPeriod(5000, 2))
        .to.emit(contract, "AllocationPeriodStarted");
    });

    it("Should prevent starting period with very short duration", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.startAllocationPeriod(10000, 0)
      ).to.be.revertedWith("Duration must be 1-168 hours");
    });

    it("Should prevent starting period with very long duration", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.startAllocationPeriod(10000, 200)
      ).to.be.revertedWith("Duration must be 1-168 hours");
    });
  });

  describe("Water Request Workflow", function () {
    it("Should track participating regions count", async function () {
      const { contract, alice, bob } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.registerRegion("Region B", 6, bob.address);
      await contract.startAllocationPeriod(10000, 24);

      await contract.connect(alice).submitWaterRequest(5000, 75);
      await contract.connect(bob).submitWaterRequest(3000, 80);

      const periodInfo = await contract.getCurrentPeriodInfo();
      expect(periodInfo.participatingRegions).to.equal(2);
    });

    it("Should prevent duplicate requests from same region", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.startAllocationPeriod(10000, 24);

      await contract.connect(alice).submitWaterRequest(5000, 75);

      await expect(
        contract.connect(alice).submitWaterRequest(3000, 80)
      ).to.be.revertedWith("Region already submitted request");
    });

    it("Should accept minimum justification score", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.startAllocationPeriod(10000, 24);

      await expect(
        contract.connect(alice).submitWaterRequest(5000, 1)
      ).to.not.be.reverted;
    });

    it("Should accept maximum justification score", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.startAllocationPeriod(10000, 24);

      await expect(
        contract.connect(alice).submitWaterRequest(5000, 100)
      ).to.not.be.reverted;
    });

    it("Should update region last update time", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      const beforeTime = await time.latest();

      await contract.startAllocationPeriod(10000, 24);
      await contract.connect(alice).submitWaterRequest(5000, 75);

      const regionInfo = await contract.getRegionInfo(1);
      expect(regionInfo.lastUpdateTime).to.be.gte(beforeTime);
    });
  });

  describe("Emergency Allocation", function () {
    it("Should allow multiple emergency allocations", async function () {
      const { contract, alice, bob } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.registerRegion("Region B", 6, bob.address);

      await contract.emergencyWaterAllocation(1, 2000);
      await contract.emergencyWaterAllocation(2, 1500);

      // Both should succeed
      expect(await contract.totalRegions()).to.equal(2);
    });

    it("Should update last update time on emergency allocation", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      const beforeTime = await time.latest();

      await contract.emergencyWaterAllocation(1, 2000);

      const regionInfo = await contract.getRegionInfo(1);
      expect(regionInfo.lastUpdateTime).to.be.gte(beforeTime);
    });

    it("Should accept maximum emergency amount", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);

      const maxUint32 = 2n ** 32n - 1n;
      await expect(
        contract.emergencyWaterAllocation(1, maxUint32)
      ).to.not.be.reverted;
    });

    it("Should reject emergency allocation to deactivated region", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.deactivateRegion(1);

      await expect(
        contract.emergencyWaterAllocation(1, 2000)
      ).to.be.revertedWith("Region not active");
    });
  });

  describe("Region Manager Updates", function () {
    it("Should allow transferring region management", async function () {
      const { contract, alice, bob } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.updateRegionManager(1, bob.address);

      const regionInfo = await contract.getRegionInfo(1);
      expect(regionInfo.manager).to.equal(bob.address);
    });

    it("Should prevent updating to zero address", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);

      await expect(
        contract.updateRegionManager(1, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid manager address");
    });

    it("Should prevent updating non-existent region", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await expect(
        contract.updateRegionManager(999, alice.address)
      ).to.be.revertedWith("Invalid region ID");
    });

    it("Should allow updating manager multiple times", async function () {
      const { contract, alice, bob, carol } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.updateRegionManager(1, bob.address);
      await contract.updateRegionManager(1, carol.address);

      const regionInfo = await contract.getRegionInfo(1);
      expect(regionInfo.manager).to.equal(carol.address);
    });
  });

  describe("Region Deactivation", function () {
    it("Should decrease total regions count on deactivation", async function () {
      const { contract, alice, bob } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.registerRegion("Region B", 6, bob.address);

      expect(await contract.totalRegions()).to.equal(2);

      await contract.deactivateRegion(1);

      expect(await contract.totalRegions()).to.equal(1);
    });

    it("Should mark region as inactive", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.deactivateRegion(1);

      const regionInfo = await contract.getRegionInfo(1);
      expect(regionInfo.isActive).to.be.false;
    });

    it("Should prevent deactivating already inactive region", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.deactivateRegion(1);

      await expect(
        contract.deactivateRegion(1)
      ).to.be.revertedWith("Region not active");
    });

    it("Should prevent deactivating non-existent region", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.deactivateRegion(999)
      ).to.be.revertedWith("Invalid region ID");
    });
  });

  describe("Query Functions", function () {
    it("Should return zero period info when no period started", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      const periodInfo = await contract.getCurrentPeriodInfo();

      expect(periodInfo.periodId).to.equal(0);
      expect(periodInfo.startTime).to.equal(0);
      expect(periodInfo.endTime).to.equal(0);
      expect(periodInfo.distributionCompleted).to.be.false;
      expect(periodInfo.participatingRegions).to.equal(0);
      expect(periodInfo.isActive).to.be.false;
    });

    it("Should return request status for non-participating region", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.startAllocationPeriod(10000, 24);

      const status = await contract.getRegionRequestStatus(1);

      expect(status.hasSubmittedRequest).to.be.false;
      expect(status.isProcessed).to.be.false;
      expect(status.timestamp).to.equal(0);
    });

    it("Should query all region details", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Test Region", 7, alice.address);

      const info = await contract.getRegionInfo(1);

      expect(info.name).to.equal("Test Region");
      expect(info.manager).to.equal(alice.address);
      expect(info.isActive).to.be.true;
      expect(info.lastUpdateTime).to.be.gt(0);
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should use reasonable gas for region registration", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      const tx = await contract.registerRegion("Region A", 5, alice.address);
      const receipt = await tx.wait();

      // Verify gas is under threshold
      expect(receipt.gasUsed).to.be.lt(300000);
    });

    it("Should use reasonable gas for water request", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.startAllocationPeriod(10000, 24);

      const tx = await contract.connect(alice).submitWaterRequest(5000, 75);
      const receipt = await tx.wait();

      expect(receipt.gasUsed).to.be.lt(300000);
    });

    it("Should use reasonable gas for emergency allocation", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);

      const tx = await contract.emergencyWaterAllocation(1, 2000);
      const receipt = await tx.wait();

      expect(receipt.gasUsed).to.be.lt(200000);
    });
  });

  describe("Edge Cases and Boundary Tests", function () {
    it("Should handle region with very long name", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      const longName = "A".repeat(200);
      await expect(
        contract.registerRegion(longName, 5, alice.address)
      ).to.not.be.reverted;
    });

    it("Should handle maximum priority level", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await expect(
        contract.registerRegion("Region A", 10, alice.address)
      ).to.not.be.reverted;
    });

    it("Should handle minimum priority level", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await expect(
        contract.registerRegion("Region A", 1, alice.address)
      ).to.not.be.reverted;
    });

    it("Should handle period with minimum duration", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.startAllocationPeriod(10000, 1)
      ).to.not.be.reverted;
    });

    it("Should handle period with maximum duration", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.startAllocationPeriod(10000, 168)
      ).to.not.be.reverted;
    });

    it("Should handle maximum water amount", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      const maxUint32 = 2n ** 32n - 1n;
      await expect(
        contract.startAllocationPeriod(maxUint32, 24)
      ).to.not.be.reverted;
    });

    it("Should handle minimum water request amount", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.startAllocationPeriod(10000, 24);

      await expect(
        contract.connect(alice).submitWaterRequest(1, 75)
      ).to.not.be.reverted;
    });

    it("Should handle maximum water request amount", async function () {
      const { contract, alice } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region A", 5, alice.address);
      await contract.startAllocationPeriod(10000, 24);

      const maxUint32 = 2n ** 32n - 1n;
      await expect(
        contract.connect(alice).submitWaterRequest(maxUint32, 75)
      ).to.not.be.reverted;
    });
  });
});
