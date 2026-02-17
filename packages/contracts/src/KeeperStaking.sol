// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract KeeperStaking {
    uint256 public constant MIN_STAKE = 0.1 ether;
    uint256 public constant UNSTAKE_DELAY = 7 days;

    struct KeeperInfo {
        uint256 stakedAmount;
        uint256 unstakeRequestedAt;
        uint256 rewards;
        bool isActive;
    }

    mapping(address => KeeperInfo) public keepers;
    address public governance;

    event Staked(address indexed keeper, uint256 amount);
    event UnstakeRequested(address indexed keeper, uint256 availableAt);
    event Unstaked(address indexed keeper, uint256 amount);
    event Slashed(address indexed keeper, uint256 amount, string reason);
    event RewardsClaimed(address indexed keeper, uint256 amount);
    event RewardsDistributed(address indexed keeper, uint256 amount);

    modifier onlyGovernance() {
        require(msg.sender == governance, "Not governance");
        _;
    }

    modifier onlyActiveKeeper() {
        require(keepers[msg.sender].isActive, "Not an active keeper");
        _;
    }

    constructor() {
        governance = msg.sender;
    }

    function stake() external payable {
        require(msg.value >= MIN_STAKE, "Below minimum stake");

        KeeperInfo storage k = keepers[msg.sender];
        k.stakedAmount += msg.value;
        k.isActive = true;
        k.unstakeRequestedAt = 0;

        emit Staked(msg.sender, msg.value);
    }

    function requestUnstake() external onlyActiveKeeper {
        KeeperInfo storage k = keepers[msg.sender];
        require(k.unstakeRequestedAt == 0, "Unstake already requested");

        k.unstakeRequestedAt = block.timestamp;

        emit UnstakeRequested(msg.sender, block.timestamp + UNSTAKE_DELAY);
    }

    function unstake() external {
        KeeperInfo storage k = keepers[msg.sender];
        require(k.unstakeRequestedAt > 0, "No unstake requested");
        require(
            block.timestamp >= k.unstakeRequestedAt + UNSTAKE_DELAY,
            "Unstake delay not elapsed"
        );

        uint256 amount = k.stakedAmount;
        k.stakedAmount = 0;
        k.isActive = false;
        k.unstakeRequestedAt = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit Unstaked(msg.sender, amount);
    }

    function slash(address keeper, uint256 percentage, string calldata reason) external onlyGovernance {
        require(percentage <= 100, "Invalid percentage");
        KeeperInfo storage k = keepers[keeper];
        require(k.stakedAmount > 0, "Nothing to slash");

        uint256 slashAmount = (k.stakedAmount * percentage) / 100;
        k.stakedAmount -= slashAmount;

        if (k.stakedAmount < MIN_STAKE) {
            k.isActive = false;
        }

        emit Slashed(keeper, slashAmount, reason);
    }

    function claimRewards() external {
        KeeperInfo storage k = keepers[msg.sender];
        uint256 amount = k.rewards;
        require(amount > 0, "No rewards");

        k.rewards = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit RewardsClaimed(msg.sender, amount);
    }

    function distributeRewards(address keeper, uint256 amount) external onlyGovernance {
        require(keepers[keeper].isActive, "Keeper not active");
        keepers[keeper].rewards += amount;

        emit RewardsDistributed(keeper, amount);
    }

    function getKeeperInfo(address keeper) external view returns (KeeperInfo memory) {
        return keepers[keeper];
    }

    receive() external payable {}
}
