// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ShardRegistry.sol";
import "./SiphonIdentity.sol";

/// @title ShardValuation
/// @notice Composite on-chain valuation for shards used as loan collateral.
/// Keepers attest to off-chain stats (level, ELO, stats sum). The contract
/// combines these with on-chain reputation to produce a valuation in wei.
contract ShardValuation {
    struct Attestation {
        uint256 level;       // 1-100
        uint256 elo;         // 800-3000 typical
        uint256 statsSum;    // sum of 5 genome-derived stats (50-115 each, 265-575 total)
        uint256 timestamp;
        address attestedBy;
    }

    ShardRegistry public immutable registry;
    SiphonIdentity public immutable identity;

    /// @dev Minimum number of attestations required for a valid valuation
    uint256 public constant MIN_ATTESTATIONS = 1;

    /// @dev Attestation expires after this duration
    uint256 public constant ATTESTATION_TTL = 7 days;

    /// @dev Base value per shard in wei (0.01 ETH)
    uint256 public constant BASE_VALUE = 0.01 ether;

    /// @dev Per-level bonus in wei (0.002 ETH per level)
    uint256 public constant LEVEL_BONUS = 0.002 ether;

    /// @dev Per-ELO-point-above-1200 bonus in wei
    uint256 public constant ELO_BONUS_PER_POINT = 0.00001 ether;

    /// @dev Per-reputation-point bonus in wei
    uint256 public constant REP_BONUS_PER_POINT = 0.001 ether;

    /// @dev shardId => latest attestation
    mapping(bytes32 => Attestation) public attestations;

    /// @dev keeper => isApproved
    mapping(address => bool) public approvedKeepers;

    address public governance;

    event Attested(bytes32 indexed shardId, address indexed keeper, uint256 level, uint256 elo, uint256 statsSum);
    event KeeperApproved(address indexed keeper);
    event KeeperRemoved(address indexed keeper);

    modifier onlyGovernance() {
        require(msg.sender == governance, "Not governance");
        _;
    }

    modifier onlyApprovedKeeper() {
        require(approvedKeepers[msg.sender], "Not approved keeper");
        _;
    }

    constructor(address _registry, address _identity) {
        registry = ShardRegistry(_registry);
        identity = SiphonIdentity(_identity);
        governance = msg.sender;
    }

    /// @notice Approve a keeper to submit attestations.
    function approveKeeper(address keeper) external onlyGovernance {
        approvedKeepers[keeper] = true;
        emit KeeperApproved(keeper);
    }

    /// @notice Remove a keeper's attestation rights.
    function removeKeeper(address keeper) external onlyGovernance {
        approvedKeepers[keeper] = false;
        emit KeeperRemoved(keeper);
    }

    /// @notice Submit an attestation for a shard's off-chain stats.
    function attest(
        bytes32 shardId,
        uint256 level,
        uint256 elo,
        uint256 statsSum
    ) external onlyApprovedKeeper {
        // Verify shard exists on-chain
        ShardRegistry.ShardRecord memory shard = registry.getShard(shardId);
        require(shard.registeredAt != 0, "Shard not registered");

        require(level >= 1 && level <= 100, "Invalid level");
        require(elo >= 100 && elo <= 5000, "Invalid ELO");
        require(statsSum <= 600, "Invalid stats sum");

        attestations[shardId] = Attestation({
            level: level,
            elo: elo,
            statsSum: statsSum,
            timestamp: block.timestamp,
            attestedBy: msg.sender
        });

        emit Attested(shardId, msg.sender, level, elo, statsSum);
    }

    /// @notice Get the current valuation of a shard in wei.
    /// Combines attested off-chain stats with on-chain reputation.
    function valueShard(bytes32 shardId) external view returns (uint256) {
        Attestation memory a = attestations[shardId];
        require(a.timestamp > 0, "No attestation");
        require(block.timestamp <= a.timestamp + ATTESTATION_TTL, "Attestation expired");

        uint256 value = BASE_VALUE;

        // Level bonus (level 1 = 0 bonus, level 100 = 99 * LEVEL_BONUS)
        value += (a.level - 1) * LEVEL_BONUS;

        // ELO bonus (only above 1200 baseline)
        if (a.elo > 1200) {
            value += (a.elo - 1200) * ELO_BONUS_PER_POINT;
        }

        // On-chain reputation bonus from SiphonIdentity
        uint256 tokenId = identity.getTokenByGenome(registry.getShard(shardId).genomeHash);
        if (tokenId != 0) {
            int256 rep = identity.getReputation(tokenId);
            if (rep > 0) {
                value += uint256(rep) * REP_BONUS_PER_POINT;
            }
        }

        return value;
    }

    /// @notice Check if a shard has a valid (non-expired) attestation.
    function hasValidAttestation(bytes32 shardId) external view returns (bool) {
        Attestation memory a = attestations[shardId];
        return a.timestamp > 0 && block.timestamp <= a.timestamp + ATTESTATION_TTL;
    }

    /// @notice Get the attestation for a shard.
    function getAttestation(bytes32 shardId) external view returns (Attestation memory) {
        return attestations[shardId];
    }
}
