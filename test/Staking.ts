import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import {
  HeliumThree,
  HeliumThreeStaking,
  NonStakeable,
  Stakeable,
  StakeableTwo
} from "../typechain-types";
import { config } from "../utils/config";

chai.use(chaiAsPromised);

describe("Staking", function () {
  let admin!: SignerWithAddress;
  let signerWithApprovalForAll!: SignerWithAddress;
  let signerWithoutApprovalForAll!: SignerWithAddress;
  let nonStaker!: SignerWithAddress;
  let stakeable!: Stakeable;
  let stakeableTwo!: StakeableTwo;
  let nonStakeable!: NonStakeable;
  let heliumThree!: HeliumThree;
  let heliumThreeStaking!: HeliumThreeStaking;
  let minterRole!: string;
  let adminRole!: string;

  before(async () => {
    [admin, signerWithApprovalForAll, signerWithoutApprovalForAll, nonStaker] =
      await ethers.getSigners();
  });

  describe("Deployment", function () {
    it("Should deploy the ERC20 contract", async () => {
      const Contract = await ethers.getContractFactory(config.erc20.contract);
      heliumThree = (await Contract.deploy(
        ...config.erc20.args
      )) as HeliumThree;
      await heliumThree.deployed();
      adminRole = await heliumThree.DEFAULT_ADMIN_ROLE();
      minterRole = await heliumThree.MINTER_ROLE();
    });

    it("Should deploy the Staking contract", async () => {
      const Contract = await ethers.getContractFactory(config.staking.contract);
      heliumThreeStaking = (await Contract.deploy(
        heliumThree.address
      )) as HeliumThreeStaking;
      await heliumThreeStaking.deployed();
    });

    it("Should deploy the Nft contracts", async () => {
      const Stakeable = await ethers.getContractFactory("Stakeable");
      const StakeableTwo = await ethers.getContractFactory("StakeableTwo");
      const NonStakeable = await ethers.getContractFactory("NonStakeable");
      stakeable = await Stakeable.deploy();
      stakeableTwo = await StakeableTwo.deploy();
      nonStakeable = await NonStakeable.deploy();
    });

    it("Should set the right admin for token contract", async function () {
      expect(await heliumThree.hasRole(adminRole, admin.address)).to.equal(
        true
      );
    });

    it("Should set the right admin for staking contract", async function () {
      expect(
        await heliumThreeStaking.hasRole(adminRole, admin.address)
      ).to.equal(true);
    });

    it("Should set the right token name and symbol", async function () {
      const [name, symbol] = config.erc20.args
      expect(await heliumThree.name()).to.equal(name);
      expect(await heliumThree.symbol()).to.equal(symbol);
    });

    /// BEGIN: NFT CONTRACTS
    /// These contracts are purely designed for testing the staking contract
    it("Should mint the test NFTs for each user", async () => {
      for (const signer of [
        signerWithApprovalForAll,
        signerWithoutApprovalForAll,
        nonStaker,
      ]) {
        await stakeable.connect(signer).safeMint(10);
        await stakeableTwo.connect(signer).safeMint(10);
        await nonStakeable.connect(signer).safeMint(10);
      }
    });

    it("Should let users set ApprovalForAll", async () => {
      await stakeable
        .connect(signerWithApprovalForAll)
        .setApprovalForAll(heliumThreeStaking.address, true);
      await stakeableTwo
        .connect(signerWithApprovalForAll)
        .setApprovalForAll(heliumThreeStaking.address, true);
    });
    /// END: NFT CONTRACT
  });

  describe("He3 Minting", function () {
    it("Should fail if unauthorized user tries minting He3", async () => {
      await expect(
        heliumThree
          .connect(signerWithApprovalForAll)
          .mint(signerWithApprovalForAll.address, 1000)
      ).to.be.revertedWith(
        `AccessControl: account ${signerWithApprovalForAll.address.toLocaleLowerCase()} is missing role ${minterRole}`
      );
      await heliumThree.connect(admin).mint(admin.address, 10000);
    });

    it("Should allow admin to grant MINTER_ROLE to address", async () => {
      await heliumThree
        .connect(admin)
        .grantRole(minterRole, heliumThreeStaking.address);
    });
  });

  describe("Staking", function () {
    it("Should allow admin to permit staking for assets", () => {
      heliumThreeStaking.connect(admin).permitStaking(stakeable.address, 10);
      heliumThreeStaking
        .connect(admin)
        .permitStaking(stakeableTwo.address, 10);
    });
    it("Should fail if user tries staking unauthorized NFT", async () => {
      await heliumThreeStaking.revokeStaking(nonStakeable.address);

      await expect(
        heliumThreeStaking
          .connect(signerWithApprovalForAll)
          .stake(nonStakeable.address, 0)
      ).to.be.revertedWith(`Staking not permited for asset.`);
    });
    it("Should fail if user tries staking NFT they don't own", async () => {
      await expect(
        heliumThreeStaking
          .connect(signerWithApprovalForAll)
          .stake(stakeable.address, 10)
      ).to.be.revertedWith(`You don't own this token!`);
    });
    it("Should allow staker to stake multiple NFTs", async () => {
      await heliumThreeStaking
        .connect(signerWithApprovalForAll)
        .stake(stakeable.address, 0);
      await heliumThreeStaking
        .connect(signerWithApprovalForAll)
        .stake(stakeable.address, 1);
      await heliumThreeStaking
        .connect(signerWithApprovalForAll)
        .stake(stakeableTwo.address, 0);
      await heliumThreeStaking
        .connect(signerWithApprovalForAll)
        .stake(stakeableTwo.address, 1);

      await stakeable
        .connect(signerWithoutApprovalForAll)
        .setApprovalForAll(heliumThreeStaking.address, true);

      await heliumThreeStaking
        .connect(signerWithoutApprovalForAll)
        .stake(stakeable.address, 10);

      expect(
        await heliumThreeStaking.getOwnerOfStakedTokenId(stakeable.address, 0)
      ).to.eq(signerWithApprovalForAll.address);
      expect(
        await heliumThreeStaking.getOwnerOfStakedTokenId(stakeable.address, 1)
      ).to.eq(signerWithApprovalForAll.address);
      expect(
        await heliumThreeStaking.getOwnerOfStakedTokenId(
          stakeableTwo.address,
          0
        )
      ).to.eq(signerWithApprovalForAll.address);
      expect(
        await heliumThreeStaking.getOwnerOfStakedTokenId(
          stakeableTwo.address,
          1
        )
      ).to.eq(signerWithApprovalForAll.address);
    });
    it("Should allow stakers to unstake NFTs", async () => {
      await heliumThreeStaking
        .connect(signerWithApprovalForAll)
        .withdraw(stakeable.address, 0);
    });

    it("Should fail to withdraw if no NFTs are staked", async () => {
      await expect(
        heliumThreeStaking.connect(nonStaker).withdraw(stakeable.address, 0)
      ).to.be.revertedWith("You have no tokens staked");
    });
    it("Should fail if user tries to unstake NFT they do not own", async () => {
      await expect(
        heliumThreeStaking
          .connect(signerWithoutApprovalForAll)
          .withdraw(stakeable.address, 1)
      ).to.be.revertedWith("You don't own this token!");
    });
    it("Should increase contract rewards based on time held", async () => {
      await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      expect(
        parseInt(
          ethers.utils.formatEther(
            await heliumThreeStaking
              .connect(signerWithApprovalForAll)
              .calculateRewards(signerWithApprovalForAll.address)
          )
        )
      ).to.be.greaterThanOrEqual(30);
    });
    it("Should allow users to claim rewards", async () => {
      await heliumThreeStaking
        .connect(signerWithApprovalForAll)
        .claimRewards();
    });
    it("Should fail if non-staker tries to claim", async () => {
      await expect(
        heliumThreeStaking.connect(nonStaker).claimRewards()
      ).to.be.revertedWith("You have no rewards to claim");
    });
  });
});
