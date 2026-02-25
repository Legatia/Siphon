// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/BattleSettlement.sol";

contract BattleSettlementTest is Test {
    BattleSettlement public settlement;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public arbiter;

    bytes32 public battleId = keccak256("battle1");

    function setUp() public {
        settlement = new BattleSettlement();
        arbiter = address(this);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_CreateBattle() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        BattleSettlement.BattleRecord memory b = settlement.getBattle(battleId);
        assertEq(b.challenger, alice);
        assertEq(b.defender, bob);
        assertEq(b.stakeAmount, 1 ether);
        assertEq(uint(b.state), uint(BattleSettlement.BattleState.Created));
    }

    function test_CreateBattleEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit BattleSettlement.BattleCreated(battleId, alice, bob, 1 ether);
        settlement.createBattle{value: 1 ether}(battleId, bob);
    }

    function test_RevertCreateDuplicate() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.prank(alice);
        vm.expectRevert("Battle exists");
        settlement.createBattle{value: 1 ether}(battleId, bob);
    }

    function test_RevertCreateNoStake() public {
        vm.prank(alice);
        vm.expectRevert("Stake required");
        settlement.createBattle{value: 0}(battleId, bob);
    }

    function test_RevertCreateSelfBattle() public {
        vm.prank(alice);
        vm.expectRevert("Cannot battle self");
        settlement.createBattle{value: 1 ether}(battleId, alice);
    }

    function test_JoinBattle() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.prank(bob);
        settlement.joinBattle{value: 1 ether}(battleId);

        BattleSettlement.BattleRecord memory b = settlement.getBattle(battleId);
        assertEq(uint(b.state), uint(BattleSettlement.BattleState.Joined));
    }

    function test_RevertJoinWrongDefender() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        address charlie = makeAddr("charlie");
        vm.deal(charlie, 10 ether);
        vm.prank(charlie);
        vm.expectRevert("Not the defender");
        settlement.joinBattle{value: 1 ether}(battleId);
    }

    function test_RevertJoinStakeMismatch() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.prank(bob);
        vm.expectRevert("Stake mismatch");
        settlement.joinBattle{value: 0.5 ether}(battleId);
    }

    function test_SettleWinner() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.prank(bob);
        settlement.joinBattle{value: 1 ether}(battleId);

        settlement.settle(battleId, alice);

        BattleSettlement.BattleRecord memory b = settlement.getBattle(battleId);
        assertEq(uint(b.state), uint(BattleSettlement.BattleState.Settled));
        assertEq(b.winner, alice);
    }

    function test_FinalizeSettlementWinner() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.prank(bob);
        settlement.joinBattle{value: 1 ether}(battleId);

        settlement.settle(battleId, alice);
        vm.warp(block.timestamp + settlement.DISPUTE_WINDOW() + 1);

        uint256 balBefore = alice.balance;
        settlement.finalizeSettlement(battleId);
        uint256 balAfter = alice.balance;

        assertEq(balAfter - balBefore, 2 ether);
        BattleSettlement.BattleRecord memory b = settlement.getBattle(battleId);
        assertEq(uint(b.state), uint(BattleSettlement.BattleState.Resolved));
    }

    function test_FinalizeSettlementDraw() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.prank(bob);
        settlement.joinBattle{value: 1 ether}(battleId);

        settlement.settle(battleId, address(0));
        vm.warp(block.timestamp + settlement.DISPUTE_WINDOW() + 1);

        uint256 aliceBal = alice.balance;
        uint256 bobBal = bob.balance;
        settlement.finalizeSettlement(battleId);

        assertEq(alice.balance - aliceBal, 1 ether);
        assertEq(bob.balance - bobBal, 1 ether);
    }

    function test_RevertSettleNotArbiter() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.prank(bob);
        settlement.joinBattle{value: 1 ether}(battleId);

        vm.prank(alice);
        vm.expectRevert("Not arbiter");
        settlement.settle(battleId, alice);
    }

    function test_Dispute() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.prank(bob);
        settlement.joinBattle{value: 1 ether}(battleId);

        settlement.settle(battleId, alice);

        vm.prank(bob);
        settlement.dispute(battleId);

        BattleSettlement.BattleRecord memory b = settlement.getBattle(battleId);
        assertEq(uint(b.state), uint(BattleSettlement.BattleState.Disputed));
    }

    function test_ResolveDispute() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.prank(bob);
        settlement.joinBattle{value: 1 ether}(battleId);

        settlement.settle(battleId, alice);

        vm.prank(bob);
        settlement.dispute(battleId);

        uint256 bobBal = bob.balance;
        settlement.resolveDispute(battleId, bob);

        BattleSettlement.BattleRecord memory b = settlement.getBattle(battleId);
        assertEq(uint(b.state), uint(BattleSettlement.BattleState.Resolved));
        assertEq(b.winner, bob);
        assertEq(bob.balance - bobBal, 2 ether);
    }

    function test_CancelUnjoinedAfterTimeout() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);

        vm.warp(block.timestamp + settlement.JOIN_TIMEOUT() + 1);
        uint256 aliceBal = alice.balance;
        vm.prank(alice);
        settlement.cancelUnjoined(battleId);

        BattleSettlement.BattleRecord memory b = settlement.getBattle(battleId);
        assertEq(uint(b.state), uint(BattleSettlement.BattleState.Cancelled));
        assertEq(alice.balance - aliceBal, 1 ether);
    }

    function test_RevertDisputeAfterWindow() public {
        vm.prank(alice);
        settlement.createBattle{value: 1 ether}(battleId, bob);
        vm.prank(bob);
        settlement.joinBattle{value: 1 ether}(battleId);
        settlement.settle(battleId, alice);

        vm.warp(block.timestamp + settlement.DISPUTE_WINDOW() + 1);
        vm.prank(bob);
        vm.expectRevert("Dispute window closed");
        settlement.dispute(battleId);
    }
}
