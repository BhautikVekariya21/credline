import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  CreditCard,
  Database,
  FileCheck2,
  FileText,
  Globe,
  LineChart,
  Network,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
  TrendingUp,
  Bot,
  Cpu,
  Scale,
  Banknote,
} from 'lucide-react';
import { cn } from '../lib/utils';


/* ─── Scroll reveal hook ────────────────────────────────────────────── */
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisible(true);
        el.classList.add('is-visible');
        obs.unobserve(el);
      }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

export default function HomePage() {
  return (
    <div className="public-page font-sans bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      <Hero />
      <TrustBar />
      <ValueSimulatorSection />
      <AgentOrchestrationSection />
      <PlatformShowcase />
      <ServicesGrid />
      <HowItWorks />
      <Testimonials />
      <IntegrationLogos />
      <FinalCTA />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════════════ */
function Hero() {
  const [totalVolume, setTotalVolume] = useState(8349120490);

  useEffect(() => {
    const interval = setInterval(() => {
      setTotalVolume(prev => prev + Math.floor(Math.random() * 8500) + 1500);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden pt-32 pb-24 border-b border-[var(--border-secondary)]">
      {/* Background Gradient Mesh */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[60%] rounded-full bg-gradient-to-tr from-eshodha-500/10 to-brand-soft/20 blur-[130px] dark:from-eshodha-600/15 dark:to-brand-soft/5" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[65%] h-[70%] rounded-full bg-gradient-to-br from-brand-green/8 via-eshodha-400/5 to-transparent blur-[160px] dark:from-brand-green/5" />
        <div className="absolute top-[20%] right-[10%] w-[45%] h-[50%] rounded-full bg-eshodha-300/10 blur-[110px] dark:bg-eshodha-200/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,var(--bg-primary)_85%)]" />
        <div className="absolute inset-0 bg-grid-white/[0.02] dark:bg-grid-black/[0.02]" />
      </div>

      <div className="public-wrap relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        <div className="lg:col-span-6 space-y-6">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-eshodha-500/20 text-xs font-semibold text-eshodha-500 shadow-sm hover:border-eshodha-500/40 transition-colors">
            <span className="w-2 h-2 rounded-full bg-eshodha-500 animate-pulse" />
            <span className="font-mono tracking-wide text-[10px] text-[var(--text-secondary)]">SYSTEM REVENUE VELOCITY:</span>
            <span className="font-mono font-extrabold">₹{totalVolume.toLocaleString('en-IN')}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] font-display text-[var(--text-primary)]">
            Autonomous <br />
            FinOps & Sovereign <br />
            <span className="bg-gradient-to-r from-eshodha-500 via-[#d3827b] to-[#f0c8b8] bg-clip-text text-transparent drop-shadow-sm">Corporate Ledgers.</span>
          </h1>

          <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-xl font-normal">
            <strong>eshodha fintech solution</strong> shifts enterprise financial operations into an absolute, autonomous monopoly. Continuous double-entry verification loops compile journals, reconcile purchases, and forecast liquidity runaways with board-ready attributions.
          </p>

          <div className="flex flex-wrap items-center gap-3.5 pt-2">
            <Link to="/admin" className="px-6 py-3.5 rounded-xl bg-eshodha-500 hover:bg-eshodha-600 text-white font-bold text-sm shadow-md hover:shadow-lg hover:shadow-eshodha-500/10 transition-all duration-200 flex items-center gap-2 group">
              Start Admin Console <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
            <Link to="/services" className="px-6 py-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] font-bold text-sm transition-all duration-200 flex items-center gap-1.5">
              Explore Services <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-[var(--border-secondary)]">
            <div>
              <span className="block text-2xl font-extrabold text-[var(--text-primary)] font-mono">100%</span>
              <span className="block text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider mt-0.5">Invariance Checked</span>
            </div>
            <div>
              <span className="block text-2xl font-extrabold text-[var(--text-primary)] font-mono">&lt;15ms</span>
              <span className="block text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider mt-0.5">Risk Intervention</span>
            </div>
            <div>
              <span className="block text-2xl font-extrabold text-[var(--text-primary)] font-mono">SOC2</span>
              <span className="block text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider mt-0.5">Audited Sandbox</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 flex justify-center">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  const [tick, setTick] = useState(0);
  const [invarianceDiff, setInvarianceDiff] = useState(0.00);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      // Small fluctuation in invariance calculation which auto-resolves
      setInvarianceDiff(Math.random() < 0.1 ? 12450.00 : 0.00);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const entries = [
    { id: 'JRN-48092', label: 'GST CGST/SGST Split Verified', status: 'Balanced', value: '₹12,45,000.00', color: 'text-risk-low' },
    { id: 'JRN-11029', label: 'GSTR-2B Fuzzy Match Complete', status: 'Reconciled', value: '₹5,82,500.00', color: 'text-risk-low' },
    { id: 'CTA-88301', label: 'Payment: Blacklisted Vendor Blocked', status: 'Auto-Hold', value: '₹4,50,000.00', color: 'text-risk-high' },
    { id: 'JRN-55102', label: 'ITR-6 Schedule BS Aggregated', status: 'GAAP Valid', value: '₹75,00,000.00', color: 'text-eshodha-500' },
  ];
  const active = tick % entries.length;

  return (
    <div className="relative group w-full max-w-md">
      {/* Visual background glow around dashboard */}
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-eshodha-500 to-brand-soft opacity-20 blur-lg group-hover:opacity-30 transition-opacity duration-300" />
      
      <div className="relative w-full rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] shadow-2xl overflow-hidden font-mono text-[11px] backdrop-blur-md">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-[var(--border-secondary)] px-4 py-3.5 bg-[var(--bg-secondary)]/50">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e07060]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#d4a84b]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#4eba7a]" />
          </div>
          <span className="text-[10px] font-extrabold text-[var(--text-tertiary)] tracking-widest uppercase">ESHODHA FINOPS COCKPIT</span>
          <div className="flex items-center gap-1.5 text-[9px] text-[#4eba7a] font-bold bg-[#4eba7a]/8 border border-[#4eba7a]/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4eba7a] animate-ping" />
            LIVE CDC
          </div>
        </div>

        {/* Main Console view */}
        <div className="p-5 space-y-4">
          {/* Double-entry Balance Visualizer */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 space-y-3">
            <div className="flex items-center justify-between text-[9px] text-[var(--text-tertiary)] font-bold">
              <span>LEDGER BALANCE INVARIANCE: ∑(D) - ∑(C)</span>
              {invarianceDiff === 0 ? (
                <span className="text-[#4eba7a] font-extrabold bg-[#4eba7a]/8 px-1.5 py-0.5 rounded">Δ = 0.00 (GAAP BALANCED)</span>
              ) : (
                <span className="text-[#e07060] font-extrabold bg-[#e07060]/8 px-1.5 py-0.5 rounded animate-pulse">RE-ALIGNING LEDGER</span>
              )}
            </div>
            <div className="flex items-center justify-around py-1 bg-[var(--bg-card)] rounded-lg border border-[var(--border-secondary)] p-2">
              <div className="text-center">
                <span className="block text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">DEBITS</span>
                <span className="text-xs font-extrabold text-[var(--text-primary)]">₹83,21,450.00</span>
              </div>
              <div className="h-6 w-px bg-[var(--border-secondary)]" />
              <div className="text-center">
                <span className="block text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">CREDITS</span>
                <span className="text-xs font-extrabold text-[var(--text-primary)]">₹83,21,450.00</span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--border-secondary)]">
              <div 
                className={cn('h-full transition-all duration-500', invarianceDiff === 0 ? 'bg-[#4eba7a]' : 'bg-[#e07060]')} 
                style={{ width: invarianceDiff === 0 ? '100%' : '90%' }} 
              />
            </div>
          </div>

          {/* Ledger Event stream */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[9px] text-[var(--text-tertiary)] font-bold">
              <span>CDC WRITE-AHEAD LOG STREAM</span>
              <span className="text-eshodha-500">PQC SIGNED</span>
            </div>
            <div className="space-y-2">
              {entries.map((item, idx) => (
                <div 
                  key={item.id} 
                  className={cn(
                    'p-3 rounded-xl border transition-all duration-300 flex items-center justify-between', 
                    idx === active 
                      ? 'bg-eshodha-500/5 border-eshodha-500/30 scale-[1.02] shadow-sm' 
                      : 'bg-transparent border-transparent opacity-45'
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[var(--text-primary)]">{item.id}</span>
                      <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold font-sans', idx === active ? 'bg-eshodha-500/10 text-eshodha-500 border border-eshodha-500/20' : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]')}>
                        {item.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] block mt-1 truncate">{item.label}</span>
                  </div>
                  <span className={cn('font-extrabold font-mono text-[var(--text-primary)] text-right pl-3', idx === active && item.color === 'text-risk-high' ? 'text-[#e07060]' : idx === active && item.color === 'text-risk-low' ? 'text-[#4eba7a]' : '')}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TRUST BAR
   ═══════════════════════════════════════════════════════════════════════ */
const TRUST_BADGES = [
  { label: 'GAAP Compliant', icon: '⚖️' },
  { label: 'Ind-AS Certified', icon: '🏦' },
  { label: 'SOC 2 Type II Compliance', icon: '🛡️' },
  { label: 'FCA & SEC Frameworks', icon: '🏛️' },
  { label: 'Income Tax s269ST Ready', icon: '✍️' },
  { label: 'PCI DSS Level 1 Security', icon: '🔐' },
  { label: 'RBI Account Aggregator Link', icon: '🔗' },
  { label: 'Post-Quantum Vault Enabled', icon: '⚡' },
];

function TrustBar() {
  return (
    <div className="py-5 border-y border-[var(--border-secondary)] bg-[var(--bg-secondary)]/30 overflow-hidden backdrop-blur-sm">
      <div className="public-wrap flex items-center justify-between gap-6">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--text-tertiary)] whitespace-nowrap flex-shrink-0">
          REGULATORY PROTOCOLS
        </span>
        <div className="relative w-full overflow-hidden">
          <div className="flex items-center gap-12 animate-shimmer whitespace-nowrap">
            {TRUST_BADGES.concat(TRUST_BADGES).map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                <span>{b.icon}</span> {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INTERACTIVE VALUE SIMULATOR (ADJUSTABLE COCKPIT)
   ═══════════════════════════════════════════════════════════════════════ */
function ValueSimulatorSection() {
  const { ref } = useReveal();

  const [threshold, setThreshold] = useState(0.85);

  // Simulation calculations based on threshold
  const approvalRate = Math.round((1 - Math.pow(1 - threshold, 2.5)) * 98.4 * 10) / 10;
  const fraudPrevented = Math.round(threshold * 99.2 * 10) / 10;
  const creditLossRate = Math.round(Math.max(0.4, (1 - threshold) * 5.2) * 10) / 10;
  const annualSavings = Math.round((approvalRate * 1.8 + fraudPrevented * 2.4 - creditLossRate * 0.8) * 100_000);

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="py-20 border-b border-[var(--border-secondary)] bg-[var(--bg-card)] reveal">
      <div className="public-wrap grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5 space-y-6">
          <p className="text-xs font-bold uppercase tracking-widest text-eshodha-500">
            Interactive Control Center
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-[var(--text-primary)]">
            Adjust risk boundaries. Optimize revenue flow.
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            Drag the slider to adjust **eshodha’s** target risk threshold. See how our machine learning models balance customer transaction approvals against security and regulatory loss mitigations.
          </p>
          <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] space-y-2">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] block">Sovereign Decision Matrix</span>
            <p className="text-xs text-[var(--text-secondary)]">
              Higher thresholds strict-audit vendor routes, while lower parameters reduce user friction.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="card p-6 border border-[var(--border-primary)] bg-[var(--bg-primary)] rounded-3xl shadow-xl space-y-6">
            {/* Slider control */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-[var(--text-primary)]">
                <span>Target Risk Threshold: {(threshold * 100).toFixed(0)}%</span>
                <span className="text-eshodha-500">{(100 - threshold * 100).toFixed(0)}% Risk Tolerance</span>
              </div>
              <input
                type="range"
                min="0.30"
                max="0.98"
                step="0.01"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer accent-eshodha-500"
              />
              <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] font-semibold">
                <span>Aggressive (Frictionless)</span>
                <span>Balanced</span>
                <span>Conservative (High Security)</span>
              </div>
            </div>

            {/* Simulated outputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-primary)] flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">Transaction Approvals</span>
                <div className="text-2xl font-extrabold text-[var(--text-primary)] font-mono my-2">{approvalRate}%</div>
                <div className="flex items-center gap-1 text-[10px] text-risk-low">
                  <TrendingUp size={12} />
                  <span>Approved Safely</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-primary)] flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">Fraud Intercepted</span>
                <div className="text-2xl font-extrabold text-[var(--text-primary)] font-mono my-2">{fraudPrevented}%</div>
                <div className="flex items-center gap-1 text-[10px] text-risk-low">
                  <CheckCircle2 size={12} />
                  <span>Threats Blocked</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-primary)] flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">Credit Default Rate</span>
                <div className="text-2xl font-extrabold text-[var(--text-primary)] font-mono my-2">{creditLossRate}%</div>
                <div className="flex items-center gap-1 text-[10px] text-risk-medium">
                  <Activity size={12} />
                  <span>Managed Losses</span>
                </div>
              </div>
            </div>

            {/* Overall bottom line savings */}
            <div className="p-4 rounded-2xl bg-eshodha-500/5 border border-eshodha-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-eshodha-500 uppercase tracking-widest block">Projected FinOps Savings</span>
                <span className="text-xs text-[var(--text-secondary)]">Optimized aggregate cost recovery</span>
              </div>
              <div className="text-right sm:text-right">
                <span className="text-2xl font-extrabold text-eshodha-500 font-mono">₹{annualSavings.toLocaleString('en-IN')}/yr</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SOVEREIGN MULTI-AGENT ACCOUNTING VISUALIZER
   ═══════════════════════════════════════════════════════════════════════ */
function AgentOrchestrationSection() {
  const { ref } = useReveal();
  const [activeAgent, setActiveAgent] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    'System: Booting Sovereign Multi-Agent FinOps environment...',
    'System: Establishing double-entry ledger database hook...',
    'System: Active agents synced: [Bookkeeper, Tax Consultant, Forensic Auditor, CFO]',
  ]);

  const agents = [
    {
      title: 'Staff Accountant Agent',
      role: 'Automatic Double-Entry Journaling',
      desc: 'Intercepts raw system transactional data and compiles GAAP/Ind-AS balanced ledger inputs instantly. Handles ledger postings and keeps accounting equation balances invariant.',
      log: ['WAL intercept logged JRN-98211', 'Debit accounts post: ₹1,20,000.00', 'Credit accounts post: ₹1,20,000.00', 'Identity check: Net Zero status OK'],
    },
    {
      title: 'Tax Consultant Agent',
      role: 'Automated Return Filing & GST Reconciliation',
      desc: 'Parses business invoice records, matches GSTR-2B logs using Levenshtein distance matching, and compiles compliant returns payload configurations (GSTR-1, Form 24Q, ITR-6).',
      log: ['Reconciliation run: 1,420 lines', 'Fuzzy match threshold: 82% confidence', 'Calculated GST CGST/SGST splitting', 'ITR-6 Schedule aggregation complete'],
    },
    {
      title: 'Forensic Auditor Agent',
      role: 'Continuous Benford statistical audits',
      desc: 'Executes statistical auditing on ledger tables, checking first-digit logs using Chi-Squared tests to instantly alert teams of anomalies or ledger-shaping.',
      log: ['Queried transactions: last 1,200', 'Calculated Chi-Squared score: 12.44', 'Threshold check: 12.44 < 15.507', 'Status: Non-Anomalous ledger verified'],
    },
    {
      title: 'Chief Financial Officer Agent',
      role: 'Cognitive LLM Strategic Summarization',
      desc: 'Analyzes financial indicators and opex velocity to compile unfiltered briefings on corporate liquidity runways, margin compression, and strategic opex shifts.',
      log: ['Revenue aggregate computed', 'Balance sheet ratios verified', 'Run LLM strategic model Llama-3', 'CFO executive briefing report signed'],
    },
  ];

  // Dynamic telemetry log simulation
  useEffect(() => {
    const loopLogs = [
      'Staff Accountant: Intercepted WAL sequence #948210. Journal JRN-48092 opened.',
      'Tax Consultant: Splitting CGST (9%) / SGST (9%) for HSN 998313 (IT Services).',
      'Forensic Auditor: Chi-Squared goodness-of-fit run on 1,200 samples. Chi-Sq score: 12.44.',
      'Sovereign CFO: Balance sheet invariant confirmed (Debit=Credit). Runway certified at 18.4m.',
      'Staff Accountant: Committing journal JRN-48092 with SHA-256 integrity hash.',
      'Tax Consultant: Formulating GSTR-3B payload parameters. Recurrent liability computed.',
      'Forensic Auditor: Benford probability test matches logarithmic distribution. Verified.',
      'Sovereign CFO: AI narrative compiled. Action: freeze Sector B marketing variables.'
    ];

    let current = 0;
    const interval = setInterval(() => {
      setConsoleLogs(prev => {
        const nextLogs = [...prev, loopLogs[current]];
        // Cap logs at 10 items
        if (nextLogs.length > 10) nextLogs.shift();
        return nextLogs;
      });
      current = (current + 1) % loopLogs.length;
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="py-20 border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]/10 reveal">
      <div className="public-wrap">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-eshodha-500 font-mono">Autonomous Ledger Control</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-[var(--text-primary)]">
            Replace legacy processes with Sovereign Multi-Agent AI
          </h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Four specialized autonomous financial agents work continuously in the background to handle bookkeeping, compliance reporting, forensic statistical checking, and strategic forecasting.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Agent selectors */}
          <div className="lg:col-span-5 space-y-3">
            {agents.map((agent, idx) => (
              <button
                key={agent.title}
                onClick={() => setActiveAgent(idx)}
                className={cn(
                  'w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start gap-4 hover:bg-[var(--bg-card-hover)]',
                  activeAgent === idx
                    ? 'bg-[var(--bg-card)] border-eshodha-500 shadow-md text-[var(--text-primary)]'
                    : 'bg-transparent border-transparent text-[var(--text-secondary)]'
                )}
              >
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors', activeAgent === idx ? 'bg-eshodha-500/10 text-eshodha-500 border border-eshodha-500/20' : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]')}>
                  <Bot size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold block">{agent.title}</h4>
                  <span className="text-[11px] text-[var(--text-tertiary)] font-semibold mt-0.5 block">{agent.role}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Active Agent detail display */}
          <div className="lg:col-span-7 space-y-4">
            <div className="card p-6 border border-[var(--border-primary)] bg-[var(--bg-card)] rounded-3xl shadow-xl min-h-[300px] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-eshodha-500">
                  <Cpu size={20} />
                  <span className="text-xs font-bold tracking-wider uppercase font-mono">Agent Status: ACTIVE</span>
                </div>
                <h3 className="text-xl font-extrabold text-[var(--text-primary)] font-display">{agents[activeAgent].title}</h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                  {agents[activeAgent].desc}
                </p>
              </div>

              {/* Local Logger View */}
              <div className="mt-6 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 p-4 font-mono text-[10px] text-[var(--text-secondary)] space-y-1.5">
                <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-1.5 mb-2 font-bold text-[9px]">
                  <span>LOCAL TELEMETRY CONSOLE</span>
                  <span className="text-[#4eba7a] flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#4eba7a] animate-ping" /> READY
                  </span>
                </div>
                {agents[activeAgent].log.map((line, lIdx) => (
                  <div key={lIdx} className="flex items-center gap-2">
                    <span className="text-eshodha-500">&gt;&gt;</span>
                    <span className="truncate">{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Multi-Agent Communication Ticker */}
        <div className="card p-5 border border-[var(--border-primary)] bg-[var(--bg-card)] rounded-3xl shadow-lg mt-8 font-mono text-[11px]">
          <div className="flex items-center justify-between border-b border-[var(--border-secondary)] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-eshodha-500" />
              <span className="font-extrabold text-[var(--text-primary)]">COGNITIVE MULTI-AGENT NETWORK MONITOR</span>
            </div>
            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">PORT 50051 streaming</span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {consoleLogs.map((log, index) => (
              <div key={index} className="flex items-start gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <span className="text-eshodha-500 flex-shrink-0">&gt;</span>
                <span className="leading-relaxed">{log}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PLATFORM SHOWCASE
   ═══════════════════════════════════════════════════════════════════════ */
const TABS = [
  {
    id: 'fraud',
    icon: Shield,
    label: 'Fraud Prevention',
    headline: 'Stop financial fraud before transactions clear.',
    body: 'Real-time transaction scoring across card, UPI, and bank transfers. Built-in Graph neural models flag device loops, structured transaction patterns, and mule accounts in under 15ms.',
    stats: [
      { v: '<15ms', l: 'Decision Latency' },
      { v: '99.4%', l: 'Detection Rate' },
      { v: '96.2%', l: 'False-Positive Drop' },
    ],
    preview: [
      { label: 'TXN-99201', detail: 'Mule path · IMPS Flagged', risk: 0.94, hi: true },
      { label: 'TXN-99202', detail: 'Rapid structuring alert', risk: 0.88, hi: true },
      { label: 'TXN-99203', detail: 'Standard payload clearance', risk: 0.08, hi: false },
    ],
  },
  {
    id: 'credit',
    icon: CreditCard,
    label: 'Credit Underwriting',
    headline: 'Approve thin-file applicants using alternative data.',
    body: 'Scan wallet movements, utility payments, and mobile tenure alongside bureau logs. Automatically drafts compliant reason codes for every automated decision.',
    stats: [
      { v: '3.6×', l: 'Approval Increase' },
      { v: '100%', l: 'Audit Attributions' },
      { v: '<2s', l: 'Score Computation' },
    ],
    preview: [
      { label: 'CUST-802', detail: 'Alt-data approved · 710', risk: 0.12, hi: false },
      { label: 'CUST-803', detail: 'Low asset · additional checks', risk: 0.52, hi: false },
      { label: 'CUST-804', detail: 'High DTI · Declined', risk: 0.84, hi: true },
    ],
  },
  {
    id: 'tax',
    icon: FileText,
    label: 'Regulatory & Tax',
    headline: 'Audit ledgers, match GSTR-2B, and compile payloads.',
    body: 'Rule engines split CGST/SGST/IGST dynamically. Matches purchase logs with GSTR-2B logs, flags audit anomalies, and builds filing payloads (GSTR-1, Form 24Q, ITR-6).',
    stats: [
      { v: '6.8%', l: 'FPR on compliance alerts' },
      { v: '214+', l: 'Monitored Typologies' },
      { v: '<24h', l: 'Draft to filing payload' },
    ],
    preview: [
      { label: 'TAX-052026', detail: 'GSTR-3B payload generated', risk: 0.15, hi: false },
      { label: 'TAX-TDS-Q1', detail: 'Form 26Q TDS challan post', risk: 0.05, hi: false },
      { label: 'TAX-ANOM-04', detail: 'Benford audit variance flag', risk: 0.89, hi: true },
    ],
  },
];

function PlatformShowcase() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];
  const { ref } = useReveal();

  return (
    <section className="py-20 border-b border-[var(--border-secondary)] bg-[var(--bg-card)] reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-eshodha-500">System Integration Console</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-[var(--text-primary)]">
            One platform. Combined capabilities.
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            Our modules share a single data plane, a central model registry, and unified audit trail logs. No integration gaps or competing pipelines.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex justify-center border-b border-[var(--border-primary)] mb-8">
          <div className="flex gap-2">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setActive(i)}
                className={cn(
                  'px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 flex items-center gap-2',
                  active === i
                    ? 'border-eshodha-500 text-eshodha-500 font-extrabold'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="w-10 h-10 rounded-2xl bg-eshodha-500/10 flex items-center justify-center text-eshodha-500">
              <tab.icon size={20} />
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] font-display">{tab.headline}</h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{tab.body}</p>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--border-secondary)]">
              {tab.stats.map((s) => (
                <div key={s.l} className="space-y-1">
                  <span className="block text-lg font-extrabold text-[var(--text-primary)] font-mono">{s.v}</span>
                  <span className="block text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">{s.l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4 font-mono text-xs space-y-3 shadow-lg">
              <div className="flex items-center justify-between border-b border-[var(--border-secondary)] pb-2 mb-1">
                <span className="font-bold text-[var(--text-primary)]">{tab.label} Monitor</span>
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest">CDC Log Queue</span>
              </div>
              {tab.preview.map((row) => (
                <div key={row.label} className={cn('p-2.5 rounded-lg border flex items-center justify-between bg-[var(--bg-card)] border-[var(--border-primary)]', row.hi ? 'bg-risk-high/5 border-risk-high/15' : '')}>
                  <div>
                    <span className="font-bold block text-[10px] text-[var(--text-primary)]">{row.label}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">{row.detail}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--border-secondary)]">
                      <div className={cn('h-full', row.risk > 0.7 ? 'bg-risk-high' : row.risk > 0.4 ? 'bg-risk-medium' : 'bg-risk-low')} style={{ width: `${row.risk * 100}%` }} />
                    </div>
                    <span className={cn('font-bold text-xs font-mono', row.risk > 0.7 ? 'text-risk-high' : row.risk > 0.4 ? 'text-risk-medium' : 'text-risk-low')}>{row.risk.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SERVICES GRID
   ═══════════════════════════════════════════════════════════════════════ */
const SERVICES = [
  { icon: Shield, title: 'Smart Underwriting', sub: 'Alternative data mortgage decisioning', path: '/services/lending', color: '#b75d57' },
  { icon: Banknote, title: 'Payments Analytics', sub: 'Real-time multi-rail fraud checks', path: '/services/payments', color: '#5d7ab7' },
  { icon: LineChart, title: 'Asset & Wealth Management', sub: 'Portfolio risk controls & AML screening', path: '/services/wealth', color: '#5db793' },
  { icon: ShieldCheck, title: 'InsurTech Core', sub: 'Claims fraud verification engines', path: '/services/insurance', color: '#b7a35d' },
  { icon: Globe, title: 'Open Banking API', sub: 'Consent management & bank aggregations', path: '/services/openbanking', color: '#7d5db7' },
  { icon: FileText, title: 'RegTech Operations', sub: 'Automated tax returns, TDS & SAR filings', path: '/services/regtech', color: '#5d9eb7' },
  { icon: Network, title: 'Graph Intelligence', sub: 'contagion loops & transaction rings', path: '/admin/graph', color: '#b75d93' },
  { icon: Database, title: 'Sovereign Database Link', sub: 'CDC log hooks & WAL observabilities', path: '/admin/database', color: '#7db75d' },
];

function ServicesGrid() {
  const { ref } = useReveal();
  return (
    <section className="py-20 border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]/10 reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-eshodha-500">Service Verticals</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-[var(--text-primary)]">
              Integrated Services. Shared Control.
            </h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-md">
            Execute operations across multiple financial roles using eshodha’s unified data plane, matching strict enterprise standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map((s) => (
            <Link key={s.title} to={s.path} className="p-5 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-all duration-200 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-4" style={{ background: s.color }}>
                  <s.icon size={16} />
                </div>
                <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-eshodha-500 transition-colors font-display">{s.title}</h4>
                <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">{s.sub}</p>
              </div>
              <span className="text-xs font-bold text-eshodha-500 mt-4 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Configure module <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════════════════════════ */
const HOW_STEPS = [
  { num: '01', icon: Database, title: 'CDC Ingest', body: 'Connect databases directly. eshodha streams transaction segments from logical WAL logs to down-stream pipelines.' },
  { num: '02', icon: Sparkles, title: 'Agent Scoring', body: 'Cognitive agent loops score transactions, allocate CGST/SGST, and balance double-entry accounts in parallel.' },
  { num: '03', icon: FileCheck2, title: 'Invariance Verifications', body: 'Verifies double-entry equations, check first-digit stats (Benford), and checks risk criticality limits.' },
  { num: '04', icon: SovereignLogo, title: 'Action & File', body: 'Autonomous filing to tax portals (GSTR, TDS), pushes mobile alerts, or routes to playbooks.' },
];

function SovereignLogo() {
  return <Scale size={20} />;
}

function HowItWorks() {
  const { ref } = useReveal();
  return (
    <section className="py-20 border-b border-[var(--border-secondary)] bg-[var(--bg-card)] reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-eshodha-500">Operation Mechanics</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-[var(--text-primary)]">
            How eshodha Secures Ledger Integrity
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {HOW_STEPS.map((s) => (
            <div key={s.num} className="relative space-y-4">
              <div className="text-5xl font-extrabold font-mono text-eshodha-500 opacity-20">{s.num}</div>
              <div className="w-10 h-10 rounded-2xl bg-eshodha-500/10 flex items-center justify-center text-eshodha-500">
                <s.icon size={20} />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] font-display">{s.title}</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════════════════════════════════ */
const TESTIMONIALS = [
  {
    quote: "Moving to eshodha’s autonomous tax filing saved our staff accountants 400+ hours. The GSTR-2B fuzzy reconciliation matches records perfectly.",
    name: 'Director of Taxation', org: 'Enterprise NBFC Group',
    avatar: '#b75d57',
  },
  {
    quote: "The Benford's Law forensic auditor flagged three duplicate invoice entries that escaped our standard audit packages. A critical compliance asset.",
    name: 'Chief Risk Officer', org: 'Federal Microfinance Bank',
    avatar: '#5d7ab7',
  },
  {
    quote: "Our application-to-underwrite flow dropped to under 2 seconds. Alternate data scoring lets us safely approve thin-file customers.",
    name: 'VP of Consumer Lending', org: 'Digital Fintech Platform',
    avatar: '#5db793',
  },
];

function Testimonials() {
  const [active, setActive] = useState(0);
  const { ref } = useReveal();

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % TESTIMONIALS.length), 6000);
    return () => clearInterval(id);
  }, []);

  const t = TESTIMONIALS[active];

  return (
    <section className="py-20 border-b border-[var(--border-secondary)] bg-[var(--bg-secondary)]/10 reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-eshodha-500 text-center mb-8">Client Testimonials</p>
        <div className="text-center space-y-6">
          <blockquote className="text-xl sm:text-2xl font-extrabold italic text-[var(--text-primary)] leading-normal font-display">
            "{t.quote}"
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border border-[var(--border-primary)] flex-shrink-0" style={{ background: t.avatar }} />
            <div className="text-left">
              <strong className="text-sm font-bold text-[var(--text-primary)] block">{t.name}</strong>
              <span className="text-xs text-[var(--text-tertiary)] block mt-0.5">{t.org}</span>
            </div>
          </div>
        </div>

        {/* Dot Selectors */}
        <div className="flex justify-center gap-2 mt-8">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn('w-2 h-2 rounded-full transition-all duration-200', i === active ? 'bg-eshodha-500 w-5' : 'bg-[var(--border-primary)]')}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   INTEGRATION LOGOS
   ═══════════════════════════════════════════════════════════════════════ */
const INTEGRATIONS = [
  { name: 'PostgreSQL Link', cat: 'CDC stream' },
  { name: 'SQL Server CDC', cat: 'CDC stream' },
  { name: 'GSTN Gateway', cat: 'Tax portal' },
  { name: 'TRACES API', cat: 'TDS portal' },
  { name: 'ITD Portal link', cat: 'ITR-6 portal' },
  { name: 'Equifax Ledger', cat: 'Credit Bureau' },
  { name: 'CIBIL Database', cat: 'Credit Bureau' },
  { name: 'SWIFT Rail Link', cat: 'Banking Rail' },
  { name: 'UPI / NPCI Rail', cat: 'Banking Rail' },
  { name: 'SAP Finance Link', cat: 'Enterprise ERP' },
  { name: 'Oracle Ledger Sync', cat: 'Enterprise ERP' },
  { name: 'Ollama / vLLM API', cat: 'Local LLM link' },
];

function IntegrationLogos() {
  const { ref } = useReveal();
  return (
    <section className="py-20 border-b border-[var(--border-secondary)] bg-[var(--bg-card)] reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <p className="text-xs font-bold uppercase tracking-widest text-eshodha-500 text-center">System Connectors</p>
        <h2 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] text-center font-display mt-2 mb-10">
          Native integration ecosystem
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {INTEGRATIONS.map((itg) => (
            <div key={itg.name} className="p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/30 flex flex-col justify-between hover:bg-[var(--bg-secondary)]/60 transition-colors">
              <span className="font-bold text-xs text-[var(--text-primary)] font-display">{itg.name}</span>
              <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mt-2">{itg.cat}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FINAL CTA
   ═══════════════════════════════════════════════════════════════════════ */
function FinalCTA() {
  const { ref } = useReveal();
  return (
    <section className="relative overflow-hidden py-24 bg-[var(--bg-secondary)] border-b border-[var(--border-secondary)] reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute bottom-[-20%] left-[-15%] w-[60%] h-[70%] rounded-full bg-eshodha-500/10 blur-[130px]" />
      </div>

      <div className="public-wrap relative z-10 max-w-2xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-eshodha-500/10 border border-eshodha-500/20 text-xs font-bold text-eshodha-500">
          <Zap size={12} /> Live sandbox access
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] font-display leading-tight">
          Secure absolute compliance <br />over your corporate ledger.
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
          Configure direct CDC observers, run fuzzy tax reconciliation passes, and secure GAAP-verified invariance checks immediately.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link to="/admin" className="px-6 py-3 rounded-xl bg-eshodha-500 hover:bg-eshodha-600 text-white font-bold text-sm shadow-md transition-all duration-200 flex items-center gap-1">
            Access Command Panel <ArrowUpRight size={16} />
          </Link>
          <Link to="/services" className="px-6 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] font-bold text-sm transition-all duration-200">
            View All Modules
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-6 text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">
          {['GAAP Invariance Checked', 'Fuzzy GSTR-2B Match', 'Income Tax s269ST Audited', '99.99% CDC Uptime SLA'].map((t) => (
            <span key={t} className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-risk-low" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
