// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ShardRegistry.sol";

/// @dev Mock locker contract to test lock/unlock/seize
contract MockLocker {
    ShardRegistry public registry;

    constructor(address _registry) {
        registry = ShardRegistry(_registry);
    }

    function lock(bytes32 shardId) external {
        registry.lockShard(shardId);
    }

    function unlock(bytes32 shardId) external {
        registry.unlockShard(shardId);
    }

    function seize(bytes32 shardId, address to) external {
        registry.seize(shardId, to);
    }
}

contract ShardRegistryLockTest is Test {
    ShardRegistry public registry;
    MockLocker public locker;
    MockLocker public locker2;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public shardId1 = keccak256("shard1");
    bytes32 public genomeHash1 = keccak256("genome1");

    function setUp() public {
        registry = new ShardRegistry();
        locker = new MockLocker(address(registry));
        locker2 = new MockLocker(address(registry));

        // Alice registers a shard and approves the locker
        vm.startPrank(alice);
        registry.register(shardId1, genomeHash1);
        registry.approveLock(address(locker));
        vm.stopPrank();
    }

    function test_ApproveLockEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit ShardRegistry.LockerApproved(alice, address(locker2));
        registry.approveLock(address(locker2));
    }

    function test_LockShard() public {
        locker.lock(shardId1);
        assertTrue(registry.isLocked(shardId1));
        assertEq(registry.lockedBy(shardId1), address(locker));
    }

    function test_LockEmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit ShardRegistry.ShardLocked(shardId1, address(locker));
        locker.lock(shardId1);
    }

    function test_UnlockShard() public {
        locker.lock(shardId1);
        locker.unlock(shardId1);
        assertFalse(registry.isLocked(shardId1));
    }

    function test_RevertLockNotApproved() public {
        vm.expectRevert("Not approved locker");
        locker2.lock(shardId1);
    }

    function test_RevertLockAlreadyLocked() public {
        locker.lock(shardId1);
        vm.expectRevert("Shard is locked");
        locker.lock(shardId1);
    }

    function test_RevertUnlockWrongLocker() public {
        locker.lock(shardId1);
        vm.expectRevert("Not the locker");
        locker2.unlock(shardId1);
    }

    function test_RevertTransferWhileLocked() public {
        locker.lock(shardId1);
        vm.prank(alice);
        vm.expectRevert("Shard is locked");
        registry.transferOwnership(shardId1, bob);
    }

    function test_RevertSetWildWhileLocked() public {
        locker.lock(shardId1);
        vm.prank(alice);
        vm.expectRevert("Shard is locked");
        registry.setWild(shardId1);
    }

    function test_SeizeShard() public {
        locker.lock(shardId1);
        locker.seize(shardId1, bob);

        assertEq(registry.getOwner(shardId1), bob);
        assertFalse(registry.isLocked(shardId1));
        assertEq(registry.getOwnerShardCount(alice), 0);
        assertEq(registry.getOwnerShardCount(bob), 1);
    }

    function test_RevertSeizeWrongLocker() public {
        locker.lock(shardId1);
        vm.expectRevert("Not the locker");
        locker2.seize(shardId1, bob);
    }

    function test_RevertSeizeToZero() public {
        locker.lock(shardId1);
        vm.expectRevert("Invalid address");
        locker.seize(shardId1, address(0));
    }

    function test_RevokeLock() public {
        vm.prank(alice);
        registry.revokeLock(address(locker));

        // Now locker can't lock
        vm.expectRevert("Not approved locker");
        locker.lock(shardId1);
    }

    function test_TransferAfterUnlock() public {
        locker.lock(shardId1);
        locker.unlock(shardId1);

        // Transfer should work again
        vm.prank(alice);
        registry.transferOwnership(shardId1, bob);
        assertEq(registry.getOwner(shardId1), bob);
    }
}
