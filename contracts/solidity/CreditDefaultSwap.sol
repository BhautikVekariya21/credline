// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CreditDefaultSwap
 * @dev Manages premium payments, protection buyers, risk seller reserves,
 * dynamic actuarial premium pricing, and automated payout settlements on credit events.
 */
contract CreditDefaultSwap {
    string public constName = "Credit Line CDS Protocol";
    address public owner;

    // Basis points representation (10000 bps = 100%)
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;

    // Premium parameters
    uint256 public defaultIntensityBps = 300; // lambda (e.g. 300 bps = 3.0%)
    uint256 public expectedRecoveryRateBps = 4000; // R (e.g. 40% recovery rate)
    uint256 public volatilityBps = 1500; // sigma (e.g. 15% volatility)
    uint256 public alphaBps = 800; // alpha factor (e.g. 0.08)

    // Protection seller shares details
    uint256 public totalReservesUsd;
    uint256 public totalSellerShares;
    mapping(address => uint256) public sellerShares;

    // Protection details
    struct Protection {
        uint256 coveredPrincipalUsd;
        uint256 premiumRateBps;
        uint256 expirationBlock;
        bool active;
    }

    // Mapping of protection buyers: buyer => Protection
    mapping(address => Protection) public activeProtections;
    address[] public protectionBuyers;

    // Events
    event ReservesDeposited(address indexed seller, uint256 amountUsd, uint256 sharesIssued);
    event ReservesWithdrawn(address indexed seller, uint256 sharesBurned, uint256 amountUsd);
    event ProtectionBought(address indexed buyer, uint256 coveredAmountUsd, uint256 premiumRateBps, uint256 durationBlocks);
    event PremiumPaid(address indexed buyer, uint256 premiumAmountUsd);
    event CreditEventTriggered(uint256 totalPayoutUsd, uint256 activeProtectionsSettled);
    event RiskParametersUpdated(uint256 lambda, uint256 recovery, uint256 volatility, uint256 alpha);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only registry owner may execute.");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Deposit USDC/fiat collateral into the protection sellers' reserves pool.
     */
    function depositReserves(uint256 amountUsd) external returns (uint256 sharesIssued) {
        require(amountUsd > 0, "Deposit must exceed zero.");

        if (totalSellerShares == 0 || totalReservesUsd == 0) {
            sharesIssued = amountUsd;
        } else {
            sharesIssued = (amountUsd * totalSellerShares) / totalReservesUsd;
        }

        sellerShares[msg.sender] += sharesIssued;
        totalSellerShares += sharesIssued;
        totalReservesUsd += amountUsd;

        emit ReservesDeposited(msg.sender, amountUsd, sharesIssued);
        return sharesIssued;
    }

    /**
     * @notice Withdraw reserves + collected premiums from the protection sellers' pool.
     */
    function withdrawReserves(uint256 shares) external returns (uint256 amountUsd) {
        require(shares > 0 && sellerShares[msg.sender] >= shares, "Insufficient shares.");

        amountUsd = (shares * totalReservesUsd) / totalSellerShares;

        sellerShares[msg.sender] -= shares;
        totalSellerShares -= shares;
        totalReservesUsd -= amountUsd;

        emit ReservesWithdrawn(msg.sender, shares, amountUsd);
        return amountUsd;
    }

    /**
     * @notice Calculate dynamic premium rate using dynamic risk parameter values.
     * Formula: P_premium = lambda * (1 - R) + alpha * sigma^2
     */
    function calculatePremiumRateBps() public view returns (uint256) {
        // Part 1: lambda * (1 - R)
        // lambda = defaultIntensityBps
        // (1 - R) = (BASIS_POINTS_DIVISOR - expectedRecoveryRateBps)
        uint256 term1 = (defaultIntensityBps * (BASIS_POINTS_DIVISOR - expectedRecoveryRateBps)) / BASIS_POINTS_DIVISOR;

        // Part 2: alpha * sigma^2
        // alpha = alphaBps
        // sigma^2 = (volatilityBps * volatilityBps) / BASIS_POINTS_DIVISOR
        uint256 term2 = (alphaBps * volatilityBps * volatilityBps) / (BASIS_POINTS_DIVISOR * BASIS_POINTS_DIVISOR);

        return term1 + term2;
    }

    /**
     * @notice Lenders buy default protection on outstanding loans.
     */
    function buyProtection(uint256 coverAmountUsd, uint256 durationBlocks) external {
        require(coverAmountUsd > 0, "Cover amount must exceed zero.");
        require(totalReservesUsd >= coverAmountUsd, "Insufficient pool reserves to guarantee protection.");

        uint256 rateBps = calculatePremiumRateBps();

        // Calculate upfront premium cost: coverAmountUsd * rateBps / BASIS_POINTS_DIVISOR
        uint256 premiumAmount = (coverAmountUsd * rateBps) / BASIS_POINTS_DIVISOR;

        // In a production token transfer, we pull `premiumAmount` from the buyer
        // and credit it to the pool reserves.
        totalReservesUsd += premiumAmount;

        // Add protection
        activeProtections[msg.sender] = Protection({
            coveredPrincipalUsd: coverAmountUsd,
            premiumRateBps: rateBps,
            expirationBlock: block.number + durationBlocks,
            active: true
        });

        // Add to array if not already present
        bool found = false;
        for (uint256 i = 0; i < protectionBuyers.length; i++) {
            if (protectionBuyers[i] == msg.sender) {
                found = true;
                break;
            }
        }
        if (!found) {
            protectionBuyers.push(msg.sender);
        }

        emit ProtectionBought(msg.sender, coverAmountUsd, rateBps, durationBlocks);
        emit PremiumPaid(msg.sender, premiumAmount);
    }

    /**
     * @notice Trigger credit event payout (called by oracle/governance).
     * Distributes covered principal atomically to protection buyers.
     */
    function triggerCreditEvent() external onlyOwner returns (uint256 totalPayoutUsd) {
        uint256 settledCount = 0;

        for (uint256 i = 0; i < protectionBuyers.length; i++) {
            address buyer = protectionBuyers[i];
            Protection storage p = activeProtections[buyer];

            if (p.active && block.number <= p.expirationBlock) {
                uint256 payout = p.coveredPrincipalUsd;
                if (totalReservesUsd >= payout) {
                    totalReservesUsd -= payout;
                    totalPayoutUsd += payout;
                    p.active = false;
                    settledCount++;
                    // In a production system, we would execute:
                    // transferToken(buyer, payout);
                }
            }
        }

        emit CreditEventTriggered(totalPayoutUsd, settledCount);
    }

    /**
     * @notice Update underlying default, recovery, and volatility rates.
     */
    function updateRiskParameters(
        uint256 _lambdaBps,
        uint256 _recoveryBps,
        uint256 _volatilityBps,
        uint256 _alphaBps
    ) external onlyOwner {
        require(_recoveryBps <= BASIS_POINTS_DIVISOR, "Recovery rate cannot exceed 100%.");
        require(_lambdaBps <= BASIS_POINTS_DIVISOR, "Default intensity cannot exceed 100%.");

        defaultIntensityBps = _lambdaBps;
        expectedRecoveryRateBps = _recoveryBps;
        volatilityBps = _volatilityBps;
        alphaBps = _alphaBps;

        emit RiskParametersUpdated(_lambdaBps, _recoveryBps, _volatilityBps, _alphaBps);
    }
}
