// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ShardRegistry.sol";
import "../src/SwarmRegistry.sol";

contract SwarmRegistryTest is Test {
    ShardRegistry public registry;
    SwarmRegistry public swarmRegistry;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public shard1 = keccak256("shard1");
    bytes32 public shard2 = keccak256("shard2");
    bytes32 public shard3 = keccak256("shard3");
    bytes32 public shard4 = keccak256("shard4");
    bytes32 public shard5 = keccak256("shard5");
    bytes32 public shard6 = keccak256("shard6");

    bytes32 public swarmId1 = keccak256("swarm1");
    bytes32 public swarmId2 = keccak256("swarm2");

    function setUp() public {
        registry = new ShardRegistry();
        swarmRegistry = new SwarmRegistry(address(registry));

        // Register 6 shards for alice
        vm.startPrank(alice);
        registry.register(shard1, keccak256("g1"));
        registry.register(shard2, keccak256("g2"));
        registry.register(shard3, keccak256("g3"));
        registry.register(shard4, keccak256("g4"));
        registry.register(shard5, keccak256("g5"));
        registry.register(shard6, keccak256("g6"));
        vm.stopPrank();
    }

    function test_CreateSwarm() public {
        bytes32[] memory shards = new bytes32[](3);
        shards[0] = shard1;
        shards[1] = shard2;
        shards[2] = shard3;

        vm.prank(alice);
        swarmRegistry.createSwarm(swarmId1, shards);

        (address owner, bytes32[] memory ids, uint256 createdAt) = swarmRegistry.getSwarm(swarmId1);
        assertEq(owner, alice);
        assertEq(ids.length, 3);
        assertTrue(createdAt > 0);
    }

    function test_DissolveSwarm() public {
        bytes32[] memory shards = new bytes32[](2);
        shards[0] = shard1;
        shards[1] = shard2;

        vm.prank(alice);
        swarmRegistry.createSwarm(swarmId1, shards);

        vm.prank(alice);
        swarmRegistry.dissolveSwarm(swarmId1);

        (address owner, , uint256 createdAt) = swarmRegistry.getSwarm(swarmId1);
        assertEq(owner, address(0));
        assertEq(createdAt, 0);
    }

    function test_GetSwarmView() public {
        bytes32[] memory shards = new bytes32[](2);
        shards[0] = shard1;
        shards[1] = shard2;

        vm.prank(alice);
        swarmRegistry.createSwarm(swarmId1, shards);

        (address owner, bytes32[] memory ids, uint256 createdAt) = swarmRegistry.getSwarm(swarmId1);
        assertEq(owner, alice);
        assertEq(ids[0], shard1);
        assertEq(ids[1], shard2);
        assertTrue(createdAt > 0);
    }

    function test_RevertCreateDuplicate() public {
        bytes32[] memory shards = new bytes32[](2);
        shards[0] = shard1;
        shards[1] = shard2;

        vm.prank(alice);
        swarmRegistry.createSwarm(swarmId1, shards);

        vm.prank(alice);
        vm.expectRevert("Swarm already exists");
        swarmRegistry.createSwarm(swarmId1, shards);
    }

    function test_RevertCreateTooFew() public {
        bytes32[] memory shards = new bytes32[](1);
        shards[0] = shard1;

        vm.prank(alice);
        vm.expectRevert("Too few shards");
        swarmRegistry.createSwarm(swarmId1, shards);
    }

    function test_RevertCreateTooMany() public {
        bytes32[] memory shards = new bytes32[](6);
        shards[0] = shard1;
        shards[1] = shard2;
        shards[2] = shard3;
        shards[3] = shard4;
        shards[4] = shard5;
        shards[5] = shard6;

        vm.prank(alice);
        vm.expectRevert("Too many shards");
        swarmRegistry.createSwarm(swarmId1, shards);
    }

    function test_RevertCreateNotOwner() public {
        bytes32[] memory shards = new bytes32[](2);
        shards[0] = shard1;
        shards[1] = shard2;

        vm.prank(bob);
        vm.expectRevert("Not shard owner");
        swarmRegistry.createSwarm(swarmId1, shards);
    }

    function test_RevertDissolveNotOwner() public {
        bytes32[] memory shards = new bytes32[](2);
        shards[0] = shard1;
        shards[1] = shard2;

        vm.prank(alice);
        swarmRegistry.createSwarm(swarmId1, shards);

        vm.prank(bob);
        vm.expectRevert("Not swarm owner");
        swarmRegistry.dissolveSwarm(swarmId1);
    }
}
