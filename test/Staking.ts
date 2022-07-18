import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import {
  HelliumThree,
  HelliumThreeStaking,
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
  let helliumThree!: HelliumThree;
  let helliumThreeStaking!: HelliumThreeStaking;
  let minterRole!: string;
  let adminRole!: string;

  before(async () => {
    [admin, signerWithApprovalForAll, signerWithoutApprovalForAll, nonStaker] =
      await ethers.getSigners();
  });

  describe("Deployment", function () {
    it("Should deploy the ERC20 contract", async () => {
      const Contract = await ethers.getContractFactory(config.erc20.contract);
      helliumThree = (await Contract.deploy(
        ...config.erc20.args
      )) as HelliumThree;
      await helliumThree.deployed();
      adminRole = await helliumThree.DEFAULT_ADMIN_ROLE();
      minterRole = await helliumThree.MINTER_ROLE();
    });

    it("Should deploy the Staking contract", async () => {
      const Contract = await ethers.getContractFactory(config.staking.contract);
      helliumThreeStaking = (await Contract.deploy(
        helliumThree.address
      )) as HelliumThreeStaking;
      await helliumThreeStaking.deployed();
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
      expect(await helliumThree.hasRole(adminRole, admin.address)).to.equal(
        true
      );
    });

    it("Should set the right admin for staking contract", async function () {
      expect(
        await helliumThreeStaking.hasRole(adminRole, admin.address)
      ).to.equal(true);
    });

    it("Should set the right token name and symbol", async function () {
      const [name, symbol] = config.erc20.args
      expect(await helliumThree.name()).to.equal(name);
      expect(await helliumThree.symbol()).to.equal(symbol);
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
        .setApprovalForAll(helliumThreeStaking.address, true);
      await stakeableTwo
        .connect(signerWithApprovalForAll)
        .setApprovalForAll(helliumThreeStaking.address, true);
    });
    /// END: NFT CONTRACT
  });

  describe("He3 Minting", function () {
    it("Should fail if unauthorized user tries minting He3", async () => {
      await expect(
        helliumThree
          .connect(signerWithApprovalForAll)
          .mint(signerWithApprovalForAll.address, 1000)
      ).to.be.revertedWith(
        `AccessControl: account ${signerWithApprovalForAll.address.toLocaleLowerCase()} is missing role ${minterRole}`
      );
      await helliumThree.connect(admin).mint(admin.address, 10000);
    });

    it("Should allow admin to grant MINTER_ROLE to address", async () => {
      await helliumThree
        .connect(admin)
        .grantRole(minterRole, helliumThreeStaking.address);
    });
  });

  describe("Staking", function () {
    it("Should allow admin to permit staking for assets", () => {
      helliumThreeStaking.connect(admin).permitStaking(stakeable.address, 10);
      helliumThreeStaking
        .connect(admin)
        .permitStaking(stakeableTwo.address, 10);
    });
    it("Should fail if user tries staking unauthorized NFT", async () => {
      await helliumThreeStaking.revokeStaking(nonStakeable.address);

      await expect(
        helliumThreeStaking
          .connect(signerWithApprovalForAll)
          .stake(nonStakeable.address, 0)
      ).to.be.revertedWith(`Staking not permited for asset.`);
    });
    it("Should fail if user tries staking NFT they don't own", async () => {
      await expect(
        helliumThreeStaking
          .connect(signerWithApprovalForAll)
          .stake(stakeable.address, 10)
      ).to.be.revertedWith(`You don't own this token!`);
    });
    it("Should allow staker to stake multiple NFTs", async () => {
      await helliumThreeStaking
        .connect(signerWithApprovalForAll)
        .stake(stakeable.address, 0);
      await helliumThreeStaking
        .connect(signerWithApprovalForAll)
        .stake(stakeable.address, 1);
      await helliumThreeStaking
        .connect(signerWithApprovalForAll)
        .stake(stakeableTwo.address, 0);
      await helliumThreeStaking
        .connect(signerWithApprovalForAll)
        .stake(stakeableTwo.address, 1);

      await stakeable
        .connect(signerWithoutApprovalForAll)
        .setApprovalForAll(helliumThreeStaking.address, true);

      await helliumThreeStaking
        .connect(signerWithoutApprovalForAll)
        .stake(stakeable.address, 10);

      expect(
        await helliumThreeStaking.getOwnerOfStakedTokenId(stakeable.address, 0)
      ).to.eq(signerWithApprovalForAll.address);
      expect(
        await helliumThreeStaking.getOwnerOfStakedTokenId(stakeable.address, 1)
      ).to.eq(signerWithApprovalForAll.address);
      expect(
        await helliumThreeStaking.getOwnerOfStakedTokenId(
          stakeableTwo.address,
          0
        )
      ).to.eq(signerWithApprovalForAll.address);
      expect(
        await helliumThreeStaking.getOwnerOfStakedTokenId(
          stakeableTwo.address,
          1
        )
      ).to.eq(signerWithApprovalForAll.address);
    });
    it("Should allow stakers to unstake NFTs", async () => {
      await helliumThreeStaking
        .connect(signerWithApprovalForAll)
        .withdraw(stakeable.address, 0);
    });

    it("Should fail to withdraw if no NFTs are staked", async () => {
      await expect(
        helliumThreeStaking.connect(nonStaker).withdraw(stakeable.address, 0)
      ).to.be.revertedWith("You have no tokens staked");
    });
    it("Should fail if user tries to unstake NFT they do not own", async () => {
      await expect(
        helliumThreeStaking
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
            await helliumThreeStaking
              .connect(signerWithApprovalForAll)
              .calculateRewards(signerWithApprovalForAll.address)
          )
        )
      ).to.be.greaterThanOrEqual(30);
    });
    it("Should allow users to claim rewards", async () => {
      await helliumThreeStaking
        .connect(signerWithApprovalForAll)
        .claimRewards();
    });
    it("Should fail if non-staker tries to claim", async () => {
      await expect(
        helliumThreeStaking.connect(nonStaker).claimRewards()
      ).to.be.revertedWith("You have no rewards to claim");
    });
  });
});
