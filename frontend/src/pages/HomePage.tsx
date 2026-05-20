import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight,
  Banknote, Bot, CheckCircle2,
  CreditCard, Database, FileCheck2, FileText,
  Globe2, LineChart, Network, Shield,
  ShieldCheck, Sparkles, Zap,
} from 'lucide-react';
import type { CSSProperties } from 'react';

/* ─── Animated counter ─────────────────────────────────────────────────── */
function useCounter(target: number, duration = 1600, started = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!started) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, target, duration]);
  return val;
}

/* ─── Scroll reveal ──────────────────────────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); el.classList.add('is-visible'); obs.unobserve(el); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── Page ──────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="public-page">
      <Hero />
      <TrustBar />
      <LiveMetrics />
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
  return (
    <section className="hp-hero">
      {/* Gradient mesh background */}
      <div className="hp-hero-mesh" aria-hidden="true">
        <div className="hp-mesh-blob hp-mesh-blob-1" />
        <div className="hp-mesh-blob hp-mesh-blob-2" />
        <div className="hp-mesh-blob hp-mesh-blob-3" />
        <div className="hp-mesh-grid" />
      </div>

      <div className="public-wrap hp-hero-inner">
        <div className="hp-hero-copy">
          {/* Pill badge */}
          <div className="hp-hero-badge">
            <span className="hp-badge-dot" />
            Production-grade financial AI infrastructure
          </div>

          <h1 className="hp-hero-h1">
            Stop fraud.<br />
            Approve more.<br />
            <span className="hp-hero-gradient">Stay compliant.</span>
          </h1>

          <p className="hp-hero-sub">
            Credline is the decision intelligence layer for banks, lenders, and fintechs.
            Fraud detection, credit underwriting, AML compliance, and open banking —
            all on a single platform with built-in explainability and audit trails.
          </p>

          <div className="hp-hero-actions">
            <Link to="/admin" className="hp-btn-primary">
              Start for free <ArrowUpRight size={16} />
            </Link>
            <Link to="/services" className="hp-btn-ghost">
              View all services <ArrowRight size={16} />
            </Link>
          </div>

          <div className="hp-social-proof">
            <div className="hp-avatars">
              {['#b75d57','#5d7ab7','#5db793','#b7a35d','#7d5db7'].map((c, i) => (
                <div key={i} className="hp-avatar" style={{ background: c, zIndex: 5 - i }} />
              ))}
            </div>
            <p><strong>500+ risk teams</strong> trust Credline for production decisions</p>
          </div>
        </div>

        {/* Floating dashboard preview */}
        <div className="hp-hero-visual">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2800);
    return () => clearInterval(id);
  }, []);

  const alerts = [
    { id: 'FRD-9921', label: 'Velocity spike · UPI', risk: 0.94, color: '#f08d86', rail: 'UPI' },
    { id: 'AML-2201', label: 'Structuring detected', risk: 0.88, color: '#e1b96a', rail: 'Wire' },
    { id: 'CRD-1142', label: 'Thin-file approved', risk: 0.21, color: '#67c587', rail: 'Credit' },
    { id: 'FRD-9934', label: 'Mule path identified', risk: 0.97, color: '#f08d86', rail: 'IMPS' },
  ];
  const active = tick % alerts.length;

  return (
    <div className="hp-dashboard">
      {/* Header bar */}
      <div className="hp-dash-header">
        <div className="hp-dash-dots">
          <span style={{ background: '#f08d86' }} />
          <span style={{ background: '#e1b96a' }} />
          <span style={{ background: '#67c587' }} />
        </div>
        <span className="hp-dash-title">Credline · Risk Console</span>
        <div className="hp-dash-live">
          <span className="hp-live-dot" />
          Live
        </div>
      </div>

      {/* KPI row */}
      <div className="hp-dash-kpis">
        {[
          { label: 'Fraud blocked (24h)', value: '₹24.8M', up: true },
          { label: 'Decisions made', value: '1.2M', up: true },
          { label: 'False positives', value: '6.8%', up: false },
        ].map(k => (
          <div key={k.label} className="hp-dash-kpi">
            <span className="hp-kpi-label">{k.label}</span>
            <span className="hp-kpi-value">{k.value}</span>
            <span className={`hp-kpi-trend ${k.up ? 'hp-trend-up' : 'hp-trend-down'}`}>
              {k.up ? '↑' : '↓'} vs yesterday
            </span>
          </div>
        ))}
      </div>

      {/* Alert feed */}
      <div className="hp-dash-alerts">
        <div className="hp-alerts-header">
          <span>Risk alerts</span>
          <span className="hp-alerts-count">{alerts.length} active</span>
        </div>
        {alerts.map((a, i) => (
          <div key={a.id} className={`hp-alert-row ${i === active ? 'hp-alert-active' : ''}`}>
            <span className="hp-alert-dot" style={{ background: a.color }} />
            <span className="hp-alert-id">{a.id}</span>
            <span className="hp-alert-label">{a.label}</span>
            <div className="hp-alert-bar-wrap">
              <div className="hp-alert-bar" style={{ width: `${a.risk * 100}%`, background: a.color }} />
            </div>
            <span className="hp-alert-score" style={{ color: a.color }}>{a.risk.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Graph mini */}
      <div className="hp-dash-graph">
        <span className="hp-graph-label">Transaction volume (7d)</span>
        <div className="hp-graph-bars">
          {[65, 82, 74, 91, 88, 95, 100].map((h, i) => (
            <div key={i} className="hp-graph-bar" style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TRUST BAR
═══════════════════════════════════════════════════════════════════════ */
const TRUST_BADGES = [
  { label: 'FCRA Compliant', icon: '⚖️' },
  { label: 'PCI DSS Level 1', icon: '🔐' },
  { label: 'SOC 2 Type II', icon: '✅' },
  { label: 'GDPR Ready', icon: '🇪🇺' },
  { label: 'ISO 27001', icon: '🛡️' },
  { label: 'RBI AA Framework', icon: '🏦' },
  { label: 'FCA Compliant', icon: '🇬🇧' },
  { label: 'Post-Quantum Ready', icon: '⚡' },
];

function TrustBar() {
  return (
    <div className="hp-trust-bar">
      <div className="hp-trust-inner">
        <span className="hp-trust-label">Compliance posture</span>
        <div className="hp-trust-scroll">
          <div className="hp-trust-track">
            {[...TRUST_BADGES, ...TRUST_BADGES].map((b, i) => (
              <span key={i} className="hp-trust-badge">
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
   LIVE METRICS (animated counters)
═══════════════════════════════════════════════════════════════════════ */
const METRICS = [
  { value: 2847312, suffix: '+', label: 'Decisions per day', sub: 'across all service verticals', prefix: '' },
  { value: 94, suffix: '%', label: 'Model accuracy uplift', sub: 'vs bureau-only baseline', prefix: '' },
  { value: 68, suffix: '%', label: 'False positive reduction', sub: 'industry avg is 95–99% FPR', prefix: '' },
  { value: 8, suffix: '', label: 'Service verticals', sub: 'on one shared decision fabric', prefix: '' },
];

function LiveMetrics() {
  const { ref, visible } = useReveal(0.2);
  return (
    <section className="hp-metrics reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <div className="hp-metrics-grid">
          {METRICS.map((m) => (
            <MetricCell key={m.label} {...m} started={visible} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCell({ value, suffix, prefix, label, sub, started }: {
  value: number; suffix: string; prefix: string;
  label: string; sub: string; started: boolean;
}) {
  const n = useCounter(value, 1800, started);
  const display = value >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + 'M'
    : value >= 1_000 ? n.toLocaleString() : String(n);
  return (
    <div className="hp-metric-cell">
      <div className="hp-metric-num">{prefix}{display}{suffix}</div>
      <div className="hp-metric-label">{label}</div>
      <div className="hp-metric-sub">{sub}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PLATFORM SHOWCASE  (tabbed)
═══════════════════════════════════════════════════════════════════════ */
const TABS = [
  {
    id: 'fraud', icon: Shield, label: 'Fraud Detection',
    headline: 'Stop fraud before it clears the network.',
    body: 'Real-time scoring across card, UPI, SWIFT, and wallet transactions. Graph intelligence flags mule paths, device clusters, and merchant rings in under 10ms — with signed evidence for every block decision.',
    stats: [
      { v: '<10ms', l: 'Decision latency' },
      { v: '94%', l: 'Detection accuracy' },
      { v: '97%', l: 'False-positive reduction' },
    ],
    preview: [
      { label: 'TXN-9921', detail: 'Velocity spike · UPI', risk: 0.94, hi: true },
      { label: 'TXN-9934', detail: 'Mule path · IMPS', risk: 0.97, hi: true },
      { label: 'TXN-9945', detail: 'Low risk · Card', risk: 0.08, hi: false },
      { label: 'TXN-9952', detail: 'Device cluster hit', risk: 0.82, hi: true },
    ],
  },
  {
    id: 'credit', icon: CreditCard, label: 'Credit Underwriting',
    headline: 'Approve more applicants with less risk.',
    body: 'Score thin-file applicants using alternative data — utility, telco, open banking, wallet — alongside bureau signals. FCRA-compliant reason codes generated automatically for every decision.',
    stats: [
      { v: '3.8×', l: 'More thin-file approvals' },
      { v: '100%', l: 'FCRA reason code coverage' },
      { v: '<2s', l: 'Full underwriting pipeline' },
    ],
    preview: [
      { label: 'CUST-4421', detail: 'Alt-data approved · 684', risk: 0.18, hi: false },
      { label: 'CUST-4422', detail: 'Bureau + Open Banking', risk: 0.31, hi: false },
      { label: 'CUST-4423', detail: 'Thin file · declined', risk: 0.76, hi: true },
      { label: 'CUST-4424', detail: 'Conditional · co-signer', risk: 0.52, hi: false },
    ],
  },
  {
    id: 'aml', icon: FileText, label: 'AML & Compliance',
    headline: 'Cut false positives from 99% to 6.8%.',
    body: '214+ money laundering typologies. ML triage layer scores every alert before it reaches an analyst. SAR reports drafted automatically with narrative and supporting evidence — from alert to filing in under 24 hours.',
    stats: [
      { v: '6.8%', l: 'False positive rate' },
      { v: '214+', l: 'AML typologies' },
      { v: '<24h', l: 'Alert to SAR filing' },
    ],
    preview: [
      { label: 'AML-2201', detail: 'Structuring · High', risk: 0.91, hi: true },
      { label: 'AML-2202', detail: 'Round-trip · SAR drafted', risk: 0.88, hi: true },
      { label: 'AML-2203', detail: 'Cash intensive · Medium', risk: 0.55, hi: false },
      { label: 'AML-2204', detail: 'Trade-based ML · High', risk: 0.87, hi: true },
    ],
  },
  {
    id: 'openbanking', icon: Globe2, label: 'Open Banking',
    headline: 'Verified income data in 180ms.',
    body: 'Connect to 10,200+ banks across 50 markets. PSD2/AA-compliant consent management, real-time transaction categorisation, and financial health scores built from verified account data — not survey responses.',
    stats: [
      { v: '10,200+', l: 'Banks connected' },
      { v: '180ms', l: 'Account data latency' },
      { v: '96', l: 'Transaction categories' },
    ],
    preview: [
      { label: 'ACC-8821', detail: 'Income verified · ₹1.2L/mo', risk: 0.12, hi: false },
      { label: 'ACC-8834', detail: 'Health score · 74/100', risk: 0.26, hi: false },
      { label: 'ACC-8841', detail: 'Consent active · PSD2', risk: 0.09, hi: false },
      { label: 'ACC-8855', detail: 'Affordability · DTI 0.32', risk: 0.31, hi: false },
    ],
  },
];

function PlatformShowcase() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];
  const { ref } = useReveal();

  return (
    <section className="hp-showcase reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <div className="hp-showcase-header">
          <p className="hp-eyebrow">Platform capabilities</p>
          <h2 className="hp-section-h2">Every financial decision, covered.</h2>
          <p className="hp-section-body">
            Four core modules share one data plane, one model registry, and one audit trail.
            No integration gaps. No competing signal pipelines.
          </p>
        </div>

        {/* Tabs */}
        <div className="hp-tabs">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setActive(i)}
              className={`hp-tab ${i === active ? 'hp-tab-active' : ''}`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="hp-showcase-content" key={tab.id}>
          <div className="hp-showcase-copy">
            <div className="hp-showcase-icon-wrap">
              <tab.icon size={22} />
            </div>
            <h3 className="hp-showcase-h3">{tab.headline}</h3>
            <p className="hp-showcase-body">{tab.body}</p>
            <div className="hp-showcase-stats">
              {tab.stats.map(s => (
                <div key={s.l} className="hp-showcase-stat">
                  <strong>{s.v}</strong>
                  <span>{s.l}</span>
                </div>
              ))}
            </div>
            <Link to={`/services/${tab.id === 'aml' ? 'regtech' : tab.id === 'fraud' ? 'payments' : tab.id}`} className="hp-showcase-link">
              Learn more <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="hp-showcase-panel">
            <div className="hp-panel-header">
              <div className="hp-panel-dots">
                <span /><span /><span />
              </div>
              <span className="hp-panel-title">{tab.label} · Live feed</span>
              <span className="hp-panel-live"><span className="hp-live-dot" /> Live</span>
            </div>
            {tab.preview.map((row) => (
              <div key={row.label} className={`hp-panel-row ${row.hi ? 'hp-panel-row-hi' : ''}`}>
                <span className="hp-panel-id">{row.label}</span>
                <span className="hp-panel-detail">{row.detail}</span>
                <div className="hp-panel-bar-wrap">
                  <div
                    className="hp-panel-bar"
                    style={{
                      width: `${row.risk * 100}%`,
                      background: row.risk > 0.7 ? '#f08d86' : row.risk > 0.4 ? '#e1b96a' : '#67c587',
                    }}
                  />
                </div>
                <span
                  className="hp-panel-score"
                  style={{ color: row.risk > 0.7 ? '#f08d86' : row.risk > 0.4 ? '#e1b96a' : '#67c587' }}
                >
                  {row.risk.toFixed(2)}
                </span>
              </div>
            ))}
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
  { icon: Shield,      title: 'Smart Lending',       sub: 'Mortgage & credit decisioning', path: '/services/lending',     color: '#b75d57' },
  { icon: Banknote,    title: 'Payment Intelligence', sub: 'Multi-rail fraud detection',    path: '/services/payments',    color: '#5d7ab7' },
  { icon: LineChart,   title: 'Wealth & Investment',  sub: 'Portfolio risk & KYC',          path: '/services/wealth',      color: '#5db793' },
  { icon: ShieldCheck, title: 'InsurTech',            sub: 'Claims fraud & underwriting',   path: '/services/insurance',   color: '#b7a35d' },
  { icon: Globe2,      title: 'Open Banking',         sub: 'PSD2 aggregation & consent',    path: '/services/openbanking', color: '#7d5db7' },
  { icon: FileText,    title: 'RegTech',              sub: 'AML, SAR & reporting',          path: '/services/regtech',     color: '#5d9eb7' },
  { icon: Network,     title: 'Graph Intelligence',   sub: 'Ring & contagion detection',    path: '/platform',             color: '#b75d93' },
  { icon: Database,    title: 'MLOps & Infra',        sub: 'Drift monitoring & serving',    path: '/platform',             color: '#7db75d' },
];

function ServicesGrid() {
  const { ref } = useReveal();
  return (
    <section className="hp-services reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <div className="hp-services-header">
          <div>
            <p className="hp-eyebrow">All services</p>
            <h2 className="hp-section-h2">One platform. Eight verticals.</h2>
          </div>
          <p className="hp-services-sub">
            Every service shares the same data plane, model registry, and audit trail.
            No integration gaps.
          </p>
        </div>

        <div className="hp-service-cards">
          {SERVICES.map((s) => (
            <Link key={s.title} to={s.path} className="hp-service-card">
              <div className="hp-sc-icon" style={{ '--sc-color': s.color } as CSSProperties}>
                <s.icon size={18} />
              </div>
              <strong className="hp-sc-title">{s.title}</strong>
              <span className="hp-sc-sub">{s.sub}</span>
              <span className="hp-sc-arrow">→</span>
            </Link>
          ))}
        </div>

        <div className="hp-services-cta">
          <Link to="/services" className="hp-btn-outline">
            Explore all services <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HOW IT WORKS
═══════════════════════════════════════════════════════════════════════ */
const HOW_STEPS = [
  { num: '01', icon: Database, title: 'Ingest & normalise', body: 'Connect any data source — transactions, device signals, bureau pulls, open banking feeds — through a single normalised API. No per-source ETL work.' },
  { num: '02', icon: Sparkles, title: 'Score in parallel', body: 'Fraud, credit, AML, and graph models run concurrently on the same enriched record. Each model produces a score with confidence interval and feature attribution.' },
  { num: '03', icon: FileCheck2, title: 'Explain & audit', body: 'FCRA reason codes, SHAP attributions, adverse-action drafts, and signed audit events are generated automatically — before any human sees the decision.' },
  { num: '04', icon: Bot, title: 'Route & act', body: 'Decisions route to analyst queues, SOAR playbooks, auto-approve flows, or regulatory export paths based on risk tier, jurisdiction, and SLA.' },
];

function HowItWorks() {
  const { ref } = useReveal();
  return (
    <section className="hp-how reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <div className="hp-how-header">
          <p className="hp-eyebrow">How it works</p>
          <h2 className="hp-section-h2">From raw signal to defensible decision in four steps.</h2>
        </div>
        <div className="hp-how-steps">
          {HOW_STEPS.map((s, i) => (
            <div key={s.num} className="hp-how-step">
              <div className="hp-how-num">{s.num}</div>
              {i < HOW_STEPS.length - 1 && <div className="hp-how-connector" />}
              <div className="hp-how-icon"><s.icon size={20} /></div>
              <h3 className="hp-how-title">{s.title}</h3>
              <p className="hp-how-body">{s.body}</p>
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
    quote: "We went from 99% false positives to 6.8% in 90 days. Our AML team can now focus on real suspicious activity instead of chasing ghosts.",
    name: 'Head of Financial Crime', org: 'Top-5 Indian Private Bank',
    avatar: '#b75d57',
  },
  {
    quote: "The alternative credit scoring increased our approval rate by 3.8× for thin-file applicants without any increase in default rates. The reason codes handle our FCRA obligations automatically.",
    name: 'Chief Risk Officer', org: 'Regional NBFC, India',
    avatar: '#5d7ab7',
  },
  {
    quote: "Open banking affordability checks from live account data replaced our manual income verification process entirely. Application-to-decision went from 5 days to under 2 seconds.",
    name: 'VP of Product', org: 'Digital Lending Fintech',
    avatar: '#5db793',
  },
  {
    quote: "The graph intelligence module identified a fraud ring of 147 accounts our existing rules had missed for 9 months. The evidence package was ready for law enforcement within an hour.",
    name: 'Director of Fraud Operations', org: 'Pan-India PSU Bank',
    avatar: '#b7a35d',
  },
];

function Testimonials() {
  const [active, setActive] = useState(0);
  const { ref } = useReveal();

  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % TESTIMONIALS.length), 5000);
    return () => clearInterval(id);
  }, []);

  const t = TESTIMONIALS[active];

  return (
    <section className="hp-testimonials reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <p className="hp-eyebrow" style={{ textAlign: 'center' }}>What customers say</p>
        <div className="hp-testimonial-card">
          <div className="hp-quote-icon">"</div>
          <blockquote className="hp-quote">{t.quote}</blockquote>
          <div className="hp-quote-author">
            <div className="hp-quote-avatar" style={{ background: t.avatar }} />
            <div>
              <strong className="hp-quote-name">{t.name}</strong>
              <span className="hp-quote-org">{t.org}</span>
            </div>
          </div>
        </div>

        {/* Dots */}
        <div className="hp-testimonial-dots">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`hp-dot ${i === active ? 'hp-dot-active' : ''}`}
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
  { name: 'Equifax', cat: 'Bureau' },
  { name: 'Experian', cat: 'Bureau' },
  { name: 'CIBIL', cat: 'Bureau' },
  { name: 'Visa', cat: 'Network' },
  { name: 'Mastercard', cat: 'Network' },
  { name: 'RuPay', cat: 'Network' },
  { name: 'SWIFT', cat: 'Rail' },
  { name: 'UPI / NPCI', cat: 'Rail' },
  { name: 'Temenos', cat: 'Core' },
  { name: 'Salesforce', cat: 'CRM' },
  { name: 'Guidewire', cat: 'Insurance' },
  { name: 'World-Check', cat: 'Watchlist' },
];

function IntegrationLogos() {
  const { ref } = useReveal();
  return (
    <section className="hp-integrations reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="public-wrap">
        <p className="hp-eyebrow" style={{ textAlign: 'center' }}>Pre-built integrations</p>
        <h2 className="hp-section-h2" style={{ textAlign: 'center', maxWidth: '600px', margin: '0.5rem auto 0' }}>
          Plugs into your existing stack.
        </h2>
        <div className="hp-integration-grid">
          {INTEGRATIONS.map((itg) => (
            <div key={itg.name} className="hp-integration-logo">
              <span className="hp-itg-name">{itg.name}</span>
              <span className="hp-itg-cat">{itg.cat}</span>
            </div>
          ))}
        </div>
        <p className="hp-integrations-note">
          + 10,200 banks via Open Banking APIs · SWIFT · ACH · SEPA · 40+ digital wallets
        </p>
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
    <section className="hp-final-cta reveal" ref={ref as React.RefObject<HTMLElement>}>
      <div className="hp-cta-glow" aria-hidden="true" />
      <div className="public-wrap hp-cta-inner">
        <div className="hp-cta-badge">
          <Zap size={13} /> Get started today
        </div>
        <h2 className="hp-cta-h2">
          Ready to stop guessing<br />and start deciding?
        </h2>
        <p className="hp-cta-body">
          Join 500+ risk teams using Credline in production.
          Free trial · No credit card · Live sandbox on day one.
        </p>
        <div className="hp-cta-actions">
          <Link to="/admin" className="hp-btn-primary hp-btn-large">
            Start free trial <ArrowUpRight size={16} />
          </Link>
          <Link to="/services" className="hp-btn-ghost hp-btn-large">
            View all services
          </Link>
        </div>
        <div className="hp-cta-trust">
          {['No credit card required', 'SOC 2 Type II certified', 'GDPR & DPDP compliant', '99.97% uptime SLA'].map(t => (
            <span key={t}><CheckCircle2 size={14} /> {t}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
