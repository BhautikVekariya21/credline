import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal, ShieldAlert, Globe, Activity, RefreshCw, Play,
  CheckCircle2, Server, Database, Lock, Send, Key, FileCode, Check
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';

// Interfaces for response payloads
interface SovereignInferenceResult {
  success: boolean;
  jurisdiction: string;
  aws_nitro_enclave: string;
  model_transferred: {
    model_type: string;
    weights_hash: string;
    payload_size_mb: number;
  };
  data_governance: {
    compliance_framework: string;
    data_residency_status: string;
    data_export_violation: boolean;
    pii_redacted: boolean;
  };
  inference_result: {
    score: number;
    status: string;
    enclave_execution_timestamp: number;
    ledger_integrity_hash: string;
  };
}

interface SwapContract {
  swap_id: string;
  status: string;
  parties: {
    initiator: string;
    receiver: string;
  };
  terms: {
    funding_currency: string;
    funding_amount: number;
    collateral_currency: string;
    collateral_value: number;
    exchange_rate: number;
    duration_days: number;
    swap_fee_bps: number;
    swap_fee_value: number;
    effective_date: string;
    maturity_date: string;
  };
  cryptographic_signatures: {
    credit_line_agent: string;
    partner_bank_agent: string;
    signature_algorithm: string;
  };
}

interface SwapNegotiationResult {
  success: boolean;
  swap_id: string;
  negotiation_rounds: number;
  negotiation_history: Array<{
    round: number;
    offered_by: string;
    fee_bps: number;
    status: string;
  }>;
  contract: SwapContract;
  settlement: {
    status: string;
    network: string;
    gas_fees_gwei: number;
    settlement_latency_ms: number;
  };
}

interface RemediationLogResponse {
  logs: string[];
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function GodsEyeResiliency() {
  const { theme, font } = useAppStore();

  // Local Toast system
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef<number>(0);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = `toast-${++toastCounter.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // System states
  const [activeTab, setActiveTab] = useState<'remediation' | 'sovereign' | 'swap'>('remediation');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isPollingLogs, setIsPollingLogs] = useState<boolean>(true);
  const [isRemediating, setIsRemediating] = useState<boolean>(false);

  // Sovereign AI states
  const [selectedRegion, setSelectedRegion] = useState<'IN' | 'EU' | 'US'>('IN');
  const [isInferring, setIsInferring] = useState<boolean>(false);
  const [inferenceResult, setInferenceResult] = useState<SovereignInferenceResult | null>(null);
  
  // Animation coordinates for SVG map packets
  const [packetPos, setPacketPos] = useState<{ x: number; y: number } | null>(null);
  const [packetType, setPacketType] = useState<'model' | 'score' | null>(null);
  const [animatingRegion, setAnimatingRegion] = useState<'IN' | 'EU' | 'US' | null>(null);

  // Interbank negotiation states
  const [deficitCurrency, setDeficitCurrency] = useState<string>('EUR');
  const [deficitAmount, setDeficitAmount] = useState<number>(5000000);
  const [partnerBank, setPartnerBank] = useState<string>('Deutsche Bank AI');
  const [isNegotiating, setIsNegotiating] = useState<boolean>(false);
  const [negotiationResult, setNegotiationResult] = useState<SwapNegotiationResult | null>(null);

  // Terminal scroll ref
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Fetch healer logs from FastAPI
  const fetchHealerLogs = async (isQuiet = false) => {
    try {
      const res = await apiGet<RemediationLogResponse>('/api/v1/ceo/remediation/logs');
      setTerminalLogs(res.logs);
      if (!isQuiet) {
        // Auto scroll to bottom
        setTimeout(() => {
          terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err: any) {
      if (!isQuiet) {
        addToast(err.message || 'Failed to fetch healer agent logs', 'error');
      }
    }
  };

  // Poll logs periodically
  useEffect(() => {
    fetchHealerLogs(true);
    const interval = setInterval(() => {
      if (isPollingLogs) {
        fetchHealerLogs(true);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isPollingLogs]);

  // Trigger simulated vendor error & auto-remediation run
  const triggerAutoRemediation = async () => {
    setIsRemediating(true);
    setTerminalLogs([]);
    addToast('Simulating vendor schema change. Initializing Healer Agent...', 'info');
    try {
      // Trigger API endpoint
      await apiPost('/api/v1/ceo/remediate', {
        failing_payload: {
          tax_identifier: "TX-9983-A",
          amount: 25000.0,
          timestamp: new Date().toISOString()
        }
      });
      addToast('Auto-remediation code patch generated and verified successfully!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Auto-remediation simulation failed', 'error');
    } finally {
      setIsRemediating(false);
      // Fetch final logs
      fetchHealerLogs();
    }
  };

  // Clear healer daemon logs
  const clearHealerLogs = async () => {
    try {
      await apiPost('/api/v1/ceo/remediation/logs/clear', {});
      setTerminalLogs([]);
      addToast('Healer agent logs cleared', 'success');
    } catch (err: any) {
      addToast('Failed to clear logs', 'error');
    }
  };

  // Run Sovereign AI Localized Inference
  const runSovereignInference = async (region: 'IN' | 'EU' | 'US') => {
    setIsInferring(true);
    setInferenceResult(null);
    setAnimatingRegion(region);
    
    // Coordinates representing map locations:
    // Center Orchestrator (London/Global): (280, 110)
    // India (ap-south-1): (430, 160)
    // Europe (eu-west-1): (260, 85)
    // US (us-east-1): (130, 105)
    const startX = 280;
    const startY = 110;
    let targetX = 430;
    let targetY = 160;

    if (region === 'EU') {
      targetX = 260;
      targetY = 85;
    } else if (region === 'US') {
      targetX = 130;
      targetY = 105;
    }

    // Phase 1: Model weights travel to Local Enclave
    setPacketType('model');
    setPacketPos({ x: startX, y: startY });
    addToast(`Packaging model weights. Sending compute to ${region} enclave...`, 'info');

    // Simple multi-stage animation sequence
    setTimeout(() => {
      setPacketPos({ x: targetX, y: targetY });
    }, 100);

    setTimeout(async () => {
      // Phase 2: Compute locally at the Enclave on local database
      setPacketType(null);
      setPacketPos(null);
      
      try {
        const ledgerId = region === 'IN' ? 'ledger_india_9081' : region === 'EU' ? 'ledger_eu_4011' : 'ledger_us_7822';
        const res = await apiPost<SovereignInferenceResult>('/api/v1/ceo/sovereign/infer', {
          client_ip: region === 'IN' ? '203.0.113.12' : region === 'EU' ? '193.136.2.8' : '108.162.2.1',
          country_code: region,
          ledger_id: ledgerId,
          model_type: 'GraphSAGE',
          model_version: 'v3.4.1'
        });
        
        setInferenceResult(res);

        // Phase 3: Anonymized mathematical score travels back to Orchestrator
        setPacketType('score');
        setPacketPos({ x: targetX, y: targetY });
        
        setTimeout(() => {
          setPacketPos({ x: startX, y: startY });
        }, 100);

        setTimeout(() => {
          setPacketType(null);
          setPacketPos(null);
          setIsInferring(false);
          addToast(`Inference output returned successfully. Zero-Copy rules validated!`, 'success');
        }, 600);

      } catch (err: any) {
        addToast(err.message || 'Sovereign inference failed', 'error');
        setIsInferring(false);
        setPacketType(null);
        setPacketPos(null);
      }
    }, 600);
  };

  // Trigger Algorithmic Liquidity Swap Negotiation
  const executeLiquiditySwap = async () => {
    setIsNegotiating(true);
    setNegotiationResult(null);
    addToast(`Scanning treasury balances. Deficit detected in ${deficitCurrency}.`, 'info');
    try {
      const res = await apiPost<SwapNegotiationResult>('/api/v1/ceo/negotiate/swap', {
        deficit_currency: deficitCurrency,
        deficit_amount: deficitAmount,
        collateral_currency: deficitCurrency === 'EUR' ? 'USD' : 'EUR',
        partner_bank: partnerBank
      });
      setNegotiationResult(res);
      addToast(`Liquidity swap successfully negotiated & signed on Canton Network!`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Liquidity swap negotiation failed', 'error');
    } finally {
      setIsNegotiating(false);
    }
  };

  return (
    <div className="space-y-8 p-6 text-zinc-100 max-w-7xl mx-auto" data-theme={theme} data-font={font}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-500 animate-pulse" />
            God's Eye Resiliency Cockpit
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Global Resiliency Center: Adaptive Auto-Remediation loops, Federated Zero-Copy Geofencing, and Algorithmic Swap contracts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-ping" />
          <span className="text-xs text-zinc-400 font-mono bg-zinc-900 border border-zinc-850 px-3 py-1.5 rounded-lg">
            Sovereign Control: COMPLIANT (DPDP / GDPR)
          </span>
        </div>
      </div>

      {/* QUICK SYSTEM STATUS METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex items-center gap-4 shadow-xl">
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">Healer Agent State</span>
            <span className="text-sm font-bold text-white">IDLE / WATCHING</span>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex items-center gap-4 shadow-xl">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">Active Enclaves</span>
            <span className="text-sm font-bold text-white">3 regional clusters</span>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex items-center gap-4 shadow-xl">
          <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">Ledger Isolation</span>
            <span className="text-sm font-bold text-white">100% GEO-FENCED</span>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex items-center gap-4 shadow-xl">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-semibold">negotiation channels</span>
            <span className="text-sm font-bold text-white">M2M active (overnight)</span>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab('remediation')}
          className={cn(
            "pb-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2",
            activeTab === 'remediation' ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Terminal className="w-4 h-4" />
          Autonomous Code-Healer
        </button>
        <button
          onClick={() => setActiveTab('sovereign')}
          className={cn(
            "pb-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2",
            activeTab === 'sovereign' ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Globe className="w-4 h-4" />
          Sovereign AI Router
        </button>
        <button
          onClick={() => setActiveTab('swap')}
          className={cn(
            "pb-3 text-sm font-semibold transition-all border-b-2 flex items-center gap-2",
            activeTab === 'swap' ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Activity className="w-4 h-4" />
          Inter-Bank M2M Negotiation
        </button>
      </div>

      {/* TAB CONTENT AREAS */}
      <div className="grid grid-cols-1 gap-8">

        {/* 1. AUTONOMOUS HEALER TERMINAL */}
        {activeTab === 'remediation' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between h-[500px]">
              <div className="w-full flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Healer Agent Thinking Process</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPollingLogs(!isPollingLogs)}
                    className={cn(
                      "text-[10px] border px-2 py-1 rounded transition-all font-mono",
                      isPollingLogs ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "bg-indigo-950/20 border-indigo-900/40 text-indigo-400 hover:bg-indigo-950/30"
                    )}
                  >
                    {isPollingLogs ? "Pause Feed" : "Resume Feed"}
                  </button>
                  <button
                    onClick={clearHealerLogs}
                    className="text-[10px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 px-2 py-1 rounded transition-all font-mono"
                  >
                    Clear Console
                  </button>
                  <span className="text-[10px] text-zinc-500 font-mono">Status: active</span>
                </div>
              </div>

              {/* Console log display */}
              <div className="flex-1 bg-black/40 border border-zinc-900 rounded-lg p-4 font-mono text-[11px] text-zinc-300 overflow-y-auto space-y-1 my-4 leading-relaxed max-h-[380px]">
                {terminalLogs.length === 0 ? (
                  <div className="text-zinc-650 flex flex-col items-center justify-center h-full gap-2">
                    <Terminal className="w-8 h-8 text-zinc-700 animate-pulse" />
                    <span>Console idle. Trigger an auto-remediation run to view the self-healing steps.</span>
                  </div>
                ) : (
                  terminalLogs.map((log, index) => {
                    let colorClass = "text-zinc-400";
                    if (log.includes("CRITICAL")) colorClass = "text-rose-400 font-bold";
                    else if (log.includes("SUCCESS")) colorClass = "text-emerald-400 font-bold";
                    else if (log.includes("LLM Thought")) colorClass = "text-yellow-500/80 italic";
                    else if (log.includes("Invoking LangChain")) colorClass = "text-indigo-400 font-bold";
                    else if (log.includes("Git") || log.includes("Kubernetes")) colorClass = "text-teal-400";

                    return (
                      <div key={index} className="flex items-start gap-1.5">
                        <span className="text-indigo-650 font-bold select-none">&gt;</span>
                        <span className={colorClass}>{log}</span>
                      </div>
                    );
                  })
                )}
                <div ref={terminalBottomRef} />
              </div>

              <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between border-t border-zinc-900 pt-3">
                <span>Language: Python</span>
                <span>Target Daemon: healer_agent.py</span>
              </div>
            </div>

            {/* Healer configuration and trigger */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                    Auto-Remediation Controls
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Test the system's resilience by intentionally injecting a breaking vendor schema change in <code className="text-indigo-400 font-mono">vendor_client.py</code>.
                  </p>
                </div>

                <div className="bg-zinc-900/60 p-4 border border-zinc-850 rounded-lg space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block">Simulated Event</span>
                    <span className="text-xs text-white block font-semibold">Vendor API Schema Change</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block">Expected Error</span>
                    <span className="text-xs text-rose-400 font-mono block">KeyError: 'tax_id' (crashes tax-orchestrator)</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block">LLM Resolution Strategy</span>
                    <span className="text-xs text-zinc-300 block leading-relaxed">
                      Fallback mapping logic to safely check alternatives <code className="text-indigo-400 font-mono">.get("tax_id") or .get("tax_identifier")</code>.
                    </span>
                  </div>
                </div>

                <div className="bg-indigo-950/20 border border-indigo-900/40 p-4 rounded-lg space-y-2 text-xs">
                  <h4 className="font-semibold text-indigo-400 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" />
                    Deployment Execution
                  </h4>
                  <p className="text-zinc-400 leading-relaxed">
                    If the test suite passes, a rolling Kubernetes update is triggered, updating the microservice pod replicas with zero-downtime.
                  </p>
                </div>
              </div>

              <div className="border-t border-zinc-900 pt-6">
                <button
                  onClick={triggerAutoRemediation}
                  disabled={isRemediating}
                  className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/20"
                >
                  <RefreshCw className={cn("w-4 h-4", isRemediating && "animate-spin")} />
                  {isRemediating ? "Rebuilding & Healing..." : "Simulate Vendor API Break"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. SOVEREIGN AI GEOGRAPHY MAP */}
        {activeTab === 'sovereign' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between relative overflow-hidden h-[500px]">
              
              <div className="w-full flex items-center justify-between border-b border-zinc-900 pb-3 mb-2 z-10">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-indigo-400" />
                    Zero-Copy Geofenced AI Boundaries
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Visualizing compute models travelling to physical vaults. Raw data never exits boundaries.
                  </p>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono tracking-wider">
                  MIDDLEWARE: sovereign_router.py
                </div>
              </div>

              {/* High-Fidelity SVG World Map with boundaries */}
              <div className="relative w-full flex-1 flex items-center justify-center">
                <svg className="w-full h-full max-h-[380px]" viewBox="0 0 560 250" fill="none">
                  {/* Stylized world grid dots or land outline */}
                  <path d="M 60,60 Q 80,40 100,50 T 150,60 T 190,40 T 210,60 T 240,40 T 280,60 T 320,40 T 360,60 T 400,40 T 440,60 T 480,45" stroke="#222" strokeWidth="2" strokeDasharray="3,3" />
                  <path d="M 40,120 Q 80,100 110,130 T 160,110 T 220,125 T 280,115 T 350,130 T 420,110 T 480,120" stroke="#222" strokeWidth="2" strokeDasharray="3,3" />
                  
                  {/* Geofence zones */}
                  {/* India Zone */}
                  <circle cx="430" cy="160" r="50" fill="#a855f7" fillOpacity="0.03" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4,4" className={cn(animatingRegion === 'IN' && "animate-pulse")} />
                  {/* Europe Zone */}
                  <circle cx="260" cy="85" r="45" fill="#3b82f6" fillOpacity="0.03" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,4" className={cn(animatingRegion === 'EU' && "animate-pulse")} />
                  {/* US Zone */}
                  <circle cx="130" cy="105" r="55" fill="#10b981" fillOpacity="0.03" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4,4" className={cn(animatingRegion === 'US' && "animate-pulse")} />

                  {/* Vault and Enclave Nodes */}
                  {/* Central Hub (Global Orchestrator in US/UK border) */}
                  <g transform="translate(280, 110)">
                    <circle r="7" fill="#6366f1" className="animate-ping" />
                    <circle r="5" fill="#4f46e5" />
                    <text y="-10" textAnchor="middle" fill="#818cf8" className="text-[8px] font-mono font-bold">Orchestrator</text>
                  </g>

                  {/* India Vault */}
                  <g transform="translate(430, 160)" className="cursor-pointer" onClick={() => setSelectedRegion('IN')}>
                    <rect x="-20" y="-20" width="40" height="40" rx="8" fill="#180b2d" stroke="#a855f7" strokeWidth="1.5" />
                    <Database className="w-5 h-5 text-purple-400 x-center absolute translate-x-[-10px] translate-y-[-10px]" />
                    <Lock className="w-3.5 h-3.5 text-rose-400 absolute translate-x-[4px] translate-y-[2px]" />
                    <text y="30" textAnchor="middle" fill="#c084fc" className="text-[8px] font-sans font-bold">ap-south-1</text>
                  </g>

                  {/* EU Vault */}
                  <g transform="translate(260, 85)" className="cursor-pointer" onClick={() => setSelectedRegion('EU')}>
                    <rect x="-20" y="-20" width="40" height="40" rx="8" fill="#06122d" stroke="#3b82f6" strokeWidth="1.5" />
                    <Database className="w-5 h-5 text-blue-400 x-center absolute translate-x-[-10px] translate-y-[-10px]" />
                    <Lock className="w-3.5 h-3.5 text-rose-400 absolute translate-x-[4px] translate-y-[2px]" />
                    <text y="30" textAnchor="middle" fill="#93c5fd" className="text-[8px] font-sans font-bold">eu-west-1</text>
                  </g>

                  {/* US Vault */}
                  <g transform="translate(130, 105)" className="cursor-pointer" onClick={() => setSelectedRegion('US')}>
                    <rect x="-20" y="-20" width="40" height="40" rx="8" fill="#042018" stroke="#10b981" strokeWidth="1.5" />
                    <Database className="w-5 h-5 text-emerald-400 x-center absolute translate-x-[-10px] translate-y-[-10px]" />
                    <Lock className="w-3.5 h-3.5 text-rose-400 absolute translate-x-[4px] translate-y-[2px]" />
                    <text y="30" textAnchor="middle" fill="#6ee7b7" className="text-[8px] font-sans font-bold">us-east-1</text>
                  </g>

                  {/* Animated compute packet path */}
                  {packetPos && (
                    <g transform={`translate(${packetPos.x}, ${packetPos.y})`}>
                      <circle r="8" fill={packetType === 'model' ? '#eab308' : '#f43f5e'} className="animate-ping" fillOpacity="0.4" />
                      <circle r="4" fill={packetType === 'model' ? '#eab308' : '#f43f5e'} />
                      <text y="-8" textAnchor="middle" fill={packetType === 'model' ? '#fef08a' : '#fecdd3'} className="text-[7px] font-mono uppercase tracking-widest font-bold">
                        {packetType === 'model' ? 'Weights Transfer' : 'Anonymized Score'}
                      </text>
                    </g>
                  )}
                </svg>

                {/* Legend Overlay */}
                <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-900 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="text-zinc-400">Compute Weights</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-zinc-400">Mathematical Output</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-rose-400" />
                    <span className="text-zinc-400">PII Locked locally</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sovereign Inference trigger panel */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Lock className="w-5 h-5 text-indigo-400" />
                    Geofenced Underwriting
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Select a localized region. The router will package XGBoost/GraphSAGE weights, execute inside the secure enclave, and return only the anonymized mathematical score.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs text-zinc-400 block font-medium">Select Jurisdiction Region</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSelectedRegion('IN')}
                      className={cn(
                        "py-2 text-xs font-semibold rounded border transition-all",
                        selectedRegion === 'IN' ? "bg-purple-600/10 border-purple-500 text-purple-400" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      India (IN)
                    </button>
                    <button
                      onClick={() => setSelectedRegion('EU')}
                      className={cn(
                        "py-2 text-xs font-semibold rounded border transition-all",
                        selectedRegion === 'EU' ? "bg-blue-600/10 border-blue-500 text-blue-400" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      Europe (EU)
                    </button>
                    <button
                      onClick={() => setSelectedRegion('US')}
                      className={cn(
                        "py-2 text-xs font-semibold rounded border transition-all",
                        selectedRegion === 'US' ? "bg-emerald-600/10 border-emerald-500 text-emerald-400" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      United States (US)
                    </button>
                  </div>
                </div>

                {/* Localized scoring report display */}
                {inferenceResult && (
                  <div className="bg-zinc-900/60 p-4 border border-zinc-850 rounded-lg space-y-3 text-xs leading-relaxed">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="font-semibold text-white uppercase tracking-wider text-[9px]">Enclave Audit Record:</span>
                      <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-[9px] border border-green-500/20 font-bold">COMPLIANT</span>
                    </div>
                    <div className="space-y-1.5 text-zinc-400">
                      <div className="flex justify-between">
                        <span>Target Enclave:</span>
                        <span className="text-white font-mono">{inferenceResult.aws_nitro_enclave}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Compliance Framework:</span>
                        <span className="text-white font-semibold">{inferenceResult.data_governance.compliance_framework}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Model Weights Sent:</span>
                        <span className="text-yellow-400 font-mono">{inferenceResult.model_transferred.model_type} ({inferenceResult.model_transferred.payload_size_mb} MB)</span>
                      </div>
                      <div className="flex justify-between border-t border-zinc-850 pt-1.5 mt-1.5">
                        <span className="font-bold text-white">Credit Score:</span>
                        <span className="text-emerald-400 font-mono font-bold text-sm">{inferenceResult.inference_result.score} / 850</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Underwriting Decision:</span>
                        <span className="text-white font-semibold">{inferenceResult.inference_result.status}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-900 pt-6">
                <button
                  onClick={() => runSovereignInference(selectedRegion)}
                  disabled={isInferring}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/20"
                >
                  <Play className="w-4 h-4 fill-white" />
                  {isInferring ? "Transporting compute weights..." : "Run Sovereign Inference"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. INTER-BANK SWAPS */}
        {activeTab === 'swap' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Negotiation inputs */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between h-[500px]">
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    Deficit Liquidity parameters
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Treasury system monitors real-time currency gaps. Input parameters for M2M negotiation.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 block font-medium">Partner Bank AI Agent</label>
                    <select
                      value={partnerBank}
                      onChange={(e) => setPartnerBank(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Deutsche Bank AI">Deutsche Bank AI</option>
                      <option value="HSBC AI">HSBC AI</option>
                      <option value="Societe Generale AI">Societe Generale AI</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 block font-medium">Deficit Currency</label>
                      <select
                        value={deficitCurrency}
                        onChange={(e) => setDeficitCurrency(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="INR">INR</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 block font-medium">Required Amount</label>
                      <input
                        type="number"
                        value={deficitAmount}
                        onChange={(e) => setDeficitAmount(Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="bg-zinc-900/60 p-4 border border-zinc-850 rounded-lg text-xs leading-relaxed space-y-2 text-zinc-400">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block">Treasury gap alerts:</span>
                    <div className="flex justify-between">
                      <span>EUR Reserve balance:</span>
                      <span className="text-rose-400 font-mono">800,000 EUR</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Minimum target limit:</span>
                      <span className="text-white font-mono">5,000,000 EUR</span>
                    </div>
                    <div className="text-[9px] text-amber-500/80 font-mono mt-1">
                      ⚠️ ALERT: Liquidity deficit of 4.2M EUR detected.
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-900 pt-6">
                <button
                  onClick={executeLiquiditySwap}
                  disabled={isNegotiating}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/20"
                >
                  <Send className="w-4 h-4" />
                  {isNegotiating ? "Negotiating swap..." : "Initialize M2M Swap Negotiation"}
                </button>
              </div>
            </div>

            {/* Negotiation log and contract presentation */}
            <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between h-[500px] overflow-hidden">
              <div className="border-b border-zinc-900 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-indigo-400" />
                  Algorithmic Contract Agreement
                </h3>
              </div>

              {negotiationResult ? (
                <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
                  
                  {/* Negotiation steps */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase block">M2M Negotiation Rounds logs</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {negotiationResult.negotiation_history.map((step, idx) => (
                        <div key={idx} className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-lg text-xs space-y-1">
                          <div className="flex justify-between font-semibold">
                            <span className="text-zinc-400">Round {step.round}</span>
                            <span className={cn(
                              step.status === 'REJECTED' && "text-rose-400",
                              step.status === 'COUNTERED' && "text-amber-400",
                              step.status === 'AGREED' && "text-emerald-400"
                            )}>
                              {step.status}
                            </span>
                          </div>
                          <div className="text-white font-bold">{step.offered_by}</div>
                          <div className="text-zinc-500 font-mono">Proposed Fee: {step.fee_bps} bps</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Final Smart Contract payload */}
                  <div className="bg-zinc-900/40 p-4 border border-zinc-850 rounded-lg space-y-4 text-xs font-mono">
                    <div className="flex justify-between border-b border-zinc-800 pb-2">
                      <span className="font-bold text-white">CONTRACT ID: {negotiationResult.contract.swap_id}</span>
                      <span className="text-emerald-400 font-bold">APPROVED</span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-zinc-400">
                      <div>Initiator:</div>
                      <div className="text-white text-right">{negotiationResult.contract.parties.initiator}</div>
                      <div>Receiver:</div>
                      <div className="text-white text-right">{negotiationResult.contract.parties.receiver}</div>
                      <div>Funding amount:</div>
                      <div className="text-emerald-400 text-right font-bold">
                        {negotiationResult.contract.terms.funding_amount.toLocaleString()} {negotiationResult.contract.terms.funding_currency}
                      </div>
                      <div>Collateral swap value:</div>
                      <div className="text-white text-right">
                        {negotiationResult.contract.terms.collateral_value.toLocaleString()} {negotiationResult.contract.terms.collateral_currency}
                      </div>
                      <div>Exchange Rate:</div>
                      <div className="text-white text-right">{negotiationResult.contract.terms.exchange_rate}</div>
                      <div>Final Swap Fee:</div>
                      <div className="text-indigo-400 text-right font-bold">
                        {negotiationResult.contract.terms.swap_fee_bps} bps ({negotiationResult.contract.terms.swap_fee_value.toLocaleString()} {negotiationResult.contract.terms.funding_currency})
                      </div>
                    </div>

                    {/* Cryptographic signatures */}
                    <div className="border-t border-zinc-800 pt-3 space-y-2">
                      <span className="text-[10px] text-zinc-500 font-semibold block">Cryptographic agent signatures</span>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-900 text-[10px]">
                          <Key className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <div className="truncate flex-1">
                            <span className="text-zinc-500">cl_agent:</span> {negotiationResult.contract.cryptographic_signatures.credit_line_agent}
                          </div>
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-900 text-[10px]">
                          <Key className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <div className="truncate flex-1">
                            <span className="text-zinc-500">partner_agent:</span> {negotiationResult.contract.cryptographic_signatures.partner_bank_agent}
                          </div>
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex-1 text-zinc-650 flex flex-col items-center justify-center gap-2">
                  <FileCode className="w-8 h-8 text-zinc-700 animate-pulse" />
                  <span>Negotiation contract screen idle. Initiate a swap run to view.</span>
                </div>
              )}

              <div className="text-[10px] text-zinc-500 font-mono flex items-center justify-between border-t border-zinc-900 pt-3">
                <span>Protocol: Canton Network Smart contract v1.2</span>
                <span>Gas Cost: {negotiationResult?.settlement.gas_fees_gwei || 0} gwei</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Float Toasts System */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 w-96 font-sans">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "p-4 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-xl animate-slide-in text-xs font-semibold leading-relaxed",
              t.type === 'success' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
              t.type === 'error' && "bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400",
              t.type === 'info' && "bg-indigo-500/10 border-indigo-500/30 text-indigo-500 dark:text-indigo-400"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 size={15} />}
              {t.type === 'error' && <ShieldAlert size={15} />}
              {t.type === 'info' && <RefreshCw size={15} className="animate-spin" />}
            </div>
            <p className="flex-1">{t.message}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
