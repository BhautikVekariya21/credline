import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Info,
  Landmark,
  Smartphone,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { cn } from '../lib/utils';

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

      <section className="public-section public-band">
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
