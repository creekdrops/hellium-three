// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Helium Three Staking Contract
 * @author CREEK
 * @notice Staking contract for NFT assets created by CREEK used to mint
 * the IHeliumThree ($HE3) Community Token.
 */

interface IHeliumThree is IERC20 {
    function mint(address _to, uint256 _amount) external;
}

contract HeliumThreeStaking is ReentrancyGuard, AccessControl {
    IHeliumThree public immutable rewardsToken;

    struct StakedToken {
        address staker;
        uint256 tokenId;
    }
    /**
     * @dev Each staking struct created consists of mappings for each staked token
     * which used the contract as the key. The parameters consist of:
     * The amount of tokens staked by the staker per contract.
     * Which tokens the staker has staked per contract
     * Last time of the rewards were calculated for this user
     * Calculated, but unclaimed rewards for the Staker.
     * @notice The rewards are calculated each time the user writes to the Smart Contract
     */
    struct Staker {
        mapping(IERC721 => uint256) amountStaked;
        mapping(IERC721 => StakedToken[]) stakedTokens;
        mapping(IERC721 => uint256) timeOfLastUpdate;
        mapping(IERC721 => uint256) unclaimedRewards;
    }

    ///  @dev An array of contracts to loop over for rewards calculations
    IERC721[] public rewardContracts;

    /// @dev Rewards per hour per token deposited in wei per contract.
    mapping(address => uint256) public rewardsPerDay;

    /// @dev Mapping of User Address to Staker info
    mapping(address => Staker) private stakers;

    /**
     * @dev Mapping of hashed Contract address and Token Id to staker.
     * Made for the SC to remeber who to send back the ERC721 Token to.
     */
    mapping(bytes32 => address) private stakerAddress;

    /**
     * @dev Mapping of contract addresses to determine if contract is
     * permitted to stake and receive rewards.
     */
    mapping(IERC721 => bool) private stakingPermitted;

    event AssetStaked(
        address indexed _account,
        IERC721 _contractAddress,
        uint256 _tokenId
    );

    constructor(IHeliumThree _rewardTokenContract) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        rewardsToken = _rewardTokenContract;
    }

    /// Stakes token to contract based on the contract address
    function stake(IERC721 _contractAddress, uint256 _tokenId)
        external
        nonReentrant
    {
        ///  Confirm that the asset is allowed to be staked.
        require(
            stakingPermitted[_contractAddress],
            "Staking not permited for asset."
        );

        // If wallet has tokens staked, calculate the rewards before adding the new token
        if (stakers[msg.sender].amountStaked[_contractAddress] > 0) {
            uint256 rewards = calculateRewardsPerContract(
                _contractAddress,
                msg.sender
            );
            stakers[msg.sender].unclaimedRewards[_contractAddress] += rewards;
        }

        IERC721 nftCollection = _contractAddress;

        // Wallet must own the token they are trying to stake
        require(
            nftCollection.ownerOf(_tokenId) == msg.sender,
            "You don't own this token!"
        );

        // Transfer the token from the wallet to the Smart contract
        nftCollection.transferFrom(msg.sender, address(this), _tokenId);

        // Create StakedToken
        StakedToken memory stakedToken = StakedToken(msg.sender, _tokenId);

        // Add staked token to mapping
        stakers[msg.sender].stakedTokens[_contractAddress].push(stakedToken);

        // Increment the amount staked for this wallet
        stakers[msg.sender].amountStaked[_contractAddress]++;

        // Update the mapping of the tokenId to the staker's address
        stakerAddress[getStakeKey(_contractAddress, _tokenId)] = msg.sender;

        // Update the timeOfLastUpdate for the staker
        stakers[msg.sender].timeOfLastUpdate[_contractAddress] = block
            .timestamp;

        emit AssetStaked(msg.sender, _contractAddress, _tokenId);
    }

    /**
     * @dev We check if user has any ERC721 Tokens Staked and if they tried to withdraw,
     * then we calculate the rewards and store them in the unclaimedRewards, lastly we
     * decrement the amountStaked of the user and transfer the ERC721 token back to them
     */

    function withdraw(IERC721 _contractAddress, uint256 _tokenId)
        external
        nonReentrant
    {
        IERC721 nftCollection = _contractAddress;

        /// Make sure the user has at least one token staked before withdrawing
        require(
            stakers[msg.sender].amountStaked[_contractAddress] > 0,
            "You have no tokens staked"
        );

        /// Wallet must own the token they are trying to withdraw
        require(
            stakerAddress[getStakeKey(_contractAddress, _tokenId)] ==
                msg.sender,
            "You don't own this token!"
        );

        /// Update the rewards for this user, as the amount of rewards decreases with less tokens.
        uint256 rewards = calculateRewards(msg.sender);
        stakers[msg.sender].unclaimedRewards[_contractAddress] += rewards;

        /// Find the index of this token id in the stakedTokens array
        uint256 index = 0;
        for (
            uint256 i = 0;
            i < stakers[msg.sender].stakedTokens[_contractAddress].length;
            i++
        ) {
            if (
                stakers[msg.sender].stakedTokens[_contractAddress][i].tokenId ==
                _tokenId
            ) {
                index = i;
                break;
            }
        }

        /// Set this token's .staker to be address 0 to mark it as no longer staked
        stakers[msg.sender]
        .stakedTokens[_contractAddress][index].staker = address(0);

        /// Decrement the amount staked for this wallet
        stakers[msg.sender].amountStaked[_contractAddress]--;

        /// Update the mapping of the tokenId to the be address(0) to indicate that the token is no longer staked
        stakerAddress[getStakeKey(_contractAddress, _tokenId)] = address(0);

        /// Transfer the token back to the withdrawer
        nftCollection.transferFrom(address(this), msg.sender, _tokenId);

        /// Update the timeOfLastUpdate for the withdrawer
        stakers[msg.sender].timeOfLastUpdate[_contractAddress] = block
            .timestamp;
    }

    /// @dev Utility function to return the hash key of the contract address
    /// and token id used to map which user owns a specific asset.
    function getStakeKey(IERC721 _contractAddress, uint256 _tokenId)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_contractAddress, _tokenId));
    }

    /// @notice Returns the stakers address based on the provided contract and token id.
    function getOwnerOfStakedTokenId(IERC721 _contractAddress, uint256 _tokenId)
        public
        view
        returns (address)
    {
        return stakerAddress[getStakeKey(_contractAddress, _tokenId)];
    }

    /// @notice Allows admin to set a contract and daily reward for staking.
    function permitStaking(IERC721 _contractAddress, uint256 _reward)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        stakingPermitted[_contractAddress] = true;
        rewardContracts.push(_contractAddress);
        setRewardForContract(_contractAddress, _reward);
    }

    /**
     * @notice Allows admin revoke staking of specific contract and sets the
     * daily reward amount for specified contract to zero.
     */
    function revokeStaking(IERC721 _contractAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        stakingPermitted[_contractAddress] = false;
        setRewardForContract(_contractAddress, 0);
    }

    /// @notice Allows admin adjust the daily reward of a specific contract.
    function setRewardForContract(IERC721 _contractAddress, uint256 _reward)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        IERC721 nftCollection = _contractAddress;
        rewardsPerDay[address(nftCollection)] = 1 ether * _reward;
    }

    /**
     * @notice Allows users to claim all accumulated rewards based on their stake.
     * @dev Calculate rewards for the msg.sender, check if there are any rewards
     * claim, reset all rewards back to 0 and transfer the ERC20 Reward token
     * to the user.
     */
    function claimRewards() public {
        uint256 rewards = calculateRewards(msg.sender);
        require(rewards > 0, "You have no rewards to claim");
        resetRewards(msg.sender);
        rewardsToken.mint(msg.sender, rewards);
    }

    /**
     * @dev Calculate rewards per contract for param _staker by calculating the time
     * passed since last update in hours and mulitplying it to ERC721 Tokens Staked
     * and rewardsPerDay.
     */
    function calculateRewardsPerContract(
        IERC721 _contractAddress,
        address _staker
    ) internal view returns (uint256 _rewards) {
        return (((
            ((block.timestamp -
                stakers[_staker].timeOfLastUpdate[_contractAddress]) *
                stakers[_staker].amountStaked[_contractAddress])
        ) * rewardsPerDay[address(_contractAddress)]) / (86400));
    }

    /**
     * @dev Calculate total rewards for param _staker.
     */
    function calculateRewards(address _staker) public view returns (uint256) {
        uint256 totalReward = 0;
        for (uint256 i = 0; i < rewardContracts.length; i++) {
            totalReward =
                totalReward +
                calculateRewardsPerContract(rewardContracts[i], _staker);
        }
        return totalReward;
    }

    /**
     * @dev Utility function to reset the rewards of param _staker once they
     * have claimed their rewards.
     */
    function resetRewards(address _staker) internal {
        for (uint256 i = 0; i < rewardContracts.length; i++) {
            stakers[_staker].timeOfLastUpdate[rewardContracts[i]] = block
                .timestamp;
            stakers[_staker].unclaimedRewards[rewardContracts[i]] = 0;
        }
    }
}
