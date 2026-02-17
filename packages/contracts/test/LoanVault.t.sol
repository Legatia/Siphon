// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/ShardRegistry.sol";
import "../src/SiphonIdentity.sol";
import "../src/ShardValuation.sol";
import "../src/LoanVault.sol";

contract LoanVaultTest is Test {
    ShardRegistry public registry;
    SiphonIdentity public identity;
    ShardValuation public valuation;
    LoanVault public vault;

    address public governance = makeAddr("governance");
    address public keeper = makeAddr("keeper");
    address public borrower = makeAddr("borrower");
    address public lender = makeAddr("lender");

    bytes32 public shardId1 = keccak256("shard1");
    bytes32 public genomeHash1 = keccak256("genome1");
    bytes32 public loanId1 = keccak256("loan1");

    function setUp() public {
        registry = new ShardRegistry();
        identity = new SiphonIdentity();

        vm.prank(governance);
        valuation = new ShardValuation(address(registry), address(identity));

        vm.prank(governance);
        vault = new LoanVault(address(registry), address(valuation));

        // Setup keeper
        vm.prank(governance);
        valuation.approveKeeper(keeper);

        // Borrower registers shard
        vm.prank(borrower);
        registry.register(shardId1, genomeHash1);

        // Borrower approves vault as locker
        vm.prank(borrower);
        registry.approveLock(address(vault));

        // Keeper attests shard value (level 50, ELO 2000, stats 30)
        // Value = 0.01 + 49*0.002 + 800*0.00001 = 0.01 + 0.098 + 0.008 = 0.116 ether
        vm.prank(keeper);
        valuation.attest(shardId1, 50, 2000, 30);

        // Fund borrower and lender
        vm.deal(borrower, 10 ether);
        vm.deal(lender, 10 ether);
    }

    // --- createLoan ---

    function test_CreateLoan() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        LoanVault.Loan memory loan = vault.getLoan(loanId1);
        assertEq(loan.borrower, borrower);
        assertEq(loan.principal, 0.05 ether);
        assertEq(loan.interestBps, 500);
        assertEq(loan.duration, 30 days);
        assertTrue(loan.state == LoanVault.LoanState.Listed);
        assertTrue(registry.isLocked(shardId1));
    }

    function test_CreateLoanEmitsEvent() public {
        vm.prank(borrower);
        vm.expectEmit(true, true, true, true);
        emit LoanVault.LoanListed(loanId1, shardId1, borrower, 0.05 ether, 500, 30 days);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);
    }

    function test_RevertExceedsLTV() public {
        // Shard value is 0.116 ether, max LTV 70% = 0.0812 ether
        vm.prank(borrower);
        vm.expectRevert("Exceeds max LTV");
        vault.createLoan(loanId1, shardId1, 0.09 ether, 500, 30 days);
    }

    function test_RevertNotShardOwner() public {
        vm.prank(lender);
        vm.expectRevert("Not shard owner");
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);
    }

    function test_RevertZeroPrincipal() public {
        vm.prank(borrower);
        vm.expectRevert("Zero principal");
        vault.createLoan(loanId1, shardId1, 0, 500, 30 days);
    }

    function test_RevertInterestTooHigh() public {
        vm.prank(borrower);
        vm.expectRevert("Interest too high");
        vault.createLoan(loanId1, shardId1, 0.05 ether, 6000, 30 days);
    }

    function test_RevertDurationTooShort() public {
        vm.prank(borrower);
        vm.expectRevert("Duration too short");
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 minutes);
    }

    // --- fundLoan ---

    function test_FundLoan() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        uint256 borrowerBalBefore = borrower.balance;

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        LoanVault.Loan memory loan = vault.getLoan(loanId1);
        assertEq(loan.lender, lender);
        assertTrue(loan.state == LoanVault.LoanState.Funded);
        assertEq(borrower.balance, borrowerBalBefore + 0.05 ether);
    }

    function test_FundLoanEmitsEvent() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vm.expectEmit(true, true, false, true);
        emit LoanVault.LoanFunded(loanId1, lender, 0.05 ether);
        vault.fundLoan{value: 0.05 ether}(loanId1);
    }

    function test_RevertFundWrongAmount() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vm.expectRevert("Wrong amount");
        vault.fundLoan{value: 0.04 ether}(loanId1);
    }

    function test_RevertFundOwnLoan() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(borrower);
        vm.expectRevert("Cannot fund own loan");
        vault.fundLoan{value: 0.05 ether}(loanId1);
    }

    // --- repayLoan ---

    function test_RepayLoan() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        // Repay: 0.05 + 5% = 0.0525 ether
        uint256 repayment = vault.getRepaymentAmount(loanId1);
        assertEq(repayment, 0.0525 ether);

        uint256 lenderBalBefore = lender.balance;

        vm.prank(borrower);
        vault.repayLoan{value: repayment}(loanId1);

        LoanVault.Loan memory loan = vault.getLoan(loanId1);
        assertTrue(loan.state == LoanVault.LoanState.Repaid);
        assertFalse(registry.isLocked(shardId1));
        assertEq(registry.getOwner(shardId1), borrower);

        // Lender gets principal + interest - protocol fee
        // Interest = 0.0025 ether, fee = 5% of interest = 0.000125 ether
        // Lender payout = 0.0525 - 0.000125 = 0.052375 ether
        assertEq(lender.balance, lenderBalBefore + 0.052375 ether);
    }

    function test_RepayLoanProtocolFees() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        uint256 repayment = vault.getRepaymentAmount(loanId1);

        vm.prank(borrower);
        vault.repayLoan{value: repayment}(loanId1);

        // Protocol fee = 5% of 0.0025 = 0.000125 ether
        assertEq(vault.protocolFees(), 0.000125 ether);
    }

    function test_RevertRepayNotBorrower() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        vm.prank(lender);
        vm.expectRevert("Not borrower");
        vault.repayLoan{value: 0.0525 ether}(loanId1);
    }

    function test_RevertRepayInsufficient() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        vm.prank(borrower);
        vm.expectRevert("Insufficient repayment");
        vault.repayLoan{value: 0.04 ether}(loanId1);
    }

    // --- liquidate ---

    function test_Liquidate() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        // Fast forward past duration + grace period
        vm.warp(block.timestamp + 31 days + 1);

        vm.prank(lender);
        vault.liquidate(loanId1);

        LoanVault.Loan memory loan = vault.getLoan(loanId1);
        assertTrue(loan.state == LoanVault.LoanState.Liquidated);

        // Shard now belongs to lender
        assertEq(registry.getOwner(shardId1), lender);
        assertFalse(registry.isLocked(shardId1));
    }

    function test_RevertLiquidateTooEarly() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        // Only fast forward 15 days (loan is 30 days + 1 day grace)
        vm.warp(block.timestamp + 15 days);

        vm.prank(lender);
        vm.expectRevert("Loan not yet defaulted");
        vault.liquidate(loanId1);
    }

    function test_RevertLiquidateNotLender() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        vm.warp(block.timestamp + 31 days + 1);

        vm.prank(borrower);
        vm.expectRevert("Not lender");
        vault.liquidate(loanId1);
    }

    // --- cancelLoan ---

    function test_CancelLoan() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(borrower);
        vault.cancelLoan(loanId1);

        LoanVault.Loan memory loan = vault.getLoan(loanId1);
        assertTrue(loan.state == LoanVault.LoanState.Cancelled);
        assertFalse(registry.isLocked(shardId1));
    }

    function test_RevertCancelFundedLoan() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        vm.prank(borrower);
        vm.expectRevert("Cannot cancel");
        vault.cancelLoan(loanId1);
    }

    function test_RevertCancelNotBorrower() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vm.expectRevert("Not borrower");
        vault.cancelLoan(loanId1);
    }

    // --- View functions ---

    function test_IsExpired() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        assertFalse(vault.isExpired(loanId1));

        vm.warp(block.timestamp + 30 days);
        assertTrue(vault.isExpired(loanId1));
    }

    function test_IsLiquidatable() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        // Expired but in grace period — not liquidatable yet
        vm.warp(block.timestamp + 30 days + 12 hours);
        assertTrue(vault.isExpired(loanId1));
        assertFalse(vault.isLiquidatable(loanId1));

        // Past grace period — liquidatable
        vm.warp(block.timestamp + 1 days);
        assertTrue(vault.isLiquidatable(loanId1));
    }

    // --- withdrawFees ---

    function test_WithdrawFees() public {
        vm.prank(borrower);
        vault.createLoan(loanId1, shardId1, 0.05 ether, 500, 30 days);

        vm.prank(lender);
        vault.fundLoan{value: 0.05 ether}(loanId1);

        vm.prank(borrower);
        vault.repayLoan{value: 0.0525 ether}(loanId1);

        uint256 govBalBefore = governance.balance;

        vm.prank(governance);
        vault.withdrawFees();

        assertEq(governance.balance, govBalBefore + 0.000125 ether);
        assertEq(vault.protocolFees(), 0);
    }

    function test_RevertWithdrawNoFees() public {
        vm.prank(governance);
        vm.expectRevert("No fees");
        vault.withdrawFees();
    }
}
