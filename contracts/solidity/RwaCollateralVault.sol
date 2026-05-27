// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title RwaCollateralVault
 * @dev Governs fractionalized Real-World Asset (RWA) collateral pools,
 * Chainlink-simulated valuation mappings, dynamic LTV calculations,
 * and automated partial liquidation mechanics.
 */
contract RwaCollateralVault {
    string public constName = "Credit Line RWA Layer";
    address public owner;

    // Basis Points constants (10,000 bps = 100%)
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    uint256 public constant LIQUIDATION_BONUS_BPS = 1000; // 10% discount bonus for liquidators
    uint256 public constant LIQUIDATION_THRESHOLD_BPS = 8500; // Liquidate if debt exceeds 85% of collateral value

    // Structural model representation of a Fractionalized RWA Asset
    struct RwaAsset {
        uint256 id;
        string name;
        string assetType; // e.g. "Commercial Real Estate", "Invoice Financing", "Inventory"
        uint256 totalShares;
        uint256 unitPriceUsd; // in micro-USD (6 decimals, e.g. 1 USDC = 1,000,000)
        uint256 maxLtvBps;    // e.g. 7000 = 70% Max Loan-To-Value
        bool active;
    }

    // Vault record per borrower and asset
    struct Vault {
        uint256 collateralShares;
        uint256 borrowedAmountUsd; // in micro-USD (6 decimals)
        uint256 lastUpdatedBlock;
    }

    // ERC-1155 mock state mappings
    mapping(uint256 => RwaAsset) public rwaAssets;
    mapping(address => mapping(uint256 => uint256)) public balances; // user => assetId => balance
    
    // Borrower Vaults tracking: borrower => assetId => Vault
    mapping(address => mapping(uint256 => Vault)) public vaults;

    // Events
    event RwaAssetMinted(uint256 indexed assetId, string name, string assetType, uint256 totalShares, uint256 unitPriceUsd);
    event CollateralDeposited(address indexed borrower, uint256 indexed assetId, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, uint256 indexed assetId, uint256 amount);
    event LoanDrawn(address indexed borrower, uint256 indexed assetId, uint256 borrowAmountUsd);
    event LoanRepaid(address indexed borrower, uint256 indexed assetId, uint256 repayAmountUsd);
    event OraclePriceUpdated(uint256 indexed assetId, uint256 newPriceUsd);
    event VaultLiquidated(
        address indexed borrower,
        uint256 indexed assetId,
        address indexed liquidator,
        uint256 debtRepaidUsd,
        uint256 collateralSeizedShares
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only registry owner may execute.");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Mint a fractionalized RWA token representing real-world value.
     */
    function mintRwaAsset(
        uint256 assetId,
        string calldata name,
        string calldata assetType,
        uint256 totalShares,
        uint256 initialPriceUsd,
        uint256 maxLtvBps
    ) external onlyOwner {
        require(rwaAssets[assetId].id == 0, "Asset ID already exists.");
        require(maxLtvBps <= BASIS_POINTS_DIVISOR, "LTV cannot exceed 100%.");

        rwaAssets[assetId] = RwaAsset({
            id: assetId,
            name: name,
            assetType: assetType,
            totalShares: totalShares,
            unitPriceUsd: initialPriceUsd,
            maxLtvBps: maxLtvBps,
            active: true
        });

        // Credit the initial shares to the contract owner
        balances[owner][assetId] = totalShares;

        emit RwaAssetMinted(assetId, name, assetType, totalShares, initialPriceUsd);
    }

    /**
     * @notice Transfer fractional shares to borrowers.
     */
    function transferShares(
        address to,
        uint256 assetId,
        uint256 amount
    ) external {
        require(balances[msg.sender][assetId] >= amount, "Insufficient shares balance.");
        balances[msg.sender][assetId] -= amount;
        balances[to][assetId] += amount;
    }

    /**
     * @notice Deposit fractional RWA shares as loan collateral in a vault.
     */
    function depositCollateral(uint256 assetId, uint256 amount) external {
        require(rwaAssets[assetId].active, "Asset is not active.");
        require(balances[msg.sender][assetId] >= amount, "Insufficient shares to deposit.");

        balances[msg.sender][assetId] -= amount;
        vaults[msg.sender][assetId].collateralShares += amount;
        vaults[msg.sender][assetId].lastUpdatedBlock = block.number;

        emit CollateralDeposited(msg.sender, assetId, amount);
    }

    /**
     * @notice Withdraw collateral from a vault if health factor constraints are satisfied.
     */
    function withdrawCollateral(uint256 assetId, uint256 amount) external {
        Vault storage vault = vaults[msg.sender][assetId];
        require(vault.collateralShares >= amount, "Withdrawal amount exceeds vault collateral.");

        vault.collateralShares -= amount;
        require(getHealthFactor(msg.sender, assetId) >= BASIS_POINTS_DIVISOR, "Undercollateralized: Cannot withdraw.");

        balances[msg.sender][assetId] += amount;
        vault.lastUpdatedBlock = block.number;

        emit CollateralWithdrawn(msg.sender, assetId, amount);
    }

    /**
     * @notice Borrow credit funds (modeled in USDC micro-units) against RWA collateral.
     */
    function borrow(uint256 assetId, uint256 borrowAmountUsd) external {
        Vault storage vault = vaults[msg.sender][assetId];
        require(vault.collateralShares > 0, "No collateral deposited.");

        vault.borrowedAmountUsd += borrowAmountUsd;
        require(getHealthFactor(msg.sender, assetId) >= BASIS_POINTS_DIVISOR, "Borrow limit exceeded: Risk violation.");

        vault.lastUpdatedBlock = block.number;

        emit LoanDrawn(msg.sender, assetId, borrowAmountUsd);
    }

    /**
     * @notice Repay loan principal, improving vault health.
     */
    function repay(address borrower, uint256 assetId, uint256 repayAmountUsd) external {
        Vault storage vault = vaults[borrower][assetId];
        require(vault.borrowedAmountUsd >= repayAmountUsd, "Repayment exceeds borrowed debt.");

        vault.borrowedAmountUsd -= repayAmountUsd;
        vault.lastUpdatedBlock = block.number;

        emit LoanRepaid(borrower, assetId, repayAmountUsd);
    }

    /**
     * @notice Simulate dynamic oracle price updates (representing Chainlink triggers).
     */
    function updateOraclePrice(uint256 assetId, uint256 newPriceUsd) external onlyOwner {
        require(rwaAssets[assetId].id != 0, "Asset does not exist.");
        rwaAssets[assetId].unitPriceUsd = newPriceUsd;

        emit OraclePriceUpdated(assetId, newPriceUsd);
    }

    /**
     * @notice Calculates the health factor of a vault in basis points.
     * Health Factor = (Collateral Value * Max LTV) / Borrowed Amount.
     * Returns >= 10000 bps (1.0) if healthy. Returns 0 if no debt is outstanding.
     */
    function getHealthFactor(address borrower, uint256 assetId) public view returns (uint256) {
        Vault memory vault = vaults[borrower][assetId];
        RwaAsset memory asset = rwaAssets[assetId];

        if (vault.borrowedAmountUsd == 0) {
            return BASIS_POINTS_DIVISOR; // Infinite health
        }

        // Collateral Value = collateralShares * unitPriceUsd / 1,000,000 (standardized decimals)
        // However, we compute inside integer scale to avoid floating rounding:
        uint256 collateralValueUsd = (vault.collateralShares * asset.unitPriceUsd) / asset.totalShares;
        uint256 maxBorrowAllowed = (collateralValueUsd * asset.maxLtvBps) / BASIS_POINTS_DIVISOR;

        return (maxBorrowAllowed * BASIS_POINTS_DIVISOR) / vault.borrowedAmountUsd;
    }

    /**
     * @notice Trigger an automated partial liquidation sequence to protect investor capital.
     * Rules:
     * - Health factor must be < 1.0 (under 10,000 bps).
     * - Liquidators can repay up to 50% of the active debt in a single call (partial liquidation).
     * - Liquidators receive collateral shares valued at oracle price with a 10% discount (LIQUIDATION_BONUS_BPS).
     */
    function liquidate(
        address borrower,
        uint256 assetId,
        uint256 repayAmountUsd
    ) external returns (uint256 sharesSeized) {
        require(getHealthFactor(borrower, assetId) < BASIS_POINTS_DIVISOR, "Vault is healthy: Cannot liquidate.");

        Vault storage vault = vaults[borrower][assetId];
        RwaAsset memory asset = rwaAssets[assetId];

        // Max repayable debt is 50% of outstanding loan
        uint256 maxRepayable = vault.borrowedAmountUsd / 2;
        require(repayAmountUsd <= maxRepayable, "Liquidator cannot settle more than 50% of debt.");
        require(repayAmountUsd > 0, "Repay amount must exceed zero.");

        // Seize calculation with bonus discount:
        // Value of shares seized = repayAmountUsd * (1 + bonus)
        // sharesSeized = (Value of shares seized * totalShares) / unitPriceUsd
        uint256 valueSeizedUsd = (repayAmountUsd * (BASIS_POINTS_DIVISOR + LIQUIDATION_BONUS_BPS)) / BASIS_POINTS_DIVISOR;
        sharesSeized = (valueSeizedUsd * asset.totalShares) / asset.unitPriceUsd;

        require(vault.collateralShares >= sharesSeized, "Vault collateral insufficient for liquidation amount.");

        // Update state
        vault.collateralShares -= sharesSeized;
        vault.borrowedAmountUsd -= repayAmountUsd;
        vault.lastUpdatedBlock = block.number;

        // Credit shares to liquidator
        balances[msg.sender][assetId] += sharesSeized;

        emit VaultLiquidated(borrower, assetId, msg.sender, repayAmountUsd, sharesSeized);
    }
}
