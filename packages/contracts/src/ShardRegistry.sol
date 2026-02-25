// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ShardRegistry {
    struct ShardRecord {
        bytes32 genomeHash;
        address owner;
        address origin;
        bool isWild;
        uint256 registeredAt;
    }

    mapping(bytes32 => ShardRecord) public shards;
    mapping(address => bytes32[]) public ownerShards;

    /// @dev Which contract has locked a shard (address(0) = unlocked)
    mapping(bytes32 => address) public lockedBy;
    /// @dev owner => locker contract => approved
    mapping(address => mapping(address => bool)) public approvedLockers;

    event ShardRegistered(bytes32 indexed shardId, bytes32 genomeHash, address indexed owner);
    event OwnershipTransferred(bytes32 indexed shardId, address indexed from, address indexed to);
    event ShardReleasedToWild(bytes32 indexed shardId);
    event ShardLocked(bytes32 indexed shardId, address indexed locker);
    event ShardUnlocked(bytes32 indexed shardId, address indexed locker);
    event LockerApproved(address indexed owner, address indexed locker);
    event LockerRevoked(address indexed owner, address indexed locker);

    modifier onlyOwner(bytes32 shardId) {
        require(shards[shardId].owner == msg.sender, "Not shard owner");
        _;
    }

    modifier shardExists(bytes32 shardId) {
        require(shards[shardId].registeredAt != 0, "Shard not registered");
        _;
    }

    modifier notLocked(bytes32 shardId) {
        require(lockedBy[shardId] == address(0), "Shard is locked");
        _;
    }

    function register(bytes32 shardId, bytes32 genomeHash) external {
        require(shards[shardId].registeredAt == 0, "Shard already registered");

        shards[shardId] = ShardRecord({
            genomeHash: genomeHash,
            owner: msg.sender,
            origin: msg.sender,
            isWild: false,
            registeredAt: block.timestamp
        });

        ownerShards[msg.sender].push(shardId);

        emit ShardRegistered(shardId, genomeHash, msg.sender);
    }

    function transferOwnership(bytes32 shardId, address to)
        external
        shardExists(shardId)
        onlyOwner(shardId)
        notLocked(shardId)
    {
        require(to != address(0), "Invalid address");
        require(to != msg.sender, "Cannot transfer to self");

        address from = shards[shardId].owner;
        shards[shardId].owner = to;
        shards[shardId].isWild = false;

        // Remove from sender's list
        bytes32[] storage fromShards = ownerShards[from];
        for (uint256 i = 0; i < fromShards.length; i++) {
            if (fromShards[i] == shardId) {
                fromShards[i] = fromShards[fromShards.length - 1];
                fromShards.pop();
                break;
            }
        }

        ownerShards[to].push(shardId);

        emit OwnershipTransferred(shardId, from, to);
    }

    function setWild(bytes32 shardId)
        external
        shardExists(shardId)
        onlyOwner(shardId)
        notLocked(shardId)
    {
        shards[shardId].isWild = true;
        emit ShardReleasedToWild(shardId);
    }

    function getOwner(bytes32 shardId) external view shardExists(shardId) returns (address) {
        return shards[shardId].owner;
    }

    function getOrigin(bytes32 shardId) external view shardExists(shardId) returns (address) {
        return shards[shardId].origin;
    }

    function getShard(bytes32 shardId) external view shardExists(shardId) returns (ShardRecord memory) {
        return shards[shardId];
    }

    function getOwnerShardCount(address owner) external view returns (uint256) {
        return ownerShards[owner].length;
    }

    function getOwnerShardAtIndex(address owner, uint256 index) external view returns (bytes32) {
        require(index < ownerShards[owner].length, "Index out of bounds");
        return ownerShards[owner][index];
    }

    // --- Lock / Unlock (for collateral protocols) ---

    /// @notice Approve a contract to lock your shards as collateral.
    function approveLock(address locker) external {
        require(locker != address(0), "Invalid locker");
        approvedLockers[msg.sender][locker] = true;
        emit LockerApproved(msg.sender, locker);
    }

    /// @notice Revoke a locker's approval for future locks.
    /// Existing locks are unaffected and can still be unlocked/seized by the active locker.
    function revokeLock(address locker) external {
        approvedLockers[msg.sender][locker] = false;
        emit LockerRevoked(msg.sender, locker);
    }

    /// @notice Lock a shard. Callable by an approved locker contract.
    /// Prevents transfer and setWild until unlocked.
    function lockShard(bytes32 shardId)
        external
        shardExists(shardId)
        notLocked(shardId)
    {
        address owner = shards[shardId].owner;
        require(approvedLockers[owner][msg.sender], "Not approved locker");
        lockedBy[shardId] = msg.sender;
        emit ShardLocked(shardId, msg.sender);
    }

    /// @notice Unlock a shard. Only callable by the contract that locked it.
    function unlockShard(bytes32 shardId) external shardExists(shardId) {
        require(lockedBy[shardId] == msg.sender, "Not the locker");
        lockedBy[shardId] = address(0);
        emit ShardUnlocked(shardId, msg.sender);
    }

    /// @notice Check if a shard is locked.
    function isLocked(bytes32 shardId) external view returns (bool) {
        return lockedBy[shardId] != address(0);
    }

    /// @notice Force-transfer a locked shard. Only callable by the active locker (for liquidation).
    function seize(bytes32 shardId, address to) external shardExists(shardId) {
        require(lockedBy[shardId] == msg.sender, "Not the locker");
        require(to != address(0), "Invalid address");

        address from = shards[shardId].owner;

        // Unlock first
        lockedBy[shardId] = address(0);

        // Transfer ownership
        shards[shardId].owner = to;
        shards[shardId].isWild = false;

        // Remove from sender's list
        bytes32[] storage fromShards = ownerShards[from];
        for (uint256 i = 0; i < fromShards.length; i++) {
            if (fromShards[i] == shardId) {
                fromShards[i] = fromShards[fromShards.length - 1];
                fromShards.pop();
                break;
            }
        }

        ownerShards[to].push(shardId);

        emit ShardUnlocked(shardId, msg.sender);
        emit OwnershipTransferred(shardId, from, to);
    }
}
