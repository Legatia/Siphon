// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ShardRegistry.sol";

contract ShardMarketplace {
    struct Listing {
        address seller;
        uint256 price;
        uint256 listedAt;
    }

    uint256 public constant FEE_BPS = 250; // 2.5%

    ShardRegistry public immutable registry;
    address public governance;
    uint256 public accumulatedFees;

    mapping(bytes32 => Listing) public listings;

    event ShardListed(bytes32 indexed shardId, address indexed seller, uint256 price);
    event ShardSold(bytes32 indexed shardId, address indexed seller, address indexed buyer, uint256 price, uint256 fee);
    event ListingCancelled(bytes32 indexed shardId, address indexed seller);
    event FeesWithdrawn(address indexed to, uint256 amount);

    modifier onlyGovernance() {
        require(msg.sender == governance, "Not governance");
        _;
    }

    constructor(address _registry) {
        require(_registry != address(0), "Invalid registry");
        registry = ShardRegistry(_registry);
        governance = msg.sender;
    }

    function listShard(bytes32 shardId, uint256 price) external {
        require(price > 0, "Price must be > 0");
        require(listings[shardId].seller == address(0), "Already listed");
        require(registry.getOwner(shardId) == msg.sender, "Not shard owner");

        // Lock the shard via registry (marketplace must be approved as locker)
        registry.lockShard(shardId);

        listings[shardId] = Listing({
            seller: msg.sender,
            price: price,
            listedAt: block.timestamp
        });

        emit ShardListed(shardId, msg.sender, price);
    }

    function buyShard(bytes32 shardId) external payable {
        Listing memory listing = listings[shardId];
        require(listing.seller != address(0), "Not listed");
        require(msg.value == listing.price, "Wrong price");
        require(msg.sender != listing.seller, "Cannot buy own shard");

        // Calculate fee
        uint256 fee = (listing.price * FEE_BPS) / 10000;
        uint256 sellerProceeds = listing.price - fee;
        accumulatedFees += fee;

        // Delete listing before external calls
        delete listings[shardId];

        // Seize transfers ownership and unlocks
        registry.seize(shardId, msg.sender);

        // Pay seller
        (bool sent, ) = listing.seller.call{value: sellerProceeds}("");
        require(sent, "Payment failed");

        emit ShardSold(shardId, listing.seller, msg.sender, listing.price, fee);
    }

    function cancelListing(bytes32 shardId) external {
        Listing memory listing = listings[shardId];
        require(listing.seller == msg.sender, "Not the seller");

        delete listings[shardId];

        // Unlock the shard
        registry.unlockShard(shardId);

        emit ListingCancelled(shardId, msg.sender);
    }

    function getListing(bytes32 shardId) external view returns (Listing memory) {
        return listings[shardId];
    }

    function withdrawFees() external onlyGovernance {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");

        accumulatedFees = 0;
        (bool sent, ) = governance.call{value: amount}("");
        require(sent, "Withdrawal failed");

        emit FeesWithdrawn(governance, amount);
    }

    receive() external payable {}
}
