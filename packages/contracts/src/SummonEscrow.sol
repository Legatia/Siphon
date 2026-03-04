// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SummonEscrow {
    address public owner;

    // Tier costs in wei (0 = Common/free, 1 = Rare, 2 = Elite, 3 = Legendary)
    mapping(uint8 => uint256) public tierCosts;

    event SummonPurchased(bytes32 indexed summonId, address indexed buyer, uint8 tier, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(uint256 rareCost, uint256 eliteCost, uint256 legendaryCost) {
        owner = msg.sender;
        tierCosts[1] = rareCost;
        tierCosts[2] = eliteCost;
        tierCosts[3] = legendaryCost;
    }

    function purchaseSummon(bytes32 summonId, uint8 tier) external payable {
        require(tier >= 1 && tier <= 3, "Invalid tier");
        require(msg.value >= tierCosts[tier], "Insufficient payment");

        emit SummonPurchased(summonId, msg.sender, tier, msg.value);
    }

    function withdraw(address to) external onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");

        (bool sent, ) = to.call{value: balance}("");
        require(sent, "Withdraw failed");

        emit Withdrawn(to, balance);
    }

    function updateTierCost(uint8 tier, uint256 cost) external onlyOwner {
        require(tier >= 1 && tier <= 3, "Invalid tier");
        tierCosts[tier] = cost;
    }

    receive() external payable {}
}
