// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract HeliumThree is ERC20, ERC20Burnable, AccessControl {
    event Minted(address indexed _to, uint256 _amount);
    event Burned(address indexed _burner, uint256 _amount);

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address _to, uint256 _amount) external onlyRole(MINTER_ROLE) {
        _mint(_to, _amount);
        emit Minted(_to, _amount);
    }

    function burn(uint256 _amount) public override {
        _burn(_msgSender(), _amount);
        emit Burned(_msgSender(), _amount);
    }
}
