import { useState, useEffect } from 'react';
import {
  Wallet,
  ShieldCheck,
  Cpu,
  DollarSign,
  Activity,
  Database,
  AlertTriangle,
  ArrowUpRight,
  Scale,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

// Interface definitions
interface RwaVault {
  borrower: string;
  asset_id: number;
  asset_name: string;
  asset_type: string;
  collateral_shares: number;
  total_shares: number;
  unit_price_usd: number;
  borrowed_amount_usd: number;
  max_ltv_bps: number;
  health_factor_bps: number;
}

interface AMMRateResponse {
  success: boolean;
  utilization: number;
  base_rate: number;
  rate: number;
  kink_active: boolean;
  execution_engine: string;
}

interface DIDVerificationResponse {
  success: boolean;
  issuer: string;
  subject_did: string;
  claims: {
    creditScore: number;
    amlStatus: string;
    incomeVerifiedUsd: number;
  };
  publicKeyHex: string;
}

export default function RwaInstitutionalPortal() {
  // Page States
  const [vaults, setVaults] = useState<RwaVault[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);
  const [isDidModalOpen, setIsDidModalOpen] = useState(false);
  const [didResult, setDidResult] = useState<DIDVerificationResponse | null>(null);
  const [didLoading, setDidLoading] = useState(false);
  const [didError, setDidError] = useState<string | null>(null);

  // AMM states
  const [utilization, setUtilization] = useState(0.70); // 70% default
  const [ammRate, setAmmRate] = useState<AMMRateResponse | null>(null);
  const [ammLoading, setAmmLoading] = useState(false);

  // Liquidation state
  const [liquidationLoading, setLiquidationLoading] = useState(false);

  // Fetch all vaults
  const fetchVaults = async () => {
    setLoadingVaults(true);
    try {
      const res = await apiGet<{ vaults: RwaVault[] }>('/api/v1/institutional/vaults');
      setVaults(res.vaults);
    } catch (err) {
      console.error("Failed to fetch RWA vaults", err);
    } finally {
      setLoadingVaults(false);
    }
  };

  // Run AMM calculations
  const calculateAmmRate = async (utilVal: number) => {
    setAmmLoading(true);
    try {
      // Total supply is 10,000,000 USDC. Borrow is derived from utilization
      const totalLiq = 10000000.0;
      const totalBor = totalLiq * utilVal;
      const res = await apiPost<AMMRateResponse>('/api/v1/institutional/amm/calculate', {
        total_borrowed: totalBor,
        total_liquidity: totalLiq,
        base_rate: 0.02,
        slope1: 0.04,
        slope2: 0.25,
        kink: 0.80
      });
      setAmmRate(res);
    } catch (err) {
      console.error("AMM calculation failure", err);
    } finally {
      setAmmLoading(false);
    }
  };

  // Handle mock Chainlink price drop trigger
  const triggerOraclePriceDrop = async (assetId: number) => {
    try {
      // Hindustan Logistics price drops from 2.50 to 1.15
      await apiPost(`/api/v1/institutional/oracle/price-drop?asset_id=${assetId}&new_price=1.15`, {});
      await fetchVaults();
    } catch (err) {
      alert("Oracle price update failed.");
    }
  };

  // Execute partial liquidation
  const executeLiquidation = async (borrower: string, assetId: number, currentBorrowed: number) => {
    setLiquidationLoading(true);
    try {
      // Settle 40% of the loan (less than 50% limit)
      const repayVal = currentBorrowed * 0.40;
      const res = await apiPost<{ success: boolean }>('/api/v1/institutional/vault/liquidate', {
        borrower,
        asset_id: assetId,
        repay_amount: repayVal
      });
      if (res.success) {
        alert("Partial liquidation executed successfully! 10% discount seized.");
        await fetchVaults();
      }
    } catch (err: any) {
      alert(err.message || "Liquidation failed.");
    } finally {
      setLiquidationLoading(false);
    }
  };

  // Connect DID presentation verification
  const handleVerifyDID = async () => {
    setDidLoading(true);
    setDidError(null);
    try {
      const mockPresentation = {
        type: ["VerifiablePresentation"],
        verifiableCredential: {
          issuer: "did:key:z6Mku7bQp8g98qAdfB812cDb02341",
          credentialSubject: {
            id: "did:key:z6Mkt80129aCdbfe991a0",
            creditScore: 792,
            amlStatus: "PASSED",
            incomeVerifiedUsd: 185000.0
          },
          proof: {
            type: "Ed25519Signature2020",
            verificationMethod: "did:key:z6Mku7bQp8g98qAdfB812cDb02341#key-1",
            proofValue: "z3h29SignatureMockedCryptoValuePayloadForVerifiablePresentationClaims"
          }
        }
      };

      const res = await apiPost<DIDVerificationResponse>('/api/v1/institutional/did/verify', {
        presentation: mockPresentation
      });
      setDidResult(res);
    } catch (err: any) {
      setDidError(err.message || "DID Signature verification failed.");
    } finally {
      setDidLoading(false);
    }
  };

  // Load metrics
  useEffect(() => {
    fetchVaults();
    calculateAmmRate(utilization);
  }, []);

  // Update AMM calculation when slider changes
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setUtilization(val);
    calculateAmmRate(val);
  };

  return (
    <div className="w-full bg-[#0A0A0C] text-zinc-100 min-h-screen font-sans space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">RWA Tokenization & Institutional Port</h1>
          <p className="text-xs text-zinc-500 mt-1">Cross-Border Credit Underwriting, Self-Sovereign Identity Verification, and AMM Yield Matching</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <button
            onClick={() => setIsDidModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900 rounded-xl text-xs font-semibold transition-all hover:bg-zinc-850"
          >
            <Wallet className="w-4 h-4 text-[#00E676]" />
            SSID Wallet link
          </button>
          <button
            onClick={fetchVaults}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-semibold transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${loadingVaults ? 'animate-spin' : ''}`} />
            Refresh Vaults
          </button>
        </div>
      </div>

      {/* Dynamic Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <DollarSign className="w-12 h-12 text-[#00E676]" />
          </div>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total Active Loans</span>
          <span className="text-2xl font-bold text-white block mt-2">
            INR {(12590000).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" /> +12.4% this cycle
          </span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Scale className="w-12 h-12 text-[#00E676]" />
          </div>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Collateral Valuation</span>
          <span className="text-2xl font-bold text-white block mt-2">
            INR {(18250000).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-zinc-400 block mt-2">LTV Average: 68.9%</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Activity className="w-12 h-12 text-[#00E676]" />
          </div>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Credit Pool Utilization</span>
          <span className="text-2xl font-bold text-white block mt-2">
            {(utilization * 100).toFixed(1)}%
          </span>
          <div className="w-full bg-zinc-850 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#00E676] h-full" style={{ width: `${utilization * 100}%` }} />
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <TrendingUp className="w-12 h-12 text-[#00E676]" />
          </div>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Dynamic Borrow APR</span>
          <span className="text-2xl font-bold text-[#00E676] block mt-2">
            {ammRate ? (ammRate.rate * 100).toFixed(2) : '--'}%
          </span>
          <span className="text-[9px] text-zinc-400 font-mono block mt-2">
            Engine: {ammRate?.execution_engine || 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Main Grid: Collateral Matrix and AMM Slider */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* RWA Collateral Matrix */}
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 relative">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-[#00E676]" />
            Collateral Matrix Visualizer
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-3 px-2">Asset details</th>
                  <th className="py-3 px-2">Asset Type</th>
                  <th className="py-3 px-2">Oracle price</th>
                  <th className="py-3 px-2">Borrow Debt</th>
                  <th className="py-3 px-2 text-center">Health Factor</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vaults.map((vault) => {
                  const hFactor = vault.health_factor_bps / 10000;
                  const isLiquidatable = hFactor < 1.0;
                  
                  return (
                    <tr key={vault.asset_id} className="border-b border-zinc-850/60 hover:bg-zinc-900/30 transition-colors">
                      <td className="py-4 px-2">
                        <span className="text-white font-bold block">{vault.asset_name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{vault.borrower.slice(0, 8)}...{vault.borrower.slice(-6)}</span>
                      </td>
                      <td className="py-4 px-2 text-zinc-400 font-medium">{vault.asset_type}</td>
                      <td className="py-4 px-2 text-white font-mono">
                        USD {vault.unit_price_usd.toFixed(2)}
                        <span className="text-[10px] text-zinc-500 block">{(vault.collateral_shares).toLocaleString()} shares</span>
                      </td>
                      <td className="py-4 px-2 text-white font-mono font-semibold">
                        USD {(vault.borrowed_amount_usd).toLocaleString()}
                        <span className="text-[10px] text-zinc-500 block">LTV: {((vault.borrowed_amount_usd / (vault.collateral_shares * vault.unit_price_usd)) * 100).toFixed(1)}%</span>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isLiquidatable
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse'
                              : hFactor < 1.15
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {hFactor.toFixed(3)}
                          </span>
                          <div className="w-16 bg-zinc-800 h-1 rounded-full overflow-hidden">
                            <div className={`h-full ${
                              isLiquidatable ? 'bg-rose-500' : hFactor < 1.15 ? 'bg-amber-500' : 'bg-[#00E676]'
                            }`} style={{ width: `${Math.min(hFactor * 50, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-right space-y-1">
                        {isLiquidatable ? (
                          <button
                            disabled={liquidationLoading}
                            onClick={() => executeLiquidation(vault.borrower, vault.asset_id, vault.borrowed_amount_usd)}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all shadow-md hover:shadow-rose-950/20"
                          >
                            Liquidate (40%)
                          </button>
                        ) : (
                          <button
                            onClick={() => triggerOraclePriceDrop(vault.asset_id)}
                            className="border border-zinc-800 hover:border-zinc-700 hover:text-white text-zinc-400 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all bg-zinc-900"
                          >
                            Trigger price drop
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Credit AMM Model Card */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#00E676]" />
              Algorithmic Credit AMM
            </h2>
            <p className="text-[11px] text-zinc-500 mb-6">Dynamically calculate borrow yields based on cross-border pool utilization.</p>

            {/* Curve Mathematics Visualizer */}
            <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-4 font-mono text-xs">
              <span className="text-zinc-500 text-[10px] uppercase font-bold block mb-1">Utilization Parameters</span>
              <div className="flex justify-between text-zinc-400">
                <span>Base Rate (R₀):</span>
                <span className="text-white">2.00%</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Kink Threshold:</span>
                <span className="text-white">80.00%</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Curve Slope 1:</span>
                <span className="text-white">4.00%</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Curve Slope 2 (kink):</span>
                <span className="text-white">25.00%</span>
              </div>
            </div>

            {/* Slider control */}
            <div className="space-y-3 mt-6">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 font-bold">Simulate Pool Utilization:</span>
                <span className="text-white font-mono font-semibold">{(utilization * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.98"
                step="0.01"
                value={utilization}
                onChange={handleSliderChange}
                className="w-full accent-[#00E676] bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-850">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Calculated Borrow Rate</span>
                <span className="text-3xl font-extrabold text-[#00E676] tracking-tight mt-1">
                  {ammRate ? (ammRate.rate * 100).toFixed(2) : '--'}% APR
                </span>
              </div>
              {ammRate?.kink_active && (
                <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                  <span className="text-[9px] text-rose-400 font-bold uppercase tracking-wider">Kink active</span>
                </div>
              )}
            </div>
            <span className="text-[9px] text-zinc-500 font-mono block mt-2 text-right">
              {ammLoading ? 'Recalculating...' : `Curve Execution: ${ammRate?.execution_engine || 'Querying...'}`}
            </span>
          </div>
        </div>
      </div>

      {/* DID Connection modal */}
      {isDidModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0A0A0C] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-indigo-500" />
            
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00E676]" />
                Self-Sovereign Identity Linker
              </h3>
              <button
                onClick={() => { setIsDidModalOpen(false); setDidResult(null); setDidError(null); }}
                className="text-zinc-500 hover:text-white transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {!didResult ? (
              <div className="space-y-5">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Authenticate using W3C compliant credentials. Select your Decentralized Identity (DID) wallet presentation payload to verify credit score eligibility and regulatory status without exposing raw identity documents.
                </p>

                <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-3 font-mono text-[10px] text-zinc-400">
                  <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider block">Wallet payload preview</span>
                  <div>DID Source: <span className="text-white">did:key:z6Mku7bQp8g98qAdfB812cDb02341</span></div>
                  <div>Verification Method: <span className="text-white">Ed25519Signature2020</span></div>
                  <div>Claims Included: <span className="text-[#00E676]">CreditScore: 792, AML: PASSED</span></div>
                </div>

                <button
                  disabled={didLoading}
                  onClick={handleVerifyDID}
                  className="w-full flex items-center justify-center gap-2 bg-[#00E676] hover:bg-[#00C853] text-black font-bold text-xs py-3 rounded-xl transition-all shadow-lg hover:shadow-emerald-950/20 uppercase tracking-wider"
                >
                  {didLoading ? 'Verifying Signature...' : 'Submit Verifiable Presentation'}
                </button>
                {didError && <p className="text-xs text-rose-400 mt-2 font-mono">{didError}</p>}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center text-center p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 mb-3">
                    <ShieldCheck className="w-5 h-5 text-[#00E676]" />
                  </div>
                  <span className="text-sm font-bold text-white block">Decentralized ID Verified</span>
                  <span className="text-[10px] text-zinc-500 font-mono mt-1">Status: SUCCESS</span>
                </div>

                <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl space-y-2.5 font-mono text-xs text-zinc-400">
                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <span>Subject DID:</span>
                    <span className="text-white text-right truncate max-w-[200px]">{didResult.subject_did}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <span>Credit Score Claim:</span>
                    <span className="text-[#00E676] font-bold">{didResult.claims.creditScore}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-2">
                    <span>AML/KYC Status:</span>
                    <span className="text-white">{didResult.claims.amlStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Income Verified:</span>
                    <span className="text-white">USD {didResult.claims.incomeVerifiedUsd.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => { setIsDidModalOpen(false); setDidResult(null); }}
                  className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-white font-bold text-xs py-3 rounded-xl transition-all uppercase tracking-wider"
                >
                  Close Wallet Connection
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
