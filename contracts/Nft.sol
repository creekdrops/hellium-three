// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @dev These contracts are simply here for testing the HelliumThreeStaking
 * contract and are not intended to be deployed.
 */

contract Stakeable is ERC721A, Ownable {
    constructor() ERC721A("Stakeable", "NFT1") {}

    function safeMint(uint256 qty) public {
        _safeMint(msg.sender, qty);
    }
}

contract StakeableTwo is ERC721A, Ownable {
    constructor() ERC721A("Stakeable Two", "NFT2") {}

    function safeMint(uint256 qty) public {
        _safeMint(msg.sender, qty);
    }
}

contract NonStakeable is ERC721A, Ownable {
    constructor() ERC721A("Non Stakeable", "NFT3") {}

    function safeMint(uint256 qty) public {
        _safeMint(msg.sender, qty);
    }
}
