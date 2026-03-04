// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SummonEscrow.sol";

contract SummonEscrowTest is Test {
    SummonEscrow public escrow;

    address public deployer = makeAddr("deployer");
    address public buyer = makeAddr("buyer");
    address public stranger = makeAddr("stranger");
    address public treasury = makeAddr("treasury");

    bytes32 public summonId1 = keccak256("summon1");
    bytes32 public summonId2 = keccak256("summon2");

    uint256 public rareCost = 0.005 ether;
    uint256 public eliteCost = 0.02 ether;
    uint256 public legendaryCost = 0.05 ether;

    function setUp() public {
        vm.prank(deployer);
        escrow = new SummonEscrow(rareCost, eliteCost, legendaryCost);
        vm.deal(buyer, 10 ether);
    }

    function test_PurchaseRareTier() public {
        vm.prank(buyer);
        escrow.purchaseSummon{value: rareCost}(summonId1, 1);
        assertEq(address(escrow).balance, rareCost);
    }

    function test_PurchaseEliteTier() public {
        vm.prank(buyer);
        escrow.purchaseSummon{value: eliteCost}(summonId1, 2);
        assertEq(address(escrow).balance, eliteCost);
    }

    function test_PurchaseLegendaryTier() public {
        vm.prank(buyer);
        escrow.purchaseSummon{value: legendaryCost}(summonId1, 3);
        assertEq(address(escrow).balance, legendaryCost);
    }

    function test_EmitsSummonPurchasedEvent() public {
        vm.prank(buyer);
        vm.expectEmit(true, true, false, true);
        emit SummonEscrow.SummonPurchased(summonId1, buyer, 1, rareCost);
        escrow.purchaseSummon{value: rareCost}(summonId1, 1);
    }

    function test_RevertInvalidTierZero() public {
        vm.prank(buyer);
        vm.expectRevert("Invalid tier");
        escrow.purchaseSummon{value: rareCost}(summonId1, 0);
    }

    function test_RevertInvalidTierFour() public {
        vm.prank(buyer);
        vm.expectRevert("Invalid tier");
        escrow.purchaseSummon{value: rareCost}(summonId1, 4);
    }

    function test_RevertInsufficientPayment() public {
        vm.prank(buyer);
        vm.expectRevert("Insufficient payment");
        escrow.purchaseSummon{value: 0.001 ether}(summonId1, 1);
    }

    function test_RevertZeroPayment() public {
        vm.prank(buyer);
        vm.expectRevert("Insufficient payment");
        escrow.purchaseSummon(summonId1, 1);
    }

    function test_WithdrawByOwner() public {
        vm.prank(buyer);
        escrow.purchaseSummon{value: eliteCost}(summonId1, 2);

        uint256 treasuryBefore = treasury.balance;

        vm.prank(deployer);
        escrow.withdraw(treasury);

        assertEq(treasury.balance, treasuryBefore + eliteCost);
        assertEq(address(escrow).balance, 0);
    }

    function test_RevertWithdrawNotOwner() public {
        vm.prank(buyer);
        escrow.purchaseSummon{value: rareCost}(summonId1, 1);

        vm.prank(stranger);
        vm.expectRevert("Not owner");
        escrow.withdraw(treasury);
    }

    function test_RevertWithdrawZeroBalance() public {
        vm.prank(deployer);
        vm.expectRevert("No balance");
        escrow.withdraw(treasury);
    }

    function test_RevertWithdrawToZeroAddress() public {
        vm.prank(buyer);
        escrow.purchaseSummon{value: rareCost}(summonId1, 1);

        vm.prank(deployer);
        vm.expectRevert("Invalid address");
        escrow.withdraw(address(0));
    }

    function test_UpdateTierCost() public {
        vm.prank(deployer);
        escrow.updateTierCost(1, 0.01 ether);
        assertEq(escrow.tierCosts(1), 0.01 ether);
    }

    function test_RevertUpdateTierCostNotOwner() public {
        vm.prank(stranger);
        vm.expectRevert("Not owner");
        escrow.updateTierCost(1, 0.01 ether);
    }

    function test_MultiplePurchases() public {
        vm.startPrank(buyer);
        escrow.purchaseSummon{value: rareCost}(summonId1, 1);
        escrow.purchaseSummon{value: eliteCost}(summonId2, 2);
        vm.stopPrank();

        assertEq(address(escrow).balance, rareCost + eliteCost);
    }

    function test_OverpaymentAccepted() public {
        vm.prank(buyer);
        escrow.purchaseSummon{value: 1 ether}(summonId1, 1);
        assertEq(address(escrow).balance, 1 ether);
    }
}
