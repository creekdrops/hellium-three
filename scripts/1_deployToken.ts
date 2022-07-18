import { ethers } from "hardhat";
import { config } from "../utils/config";

async function main() {
  const Contract = await ethers.getContractFactory(config.erc20.contract);
  const contract = await Contract.deploy(...config.erc20.args);

  await contract.deployed();

  console.log(
    `${config.erc20.contract} successfully deployed to:`,
    contract.address
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
