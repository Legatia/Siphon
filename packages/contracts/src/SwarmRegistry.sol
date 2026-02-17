// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ShardRegistry.sol";

contract SwarmRegistry {
    struct Swarm {
        address owner;
        bytes32[] shardIds;
        uint256 createdAt;
    }

    uint256 public constant MAX_SWARM_SIZE = 5;
    uint256 public constant MIN_SWARM_SIZE = 2;

    ShardRegistry public immutable registry;

    mapping(bytes32 => Swarm) internal swarms;

    event SwarmCreated(bytes32 indexed swarmId, address indexed owner, uint256 size);
    event SwarmDissolved(bytes32 indexed swarmId, address indexed owner);

    constructor(address _registry) {
        require(_registry != address(0), "Invalid registry");
        registry = ShardRegistry(_registry);
    }

    function createSwarm(bytes32 swarmId, bytes32[] calldata shardIds) external {
        require(swarms[swarmId].createdAt == 0, "Swarm already exists");
        require(shardIds.length >= MIN_SWARM_SIZE, "Too few shards");
        require(shardIds.length <= MAX_SWARM_SIZE, "Too many shards");

        // Verify caller owns all shards
        for (uint256 i = 0; i < shardIds.length; i++) {
            require(registry.getOwner(shardIds[i]) == msg.sender, "Not shard owner");
        }

        swarms[swarmId].owner = msg.sender;
        swarms[swarmId].createdAt = block.timestamp;
        for (uint256 i = 0; i < shardIds.length; i++) {
            swarms[swarmId].shardIds.push(shardIds[i]);
        }

        emit SwarmCreated(swarmId, msg.sender, shardIds.length);
    }

    function dissolveSwarm(bytes32 swarmId) external {
        require(swarms[swarmId].createdAt != 0, "Swarm not found");
        require(swarms[swarmId].owner == msg.sender, "Not swarm owner");

        delete swarms[swarmId];

        emit SwarmDissolved(swarmId, msg.sender);
    }

    function getSwarm(bytes32 swarmId) external view returns (address owner, bytes32[] memory shardIds, uint256 createdAt) {
        Swarm storage s = swarms[swarmId];
        return (s.owner, s.shardIds, s.createdAt);
    }
}
