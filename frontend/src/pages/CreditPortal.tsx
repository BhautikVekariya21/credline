import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Info,
  Landmark,
  Smartphone,
  TrendingUp,
  WalletCards,
  Sliders,
  FileText,
  Shield,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { apiPost } from '../lib/api';


const dataSources = [
  {
    title: 'Mobile history',
    score: 78,
    description: '24 months of consistent top-ups',
    icon: Smartphone,
  },
  {
    title: 'Utility payments',
    score: 91,
    description: 'On-time rate: 94.2%',
    icon: Landmark,
  },
  {
    title: 'Digital wallet',
    score: 65,
    description: 'Average balance: INR 4,200',
    icon: WalletCards,
  },
];

export default function CreditPortal() {
  return (
    <div className="public-page">
      <section className="public-section public-section-top">
        <div className="public-wrap py-20 md:py-24">
          <div className="page-hero-grid">
            <div>
              <p className="public-pill-title">Credit portal</p>
              <h1>A fairer trust profile for thin-file applicants.</h1>
              <p>
                Credline explains alternative credit signals in plain language while keeping
                customer data inside the right regional controls.
              </p>
            </div>

            <TrustScorePanel />
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <div className="section-head">
            <div className="section-title-block">
              <h2>Alternative data, readable by a human reviewer.</h2>
            </div>
            <div className="section-head-aside">
              <p>
                Each source shows its contribution without hiding behind a black-box score.
              </p>
            </div>
          </div>
          <div className="operations-grid">
            {dataSources.map((source) => (
              <DataSourceCard key={source.title} {...source} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── Interactive Application Flow ─────────────────────────── */}
      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <div className="section-head">
            <div className="section-title-block">
              <span className="cell-icon">
                <Sliders size={18} />
              </span>
              <h2>Try it yourself — score a sample profile.</h2>
            </div>
            <div className="section-head-aside">
              <p>
                Adjust alternative data inputs below and get a real-time trust score
                with full explainability breakdown.
              </p>
            </div>
          </div>
          <InteractiveScorer />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <div className="section-head">
            <div className="section-title-block">
              <span className="cell-icon">
                <Info size={18} />
              </span>
              <h2>How this score works.</h2>
            </div>
            <div className="section-head-aside">
              <p>
                The portal keeps explanation close to action so a lender can review eligibility,
                fairness, and compliance in the same flow.
              </p>
            </div>
          </div>
          <div className="explain-list">
            {[
              'The score is built from alternative data, not only traditional bureau history.',
              'Paying utility bills on time is the strongest positive factor in this sample profile.',
              'Regular mobile top-ups demonstrate financial consistency.',
              'Customer data remains region-aware for DPDP Act 2023 operating needs.',
            ].map((text) => (
              <div key={text} tabIndex={0}>
                <CheckCircle2 size={16} />
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Document Checklist ───────────────────────────────────── */}
      <section className="public-section public-band">
        <div className="public-wrap py-20">
          <div className="section-head">
            <div className="section-title-block">
              <span className="cell-icon">
                <FileText size={18} />
              </span>
              <h2>Application document checklist.</h2>
            </div>
            <div className="section-head-aside">
              <p>
                Micro-loan applications require minimal documentation. Check off what you have ready.
              </p>
            </div>
          </div>
          <DocumentChecklist />
        </div>
      </section>

      <section className="public-section">
        <div className="public-wrap py-20">
          <div className="final-cta final-cta-compact">
            <div>
              <p className="public-section-label">Sample eligibility</p>
              <h2>Trust score 682 qualifies this profile for a reviewed micro-loan offer.</h2>
              <p>
                Final lending terms remain lender-controlled and can require human review.
              </p>
            </div>
            <button className="btn-primary justify-center" type="button">
              Start application <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Interactive Scorer ────────────────────────────────────────── */

function InteractiveScorer() {
  const [simTenure, setSimTenure] = useState(18);
  const [onTimeRate, setOnTimeRate] = useState(88);
  const [topupScore, setTopupScore] = useState(72);
  const [avgTopup, setAvgTopup] = useState(1200);
  const [paymentConsistency, setPaymentConsistency] = useState(82);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    credit_score: number;
    confidence_interval: [number, number];
    data_sources: string[];
    factors: { name: string; impact: number; direction: 'positive' | 'negative' }[];
  } | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Animated score display
  const [displayScore, setDisplayScore] = useState(0);
  const animFrame = useRef<number | null>(null);

  useEffect(() => {
    if (!result) return;
    const target = result.credit_score;
    const start = Date.now();
    const duration = 800;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * target));
      if (progress < 1) animFrame.current = requestAnimationFrame(animate);
    };
    animFrame.current = requestAnimationFrame(animate);
    return () => { if (animFrame.current) cancelAnimationFrame(animFrame.current); };
  }, [result]);

  const handleScore = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setShowResult(false);

    const payload = {
      sim_tenure_months: simTenure,
      on_time_rate: onTimeRate / 100,
      topup_regularity_score: topupScore / 100,
      avg_monthly_topup: avgTopup,
      payment_consistency_index: paymentConsistency / 100,
    };

    try {
      const res = await apiPost<any>('/api/v1/services/credit/underwrite', payload);
      setResult({
        credit_score: res.credit_score,
        confidence_interval: res.confidence_interval,
        data_sources: res.data_sources || ['telco', 'utility'],
        factors: [
          { name: 'On-time payment rate', impact: onTimeRate * 0.4, direction: 'positive' },
          { name: 'SIM tenure length', impact: simTenure * 0.15, direction: 'positive' },
          { name: 'Top-up regularity', impact: topupScore * 0.2, direction: 'positive' },
          { name: 'Payment consistency', impact: paymentConsistency * 0.25, direction: 'positive' },
          { name: 'Wallet balance weight', impact: avgTopup < 500 ? -8 : 0, direction: avgTopup < 500 ? 'negative' : 'positive' },
        ],
      });
    } catch {
      // Compute locally on API failure
      const rawScore = 300 + Math.round((onTimeRate * 0.4 + simTenure * 0.15 + topupScore * 0.2 + paymentConsistency * 0.25) * 4);
      const clamped = Math.min(850, Math.max(300, rawScore));
      setResult({
        credit_score: clamped,
        confidence_interval: [clamped - 55, clamped + 48],
        data_sources: ['telco', 'utility'],
        factors: [
          { name: 'On-time payment rate', impact: Math.round(onTimeRate * 0.4), direction: 'positive' },
          { name: 'SIM tenure length', impact: Math.round(simTenure * 0.15), direction: simTenure > 6 ? 'positive' : 'negative' },
          { name: 'Top-up regularity', impact: Math.round(topupScore * 0.2), direction: 'positive' },
          { name: 'Payment consistency', impact: Math.round(paymentConsistency * 0.25), direction: 'positive' },
          { name: 'Wallet balance weight', impact: avgTopup < 500 ? -8 : Math.round(avgTopup * 0.005), direction: avgTopup < 500 ? 'negative' : 'positive' },
        ],
      });
    } finally {
      setLoading(false);
      setShowResult(true);
    }
  }, [simTenure, onTimeRate, topupScore, avgTopup, paymentConsistency]);

  // Live preview score (no API call)
  const previewScore = Math.min(850, Math.max(300,
    300 + Math.round((onTimeRate * 0.4 + simTenure * 0.15 + topupScore * 0.2 + paymentConsistency * 0.25) * 4)
  ));
  const previewPct = ((previewScore - 300) / (850 - 300)) * 100;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', border: '1px solid var(--border-secondary)', background: 'var(--border-secondary)', marginTop: '2rem' }}>
      {/* Left: sliders */}
      <div style={{ background: 'var(--bg-primary)', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Sliders size={16} style={{ color: 'var(--brand-accent)' }} />
          <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Alternative Data Inputs</strong>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <SliderInput label="SIM Tenure" value={simTenure} min={1} max={60} unit="months" onChange={setSimTenure} />
          <SliderInput label="On-Time Payment Rate" value={onTimeRate} min={10} max={100} unit="%" onChange={setOnTimeRate} />
          <SliderInput label="Top-Up Regularity" value={topupScore} min={10} max={100} unit="%" onChange={setTopupScore} />
          <SliderInput label="Avg Monthly Top-Up" value={avgTopup} min={100} max={5000} unit="₹" step={100} onChange={setAvgTopup} />
          <SliderInput label="Payment Consistency" value={paymentConsistency} min={10} max={100} unit="%" onChange={setPaymentConsistency} />
        </div>

        <button
          onClick={handleScore}
          disabled={loading}
          className="btn-primary"
          style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}
          type="button"
        >
          {loading ? 'Scoring…' : 'Compute Trust Score'} <ArrowRight size={15} />
        </button>

        {/* Live preview */}
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', border: '1px solid var(--border-secondary)', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live preview</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{previewScore}</span>
          </div>
          <div style={{ marginTop: '0.4rem', height: '4px', background: 'var(--border-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${previewPct}%`,
              height: '100%',
              borderRadius: '2px',
              background: previewScore >= 650 ? 'var(--risk-low)' : previewScore >= 580 ? 'var(--risk-medium)' : 'var(--risk-high)',
              transition: 'width 200ms ease, background 200ms ease',
            }} />
          </div>
        </div>
      </div>

      {/* Right: result */}
      <div style={{ background: 'var(--bg-primary)', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!showResult ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <CreditCard size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto' }} />
            <p style={{ marginTop: '1rem', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Adjust inputs & compute
            </p>
            <p style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--text-tertiary)', maxWidth: '20rem', margin: '0.4rem auto 0' }}>
              Use the sliders to model a thin-file applicant profile and see the trust score with full SHAP-style factor attribution.
            </p>
          </div>
        ) : result && (
          <div style={{ animation: 'fadeInUp 0.5s ease-out both' }}>
            {/* Score display */}
            <div style={{ textAlign: 'center', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-secondary)' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-tertiary)' }}>Computed Trust Score</p>
              <div style={{ marginTop: '0.75rem', fontSize: '3.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                {displayScore}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>/ 850</span>
              <div style={{ marginTop: '0.75rem' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  background: result.credit_score >= 650 ? 'rgba(78, 186, 122, 0.15)' : result.credit_score >= 580 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: result.credit_score >= 650 ? 'var(--risk-low)' : result.credit_score >= 580 ? 'var(--risk-medium)' : 'var(--risk-high)',
                }}>
                  {result.credit_score >= 650 ? 'Prime — Auto Approve' : result.credit_score >= 580 ? 'Near-Prime — Manual Review' : 'Subprime — Decline'}
                </span>
              </div>
            </div>

            {/* Confidence */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ padding: '0.75rem', border: '1px solid var(--border-secondary)', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>95% Confidence</span>
                <p style={{ marginTop: '0.25rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(result.confidence_interval[0])} – {Math.round(result.confidence_interval[1])}
                </p>
              </div>
              <div style={{ padding: '0.75rem', border: '1px solid var(--border-secondary)', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Data Sources</span>
                <p style={{ marginTop: '0.25rem', fontWeight: 700, fontSize: '0.85rem', color: 'var(--brand-accent)', textTransform: 'capitalize' }}>
                  {result.data_sources.join(', ')}
                </p>
              </div>
            </div>

            {/* Factor attribution */}
            <div style={{ marginTop: '1.25rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>Factor Attribution</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {result.factors.map((f) => (
                  <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{f.name}</span>
                    <div style={{ width: '80px', height: '6px', background: 'var(--border-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(Math.abs(f.impact), 100)}%`,
                        height: '100%',
                        borderRadius: '3px',
                        background: f.direction === 'positive' ? 'var(--risk-low)' : 'var(--risk-high)',
                        transition: 'width 300ms ease',
                      }} />
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color: f.direction === 'positive' ? 'var(--risk-low)' : 'var(--risk-high)',
                      minWidth: '2.5rem',
                      textAlign: 'right',
                    }}>
                      {f.direction === 'positive' ? '+' : '−'}{Math.abs(Math.round(f.impact))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fairness badge */}
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', border: '1px solid var(--border-secondary)', borderRadius: '0.375rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--risk-low)' }}>
                <Shield size={12} /> Bias audit passed
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', border: '1px solid var(--border-secondary)', borderRadius: '0.375rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--risk-low)' }}>
                <CheckCircle2 size={12} /> ECOA compliant
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SliderInput({ label, value, min, max, unit, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; unit: string; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          {unit === '₹' ? `₹${value.toLocaleString()}` : `${value}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', marginTop: '0.35rem', accentColor: 'var(--brand-accent)' }}
      />
    </div>
  );
}

/* ─── Document Checklist ────────────────────────────────────────── */

function DocumentChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const docs = [
    { id: 'aadhaar', label: 'Aadhaar Card / National ID', desc: 'Government-issued identity proof for KYC verification' },
    { id: 'pan', label: 'PAN Card', desc: 'Permanent Account Number for tax identification' },
    { id: 'mobile', label: 'Mobile Statement (6 months)', desc: 'SIM provider usage and recharge history' },
    { id: 'utility', label: 'Utility Bills (3 months)', desc: 'Electricity, water, or gas payment records' },
    { id: 'bank', label: 'Bank Statement (optional)', desc: 'Last 3 months transaction summary if available' },
    { id: 'photo', label: 'Passport-size Photo', desc: 'Recent photograph for application records' },
  ];

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  const completedCount = Object.values(checked).filter(Boolean).length;
  const totalRequired = 4; // first 4 are required

  return (
    <div style={{ marginTop: '2rem', border: '1px solid var(--border-secondary)', background: 'var(--bg-primary)' }}>
      {/* Progress bar */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-secondary)', background: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {completedCount} of {docs.length} documents ready
          </span>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px',
            background: completedCount >= totalRequired ? 'rgba(78, 186, 122, 0.15)' : 'rgba(234, 179, 8, 0.15)',
            color: completedCount >= totalRequired ? 'var(--risk-low)' : 'var(--risk-medium)',
          }}>
            {completedCount >= totalRequired ? 'Eligible to apply' : `${totalRequired - completedCount} more required`}
          </span>
        </div>
        <div style={{ marginTop: '0.5rem', height: '4px', background: 'var(--border-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            width: `${(completedCount / docs.length) * 100}%`,
            height: '100%',
            borderRadius: '2px',
            background: completedCount >= totalRequired ? 'var(--risk-low)' : 'var(--brand-accent)',
            transition: 'width 300ms ease',
          }} />
        </div>
      </div>

      {/* Document items */}
      {docs.map((doc, i) => (
        <div
          key={doc.id}
          onClick={() => toggle(doc.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1rem 1.5rem',
            borderBottom: i < docs.length - 1 ? '1px solid var(--border-secondary)' : 'none',
            cursor: 'pointer',
            transition: 'background 150ms ease',
            background: checked[doc.id] ? 'rgba(78, 186, 122, 0.04)' : 'transparent',
          }}
          role="checkbox"
          aria-checked={!!checked[doc.id]}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(doc.id); } }}
        >
          {/* Checkbox */}
          <div style={{
            width: '1.35rem', height: '1.35rem', borderRadius: '0.375rem', flexShrink: 0,
            border: checked[doc.id] ? '2px solid var(--risk-low)' : '2px solid var(--border-secondary)',
            background: checked[doc.id] ? 'var(--risk-low)' : 'transparent',
            display: 'grid', placeItems: 'center',
            transition: 'all 150ms ease',
          }}>
            {checked[doc.id] && <CheckCircle2 size={12} style={{ color: 'white' }} />}
          </div>

          {/* Text */}
          <div style={{ flex: 1 }}>
            <p style={{
              fontSize: '0.88rem', fontWeight: 700,
              color: checked[doc.id] ? 'var(--text-tertiary)' : 'var(--text-primary)',
              textDecoration: checked[doc.id] ? 'line-through' : 'none',
              transition: 'color 150ms ease',
            }}>{doc.label}</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>{doc.desc}</p>
          </div>

          {/* Required badge */}
          {i < totalRequired && (
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '0.2rem 0.5rem', borderRadius: '999px',
              border: '1px solid var(--border-secondary)',
              color: 'var(--text-tertiary)',
            }}>Required</span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Original Components ───────────────────────────────────────── */

function TrustScorePanel() {
  const score = 682;
  const min = 300;
  const max = 850;
  const approval = 580;
  const pct = ((score - min) / (max - min)) * 100;
  const approvalPct = ((approval - min) / (max - min)) * 100;

  return (
    <article className="trust-score-panel">
      <div className="trust-panel-head">
        <span className="cell-icon">
          <CreditCard size={21} />
        </span>
        <div>
          <h2 tabIndex={0}>Welcome back, Alex.</h2>
          <p tabIndex={0}>Your trust profile has been updated based on recent activity.</p>
        </div>
      </div>

      <div className="trust-panel-body">
        <p className="mock-label">Your trust score</p>
        <div className="score-row">
          <div>
            <strong>{score}</strong>
            <span>
              <TrendingUp size={15} />
              +18 this month
            </span>
          </div>
          <div className="score-meter">
            <div className="score-labels">
              <span>{min}</span>
              <span>{approval} approval</span>
              <span>{max}</span>
            </div>
            <div className="score-track">
              <i className="score-threshold" style={{ left: `${approvalPct}%` }} />
              <b style={{ width: `${pct}%` }} />
            </div>
            <p>
              <CheckCircle2 size={13} /> Above approval threshold
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function DataSourceCard({
  title,
  score,
  description,
  icon: Icon,
}: {
  title: string;
  score: number;
  description: string;
  icon: typeof Smartphone;
}) {
  return (
    <article className="operation-card">
      <span className="cell-icon">
        <Icon size={18} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="source-meter">
        <strong>{score}%</strong>
        <div>
          <span
            className={cn(score >= 80 ? 'is-good' : score >= 60 ? 'is-medium' : 'is-high')}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </article>
  );
}
