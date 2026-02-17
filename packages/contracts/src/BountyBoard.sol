// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BountyBoard {
    enum BountyState { None, Open, Claimed, Completed, Cancelled, Disputed }

    struct Bounty {
        bytes32 bountyId;
        address poster;
        address claimant;
        bytes32 claimantShardOrSwarmId;
        uint256 reward;
        string description;
        uint256 deadline;
        BountyState state;
        uint256 createdAt;
    }

    address public arbiter;
    mapping(bytes32 => Bounty) public bounties;

    event BountyPosted(bytes32 indexed bountyId, address indexed poster, uint256 reward, uint256 deadline);
    event BountyClaimed(bytes32 indexed bountyId, address indexed claimant, bytes32 shardOrSwarmId);
    event BountyCompleted(bytes32 indexed bountyId, address indexed claimant, uint256 reward);
    event BountyCancelled(bytes32 indexed bountyId, address indexed poster, uint256 refund);
    event BountyDisputed(bytes32 indexed bountyId, address indexed disputedBy);

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Not arbiter");
        _;
    }

    constructor(address _arbiter) {
        require(_arbiter != address(0), "Invalid arbiter");
        arbiter = _arbiter;
    }

    function postBounty(bytes32 bountyId, string calldata description, uint256 deadline) external payable {
        require(bounties[bountyId].state == BountyState.None, "Bounty exists");
        require(msg.value > 0, "Reward required");
        require(deadline > block.timestamp, "Deadline must be in the future");

        bounties[bountyId] = Bounty({
            bountyId: bountyId,
            poster: msg.sender,
            claimant: address(0),
            claimantShardOrSwarmId: bytes32(0),
            reward: msg.value,
            description: description,
            deadline: deadline,
            state: BountyState.Open,
            createdAt: block.timestamp
        });

        emit BountyPosted(bountyId, msg.sender, msg.value, deadline);
    }

    function claimBounty(bytes32 bountyId, bytes32 shardOrSwarmId) external {
        Bounty storage b = bounties[bountyId];
        require(b.state == BountyState.Open, "Bounty not open");
        require(msg.sender != b.poster, "Poster cannot claim");

        b.claimant = msg.sender;
        b.claimantShardOrSwarmId = shardOrSwarmId;
        b.state = BountyState.Claimed;

        emit BountyClaimed(bountyId, msg.sender, shardOrSwarmId);
    }

    function completeBounty(bytes32 bountyId) external onlyArbiter {
        Bounty storage b = bounties[bountyId];
        require(b.state == BountyState.Claimed || b.state == BountyState.Disputed, "Cannot complete");

        uint256 reward = b.reward;
        address claimant = b.claimant;
        b.state = BountyState.Completed;

        (bool sent, ) = claimant.call{value: reward}("");
        require(sent, "Payout failed");

        emit BountyCompleted(bountyId, claimant, reward);
    }

    function cancelBounty(bytes32 bountyId) external {
        Bounty storage b = bounties[bountyId];
        require(b.poster == msg.sender, "Not the poster");
        require(b.state == BountyState.Open, "Cannot cancel");

        uint256 refund = b.reward;
        b.state = BountyState.Cancelled;

        (bool sent, ) = msg.sender.call{value: refund}("");
        require(sent, "Refund failed");

        emit BountyCancelled(bountyId, msg.sender, refund);
    }

    function disputeBounty(bytes32 bountyId) external {
        Bounty storage b = bounties[bountyId];
        require(b.state == BountyState.Claimed, "Cannot dispute");
        require(
            msg.sender == b.poster || msg.sender == b.claimant,
            "Not a participant"
        );

        b.state = BountyState.Disputed;

        emit BountyDisputed(bountyId, msg.sender);
    }

    function getBounty(bytes32 bountyId) external view returns (Bounty memory) {
        return bounties[bountyId];
    }

    receive() external payable {}
}
