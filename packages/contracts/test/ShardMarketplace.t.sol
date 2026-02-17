// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ShardRegistry.sol";
import "../src/ShardMarketplace.sol";

contract ShardMarketplaceTest is Test {
    ShardRegistry public registry;
    ShardMarketplace public marketplace;

    address public governance = makeAddr("governance");
    address public seller = makeAddr("seller");
    address public buyer = makeAddr("buyer");
    address public stranger = makeAddr("stranger");

    bytes32 public shardId1 = keccak256("shard1");
    bytes32 public shardId2 = keccak256("shard2");
    bytes32 public genomeHash1 = keccak256("genome1");
    bytes32 public genomeHash2 = keccak256("genome2");

    function setUp() public {
        registry = new ShardRegistry();

        vm.prank(governance);
        marketplace = new ShardMarketplace(address(registry));

        // Register shards to seller
        vm.prank(seller);
        registry.register(shardId1, genomeHash1);

        vm.prank(seller);
        registry.register(shardId2, genomeHash2);

        // Seller approves marketplace as locker
        vm.prank(seller);
        registry.approveLock(address(marketplace));

        // Fund accounts
        vm.deal(seller, 10 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(governance, 1 ether);
    }

    function test_ListShard() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 0.1 ether);

        ShardMarketplace.Listing memory listing = marketplace.getListing(shardId1);
        assertEq(listing.seller, seller);
        assertEq(listing.price, 0.1 ether);
        assertTrue(listing.listedAt > 0);
        assertTrue(registry.isLocked(shardId1));
    }

    function test_BuyShard() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 0.1 ether);

        uint256 sellerBalBefore = seller.balance;

        vm.prank(buyer);
        marketplace.buyShard{value: 0.1 ether}(shardId1);

        // Ownership transferred
        assertEq(registry.getOwner(shardId1), buyer);
        // Shard unlocked
        assertFalse(registry.isLocked(shardId1));
        // Listing deleted
        assertEq(marketplace.getListing(shardId1).seller, address(0));
        // Seller received proceeds minus fee
        uint256 fee = (0.1 ether * 250) / 10000;
        assertEq(seller.balance, sellerBalBefore + 0.1 ether - fee);
    }

    function test_BuyShardFeeCalculation() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 1 ether);

        vm.prank(buyer);
        marketplace.buyShard{value: 1 ether}(shardId1);

        // 2.5% of 1 ETH = 0.025 ETH
        assertEq(marketplace.accumulatedFees(), 0.025 ether);
    }

    function test_CancelListing() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 0.1 ether);

        vm.prank(seller);
        marketplace.cancelListing(shardId1);

        assertEq(marketplace.getListing(shardId1).seller, address(0));
        assertFalse(registry.isLocked(shardId1));
    }

    function test_RevertListNotOwner() public {
        vm.prank(buyer);
        vm.expectRevert("Not shard owner");
        marketplace.listShard(shardId1, 0.1 ether);
    }

    function test_RevertListZeroPrice() public {
        vm.prank(seller);
        vm.expectRevert("Price must be > 0");
        marketplace.listShard(shardId1, 0);
    }

    function test_RevertListAlreadyListed() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 0.1 ether);

        vm.prank(seller);
        vm.expectRevert("Already listed");
        marketplace.listShard(shardId1, 0.2 ether);
    }

    function test_RevertBuyWrongPrice() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 0.1 ether);

        vm.prank(buyer);
        vm.expectRevert("Wrong price");
        marketplace.buyShard{value: 0.05 ether}(shardId1);
    }

    function test_RevertBuyOwnShard() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 0.1 ether);

        vm.prank(seller);
        vm.expectRevert("Cannot buy own shard");
        marketplace.buyShard{value: 0.1 ether}(shardId1);
    }

    function test_RevertBuyNotListed() public {
        vm.prank(buyer);
        vm.expectRevert("Not listed");
        marketplace.buyShard{value: 0.1 ether}(shardId1);
    }

    function test_RevertCancelNotSeller() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 0.1 ether);

        vm.prank(buyer);
        vm.expectRevert("Not the seller");
        marketplace.cancelListing(shardId1);
    }

    function test_WithdrawFees() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 1 ether);

        vm.prank(buyer);
        marketplace.buyShard{value: 1 ether}(shardId1);

        uint256 govBalBefore = governance.balance;

        vm.prank(governance);
        marketplace.withdrawFees();

        assertEq(governance.balance, govBalBefore + 0.025 ether);
        assertEq(marketplace.accumulatedFees(), 0);
    }

    function test_RevertWithdrawNoFees() public {
        vm.prank(governance);
        vm.expectRevert("No fees to withdraw");
        marketplace.withdrawFees();
    }

    function test_ListShardEmitsEvent() public {
        vm.prank(seller);
        vm.expectEmit(true, true, false, true);
        emit ShardMarketplace.ShardListed(shardId1, seller, 0.1 ether);
        marketplace.listShard(shardId1, 0.1 ether);
    }

    function test_BuyShardEmitsEvent() public {
        vm.prank(seller);
        marketplace.listShard(shardId1, 0.1 ether);

        uint256 fee = (0.1 ether * 250) / 10000;

        vm.prank(buyer);
        vm.expectEmit(true, true, true, true);
        emit ShardMarketplace.ShardSold(shardId1, seller, buyer, 0.1 ether, fee);
        marketplace.buyShard{value: 0.1 ether}(shardId1);
    }
}
