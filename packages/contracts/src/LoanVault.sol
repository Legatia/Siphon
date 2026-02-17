// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ShardRegistry.sol";
import "./ShardValuation.sol";

/// @title LoanVault
/// @notice Agent-as-collateral lending protocol. Borrowers pledge shards as collateral,
/// lenders fund loans with ETH. If the borrower defaults, the lender seizes the shard.
contract LoanVault {
    enum LoanState { None, Listed, Funded, Repaid, Liquidated, Cancelled }

    struct Loan {
        bytes32 loanId;
        bytes32 shardId;
        address borrower;
        address lender;
        uint256 principal;        // ETH amount borrowed
        uint256 interestBps;      // interest in basis points (e.g. 500 = 5%)
        uint256 duration;         // loan duration in seconds
        uint256 fundedAt;         // timestamp when lender funded
        uint256 collateralValue;  // valuation snapshot at creation
        LoanState state;
    }

    ShardRegistry public immutable registry;
    ShardValuation public immutable valuation;

    /// @dev Maximum loan-to-value ratio in basis points (7000 = 70%)
    uint256 public constant MAX_LTV_BPS = 7000;

    /// @dev Maximum interest rate in basis points (5000 = 50%)
    uint256 public constant MAX_INTEREST_BPS = 5000;

    /// @dev Grace period after loan expiry before liquidation is allowed
    uint256 public constant GRACE_PERIOD = 1 days;

    /// @dev Protocol fee in basis points on interest (500 = 5%)
    uint256 public constant PROTOCOL_FEE_BPS = 500;

    mapping(bytes32 => Loan) public loans;
    uint256 public protocolFees;
    address public governance;

    event LoanListed(bytes32 indexed loanId, bytes32 indexed shardId, address indexed borrower, uint256 principal, uint256 interestBps, uint256 duration);
    event LoanFunded(bytes32 indexed loanId, address indexed lender, uint256 principal);
    event LoanRepaid(bytes32 indexed loanId, uint256 totalRepaid);
    event LoanLiquidated(bytes32 indexed loanId, address indexed lender, bytes32 indexed shardId);
    event LoanCancelled(bytes32 indexed loanId);

    modifier onlyGovernance() {
        require(msg.sender == governance, "Not governance");
        _;
    }

    constructor(address _registry, address _valuation) {
        registry = ShardRegistry(_registry);
        valuation = ShardValuation(_valuation);
        governance = msg.sender;
    }

    /// @notice List a shard as collateral for a loan. The shard gets locked.
    /// @param loanId Unique identifier for this loan
    /// @param shardId The shard to pledge as collateral
    /// @param principal How much ETH the borrower wants to borrow
    /// @param interestBps Interest rate in basis points
    /// @param duration Loan duration in seconds
    function createLoan(
        bytes32 loanId,
        bytes32 shardId,
        uint256 principal,
        uint256 interestBps,
        uint256 duration
    ) external {
        require(loans[loanId].state == LoanState.None, "Loan ID exists");
        require(principal > 0, "Zero principal");
        require(interestBps <= MAX_INTEREST_BPS, "Interest too high");
        require(duration >= 1 hours, "Duration too short");
        require(duration <= 365 days, "Duration too long");

        // Verify caller owns the shard
        require(registry.getOwner(shardId) == msg.sender, "Not shard owner");

        // Get valuation
        uint256 shardValue = valuation.valueShard(shardId);
        require(shardValue > 0, "Shard has no value");

        // Check LTV: principal must be <= MAX_LTV_BPS% of shard value
        uint256 maxBorrow = (shardValue * MAX_LTV_BPS) / 10000;
        require(principal <= maxBorrow, "Exceeds max LTV");

        // Lock the shard (requires borrower to have approved this contract)
        registry.lockShard(shardId);

        loans[loanId] = Loan({
            loanId: loanId,
            shardId: shardId,
            borrower: msg.sender,
            lender: address(0),
            principal: principal,
            interestBps: interestBps,
            duration: duration,
            fundedAt: 0,
            collateralValue: shardValue,
            state: LoanState.Listed
        });

        emit LoanListed(loanId, shardId, msg.sender, principal, interestBps, duration);
    }

    /// @notice Fund a listed loan. Lender sends ETH equal to the principal.
    function fundLoan(bytes32 loanId) external payable {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Listed, "Loan not listed");
        require(msg.value == loan.principal, "Wrong amount");
        require(msg.sender != loan.borrower, "Cannot fund own loan");

        loan.lender = msg.sender;
        loan.fundedAt = block.timestamp;
        loan.state = LoanState.Funded;

        // Transfer principal to borrower
        (bool sent, ) = loan.borrower.call{value: msg.value}("");
        require(sent, "Transfer to borrower failed");

        emit LoanFunded(loanId, msg.sender, msg.value);
    }

    /// @notice Repay a funded loan. Borrower pays principal + interest.
    /// The shard gets unlocked and returned to the borrower.
    function repayLoan(bytes32 loanId) external payable {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Funded, "Loan not active");
        require(msg.sender == loan.borrower, "Not borrower");

        uint256 interest = (loan.principal * loan.interestBps) / 10000;
        uint256 totalDue = loan.principal + interest;
        require(msg.value >= totalDue, "Insufficient repayment");

        loan.state = LoanState.Repaid;

        // Calculate protocol fee from interest
        uint256 fee = (interest * PROTOCOL_FEE_BPS) / 10000;
        protocolFees += fee;

        // Pay lender (principal + interest - fee)
        uint256 lenderPayout = totalDue - fee;
        (bool sent, ) = loan.lender.call{value: lenderPayout}("");
        require(sent, "Transfer to lender failed");

        // Refund overpayment
        if (msg.value > totalDue) {
            (bool refunded, ) = msg.sender.call{value: msg.value - totalDue}("");
            require(refunded, "Refund failed");
        }

        // Unlock the shard
        registry.unlockShard(loan.shardId);

        emit LoanRepaid(loanId, totalDue);
    }

    /// @notice Liquidate a defaulted loan. Lender seizes the shard.
    /// Only callable after loan duration + grace period has elapsed.
    function liquidate(bytes32 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Funded, "Loan not active");
        require(msg.sender == loan.lender, "Not lender");
        require(
            block.timestamp >= loan.fundedAt + loan.duration + GRACE_PERIOD,
            "Loan not yet defaulted"
        );

        loan.state = LoanState.Liquidated;

        // Seize the shard — transfers ownership to lender and unlocks
        registry.seize(loan.shardId, loan.lender);

        emit LoanLiquidated(loanId, loan.lender, loan.shardId);
    }

    /// @notice Cancel an unfunded loan listing. Only the borrower can cancel.
    function cancelLoan(bytes32 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.state == LoanState.Listed, "Cannot cancel");
        require(msg.sender == loan.borrower, "Not borrower");

        loan.state = LoanState.Cancelled;

        // Unlock the shard
        registry.unlockShard(loan.shardId);

        emit LoanCancelled(loanId);
    }

    /// @notice Withdraw accumulated protocol fees.
    function withdrawFees() external onlyGovernance {
        uint256 amount = protocolFees;
        require(amount > 0, "No fees");
        protocolFees = 0;

        (bool sent, ) = governance.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    /// @notice Get the total repayment amount for a loan.
    function getRepaymentAmount(bytes32 loanId) external view returns (uint256) {
        Loan memory loan = loans[loanId];
        uint256 interest = (loan.principal * loan.interestBps) / 10000;
        return loan.principal + interest;
    }

    /// @notice Check if a loan is past due (expired but not yet in grace period).
    function isExpired(bytes32 loanId) external view returns (bool) {
        Loan memory loan = loans[loanId];
        if (loan.state != LoanState.Funded) return false;
        return block.timestamp >= loan.fundedAt + loan.duration;
    }

    /// @notice Check if a loan is liquidatable (past due + grace period).
    function isLiquidatable(bytes32 loanId) external view returns (bool) {
        Loan memory loan = loans[loanId];
        if (loan.state != LoanState.Funded) return false;
        return block.timestamp >= loan.fundedAt + loan.duration + GRACE_PERIOD;
    }

    /// @notice Get loan details.
    function getLoan(bytes32 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    receive() external payable {}
}
