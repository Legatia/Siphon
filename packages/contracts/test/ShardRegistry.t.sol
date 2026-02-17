// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ShardRegistry.sol";

contract ShardRegistryTest is Test {
    ShardRegistry public registry;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public shardId1 = keccak256("shard1");
    bytes32 public shardId2 = keccak256("shard2");
    bytes32 public genomeHash1 = keccak256("genome1");
    bytes32 public genomeHash2 = keccak256("genome2");

    function setUp() public {
        registry = new ShardRegistry();
    }

    function test_Register() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        ShardRegistry.ShardRecord memory shard = registry.getShard(shardId1);
        assertEq(shard.owner, alice);
        assertEq(shard.origin, alice);
        assertEq(shard.genomeHash, genomeHash1);
        assertFalse(shard.isWild);
        assertGt(shard.registeredAt, 0);
    }

    function test_RegisterEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit ShardRegistry.ShardRegistered(shardId1, genomeHash1, alice);
        registry.register(shardId1, genomeHash1);
    }

    function test_RevertDoubleRegister() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        vm.prank(bob);
        vm.expectRevert("Shard already registered");
        registry.register(shardId1, genomeHash2);
    }

    function test_TransferOwnership() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        vm.prank(alice);
        registry.transferOwnership(shardId1, bob);

        assertEq(registry.getOwner(shardId1), bob);
        assertEq(registry.getOrigin(shardId1), alice);
        assertEq(registry.getOwnerShardCount(alice), 0);
        assertEq(registry.getOwnerShardCount(bob), 1);
    }

    function test_TransferEmitsEvent() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit ShardRegistry.OwnershipTransferred(shardId1, alice, bob);
        registry.transferOwnership(shardId1, bob);
    }

    function test_RevertTransferNotOwner() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        vm.prank(bob);
        vm.expectRevert("Not shard owner");
        registry.transferOwnership(shardId1, alice);
    }

    function test_RevertTransferToZero() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        vm.prank(alice);
        vm.expectRevert("Invalid address");
        registry.transferOwnership(shardId1, address(0));
    }

    function test_RevertTransferToSelf() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        vm.prank(alice);
        vm.expectRevert("Cannot transfer to self");
        registry.transferOwnership(shardId1, alice);
    }

    function test_SetWild() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        vm.prank(alice);
        registry.setWild(shardId1);

        ShardRegistry.ShardRecord memory shard = registry.getShard(shardId1);
        assertTrue(shard.isWild);
    }

    function test_SetWildEmitsEvent() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit ShardRegistry.ShardReleasedToWild(shardId1);
        registry.setWild(shardId1);
    }

    function test_RevertSetWildNotOwner() public {
        vm.prank(alice);
        registry.register(shardId1, genomeHash1);

        vm.prank(bob);
        vm.expectRevert("Not shard owner");
        registry.setWild(shardId1);
    }

    function test_GetOwnerShardCount() public {
        vm.startPrank(alice);
        registry.register(shardId1, genomeHash1);
        registry.register(shardId2, genomeHash2);
        vm.stopPrank();

        assertEq(registry.getOwnerShardCount(alice), 2);
        assertEq(registry.getOwnerShardAtIndex(alice, 0), shardId1);
        assertEq(registry.getOwnerShardAtIndex(alice, 1), shardId2);
    }

    function test_RevertNonexistentShard() public {
        vm.expectRevert("Shard not registered");
        registry.getOwner(shardId1);
    }
}
