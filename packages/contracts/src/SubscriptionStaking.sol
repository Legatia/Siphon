// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SubscriptionStaking {
    enum Tier { None, Keeper, KeeperPlus, KeeperPro }

    struct StakeInfo {
        uint256 amount;
        Tier tier;
        uint256 stakedAt;
    }

    uint256 public constant KEEPER_THRESHOLD = 100e6;      // 100 USDC (6 decimals)
    uint256 public constant KEEPER_PLUS_THRESHOLD = 500e6;  // 500 USDC
    uint256 public constant KEEPER_PRO_THRESHOLD = 2000e6;  // 2000 USDC

    IERC20 public immutable usdc;
    mapping(address => StakeInfo) public stakes;

    event Staked(address indexed user, uint256 amount, Tier tier);
    event Unstaked(address indexed user, uint256 amount);

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");

        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        require(success, "USDC transfer failed");

        stakes[msg.sender].amount += amount;
        if (stakes[msg.sender].stakedAt == 0) {
            stakes[msg.sender].stakedAt = block.timestamp;
        }

        Tier newTier = _determineTier(stakes[msg.sender].amount);
        stakes[msg.sender].tier = newTier;

        emit Staked(msg.sender, amount, newTier);
    }

    function unstake() external {
        StakeInfo storage info = stakes[msg.sender];
        require(info.amount > 0, "Nothing staked");

        uint256 amount = info.amount;
        info.amount = 0;
        info.tier = Tier.None;
        info.stakedAt = 0;

        bool success = usdc.transfer(msg.sender, amount);
        require(success, "USDC transfer failed");

        emit Unstaked(msg.sender, amount);
    }

    function getTier(address user) external view returns (Tier) {
        return stakes[user].tier;
    }

    function getStake(address user) external view returns (StakeInfo memory) {
        return stakes[user];
    }

    function _determineTier(uint256 amount) internal pure returns (Tier) {
        if (amount >= KEEPER_PRO_THRESHOLD) return Tier.KeeperPro;
        if (amount >= KEEPER_PLUS_THRESHOLD) return Tier.KeeperPlus;
        if (amount >= KEEPER_THRESHOLD) return Tier.Keeper;
        return Tier.None;
    }
}
