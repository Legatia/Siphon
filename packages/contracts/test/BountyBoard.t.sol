// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/BountyBoard.sol";

contract BountyBoardTest is Test {
    BountyBoard public board;

    address public arbiterAddr = makeAddr("arbiter");
    address public poster = makeAddr("poster");
    address public claimant = makeAddr("claimant");
    address public stranger = makeAddr("stranger");

    bytes32 public bountyId1 = keccak256("bounty1");
    bytes32 public bountyId2 = keccak256("bounty2");
    bytes32 public shardId1 = keccak256("shard1");

    function setUp() public {
        board = new BountyBoard(arbiterAddr);
        vm.deal(poster, 10 ether);
        vm.deal(claimant, 1 ether);
    }

    function test_PostBounty() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        BountyBoard.Bounty memory b = board.getBounty(bountyId1);
        assertEq(b.poster, poster);
        assertEq(b.reward, 0.05 ether);
        assertTrue(b.state == BountyBoard.BountyState.Open);
    }

    function test_ClaimBounty() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        vm.prank(claimant);
        board.claimBounty(bountyId1, shardId1);

        BountyBoard.Bounty memory b = board.getBounty(bountyId1);
        assertEq(b.claimant, claimant);
        assertEq(b.claimantShardOrSwarmId, shardId1);
        assertTrue(b.state == BountyBoard.BountyState.Claimed);
    }

    function test_CompleteBounty() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        vm.prank(claimant);
        board.claimBounty(bountyId1, shardId1);

        uint256 claimantBalBefore = claimant.balance;

        vm.prank(arbiterAddr);
        board.completeBounty(bountyId1);

        assertEq(claimant.balance, claimantBalBefore + 0.05 ether);
        assertTrue(board.getBounty(bountyId1).state == BountyBoard.BountyState.Completed);
    }

    function test_CancelBounty() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        uint256 posterBalBefore = poster.balance;

        vm.prank(poster);
        board.cancelBounty(bountyId1);

        assertEq(poster.balance, posterBalBefore + 0.05 ether);
        assertTrue(board.getBounty(bountyId1).state == BountyBoard.BountyState.Cancelled);
    }

    function test_DisputeBounty() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        vm.prank(claimant);
        board.claimBounty(bountyId1, shardId1);

        vm.prank(poster);
        board.disputeBounty(bountyId1);

        assertTrue(board.getBounty(bountyId1).state == BountyBoard.BountyState.Disputed);
    }

    function test_RevertPostZeroReward() public {
        vm.prank(poster);
        vm.expectRevert("Reward required");
        board.postBounty(bountyId1, "Fix the bug", block.timestamp + 7 days);
    }

    function test_RevertPostPastDeadline() public {
        vm.prank(poster);
        vm.expectRevert("Deadline must be in the future");
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp - 1);
    }

    function test_RevertClaimNotOpen() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        vm.prank(claimant);
        board.claimBounty(bountyId1, shardId1);

        vm.prank(stranger);
        vm.expectRevert("Bounty not open");
        board.claimBounty(bountyId1, shardId1);
    }

    function test_RevertCompleteNotArbiter() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        vm.prank(claimant);
        board.claimBounty(bountyId1, shardId1);

        vm.prank(poster);
        vm.expectRevert("Not arbiter");
        board.completeBounty(bountyId1);
    }

    function test_RevertCancelNotPoster() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        vm.prank(stranger);
        vm.expectRevert("Not the poster");
        board.cancelBounty(bountyId1);
    }

    function test_RevertCancelAlreadyClaimed() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        vm.prank(claimant);
        board.claimBounty(bountyId1, shardId1);

        vm.prank(poster);
        vm.expectRevert("Cannot cancel");
        board.cancelBounty(bountyId1);
    }

    function test_RevertDisputeNotParticipant() public {
        vm.prank(poster);
        board.postBounty{value: 0.05 ether}(bountyId1, "Fix the bug", block.timestamp + 7 days);

        vm.prank(claimant);
        board.claimBounty(bountyId1, shardId1);

        vm.prank(stranger);
        vm.expectRevert("Not a participant");
        board.disputeBounty(bountyId1);
    }
}
