// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/KeeperStaking.sol";

contract KeeperStakingTest is Test {
    KeeperStaking public staking;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public governance;

    function setUp() public {
        staking = new KeeperStaking();
        governance = address(this);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_Stake() public {
        vm.prank(alice);
        staking.stake{value: 0.1 ether}();

        KeeperStaking.KeeperInfo memory info = staking.getKeeperInfo(alice);
        assertEq(info.stakedAmount, 0.1 ether);
        assertTrue(info.isActive);
    }

    function test_StakeEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit KeeperStaking.Staked(alice, 0.1 ether);
        staking.stake{value: 0.1 ether}();
    }

    function test_RevertStakeBelowMinimum() public {
        vm.prank(alice);
        vm.expectRevert("Below minimum stake");
        staking.stake{value: 0.01 ether}();
    }

    function test_StakeMultiple() public {
        vm.startPrank(alice);
        staking.stake{value: 0.1 ether}();
        staking.stake{value: 0.5 ether}();
        vm.stopPrank();

        KeeperStaking.KeeperInfo memory info = staking.getKeeperInfo(alice);
        assertEq(info.stakedAmount, 0.6 ether);
    }

    function test_RequestUnstake() public {
        vm.prank(alice);
        staking.stake{value: 0.1 ether}();

        vm.prank(alice);
        staking.requestUnstake();

        KeeperStaking.KeeperInfo memory info = staking.getKeeperInfo(alice);
        assertGt(info.unstakeRequestedAt, 0);
    }

    function test_RevertRequestUnstakeNotKeeper() public {
        vm.prank(alice);
        vm.expectRevert("Not an active keeper");
        staking.requestUnstake();
    }

    function test_RevertDoubleRequestUnstake() public {
        vm.prank(alice);
        staking.stake{value: 0.1 ether}();

        vm.startPrank(alice);
        staking.requestUnstake();
        vm.expectRevert("Unstake already requested");
        staking.requestUnstake();
        vm.stopPrank();
    }

    function test_Unstake() public {
        vm.prank(alice);
        staking.stake{value: 1 ether}();

        vm.prank(alice);
        staking.requestUnstake();

        vm.warp(block.timestamp + 7 days + 1);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        staking.unstake();
        uint256 balAfter = alice.balance;

        assertEq(balAfter - balBefore, 1 ether);
        KeeperStaking.KeeperInfo memory info = staking.getKeeperInfo(alice);
        assertEq(info.stakedAmount, 0);
        assertFalse(info.isActive);
    }

    function test_RevertUnstakeTooEarly() public {
        vm.prank(alice);
        staking.stake{value: 0.1 ether}();

        vm.prank(alice);
        staking.requestUnstake();

        vm.warp(block.timestamp + 3 days);

        vm.prank(alice);
        vm.expectRevert("Unstake delay not elapsed");
        staking.unstake();
    }

    function test_RevertUnstakeNotRequested() public {
        vm.prank(alice);
        staking.stake{value: 0.1 ether}();

        vm.prank(alice);
        vm.expectRevert("No unstake requested");
        staking.unstake();
    }

    function test_Slash() public {
        vm.prank(alice);
        staking.stake{value: 1 ether}();

        staking.slash(alice, 50, "Misbehavior");

        KeeperStaking.KeeperInfo memory info = staking.getKeeperInfo(alice);
        assertEq(info.stakedAmount, 0.5 ether);
        assertTrue(info.isActive);
    }

    function test_SlashDeactivatesIfBelowMin() public {
        vm.prank(alice);
        staking.stake{value: 0.1 ether}();

        staking.slash(alice, 50, "Severe violation");

        KeeperStaking.KeeperInfo memory info = staking.getKeeperInfo(alice);
        assertFalse(info.isActive);
    }

    function test_SlashEmitsEvent() public {
        vm.prank(alice);
        staking.stake{value: 1 ether}();

        vm.expectEmit(true, false, false, true);
        emit KeeperStaking.Slashed(alice, 0.5 ether, "test");
        staking.slash(alice, 50, "test");
    }

    function test_RevertSlashNotGovernance() public {
        vm.prank(alice);
        staking.stake{value: 1 ether}();

        vm.prank(bob);
        vm.expectRevert("Not governance");
        staking.slash(alice, 50, "test");
    }

    function test_RevertSlashInvalidPercentage() public {
        vm.prank(alice);
        staking.stake{value: 1 ether}();

        vm.expectRevert("Invalid percentage");
        staking.slash(alice, 101, "test");
    }

    function test_DistributeAndClaimRewards() public {
        vm.prank(alice);
        staking.stake{value: 0.1 ether}();

        // Fund the contract
        vm.deal(address(staking), 10 ether);

        staking.distributeRewards(alice, 0.5 ether);

        KeeperStaking.KeeperInfo memory info = staking.getKeeperInfo(alice);
        assertEq(info.rewards, 0.5 ether);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        staking.claimRewards();
        uint256 balAfter = alice.balance;

        assertEq(balAfter - balBefore, 0.5 ether);
    }

    function test_RevertClaimNoRewards() public {
        vm.prank(alice);
        vm.expectRevert("No rewards");
        staking.claimRewards();
    }

    function test_RevertDistributeNotGovernance() public {
        vm.prank(alice);
        staking.stake{value: 0.1 ether}();

        vm.prank(bob);
        vm.expectRevert("Not governance");
        staking.distributeRewards(alice, 0.1 ether);
    }
}
