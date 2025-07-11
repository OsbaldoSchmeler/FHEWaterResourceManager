const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("WaterResourceManager", function () {
  // Fixture for deploying the contract
  async function deployContractFixture() {
    const [authority, manager1, manager2, manager3, user] = await ethers.getSigners();

    const WaterResourceManager = await ethers.getContractFactory("WaterResourceManager");
    const contract = await WaterResourceManager.deploy();
    await contract.waitForDeployment();

    return { contract, authority, manager1, manager2, manager3, user };
  }

  describe("Deployment", function () {
    it("Should set the correct authority", async function () {
      const { contract, authority } = await loadFixture(deployContractFixture);
      expect(await contract.authority()).to.equal(authority.address);
    });

    it("Should initialize with period 0", async function () {
      const { contract } = await loadFixture(deployContractFixture);
      expect(await contract.currentAllocationPeriod()).to.equal(0);
    });

    it("Should initialize with no active allocation period", async function () {
      const { contract } = await loadFixture(deployContractFixture);
      expect(await contract.isAllocationPeriodActive()).to.be.false;
    });

    it("Should initialize total regions as 0", async function () {
      const { contract } = await loadFixture(deployContractFixture);
      expect(await contract.totalRegions()).to.equal(0);
    });
  });

  describe("Region Registration", function () {
    it("Should register a region successfully", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await expect(contract.registerRegion("Metropolitan Area", 8, manager1.address))
        .to.emit(contract, "RegionRegistered")
        .withArgs(1, "Metropolitan Area", manager1.address);
    });

    it("Should increment total regions after registration", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);
      expect(await contract.totalRegions()).to.equal(1);
    });

    it("Should assign correct manager to region", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);
      const regionInfo = await contract.getRegionInfo(1);
      expect(regionInfo.manager).to.equal(manager1.address);
    });

    it("Should fail if non-authority tries to register", async function () {
      const { contract, manager1, user } = await loadFixture(deployContractFixture);

      await expect(
        contract.connect(user).registerRegion("Region", 5, manager1.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should fail with invalid priority (0)", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await expect(
        contract.registerRegion("Region", 0, manager1.address)
      ).to.be.revertedWith("Priority must be 1-10");
    });

    it("Should fail with invalid priority (>10)", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await expect(
        contract.registerRegion("Region", 11, manager1.address)
      ).to.be.revertedWith("Priority must be 1-10");
    });

    it("Should fail with empty region name", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await expect(
        contract.registerRegion("", 5, manager1.address)
      ).to.be.revertedWith("Invalid region name");
    });

    it("Should fail with zero address manager", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.registerRegion("Region", 5, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid manager address");
    });
  });

  describe("Allocation Period", function () {
    it("Should start allocation period successfully", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(contract.startAllocationPeriod(10000, 24))
        .to.emit(contract, "AllocationPeriodStarted")
        .withArgs(1, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should set period to active after start", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await contract.startAllocationPeriod(10000, 24);
      expect(await contract.isAllocationPeriodActive()).to.be.true;
    });

    it("Should fail if non-authority tries to start period", async function () {
      const { contract, user } = await loadFixture(deployContractFixture);

      await expect(
        contract.connect(user).startAllocationPeriod(10000, 24)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should fail if period already active", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await contract.startAllocationPeriod(10000, 24);
      await expect(
        contract.startAllocationPeriod(5000, 12)
      ).to.be.revertedWith("Allocation period already active");
    });

    it("Should fail with zero water amount", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.startAllocationPeriod(0, 24)
      ).to.be.revertedWith("Invalid water amount");
    });

    it("Should fail with zero duration", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.startAllocationPeriod(10000, 0)
      ).to.be.revertedWith("Duration must be 1-168 hours");
    });

    it("Should fail with duration >168 hours", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.startAllocationPeriod(10000, 169)
      ).to.be.revertedWith("Duration must be 1-168 hours");
    });
  });

  describe("Water Requests", function () {
    it("Should submit water request successfully", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      // Register region and start period
      await contract.registerRegion("Region 1", 5, manager1.address);
      await contract.startAllocationPeriod(10000, 24);

      await expect(contract.connect(manager1).submitWaterRequest(5000, 75))
        .to.emit(contract, "WaterRequested")
        .withArgs(1, 1, manager1.address);
    });

    it("Should fail if not region manager", async function () {
      const { contract, user } = await loadFixture(deployContractFixture);

      await contract.startAllocationPeriod(10000, 24);

      await expect(
        contract.connect(user).submitWaterRequest(5000, 75)
      ).to.be.revertedWith("Not a registered region manager");
    });

    it("Should fail if no active allocation period", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);

      await expect(
        contract.connect(manager1).submitWaterRequest(5000, 75)
      ).to.be.revertedWith("Not during allocation period");
    });

    it("Should fail with zero requested amount", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);
      await contract.startAllocationPeriod(10000, 24);

      await expect(
        contract.connect(manager1).submitWaterRequest(0, 75)
      ).to.be.revertedWith("Invalid requested amount");
    });

    it("Should fail with invalid justification score (0)", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);
      await contract.startAllocationPeriod(10000, 24);

      await expect(
        contract.connect(manager1).submitWaterRequest(5000, 0)
      ).to.be.revertedWith("Justification score must be 1-100");
    });

    it("Should fail with invalid justification score (>100)", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);
      await contract.startAllocationPeriod(10000, 24);

      await expect(
        contract.connect(manager1).submitWaterRequest(5000, 101)
      ).to.be.revertedWith("Justification score must be 1-100");
    });
  });

  describe("Region Information", function () {
    it("Should return correct region info", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Test Region", 7, manager1.address);
      const info = await contract.getRegionInfo(1);

      expect(info.name).to.equal("Test Region");
      expect(info.manager).to.equal(manager1.address);
      expect(info.isActive).to.be.true;
    });

    it("Should return current period info", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await contract.startAllocationPeriod(10000, 24);
      const info = await contract.getCurrentPeriodInfo();

      expect(info.periodId).to.equal(1);
      expect(info.isActive).to.be.true;
      expect(info.distributionCompleted).to.be.false;
    });

    it("Should return request status", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);
      await contract.startAllocationPeriod(10000, 24);
      await contract.connect(manager1).submitWaterRequest(5000, 75);

      const status = await contract.getRegionRequestStatus(1);
      expect(status.hasSubmittedRequest).to.be.true;
      expect(status.isProcessed).to.be.false;
    });
  });

  describe("Emergency Allocation", function () {
    it("Should perform emergency allocation", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);

      await expect(contract.emergencyWaterAllocation(1, 2000))
        .to.emit(contract, "EmergencyAllocation")
        .withArgs(1, 2000);
    });

    it("Should fail if non-authority calls emergency allocation", async function () {
      const { contract, manager1, user } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);

      await expect(
        contract.connect(user).emergencyWaterAllocation(1, 2000)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should fail with invalid region", async function () {
      const { contract } = await loadFixture(deployContractFixture);

      await expect(
        contract.emergencyWaterAllocation(999, 2000)
      ).to.be.revertedWith("Invalid region ID");
    });

    it("Should fail with zero amount", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);

      await expect(
        contract.emergencyWaterAllocation(1, 0)
      ).to.be.revertedWith("Invalid emergency amount");
    });
  });

  describe("Administrative Functions", function () {
    it("Should update region manager", async function () {
      const { contract, manager1, manager2 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);
      await contract.updateRegionManager(1, manager2.address);

      const info = await contract.getRegionInfo(1);
      expect(info.manager).to.equal(manager2.address);
    });

    it("Should deactivate region", async function () {
      const { contract, manager1 } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);
      await contract.deactivateRegion(1);

      const info = await contract.getRegionInfo(1);
      expect(info.isActive).to.be.false;
    });

    it("Should fail to update manager if non-authority", async function () {
      const { contract, manager1, manager2, user } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);

      await expect(
        contract.connect(user).updateRegionManager(1, manager2.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should fail to deactivate if non-authority", async function () {
      const { contract, manager1, user } = await loadFixture(deployContractFixture);

      await contract.registerRegion("Region 1", 5, manager1.address);

      await expect(
        contract.connect(user).deactivateRegion(1)
      ).to.be.revertedWith("Not authorized");
    });
  });
});
