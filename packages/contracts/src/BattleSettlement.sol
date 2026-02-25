// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BattleSettlement {
    enum BattleState { None, Created, Joined, Settled, Disputed, Resolved, Cancelled }

    uint256 public constant JOIN_TIMEOUT = 1 days;
    uint256 public constant DISPUTE_WINDOW = 1 hours;

    struct BattleRecord {
        bytes32 battleId;
        address challenger;
        address defender;
        uint256 stakeAmount;
        BattleState state;
        address winner;
        uint256 createdAt;
        uint256 settledAt;
    }

    mapping(bytes32 => BattleRecord) public battles;
    address public arbiter;

    event BattleCreated(bytes32 indexed battleId, address indexed challenger, address indexed defender, uint256 stake);
    event BattleJoined(bytes32 indexed battleId, address indexed defender);
    event BattleSettled(bytes32 indexed battleId, address indexed winner, uint256 payout);
    event BattleDisputed(bytes32 indexed battleId, address indexed disputedBy);
    event DisputeResolved(bytes32 indexed battleId, address indexed winner, uint256 payout);
    event BattleCancelled(bytes32 indexed battleId, address indexed challenger, uint256 refund);

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Not arbiter");
        _;
    }

    constructor() {
        arbiter = msg.sender;
    }

    function createBattle(bytes32 battleId, address defender) external payable {
        require(battles[battleId].state == BattleState.None, "Battle exists");
        require(msg.value > 0, "Stake required");
        require(defender != address(0), "Invalid defender");
        require(defender != msg.sender, "Cannot battle self");

        battles[battleId] = BattleRecord({
            battleId: battleId,
            challenger: msg.sender,
            defender: defender,
            stakeAmount: msg.value,
            state: BattleState.Created,
            winner: address(0),
            createdAt: block.timestamp,
            settledAt: 0
        });

        emit BattleCreated(battleId, msg.sender, defender, msg.value);
    }

    function joinBattle(bytes32 battleId) external payable {
        BattleRecord storage b = battles[battleId];
        require(b.state == BattleState.Created, "Cannot join");
        require(msg.sender == b.defender, "Not the defender");
        require(msg.value == b.stakeAmount, "Stake mismatch");

        b.state = BattleState.Joined;

        emit BattleJoined(battleId, msg.sender);
    }

    /// @notice Cancel a battle if defender never joins within JOIN_TIMEOUT.
    function cancelUnjoined(bytes32 battleId) external {
        BattleRecord storage b = battles[battleId];
        require(b.state == BattleState.Created, "Battle not cancellable");
        require(msg.sender == b.challenger, "Not challenger");
        require(block.timestamp >= b.createdAt + JOIN_TIMEOUT, "Join timeout not elapsed");

        b.state = BattleState.Cancelled;
        uint256 refund = b.stakeAmount;

        (bool sent, ) = b.challenger.call{value: refund}("");
        require(sent, "Refund failed");

        emit BattleCancelled(battleId, b.challenger, refund);
    }

    function settle(bytes32 battleId, address winner) external onlyArbiter {
        BattleRecord storage b = battles[battleId];
        require(b.state == BattleState.Joined, "Battle not active");
        require(
            winner == b.challenger || winner == b.defender || winner == address(0),
            "Invalid winner"
        );

        b.state = BattleState.Settled;
        b.winner = winner;
        b.settledAt = block.timestamp;
        emit BattleSettled(battleId, winner, 0);
    }

    function dispute(bytes32 battleId) external {
        BattleRecord storage b = battles[battleId];
        require(b.state == BattleState.Settled, "Cannot dispute");
        require(
            msg.sender == b.challenger || msg.sender == b.defender,
            "Not a participant"
        );
        require(block.timestamp <= b.settledAt + DISPUTE_WINDOW, "Dispute window closed");

        b.state = BattleState.Disputed;

        emit BattleDisputed(battleId, msg.sender);
    }

    /// @notice Finalize an undisputed settlement after dispute window and release payout.
    function finalizeSettlement(bytes32 battleId) external {
        BattleRecord storage b = battles[battleId];
        require(b.state == BattleState.Settled, "Not settle-pending");
        require(block.timestamp > b.settledAt + DISPUTE_WINDOW, "Dispute window open");
        _resolveAndPayout(b, battleId);
    }

    function resolveDispute(bytes32 battleId, address winner) external onlyArbiter {
        BattleRecord storage b = battles[battleId];
        require(b.state == BattleState.Disputed, "Not disputed");
        require(
            winner == b.challenger || winner == b.defender || winner == address(0),
            "Invalid winner"
        );
        b.winner = winner;
        _resolveAndPayout(b, battleId);
    }

    function getBattle(bytes32 battleId) external view returns (BattleRecord memory) {
        return battles[battleId];
    }

    function _resolveAndPayout(BattleRecord storage b, bytes32 battleId) internal {
        b.state = BattleState.Resolved;
        uint256 totalStake = b.stakeAmount * 2;

        if (b.winner == address(0)) {
            (bool s1, ) = b.challenger.call{value: b.stakeAmount}("");
            (bool s2, ) = b.defender.call{value: b.stakeAmount}("");
            require(s1 && s2, "Refund failed");
            emit DisputeResolved(battleId, address(0), 0);
            return;
        }

        (bool sent, ) = b.winner.call{value: totalStake}("");
        require(sent, "Payout failed");
        emit DisputeResolved(battleId, b.winner, totalStake);
    }

    receive() external payable {}
}
