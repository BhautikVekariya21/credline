// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20
 * @dev Mock interface for ERC20 compliance (USDC/USDT).
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/**
 * @title LiquiditySyndicate
 * @dev Manages USDC/USDT deposits from institutional liquidity providers,
 * loan drawdowns validated by AI risk score Expected Loss formulas, and programmatic yield routing.
 */
contract LiquiditySyndicate {
    // IERC20 token references (e.g., USDC)
    IERC20 public immutable lendingToken;

    // LP Share tracking
    uint256 public totalShares;
    mapping(address => uint256) public shareBalance;

    // Expected Loss Risk parameters
    // Expected Loss (EL) basis points threshold (e.g., 500 bps = 5.0% maximum allowed expected loss ratio of EAD)
    uint256 public expectedLossCapBps = 500; 
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    // Active loan records
    struct Loan {
        address borrower;
        uint256 principal;
        uint256 interestDue;
        uint256 probabilityOfDefaultBps; // PD in bps (e.g., 120 = 1.20% default probability)
        uint256 lossGivenDefaultBps;      // LGD in bps (e.g., 4000 = 40.00% loss given default)
        uint256 expectedLossValue;        // Calculated Expected Loss
        bool active;
        bool repaid;
    }

    uint256 public nextLoanId;
    mapping(uint256 => Loan) public loans;

    // Event Logs
    event Deposit(address indexed provider, uint256 amountTokens, uint256 sharesIssued);
    event Withdrawal(address indexed provider, uint256 sharesBurned, uint256 amountTokens);
    event LoanIssued(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 expectedLoss);
    event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 interest);
    event ExpectedLossCapUpdated(uint256 oldCap, uint256 newCap);

    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner may execute this call.");
        _;
    }

    constructor(address _lendingToken) {
        require(_lendingToken != address(0), "Invalid token address.");
        lendingToken = IERC20(_lendingToken);
        owner = msg.sender;
    }

    /**
     * @notice Deposit USDC/USDT into the liquidity pool to earn yield shares.
     */
    function deposit(uint256 amount) external returns (uint256) {
        require(amount > 0, "Deposit amount must exceed zero.");
        
        uint256 poolBalance = lendingToken.balanceOf(address(this));
        uint256 sharesToIssue;

        if (totalShares == 0 || poolBalance == 0) {
            sharesToIssue = amount;
        } else {
            sharesToIssue = (amount * totalShares) / poolBalance;
        }

        // Pull tokens from depositor
        require(lendingToken.transferFrom(msg.sender, address(this), amount), "Lending token transfer failed.");

        shareBalance[msg.sender] += sharesToIssue;
        totalShares += sharesToIssue;

        emit Deposit(msg.sender, amount, sharesToIssue);
        return sharesToIssue;
    }

    /**
     * @notice Withdraw pool shares back into USDC/USDT principal plus accrued yield interest.
     */
    function withdraw(uint256 shares) external returns (uint256) {
        require(shares > 0 && shareBalance[msg.sender] >= shares, "Insufficient shares balance.");
        
        uint256 poolBalance = lendingToken.balanceOf(address(this));
        uint256 tokensToReturn = (shares * poolBalance) / totalShares;

        shareBalance[msg.sender] -= shares;
        totalShares -= shares;

        // Push tokens back to depositor
        require(lendingToken.transfer(msg.sender, tokensToReturn), "Lending token withdrawal transfer failed.");

        emit Withdrawal(msg.sender, shares, tokensToReturn);
        return tokensToReturn;
    }

    /**
     * @notice Issue a loan from pool funds, applying the Expected Loss (EL) risk formula.
     * Formula: EL = PD * LGD * EAD
     * Risk Engine Check: Reverts drawdown if Expected Loss / EAD exceeds the global cap (e.g. 5.0%).
     */
    function issueLoan(
        address borrower,
        uint256 loanAmount,
        uint256 pdBps, 
        uint256 lgdBps
    ) external onlyOwner returns (uint256) {
        require(borrower != address(0), "Invalid borrower address.");
        require(loanAmount > 0, "Loan amount must exceed zero.");
        require(lendingToken.balanceOf(address(this)) >= loanAmount, "Insufficient liquidity pool assets.");

        // EAD = loanAmount (Exposure at Default is modeled as the principal size)
        // EL = (PD * LGD * EAD) / (10000 * 10000)
        uint256 expectedLoss = (pdBps * lgdBps * loanAmount) / (BASIS_POINTS_DIVISOR * BASIS_POINTS_DIVISOR);
        
        // Calculate Expected Loss percentage in basis points: (EL * 10000) / EAD
        // Which simplifies back to: (PD * LGD) / 10000
        uint256 elPercentageBps = (pdBps * lgdBps) / BASIS_POINTS_DIVISOR;

        require(elPercentageBps <= expectedLossCapBps, "Credit Risk Violation: Expected Loss exceeds safety cap.");

        // Record loan
        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: borrower,
            principal: loanAmount,
            interestDue: (loanAmount * 1200) / BASIS_POINTS_DIVISOR, // Hardcode 12% interest for this tranche
            probabilityOfDefaultBps: pdBps,
            lossGivenDefaultBps: lgdBps,
            expectedLossValue: expectedLoss,
            active: true,
            repaid: false
        });

        // Transfer funds to borrower
        require(lendingToken.transfer(borrower, loanAmount), "USDC loan disbursement failed.");

        emit LoanIssued(loanId, borrower, loanAmount, expectedLoss);
        return loanId;
    }

    /**
     * @notice Repays a loan, returning principal and yield interest back to the pool,
     * increasing the net value of LP shares.
     */
    function repayLoan(uint256 loanId, uint256 principalPayment, uint256 interestPayment) external {
        Loan storage l = loans[loanId];
        require(l.active && !l.repaid, "Target loan is not active or already settled.");
        require(principalPayment == l.principal, "Must repay full principal amount.");
        require(interestPayment >= l.interestDue, "Must repay accrued interest due.");

        // Pull payment from borrower/settler
        require(lendingToken.transferFrom(msg.sender, address(this), principalPayment + interestPayment), "Repayment transfer failed.");

        l.active = false;
        l.repaid = true;

        emit LoanRepaid(loanId, principalPayment, interestPayment);
    }

    /**
     * @notice Configure Expected Loss safety limits for the underwriting engine.
     */
    function setExpectedLossCap(uint256 newCapBps) external onlyOwner {
        require(newCapBps <= BASIS_POINTS_DIVISOR, "Invalid cap scale.");
        uint256 oldCap = expectedLossCapBps;
        expectedLossCapBps = newCapBps;
        emit ExpectedLossCapUpdated(oldCap, newCapBps);
    }
}
