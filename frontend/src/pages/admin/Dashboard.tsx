import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, TrendingUp, Users, AlertTriangle, Activity, Globe, CreditCard,
  Clock, Zap, CheckCircle,
  ChevronRight, Eye, BarChart3, RefreshCw, Cpu, Lock, Network,
  TrendingDown, Database, ClipboardList,
} from 'lucide-react';
import {
  useMockData,
  MOCK_SYSTEM_HEALTH,
  MOCK_FRAUD_ALERTS,
  MOCK_CREDIT_METRICS,
  MOCK_TRANSACTIONS,
  MOCK_CONSORTIUM,
  type SystemHealth,
  type FraudAlert,
  type CreditMetric,
  type TransactionEvent,
  type ConsortiumNode,
} from '../../hooks/useMockData';
import { cn } from '../../lib/utils';

/* ─── Animated Counter ──────────────────────────────────────────── */

function AnimatedCount({ value, suffix = '', prefix = '', decimals = 0 }: {
  value: number; suffix?: string; prefix?: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);
  useEffect(() => {
    const start = Date.now();
    const duration = 900;
    const from = 0;
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [value]);
  return (
    <span>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}

/* ─── Mini Sparkline SVG ────────────────────────────────────────── */

function Sparkline({ data, color = '#4eba7a', width = 80, height = 32 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const areaBottom = `${width},${height} 0,${height}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${pts} ${areaBottom}`}
        fill={`url(#sg-${color.replace('#', '')})`}
      />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Live clock ────────────────────────────────────────────────── */

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs text-[var(--text-tertiary)]">
      {time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST
    </span>
  );
}

/* ─── Risk Level Gauge ──────────────────────────────────────────── */

function RiskGauge({ score }: { score: number }) {
  const angle = -135 + (score / 100) * 270;
  const color = score >= 80 ? 'var(--risk-high)' : score >= 50 ? 'var(--risk-medium)' : 'var(--risk-low)';
  return (
    <div className="relative w-20 h-12 overflow-hidden">
      <svg viewBox="0 0 80 48" className="w-full h-full">
        <path d="M 10 44 A 30 30 0 0 1 70 44" fill="none" stroke="var(--bg-tertiary)" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M 10 44 A 30 30 0 0 1 70 44"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 94.2} 94.2`}
        />
        <line
          x1="40" y1="44"
          x2={40 + 22 * Math.cos((angle - 90) * Math.PI / 180)}
          y2={44 + 22 * Math.sin((angle - 90) * Math.PI / 180)}
          stroke={color} strokeWidth="1.5" strokeLinecap="round"
        />
        <circle cx="40" cy="44" r="2.5" fill={color} />
      </svg>
      <div className="absolute bottom-0 w-full text-center">
        <span className="text-[9px] font-bold font-mono" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

/* ─── KPI Cards ─────────────────────────────────────────────────── */

const SPARKLINES = {
  latency: [28, 19, 14, 22, 18, 12, 15, 13, 11, 16, 12, 10],
  uptime:  [100, 100, 99.9, 100, 100, 100, 100, 99.8, 100, 100, 100, 100],
  models:  [4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  fraud:   [14, 17, 12, 20, 18, 9, 11, 16, 13, 8, 12, 9],
};

function HealthCards() {
  const { data, isMocked } = useMockData<SystemHealth>(
    '/health/status', MOCK_SYSTEM_HEALTH, { pollInterval: 30_000 }
  );

  if (!data) return <CardSkeleton count={4} />;

  const cards = [
    {
      label: 'System Status',
      value: data.status === 'operational' ? 'Operational' : data.status,
      sub: `Circuit breaker ${data.circuit_breaker}`,
      icon: Shield,
      tone: 'green' as const,
      sparkData: SPARKLINES.uptime,
      sparkColor: '#4eba7a',
      trend: 'up',
      numeric: null,
    },
    {
      label: 'API Latency',
      value: `${data.api_latency_ms}ms`,
      sub: 'P99 scoring pipeline',
      icon: Zap,
      tone: 'amber' as const,
      sparkData: SPARKLINES.latency,
      sparkColor: '#d4a84b',
      trend: data.api_latency_ms < 50 ? 'down' : 'up',
      numeric: data.api_latency_ms,
    },
    {
      label: 'System Uptime',
      value: `${(data.uptime_hours / 24).toFixed(0)}d ${(data.uptime_hours % 24).toFixed(0)}h`,
      sub: `${data.uptime_hours.toLocaleString()} total hours`,
      icon: Clock,
      tone: 'blue' as const,
      sparkData: SPARKLINES.uptime,
      sparkColor: '#60a5fa',
      trend: 'up',
      numeric: null,
    },
    {
      label: 'Active Models',
      value: `${data.active_models} / 5`,
      sub: data.model_status.replace(/_/g, ' '),
      icon: Cpu,
      tone: 'purple' as const,
      sparkData: SPARKLINES.models,
      sparkColor: '#a78bfa',
      trend: 'stable',
      numeric: null,
    },
  ];

  const toneMap: Record<string, string> = {
    green:  'text-[var(--risk-low)] bg-[var(--risk-low)]/10',
    amber:  'text-[var(--risk-medium)] bg-[var(--risk-medium)]/10',
    blue:   'text-blue-400 bg-blue-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    red:    'text-[var(--risk-high)] bg-[var(--risk-high)]/10',
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="card p-5 group cursor-default relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-5 blur-2xl"
            style={{ background: card.sparkColor }} />

          <div className="flex items-start justify-between mb-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', toneMap[card.tone])}>
              <card.icon size={18} />
            </div>
            <Sparkline data={card.sparkData} color={card.sparkColor} />
          </div>

          <p className="stat-value text-[var(--text-primary)] text-2xl font-extrabold leading-tight">
            {card.value}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] font-semibold mt-0.5">{card.sub}</p>
          <p className="stat-label mt-1 text-[var(--text-secondary)]">{card.label}</p>

          {isMocked && (
            <span className="absolute top-3 right-3 text-[9px] font-bold text-accent-orange border border-accent-orange/30 bg-accent-orange/10 px-1.5 py-0.5 rounded">
              DEMO
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Fraud Alert Panel ─────────────────────────────────────────── */

function FraudAlertPanel() {
  const { data: alerts, isMocked, refetch } = useMockData<FraudAlert[]>(
    '/soar/investigations', MOCK_FRAUD_ALERTS, { pollInterval: 10_000 }
  );
  const [filter, setFilter] = useState<string>('all');

  if (!alerts) return <CardSkeleton count={1} height="h-80" />;

  const filters = ['all', 'pending', 'investigating', 'escalated', 'resolved'];
  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.status === filter);

  const statusColor: Record<string, string> = {
    pending:       'text-[var(--risk-medium)] bg-[var(--risk-medium)]/10 border-[var(--risk-medium)]/20',
    investigating: 'text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 border-[var(--brand-accent)]/20',
    escalated:     'text-[var(--risk-high)] bg-[var(--risk-high)]/10 border-[var(--risk-high)]/20',
    resolved:      'text-[var(--risk-low)] bg-[var(--risk-low)]/10 border-[var(--risk-low)]/20',
  };

  const pending = alerts.filter(a => a.status === 'pending').length;
  const critical = alerts.filter(a => a.risk_score >= 90).length;

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--risk-high)]/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-[var(--risk-high)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
              Active Fraud Alerts
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-[var(--risk-medium)] font-bold border border-[var(--risk-medium)]/30 bg-[var(--risk-medium)]/10 px-1.5 py-0.5 rounded">
                {pending} PENDING
              </span>
              {critical > 0 && (
                <span className="text-[10px] text-[var(--risk-high)] font-bold border border-[var(--risk-high)]/30 bg-[var(--risk-high)]/10 px-1.5 py-0.5 rounded animate-pulse">
                  {critical} CRITICAL
                </span>
              )}
              {isMocked && <span className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase">Demo</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            title="Refresh alerts"
          >
            <RefreshCw size={14} />
          </button>
          <button className="btn-secondary text-xs">
            View All <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all',
              filter === f
                ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-[var(--text-tertiary)] text-xs font-semibold">
            No alerts match this filter
          </div>
        ) : filtered.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer group border border-transparent hover:border-[var(--border-secondary)]"
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Risk Gauge */}
              <RiskGauge score={alert.risk_score} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {alert.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)] font-mono">
                  {alert.user_id} · ${alert.amount.toLocaleString()} {alert.currency}
                </p>
                <p className="text-[9px] text-[var(--text-tertiary)] mt-0.5 uppercase tracking-wider font-semibold">
                  {alert.region} · {new Date(alert.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={cn('badge text-[10px]', statusColor[alert.status] || '')}>
                {alert.status}
              </span>
              <Eye size={14} className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Credit Inclusion Metrics ──────────────────────────────────── */

function CreditMetricsPanel() {
  const { data: metrics, isMocked } = useMockData<CreditMetric>(
    '/credit-engine/metrics', MOCK_CREDIT_METRICS
  );

  if (!metrics) return <CardSkeleton count={1} height="h-80" />;

  const stats = [
    { label: 'Total Scored', value: metrics.total_scored, format: (v: number) => v.toLocaleString(), icon: BarChart3, color: 'text-blue-400' },
    { label: 'Approval Rate', value: metrics.approved_rate * 100, format: (v: number) => `${v.toFixed(1)}%`, icon: CheckCircle, color: 'text-[var(--risk-low)]' },
    { label: 'Avg Credit Score', value: metrics.avg_score, format: (v: number) => v.toString(), icon: TrendingUp, color: 'text-[var(--brand-accent)]' },
    { label: 'Unbanked Served', value: metrics.unbanked_served, format: (v: number) => v.toLocaleString(), icon: Users, color: 'text-purple-400' },
    { label: 'Inclusion Index', value: metrics.inclusion_index * 100, format: (v: number) => `${v.toFixed(1)}%`, icon: Globe, color: 'text-[var(--risk-low)]' },
    { label: 'Adverse Notices', value: metrics.adverse_notices_sent, format: (v: number) => v.toLocaleString(), icon: AlertTriangle, color: 'text-[var(--risk-medium)]' },
  ];

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[var(--risk-low)]/10 flex items-center justify-center">
          <CreditCard size={18} className="text-[var(--risk-low)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">Credit Inclusion</h3>
          <p className="text-xs text-[var(--text-tertiary)]">Alternative underwriting performance</p>
        </div>
        {isMocked && <span className="ml-auto text-[9px] text-[var(--text-tertiary)] font-bold uppercase border border-[var(--border-secondary)] px-1.5 py-0.5 rounded">Demo</span>}
      </div>

      {/* Progress bar for inclusion index */}
      <div className="mb-5">
        <div className="flex justify-between text-[10px] font-bold text-[var(--text-tertiary)] uppercase mb-1">
          <span>Inclusion Index</span>
          <span className="text-[var(--risk-low)]">{(metrics.inclusion_index * 100).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--risk-low)] transition-all duration-1000"
            style={{ width: `${metrics.inclusion_index * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 space-y-3.5">
        {stats.map(({ label, value, format, icon: Icon, color }) => (
          <div key={label} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Icon size={14} className={color} />
              <span className="text-xs text-[var(--text-secondary)] font-medium">{label}</span>
            </div>
            <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
              {format(value)}
            </span>
          </div>
        ))}
      </div>

      {/* Spark chart for scored count */}
      <div className="mt-4 pt-4 border-t border-[var(--border-secondary)]/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">30-Day Scoring Volume</span>
          <Sparkline data={[12000, 14000, 13500, 16000, 15200, 18000, 17400, 19800, 21000, 22400, 23800, 25000]} color="#4eba7a" width={90} height={28} />
        </div>
      </div>
    </div>
  );
}

/* ─── Transaction Feed ──────────────────────────────────────────── */

function TransactionFeed() {
  const { data: txs, isMocked } = useMockData<TransactionEvent[]>(
    '/health/transactions', MOCK_TRANSACTIONS, { pollInterval: 5_000 }
  );

  const [liveCount, setLiveCount] = useState(0);
  const [highlightRow, setHighlightRow] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveCount(c => c + Math.floor(Math.random() * 8 + 3));
      const fraudIds = txs?.filter(t => t.is_fraud).map(t => t.id) ?? [];
      if (Math.random() > 0.7 && fraudIds.length) {
        const id2 = fraudIds[Math.floor(Math.random() * fraudIds.length)];
        setHighlightRow(id2);
        setTimeout(() => setHighlightRow(null), 1200);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [txs]);

  if (!txs) return <CardSkeleton count={1} height="h-80" />;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/10 flex items-center justify-center">
            <Activity size={18} className="text-[var(--brand-accent)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
              Transaction Stream
            </h3>
            <p className="text-xs text-[var(--text-tertiary)]">
              Live ingestion feed ·&nbsp;
              <span className="text-[var(--risk-low)] font-bold font-mono">
                +<AnimatedCount value={liveCount} /> events
              </span>
            </p>
          </div>
          {isMocked && <span className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase">Demo</span>}
        </div>
        <div className="badge badge-live">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--risk-low)] pulse-dot" />
          Live
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-secondary)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-secondary)] text-[var(--text-tertiary)] text-[10px] uppercase tracking-wider">
              <th className="text-left py-2.5 px-4 font-bold">User</th>
              <th className="text-left py-2.5 px-4 font-bold">Merchant</th>
              <th className="text-left py-2.5 px-4 font-bold">Category</th>
              <th className="text-right py-2.5 px-4 font-bold">Amount</th>
              <th className="text-center py-2.5 px-4 font-bold">Risk</th>
              <th className="text-right py-2.5 px-4 font-bold">Time</th>
            </tr>
          </thead>
          <tbody>
            {txs.slice(0, 9).map((tx) => (
              <tr
                key={tx.id}
                className={cn(
                  'border-t border-[var(--border-secondary)] transition-all duration-500',
                  tx.is_fraud && 'bg-[var(--risk-high)]/5',
                  highlightRow === tx.id && 'bg-[var(--risk-high)]/20',
                  !tx.is_fraud && highlightRow !== tx.id && 'hover:bg-[var(--bg-secondary)]'
                )}
              >
                <td className="py-2.5 px-4">
                  <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{tx.user_id}</span>
                </td>
                <td className="py-2.5 px-4 text-xs text-[var(--text-secondary)] font-medium">{tx.merchant}</td>
                <td className="py-2.5 px-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] border border-[var(--border-secondary)] px-2 py-0.5 rounded-md">
                    {tx.category}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right font-bold text-[var(--text-primary)] font-mono text-xs">
                  ${tx.amount.toFixed(2)}
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span className={cn(
                    'inline-block w-9 text-center text-[10px] font-bold rounded-md py-0.5',
                    tx.risk_score >= 80 ? 'text-[var(--risk-high)] bg-[var(--risk-high)]/10'
                      : tx.risk_score >= 50 ? 'text-[var(--risk-medium)] bg-[var(--risk-medium)]/10'
                      : 'text-[var(--risk-low)] bg-[var(--risk-low)]/10'
                  )}>
                    {tx.risk_score}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right text-[10px] text-[var(--text-tertiary)] font-mono">
                  {new Date(tx.timestamp).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Federation Status ─────────────────────────────────────────── */

function FederationPanel() {
  const { data: nodes, isMocked } = useMockData<ConsortiumNode[]>(
    '/regulator/consortium-status', MOCK_CONSORTIUM
  );

  if (!nodes) return <CardSkeleton count={1} height="h-56" />;

  const statusDef: Record<string, { color: string; label: string; pulse?: boolean }> = {
    online:   { color: 'bg-[var(--risk-low)]', label: 'Online' },
    training: { color: 'bg-[var(--risk-medium)]', label: 'Training', pulse: true },
    offline:  { color: 'bg-[var(--text-tertiary)]', label: 'Offline' },
  };

  const totalFraudRate = nodes.reduce((s, n) => s + n.fraud_rate, 0) / nodes.length;

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-purple-400/10 flex items-center justify-center">
          <Network size={18} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
            FL Consortium
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">Federated learning network</p>
        </div>
        {isMocked && <span className="ml-auto text-[9px] text-[var(--text-tertiary)] font-bold uppercase border border-[var(--border-secondary)] px-1.5 py-0.5 rounded">Demo</span>}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-[var(--bg-secondary)] p-2 text-center">
          <div className="text-sm font-bold text-[var(--risk-low)]">{nodes.filter(n => n.status === 'online').length}</div>
          <div className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase">Online</div>
        </div>
        <div className="rounded-lg bg-[var(--bg-secondary)] p-2 text-center">
          <div className="text-sm font-bold text-[var(--risk-medium)]">{nodes.filter(n => n.status === 'training').length}</div>
          <div className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase">Training</div>
        </div>
        <div className="rounded-lg bg-[var(--bg-secondary)] p-2 text-center">
          <div className="text-sm font-bold text-[var(--text-primary)]">{(totalFraudRate * 100).toFixed(2)}%</div>
          <div className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase">Avg Fraud</div>
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {nodes.map((node) => {
          const status = statusDef[node.status] || statusDef.offline;
          return (
            <div
              key={node.bank_id}
              className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)] hover:border-[var(--border-primary)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', status.color, status.pulse && 'animate-pulse')} />
                <div>
                  <p className="text-xs font-semibold text-[var(--text-primary)]">{node.name}</p>
                  <p className="text-[9px] text-[var(--text-tertiary)] font-mono uppercase">
                    fraud: {(node.fraud_rate * 100).toFixed(2)}% · synced {
                      Math.round((Date.now() - new Date(node.last_sync).getTime()) / 60000)
                    }m ago
                  </p>
                </div>
              </div>
              <span className={cn(
                'text-[9px] font-bold uppercase px-2 py-0.5 rounded border',
                node.status === 'online' ? 'text-[var(--risk-low)] border-[var(--risk-low)]/30 bg-[var(--risk-low)]/10'
                  : node.status === 'training' ? 'text-[var(--risk-medium)] border-[var(--risk-medium)]/30 bg-[var(--risk-medium)]/10'
                  : 'text-[var(--text-tertiary)] border-[var(--border-secondary)]'
              )}>
                {status.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Model Health Panel ────────────────────────────────────────── */

function ModelHealthPanel() {
  const models = [
    { name: 'FraudGraphSAGE', type: 'GNN', status: 'Champion', accuracy: 97.8, latency: 9, load: 82 },
    { name: 'TFT Transformer', type: 'Temporal', status: 'Champion', accuracy: 95.2, latency: 14, load: 64 },
    { name: 'XGBoost Credit', type: 'Ensemble', status: 'Shadow', accuracy: 93.1, latency: 4, load: 31 },
    { name: 'LSTM Biometric', type: 'Anomaly', status: 'Champion', accuracy: 98.4, latency: 6, load: 55 },
    { name: 'Dilithium PQC', type: 'Crypto', status: 'Active', accuracy: 100, latency: 2, load: 18 },
  ];

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-blue-400/10 flex items-center justify-center">
          <Database size={18} className="text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
            Model Health Matrix
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">Real-time ML pipeline performance</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--risk-low)] animate-pulse" />
          <span className="text-[10px] font-bold text-[var(--risk-low)] uppercase">All Healthy</span>
        </div>
      </div>

      <div className="space-y-3">
        {models.map(m => (
          <div key={m.name} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-[var(--text-primary)] truncate">{m.name}</span>
                <span className="text-[9px] font-bold uppercase border border-[var(--border-secondary)] px-1.5 py-0.5 rounded text-[var(--text-tertiary)]">
                  {m.type}
                </span>
                <span className={cn(
                  'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ml-auto flex-shrink-0',
                  m.status === 'Champion' ? 'text-[var(--risk-low)] border-[var(--risk-low)]/30 bg-[var(--risk-low)]/10'
                    : m.status === 'Shadow' ? 'text-[var(--risk-medium)] border-[var(--risk-medium)]/30 bg-[var(--risk-medium)]/10'
                    : 'text-blue-400 border-blue-400/30 bg-blue-400/10'
                )}>
                  {m.status}
                </span>
              </div>
              <div className="h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${m.load}%`,
                    background: m.load > 80 ? 'var(--risk-high)' : m.load > 60 ? 'var(--risk-medium)' : 'var(--risk-low)'
                  }}
                />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-bold text-[var(--text-primary)] font-mono">{m.accuracy}%</div>
              <div className="text-[9px] text-[var(--text-tertiary)] font-mono">{m.latency}ms</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Global Risk Summary ───────────────────────────────────────── */

function GlobalRiskSummary() {
  const regions = [
    { name: 'India (ap-south-1)', risk: 68, alerts: 3, volume: '₹2.4M', trend: 'up' },
    { name: 'EU (eu-west-1)', risk: 45, alerts: 1, volume: '€840K', trend: 'down' },
    { name: 'US (us-east-1)', risk: 52, alerts: 2, volume: '$1.2M', trend: 'stable' },
    { name: 'APAC (ap-se-1)', risk: 31, alerts: 0, volume: 'S$420K', trend: 'down' },
  ];

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[var(--risk-medium)]/10 flex items-center justify-center">
          <Globe size={18} className="text-[var(--risk-medium)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
            Global Risk Heat
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">Regional fraud exposure index</p>
        </div>
        <LiveClock />
      </div>

      <div className="space-y-3">
        {regions.map(r => (
          <div key={r.name} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{r.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.trend === 'up' ? (
                    <TrendingUp size={12} className="text-[var(--risk-high)]" />
                  ) : r.trend === 'down' ? (
                    <TrendingDown size={12} className="text-[var(--risk-low)]" />
                  ) : null}
                  <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">{r.volume}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${r.risk}%`,
                      background: r.risk >= 65 ? 'var(--risk-high)' : r.risk >= 45 ? 'var(--risk-medium)' : 'var(--risk-low)'
                    }}
                  />
                </div>
                <span className={cn(
                  'text-[10px] font-bold font-mono flex-shrink-0',
                  r.risk >= 65 ? 'text-[var(--risk-high)]' : r.risk >= 45 ? 'text-[var(--risk-medium)]' : 'text-[var(--risk-low)]'
                )}>{r.risk}</span>
                {r.alerts > 0 && (
                  <span className="text-[9px] font-bold text-[var(--risk-high)] bg-[var(--risk-high)]/10 border border-[var(--risk-high)]/30 px-1 rounded">
                    {r.alerts}⚠
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Security Posture ──────────────────────────────────────────── */

function SecurityPosture() {
  const checks = [
    { label: 'ML-KEM-768 Hybrid TLS', status: 'active', detail: 'Post-quantum key exchange' },
    { label: 'ML-DSA-65 Signatures', status: 'active', detail: 'Dilithium3 SAR signing' },
    { label: 'Zero-Knowledge Proofs', status: 'active', detail: 'Pedersen commitment KYC' },
    { label: 'Federated FL Privacy', status: 'active', detail: 'Differential privacy ε=1.2' },
    { label: 'Circuit Breaker', status: 'closed', detail: 'Auto-failover to XGBoost' },
    { label: 'SOAR Automation', status: 'running', detail: '8 active investigations' },
  ];

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[var(--risk-low)]/10 flex items-center justify-center">
          <Lock size={18} className="text-[var(--risk-low)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
            Security Posture
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">Cryptographic and privacy controls</p>
        </div>
        <div className="ml-auto text-[9px] font-bold text-[var(--risk-low)] border border-[var(--risk-low)]/30 bg-[var(--risk-low)]/10 px-2 py-0.5 rounded uppercase">
          Hardened
        </div>
      </div>

      <div className="space-y-2.5">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-[var(--risk-low)] animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{c.label}</p>
              <p className="text-[9px] text-[var(--text-tertiary)]">{c.detail}</p>
            </div>
            <span className="text-[9px] font-bold uppercase text-[var(--risk-low)] flex-shrink-0">✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── System Health Heartbeat Monitor ───────────────────────────── */

interface HeartbeatSegment {
  label: string;
  key: string;
  icon: typeof Activity;
  value: number;
  unit: string;
  threshold: { green: number; amber: number };
}

function SystemHealthHeartbeat() {
  const [tick, setTick] = useState(0);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  // Simulate real-time heartbeat data
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const segments: HeartbeatSegment[] = [
    {
      label: 'API Latency',
      key: 'api',
      icon: Zap,
      value: 12 + Math.round(Math.sin(tick * 0.3) * 5 + Math.random() * 3),
      unit: 'ms',
      threshold: { green: 30, amber: 80 },
    },
    {
      label: 'Model Inference',
      key: 'model',
      icon: Cpu,
      value: 8 + Math.round(Math.cos(tick * 0.2) * 3 + Math.random() * 2),
      unit: 'ms',
      threshold: { green: 20, amber: 50 },
    },
    {
      label: 'DB Response',
      key: 'db',
      icon: Database,
      value: 4 + Math.round(Math.sin(tick * 0.5) * 2 + Math.random() * 1.5),
      unit: 'ms',
      threshold: { green: 15, amber: 40 },
    },
    {
      label: 'Feature Store',
      key: 'feature',
      icon: BarChart3,
      value: 18 + Math.round(Math.cos(tick * 0.4) * 6 + Math.random() * 4),
      unit: 'ms',
      threshold: { green: 35, amber: 70 },
    },
  ];

  const getStatusColor = (value: number, threshold: { green: number; amber: number }): string => {
    if (value <= threshold.green) return 'var(--risk-low)';
    if (value <= threshold.amber) return 'var(--risk-medium)';
    return 'var(--risk-high)';
  };

  const getStatusLabel = (value: number, threshold: { green: number; amber: number }): string => {
    if (value <= threshold.green) return 'Healthy';
    if (value <= threshold.amber) return 'Degraded';
    return 'Critical';
  };

  return (
    <div className="card p-6 animate-fade-in" role="region" aria-label="System Health Heartbeat Monitor">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[var(--risk-low)]/10 flex items-center justify-center relative">
          <Activity size={18} className="text-[var(--risk-low)]" />
          {/* Pulsing heartbeat ring */}
          <div
            className="absolute inset-0 rounded-xl border-2 border-[var(--risk-low)] animate-ping opacity-30"
            style={{ animationDuration: '1.5s' }}
          />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
            System Heartbeat
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            Real-time infrastructure pulse · <span className="font-mono text-[var(--risk-low)] font-bold">ALL NOMINAL</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full bg-[var(--risk-low)]"
            style={{ animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
          />
          <span className="text-[10px] font-bold text-[var(--risk-low)] uppercase">Live</span>
        </div>
      </div>

      {/* Heartbeat ECG line */}
      <div className="mb-5 overflow-hidden rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)] p-3">
        <svg
          width="100%"
          height="40"
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
          role="img"
          aria-label="Heartbeat ECG animation"
        >
          <defs>
            <linearGradient id="ecg-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--risk-low)" stopOpacity="0" />
              <stop offset="30%" stopColor="var(--risk-low)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--risk-low)" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <polyline
            fill="none"
            stroke="url(#ecg-grad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points="0,20 40,20 60,20 70,8 80,32 90,4 100,36 110,20 130,20 160,20 180,20 190,8 200,32 210,4 220,36 230,20 250,20 280,20 300,20 310,8 320,32 330,4 340,36 350,20 370,20 400,20"
          >
            <animate
              attributeName="points"
              dur="2s"
              repeatCount="indefinite"
              values="0,20 40,20 60,20 70,8 80,32 90,4 100,36 110,20 130,20 160,20 180,20 190,8 200,32 210,4 220,36 230,20 250,20 280,20 300,20 310,8 320,32 330,4 340,36 350,20 370,20 400,20;0,20 40,20 60,20 70,12 80,28 90,6 100,34 110,20 130,20 160,20 180,20 190,12 200,28 210,6 220,34 230,20 250,20 280,20 300,20 310,12 320,28 330,6 340,34 350,20 370,20 400,20;0,20 40,20 60,20 70,8 80,32 90,4 100,36 110,20 130,20 160,20 180,20 190,8 200,32 210,4 220,36 230,20 250,20 280,20 300,20 310,8 320,32 330,4 340,36 350,20 370,20 400,20"
            />
          </polyline>
        </svg>
      </div>

      {/* Segment bars */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {segments.map((seg) => {
          const color = getStatusColor(seg.value, seg.threshold);
          const statusLabel = getStatusLabel(seg.value, seg.threshold);
          const SegIcon = seg.icon;
          return (
            <div
              key={seg.key}
              className="relative rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)] p-3 cursor-default transition-all hover:border-[var(--border-primary)] hover:shadow-sm"
              onMouseEnter={() => setHoveredSegment(seg.key)}
              onMouseLeave={() => setHoveredSegment(null)}
              role="status"
              aria-label={`${seg.label}: ${seg.value}${seg.unit} — ${statusLabel}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <SegIcon size={13} style={{ color }} />
                <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider truncate">
                  {seg.label}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-lg font-extrabold font-mono" style={{ color }}>
                  <AnimatedCount value={seg.value} />
                  <span className="text-[10px] font-bold ml-0.5">{seg.unit}</span>
                </span>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: color,
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                />
              </div>
              {/* Tooltip */}
              {hoveredSegment === seg.key && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 bg-[var(--bg-card)] border border-[var(--border-secondary)] shadow-lg rounded-lg px-3 py-1.5 whitespace-nowrap">
                  <span className="text-[10px] font-bold" style={{ color }}>{statusLabel}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] ml-1.5">
                    threshold: &lt;{seg.threshold.green}{seg.unit}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Risk Heatmap Grid ─────────────────────────────────────────── */

interface HeatmapCell {
  region: string;
  period: string;
  value: number;
  count: number;
  alerts: number;
}

function RiskHeatmapGrid() {
  const regions = ['ap-south-1', 'eu-west-1', 'us-east-1', 'ap-southeast-1'];
  const regionLabels: Record<string, string> = {
    'ap-south-1': 'India',
    'eu-west-1': 'EU',
    'us-east-1': 'US East',
    'ap-southeast-1': 'APAC',
  };
  const periods = ['1h', '6h', '12h', '24h', '7d', '30d'];

  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Generate deterministic-ish mock data
  const heatmapData: HeatmapCell[][] = regions.map((region, ri) =>
    periods.map((period, pi) => {
      const base = [72, 38, 55, 28][ri];
      const decay = [1, 0.85, 0.7, 0.55, 0.35, 0.2][pi];
      const value = Math.min(100, Math.max(5, Math.round(base * decay + (ri * pi * 3) % 15)));
      return {
        region,
        period,
        value,
        count: Math.round(value * 12 + (ri + pi) * 20),
        alerts: value > 60 ? Math.ceil((value - 60) / 12) : 0,
      };
    })
  );

  const getCellColor = (value: number): string => {
    if (value >= 75) return 'rgba(239, 68, 68, 0.85)';
    if (value >= 55) return 'rgba(239, 68, 68, 0.5)';
    if (value >= 40) return 'rgba(212, 168, 75, 0.6)';
    if (value >= 25) return 'rgba(212, 168, 75, 0.35)';
    if (value >= 15) return 'rgba(78, 186, 122, 0.4)';
    return 'rgba(78, 186, 122, 0.2)';
  };

  const handleCellHover = (cell: HeatmapCell, e: React.MouseEvent) => {
    setHoveredCell(cell);
    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 60,
      });
    }
  };

  return (
    <div className="card p-6 animate-fade-in" role="region" aria-label="Risk Density Heatmap">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[var(--risk-high)]/10 flex items-center justify-center">
          <Globe size={18} className="text-[var(--risk-high)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
            Risk Density Heatmap
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            Regional risk concentration over time
          </p>
        </div>
        {/* Legend */}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase mr-1">Low</span>
          <div className="w-12 h-2 rounded-full" style={{ background: 'linear-gradient(to right, rgba(78,186,122,0.3), rgba(212,168,75,0.5), rgba(239,68,68,0.8))' }} />
          <span className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase ml-1">High</span>
        </div>
      </div>

      <div className="relative" ref={gridRef}>
        {/* Column headers */}
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: '80px repeat(6, 1fr)' }}>
          <div /> {/* Empty corner cell */}
          {periods.map(p => (
            <div
              key={p}
              className="text-center text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider py-1"
            >
              {p}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {heatmapData.map((row, ri) => (
          <div
            key={regions[ri]}
            className="grid gap-1 mb-1"
            style={{ gridTemplateColumns: '80px repeat(6, 1fr)' }}
          >
            {/* Row label */}
            <div className="flex items-center text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider pr-2">
              <span className="truncate" title={regions[ri]}>
                {regionLabels[regions[ri]]}
              </span>
            </div>
            {/* Cells */}
            {row.map((cell) => (
              <button
                key={`${cell.region}-${cell.period}`}
                className="relative h-10 rounded-lg transition-all duration-200 hover:scale-105 hover:z-10 hover:shadow-lg cursor-pointer border border-transparent hover:border-[var(--text-primary)]/20 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-1"
                style={{ backgroundColor: getCellColor(cell.value) }}
                onMouseEnter={(e) => handleCellHover(cell, e)}
                onMouseLeave={() => setHoveredCell(null)}
                onClick={(e) => handleCellHover(cell, e)}
                aria-label={`${regionLabels[cell.region]} ${cell.period}: risk ${cell.value}, ${cell.count} events, ${cell.alerts} alerts`}
                tabIndex={0}
              >
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 font-mono">
                  {cell.value}
                </span>
              </button>
            ))}
          </div>
        ))}

        {/* Tooltip */}
        {hoveredCell && tooltipPos && (
          <div
            className="absolute z-30 bg-[var(--bg-card)] border border-[var(--border-secondary)] shadow-xl rounded-xl p-3 pointer-events-none min-w-[160px]"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase mb-1">
              {regionLabels[hoveredCell.region]} · {hoveredCell.period}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Risk Score</span>
                <span className={cn(
                  'font-bold font-mono',
                  hoveredCell.value >= 65 ? 'text-[var(--risk-high)]'
                    : hoveredCell.value >= 40 ? 'text-[var(--risk-medium)]'
                    : 'text-[var(--risk-low)]'
                )}>{hoveredCell.value}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Events</span>
                <span className="font-bold font-mono text-[var(--text-primary)]">{hoveredCell.count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Alerts</span>
                <span className={cn(
                  'font-bold font-mono',
                  hoveredCell.alerts > 0 ? 'text-[var(--risk-high)]' : 'text-[var(--risk-low)]'
                )}>{hoveredCell.alerts}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Model Performance Comparison Panel ────────────────────────── */

interface ModelMetrics {
  name: string;
  version: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  aucRoc: number;
}

function ModelPerformanceComparison() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [promoted, setPromoted] = useState(false);

  const champion: ModelMetrics = {
    name: 'FraudGraphSAGE',
    version: 'v2.3.8',
    accuracy: 97.8,
    precision: 96.4,
    recall: 94.2,
    f1: 95.3,
    aucRoc: 98.1,
  };

  const challenger: ModelMetrics = {
    name: 'FraudGraphSAGE',
    version: 'v2.4.1',
    accuracy: 98.2,
    precision: 97.1,
    recall: 95.8,
    f1: 96.4,
    aucRoc: 98.7,
  };

  const metrics: { key: keyof Omit<ModelMetrics, 'name' | 'version'>; label: string }[] = [
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'precision', label: 'Precision' },
    { key: 'recall', label: 'Recall' },
    { key: 'f1', label: 'F1 Score' },
    { key: 'aucRoc', label: 'AUC-ROC' },
  ];

  const handlePromote = useCallback(() => {
    setPromoted(true);
    setShowConfirm(false);
  }, []);

  return (
    <div className="card p-6 animate-fade-in" role="region" aria-label="Model Performance Comparison">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-purple-400/10 flex items-center justify-center">
          <BarChart3 size={18} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
            Champion vs Challenger
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            A/B performance comparison · {promoted ? 'Promotion applied' : 'Shadow testing active'}
          </p>
        </div>
        {promoted && (
          <span className="ml-auto text-[9px] font-bold text-[var(--risk-low)] border border-[var(--risk-low)]/30 bg-[var(--risk-low)]/10 px-2 py-0.5 rounded uppercase">
            ✓ Promoted
          </span>
        )}
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[140px_1fr_1fr] gap-3 mb-3">
        <div />
        <div className="text-center">
          <span className="text-[10px] font-bold text-[var(--risk-low)] bg-[var(--risk-low)]/10 border border-[var(--risk-low)]/30 px-2 py-0.5 rounded uppercase">
            Champion
          </span>
          <p className="text-[9px] text-[var(--text-tertiary)] font-mono mt-1">
            {champion.name} {champion.version}
          </p>
        </div>
        <div className="text-center">
          <span className="text-[10px] font-bold text-[var(--risk-medium)] bg-[var(--risk-medium)]/10 border border-[var(--risk-medium)]/30 px-2 py-0.5 rounded uppercase">
            Challenger
          </span>
          <p className="text-[9px] text-[var(--text-tertiary)] font-mono mt-1">
            {challenger.name} {challenger.version}
          </p>
        </div>
      </div>

      {/* Metric rows */}
      <div className="space-y-2.5">
        {metrics.map(({ key, label }) => {
          const chVal = champion[key];
          const clVal = challenger[key];
          const diff = clVal - chVal;
          const isWinning = diff > 0;
          return (
            <div
              key={key}
              className="grid grid-cols-[140px_1fr_1fr] gap-3 items-center p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)]"
            >
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {label}
              </span>
              {/* Champion bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--risk-low)] transition-all duration-700"
                    style={{ width: `${chVal}%` }}
                  />
                </div>
                <span className="text-xs font-bold font-mono text-[var(--text-primary)] w-12 text-right">
                  {chVal.toFixed(1)}%
                </span>
              </div>
              {/* Challenger bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${clVal}%`,
                      background: isWinning ? 'var(--risk-low)' : 'var(--risk-medium)',
                    }}
                  />
                </div>
                <span className="text-xs font-bold font-mono text-[var(--text-primary)] w-12 text-right">
                  {clVal.toFixed(1)}%
                </span>
                <span className={cn(
                  'text-[9px] font-bold font-mono w-10 text-right flex-shrink-0',
                  isWinning ? 'text-[var(--risk-low)]' : 'text-[var(--risk-high)]'
                )}>
                  {isWinning ? '+' : ''}{diff.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Promote button */}
      {!promoted && (
        <div className="mt-5 flex items-center justify-end gap-3">
          {showConfirm ? (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-[var(--risk-medium)]/50 bg-[var(--risk-medium)]/5">
              <AlertTriangle size={14} className="text-[var(--risk-medium)] flex-shrink-0" />
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                Promote <span className="font-bold">{challenger.version}</span> to Champion?
              </span>
              <button
                onClick={handlePromote}
                className="px-3 py-1 rounded-lg bg-[var(--risk-low)] text-white text-[10px] font-bold uppercase hover:opacity-90 transition-opacity"
                aria-label="Confirm promotion of challenger model"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-[10px] font-bold uppercase hover:bg-[var(--bg-secondary)] transition-colors"
                aria-label="Cancel promotion"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-400/10 border border-purple-400/30 text-purple-400 text-xs font-bold hover:bg-purple-400/20 transition-colors"
              aria-label="Promote challenger model to champion"
            >
              <TrendingUp size={14} />
              Promote Challenger
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Live Transaction Throughput Counter ───────────────────────── */

function LiveTransactionThroughput() {
  const [txPerSec, setTxPerSec] = useState(1500);
  const [history, setHistory] = useState<number[]>(() =>
    Array.from({ length: 20 }, () => 1200 + Math.round(Math.random() * 600))
  );
  const [totalProcessed, setTotalProcessed] = useState(4_283_761);

  useEffect(() => {
    const id = setInterval(() => {
      const next = 1200 + Math.round(Math.random() * 600);
      setTxPerSec(next);
      setHistory(prev => [...prev.slice(-19), next]);
      setTotalProcessed(prev => prev + Math.round(next / 2));
    }, 500);
    return () => clearInterval(id);
  }, []);

  const avgTps = Math.round(history.reduce((s, v) => s + v, 0) / history.length);
  const peakTps = Math.max(...history);
  const minTps = Math.min(...history);

  return (
    <div className="card p-6 animate-fade-in" role="region" aria-label="Live Transaction Throughput">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/10 flex items-center justify-center">
          <Zap size={18} className="text-[var(--brand-accent)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold font-display text-[var(--text-primary)]">
            Transaction Throughput
          </h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            Real-time processing rate · <span className="font-mono font-bold text-[var(--text-primary)]">{totalProcessed.toLocaleString()}</span> total
          </p>
        </div>
        <div className="ml-auto badge badge-live">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--risk-low)] pulse-dot" />
          Live
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Main counter */}
        <div className="col-span-12 lg:col-span-5 flex flex-col items-center justify-center p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
          <div className="text-4xl font-extrabold font-mono text-[var(--text-primary)] leading-none">
            <AnimatedCount value={txPerSec} />
          </div>
          <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mt-1.5">
            transactions / second
          </div>
          {/* Mini sparkline */}
          <div className="mt-3">
            <Sparkline data={history} color="var(--brand-accent)" width={120} height={28} />
          </div>
        </div>

        {/* Stats */}
        <div className="col-span-12 lg:col-span-7 grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
            <span className="text-lg font-extrabold font-mono text-[var(--risk-low)]">
              <AnimatedCount value={avgTps} />
            </span>
            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase mt-0.5">Avg TPS</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
            <span className="text-lg font-extrabold font-mono text-[var(--brand-accent)]">
              <AnimatedCount value={peakTps} />
            </span>
            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase mt-0.5">Peak</span>
          </div>
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
            <span className="text-lg font-extrabold font-mono text-[var(--risk-medium)]">
              <AnimatedCount value={minTps} />
            </span>
            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase mt-0.5">Min</span>
          </div>
          {/* Throughput bar */}
          <div className="col-span-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase">Capacity Utilization</span>
              <span className="text-[9px] font-bold font-mono text-[var(--text-primary)]">
                {Math.round((txPerSec / 2000) * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (txPerSec / 2000) * 100)}%`,
                  background: txPerSec > 1700
                    ? 'var(--risk-high)'
                    : txPerSec > 1400
                      ? 'var(--risk-medium)'
                      : 'var(--risk-low)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ────────────────────────────────────────────── */

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* ─── KPI Cards ─────────────────────────────────────────── */}
      <HealthCards />

      {/* ─── System Health Heartbeat + Live Throughput ──────────── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7">
          <SystemHealthHeartbeat />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <LiveTransactionThroughput />
        </div>
      </div>

      {/* ─── Main Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <FraudAlertPanel />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <CreditMetricsPanel />
        </div>
      </div>

      {/* ─── Risk Heatmap ──────────────────────────────────────── */}
      <RiskHeatmapGrid />

      {/* ─── Transaction Feed ──────────────────────────────────── */}
      <TransactionFeed />

      {/* ─── Model Performance Comparison ──────────────────────── */}
      <ModelPerformanceComparison />

      {/* ─── Bottom Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <GlobalRiskSummary />
        </div>
        <div className="col-span-12 lg:col-span-5">
          <ModelHealthPanel />
        </div>
        <div className="col-span-12 lg:col-span-3">
          <SecurityPosture />
        </div>
      </div>

      {/* ─── Federation ────────────────────────────────────────── */}
      <FederationPanel />

      {/* ─── Quick Actions + Activity Timeline ─────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <QuickActions />
        </div>
        <div className="col-span-12 lg:col-span-7">
          <ActivityTimeline />
        </div>
      </div>
    </div>
  );
}

/* ─── Quick Action Cards ────────────────────────────────────────── */

function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: 'Run Fraud Review', sub: 'Scan open alert queue', path: '/admin/fraud', icon: AlertTriangle, color: 'text-risk-high', bg: 'bg-risk-high/10' },
    { label: 'Score Applicant', sub: 'Credit sandbox scoring', path: '/admin/credit', icon: CreditCard, color: 'text-credit-line-500', bg: 'bg-credit-line-500/10' },
    { label: 'Detect Graph Cycles', sub: 'GNN topology scan', path: '/admin/graph', icon: Network, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
    { label: 'Generate SAR', sub: 'Compliance narrative', path: '/admin/regtech', icon: Lock, color: 'text-risk-medium', bg: 'bg-risk-medium/10' },
    { label: 'View Audit Trail', sub: 'System event log', path: '/admin/audit', icon: ClipboardList, color: 'text-risk-low', bg: 'bg-risk-low/10' },
    { label: 'Rotate Keys', sub: 'PQC key management', path: '/admin/quantum', icon: Zap, color: 'text-credit-line-500', bg: 'bg-credit-line-500/10' },
  ];

  return (
    <div className="card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <Zap size={16} className="text-credit-line-500" />
        Quick Actions
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(a.path)}
            className="flex items-start gap-3 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3 text-left transition-all hover:bg-[var(--bg-card)] hover:shadow-sm group"
          >
            <div className={cn('grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg', a.bg, a.color)}>
              <a.icon size={15} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-credit-line-500 transition-colors">{a.label}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{a.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Activity Timeline ─────────────────────────────────────────── */

const TIMELINE_EVENTS = [
  { time: '22:41', icon: AlertTriangle, color: 'text-risk-high', title: 'Fraud alert FA-005 escalated', detail: 'USR-IN-2c9b · ₹45,000 bust-out pattern · auto-blocked' },
  { time: '22:38', icon: Shield, color: 'text-risk-low', title: 'Model champion promoted', detail: 'v2.4.1 → production · accuracy 94.2% · A/B passed' },
  { time: '22:30', icon: CreditCard, color: 'text-credit-line-500', title: 'Batch scoring completed', detail: '2,847 thin-file applications · 73.4% approval rate' },
  { time: '22:24', icon: Database, color: 'text-accent-purple', title: 'Database sync checkpoint', detail: 'Credit Line_prod · 12,400 rows · latency 18ms' },
  { time: '22:18', icon: Network, color: 'text-risk-medium', title: 'Graph cycle detected', detail: 'Synthetic identity ring · 42 nodes · risk 0.94' },
  { time: '22:12', icon: Globe, color: 'text-risk-low', title: 'Federation round complete', detail: 'Global Commerce Bank · gradient merge · fraud rate 0.8%' },
  { time: '22:05', icon: Zap, color: 'text-credit-line-500', title: 'PQC key rotation', detail: 'ML-KEM-768 refresh · 4 sovereign regions · hybrid TLS' },
  { time: '21:58', icon: RefreshCw, color: 'text-accent-purple', title: 'Feature store materialized', detail: 'Feast online/offline sync · stream lag 42ms' },
  { time: '21:50', icon: CheckCircle, color: 'text-risk-low', title: 'SAR report transmitted', detail: 'Q2-2026-batch-014 · 14 cases · FIU gateway confirmed' },
  { time: '21:42', icon: Activity, color: 'text-risk-medium', title: 'Circuit breaker tested', detail: 'Failsafe rules engine verified · fallback latency 8ms' },
];

function ActivityTimeline() {
  return (
    <div className="card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
        <Clock size={16} className="text-credit-line-500" />
        Activity Timeline
      </h3>
      <div className="mt-4 max-h-[360px] overflow-y-auto space-y-0 pr-2">
        {TIMELINE_EVENTS.map((event, i) => (
          <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Vertical connector line */}
            {i < TIMELINE_EVENTS.length - 1 && (
              <div className="absolute left-[13px] top-7 bottom-0 w-px bg-[var(--border-secondary)]" />
            )}
            {/* Icon dot */}
            <div className={cn('relative z-10 mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)]', event.color)}>
              <event.icon size={13} />
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{event.title}</p>
                <span className="flex-shrink-0 text-[10px] font-mono text-[var(--text-tertiary)]">{event.time} IST</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{event.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Utility Components ────────────────────────────────────────── */

function CardSkeleton({ count = 1, height = 'h-32' }: { count?: number; height?: string }) {
  return (
    <div className={cn('grid gap-4', count > 1 ? `grid-cols-${Math.min(count, 4)}` : '')}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn('card animate-pulse bg-[var(--bg-secondary)]', height)}
        />
      ))}
    </div>
  );
}

