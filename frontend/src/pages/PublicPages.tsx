import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bot,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  FileCheck2,
  FileText,
  Fingerprint,
  GitBranch,
  Globe2,
  KeyRound,
  Landmark,
  Layers3,
  Loader2,
  LineChart,
  LockKeyhole,
  Network,
  Radar,
  Shield,
  ShieldCheck,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { useState, useEffect, useRef, type ElementType, type ReactNode } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED PRIMITIVES
═══════════════════════════════════════════════════════════════════════════ */

function PublicShell({ eyebrow, title, description, children, preview, cta, themeClass = 'lending' }: {
  eyebrow: string; title: string; description: string;
  children: ReactNode; preview?: ReactNode; cta?: ReactNode; themeClass?: string;
}) {
  let blob1 = 'bg-credit-line-500/10 dark:bg-credit-line-500/15';
  let blob2 = 'bg-brand-soft/20 dark:bg-brand-soft/5';
  
  if (themeClass === 'payments') {
    blob1 = 'bg-blue-500/10 dark:bg-blue-500/15';
    blob2 = 'bg-teal-500/20 dark:bg-teal-500/5';
  } else if (themeClass === 'wealth') {
    blob1 = 'bg-[#4eba7a]/10 dark:bg-[#4eba7a]/15';
    blob2 = 'bg-blue-400/20 dark:bg-blue-400/5';
  } else if (themeClass === 'insurance') {
    blob1 = 'bg-[#d4a84b]/10 dark:bg-[#d4a84b]/15';
    blob2 = 'bg-[#e07060]/20 dark:bg-[#e07060]/5';
  } else if (themeClass === 'openbanking') {
    blob1 = 'bg-purple-500/10 dark:bg-purple-500/15';
    blob2 = 'bg-blue-500/20 dark:bg-blue-500/5';
  } else if (themeClass === 'regtech' || themeClass === 'security' || themeClass === 'platform') {
    blob1 = 'bg-slate-500/10 dark:bg-slate-500/15';
    blob2 = 'bg-credit-line-500/20 dark:bg-credit-line-500/5';
  }

  return (
    <div className="public-page bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      <section className="relative overflow-hidden pt-32 pb-20 border-b border-[var(--border-secondary)]">
        {/* Background Gradient Mesh */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <div className={`absolute top-[-20%] left-[-10%] w-[55%] h-[60%] rounded-full blur-[130px] ${blob1}`} />
          <div className={`absolute bottom-[-10%] right-[-10%] w-[65%] h-[70%] rounded-full blur-[160px] ${blob2}`} />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,var(--bg-primary)_85%)]" />
          <div className="absolute inset-0 bg-grid-white/[0.015] dark:bg-grid-black/[0.015]" />
        </div>

        <div className="public-wrap relative z-10">
          <div className="page-hero-grid">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-credit-line-500/10 border border-credit-line-500/20 text-xs font-semibold text-credit-line-500 shadow-sm uppercase tracking-wider font-mono">
                {eyebrow}
              </span>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] font-display text-[var(--text-primary)]">
                {title}
              </h1>
              <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-xl">
                {description}
              </p>
              {cta && <div className="flex flex-wrap items-center gap-3 pt-2">{cta}</div>}
            </div>
            {preview && (
              <div className="relative group">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-credit-line-500 to-brand-soft opacity-15 blur-lg group-hover:opacity-25 transition-opacity duration-300" />
                <div className="relative">
                  {preview}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

function SH({ title, body, action }: { title: ReactNode; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
      <div className="space-y-3">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-display tracking-tight leading-tight">{title}</h2>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">{body}</p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

function FeatureRow({ icon: Icon, title, body, meta }: { icon: ElementType; title: string; body: string; meta: string }) {
  return (
    <div className="group relative flex flex-col md:flex-row md:items-start gap-4 p-6 border-b border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)]/30 transition-all duration-300">
      <div className="flex items-center gap-3 md:w-[240px] flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-credit-line-500/10 text-credit-line-500 border border-credit-line-500/20 flex items-center justify-center group-hover:bg-credit-line-500 group-hover:text-white transition-all duration-300">
          <Icon size={18} />
        </div>
        <strong className="text-sm font-bold text-[var(--text-primary)] font-display">{title}</strong>
      </div>
      <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed flex-1 md:pr-10">{body}</p>
      <span className="text-[10px] font-bold font-mono tracking-wider text-[var(--text-tertiary)] uppercase bg-[var(--bg-secondary)] border border-[var(--border-secondary)] px-2.5 py-1 rounded-full mt-2 md:mt-0">{meta}</span>
    </div>
  );
}

function ProofPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-sm hover:shadow-md transition-all duration-200">
      <h3 className="text-sm font-extrabold text-[var(--text-primary)] mb-4 font-display uppercase tracking-wider">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <p key={item} className="flex items-start gap-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            <CheckCircle2 size={14} className="text-[#4eba7a] flex-shrink-0 mt-0.5" />
            <span>{item}</span>
          </p>
        ))}
      </div>
    </article>
  );
}

function PagePreview({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 shadow-2xl font-mono text-[11px] backdrop-blur-md">
      <p className="text-[9px] font-bold text-credit-line-500 uppercase tracking-widest border-b border-[var(--border-secondary)] pb-2 mb-3">Credit Line workspace</p>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-1.5 border-b border-[var(--border-secondary)]/50 last:border-b-0">
            <span className="text-[10px] text-[var(--text-secondary)]">{label}</span>
            <strong className="text-[var(--text-primary)] font-extrabold">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatStrip({ stats }: { stats: Array<{ value: string; label: string; sub?: string }> }) {
  return (
    <section className="border-y border-[var(--border-secondary)] bg-[var(--bg-secondary)]/20 backdrop-blur-sm">
      <div className="public-wrap py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-secondary)] space-y-1.5 shadow-sm hover:shadow-md transition-shadow">
              <strong className="block text-2xl lg:text-3xl font-black font-mono text-[var(--text-primary)] leading-none">{s.value}</strong>
              <span className="block text-xs font-bold text-[var(--text-secondary)] font-sans">{s.label}</span>
              {s.sub && <span className="block text-[10px] text-[var(--text-tertiary)] leading-tight">{s.sub}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks({ steps }: { steps: Array<{ num: string; title: string; body: string }> }) {
  const lgCols = steps.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${lgCols} gap-6 mt-8`}>
      {steps.map((s) => (
        <div key={s.num} className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-secondary)] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-48 group">
          <div>
            <span className="text-3xl font-black font-mono text-credit-line-500 opacity-25 group-hover:opacity-40 transition-opacity">{s.num}</span>
            <strong className="block text-sm font-extrabold text-[var(--text-primary)] font-display mt-4">{s.title}</strong>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

function CapabilityTable({ rows }: { rows: Array<{ cap: string; detail: string; tag: string }> }) {
  return (
    <div className="border border-[var(--border-primary)] rounded-2xl overflow-hidden bg-[var(--bg-card)] mt-8 divide-y divide-[var(--border-secondary)] shadow-sm">
      {rows.map((r) => (
        <div key={r.cap} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 items-center hover:bg-[var(--bg-secondary)]/20 transition-colors">
          <div className="md:col-span-3">
            <strong className="text-sm font-extrabold text-[var(--text-primary)] font-display">{r.cap}</strong>
          </div>
          <div className="md:col-span-7">
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{r.detail}</p>
          </div>
          <div className="md:col-span-2 text-left md:text-right">
            <span className="inline-block border border-[var(--border-secondary)] bg-[var(--bg-secondary)]/50 rounded-full px-3 py-1 font-mono text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              {r.tag}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FAQ({ items }: { items: Array<{ q: string; a: string }> }) {
  return (
    <div className="space-y-3 mt-8">
      {items.map((item) => (
        <details key={item.q} className="group border border-[var(--border-secondary)] rounded-2xl bg-[var(--bg-card)] overflow-hidden transition-all duration-200 open:border-credit-line-500/30 open:shadow-md">
          <summary className="flex items-center justify-between p-5 cursor-pointer text-sm font-extrabold text-[var(--text-primary)] list-none outline-none select-none hover:bg-[var(--bg-secondary)]/30 font-display">
            <span>{item.q}</span>
            <span className="text-credit-line-500 text-lg transition-transform duration-200 group-open:rotate-45">+</span>
          </summary>
          <p className="px-5 pb-5 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-primary)]/10">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}

function UseCaseGrid({ cases }: { cases: Array<{ icon: ElementType; title: string; body: string }> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
      {cases.map(({ icon: Icon, title, body }) => (
        <article key={title} className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-secondary)] shadow-sm hover:shadow-md hover:border-credit-line-500/20 transition-all duration-200 flex flex-col justify-between min-h-48 group">
          <div>
            <div className="w-10 h-10 rounded-xl bg-credit-line-500/10 text-credit-line-500 border border-credit-line-500/20 flex items-center justify-center group-hover:bg-credit-line-500 group-hover:text-white transition-all duration-300 mb-4">
              <Icon size={18} />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] font-display">{title}</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2">{body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INTERACTIVE SIMULATORS (Phase 13 Premium Modernization)
   ═══════════════════════════════════════════════════════════════════════════ */

export function LendingSimulator() {
  const [bureau, setBureau] = useState(650);
  const [simAge, setSimAge] = useState(12);
  const [utilityRate, setUtilityRate] = useState(90);
  const [graphRisk, setGraphRisk] = useState<'low' | 'medium' | 'high'>('low');

  const altScore = Math.min(850, Math.max(300, Math.round(
    bureau * 0.45 +
    simAge * 8 +
    (utilityRate / 100) * 140 +
    (graphRisk === 'low' ? 80 : graphRisk === 'medium' ? -30 : -140)
  )));

  let decision = 'REFER TO MANUAL REVIEW';
  let decColor = 'text-risk-medium border-risk-medium/20 bg-risk-medium/5';
  if (altScore >= 720) {
    decision = 'AUTO-APPROVE';
    decColor = 'text-risk-low border-risk-low/20 bg-risk-low/5';
  } else if (altScore < 600) {
    decision = 'AUTO-DECLINE';
    decColor = 'text-risk-high border-risk-high/20 bg-risk-high/5';
  }

  return (
    <div className="card p-6 border border-[var(--border-primary)] bg-[var(--bg-card)] rounded-3xl shadow-lg max-w-4xl mx-auto my-8">
      <h3 className="text-base font-extrabold text-[var(--text-primary)] font-display uppercase tracking-wider mb-4 flex items-center gap-2">
        <CreditCard className="text-credit-line-500" size={18} /> Underwriting Decision Engine Sandbox
      </h3>
      <p className="text-xs text-[var(--text-secondary)] mb-6">Modify Bureau details and alternative data streams below. The Credit Line engine computes alternative scores and applies decision filters in real time.</p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Inputs */}
        <div className="md:col-span-7 space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-[var(--text-primary)]">Base Bureau Score</span>
              <span className="font-mono text-credit-line-500 font-bold">{bureau}</span>
            </div>
            <input type="range" min="300" max="850" value={bureau} onChange={e => setBureau(Number(e.target.value))} className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer accent-credit-line-500" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-[var(--text-primary)]">SIM Tenure (Months)</span>
              <span className="font-mono text-credit-line-500 font-bold">{simAge} months</span>
            </div>
            <input type="range" min="1" max="36" value={simAge} onChange={e => setSimAge(Number(e.target.value))} className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer accent-credit-line-500" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-[var(--text-primary)]">Utility Payment Consistency</span>
              <span className="font-mono text-credit-line-500 font-bold">{utilityRate}%</span>
            </div>
            <input type="range" min="10" max="100" value={utilityRate} onChange={e => setUtilityRate(Number(e.target.value))} className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer accent-credit-line-500" />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-bold text-[var(--text-primary)]">Entity Risk Graph Link</span>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as const).map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setGraphRisk(level)}
                  className={`text-xs py-2 rounded-xl border font-bold capitalize transition-all ${
                    graphRisk === level 
                      ? 'border-credit-line-500 bg-credit-line-500/10 text-credit-line-600' 
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Output Panel */}
        <div className="md:col-span-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-5 flex flex-col justify-between h-full min-h-[300px]">
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-credit-line-500 uppercase tracking-widest font-mono">underwriting report</span>
            
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">Calculated Trust Score</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black font-mono text-[var(--text-primary)]">{altScore}</span>
                <span className="text-xs text-[var(--text-tertiary)]">/ 850</span>
              </div>
            </div>

            {/* Score progress bar */}
            <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden border border-[var(--border-primary)]">
              <div 
                className="h-full bg-gradient-to-r from-risk-high via-risk-medium to-risk-low transition-all duration-500" 
                style={{ width: `${((altScore - 300) / 550) * 100}%` }} 
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--border-primary)]">
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">System Recommendation</span>
              <div className={`border text-xs rounded-xl py-3 px-4 font-bold text-center tracking-wider ${decColor}`}>
                {decision}
              </div>
            </div>

            <div className="text-[10px] leading-normal text-[var(--text-tertiary)] flex items-start gap-1.5 font-mono">
              <ShieldCheck size={12} className="text-risk-low flex-shrink-0 mt-0.5" />
              <span>FCRA Adverse Action notice drafted automatically on decline.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MockTransaction {
  id: string;
  time: string;
  rail: string;
  amount: number;
  risk: number;
  status: 'CLEARED' | 'HELD' | 'FLAGGED';
}

export function PaymentsTicker() {
  const [txs, setTxs] = useState<MockTransaction[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const rails = ['UPI (GPay)', 'SWIFT Transfer', 'Card Clearing', 'IMPS Rail', 'RuPay Network'];
    const initial: MockTransaction[] = Array.from({ length: 5 }, (_, i) => {
      const risk = Math.round(Math.random() * 85);
      return {
        id: `TX-${Math.floor(100000 + Math.random() * 900000)}`,
        time: new Date(Date.now() - i * 15000).toLocaleTimeString(),
        rail: rails[Math.floor(Math.random() * rails.length)],
        amount: Math.round(Math.random() * 250000),
        risk,
        status: risk > 75 ? 'HELD' : risk > 45 ? 'FLAGGED' : 'CLEARED',
      };
    });
    setTxs(initial);

    timerRef.current = setInterval(() => {
      const risk = Math.round(Math.random() * 98);
      const newTx: MockTransaction = {
        id: `TX-${Math.floor(100000 + Math.random() * 900000)}`,
        time: new Date().toLocaleTimeString(),
        rail: rails[Math.floor(Math.random() * rails.length)],
        amount: Math.round(Math.random() * 150000),
        risk,
        status: risk > 75 ? 'HELD' : risk > 45 ? 'FLAGGED' : 'CLEARED',
      };
      setTxs(prev => [newTx, ...prev.slice(0, 4)]);
    }, 2500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="card p-6 border border-[var(--border-primary)] bg-[var(--bg-card)] rounded-3xl shadow-lg max-w-4xl mx-auto my-8 font-sans">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-extrabold text-[var(--text-primary)] font-display uppercase tracking-wider flex items-center gap-2">
          <Banknote className="text-credit-line-500" size={18} /> Real-Time Payment Stream Auditor
        </h3>
        <span className="text-[10px] text-risk-low bg-risk-low/10 border border-risk-low/20 rounded-full px-2 py-0.5 animate-pulse font-mono font-bold">
          LIVE STREAM ACTIVE (1270 tx/s)
        </span>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mb-6">Simulation of transactions intercepted directly at gateway channels, scored and enriched in &lt;10ms. Toggles automated SOAR hold scripts on compliance breaches.</p>

      <div className="space-y-2">
        {txs.map(tx => (
          <div key={tx.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] hover:bg-[var(--bg-secondary)]/70 transition-colors animate-fade-in">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] font-mono ${
                tx.status === 'CLEARED' ? 'bg-risk-low/10 text-risk-low' : tx.status === 'HELD' ? 'bg-risk-high/10 text-risk-high' : 'bg-risk-medium/10 text-risk-medium'
              }`}>
                {tx.rail[0]}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-[var(--text-primary)] font-mono">{tx.id}</span>
                <span className="block text-[10px] text-[var(--text-tertiary)]">{tx.rail} · {tx.time}</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-xs font-black text-[var(--text-primary)] font-mono">INR {tx.amount.toLocaleString()}</span>
                <span className="block text-[9px] text-[var(--text-tertiary)] font-mono">Risk score: {tx.risk}</span>
              </div>
              <span className={`badge text-[9px] px-2.5 py-0.5 rounded-full font-bold border ${
                tx.status === 'CLEARED' ? 'text-risk-low bg-risk-low/8 border-risk-low/15' : tx.status === 'HELD' ? 'text-risk-high bg-risk-high/8 border-risk-high/15' : 'text-risk-medium bg-risk-medium/8 border-risk-medium/15'
              }`}>
                {tx.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WealthStressTester() {
  const [profile, setProfile] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [shock, setShock] = useState<'none' | 'equity' | 'interest' | 'energy'>('none');
  const [vol, setVol] = useState(30);

  const baseVaR = profile === 'conservative' ? 3.5 : profile === 'balanced' ? 8.2 : 18.6;
  const volFactor = vol * 0.12;
  const shockFactor = shock === 'equity' ? 12.5 : shock === 'interest' ? 5.8 : shock === 'energy' ? 7.6 : 0.0;
  const varEstimate = Math.min(99.9, baseVaR + volFactor + shockFactor);

  let status = 'COMPLIANT (MiFID II Matches)';
  let statusColor = 'text-risk-low border-risk-low/20 bg-risk-low/5';
  if (varEstimate > 25.0) {
    status = 'HIGH RISK (Re-assessment Required)';
    statusColor = 'text-risk-high border-risk-high/20 bg-risk-high/5';
  } else if (varEstimate > 12.0) {
    status = 'PORTFOLIO DRIFT WARNING';
    statusColor = 'text-risk-medium border-risk-medium/20 bg-risk-medium/5';
  }

  return (
    <div className="card p-6 border border-[var(--border-primary)] bg-[var(--bg-card)] rounded-3xl shadow-lg max-w-4xl mx-auto my-8">
      <h3 className="text-base font-extrabold text-[var(--text-primary)] font-display uppercase tracking-wider mb-4 flex items-center gap-2">
        <LineChart className="text-credit-line-500" size={18} /> Portfolio stress-testing & VaR sandbox
      </h3>
      <p className="text-xs text-[var(--text-secondary)] mb-6">Select account profiles and apply global market shocks to see real-time calculated Value-at-Risk (VaR) estimations and suitability status updates.</p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Inputs */}
        <div className="md:col-span-7 space-y-5">
          <div className="space-y-2">
            <span className="block text-xs font-bold text-[var(--text-primary)]">Investor Risk Profile</span>
            <div className="grid grid-cols-3 gap-2">
              {(['conservative', 'balanced', 'aggressive'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProfile(p)}
                  className={`text-xs py-2 rounded-xl border font-bold capitalize transition-all ${
                    profile === p 
                      ? 'border-credit-line-500 bg-credit-line-500/10 text-credit-line-600' 
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-[var(--text-primary)]">Market Volatility (Proxy VIX)</span>
              <span className="font-mono text-credit-line-500 font-bold">{vol}%</span>
            </div>
            <input type="range" min="10" max="90" value={vol} onChange={e => setVol(Number(e.target.value))} className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer accent-credit-line-500" />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-bold text-[var(--text-primary)]">Select Market Shock Scenario</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'none', label: 'No Active Shock' },
                { id: 'equity', label: 'Equities Correction -30%' },
                { id: 'interest', label: 'Interest Rates Hike +3%' },
                { id: 'energy', label: 'Energy Supply Crises' }
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShock(s.id as any)}
                  className={`py-2 px-3 rounded-xl border font-bold transition-all text-left ${
                    shock === s.id 
                      ? 'border-credit-line-500 bg-credit-line-500/10 text-credit-line-600' 
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Output Panel */}
        <div className="md:col-span-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-5 flex flex-col justify-between h-full min-h-[300px]">
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-credit-line-500 uppercase tracking-widest font-mono">telemetry dashboard</span>
            
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)] font-sans">Projected Value-at-Risk (99% VaR)</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black font-mono text-[var(--text-primary)]">{varEstimate.toFixed(1)}%</span>
                <span className="text-xs text-[var(--text-tertiary)]">portfolio value</span>
              </div>
            </div>

            {/* Gauge bar */}
            <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden border border-[var(--border-primary)]">
              <div 
                className="h-full bg-gradient-to-r from-risk-low via-risk-medium to-risk-high transition-all duration-500" 
                style={{ width: `${varEstimate}%` }} 
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--border-primary)]">
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">Regulatory Suitability Status</span>
              <div className={`border text-[10px] rounded-xl py-3 px-2 font-bold text-center tracking-wider uppercase ${statusColor}`}>
                {status}
              </div>
            </div>

            <div className="text-[10px] leading-normal text-[var(--text-tertiary)] flex items-start gap-1.5 font-mono">
              <ShieldCheck size={12} className="text-risk-low flex-shrink-0 mt-0.5" />
              <span>Certified audit log entry created under SEBI/MiFID II protocol rules.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClaimTriageSimulator() {
  const [scenario, setScenario] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<any>(null);

  const presets = [
    { title: 'Windshield Storm Damage Claim', amt: 12000, desc: 'Genuine claim submitted. Single photo verified, vehicle matches location at time of event.', targetRisk: 12 },
    { title: 'Suspicious Motor Claim Collision', amt: 480000, desc: 'Adjuster and local workshop account connection. Multiple prior claim link correlations.', targetRisk: 87 },
    { title: 'Divergent Medical Invoice Claim', amt: 185000, desc: 'Multiple procedures charged, but no matching admission logs registered.', targetRisk: 58 }
  ];

  const handleAudit = () => {
    setRunning(true);
    setStep(0);
    setResult(null);

    const interval = setInterval(() => {
      setStep(prev => {
        if (prev >= 3) {
          clearInterval(interval);
          setRunning(false);
          const current = presets[scenario];
          setResult({
            risk: current.targetRisk,
            rec: current.targetRisk > 75 ? 'ROUTE TO SIU SPECIAL AUDIT' : current.targetRisk > 40 ? 'REFER TO ADJUSTER QUEUE' : 'AUTO-APPROVE PAYOUT'
          });
          return 4;
        }
        return prev + 1;
      });
    }, 800);
  };

  return (
    <div className="card p-6 border border-[var(--border-primary)] bg-[var(--bg-card)] rounded-3xl shadow-lg max-w-4xl mx-auto my-8">
      <h3 className="text-base font-extrabold text-[var(--text-primary)] font-display uppercase tracking-wider mb-4 flex items-center gap-2">
        <Shield size={18} className="text-credit-line-500" /> FNOL Claims Triage Triage Simulator
      </h3>
      <p className="text-xs text-[var(--text-secondary)] mb-6">Select a mock scenario below and trigger the forensic verification engine to watch claims scoring pipelines identify potential insurance fraud.</p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Inputs */}
        <div className="md:col-span-7 space-y-4">
          <span className="block text-xs font-bold text-[var(--text-primary)]">Select Claim Event Scenario</span>
          <div className="space-y-2">
            {presets.map((p, idx) => (
              <button
                key={p.title}
                type="button"
                onClick={() => { setScenario(idx); setResult(null); setStep(0); }}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                  scenario === idx 
                    ? 'border-credit-line-500 bg-credit-line-500/10 text-credit-line-600' 
                    : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'
                }`}
                disabled={running}
              >
                <strong className="block text-xs text-[var(--text-primary)]">{p.title}</strong>
                <span className="block text-[10px] text-[var(--text-secondary)] mt-1">{p.desc}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAudit}
            disabled={running}
            className="w-full text-xs py-3 rounded-2xl font-bold bg-credit-line-500 text-white hover:bg-credit-line-600 shadow-sm flex items-center justify-center gap-2 transition-all mt-4"
          >
            {running && <Loader2 size={14} className="animate-spin" />}
            {running ? 'Inspecting Claim Files...' : 'Execute Forensic Claim Inspection'}
          </button>
        </div>

        {/* Right Output Panel */}
        <div className="md:col-span-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-5 flex flex-col justify-between h-full min-h-[300px]">
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-credit-line-500 uppercase tracking-widest font-mono">triage checklist</span>
            
            <div className="space-y-2 text-xs font-mono text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <span className={step > 0 ? "text-risk-low" : "text-[var(--text-tertiary)]"}>✓</span>
                <span>Metadata validation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={step > 1 ? "text-risk-low" : "text-[var(--text-tertiary)]"}>✓</span>
                <span>Cross-claim frequency checks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={step > 2 ? "text-risk-low" : "text-[var(--text-tertiary)]"}>✓</span>
                <span>Entity risk graph lookup</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={step > 3 ? "text-risk-low" : "text-[var(--text-tertiary)]"}>✓</span>
                <span>Compile scoring thresholds</span>
              </div>
            </div>
          </div>

          {result && (
            <div className="space-y-4 pt-4 border-t border-[var(--border-primary)] animate-scale-in">
              <div className="space-y-1">
                <span className="text-xs text-[var(--text-secondary)]">Claim Fraud Probability</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-black font-mono ${
                    result.risk > 70 ? 'text-risk-high' : result.risk > 40 ? 'text-risk-medium' : 'text-risk-low'
                  }`}>{result.risk}%</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-[var(--text-secondary)]">Routing Recommendation</span>
                <div className={`border text-[10px] rounded-xl py-2 px-1 font-bold text-center tracking-wider ${
                  result.risk > 70 ? 'text-risk-high border-risk-high/20 bg-risk-high/5' : result.risk > 40 ? 'text-risk-medium border-risk-medium/20 bg-risk-medium/5' : 'text-risk-low border-risk-low/20 bg-risk-low/5'
                }`}>
                  {result.rec}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConsentSandbox() {
  const [scopes, setScopes] = useState({
    identity: true,
    balances: true,
    transactions: true,
    recurring: false
  });
  const [expiry, setExpiry] = useState(90);
  const [payload, setPayload] = useState<string | null>(null);

  const handleGenerate = () => {
    const claims = {
      iss: "credit-line-identity-federation",
      sub: "usr-ob-7a4f3b2c",
      aud: "rbi-account-aggregator",
      exp: Math.floor(Date.now() / 1000) + (expiry * 86400),
      scopes: Object.keys(scopes).filter(k => scopes[k as keyof typeof scopes]),
      data_residency: "ap-south-1"
    };
    
    const mockToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.' + 
      btoa(JSON.stringify(claims)) + 
      '.signed_by_dilithium_envelope_ml_dsa';

    setPayload(JSON.stringify({
      access_token: mockToken,
      token_type: "Bearer",
      expires_in: expiry * 86400,
      consent_id: `CNS-${Math.floor(100000 + Math.random() * 900000)}`,
      scope_parameters: claims
    }, null, 2));
  };

  return (
    <div className="card p-6 border border-[var(--border-primary)] bg-[var(--bg-card)] rounded-3xl shadow-lg max-w-4xl mx-auto my-8">
      <h3 className="text-base font-extrabold text-[var(--text-primary)] font-display uppercase tracking-wider mb-4 flex items-center gap-2">
        <Globe2 className="text-credit-line-500" size={18} /> Open Banking Consent Sandbox
      </h3>
      <p className="text-xs text-[var(--text-secondary)] mb-6">Select consent permissions below to establish OAuth consent flows and generate signed PSD2 JSON access token envelopes.</p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Inputs */}
        <div className="md:col-span-6 space-y-4">
          <span className="block text-xs font-bold text-[var(--text-primary)]">Consent Scopes</span>
          <div className="space-y-2">
            {[
              { id: 'identity', label: 'Read Customer Identity Profile', desc: 'Full KYC matching attributes' },
              { id: 'balances', label: 'Read Account Balance (Real-time)', desc: 'Current ledger checks' },
              { id: 'transactions', label: 'Read Transaction History (90 Days)', desc: 'Calculates DTI and affordability' },
              { id: 'recurring', label: 'Read Recurring Bills & Subscriptions', desc: 'Opex tracking metrics' }
            ].map(s => (
              <label key={s.id} className="flex items-start gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={scopes[s.id as keyof typeof scopes]} 
                  onChange={e => setScopes(prev => ({ ...prev, [s.id]: e.target.checked }))}
                  className="mt-1 accent-credit-line-500 rounded" 
                />
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)] block">{s.label}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] block mt-0.5">{s.desc}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-[var(--text-primary)]">Consent Duration</span>
              <span className="font-mono text-credit-line-500 font-bold">{expiry} days</span>
            </div>
            <input type="range" min="30" max="365" step="30" value={expiry} onChange={e => setExpiry(Number(e.target.value))} className="w-full h-1 bg-[var(--bg-secondary)] rounded-lg appearance-none cursor-pointer accent-credit-line-500" />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="w-full text-xs py-3 rounded-2xl font-bold bg-credit-line-500 text-white hover:bg-credit-line-600 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <KeyRound size={14} /> Establish Consent Pipeline & Fetch Token
          </button>
        </div>

        {/* Right Output Panel */}
        <div className="md:col-span-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-5 flex flex-col justify-between h-full min-h-[380px]">
          <div>
            <span className="text-[10px] font-bold text-credit-line-500 uppercase tracking-widest font-mono block mb-3">API payload response</span>
            {payload ? (
              <pre className="text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border-primary)] p-3.5 rounded-xl overflow-x-auto max-h-[300px]">
                <code>{payload}</code>
              </pre>
            ) : (
              <div className="flex items-center justify-center py-24 text-center border border-dashed border-[var(--border-primary)] rounded-xl bg-[var(--bg-card)]/50">
                <p className="text-xs text-[var(--text-tertiary)]">Establish consent above to generate mock API returns.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SARTypologyMatcher() {
  const [typology, setTypology] = useState<string>('smurfing');

  const getFlowData = () => {
    if (typology === 'smurfing') {
      return {
        nodes: ['Acct 1 (₹45k)', 'Acct 2 (₹42k)', 'Acct 3 (₹48k)', 'Mule Core (₹135k)', 'Target Corp Account'],
        narrative: `SUMMARY OF SUSPICIOUS FINDINGS:\n\nMultiple structured cash deposits below reporting threshold (₹50k limit) made at three different ATMs within a 2-hour window. Funds aggregated into Mule Core account and wired to Target Corp within 12 hours. Indicates Structuring/Smurfing pattern.`
      };
    } else if (typology === 'offshore') {
      return {
        nodes: ['Parent Co', 'Shell Corp A (Delaware)', 'Shell Corp B (Mauritius)', 'Parent Co Ledger'],
        narrative: `SUMMARY OF SUSPICIOUS FINDINGS:\n\nRound-trip wiring transfer sequence detected. Funds sourced from Parent Co routed through off-shore Shell Corp B (Mauritius) and Shell Corp A (Delaware), subsequently entering Parent Co ledger as simulated loan receipts. Indicates tax-evasion circular flow.`
      };
    } else {
      return {
        nodes: ['Settlement Gate', 'Acct Alpha', 'Acct Beta', 'Acct Gamma', 'Crypto Bridge Account'],
        narrative: `SUMMARY OF SUSPICIOUS FINDINGS:\n\nRapid transaction fan-out matching money laundering parameters. Inbound wire partitioned immediately into four separate beneficiary bank transfer operations, routed to external crypto bridge platforms. Exceeds velocity baseline bounds.`
      };
    }
  };

  const flow = getFlowData();

  return (
    <div className="card p-6 border border-[var(--border-primary)] bg-[var(--bg-card)] rounded-3xl shadow-lg max-w-4xl mx-auto my-8">
      <h3 className="text-base font-extrabold text-[var(--text-primary)] font-display uppercase tracking-wider mb-4 flex items-center gap-2">
        <FileText className="text-credit-line-500" size={18} /> AML Typology Matcher & SAR Draft Sandbox
      </h3>
      <p className="text-xs text-[var(--text-secondary)] mb-6">Select active money laundering typologies to visualize entities, trace fund flow paths, and compile automated compliance report narratives.</p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Inputs */}
        <div className="md:col-span-5 space-y-4">
          <span className="block text-xs font-bold text-[var(--text-primary)]">Select Active AML Typology</span>
          <div className="space-y-2">
            {[
              { id: 'smurfing', label: 'Smurfing / Structured Deposits', desc: 'Frequent sub-threshold cash transfers' },
              { id: 'offshore', label: 'Offshore Round-Tripping', desc: 'Circular transfers mimicking loan returns' },
              { id: 'fanout', label: 'Rapid Account Fan-Out', desc: 'Fast partitioning to crypto wallets' }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypology(t.id)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                  typology === t.id 
                    ? 'border-credit-line-500 bg-credit-line-500/10 text-credit-line-600' 
                    : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'
                }`}
              >
                <strong className="block text-xs text-[var(--text-primary)]">{t.label}</strong>
                <span className="block text-[10px] text-[var(--text-secondary)] mt-1">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Output Panel */}
        <div className="md:col-span-7 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-5 flex flex-col justify-between h-full min-h-[350px]">
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-credit-line-500 uppercase tracking-widest font-mono">transaction entity flow map</span>
            
            {/* Simple Visual Flow Diagram using Flex */}
            <div className="flex flex-wrap items-center justify-center gap-2 py-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] px-2 font-mono text-[9px] text-[var(--text-secondary)]">
              {flow.nodes.map((node, i) => (
                <div key={node} className="flex items-center gap-1.5">
                  <span className="border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1 rounded font-bold text-[var(--text-primary)]">{node}</span>
                  {i < flow.nodes.length - 1 && <span className="text-credit-line-500 font-black">➔</span>}
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)]">Auto-Drafted SAR Narrative (Regulatory Format)</span>
              <textarea 
                readOnly 
                value={flow.narrative} 
                className="w-full h-32 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-3 text-[10px] font-mono text-[var(--text-secondary)] leading-relaxed focus:outline-none select-all"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXISTING PAGES  (Platform / Security / About)
═══════════════════════════════════════════════════════════════════════════ */

export function PlatformPage() {
  return (
    <PublicShell
      eyebrow="Platform"
      title="A single decision fabric across fraud, credit, and compliance."
      description="Credit Line connects ingestion, model scoring, human review, SOAR response, and regulatory evidence so lending teams can move quickly without losing control."
      preview={<PagePreview rows={[['Graph risk', '0.92'], ['Credit review', '684'], ['Evidence', 'signed']]} />}
      cta={<><Link to="/admin" className="btn-dark">Open console <ArrowUpRight size={14} /></Link><Link to="/services" className="btn-light">All services</Link></>}
      themeClass="platform"
    >
      <StatStrip stats={[
        { value: '<10ms', label: 'Decision latency', sub: 'end-to-end scoring pipeline' },
        { value: '94%', label: 'Model coverage', sub: 'transaction signals enriched' },
        { value: '214+', label: 'AML typologies', sub: 'active monitoring rules' },
        { value: '6', label: 'Service verticals', sub: 'on one shared data plane' },
      ]} />
      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Everything required to make a financial decision." body="The platform keeps each signal close to the action it informs: fraud alerts, credit reviews, analyst queues, audit memos, and model health." />
          <div className="feature-rows">
            <FeatureRow icon={Database} title="Unified data plane" body="Bring transaction streams, device telemetry, wallet behavior, telco, utility, merchant, and synthetic test signals into a shared operating model. All sources are normalised into a common schema before any model sees them." meta="stream ready" />
            <FeatureRow icon={Network} title="Graph intelligence" body="Expose rings, shared devices, mule patterns, merchant collusion, and identity clusters before losses spread across the institution. Graph updates propagate in under 200ms." meta="entity aware" />
            <FeatureRow icon={CreditCard} title="Alternative credit" body="Score thin-file applicants with explainable, lender-controlled features and reason codes for review workflows. Alternative data sources include utility, telco, rental, and open banking signals." meta="inclusive" />
            <FeatureRow icon={Bot} title="SOAR response" body="Move alerts into analyst queues, automated actions, audit trails, and customer-safe remediation paths. Each SOAR action carries signed evidence before handoff." meta="operator led" />
            <FeatureRow icon={ShieldCheck} title="Compliance controls" body="FCRA adverse-action notices, PQC encryption, GDPR/DPDP sovereign routing, and SOC 2 audit posture are built into the operating layer, not bolted on afterwards." meta="regulatory ready" />
            <FeatureRow icon={Zap} title="MLOps & model health" body="Champion/challenger serving, feature store readiness, stream-lag alerting, and drift detection keep production models reliable without manual babysitting." meta="self-healing" />
          </div>
        </div>
      </section>
      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <div className="grid gap-px border border-[var(--border-secondary)] bg-[var(--border-secondary)] lg:grid-cols-3">
            <ProofPanel title="Risk leaders" items={['Fraud queue and risk graph in one surface', 'Circuit breaker visibility', 'Cross-institution consortium posture', 'Model poisoning scan', 'Velocity policy controls']} />
            <ProofPanel title="Credit teams" items={['Alternative data scorecards for thin-file', 'Adverse action readiness on every decline', 'Decision evidence with reason codes', 'Monotonic constraint review for regulators', 'Affordability stress-test signals']} />
            <ProofPanel title="Operators" items={['SLA-focused dashboard views', 'Analyst handoff and escalation routing', 'Audit-ready compliance trails', 'Region-aware policy resolution', 'SOAR runbook audit logs']} />
          </div>
        </div>
      </section>
      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Five operating steps. One evidence loop." body="Credit Line's operating loop is simple: ingest, resolve context, explain, route, and monitor. Each step leaves a reviewable, signed artifact." />
          <HowItWorks steps={[
            { num: '01', title: 'Ingest', body: 'Normalise all transaction, device, identity, and behavioral streams into the shared data plane with sub-second latency.' },
            { num: '02', title: 'Score', body: 'Run fraud, credit, biometric, graph, and adversarial models in parallel. Each model output carries a confidence interval and feature attribution.' },
            { num: '03', title: 'Explain', body: 'Generate FCRA-compliant reason codes, SHAP-backed model notes, and adverse-action drafts automatically before any human sees the decision.' },
            { num: '04', title: 'Route', body: 'Send decisions to analyst queues, SOAR playbooks, credit review, or regulatory export paths based on risk tier, region, and SLA.' },
            { num: '05', title: 'Monitor', body: 'Track model drift, alert quality, queue SLAs, and graph health continuously. Drift triggers retraining workflows without operator intervention.' },
          ]} />
        </div>
      </section>
    </PublicShell>
  );
}

export function SecurityPage() {
  const controls = [
    [LockKeyhole, 'Post-quantum posture', 'ML-KEM-768 and ML-DSA-65 modules protect financial data against long-horizon decryption attacks. Hybrid TLS keeps current connections secure while PQC keys are in transition.'],
    [Globe2, 'Sovereign routing', 'Region-aware data controls support DPDP (India), GDPR (EU), GLBA (US), and local residency mandates. PII shards are pinned to region and cannot transfer without explicit operator approval.'],
    [FileCheck2, 'Decision evidence', 'Every fraud and credit outcome carries a signed audit event with reason codes, model version, feature hash, and operator ID. Evidence packages are regulator-exportable within 30 seconds.'],
    [Fingerprint, 'Edge biometrics', 'Behavioral signals — keystroke dynamics, gyroscope, swipe velocity — are verified on-device without raw sensor streams crossing network boundaries.'],
  ] as const;

  return (
    <PublicShell
      eyebrow="Security"
      title="Controls for institutions that cannot treat trust as decoration."
      description="Security, sovereignty, and explainability are designed into the Credit Line operating layer instead of being bolted on after launch."
      preview={<PagePreview rows={[['PQC posture', 'ready'], ['Region policy', 'resolved'], ['Audit event', 'signed']]} />}
      cta={<><Link to="/admin" className="btn-dark">Open console</Link><Link to="/services/regtech" className="btn-light">RegTech details</Link></>}
      themeClass="security"
    >
      <StatStrip stats={[
        { value: 'ML-KEM-768', label: 'Key encapsulation', sub: 'NIST PQC standard' },
        { value: '4', label: 'Sovereign regions', sub: 'ap-south, eu-west, us-east, ap-se' },
        { value: '30s', label: 'Evidence export', sub: 'regulator-ready package time' },
        { value: '100%', label: 'Signed decisions', sub: 'every outcome has an audit event' },
      ]} />
      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Trust follows the decision path." body="Controls are visible where operators work, so reviews do not rely on separate spreadsheets or policy archaeology." />
          <div className="operations-grid">
            {controls.map(([Icon, title, body]) => (
              <article key={title} className="operation-card">
                <span className="cell-icon"><Icon size={18} /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="Cryptographic capability table." body="Every security module ships with a documented posture, so security teams can audit without reverse-engineering the implementation." />
          <CapabilityTable rows={[
            { cap: 'Key exchange (KEM)', detail: 'ML-KEM-768 (CRYSTALS-Kyber) with X25519 hybrid for backward compatibility during transition periods.', tag: 'NIST PQC' },
            { cap: 'Digital signatures', detail: 'ML-DSA-65 (CRYSTALS-Dilithium) signs every audit event, decision memo, and SOAR action output.', tag: 'NIST PQC' },
            { cap: 'Transport security', detail: 'TLS 1.3 with hybrid PQC cipher suites. Downgrade prevention enforced at the load balancer layer.', tag: 'TLS 1.3' },
            { cap: 'Data at rest', detail: 'AES-256-GCM for stored records. Key rotation is triggered on schedule or on anomaly detection.', tag: 'AES-256' },
            { cap: 'Audit signing', detail: 'SHA3-512 hashes every decision event. Merkle chain links events so tampering is detectable without a trusted third party.', tag: 'SHA3-512' },
            { cap: 'PII sovereignty', detail: 'Customer PII fields are tokenised at ingest. Raw tokens never leave the originating sovereign region.', tag: 'region-pinned' },
            { cap: 'Biometric edge processing', detail: 'Behavioral signals processed on-device using TEE (Trusted Execution Environment). Only a confidence score transits the network.', tag: 'TEE / on-device' },
            { cap: 'Disaster recovery', detail: 'Cross-region encrypted backup with RTO < 4 hours and RPO < 15 minutes per sovereign shard.', tag: 'RTO < 4h' },
          ]} />
        </div>
      </section>
      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Four control moments, one evidence trail." body="Encrypt the record, resolve the region, score the decision, and sign the memo before the handoff." action={<Link to="/admin" className="btn-dark">Open console</Link>} />
          <HowItWorks steps={[
            { num: '01', title: 'Encrypt', body: 'All ingested records are encrypted with AES-256-GCM before storage. PQC KEM protects the symmetric key.' },
            { num: '02', title: 'Resolve region', body: 'Region policy is evaluated at request time. PII-bearing fields are routed to the sovereign shard matching the customer jurisdiction.' },
            { num: '03', title: 'Score decision', body: 'Models run in an isolated execution environment. Feature hashes are captured for post-hoc reproducibility.' },
            { num: '04', title: 'Sign evidence', body: 'ML-DSA-65 signs the decision memo. The signature and all supporting artefacts are added to the Merkle audit chain.' },
          ]} />
        </div>
      </section>
    </PublicShell>
  );
}

export function AboutPage() {
  const principles: Array<{ icon: ElementType; label: string; body: string }> = [
    { icon: Landmark, label: 'Built for regulated lenders', body: 'Financial institutions need fast decisions without losing defensibility. Credit Line is designed for the compliance overhead that real lenders face, not the simplified version shown in demos.' },
    { icon: ShieldCheck, label: 'Designed for evidence', body: 'Every model output needs context, reason codes, controls, and review state. We treat explainability as a first-class feature, not an afterthought added for regulators.' },
    { icon: Workflow, label: 'Made for daily operations', body: 'The product favors repeatable, auditable workflows over decorative one-off dashboards. Operators should be able to run a shift without referring to a manual.' },
  ];
  const stackItems: Array<{ icon: ElementType; label: string }> = [
    { icon: Radar, label: 'Graph' }, { icon: Zap, label: 'MLOps' }, { icon: KeyRound, label: 'Vault' },
    { icon: GitBranch, label: 'SOAR' }, { icon: Layers3, label: 'Models' }, { icon: FileCheck2, label: 'Audit' },
  ];
  return (
    <PublicShell
      eyebrow="Company"
      title="Credit Line makes lending decisions faster, fairer, and easier to defend."
      description="We build infrastructure for institutions serving customers whose risk and credit profiles cannot be understood through legacy systems alone."
      preview={<PagePreview rows={[['Operating mode', 'reviewable'], ['Primary user', 'risk teams'], ['Build posture', 'production']]} />}
      themeClass="platform"
    >
      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Production-grade by default." body="Financial intelligence software should survive real queues, real model drift, real audits, and real customer consequences." />
          <div className="operations-grid">
            {principles.map(({ icon: Icon, label, body }) => (
              <article key={label} className="operation-card">
                <span className="cell-icon"><Icon size={18} /></span>
                <h3>{label}</h3><p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <div className="split-panel">
            <div className="split-panel-media">
              <p className="panel-label">Stack posture</p>
              <div className="stack-grid">
                {stackItems.map(({ icon: Icon, label }) => <span key={label}><Icon size={16} />{label}</span>)}
              </div>
            </div>
            <div className="split-panel-copy">
              <h2>A practical stack for live financial intelligence.</h2>
              <p>Credit Line connects risk, credit, security, and compliance teams so institutions can move quickly without creating disconnected review silos.</p>
              <Link to="/platform" className="btn-primary">See the platform <ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICES HUB
═══════════════════════════════════════════════════════════════════════════ */

const ALL_SERVICES = [
  { icon: Shield,      title: 'Smart Lending',       body: 'Mortgage origination, alternative credit scoring, thin-file underwriting, and reason code generation for every decision.',    path: '/services/lending',     tag: 'Credit' },
  { icon: Banknote,    title: 'Payment Intelligence', body: 'Real-time payment monitoring, chargeback dispute automation, fraud signal enrichment, and multi-rail transaction analysis.',   path: '/services/payments',    tag: 'Payments' },
  { icon: LineChart,   title: 'Wealth & Investment',  body: 'Portfolio risk scoring, KYC/AML for wealth accounts, robo-advisory guardrails, and investment suitability checks.',          path: '/services/wealth',      tag: 'Wealth' },
  { icon: ShieldCheck, title: 'InsurTech',            body: 'Claims fraud detection, telematics underwriting, premium risk scoring, and FNOL automation with evidence trails.',            path: '/services/insurance',   tag: 'Insurance' },
  { icon: Globe2,      title: 'Open Banking',         body: 'PSD2-compliant API aggregation, consent management, bank-grade data sharing, and financial health scoring.',                  path: '/services/openbanking', tag: 'Open Banking' },
  { icon: FileText,    title: 'RegTech & Compliance', body: 'AML transaction monitoring, SAR generation, regulatory reporting, FCRA/GDPR posture, and audit automation.',                  path: '/services/regtech',     tag: 'Compliance' },
  { icon: Network,     title: 'Graph Intelligence',   body: 'Fraud ring discovery, identity cluster analysis, merchant collusion detection, and contagion mapping.',                        path: '/platform',             tag: 'Risk' },
  { icon: Database,    title: 'MLOps & Infrastructure',body: 'Model drift monitoring, feature store management, champion/challenger serving, and stream-lag alerting.',                     path: '/platform',             tag: 'Infrastructure' },
];

function ServiceCard({ icon: Icon, title, body, path, tag }: { icon: ElementType; title: string; body: string; path: string; tag: string }) {
  return (
    <Link to={path} className="group p-6 rounded-3xl border border-[var(--border-secondary)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:border-credit-line-500/30 hover:shadow-xl transition-all duration-300 flex flex-col justify-between min-h-56 relative overflow-hidden">
      {/* Glow border decoration */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-credit-line-500/10 to-transparent rounded-bl-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div>
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-secondary)] flex items-center justify-center group-hover:bg-credit-line-500 group-hover:text-white group-hover:border-credit-line-600 transition-all duration-300">
            <Icon size={18} />
          </div>
          <span className="border border-[var(--border-secondary)] rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            {tag}
          </span>
        </div>
        <h3 className="text-base font-extrabold text-[var(--text-primary)] font-display mt-6 group-hover:text-credit-line-500 transition-colors">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2">{body}</p>
      </div>
      
      <div className="flex items-center gap-1 text-[11px] font-bold text-credit-line-500 mt-6 transform translate-x-0 group-hover:translate-x-1 transition-transform">
        <span>Configure Service</span>
        <ArrowRight size={12} />
      </div>
    </Link>
  );
}

export function ServicesHubPage() {
  return (
    <div className="public-page">
      <section className="public-section public-section-top">
        <div className="public-wrap py-20 text-center">
          <p className="public-pill-title">All services</p>
          <h1 className="hero-headline">One platform.<br />Every finance problem.</h1>
          <p className="hero-subcopy">From fraud to lending to wealth management — Credit Line covers the full financial operations stack with production-grade AI infrastructure, audit trails, and explainability built in.</p>
          <div className="hero-buttons">
            <Link to="/admin" className="btn-dark">Open console <ArrowUpRight size={14} /></Link>
            <Link to="/platform" className="btn-light">Explore platform</Link>
          </div>
        </div>
      </section>

      <StatStrip stats={[
        { value: '8', label: 'Service verticals', sub: 'one shared decision fabric' },
        { value: '<10ms', label: 'End-to-end latency', sub: 'across all services' },
        { value: '214+', label: 'Compliance rules', sub: 'active across all modules' },
        { value: '6', label: 'Global jurisdictions', sub: 'FCRA, GDPR, DPDP, PCI, FCA, RBI' },
      ]} />

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Eight verticals. One decision fabric." body="Every service shares the same ingestion plane, model layer, explainability engine, and audit trail — so your teams never work from disconnected signals." />
          <div className="services-grid">
            {ALL_SERVICES.map((s) => <ServiceCard key={s.title} {...s} />)}
          </div>
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="Why a single fabric beats point solutions." body="Disconnected fraud, credit, and compliance tools create evidence gaps, duplicate data contracts, and competing model versions. Credit Line eliminates that." />
          <CapabilityTable rows={[
            { cap: 'Shared data plane', detail: 'All services read from the same enriched transaction stream. No per-service ETL pipelines or data contracts to maintain.', tag: 'unified' },
            { cap: 'Single model registry', detail: 'Fraud, credit, and AML models share a versioned registry. Champion/challenger promotions apply across all services simultaneously.', tag: 'versioned' },
            { cap: 'One audit trail', detail: 'Every signal, score, and decision from every service is written to the same append-only audit log. Regulators get a single export.', tag: 'append-only' },
            { cap: 'Shared graph context', detail: 'Entity relationships discovered by fraud graph detection are immediately available to credit underwriting and AML monitoring.', tag: 'real-time' },
            { cap: 'Cross-service alerts', detail: 'An AML alert can trigger a fraud investigation and a credit review hold simultaneously, from a single rule evaluation.', tag: 'correlated' },
            { cap: 'Unified compliance posture', detail: 'FCRA, PCI DSS, GDPR, DPDP, and FCA controls apply to all services. No per-service compliance configuration required.', tag: 'global' },
          ]} />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Built for regulated institutions." body="Every surface ships with FCRA controls, PQC modules, DPDP/GDPR-ready posture, and adverse-action notice generation." action={<Link to="/security" className="btn-dark">Review security posture</Link>} />
          <HowItWorks steps={[
            { num: '01', title: 'FCRA controls', body: 'Adverse action notices and reason codes auto-generated for every decline. Dispute workflow built in.' },
            { num: '02', title: 'PCI DSS', body: 'Card data handled in a scoped PCI DSS environment. No raw PAN ever reaches model training pipelines.' },
            { num: '03', title: 'GDPR / DPDP', body: 'Consent records, erasure workflows, and data minimisation posture managed per jurisdiction.' },
            { num: '04', title: 'SOC 2', body: 'Continuous control monitoring with evidence collection for Type II audit reports.' },
            { num: '05', title: 'FCA / RBI', body: 'Jurisdiction-specific reporting templates for UK FCA and Reserve Bank of India regulatory submissions.' },
          ]} />
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-16">
          <div className="final-cta">
            <h2>Ready to unify your financial operations?</h2>
            <div className="cta-buttons">
              <Link to="/admin" className="btn-dark">View live console <ArrowUpRight size={15} /></Link>
              <Link to="/portal" className="btn-light">Credit portal</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SMART LENDING
═══════════════════════════════════════════════════════════════════════════ */

export function LendingPage() {
  return (
    <PublicShell
      eyebrow="Smart Lending"
      title="Mortgage origination and credit decisioning for every applicant."
      description="Score thin-file applicants, generate adverse-action-ready reason codes, automate affordability modeling, and run underwriting workflows with full explainability — from application to funding."
      preview={<PagePreview rows={[['Credit score', '684'], ['Alt data', 'active'], ['Reason codes', 'ready'], ['FCRA notice', 'auto-generated']]} />}
      cta={<><Link to="/admin/credit" className="btn-dark">Open credit engine <ArrowUpRight size={14} /></Link><Link to="/services" className="btn-light">All services</Link></>}
      themeClass="lending"
    >
      <StatStrip stats={[
        { value: '94%', label: 'Approval accuracy', sub: 'vs bureau-only baseline' },
        { value: '3.8×', label: 'More thin-file approvals', sub: 'with alternative data signals' },
        { value: '100%', label: 'FCRA reason code coverage', sub: 'on every declined application' },
        { value: '<2s', label: 'Decision latency', sub: 'full underwriting pipeline' },
      ]} />

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="The full lending lifecycle in one operating layer." body="From application ingestion to underwriting decision to compliance evidence, every step is logged and reviewable. No spreadsheet silos." action={<Link to="/admin/credit" className="btn-dark">Open credit engine</Link>} />
          <div className="feature-rows">
            <FeatureRow icon={CreditCard} title="Alternative underwriting" body="Score applicants using utility payment history, telco usage patterns, wallet behavior, rental payment records, and open-banking transaction signals alongside traditional bureau data. Credit Line's feature engine handles normalization so lenders define what matters." meta="inclusive" />
            <FeatureRow icon={FileCheck2} title="FCRA-compliant reason codes" body="Every declined application automatically receives a machine-readable reason code set and a human-readable adverse action draft. The notice includes the specific data source, the model feature, and the threshold that caused the decline — ready for mailing or digital delivery." meta="FCRA ready" />
            <FeatureRow icon={TrendingUp} title="Affordability modeling" body="Debt-service coverage ratios, gross income estimates from open-banking data, expense categorization, and stress-test scenarios (rate hike +2%, income shock -20%) are computed at decision time and attached to the underwriting memo." meta="risk-aware" />
            <FeatureRow icon={Bot} title="Underwriting workflow automation" body="Manual review queues are prioritized by risk tier, SLA countdown, and document completeness. Escalation paths, co-signer review, and conditional approval workflows are configured per product without code changes." meta="automated" />
            <FeatureRow icon={Network} title="Fraud signal integration" body="The same graph that powers fraud detection shares entity links with the credit underwriting path. A thin-file applicant who appears in a synthetic identity cluster is flagged before the credit model scores them." meta="graph-aware" />
            <FeatureRow icon={ShieldCheck} title="Fair lending monitoring" body="Disparate impact analysis runs continuously across protected classes. Lenders receive a daily report showing approval rate divergence, feature importance by group, and HMDA-ready data exports." meta="fair lending" />
          </div>
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="How a lending decision is made." body="Every decision follows the same five-step evidence loop regardless of product type, applicant profile, or jurisdiction." />
          <HowItWorks steps={[
            { num: '01', title: 'Ingest application', body: 'Application data, bureau pull, open-banking consent, and alternative signals are normalised into a single applicant record in under 400ms.' },
            { num: '02', title: 'Score risk layers', body: 'Identity fraud check, synthetic identity graph scan, bureau credit score, and alternative credit model run in parallel — each with confidence intervals.' },
            { num: '03', title: 'Run affordability', body: 'DTI, DSCR, income stability, and stress-test projections are calculated from live open-banking data and attached to the underwriting memo.' },
            { num: '04', title: 'Generate evidence', body: 'Reason codes, adverse-action draft, SHAP feature attribution, and regulatory notice are produced automatically before any analyst touches the case.' },
            { num: '05', title: 'Route decision', body: 'Auto-approve, manual review queue, conditional approval, or decline — each path routes to the correct team with all evidence pre-attached.' },
          ]} />
        </div>
      </section>

      <section className="public-section border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/10">
        <div className="public-wrap py-20">
          <SH title="Interactive Underwriting Sandbox" body="Simulate credit underwriting outcomes and reason code generation dynamically based on alternative credit data inputs." />
          <LendingSimulator />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Capability deep-dive." body="Every feature is designed for lenders who face real compliance scrutiny, not simplified demos." />
          <CapabilityTable rows={[
            { cap: 'Bureau integration', detail: 'Direct pulls from Equifax, Experian, TransUnion (US) and CIBIL, Experian India, CRIF (India) with automated stale-data refresh.', tag: 'live pull' },
            { cap: 'Alternative data sources', detail: 'Utility, telco, rental, payroll, and open-banking data normalised into a common feature schema. Lender controls which sources apply per product.', tag: '12+ sources' },
            { cap: 'Monotonic constraints', detail: 'Lenders can enforce monotonic credit score constraints to satisfy regulator expectations that higher scores always favor applicants.', tag: 'regulator-friendly' },
            { cap: 'Reason code mapping', detail: 'FCRA-compliant adverse action codes (AA01-AA99) auto-mapped to model features. Custom reason code libraries for non-US jurisdictions.', tag: 'FCRA / custom' },
            { cap: 'Disparate impact testing', detail: 'Continuous 80% rule testing across age, gender, race, and national origin attributes. Daily report with flag thresholds configurable per lender.', tag: 'fair lending' },
            { cap: 'Conditional approval', detail: 'Approve-with-conditions (co-signer, additional docs, reduced limit) is a first-class decision type with its own audit trail and customer communication template.', tag: 'workflow' },
            { cap: 'Mortgage origination', detail: 'LTV calculation, appraisal-value integration, HMDA data collection, and rate lock evidence packaged for secondary market sale readiness.', tag: 'mortgage' },
            { cap: 'Real-time rate pricing', detail: 'Risk-based pricing engine adjusts rate spreads based on credit tier, LTV, DTI, and market benchmarks at decision time.', tag: 'pricing' },
          ]} />
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="Built for every lending team." body="" />
          <div className="grid gap-px border border-[var(--border-secondary)] bg-[var(--border-secondary)] lg:grid-cols-3">
            <ProofPanel title="Retail lenders" items={['Alt-data scorecards for thin-file applicants', 'Mortgage origination decisioning', 'LTV and affordability signals', 'Fair lending continuous monitoring', 'HMDA data exports']} />
            <ProofPanel title="Credit operations" items={['Adverse action notice on every decline', 'Queue management with SLA tracking', 'Decision evidence for auditors', 'Conditional approval workflow', 'Re-application policy enforcement']} />
            <ProofPanel title="Regulators & auditors" items={['FCRA-compliant output format', 'Disparate impact reporting', 'Model explanation for examiner review', 'Audit trail with feature hashes', 'Monotonic constraint documentation']} />
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Frequently asked questions." body="Real questions from lending teams evaluating Credit Line." />
          <FAQ items={[
            { q: 'Can we bring our own credit model instead of using Credit Line\'s?', a: 'Yes. Credit Line\'s model registry supports BYOM (bring your own model) via ONNX or Python scoring endpoints. Your model runs alongside Credit Line\'s in a champion/challenger configuration. Reason codes and FCRA notices are generated from your model\'s feature attributions.' },
            { q: 'How does alternative data avoid fair lending violations?', a: 'Credit Line runs continuous disparate impact testing on every alternative data feature before it enters production. Features that produce adverse disparate impact above the 80% rule threshold are flagged and require lender sign-off. The full disparate impact report is available for CFPB examination.' },
            { q: 'What happens if the open-banking consent is withdrawn mid-application?', a: 'Consent withdrawal is handled in real time. The application is re-scored without the open-banking features and the applicant is notified. If the re-score changes the decision, a new adverse action notice is generated automatically.' },
            { q: 'How quickly can we go live for a new loan product?', a: 'New products are configured through the lender control panel without code changes. Feature selection, threshold settings, workflow routing, and reason code mapping typically take 1–3 business days per product.' },
            { q: 'Is the mortgage origination workflow MISMO-compliant?', a: 'Yes. Credit Line outputs MISMO 3.4 XML for loan origination data and supports Fannie Mae DU and Freddie Mac LPA automated underwriting system (AUS) integration for secondary market readiness.' },
          ]} />
        </div>
      </section>
    </PublicShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAYMENT INTELLIGENCE
═══════════════════════════════════════════════════════════════════════════ */

export function PaymentsPage() {
  return (
    <PublicShell
      eyebrow="Payment Intelligence"
      title="Real-time monitoring across every payment rail."
      description="Card, bank transfer, wallet, and cross-border payments scored and enriched in under 10ms. Full dispute and chargeback automation with sanctions screening and merchant graph analysis built in."
      preview={<PagePreview rows={[['Rail', 'UPI + SWIFT'], ['Latency', '8.7ms'], ['Dispute', 'auto-filed'], ['Sanctions', 'screened']]} />}
      cta={<><Link to="/admin/payments" className="btn-dark">Open payment console <ArrowUpRight size={14} /></Link><Link to="/services" className="btn-light">All services</Link></>}
      themeClass="payments"
    >
      <StatStrip stats={[
        { value: '8.7ms', label: 'Average scoring latency', sub: 'end-to-end per transaction' },
        { value: '10,200+', label: 'Banks & fintechs connected', sub: 'across 50 markets' },
        { value: '99.97%', label: 'Uptime SLA', sub: 'payment monitoring availability' },
        { value: '0.17%', label: 'Average chargeback rate', sub: 'on monitored portfolios' },
      ]} />

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Payment fraud stopped at the rail, not the report." body="Every transaction is enriched with device, merchant, velocity, and behavioral signals before it clears the network." action={<Link to="/admin/payments" className="btn-dark">Open payment console</Link>} />
          <div className="feature-rows">
            <FeatureRow icon={Banknote} title="Multi-rail coverage" body="UPI, IMPS, NEFT, RTGS, SWIFT, ACH, SEPA, card networks (Visa, Mastercard, RuPay), and digital wallets (Paytm, PhonePe, Google Pay) share a single enrichment and scoring layer. No per-rail integration required." meta="universal" />
            <FeatureRow icon={Network} title="Merchant graph analysis" body="Collusion patterns, excessive chargeback merchants, and shell merchant networks are flagged through shared-entity graph analysis. A suspicious merchant is flagged across all connected acquirers simultaneously." meta="graph-aware" />
            <FeatureRow icon={Bot} title="Dispute and chargeback automation" body="Chargeback and representment workflows are triggered automatically with evidence packages attached: original transaction data, device fingerprint, velocity history, and behavioral biometrics. Win-rate tracking is built in." meta="automated" />
            <FeatureRow icon={FileCheck2} title="Sanctions screening" body="OFAC SDN, UN Security Council, EU Consolidated, HM Treasury, and RBI watchlists are checked at transaction time. Screening results are signed into the audit trail within 100ms of the payment event." meta="compliant" />
            <FeatureRow icon={Zap} title="Velocity and pattern rules" body="Per-customer, per-device, per-merchant, and per-region velocity rules are evaluated in real time against a rolling 90-day window. Rules are configured without code by operations teams." meta="configurable" />
            <FeatureRow icon={TrendingUp} title="Cross-border risk scoring" body="FX-risk, correspondent bank reputation, beneficiary country risk, and trade-based money-laundering signals are combined into a single cross-border risk score per payment." meta="international" />
          </div>
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="How a payment is scored." body="From network receipt to cleared or held — every step is enriched, scored, and documented." />
          <HowItWorks steps={[
            { num: '01', title: 'Receive at rail', body: 'Payment message arrives from the network (UPI, SWIFT, ACH, card). Credit Line intercepts at the payment gateway or via webhook within 2ms.' },
            { num: '02', title: 'Enrich', body: 'Device fingerprint, merchant reputation, velocity history, beneficiary risk, and behavioral signals are appended to the transaction record in parallel.' },
            { num: '03', title: 'Screen', body: 'Sanctions lists, PEP databases, and adverse media are checked. A screening pass/fail with confidence score is attached to the enriched record.' },
            { num: '04', title: 'Score', body: 'Fraud model, AML typology engine, and graph contagion check all run concurrently. Combined risk tier (low/medium/high/critical) is produced.' },
            { num: '05', title: 'Act', body: 'Auto-approve, soft-decline, hard-decline, hold-for-review, or escalate-to-SOAR based on risk tier and configurable thresholds. Evidence package attached.' },
          ]} />
        </div>
      </section>

      <section className="public-section border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/10">
        <div className="public-wrap py-20">
          <SH title="Payment Velocity & Intelligence Sandbox" body="Observe real-time UPI, SWIFT, and Card transaction velocity scoring and simulated sanctions checking in action." />
          <PaymentsTicker />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Payment capability deep-dive." body="Technical specifications for payment teams evaluating Credit Line." />
          <CapabilityTable rows={[
            { cap: 'Rail coverage', detail: 'UPI, IMPS, NEFT, RTGS (India); SWIFT, SEPA, ACH (international); Visa, Mastercard, RuPay, Amex (card); 40+ digital wallet integrations.', tag: '80+ rails' },
            { cap: 'Scoring latency', detail: 'P50: 6ms, P95: 14ms, P99: 22ms end-to-end including enrichment, sanctions check, and fraud model inference.', tag: 'P99 < 22ms' },
            { cap: 'Sanctions lists', detail: 'OFAC SDN, UN Security Council, EU Consolidated, HM Treasury, RBI, and custom internal watchlists. Refresh every 15 minutes.', tag: 'multi-list' },
            { cap: 'Chargeback automation', detail: 'Representment evidence package auto-built from transaction data, device fingerprint, and customer consent records. Submitted via Visa/MC dispute APIs.', tag: 'auto-evidence' },
            { cap: 'Merchant risk scoring', detail: 'Merchant category risk, chargeback ratio trend, fraud velocity, and graph collusion index combined into a single merchant risk score.', tag: 'merchant graph' },
            { cap: 'Cross-border FX risk', detail: 'Correspondent bank reputation scoring, beneficiary country FATF risk tier, and currency-risk normalization for cross-border payments.', tag: 'FATF-aligned' },
            { cap: 'Velocity rules engine', detail: 'Per-customer, per-device, per-merchant, and per-IP velocity windows from 1 minute to 90 days. Rules edited by operations teams in real time.', tag: 'no-code rules' },
            { cap: 'Dispute win tracking', detail: 'Dispute filing rate, win rate, and evidence quality score tracked per dispute type and per merchant category. Daily report for dispute teams.', tag: 'analytics' },
          ]} />
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="Built for every payments team." body="" />
          <div className="grid gap-px border border-[var(--border-secondary)] bg-[var(--border-secondary)] lg:grid-cols-3">
            <ProofPanel title="Payment operations" items={['Live fraud scoring per transaction', 'Multi-rail unified monitoring view', 'Chargeback with auto-evidence filing', 'Merchant risk scoring and alerts', 'Velocity rule management without code']} />
            <ProofPanel title="Compliance" items={['Sanctions screening at clearing', 'PCI DSS-aligned data handling', 'AML transaction monitoring', 'FATF-aligned cross-border risk', 'Audit trail per transaction event']} />
            <ProofPanel title="Finance & treasury" items={['Settlement reconciliation signals', 'Dispute win-rate analytics', 'Multi-currency risk normalization', 'Chargeback reserve forecasting', 'Scheme fee impact monitoring']} />
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Frequently asked questions." body="Payment platform teams ask these most." />
          <FAQ items={[
            { q: 'Can Credit Line score transactions in real time without adding latency to the payment path?', a: 'Yes. Credit Line integrates as an async enrichment layer for batch review or as a synchronous gateway interceptor for real-time block/pass decisions. The synchronous path adds a P95 latency of 14ms, which is within the threshold of most payment networks.' },
            { q: 'How does multi-rail support work? Do we need separate integrations per rail?', a: 'No. Credit Line uses a normalised payment message schema that maps from any rail format (ISO 20022, ISO 8583, UPI JSON, ACH NACHA) into a single enriched record. You connect once via webhook or API and coverage extends to all supported rails.' },
            { q: 'What happens if the sanctions screening service is unavailable?', a: 'Credit Line has a tiered fallback: cached list check (5-minute TTL), then configurable fail-open or fail-closed behavior. Fail-closed holds the payment and alerts the operations queue. All fallback decisions are flagged in the audit trail for post-hoc review.' },
            { q: 'How are chargeback evidence packages built?', a: 'Credit Line assembles the representment package automatically from: original authorisation data, AVS/CVV match results, 3DS authentication status, device fingerprint, customer behavioral biometrics, and the full transaction velocity history. The package is formatted per Visa and Mastercard chargeback reason code specifications.' },
          ]} />
        </div>
      </section>
    </PublicShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WEALTH & INVESTMENT
═══════════════════════════════════════════════════════════════════════════ */

export function WealthPage() {
  return (
    <PublicShell
      eyebrow="Wealth & Investment"
      title="Portfolio risk, KYC, and suitability for wealth management."
      description="Protect HNI portfolios with real-time risk scoring, automate KYC/EDD for wealth accounts, enforce MiFID II and SEBI suitability rules at recommendation time, and detect advisor churning — all with a complete audit trail."
      preview={<PagePreview rows={[['KYC status', 'verified'], ['Suitability', 'matched'], ['Portfolio risk', '0.18'], ['AML tier', 'low']]} />}
      cta={<><Link to="/admin/wealth" className="btn-dark">Open wealth console <ArrowUpRight size={14} /></Link><Link to="/services" className="btn-light">All services</Link></>}
      themeClass="wealth"
    >
      <StatStrip stats={[
        { value: '4,820+', label: 'HNI accounts monitored', sub: 'across wealth platforms' },
        { value: '91%', label: 'Suitability pass rate', sub: 'first-time recommendation check' },
        { value: '100%', label: 'EDD automation rate', sub: 'for PEP-flagged accounts' },
        { value: '48h', label: 'KYC refresh cycle', sub: 'for high-risk wealth accounts' },
      ]} />

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Wealth operations need the same rigor as retail banking." body="High-net-worth accounts carry elevated compliance exposure and concentrated portfolio risk. Credit Line applies the same evidence-first approach to wealth platforms." action={<Link to="/admin/wealth" className="btn-dark">Open wealth console</Link>} />
          <div className="feature-rows">
            <FeatureRow icon={LineChart} title="Portfolio risk scoring" body="Real-time concentration risk, drawdown exposure, correlation alerts, and VaR estimates for HNI and institutional portfolios. Thresholds are configurable per client risk profile. Breach events trigger an evidence-backed alert within 500ms." meta="real-time" />
            <FeatureRow icon={ShieldCheck} title="KYC / EDD for wealth" body="Enhanced due diligence workflows handle source-of-wealth verification, PEP screening, adverse media monitoring, and beneficial ownership resolution for wealth accounts. Refresh cycles are triggered automatically by risk tier or tenure." meta="EDD ready" />
            <FeatureRow icon={TrendingUp} title="Investment suitability" body="MiFID II (EU), SEBI (India), and MAS (Singapore) suitability rules are enforced at recommendation time. Every recommendation ships with a documented rationale that includes the client risk profile, instrument risk rating, and the specific rules checked." meta="regulatory" />
            <FeatureRow icon={Bot} title="Advisor behavior oversight" body="Churning detection, best-interest documentation, and suitability exception logging catch advisor misconduct before it reaches a compliance review. Alerts are scored by severity and routed to the appropriate compliance officer." meta="fiduciary" />
            <FeatureRow icon={Network} title="AML monitoring for wealth" body="Wealth account transaction flows are monitored using typologies specific to HNI accounts: structuring of large transfers, layering through multi-currency accounts, and round-trip flows through offshore entities." meta="HNI-specific" />
            <FeatureRow icon={FileCheck2} title="Regulatory reporting" body="MiFID II transaction reporting, EMIR trade reporting, FATCA/CRS information exchange, and SEBI reporting formats generated from the same wealth data with no manual re-entry." meta="multi-jurisdiction" />
          </div>
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="How a wealth recommendation is checked." body="From advisor input to client delivery — every recommendation has a documented compliance check." />
          <HowItWorks steps={[
            { num: '01', title: 'Client profile', body: 'Risk tolerance questionnaire, financial situation assessment, and investment objective documentation captured and versioned per MiFID II requirements.' },
            { num: '02', title: 'Instrument scoring', body: 'The recommended instrument is scored for market risk, credit risk, liquidity risk, and ESG risk. SRRI rating is assigned per EU PRIIPs regulation.' },
            { num: '03', title: 'Suitability check', body: 'Client risk profile is matched against instrument risk rating. Knowledge & experience, financial situation, and investment objective checks run in parallel.' },
            { num: '04', title: 'Evidence package', body: 'A suitability report is generated with the client profile snapshot, instrument risk rating, rules checked, and the advisor sign-off timestamp.' },
            { num: '05', title: 'Ongoing monitoring', body: 'Post-recommendation portfolio drift is monitored continuously. If the portfolio moves outside the client\'s risk tolerance, a re-suitability alert is generated.' },
          ]} />
        </div>
      </section>

      <section className="public-section border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/10">
        <div className="public-wrap py-20">
          <SH title="Portfolio Suitability & Value-at-Risk Stress Tester" body="Adjust portfolio assets and client risk parameters to dynamically stress-test regulatory compliance suitability and VaR margins." />
          <WealthStressTester />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Wealth capability deep-dive." body="Technical specifications for wealth platform teams." />
          <CapabilityTable rows={[
            { cap: 'Portfolio risk metrics', detail: 'VaR (95%, 99%), CVaR, Sharpe ratio, concentration index, beta, and correlation matrix computed in real time from live market data.', tag: 'real-time' },
            { cap: 'KYC data sources', detail: 'PEP databases (World-Check, Dow Jones), adverse media (LexisNexis), company registry (OpenCorporates), and UBO (beneficial ownership) databases across 190 jurisdictions.', tag: '190 jurisdictions' },
            { cap: 'Suitability frameworks', detail: 'MiFID II (EU), SEBI (India), MAS (Singapore), FSB (South Africa), and SEC Regulation BI (US). Framework selection is automatic per client jurisdiction.', tag: 'multi-jurisdiction' },
            { cap: 'Churning detection', detail: 'Annualised turnover ratio, break-even holding period, and excess transaction cost model. Alerts generated when turnover exceeds 200% annually without documented rationale.', tag: 'fiduciary' },
            { cap: 'AML typologies', detail: 'Wealth-specific typologies: offshore layering, beneficial-owner obfuscation, real-estate money laundering, and art/luxury asset purchase structuring.', tag: 'HNI typologies' },
            { cap: 'FATCA / CRS', detail: 'Automatic US person and reportable account identification. CRS reportable jurisdiction determination per OECD standards. XML report generation.', tag: 'FATCA / CRS' },
            { cap: 'Source of wealth', detail: 'Wealth source documentation workflow: inheritance, business sale, investment returns, and salary. Document upload, OCR extraction, and analyst review queue built in.', tag: 'EDD' },
            { cap: 'ESG risk scoring', detail: 'MSCI ESG rating integration, controversial weapons screen, climate risk exposure score, and carbon footprint estimate per portfolio.', tag: 'ESG / SFDR' },
          ]} />
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="Built for every wealth team." body="" />
          <div className="grid gap-px border border-[var(--border-secondary)] bg-[var(--border-secondary)] lg:grid-cols-3">
            <ProofPanel title="Wealth managers" items={['HNI portfolio risk scoring in real time', 'Suitability check at recommendation', 'Advisor churning detection', 'ESG portfolio risk scoring', 'Post-recommendation drift monitoring']} />
            <ProofPanel title="Compliance officers" items={['KYC and EDD automation', 'PEP and sanctions at onboarding', 'AML monitoring for wealth flows', 'Source-of-wealth documentation', 'MiFID II suitability records']} />
            <ProofPanel title="Operations" items={['Account review queue management', 'Suspicious activity escalation', 'Regulatory evidence packaging', 'FATCA/CRS reporting automation', 'KYC refresh scheduling']} />
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Frequently asked questions." body="" />
          <FAQ items={[
            { q: 'Can Credit Line integrate with our existing portfolio management system?', a: 'Yes. Credit Line exposes a REST API for portfolio position feeds and a webhook for real-time risk alerts. Pre-built connectors exist for Temenos WealthSuite, FIS Profile, and SS&C Advent. Custom integrations take 2–4 weeks.' },
            { q: 'How is suitability documentation stored for MiFID II ex-post reporting?', a: 'Every suitability check is stored as an immutable record with the client profile snapshot at the time of recommendation, the instrument risk rating, the rules evaluated, and the advisor sign-off. Records are retained for the MiFID II mandated 5-year period and are exportable in XML or PDF.' },
            { q: 'How does the KYC refresh cycle work for dormant accounts?', a: 'Dormant accounts (no activity for 12 months) are flagged for a simplified KYC refresh. High-risk accounts (PEP, elevated AML score) are refreshed every 6 months regardless of activity. The refresh workflow sends a digital verification link to the client and escalates to analyst review if the client does not respond within 14 days.' },
            { q: 'Does Credit Line support ESG/sustainable investing compliance?', a: 'Yes. Credit Line integrates with MSCI ESG ratings and provides SFDR Article 8/9 fund classification support. The suitability module can be configured to include ESG preference questions per the EU Sustainability Preferences regime.' },
          ]} />
        </div>
      </section>
    </PublicShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INSURTECH
═══════════════════════════════════════════════════════════════════════════ */

export function InsurancePage() {
  return (
    <PublicShell
      eyebrow="InsurTech"
      title="Claims fraud detection and AI-powered underwriting."
      description="Detect fraudulent claims at FNOL using graph intelligence, score underwriting risk from telematics and behavioral signals, and automate payout decisions with a complete, regulator-ready audit trail."
      preview={<PagePreview rows={[['Claim risk', '0.84'], ['Telematics', 'active'], ['FNOL', 'auto-triaged'], ['STP rate', '67%']]} />}
      cta={<><Link to="/admin" className="btn-dark">Open console <ArrowUpRight size={14} /></Link><Link to="/services" className="btn-light">All services</Link></>}
      themeClass="insurance"
    >
      <StatStrip stats={[
        { value: '67%', label: 'Straight-through processing rate', sub: 'for low-risk claims' },
        { value: '3.2×', label: 'More fraud rings detected', sub: 'vs rule-based systems' },
        { value: '<90s', label: 'FNOL triage time', sub: 'from submission to risk score' },
        { value: '28%', label: 'Claims leakage reduction', sub: 'on monitored portfolios' },
      ]} />

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Insurance fraud costs more than any other financial crime." body="Credit Line brings graph intelligence and behavioral scoring to claims management, underwriting, and payout workflows." />
          <div className="feature-rows">
            <FeatureRow icon={ShieldCheck} title="FNOL claims fraud scoring" body="First Notice of Loss signals — claimant history, incident location, date/time patterns, adjuster notes, and third-party corroboration — are scored within 90 seconds of submission. The fraud score includes a confidence interval and a list of the top contributing features." meta="real-time" />
            <FeatureRow icon={Network} title="Fraud ring detection" body="Claim farms, staged accidents, organized motor fraud rings, and medical provider collusion networks are exposed through shared-identity graph analysis. A single suspected fraudulent claim triggers a ring expansion check across all connected claimants, providers, and vehicles." meta="graph-aware" />
            <FeatureRow icon={TrendingUp} title="Telematics underwriting" body="Driving behavior data — harsh braking, night driving, speeding frequency, route risk score, and mileage — combined with UBI telematics and device signals produce a behavioral motor risk score without manual inspection." meta="behavioral" />
            <FeatureRow icon={Bot} title="Straight-through payout" body="Low-risk claims (score < 0.25) are processed for payment automatically with evidence attached. Medium-risk claims route to a fast-track adjuster queue. High-risk claims escalate to SIU with a full evidence package." meta="automated" />
            <FeatureRow icon={FileCheck2} title="Subrogation opportunity detection" body="Credit Line automatically identifies subrogation opportunities from third-party fault indicators, police report signals, and liability pattern analysis — reducing leakage from uncollected recoveries." meta="recovery" />
            <FeatureRow icon={Zap} title="Provider network fraud" body="Medical, auto repair, and legal service provider networks are scored for inflated billing, service-date pattern anomalies, and referral ring relationships. Suspicious providers are flagged before payment is issued." meta="provider" />
          </div>
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="How a claim is scored from FNOL to payout." body="Every claim follows the same evidence-first path, whether it ends in STP payout or SIU referral." />
          <HowItWorks steps={[
            { num: '01', title: 'FNOL received', body: 'Claim notification arrives via app, portal, or call centre. Credit Line captures all available signals immediately: claimant identity, incident details, and policy history.' },
            { num: '02', title: 'Graph expansion', body: 'Entity graph checks whether the claimant, vehicle, address, or provider appears in known fraud rings or shares attributes with flagged claims.' },
            { num: '03', title: 'Multi-model scoring', body: 'Claims fraud model, provider fraud model, and staged-incident detection model run in parallel. Combined risk tier is produced within 90 seconds.' },
            { num: '04', title: 'STP or triage', body: 'Low-risk claims go straight to payment queue. Medium-risk to fast-track adjuster. High-risk to SIU with pre-built evidence package (graph expansion, model scores, policy history).' },
            { num: '05', title: 'Outcome & feedback', body: 'Adjuster and SIU outcomes are fed back to the model registry. Confirmed fraud cases update the graph. False positive rates are monitored by claim type.' },
          ]} />
        </div>
      </section>

      <section className="public-section border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/10">
        <div className="public-wrap py-20">
          <SH title="FNOL Claim Triage & Risk Assessment Simulator" body="Trigger simulated claims and review straight-through processing decisions alongside SIU investigation referrals." />
          <ClaimTriageSimulator />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Insurance capability deep-dive." body="" />
          <CapabilityTable rows={[
            { cap: 'Claims fraud models', detail: 'Gradient boosting for structured claim data, GNN for graph-based ring detection, and anomaly detection for outlier claim patterns. Ensemble score with confidence interval.', tag: 'ensemble' },
            { cap: 'Telematics integration', detail: 'Direct integration with Cambridge Mobile Telematics, LexisNexis Telematics, and raw OBD-II/smartphone telematics streams via standardised APIs.', tag: 'telematics' },
            { cap: 'FNOL triage latency', detail: 'P50: 45s, P95: 90s from claim submission to risk score and routing decision. Excludes third-party document verification.', tag: 'P95 < 90s' },
            { cap: 'Staged accident detection', detail: 'Location risk scoring, time-of-day anomaly, witness pattern analysis, and police report cross-check for motor claims. Staged accident score separate from general fraud score.', tag: 'motor specific' },
            { cap: 'Provider network scoring', detail: 'Medical provider billing anomaly detection (upcoding, unbundling, phantom billing). Auto repair shop inflated estimate detection. Legal referral ring analysis.', tag: 'provider graph' },
            { cap: 'Subrogation detection', detail: 'Third-party fault probability scoring from incident data. Automated subrogation workflow initiation for claims above fault probability threshold.', tag: 'recovery' },
            { cap: 'SIU evidence package', detail: 'Pre-built SIU referral package includes: graph expansion map, model score breakdown, policy history, claimant cross-claim history, and linked entities report.', tag: 'SIU ready' },
            { cap: 'Regulatory reporting', detail: 'FCA (UK), IRDA (India), and NAIC (US) reporting formats for fraud statistics and SIU referral rates. Quarterly summary auto-generated.', tag: 'FCA / IRDA' },
          ]} />
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="Built for every insurance team." body="" />
          <div className="grid gap-px border border-[var(--border-secondary)] bg-[var(--border-secondary)] lg:grid-cols-3">
            <ProofPanel title="Claims teams" items={['FNOL triage in under 90 seconds', 'Fraud score with evidence package', 'STP payout for low-risk claims', 'SIU referral with pre-built evidence', 'Subrogation opportunity flagging']} />
            <ProofPanel title="Underwriting" items={['Telematics and behavioral scoring', 'Premium risk tier classification', 'Fraud ring cluster monitoring', 'Loss ratio prediction by segment', 'Renewal risk re-assessment']} />
            <ProofPanel title="Compliance & actuarial" items={['FCA / IRDA fraud reporting', 'Adverse decision documentation', 'SIU referral rate analytics', 'False positive rate by claim type', 'Leakage and recovery analytics']} />
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Frequently asked questions." body="" />
          <FAQ items={[
            { q: 'Can Credit Line integrate with our existing claims management system?', a: 'Yes. Credit Line provides a REST API for claim event ingestion and a webhook for risk score delivery. Pre-built connectors exist for Guidewire ClaimCenter, Duck Creek, and Majesco Claims. Integration typically takes 1–3 weeks.' },
            { q: 'How does the graph expansion work for claims fraud rings?', a: 'When a claim is submitted, Credit Line checks whether any entity in the claim (claimant, vehicle VIN, address, phone, provider) matches known entities in previously flagged claims. The graph expands one hop at a time until no new connections are found. The expansion result is visualised in the analyst interface and included in the SIU evidence package.' },
            { q: 'What is the false positive rate on claims fraud alerts?', a: 'Typical false positive rates on credit-line-monitored portfolios are 6–9% across all alert types. Staged accident alerts have a slightly higher false positive rate (12%) due to limited corroboration signals. False positive rates are tracked per claim type and model version and are available in the daily analytics report.' },
            { q: 'Does Credit Line support property and liability claims in addition to motor?', a: 'Yes. Credit Line has separate model suites for personal lines (motor, home, travel), commercial lines (property, liability, marine), and specialty lines (D&O, cyber). Each model suite includes claim-type-specific fraud patterns and provider network analysis.' },
          ]} />
        </div>
      </section>
    </PublicShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPEN BANKING
═══════════════════════════════════════════════════════════════════════════ */

export function OpenBankingPage() {
  return (
    <PublicShell
      eyebrow="Open Banking"
      title="PSD2-compliant data aggregation and consent management."
      description="Connect to 10,000+ banks and fintechs across 50 markets, manage consumer consent with granular scope controls, derive verified financial health scores, and power real-time affordability decisions from live transaction data."
      preview={<PagePreview rows={[['Banks connected', '10,200+'], ['Consent', 'managed'], ['Health score', '74/100'], ['Latency', '180ms']]} />}
      cta={<><Link to="/admin" className="btn-dark">Open console <ArrowUpRight size={14} /></Link><Link to="/services/lending" className="btn-light">Lending integration</Link></>}
      themeClass="openbanking"
    >
      <StatStrip stats={[
        { value: '10,200+', label: 'Banks & fintechs', sub: 'connected across 50+ markets' },
        { value: '50+', label: 'Markets covered', sub: 'EU, UK, India (AA), Australia, US' },
        { value: '180ms', label: 'Account data retrieval', sub: 'median latency' },
        { value: '99.5%', label: 'Consent API uptime', sub: 'SLA across all markets' },
      ]} />

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Open banking data with institution-grade controls." body="Credit Line's open banking layer combines aggregation, enrichment, consent lifecycle management, and scoring into a single API surface with a full audit trail." />
          <div className="feature-rows">
            <FeatureRow icon={Globe2} title="Multi-market API aggregation" body="Connect to current accounts, savings, credit cards, investments, and pension accounts across EU (PSD2), UK (Open Banking), India (AA framework), Australia (CDR), and US (FinID / FDX). One API, 50+ markets, no per-market integration work." meta="global" />
            <FeatureRow icon={ShieldCheck} title="Consent lifecycle management" body="Customer-first consent flows with granular permission scopes (read transactions, read balance, read identity), expiry management, partial withdrawal, and full revocation. Every consent action is timestamped and audit-logged." meta="consent-first" />
            <FeatureRow icon={TrendingUp} title="Financial health scoring" body="Income stability index, expense-to-income ratio, savings propensity score, debt burden score, and discretionary spend share — all derived from categorised transaction history and explained per data point." meta="enriched" />
            <FeatureRow icon={FileCheck2} title="Real-time affordability" body="Live DTI (debt-to-income), DSCR, rent-to-income, and payment shock analysis computed from actual account data for credit decisioning. Not survey self-report — live verified data." meta="verified" />
            <FeatureRow icon={Database} title="Direct database sync" body="Establish direct secure pipelines to internal database tables (PostgreSQL, MySQL, Snowflake) for instant synchronization. Live analyze transactions on the fly using active polling indices." meta="live database" />
            <FeatureRow icon={Network} title="Account aggregation for fraud" body="Open banking account data is cross-referenced with the Credit Line fraud graph. Circular payment flows, mule account patterns, and unusual balance movements are flagged automatically." meta="fraud-aware" />
          </div>
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="How open banking consent and data flow works." body="From customer authorisation to scored financial insights — every step is transparent and reversible." />
          <HowItWorks steps={[
            { num: '01', title: 'Consent request', body: 'Customer receives a consent request with specific data scopes listed in plain language. They authenticate directly with their bank — credentials never touch Credit Line.' },
            { num: '02', title: 'Bank authorisation', body: 'The customer\'s bank issues an access token via OAuth 2.0. Credit Line stores the token in the sovereign region matching the customer\'s jurisdiction.' },
            { num: '03', title: 'Data retrieval', body: 'Account data is retrieved via the bank\'s PSD2/Open Banking API. Transactions, balances, and identity data are normalised into a common schema.' },
            { num: '04', title: 'Enrichment & scoring', body: 'Transactions are categorised by the ML engine. Income, expense, and debt signals are extracted. Financial health score and affordability metrics are computed.' },
            { num: '05', title: 'Consent management', body: 'Consent expiry, renewal reminders, and revocation requests are handled automatically. Revocation triggers immediate deletion of retrieved data from all systems.' },
          ]} />
        </div>
      </section>

      <section className="public-section border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/10">
        <div className="public-wrap py-20">
          <SH title="PSD2 Consent & Data Aggregation Sandbox" body="Initiate a mock secure OAuth flow to generate signed bank aggregation tokens and review normalized transaction payloads." />
          <ConsentSandbox />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Open banking capability deep-dive." body="" />
          <CapabilityTable rows={[
            { cap: 'Regulatory frameworks', detail: 'PSD2 (EU), Open Banking UK, RBI Account Aggregator (India), Consumer Data Right (Australia), FDX / FinID (US). Auto-detection per customer jurisdiction.', tag: '5 frameworks' },
            { cap: 'Bank connectivity', detail: '10,200+ banks via direct Open Banking APIs. Fallback to screen-scraping (with explicit consent) for non-API-enabled institutions.', tag: '10,200+ banks' },
            { cap: 'Consent scopes', detail: 'Read transactions (30/90/365 days), read balance (live), read identity, read regular payments, read standing orders, read direct debits. Scope combinations configurable per use case.', tag: 'granular' },
            { cap: 'Data residency', detail: 'EU customer data stays in eu-west-1. India AA data stays in ap-south-1. UK data in eu-west-2. No cross-border data transfer without explicit operator configuration.', tag: 'sovereign' },
            { cap: 'Transaction categorisation', detail: '96 categories, 99-language merchant name normalisation, recurring payment detection, and income pattern recognition. Accuracy > 94% on held-out test sets.', tag: '96 categories' },
            { cap: 'Financial health metrics', detail: 'Income stability (6-month CV), expense smoothing ratio, savings rate, debt service ratio, payment shock (at +2% rate), and discretionary income estimate.', tag: '12 metrics' },
            { cap: 'Affordability for lending', detail: 'Verified DTI, DSCR, rent-to-income, and instalment-to-income ratios from live account data. Signed evidence package ready for underwriting decision.', tag: 'lender-grade' },
            { cap: 'Consent audit log', detail: 'Every consent grant, scope change, renewal, and revocation is timestamped and written to an immutable audit log. Exportable for regulatory examination.', tag: 'audit-ready' },
          ]} />
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="Built for every open banking team." body="" />
          <div className="grid gap-px border border-[var(--border-secondary)] bg-[var(--border-secondary)] lg:grid-cols-3">
            <ProofPanel title="Lenders" items={['Verified income from live accounts', 'Affordability at application time', 'Open banking credit scoring', 'Payment shock stress testing', 'Thin-file uplift from transaction data']} />
            <ProofPanel title="Fintechs" items={['Account aggregation API', 'Consent lifecycle management', 'Transaction categorisation at scale', 'Financial health scoring API', 'Multi-market single integration']} />
            <ProofPanel title="Regulators" items={['PSD2 / RBI AA compliance', 'Consent audit trail', 'Data minimisation posture', 'Revocation within 24 hours', 'Data residency documentation']} />
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Frequently asked questions." body="" />
          <FAQ items={[
            { q: 'Does the customer\'s bank login credential ever reach Credit Line?', a: 'No. Credit Line uses OAuth 2.0 redirect flows for all PSD2/Open Banking markets. The customer authenticates directly with their bank. Credit Line receives only an access token, never the username or password.' },
            { q: 'How is GDPR / DPDP data residency enforced?', a: 'Customer account data is stored and processed in the sovereign region matching the customer\'s jurisdiction at consent time. EU data stays in eu-west, India AA data stays in ap-south. Cross-border movement requires explicit operator configuration and is blocked by default at the infrastructure level.' },
            { q: 'What happens when a customer withdraws consent?', a: 'Consent withdrawal triggers an immediate API call to the bank to revoke the access token, followed by deletion of all retrieved account data from Credit Line systems within 24 hours (GDPR Art. 17 compliance). The lender or fintech receives a webhook notification and the consent audit log is updated.' },
            { q: 'How accurate is the transaction categorisation?', a: 'Category accuracy is >94% on held-out validation sets across all supported markets. Accuracy varies by category: income detection is >98%, recurring subscriptions >97%, irregular expenses >89%. Per-market accuracy reports are available in the developer portal.' },
          ]} />
        </div>
      </section>
    </PublicShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   REGTECH & COMPLIANCE
═══════════════════════════════════════════════════════════════════════════ */

export function RegTechPage() {
  return (
    <PublicShell
      eyebrow="RegTech & Compliance"
      title="AML, SAR, and regulatory reporting in one compliance layer."
      description="Monitor transactions for money laundering using 214+ typologies, generate SAR/STR reports automatically with narrative drafts, and produce multi-jurisdiction regulatory reports from the same decision data — with zero manual re-entry."
      preview={<PagePreview rows={[['AML alerts', '14 active'], ['SARs filed', '3 this week'], ['Typologies', '214 active'], ['False positives', '6.8%']]} />}
      cta={<><Link to="/admin/regtech" className="btn-dark">Open RegTech console <ArrowUpRight size={14} /></Link><Link to="/services" className="btn-light">All services</Link></>}
      themeClass="regtech"
    >
      <StatStrip stats={[
        { value: '214+', label: 'AML typologies', sub: 'active monitoring rules' },
        { value: '6.8%', label: 'False positive rate', sub: 'industry avg is 95–99%' },
        { value: '8', label: 'Regulatory jurisdictions', sub: 'FINCEN, FCA, RBI, SEBI, MAS, AUSTRAC, ECB, OFAC' },
        { value: '<24h', label: 'SAR draft generation', sub: 'from alert to filed report' },
      ]} />

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Compliance that runs at decision speed." body="RegTech modules sit on the same data plane as fraud and credit, so compliance teams get the same real-time signals without a separate pipeline." action={<Link to="/admin/regtech" className="btn-dark">Open RegTech console</Link>} />
          <div className="feature-rows">
            <FeatureRow icon={FileText} title="AML transaction monitoring" body="Rule-based and ML-driven AML alerts across cash, wire, card, digital payment, and cryptocurrency channels. Each alert includes a risk tier (low/medium/high), the matching typology, the contributing transaction list, and a customer risk profile snapshot." meta="real-time" />
            <FeatureRow icon={ShieldCheck} title="Automated SAR generation" body="Suspicious activity report drafts are generated automatically with: structured narrative (FINCEN/FCA format), supporting transaction list, entity graph snapshot, and the investigation timeline. Compliance officers review and submit — they don't start from a blank form." meta="automated" />
            <FeatureRow icon={Globe2} title="Multi-jurisdiction reporting" body="FINCEN SAR (US), FCA Suspicious Activity Report (UK), RBI Suspicious Transaction Report (India), MAS STR (Singapore), AUSTRAC SMR (Australia), and SEBI reports are generated from the same data with jurisdiction-specific formatting applied automatically." meta="8 jurisdictions" />
            <FeatureRow icon={Network} title="214+ AML typology library" body="Typologies cover: structuring / smurfing, round-trip flows, trade-based money laundering, real estate layering, crypto-to-fiat conversion, shell company layering, beneficial owner obfuscation, wire-transfer fan-out, and correspondent banking abuse — with continuous library updates." meta="comprehensive" />
            <FeatureRow icon={Database} title="Real-time database sync" body="Ingest and score transactions straight from core transactional tables. The live DB connector auto-discovers schemas, reads queries, and applies GNN risk models on the fly." meta="direct connection" />
            <FeatureRow icon={Users} title="Case management workflow" body="AML alerts route into a structured case management interface with assignment, note-taking, document attachment, escalation paths, and a 30-day SLA tracker. Every case action is audit-logged with the officer ID and timestamp." meta="workflow" />
          </div>
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="From alert to filed SAR in under 24 hours." body="The traditional AML workflow takes 10–20 days from alert to SAR filing. Credit Line compresses it with automation at every step." />
          <HowItWorks steps={[
            { num: '01', title: 'Alert generated', body: 'A transaction or pattern matches an AML typology rule or exceeds an ML anomaly threshold. Alert created with risk tier, typology ID, and contributing evidence.' },
            { num: '02', title: 'Case opened', body: 'Alert routes to the appropriate analyst queue based on risk tier, typology, and jurisdiction. Case includes customer profile, transaction history, entity graph, and similar prior cases.' },
            { num: '03', title: 'Investigation', body: 'Analyst reviews the case, adds notes, requests additional documents if needed, and checks related accounts. Investigation actions are timestamped in the audit log.' },
            { num: '04', title: 'SAR draft generated', body: 'When the analyst marks the case as "suspicious confirmed", Credit Line auto-generates the SAR narrative, structured data fields, and supporting attachments in the required regulatory format.' },
            { num: '05', title: 'Review & file', body: 'Compliance officer reviews the SAR draft, makes any edits, and approves. Credit Line submits via the regulator\'s electronic filing system (FINCEN BSA E-Filing, FCA UKFIU portal) and records the filing confirmation number.' },
          ]} />
        </div>
      </section>

      <section className="public-section border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)]/10">
        <div className="public-wrap py-20">
          <SH title="AML Typology Matcher & SAR Compiler" body="Select suspicious typologies to map transaction node anomalies and compile regulatory-compliant filing drafts." />
          <SARTypologyMatcher />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="RegTech capability deep-dive." body="Technical specifications for compliance teams and system integrators." />
          <CapabilityTable rows={[
            { cap: 'AML monitoring rules', detail: '214+ typologies including structured, threshold, velocity, network, and behavioral rules. Rules are configurable per jurisdiction, customer segment, and product type.', tag: '214+ typologies' },
            { cap: 'ML-driven detection', detail: 'Unsupervised anomaly detection, supervised SAR-outcome models, and graph neural networks for network-based typologies running alongside rule-based monitoring.', tag: 'ML + rules' },
            { cap: 'False positive rate', detail: 'Platform average 6.8% false positive rate vs industry average of 95–99%. Achieved through risk-scored alert prioritisation and ML triage layer.', tag: '6.8% FPR' },
            { cap: 'SAR formats', detail: 'FINCEN SAR (US), FCA SAR (UK), RBI STR (India), MAS STR (Singapore), AUSTRAC SMR (Australia), SEBI STR (India equity). XML and structured data outputs.', tag: '8 formats' },
            { cap: 'Case management SLA', detail: 'Configurable SLA timers per alert tier. High-risk: 5 business days. Medium: 15 days. Low: 30 days. Breach alerts sent to compliance manager.', tag: 'SLA managed' },
            { cap: 'PEP & sanctions', detail: 'World-Check, Dow Jones, LexisNexis, OFAC, UN, EU, HM Treasury integrated. Daily delta refresh. Match scoring with name-variant fuzzy matching.', tag: 'multi-source' },
            { cap: 'Regulatory filing', detail: 'Direct filing integration with FINCEN BSA E-Filing, UK FCA UKFIU portal, and MAS SONAR. Filing confirmation number recorded in audit log.', tag: 'e-filing' },
            { cap: 'Customer risk rating', detail: 'Dynamic AML risk rating updated on every transaction event, KYC event, and adverse media hit. Rating history stored for examiner review.', tag: 'dynamic' },
          ]} />
        </div>
      </section>

      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <SH title="Use cases across compliance teams." body="Credit Line RegTech supports every compliance function that interacts with transaction monitoring." />
          <UseCaseGrid cases={[
            { icon: FileText, title: 'SAR / STR filing automation', body: 'Compliance teams that previously spent 8–12 hours per SAR on data gathering and narrative writing reduce that to 45-minute review-and-submit workflows.' },
            { icon: Network, title: 'Trade-based money laundering', body: 'TBML typologies check invoice amounts against commodity price benchmarks, over/under-invoicing thresholds, and trade route risk scores — catching what pure payment monitoring misses.' },
            { icon: Globe2, title: 'Correspondent banking oversight', body: 'Correspondent bank relationship risk scoring, nested account detection, and SWIFT message anomaly analysis for banks with cross-border payment exposure.' },
            { icon: Users, title: 'Customer risk stratification', body: 'Dynamic customer risk ratings segment AML monitoring intensity. High-risk customers receive enhanced monitoring frequency and lower alert thresholds automatically.' },
            { icon: Clock, title: 'Regulatory examination preparation', body: 'Examiners can be given a read-only audit view of all AML cases, alert dispositions, SAR filings, and model documentation for a specified date range — no data assembly required.' },
            { icon: Database, title: 'FATF mutual evaluation readiness', body: 'FATF 40 Recommendations compliance assessment runs quarterly against the live AML posture, flagging gaps in technical compliance and effectiveness indicators.' },
          ]} />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <SH title="Frequently asked questions." body="From compliance officers and MLROs evaluating Credit Line." />
          <FAQ items={[
            { q: 'How does Credit Line achieve a 6.8% false positive rate when industry average is 95–99%?', a: 'Three mechanisms work together: (1) an ML triage layer scores each rule-generated alert before it reaches an analyst queue — low-confidence alerts are auto-closed with an explanation; (2) customer context (risk rating, account tenure, historical pattern) adjusts alert thresholds dynamically; (3) analyst feedback on closed alerts retrains the triage model weekly. The result is that analysts only see alerts the system is confident about.' },
            { q: 'Can we use our own AML typology rules alongside Credit Line\'s library?', a: 'Yes. Credit Line\'s rule engine accepts custom typology definitions in a YAML-based rule language. Custom rules can reference any field in the enriched transaction record, customer profile, or entity graph. Custom and library rules run in the same scoring pipeline with no performance difference.' },
            { q: 'How does the SAR narrative generation work?', a: 'When an analyst marks a case as "suspicious confirmed", Credit Line fills in the structured SAR data fields automatically from the case record and generates a narrative draft using a template calibrated for the target jurisdiction (FINCEN SAR narrative format, FCA SAR narrative guidance, etc.). The analyst reviews the draft, edits the narrative, and approves. The auto-generated draft typically requires 10–15 minutes of review vs 3–4 hours of composition from scratch.' },
            { q: 'What is the data retention policy for AML cases and SARs?', a: 'AML cases are retained for 5 years from case closure per FATF Recommendation 11 / EU AMLD retention standards. SAR/STR records are retained for 5 years from filing date. Retention periods are configurable per jurisdiction where local law requires longer retention. Credit Line generates a retention schedule report per jurisdiction on request.' },
            { q: 'How does Credit Line handle correspondent banking monitoring for large banks?', a: 'Credit Line processes correspondent bank payment flows (SWIFT, CHIPS, Fedwire) at the message level. Nested account detection, unusual payment patterns for the correspondent relationship, and cross-border risk scoring are applied per message. A correspondent bank relationship risk score is updated daily and alerts are generated when the score crosses configurable thresholds.' },
          ]} />
        </div>
      </section>
    </PublicShell>
  );
}
