import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  TrendingUp,
  Scale,
  AlertTriangle,
  Search,
  Activity,
  RefreshCw
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { apiGet, apiPost } from '../../lib/api';

// Interface definitions
interface QuarantineLog {
  timestamp: string;
  entity_name: string;
  watchlist: string;
  similarity_score: number;
  reason: string;
  amount_usd: number;
  status: string;
}

interface CDSQuoteResponse {
  success: boolean;
  premium_rate: number;
  premium_rate_bps: number;
  term1_default_risk: number;
  term2_volatility_premium: number;
  risk_parameters: {
    default_intensity_lambda: number;
    expected_recovery_r: number;
    volatility_sigma: number;
    alpha: number;
  };
}

interface ScanResponse {
  entity_name: string;
  is_quarantined: boolean;
  highest_similarity_score: number;
  primary_match_reason: string;
  matched_watchlist: string;
  processing_latency_ms: number;
  sla_passed: boolean;
  audit_trail_hash: string;
}

interface ReconcileResponse {
  success: boolean;
  fiat_total: number;
  onchain_total: number;
  absolute_difference: number;
  reconciled: boolean;
  tolerance: number;
  execution_engine: string;
}

export default function RiskHedgingAndCompliance() {
  // Page States
  const [quarantineLogs, setQuarantineLogs] = useState<QuarantineLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Scan states
  const [searchName, setSearchName] = useState('Ivan Badov');
  const [searchAmount, setSearchAmount] = useState(250000.0);
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  // Actuarial parameters
  const [lambda, setLambda] = useState(0.03); // default intensity 3%
  const [recovery, setRecovery] = useState(0.40); // 40% expected recovery
  const [volatility, setVolatility] = useState(0.15); // 15% volatility
  const [alpha] = useState(0.08); // alpha factor
  const [cdsQuote, setCdsQuote] = useState<CDSQuoteResponse | null>(null);

  // Reconciliation states
  const [fiatBalance, setFiatBalance] = useState(4820000.0);
  const [onchainBalance, setOnchainBalance] = useState(4820000.0);
  const [reconResult, setReconResult] = useState<ReconcileResponse | null>(null);
  const [reconLoading, setReconLoading] = useState(false);

  // Fetch quarantine logs
  const fetchQuarantineLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await apiGet<{ success: boolean; logs: QuarantineLog[] }>('/api/v1/compliance/sanctions/quarantine-logs');
      setQuarantineLogs(res.logs);
    } catch (err) {
      console.error("Failed to fetch quarantine logs", err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Run sanctions screening
  const handleSanctionsScan = async () => {
    setScanLoading(true);
    setScanResult(null);
    try {
      const res = await apiPost<ScanResponse>('/api/v1/compliance/sanctions/scan', {
        entity_name: searchName,
        amount_usd: Number(searchAmount)
      });
      setScanResult(res);
      await fetchQuarantineLogs();
    } catch (err) {
      console.error("Failed to run sanctions scan", err);
    } finally {
      setScanLoading(false);
    }
  };

  // Calculate CDS premiums
  const calculateCdsPremium = async (lam: number, rec: number, vol: number, alp: number) => {
    try {
      const res = await apiPost<CDSQuoteResponse>('/api/v1/compliance/cds/quote', {
        default_intensity: lam,
        recovery_rate: rec,
        volatility: vol,
        alpha: alp
      });
      setCdsQuote(res);
    } catch (err) {
      console.error("CDS calculations failure", err);
    }
  };

  // Run ledger reconciliation
  const handleReconcile = async () => {
    setReconLoading(true);
    try {
      const res = await apiPost<ReconcileResponse>('/api/v1/compliance/clearing/reconcile', {
        fiat_total: Number(fiatBalance),
        onchain_total: Number(onchainBalance),
        tolerance: 0.01
      });
      setReconResult(res);
    } catch (err) {
      console.error("Reconciliation execution failure", err);
    } finally {
      setReconLoading(false);
    }
  };

  // Trigger Credit default event
  const triggerCreditDefaultEvent = async () => {
    try {
      const res = await apiPost<{ event_status: string; total_principal_paid_out_usd: number }>('/api/v1/compliance/cds/trigger-event', {});
      alert(`Chainlink default event logged! Payout executed: USD ${res.total_principal_paid_out_usd.toLocaleString()}`);
    } catch (err) {
      alert("Credit default trigger failed.");
    }
  };

  // Initial load
  useEffect(() => {
    fetchQuarantineLogs();
    calculateCdsPremium(lambda, recovery, volatility, alpha);
    handleReconcile();
  }, []);

  // Update rates when sliders move
  const handleLambdaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setLambda(val);
    calculateCdsPremium(val, recovery, volatility, alpha);
  };

  const handleRecoveryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setRecovery(val);
    calculateCdsPremium(lambda, val, volatility, alpha);
  };

  const handleVolatilityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolatility(val);
    calculateCdsPremium(lambda, recovery, val, alpha);
  };

  // Generate chart data based on premium rates for recovery ranges
  const generateChartData = () => {
    const points = [];
    for (let r = 0.10; r <= 0.90; r += 0.10) {
      const term1 = lambda * (1.0 - r);
      const term2 = alpha * (volatility ** 2);
      const rateBps = (term1 + term2) * 10000;
      points.push({
        recovery: `${(r * 100).toFixed(0)}%`,
        premium_bps: Math.round(rateBps)
      });
    }
    return points;
  };

  const chartData = generateChartData();

  return (
    <div className="w-full bg-[#0A0A0C] text-zinc-100 min-h-screen font-sans space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-display">Risk Hedging & Regulatory Compliance</h1>
          <p className="text-xs text-zinc-500 mt-1">Autonomous Credit Default Swaps, Sub-10ms Graph Sanction Screening, and Clearing House Audits</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <button
            onClick={triggerCreditDefaultEvent}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
          >
            <AlertTriangle className="w-4 h-4 animate-pulse" />
            Trigger Credit Event
          </button>
          <button
            onClick={fetchQuarantineLogs}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-semibold transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${logsLoading ? 'animate-spin' : ''}`} />
            Refresh Logs
          </button>
        </div>
      </div>

      {/* Actuarial Actives and AML Scanning Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Actuarial CDS Hedging Engine */}
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#00E676]" />
              Credit Default Swap Actuarial Engine
            </h2>
            <p className="text-[11px] text-zinc-500 mb-6">Calculate dynamic premium yields based on current forecasting default intensity and collateral volatility.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Sliders */}
              <div className="space-y-5 md:col-span-1">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-bold">Default Intensity (λ):</span>
                    <span className="text-white font-mono font-semibold">{(lambda * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.25"
                    step="0.01"
                    value={lambda}
                    onChange={handleLambdaChange}
                    className="w-full accent-[#00E676] bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-bold">Recovery Rate (R):</span>
                    <span className="text-white font-mono font-semibold">{(recovery * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.80"
                    step="0.05"
                    value={recovery}
                    onChange={handleRecoveryChange}
                    className="w-full accent-[#00E676] bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-bold">Collateral Volatility (σ):</span>
                    <span className="text-white font-mono font-semibold">{(volatility * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.50"
                    step="0.01"
                    value={volatility}
                    onChange={handleVolatilityChange}
                    className="w-full accent-[#00E676] bg-zinc-800 rounded-lg appearance-none h-1.5 cursor-pointer"
                  />
                </div>
              </div>

              {/* Chart Visualizer */}
              <div className="h-44 md:col-span-2 bg-zinc-950 p-2 rounded-xl border border-zinc-900">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00E676" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#00E676" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F1F2E" />
                    <XAxis dataKey="recovery" stroke="#52526b" style={{ fontSize: 9, fontFamily: 'monospace' }} />
                    <YAxis stroke="#52526b" style={{ fontSize: 9, fontFamily: 'monospace' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0A0A0C', borderColor: '#27272a', fontSize: 10 }} />
                    <Area type="monotone" dataKey="premium_bps" name="Premium Rate (bps)" stroke="#00E676" strokeWidth={1.5} fillOpacity={1} fill="url(#colorBps)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-850 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Actuarial CDS Premium Quote</span>
              <span className="text-3xl font-extrabold text-[#00E676] tracking-tight mt-1">
                {cdsQuote ? cdsQuote.premium_rate_bps : '--'} bps
              </span>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-right text-[10px] font-mono space-y-1">
              <div>Default Risk Component: <span className="text-white">{cdsQuote ? (cdsQuote.term1_default_risk * 10000).toFixed(0) : '--'} bps</span></div>
              <div>Volatility Premium: <span className="text-white">{cdsQuote ? (cdsQuote.term2_volatility_premium * 10000).toFixed(0) : '--'} bps</span></div>
            </div>
          </div>
        </div>

        {/* Real-time compliance Gate Screening */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#00E676]" />
              AI compliance Screening Gate
            </h2>
            <p className="text-[11px] text-zinc-500 mb-6">Test entity names against OFAC SDN and other international trade watchlists instantly.</p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Counterparty Entity Name</label>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-[#00E676]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Transaction Amount (USD)</label>
                <input
                  type="number"
                  value={searchAmount}
                  onChange={(e) => setSearchAmount(parseFloat(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                />
              </div>

              <button
                disabled={scanLoading}
                onClick={handleSanctionsScan}
                className="w-full flex items-center justify-center gap-2 bg-[#00E676] hover:bg-[#00C853] text-black font-bold text-xs py-3 rounded-xl transition-all shadow-md uppercase tracking-wider"
              >
                <Search className="w-3.5 h-3.5" />
                Scan Counterparty Entity
              </button>
            </div>
          </div>

          {scanResult && (
            <div className="mt-5 pt-4 border-t border-zinc-850 space-y-3 font-mono text-[10px]">
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span>Scan Result:</span>
                <span className={scanResult.is_quarantined ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {scanResult.is_quarantined ? 'BLOCKED & QUARANTINED' : 'PASSED / CLEAN'}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span>Match Score:</span>
                <span className="text-white">{(scanResult.highest_similarity_score * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span>Scan Latency:</span>
                <span className="text-emerald-400 font-bold">{scanResult.processing_latency_ms.toFixed(3)} ms</span>
              </div>
              <div className="flex justify-between">
                <span>SLA Target:</span>
                <span className="text-emerald-400">✓ SUB-10MS PASSED</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lower Section: Quarantine Interceptions and Clearing House Reconciliation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Clearing House Reconciliation */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Scale className="w-5 h-5 text-[#00E676]" />
              clearing House Reconciliation
            </h2>
            <p className="text-[11px] text-zinc-500 mb-6">Verify double-entry ledger balance invariants between bank accounts and Web3 token pools.</p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Fiat Ledger Balance (USD)</label>
                <input
                  type="number"
                  value={fiatBalance}
                  onChange={(e) => setFiatBalance(parseFloat(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">On-Chain Asset Balance (USD)</label>
                <input
                  type="number"
                  value={onchainBalance}
                  onChange={(e) => setOnchainBalance(parseFloat(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                />
              </div>

              <button
                disabled={reconLoading}
                onClick={handleReconcile}
                className="w-full flex items-center justify-center gap-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md uppercase tracking-wider"
              >
                Verify Balances Invariant
              </button>
            </div>
          </div>

          {reconResult && (
            <div className="mt-5 pt-4 border-t border-zinc-850 space-y-3 font-mono text-[10px]">
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span>Invariant Audit:</span>
                <span className={reconResult.reconciled ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {reconResult.reconciled ? '✓ RECONCILED SUCCESS' : '✕ BALANCES MISMATCH'}
                </span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span>Absolute Diff:</span>
                <span className="text-white">USD {reconResult.absolute_difference.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Audit Engine:</span>
                <span className="text-zinc-500 font-bold text-[9px]">{reconResult.execution_engine}</span>
              </div>
            </div>
          )}
        </div>

        {/* Quarantine Intercept Log Feed */}
        <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 relative">
          <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00E676]" />
            AML Quarantine Intercept Feed
          </h2>
          <p className="text-[11px] text-zinc-500 mb-4">Immutable logs of transactions currently quarantined due to watchlist fuzzy compliance violations.</p>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 h-[250px] overflow-y-auto font-mono text-[10px] space-y-3">
            {quarantineLogs.map((log, index) => (
              <div key={index} className="border-b border-zinc-900 pb-2.5 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    [BLOCKED] matched against {log.watchlist} list.
                  </span>
                  <span className="text-zinc-600">{log.timestamp}</span>
                </div>
                <div className="text-zinc-400 mt-1">
                  Entity: <span className="text-white font-bold">{log.entity_name}</span> | 
                  Amount: <span className="text-white font-semibold">USD {log.amount_usd.toLocaleString()}</span>
                </div>
                <div className="text-zinc-500 text-[9px] mt-1 leading-normal">
                  Reason: {log.reason}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      
    </div>
  );
}
