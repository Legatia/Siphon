// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BattleSettlement {
    enum BattleState { None, Created, Joined, Settled, Disputed, Resolved }

    struct BattleRecord {
        bytes32 battleId;
        address challenger;
        address defender;
        uint256 stakeAmount;
        BattleState state;
        address winner;
        uint256 createdAt;
    }

    mapping(bytes32 => BattleRecord) public battles;
    address public arbiter;

    event BattleCreated(bytes32 indexed battleId, address indexed challenger, address indexed defender, uint256 stake);
    event BattleJoined(bytes32 indexed battleId, address indexed defender);
    event BattleSettled(bytes32 indexed battleId, address indexed winner, uint256 payout);
    event BattleDisputed(bytes32 indexed battleId, address indexed disputedBy);
    event DisputeResolved(bytes32 indexed battleId, address indexed winner, uint256 payout);

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
            createdAt: block.timestamp
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

    function settle(bytes32 battleId, address winner) external onlyArbiter {
        BattleRecord storage b = battles[battleId];
        require(b.state == BattleState.Joined, "Battle not active");
        require(
            winner == b.challenger || winner == b.defender || winner == address(0),
            "Invalid winner"
        );

        b.state = BattleState.Settled;
        b.winner = winner;

        uint256 totalStake = b.stakeAmount * 2;

        if (winner == address(0)) {
            // Draw: refund both
            (bool s1, ) = b.challenger.call{value: b.stakeAmount}("");
            (bool s2, ) = b.defender.call{value: b.stakeAmount}("");
            require(s1 && s2, "Refund failed");
            emit BattleSettled(battleId, address(0), 0);
        } else {
            (bool sent, ) = winner.call{value: totalStake}("");
            require(sent, "Payout failed");
            emit BattleSettled(battleId, winner, totalStake);
        }
    }

    function dispute(bytes32 battleId) external {
        BattleRecord storage b = battles[battleId];
        require(b.state == BattleState.Settled, "Cannot dispute");
        require(
            msg.sender == b.challenger || msg.sender == b.defender,
            "Not a participant"
        );

        b.state = BattleState.Disputed;

        emit BattleDisputed(battleId, msg.sender);
    }

    function resolveDispute(bytes32 battleId, address winner) external onlyArbiter {
        BattleRecord storage b = battles[battleId];
        require(b.state == BattleState.Disputed, "Not disputed");
        require(
            winner == b.challenger || winner == b.defender,
            "Invalid winner"
        );

        b.state = BattleState.Resolved;
        b.winner = winner;

        emit DisputeResolved(battleId, winner, 0);
    }

    function getBattle(bytes32 battleId) external view returns (BattleRecord memory) {
        return battles[battleId];
    }

    receive() external payable {}
}
