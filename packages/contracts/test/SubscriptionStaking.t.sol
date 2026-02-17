// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SubscriptionStaking.sol";

/// @dev Minimal mock ERC20 for testing
contract MockUSDC {
    string public name = "USD Coin";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SubscriptionStakingTest is Test {
    SubscriptionStaking public staking;
    MockUSDC public usdc;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC();
        staking = new SubscriptionStaking(address(usdc));

        // Give alice and bob USDC
        usdc.mint(alice, 5000e6);
        usdc.mint(bob, 5000e6);

        // Approve staking contract
        vm.prank(alice);
        usdc.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(staking), type(uint256).max);
    }

    function test_StakeKeeper() public {
        vm.prank(alice);
        staking.stake(100e6);

        assertEq(uint256(staking.getTier(alice)), uint256(SubscriptionStaking.Tier.Keeper));
        SubscriptionStaking.StakeInfo memory info = staking.getStake(alice);
        assertEq(info.amount, 100e6);
    }

    function test_StakeKeeperPlus() public {
        vm.prank(alice);
        staking.stake(500e6);

        assertEq(uint256(staking.getTier(alice)), uint256(SubscriptionStaking.Tier.KeeperPlus));
    }

    function test_StakeKeeperPro() public {
        vm.prank(alice);
        staking.stake(2000e6);

        assertEq(uint256(staking.getTier(alice)), uint256(SubscriptionStaking.Tier.KeeperPro));
    }

    function test_StakeIncrementalUpgrade() public {
        vm.prank(alice);
        staking.stake(100e6);
        assertEq(uint256(staking.getTier(alice)), uint256(SubscriptionStaking.Tier.Keeper));

        vm.prank(alice);
        staking.stake(400e6);
        assertEq(uint256(staking.getTier(alice)), uint256(SubscriptionStaking.Tier.KeeperPlus));
        assertEq(staking.getStake(alice).amount, 500e6);
    }

    function test_StakeBelowThreshold() public {
        vm.prank(alice);
        staking.stake(50e6);

        assertEq(uint256(staking.getTier(alice)), uint256(SubscriptionStaking.Tier.None));
    }

    function test_UnstakeReturnsFunds() public {
        vm.prank(alice);
        staking.stake(100e6);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        staking.unstake();

        assertEq(usdc.balanceOf(alice), balBefore + 100e6);
    }

    function test_UnstakeResetsTier() public {
        vm.prank(alice);
        staking.stake(500e6);

        vm.prank(alice);
        staking.unstake();

        assertEq(uint256(staking.getTier(alice)), uint256(SubscriptionStaking.Tier.None));
        assertEq(staking.getStake(alice).amount, 0);
        assertEq(staking.getStake(alice).stakedAt, 0);
    }

    function test_RevertStakeZero() public {
        vm.prank(alice);
        vm.expectRevert("Amount must be > 0");
        staking.stake(0);
    }

    function test_RevertUnstakeNothing() public {
        vm.prank(alice);
        vm.expectRevert("Nothing staked");
        staking.unstake();
    }

    function test_StakeEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit SubscriptionStaking.Staked(alice, 100e6, SubscriptionStaking.Tier.Keeper);
        staking.stake(100e6);
    }

    function test_UnstakeEmitsEvent() public {
        vm.prank(alice);
        staking.stake(100e6);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit SubscriptionStaking.Unstaked(alice, 100e6);
        staking.unstake();
    }

    function test_GetTierView() public {
        assertEq(uint256(staking.getTier(alice)), uint256(SubscriptionStaking.Tier.None));

        vm.prank(alice);
        staking.stake(2000e6);
        assertEq(uint256(staking.getTier(alice)), uint256(SubscriptionStaking.Tier.KeeperPro));
    }
}
