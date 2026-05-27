import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, CheckCircle2, AlertTriangle, Download, Terminal, Info, Globe, ShieldAlert,
  Search, ArrowRight, Send, Building2, Landmark, X
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';

// Interfaces
interface ServiceStatus {
  id: string;
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  replicas: number;
  uptime: string;
}

interface GenesisStatus {
  status: string;
  mesh_health: number;
  istio_mtls: string;
  kubernetes_cluster: string;
  nodes_active: number;
  services: ServiceStatus[];
}

interface DCFResults {
  projected_fcfs: number[];
  present_values_fcfs: number[];
  terminal_value: number;
  pv_terminal_value: number;
  enterprise_value: number;
  implied_equity_value: number;
  wacc: number;
  terminal_growth: number;
}

interface MAScanResponse {
  target_name: string;
  wacc: number;
  dcf: DCFResults;
  proposed_offer_val?: number; // compat
  proposed_offer_inr?: number;
  target_market_cap_inr: number;
  premium_percentage: number;
  loi_document: string;
}

interface FXRouteResponse {
  success: boolean;
  path: string[];
  net_amount: number;
  fees: number;
  networks: string[];
  execution_engine: string;
  error?: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// 3D City definitions for Canvas Globe
const CITIES = [
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, color: '#A855F7' },
  { name: 'London', lat: 51.5074, lon: -0.1278, color: '#3B82F6' },
  { name: 'New York', lat: 40.7128, lon: -74.0060, color: '#10B981' },
  { name: 'Frankfurt', lat: 50.1109, lon: 8.6821, color: '#EF4444' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, color: '#F59E0B' }
];

export default function OmniMonopolyDashboard() {
  const { theme, font } = useAppStore();

  // Local Toast System
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef<number>(0);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = `toast-${++toastCounter.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Globe Canvas reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const angleRef = useRef<number>(0);

  // Genesis Boot terminal state
  const [bootSequenceActive, setBootSequenceActive] = useState<boolean>(true);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [bootIndex, setBootIndex] = useState<number>(0);
  const [genesisStatus, setGenesisStatus] = useState<GenesisStatus | null>(null);

  // M&A Scan state
  const [targetName, setTargetName] = useState<string>('Apex Credit Systems');
  const [marketCap, setMarketCap] = useState<number>(14500000);
  const [targetDebt, setTargetDebt] = useState<number>(3500000);
  const [costEquity, setCostEquity] = useState<number>(10.5); // %
  const [costDebt, setCostDebt] = useState<number>(6.5);   // %
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [maReport, setMaReport] = useState<MAScanResponse | null>(null);
  const [showLoiDrawer, setShowLoiDrawer] = useState<boolean>(false);

  // FX Routing state
  const [fxSource, setFxSource] = useState<string>('INR');
  const [fxTarget, setFxTarget] = useState<string>('EUR');
  const [fxAmount, setFxAmount] = useState<number>(10000000);
  const [isRouting, setIsRouting] = useState<boolean>(false);
  const [fxRoute, setFxRoute] = useState<FXRouteResponse | null>(null);

  // Fetch status on boot
  useEffect(() => {
    fetchGenesisStatus();
  }, []);

  const fetchGenesisStatus = async () => {
    try {
      const res = await apiGet<GenesisStatus>('/api/v1/ceo/genesis/status');
      setGenesisStatus(res);
    } catch (err: any) {
      addToast(err.message || 'Failed to fetch Genesis mesh status', 'error');
    }
  };

  // Run M&A Valuation Scan
  const handleMAScan = async () => {
    setIsScanning(true);
    setMaReport(null);
    try {
      const res = await apiPost<MAScanResponse>('/api/v1/ceo/ma/scan', {
        name: targetName,
        equity_market_cap: marketCap,
        debt_value: targetDebt,
        cost_of_equity: costEquity / 100.0,
        cost_of_debt: costDebt / 100.0,
        tax_rate: 0.25,
        base_fcf: 1800000.0,
        growth_rates: [0.22, 0.18, 0.14, 0.10, 0.07],
        terminal_growth: 0.03,
        cash: 1500000.0
      });
      setMaReport(res);
      addToast('M&A Valuation Scan completed successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'M&A Valuation scan failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Run FX Route Optimization
  const handleFXRoute = async () => {
    setIsRouting(true);
    setFxRoute(null);
    try {
      const res = await apiPost<FXRouteResponse>('/api/v1/ceo/fx/route', {
        source: fxSource,
        target: fxTarget,
        amount: fxAmount
      });
      setFxRoute(res);
      addToast('cheapest FX route calculated successfully', 'success');
    } catch (err: any) {
      addToast(err.message || 'FX Routing optimization failed', 'error');
    } finally {
      setIsRouting(false);
    }
  };

  // Genesis Boot Log Pipeline Simulation
  useEffect(() => {
    if (!bootSequenceActive) return;

    const bootMessages = [
      'INITIALIZING GENESIS BOOT STRAPRail...',
      'Connecting to Kubernetes cluster: k8s.production.creditline.io...',
      'Injecting Istio Mutual TLS (mTLS) zero-trust sidecars...',
      'Mounting persistent volume claims for Postgres & Kafka...',
      '[OK] Confluent Kafka Event Broker synchronized (Replicas: 3)',
      '[OK] Postgres Ledger Invariant Engine mounted (Replicas: 2)',
      '[OK] Redis active transaction cache online (Replicas: 2)',
      'Spinning up sovereign ingestion gateways...',
      '[OK] Rust Transaction Ingestion Rail operational (Replicas: 6)',
      'Loading model checkpoints into memory...',
      '[OK] PyTorch Credit Underwriting models loaded (Replicas: 3)',
      '[OK] CFO Strategy LSTM forecasting engine active (Replicas: 2)',
      'Compiling Zero-Knowledge proving keys...',
      '[OK] ZK-SNARK Solvency Auditor Prover online (Replicas: 2)',
      '[OK] Sharpe Treasury Yield Sweeper active (Replicas: 2)',
      'Orchestrating administrative strategic layers...',
      '[OK] CEO Strategy decision boards loaded (Replicas: 2)',
      'GENESIS MATRIX SYNCHRONIZED. Platform operational.'
    ];

    if (bootIndex < bootMessages.length) {
      const timeout = setTimeout(() => {
        setBootLogs(prev => [...prev, bootMessages[bootIndex]]);
        setBootIndex(prev => prev + 1);
      }, bootIndex === 0 ? 100 : 250);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setBootSequenceActive(false);
        addToast('Credit Line fintech platform boot sequence complete!', 'success');
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [bootSequenceActive, bootIndex]);

  // 3D Canvas Globe Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const r = Math.min(width, height) * 0.4;
      const cx = width / 2;
      const cy = height / 2;

      // Spin rotation
      angleRef.current += 0.005;
      const angle = angleRef.current;

      // Draw Grid / Wireframe Globe
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      
      // Latitude bands
      for (let latDeg = -60; latDeg <= 60; latDeg += 20) {
        ctx.beginPath();
        const latRad = (latDeg * Math.PI) / 180;
        const latR = r * Math.cos(latRad);
        const latY = cy + r * Math.sin(latRad);
        
        ctx.ellipse(cx, latY, latR, latR * 0.2, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Longitude bands
      for (let lonDeg = 0; lonDeg < 180; lonDeg += 30) {
        ctx.beginPath();
        const lonRad = (lonDeg * Math.PI) / 180;
        ctx.ellipse(cx, cy, r * Math.sin(lonRad + angle), r, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // Draw Globe Outer boundary
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();

      // Convert Cities Lat/Lon to 3D and project
      const projectedCities = CITIES.map(city => {
        const latRad = (city.lat * Math.PI) / 180;
        const lonRad = (city.lon * Math.PI) / 180;

        // Spherical to 3D Cartesian
        const x3d = r * Math.cos(latRad) * Math.sin(lonRad);
        const y3d = -r * Math.sin(latRad); // Invert Y for screen space
        const z3d = r * Math.cos(latRad) * Math.cos(lonRad);

        // Rotate Y-axis (Spin)
        const rotX = x3d * Math.cos(angle) - z3d * Math.sin(angle);
        const rotZ = x3d * Math.sin(angle) + z3d * Math.cos(angle);

        // Screen space
        const screenX = cx + rotX;
        const screenY = cy + y3d;

        return {
          ...city,
          sx: screenX,
          sy: screenY,
          sz: rotZ, // z-depth for rendering order
          visible: rotZ > -20 // show only when on the front facing hemisphere
        };
      });

      // Draw glowing routing arcs (connecting nodes: e.g. Mumbai -> London -> NY -> Tokyo)
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      
      const drawArc = (fromCity: typeof projectedCities[0], toCity: typeof projectedCities[0], strokeColor: string) => {
        if (!fromCity.visible || !toCity.visible) return;
        ctx.strokeStyle = strokeColor;
        ctx.shadowColor = strokeColor;
        ctx.beginPath();
        ctx.moveTo(fromCity.sx, fromCity.sy);
        
        // Control point for curve arching upwards
        const midX = (fromCity.sx + toCity.sx) / 2;
        const midY = (fromCity.sy + toCity.sy) / 2 - 40;
        
        ctx.quadraticCurveTo(midX, midY, toCity.sx, toCity.sy);
        ctx.stroke();
      };

      drawArc(projectedCities[0], projectedCities[1], '#A855F7'); // Mumbai -> London
      drawArc(projectedCities[1], projectedCities[2], '#3B82F6'); // London -> NY
      drawArc(projectedCities[2], projectedCities[4], '#10B981'); // NY -> Tokyo
      drawArc(projectedCities[0], projectedCities[3], '#EF4444'); // Mumbai -> Frankfurt

      // Draw City nodes
      ctx.shadowBlur = 0; // reset shadow
      projectedCities.forEach(city => {
        if (!city.visible) return;

        // Draw dot glow
        ctx.beginPath();
        ctx.fillStyle = city.color;
        ctx.shadowColor = city.color;
        ctx.shadowBlur = 10;
        ctx.arc(city.sx, city.sy, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.shadowBlur = 0; // reset

        // Draw name label
        ctx.fillStyle = '#fff';
        ctx.font = '10px font-sans';
        ctx.fillText(city.name, city.sx + 8, city.sy + 3);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-8 p-6 text-zinc-100 max-w-7xl mx-auto" data-theme={theme} data-font={font}>
      {/* ─── TERMINAL COCKPIT BOOT PREVIEW ──────────────────────────────────── */}
      {bootSequenceActive && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 font-mono">
          <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
            <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-zinc-500">Credit Line Genesis Boot sequence v4.0.0</span>
            </div>
            <div className="flex-1 p-6 overflow-y-auto space-y-1.5 text-xs text-green-400 max-h-[440px] flex flex-col justify-end">
              {bootLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
                  <span className={cn(log.startsWith('[OK]') ? "text-green-400 font-bold" : "text-zinc-400")}>
                    {log}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-4 bg-green-400 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-indigo-500 animate-pulse" />
            CEO Command Room
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Global Strategy Matrix: Private Equity DCF/WACC Valuations, Multi-hop FX Settlements, and Genesis k8s orchestration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
            K8s Node Status: SYNCED (18 Nodes)
          </span>
        </div>
      </div>

      {/* ─── ROW 1: GENESIS DEPLOYMENT MATRIX ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Globe Visualization */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800/80 rounded-xl p-6 shadow-2xl flex flex-col items-center justify-between relative overflow-hidden">
          <div className="w-full flex items-center justify-between border-b border-zinc-900 pb-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                Global Liquidity Flows
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Real-time active cross-border CBDC & Stellar/Ripple blockchain settlements.
              </p>
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
              mTLS Status: STRICT
            </div>
          </div>

          <div className="relative w-full h-80 flex items-center justify-center">
            <canvas ref={canvasRef} width={450} height={320} className="max-w-full" />
            <div className="absolute bottom-2 left-2 text-[9px] text-zinc-500 font-mono bg-zinc-900/60 p-2 rounded border border-zinc-850">
              Active Rails: stellar-pool-inr, ripple-net-usdc, sovereign-erupi
            </div>
          </div>
        </div>

        {/* Helm Microservice Status */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-6 shadow-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-zinc-900 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-400" />
                Genesis Mesh Ingress
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Resource allocation and replicas status from `helm/values.yaml`.
              </p>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {genesisStatus?.services.map((svc) => (
                <div key={svc.id} className="flex items-center justify-between text-xs p-2 bg-zinc-900/50 rounded border border-zinc-850">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-white block">{svc.name}</span>
                    <span className="text-[10px] text-zinc-500">Replicas: {svc.replicas} | Uptime: {svc.uptime}</span>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold tracking-wider",
                    svc.status === 'HEALTHY' ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                  )}>
                    {svc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-4 mt-4 text-[10px] text-zinc-500 font-mono flex items-center justify-between">
            <span>Cluster: k8s.production.creditline.io</span>
            <span>Mesh Health: {(genesisStatus?.mesh_health ? genesisStatus.mesh_health * 100 : 99.2).toFixed(1)}%</span>
          </div>
        </div>

      </div>

      {/* ─── ROW 2: M&A SCANNERS & FX TRIANGULAR ROUTER ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: M&A Scanners */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-6 shadow-2xl flex flex-col justify-between gap-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                Autonomous Private Equity Valuation
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Continuous M&A target screening using WACC & 5-year Discounted Cash Flow.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 block font-medium">Target Company Name</label>
                <input
                  type="text"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 block font-medium">Target Market Cap (INR)</label>
                <input
                  type="number"
                  value={marketCap}
                  onChange={(e) => setMarketCap(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 block font-medium">Target Debt Value (INR)</label>
                <input
                  type="number"
                  value={targetDebt}
                  onChange={(e) => setTargetDebt(Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 block font-medium">Cost of Equity</label>
                  <input
                    type="number"
                    value={costEquity}
                    onChange={(e) => setCostEquity(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 block font-medium">Cost of Debt</label>
                  <input
                    type="number"
                    value={costDebt}
                    onChange={(e) => setCostDebt(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Valuation Results */}
            {maReport && (
              <div className="bg-zinc-900/60 p-4 border border-zinc-850 rounded-lg space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="font-semibold text-white uppercase tracking-wider text-[10px]">Valuation scan metrics:</span>
                  <span className="font-mono text-indigo-400">Calculated WACC: {(maReport.wacc * 100).toFixed(2)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-zinc-400">
                  <div className="flex justify-between">
                    <span>Enterprise Value (EV):</span>
                    <span className="text-white font-mono">{formatCurrency(maReport.dcf.enterprise_value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Implied Equity Value:</span>
                    <span className="text-white font-mono">{formatCurrency(maReport.dcf.implied_equity_value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Proposed Offer Price (85%):</span>
                    <span className="text-emerald-400 font-semibold font-mono">
                      {formatCurrency(maReport.proposed_offer_inr || maReport.proposed_offer_val || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Takeover Premium:</span>
                    <span className={cn("font-bold", maReport.premium_percentage > 0 ? "text-green-400" : "text-rose-400")}>
                      {maReport.premium_percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowLoiDrawer(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded font-medium border border-indigo-500/20 transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Preview Generated Letter of Intent (LOI)
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-900 pt-4">
            <button
              onClick={handleMAScan}
              disabled={isScanning}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              {isScanning ? "Evaluating Financials..." : "Run M&A Target Valuation"}
            </button>
          </div>
        </div>

        {/* Right Column: FX Arbitrage Routing */}
        <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-6 shadow-2xl flex flex-col justify-between gap-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-400" />
                Triangular FX & CBDC Router
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Optimizes currency pathways through sovereign CBDCs and liquidity pools.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 block font-medium">Source Currency</label>
                <select
                  value={fxSource}
                  onChange={(e) => setFxSource(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="flex justify-center pb-2">
                <ArrowRight className="w-5 h-5 text-zinc-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 block font-medium">Target Currency</label>
                <select
                  value={fxTarget}
                  onChange={(e) => setFxTarget(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-zinc-400 block font-medium">Transfer Amount</label>
              <input
                type="number"
                value={fxAmount}
                onChange={(e) => setFxAmount(Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Path Display */}
            {fxRoute && fxRoute.success && (
              <div className="bg-zinc-900/60 p-4 border border-zinc-850 rounded-lg space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="font-semibold text-white uppercase tracking-wider text-[10px]">Optimal Settlement rail:</span>
                  <span className="font-mono text-[9px] text-zinc-500">{fxRoute.execution_engine}</span>
                </div>
                
                {/* Visual Route Hops */}
                <div className="flex items-center flex-wrap gap-2 py-2">
                  {fxRoute.path.map((currency, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-indigo-950 border border-indigo-500/30 text-indigo-300 font-mono rounded font-bold">
                        {currency}
                      </span>
                      {idx < fxRoute.path.length - 1 && (
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] text-zinc-500 font-mono">{fxRoute.networks[idx]}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-zinc-400 border-t border-zinc-800 pt-2">
                  <div>Net Settled Amount:</div>
                  <div className="text-white text-right font-mono font-semibold">
                    {fxTarget} {fxRoute.net_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div>Estimated Routing Fees:</div>
                  <div className="text-rose-400 text-right font-mono">
                    {fxSource} {fxRoute.fees.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-900 pt-4">
            <button
              onClick={handleFXRoute}
              disabled={isRouting || fxSource === fxTarget}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isRouting ? "Finding optimal rails..." : "Run Cross-Border Router"}
            </button>
          </div>
        </div>

      </div>

      {/* ─── LOI PREVIEW DRAWER ──────────────────────────────────────────────── */}
      {showLoiDrawer && maReport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-zinc-950 h-screen border-l border-zinc-850 p-6 flex flex-col justify-between shadow-2xl animate-slide-in">
            <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  M&A Draft Letter of Intent
                </h3>
                <button
                  onClick={() => setShowLoiDrawer(false)}
                  className="p-1 hover:bg-zinc-900 rounded text-zinc-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <textarea
                value={maReport.loi_document}
                readOnly
                className="w-full flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-[10px] text-zinc-300 focus:outline-none resize-none overflow-y-auto leading-relaxed"
              />
            </div>
            
            <div className="border-t border-zinc-900 pt-4 mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowLoiDrawer(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 text-sm font-semibold rounded-lg"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([maReport.loi_document], { type: 'text/plain' });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `LOI_${maReport.target_name.replace(/\s+/g, '_')}.txt`;
                  link.click();
                  addToast('LOI document downloaded successfully', 'success');
                }}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-indigo-950/20"
              >
                <Download className="w-4 h-4" />
                Download Document
              </button>
            </div>
          </div>
        </div>
      )}

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
              {t.type === 'error' && <AlertTriangle size={15} />}
              {t.type === 'info' && <Info size={15} />}
            </div>
            <p className="flex-1">{t.message}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
