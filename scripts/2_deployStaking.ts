import { ethers } from "hardhat";
import { config } from "../utils/config";

async function main() {
  const Contract = await ethers.getContractFactory(config.staking.contract);
  const contract = await Contract.deploy(...config.staking.args);

  await contract.deployed();

  console.log(`${config.staking.contract} successfully deployed to:`, contract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
