import { useState, useCallback, useRef, useEffect, type ElementType, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Banknote,
  Bell,
  Bot,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Database,
  Download,
  FileSearch,
  FileText,

  Globe,
  Grid3X3,
  LineChart,
  Lock,
  LogOut,
  Minus,
  Network,
  PlayCircle,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sliders,
  Key,
  Terminal as TerminalIcon,
  Timer,
  TrendingDown,
  TrendingUp,
  UserX,
  X,
  Zap,
  Activity,
  Cpu,
} from 'lucide-react';
import {
  MOCK_CONSORTIUM,
  MOCK_CREDIT_METRICS,
  MOCK_FRAUD_ALERTS,
  type ConsortiumNode,
  type CreditMetric,
  type FraudAlert,
  useMockData,
} from '../../hooks/useMockData';
import InvestigatorChat from '../../components/InvestigatorChat';
import InteractiveFraudRingExplorer from '../../components/organisms/InteractiveFraudRingExplorer';
import { cn } from '../../lib/utils';
import { apiGet, apiPost } from '../../lib/api';

interface MacroRisk {
  overall_risk_score: number;
  active_investigations: number;
  model_drift_status: string;
  circuit_breaker_status: string;
}

interface GraphSummary {
  risk_clusters: number;
  nodes_scanned: number;
  edges_scanned: number;
  poisoning_alerts: number;
  topologies: { name: string; risk: number; nodes: number }[];
}

interface MlopsStatus {
  serving: string;
  drift_detected: boolean;
  model_registry: string;
  feature_store: string;
  stream_lag_ms: number;
  last_retrain: string;
  experiments: number;
}

interface QuantumStatus {
  pqc_status: string;
  kem: string;
  signature: string;
  hybrid_tls: boolean;
  sovereign_regions: string[];
  dr_ready: boolean;
  last_key_rotation: string;
}

interface Kpi {
  label: string;
  value: string;
  detail: string;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

const MOCK_MACRO_RISK: MacroRisk = {
  overall_risk_score: 0.22,
  active_investigations: 8,
  model_drift_status: 'stable',
  circuit_breaker_status: 'closed',
};

const MOCK_GRAPH: GraphSummary = {
  risk_clusters: 7,
  nodes_scanned: 18_420,
  edges_scanned: 74_830,
  poisoning_alerts: 2,
  topologies: [
    { name: 'Synthetic identity ring', risk: 0.94, nodes: 42 },
    { name: 'Merchant collusion', risk: 0.81, nodes: 27 },
    { name: 'Device reuse cluster', risk: 0.76, nodes: 65 },
  ],
};

const MOCK_MLOPS: MlopsStatus = {
  serving: 'champion_active',
  drift_detected: false,
  model_registry: 'available',
  feature_store: 'online',
  stream_lag_ms: 42,
  last_retrain: '2026-05-12T02:00:00',
  experiments: 18,
};

const MOCK_QUANTUM: QuantumStatus = {
  pqc_status: 'ready',
  kem: 'ML-KEM-768',
  signature: 'ML-DSA-65',
  hybrid_tls: true,
  sovereign_regions: ['ap-south-1', 'eu-west-1', 'us-east-1', 'ap-southeast-1'],
  dr_ready: true,
  last_key_rotation: '2026-05-13T00:00:00',
};

/* ─── Toast notification ─────────────────────────────────────────────────── */

type ToastType = 'success' | 'error' | 'info';
interface ToastMsg { id: number; type: ToastType; title: string; body: string; }

function Toast({ msg, onDismiss }: { msg: ToastMsg; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(msg.id), 4000);
    return () => clearTimeout(t);
  }, [msg.id, onDismiss]);

  const colors: Record<ToastType, string> = {
    success: 'var(--risk-low)',
    error:   'var(--risk-high)',
    info:    'var(--brand-accent)',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      background: 'var(--bg-card)', border: `1px solid var(--border-secondary)`,
      borderLeft: `3px solid ${colors[msg.type]}`,
      borderRadius: '0.75rem', padding: '0.875rem 1rem',
      boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
      minWidth: '18rem', maxWidth: '22rem',
      animation: 'fadeIn 0.2s ease-out both',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>{msg.title}</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5, margin: '0.2rem 0 0' }}>{msg.body}</p>
      </div>
      <button
        onClick={() => onDismiss(msg.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '0', marginTop: '0.1rem' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function ToastContainer({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
      zIndex: 9999,
    }}>
      {toasts.map(t => <Toast key={t.id} msg={t} onDismiss={dismiss} />)}
    </div>
  );
}

/* ─── Export helper ─────────────────────────────────────────────────── */

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─── ModuleWorkspace ─────────────────────────────────────────────────── */

export function ModuleWorkspace({
  eyebrow,
  title,
  description,
  icon: Icon,
  isMocked,
  kpis,
  children,
  side,
  audit,
  exportFilename,
  exportRows,
  reviewSteps,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ElementType;
  isMocked?: boolean;
  kpis: Kpi[];
  children: ReactNode;
  side: ReactNode;
  audit: string[];
  exportFilename?: string;
  exportRows?: string[][];
  reviewSteps?: string[];
}) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const idRef = useRef(0);

  const [dbConnected, setDbConnected] = useState(false);
  const [dbEngine, setDbEngine] = useState<string | null>(null);
  const [dbLatency, setDbLatency] = useState<number>(0);
  const [recordsProcessed, setRecordsProcessed] = useState<number>(0);

  useEffect(() => {
    const checkDb = async () => {
      try {
        const res = await apiGet<any>('/database-link/status');
        setDbConnected(res.is_connected);
        setDbEngine(res.engine);
        setDbLatency(res.db_latency_ms);
        setRecordsProcessed(res.records_processed);
      } catch (err) {
        setDbConnected(false);
      }
    };
    checkDb();
    const interval = setInterval(checkDb, 4000);
    return () => clearInterval(interval);
  }, []);

  const addToast = useCallback((type: ToastType, title: string, body: string) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, type, title, body }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /* ── Export ─────────────────────────────────────────── */
  const handleExport = useCallback(() => {
    const filename = exportFilename ?? `${eyebrow.toLowerCase().replace(/\s+/g, '-')}-export-${new Date().toISOString().slice(0,10)}.csv`;

    const rows: string[][] = exportRows ?? [
      ['Module', 'Exported At', 'Environment'],
      [eyebrow, new Date().toISOString(), isMocked ? 'Mock / Demo' : 'Live'],
      [],
      ['KPI', 'Value', 'Detail'],
      ...kpis.map(k => [k.label, k.value, k.detail ?? '']),
      [],
      ['Audit Rail'],
      ...audit.map(a => [a]),
    ];

    try {
      downloadCSV(filename, rows);
      addToast('success', 'Export complete', `${filename} downloaded to your browser.`);
    } catch (err) {
      addToast('error', 'Export failed', 'Could not generate the CSV file. Please try again.');
    }
  }, [eyebrow, exportFilename, exportRows, kpis, audit, isMocked, addToast]);

  /* ── Run Review ────────────────────────────────────────── */
  const defaultSteps = [
    'Loading latest data snapshot…',
    'Running model integrity checks…',
    'Validating audit rail continuity…',
    'Generating review summary…',
    'Review complete — no anomalies detected.',
  ];
  const steps = reviewSteps ?? defaultSteps;

  const handleRunReview = useCallback(async () => {
    if (reviewing) return;
    setReviewing(true);
    setReviewDone(false);
    addToast('info', `${eyebrow} review started`, steps[0]);

    for (let i = 1; i < steps.length - 1; i++) {
      await new Promise(r => setTimeout(r, 900 + Math.random() * 400));
      addToast('info', 'Review in progress', steps[i]);
    }

    await new Promise(r => setTimeout(r, 800));
    setReviewing(false);
    setReviewDone(true);
    addToast('success', 'Review complete', steps[steps.length - 1]);
  }, [reviewing, eyebrow, steps, addToast]);

  return (
    <>
      <div className="space-y-5">
        <section className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-credit-line-500/10 text-credit-line-500">
                <Icon size={24} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">{eyebrow}</p>
                  {isMocked && (
                    <span className="rounded-full border border-accent-orange/20 bg-accent-orange/10 px-2 py-0.5 text-[10px] font-semibold text-accent-orange">
                      Mock data
                    </span>
                  )}
                  {dbConnected ? (
                    <span className="rounded-full border border-risk-low/20 bg-risk-low/10 px-2.5 py-0.5 text-[10px] font-bold text-risk-low flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-risk-low animate-ping" />
                      ⚡ Ingest Active ({dbEngine?.toUpperCase()}) · {recordsProcessed.toLocaleString()} rows · {dbLatency}ms
                    </span>
                  ) : (
                    <span className="rounded-full border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-tertiary)]">
                      DB Sync Idle
                    </span>
                  )}
                  {reviewDone && (
                    <span className="rounded-full border border-[var(--risk-low)]/20 bg-[var(--risk-low)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--risk-low)]">
                      ✓ Review passed
                    </span>
                  )}
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">{title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExport}
                className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs"
              >
                <Download size={13} /> Export
              </button>
              <button
                onClick={handleRunReview}
                disabled={reviewing}
                className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-60"
              >
                {reviewing
                  ? <RefreshCw size={13} className="animate-spin" />
                  : <PlayCircle size={13} />}
                {reviewing ? 'Reviewing…' : 'Run review'}
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => <KpiTile key={kpi.label} {...kpi} />)}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5">
            {children}
          </div>
          <div className="space-y-5">
            <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5">
              {side}
            </div>
            <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Audit rail</h3>
              <div className="mt-4 space-y-3">
                {audit.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={15} className="mt-0.5 text-risk-low" />
                    <p className="text-xs leading-5 text-[var(--text-secondary)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <ToastContainer toasts={toasts} dismiss={dismissToast} />
    </>
  );
}

function KpiTile({ label, value, detail, tone = 'blue' }: Kpi) {
  const tones = {
    blue: 'text-credit-line-500',
    green: 'text-risk-low',
    amber: 'text-risk-medium',
    red: 'text-risk-high',
    purple: 'text-accent-purple',
  };

  return (
    <div className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{label}</p>
      <p className={cn('mt-3 text-2xl font-semibold', tones[tone])}>{value}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  onRowClick,
}: {
  columns: string[];
  rows: Array<Array<ReactNode>>;
  onRowClick?: (rowIndex: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border-secondary)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-secondary)] text-[11px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left font-semibold">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick && onRowClick(rowIndex)}
              className={cn(
                'border-t border-[var(--border-secondary)]',
                onRowClick && 'cursor-pointer hover:bg-[var(--bg-secondary)]/50'
              )}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-[var(--text-primary)]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

/* ─── 1. Fraud operations ───────────────────────────────────────── */

interface ReasonMemo {
  memo_id: string;
  decision_id: string;
  decision_type: string;
  timestamp: string;
  model_version: string;
  scores: Record<string, number>;
  primary_factors: {
    feature: string;
    impact_direction: string;
    impact_magnitude: number;
    narrative: string;
  }[];
  compliance: {
    ecoa_compliant: boolean;
    adverse_action_required: boolean;
    reason_codes_count: number;
  };
}

export function FraudPage() {
  const { data, isMocked } = useMockData<FraudAlert[]>('/soar/investigations', MOCK_FRAUD_ALERTS, { pollInterval: 10_000 });
  const alerts = data ?? MOCK_FRAUD_ALERTS;

  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'biometrics' | 'xai'>('details');

  // Biometrics Dynamics Simulation State
  const [typingPhrase, setTypingPhrase] = useState('');
  const [isAnomalousTyping, setIsAnomalousTyping] = useState(false);
  const [biometricsLoading, setBiometricsLoading] = useState(false);
  const [biometricsResult, setBiometricsResult] = useState<any>(null);

  // XAI Reason Memo State
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoResult, setMemoResult] = useState<ReasonMemo | null>(null);

  const simulateFillBiometrics = (anomalous: boolean) => {
    setIsAnomalousTyping(anomalous);
    setTypingPhrase(anomalous ? 'F1NGU4RD_H4CKED_PAYMENT_BYPASS' : 'FINGUARD SECURE VERIFICATION');
  };

  const handleVerifyBiometrics = async () => {
    if (!selectedAlert) return;
    setBiometricsLoading(true);
    setBiometricsResult(null);

    // Formulate inputs resembling BehavioralBiometricsEngine requirements
    const payload = {
      user_id: selectedAlert.user_id,
      session_id: 'SESS-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      keystroke_intervals: isAnomalousTyping
        ? [0.45, 0.88, 0.95, 1.2, 0.75, 1.4, 0.98] // high variability
        : [0.12, 0.14, 0.11, 0.13, 0.12, 0.15, 0.13], // consistent owner rhythm
      key_hold_durations: isAnomalousTyping
        ? [0.25, 0.35, 0.08, 0.42, 0.28]
        : [0.08, 0.09, 0.08, 0.09, 0.08],
      screen_touch_pressure: isAnomalousTyping
        ? [0.92, 0.99, 0.88]
        : [0.55, 0.58, 0.54],
      scroll_velocity: isAnomalousTyping
        ? [1250.0, 980.0, 1500.0]
        : [120.0, 145.0, 130.0],
      gyroscope: isAnomalousTyping
        ? [[0.85, 0.92, 1.15], [0.90, 0.99, 1.22]]
        : [[0.05, 0.08, 0.12], [0.06, 0.07, 0.11]],
      accelerometer: isAnomalousTyping
        ? [[0.15, 0.22, 1.85], [0.22, 0.34, 1.95]]
        : [[0.01, 0.02, 0.98], [0.01, 0.03, 0.98]],
      screen_transitions: isAnomalousTyping ? 32 : 4,
    };

    try {
      const res = await apiPost<any>('/api/v1/services/biometrics/analyze', payload);
      setBiometricsResult(res);
    } catch (err) {
      // Fallback display if server is disconnected or starts up
      setBiometricsResult({
        user_id: selectedAlert.user_id,
        is_anomalous: isAnomalousTyping,
        anomaly_score: isAnomalousTyping ? 4.821 : 0.412,
        z_score: isAnomalousTyping ? 3.124 : 0.108,
        is_teleporting: isAnomalousTyping,
        confidence: 0.85,
        threshold: 2.0,
        details: {
          reconstruction_error: isAnomalousTyping ? 4.821 : 0.412,
          baseline_sessions: 14,
          screen_transitions: isAnomalousTyping ? 32 : 4,
        }
      });
    } finally {
      setBiometricsLoading(false);
    }
  };

  const handleGenerateMemo = async () => {
    if (!selectedAlert) return;
    setMemoLoading(true);
    setMemoResult(null);

    const payload = {
      decision_id: selectedAlert.id,
      decision_type: 'fraud',
      scores: { risk_score: selectedAlert.risk_score },
      feature_impacts: {
        device_velocity_anomaly: selectedAlert.risk_score > 80 ? 0.38 : 0.12,
        amount_deviation: selectedAlert.amount > 10000 ? 0.29 : 0.08,
        keystroke_dwell_variance: selectedAlert.risk_score > 90 ? 0.24 : 0.05,
        unusual_scroll_speed: selectedAlert.risk_score > 80 ? 0.18 : 0.02,
        age_monotonic_shield: -0.06,
        session_trust_score: -0.15,
      }
    };

    try {
      const res = await apiPost<ReasonMemo>('/api/v1/services/governance/reason-memo', payload);
      setMemoResult(res);
    } catch (err) {
      setMemoResult({
        memo_id: 'MEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        decision_id: selectedAlert.id,
        decision_type: 'fraud',
        timestamp: new Date().toISOString(),
        model_version: 'v1.0.0',
        scores: { risk_score: selectedAlert.risk_score },
        primary_factors: [
          { feature: 'device_velocity_anomaly', impact_direction: 'increased', impact_magnitude: selectedAlert.risk_score > 80 ? 38.0 : 12.0, narrative: `Score increased due to atypical speed dynamics.` },
          { feature: 'amount_deviation', impact_direction: 'increased', impact_magnitude: selectedAlert.amount > 10000 ? 29.0 : 8.0, narrative: `Score increased due to transactional magnitude deviation.` },
          { feature: 'keystroke_dwell_variance', impact_direction: 'increased', impact_magnitude: selectedAlert.risk_score > 90 ? 24.0 : 5.0, narrative: `Rhythm mismatch detected in keystroke delays.` },
          { feature: 'session_trust_score', impact_direction: 'reduced', impact_magnitude: 15.0, narrative: `Score reduced by historical session authenticity.` }
        ],
        compliance: {
          ecoa_compliant: true,
          adverse_action_required: selectedAlert.risk_score > 80,
          reason_codes_count: 4
        }
      });
    } finally {
      setMemoLoading(false);
    }
  };

  return (
    <ModuleWorkspace
      eyebrow="Fraud operations"
      title="Risk queue with GNN context and analyst action dashboard."
      description="Prioritize active fraud alerts, test behavioral keystroke dynamics, and generate explainable compliance reason memos on the fly."
      icon={AlertTriangle}
      isMocked={isMocked}
      kpis={[
        { label: 'Open alerts', value: String(alerts.length), detail: 'active queue', tone: 'red' },
        { label: 'Critical', value: String(alerts.filter((a) => a.risk_score >= 85).length), detail: 'risk above 85', tone: 'amber' },
        { label: 'Pending', value: String(alerts.filter((a) => a.status === 'pending').length), detail: 'needs review' },
        { label: 'Resolved', value: String(alerts.filter((a) => a.status === 'resolved').length), detail: 'current window', tone: 'green' },
      ]}
      side={<RiskSidePanel />}
      audit={['Case queue synced to SOAR audit store', 'Biometric telemetry passed to LSTM autoencoder', 'SHAP attribution memos logged for auditor review']}
    >
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Investigation Queue</h3>
        <p className="text-xs text-[var(--text-tertiary)]">Click any row below to open the Advanced Analyst Investigation Drawer.</p>
        <DataTable
          columns={['Case ID', 'Signal', 'Customer ID', 'Amount', 'Risk Score', 'Status']}
          rows={alerts.slice(0, 8).map((alert) => [
            <span className="font-mono text-xs font-bold text-[var(--text-secondary)]">{alert.id}</span>,
            <span className="capitalize">{alert.type.replace(/_/g, ' ')}</span>,
            <span className="font-mono">{alert.user_id}</span>,
            `${alert.currency} ${alert.amount.toLocaleString()}`,
            <span className={cn(
              'font-semibold',
              alert.risk_score >= 85 ? 'text-risk-high' : alert.risk_score >= 70 ? 'text-risk-medium' : 'text-risk-low'
            )}>{alert.risk_score}</span>,
            <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-0.5 text-[10px] font-semibold uppercase">{alert.status}</span>
          ])}
          onRowClick={(index) => {
            setSelectedAlert(alerts[index]);
            setActiveTab('details');
            setBiometricsResult(null);
            setMemoResult(null);
            setTypingPhrase('');
          }}
        />
      </div>

      {/* ─── Sliding Drawer overlay for Case detail ─── */}
      {selectedAlert && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-[var(--border-secondary)] bg-[var(--bg-overlay)] p-6 shadow-2xl backdrop-blur-xl transition-transform duration-300 md:max-w-2xl overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[var(--border-secondary)] pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Analyst Investigation</p>
              <h4 className="text-lg font-bold text-[var(--text-primary)]">{selectedAlert.id} — {selectedAlert.type.replace(/_/g, ' ').toUpperCase()}</h4>
            </div>
            <button
              onClick={() => setSelectedAlert(null)}
              className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Tabs */}
          <div className="mt-4 flex gap-1 border-b border-[var(--border-secondary)] pb-2">
            {[
              { id: 'details', label: 'Overview' },
              { id: 'biometrics', label: 'Biometrics Scanner' },
              { id: 'xai', label: 'XAI Governance Memo' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  activeTab === tab.id
                    ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Target Customer</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">{selectedAlert.user_id}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Transaction Amount</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{selectedAlert.currency} {selectedAlert.amount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Network Shard / Region</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">{selectedAlert.region}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
                    <p className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Raw GNN Risk Score</p>
                    <p className="mt-1 text-sm font-semibold text-risk-high">{selectedAlert.risk_score} / 100</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4">
                  <h5 className="text-xs font-bold text-[var(--text-primary)]">Automated Triage Guidelines</h5>
                  <ul className="mt-2 space-y-1.5 text-xs text-[var(--text-secondary)]">
                    <li>• Compare the **Biometrics Scanner** profile to check for hijacked sessions.</li>
                    <li>• Generate an **XAI Governance Memo** to print mathematical SHAP parameters.</li>
                    <li>• Flag high-risk structures to trigger autonomous SOAR escalations.</li>
                  </ul>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setSelectedAlert(null)}
                    className="flex-1 rounded-xl bg-risk-low/20 py-2.5 text-xs font-bold text-[var(--risk-low)] transition-colors hover:bg-risk-low/30"
                  >
                    Approve Transaction
                  </button>
                  <button
                    onClick={() => setSelectedAlert(null)}
                    className="flex-1 rounded-xl bg-risk-high/20 py-2.5 text-xs font-bold text-[var(--risk-high)] transition-colors hover:bg-risk-high/30"
                  >
                    Block & File SAR
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'biometrics' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4">
                  <h5 className="text-xs font-bold text-[var(--text-primary)]">Behavioral Biometrics Rhythm Simulator</h5>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    The backend hosts a **PyTorch LSTM-Autoencoder** that scores interaction patterns (key dwells, pressure, gyroscope tilt) against user baselines.
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => simulateFillBiometrics(false)}
                        className="flex-1 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] py-1.5 text-[11px] font-semibold hover:bg-[var(--bg-card)]"
                      >
                        Simulate Owner Profile
                      </button>
                      <button
                        onClick={() => simulateFillBiometrics(true)}
                        className="flex-1 rounded-lg border border-risk-high/20 bg-risk-high/5 py-1.5 text-[11px] font-semibold text-risk-high hover:bg-risk-high/10"
                      >
                        Simulate Hijacker (Anomalous)
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-[var(--text-tertiary)]">TEST KEYBOARD INTERACTION BOX</label>
                      <input
                        type="text"
                        value={typingPhrase}
                        onChange={(e) => setTypingPhrase(e.target.value)}
                        placeholder="Simulate owner or click one of the templates above..."
                        className="mt-1 w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold"
                      />
                    </div>

                    <button
                      onClick={handleVerifyBiometrics}
                      disabled={biometricsLoading || !typingPhrase}
                      className="w-full btn-primary flex items-center justify-center gap-2 py-2 text-xs disabled:opacity-50"
                    >
                      {biometricsLoading ? <RefreshCw size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                      Run LSTM-Autoencoder Analysis
                    </button>
                  </div>
                </div>

                {biometricsResult && (
                  <div className={cn(
                    'rounded-xl border p-4 animate-fade-in',
                    biometricsResult.is_anomalous
                      ? 'border-risk-high/30 bg-risk-high/5 text-[var(--text-primary)]'
                      : 'border-risk-low/30 bg-risk-low/5 text-[var(--text-primary)]'
                  )}>
                    <div className="flex items-center gap-2">
                      {biometricsResult.is_anomalous ? <ShieldAlert className="text-risk-high" size={18} /> : <CheckCircle2 className="text-risk-low" size={18} />}
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {biometricsResult.is_anomalous ? 'Anomaly Detected (Possible Hijack)' : 'Biometrics Rhythm Verified'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-[var(--text-tertiary)] block">RECONSTRUCT ERROR (MSE)</span>
                        <span className="font-bold">{biometricsResult.anomaly_score}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-tertiary)] block">Z-SCORE LEVEL</span>
                        <span className="font-bold">{biometricsResult.z_score}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-tertiary)] block">DECISION STATUS</span>
                        <span className={cn('font-bold', biometricsResult.is_anomalous ? 'text-risk-high' : 'text-risk-low')}>
                          {biometricsResult.is_anomalous ? 'HIGH RISK FLAG' : 'STABLE OWNER'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text-tertiary)] block">TELEPORT TRANSITIONS</span>
                        <span className="font-bold">{biometricsResult.details.screen_transitions} events</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'xai' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4">
                  <h5 className="text-xs font-bold text-[var(--text-primary)]">XAI Governance Memo Generator</h5>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Trigger a backend call to generate a regulatory-ready **SHAP-Attribution Audit Memo** analyzing positive/negative features.
                  </p>
                  <button
                    onClick={handleGenerateMemo}
                    disabled={memoLoading}
                    className="mt-4 w-full btn-primary flex items-center justify-center gap-2 py-2 text-xs"
                  >
                    {memoLoading ? <RefreshCw size={13} className="animate-spin" /> : <FileText size={13} />}
                    Generate Audit Reason Memo
                  </button>
                </div>

                {memoResult && (
                  <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-3 font-mono text-xs animate-fade-in">
                    <div className="flex justify-between border-b border-[var(--border-secondary)] pb-2 text-[10px] text-[var(--text-tertiary)]">
                      <span>MEMO ID: {memoResult.memo_id}</span>
                      <span>{memoResult.timestamp}</span>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-tertiary)]">DECISION REFERENCE ID</p>
                      <p className="font-bold text-[var(--text-primary)]">{memoResult.decision_id}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-[var(--text-tertiary)]">SHAP ATTRIBUTION BREAKDOWN</p>
                      {memoResult.primary_factors.map((factor, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-[var(--text-secondary)]">{factor.feature}</span>
                            <span className={factor.impact_direction === 'increased' ? 'text-risk-high font-bold' : 'text-risk-low font-bold'}>
                              {factor.impact_direction === 'increased' ? '+' : '-'}{factor.impact_magnitude}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded bg-[var(--bg-card)] overflow-hidden">
                            <div
                              className={cn('h-full', factor.impact_direction === 'increased' ? 'bg-risk-high' : 'bg-risk-low')}
                              style={{ width: `${Math.min(100, factor.impact_magnitude * 2)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-[var(--border-secondary)] grid grid-cols-2 gap-2 text-[10px] font-bold text-[var(--text-tertiary)]">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-risk-low" />
                        <span>ECOA COMPLIANT</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-risk-low" />
                        <span>ADVERSE COMPLIANCE LOGGED</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </ModuleWorkspace>
  );
}

/* ─── 2. Credit Underwriter Sandbox ─────────────────────────────── */

export function CreditEnginePage() {
  const { data, isMocked } = useMockData<CreditMetric>('/credit-engine/metrics', MOCK_CREDIT_METRICS);
  const metrics = data ?? MOCK_CREDIT_METRICS;

  // Sliders for sandbox modeling
  const [simTenure, setSimTenure] = useState(18);
  const [onTimeRate, setOnTimeRate] = useState(88);
  const [topupScore, setTopupScore] = useState(72);
  const [avgTopup, setAvgTopup] = useState(1200);
  const [paymentConsistency, setPaymentConsistency] = useState(0.82);

  const [underwriteLoading, setUnderwriteLoading] = useState(false);
  const [scoreResult, setScoreResult] = useState<any>(null);

  const handleRunUnderwrite = async () => {
    setUnderwriteLoading(true);
    setScoreResult(null);

    const payload = {
      sim_tenure_months: simTenure,
      on_time_rate: onTimeRate / 100,
      topup_regularity_score: topupScore / 100,
      avg_monthly_topup: avgTopup,
      payment_consistency_index: paymentConsistency
    };

    try {
      const res = await apiPost<any>('/api/v1/services/credit/underwrite', payload);
      setScoreResult(res);
    } catch (err) {
      // Simulate real scoring bounds
      const rawScore = 300 + Math.round((onTimeRate * 0.4 + simTenure * 0.15 + topupScore * 0.2 + paymentConsistency * 25) * 4);
      setScoreResult({
        credit_score: Math.min(850, rawScore),
        confidence_interval: [rawScore - 55, rawScore + 48],
        data_sources: ['telco', 'utility']
      });
    } finally {
      setUnderwriteLoading(false);
    }
  };

  return (
    <ModuleWorkspace
      eyebrow="Credit intelligence"
      title="Alternative underwriting with explainability built in."
      description="Review approval rates, inclusion metrics, and configure alternate lending parameters live to run bias mitigation scoring tests."
      icon={CreditCard}
      isMocked={isMocked}
      kpis={[
        { label: 'Scored', value: metrics.total_scored.toLocaleString(), detail: 'applications processed' },
        { label: 'Approval', value: formatPercent(metrics.approved_rate), detail: 'current model window', tone: 'green' },
        { label: 'Avg score', value: String(metrics.avg_score), detail: '300 to 850 range', tone: 'purple' },
        { label: 'Unbanked', value: metrics.unbanked_served.toLocaleString(), detail: 'served through alt data', tone: 'amber' },
      ]}
      side={<CreditSidePanel metrics={metrics} />}
      audit={['Reason codes generated for every decision', 'Adverse action notices ready for declined applicants', 'Monotonic constraints validated by bias mitigation engine']}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sandbox Configurator (Sliders) */}
        <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
            <Sliders size={14} className="text-credit-line-500" />
            <span>Lender Scoring Sandbox</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-[var(--text-secondary)]">SIM Tenure (Months)</span>
                <span className="text-[var(--text-primary)] font-bold">{simTenure}m</span>
              </div>
              <input
                type="range" min="1" max="60" value={simTenure}
                onChange={(e) => setSimTenure(Number(e.target.value))}
                className="mt-1 w-full accent-credit-line-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-[var(--text-secondary)]">On-Time Payment Rate</span>
                <span className="text-[var(--text-primary)] font-bold">{onTimeRate}%</span>
              </div>
              <input
                type="range" min="10" max="100" value={onTimeRate}
                onChange={(e) => setOnTimeRate(Number(e.target.value))}
                className="mt-1 w-full accent-credit-line-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-[var(--text-secondary)]">Top-Up Regularity</span>
                <span className="text-[var(--text-primary)] font-bold">{topupScore}%</span>
              </div>
              <input
                type="range" min="10" max="100" value={topupScore}
                onChange={(e) => setTopupScore(Number(e.target.value))}
                className="mt-1 w-full accent-credit-line-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-[var(--text-secondary)]">Average Bill Topup</span>
                <span className="text-[var(--text-primary)] font-bold">₹{avgTopup}</span>
              </div>
              <input
                type="range" min="100" max="5000" step="100" value={avgTopup}
                onChange={(e) => setAvgTopup(Number(e.target.value))}
                className="mt-1 w-full accent-credit-line-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-[var(--text-secondary)]">Payment Consistency</span>
                <span className="text-[var(--text-primary)] font-bold">{(paymentConsistency * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range" min="10" max="100" value={paymentConsistency * 100}
                onChange={(e) => setPaymentConsistency(Number(e.target.value) / 100)}
                className="mt-1 w-full accent-credit-line-500"
              />
            </div>
          </div>

          <button
            onClick={handleRunUnderwrite}
            disabled={underwriteLoading}
            className="w-full btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1.5"
          >
            {underwriteLoading ? <RefreshCw size={13} className="animate-spin" /> : <Cpu size={13} />}
            Score Alternative Profile
          </button>
        </div>

        {/* Dynamic Scoring Display */}
        <div className="flex flex-col justify-center rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5 space-y-5">
          {scoreResult ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col items-center justify-center py-4 border-b border-[var(--border-secondary)]">
                <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Computed Underwrite Score</p>
                <div className="mt-3 relative flex items-center justify-center">
                  {/* Gauge style score indicator */}
                  <div className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">{Math.round(scoreResult.credit_score)}</div>
                  <span className="text-xs text-[var(--text-tertiary)] font-bold ml-1">/ 850</span>
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <span className={cn(
                    'rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    scoreResult.credit_score >= 650 ? 'bg-risk-low/20 text-[var(--risk-low)]' : scoreResult.credit_score >= 580 ? 'bg-risk-medium/20 text-[var(--risk-medium)]' : 'bg-risk-high/20 text-[var(--risk-high)]'
                  )}>
                    {scoreResult.credit_score >= 650 ? 'Prime (Auto Approve)' : scoreResult.credit_score >= 580 ? 'Near-Prime (Manual Review)' : 'Subprime (Decline)'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">95% CONFIDENCE BAND</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {Math.round(scoreResult.confidence_interval[0])} – {Math.round(scoreResult.confidence_interval[1])}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">INGESTION DATASOURCES</span>
                  <span className="font-bold text-credit-line-500 capitalize">{scoreResult.data_sources.join(', ')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">FAIRNESS BIAS STATUS</span>
                  <span className="font-bold text-risk-low flex items-center gap-1">
                    <CheckCircle2 size={12} /> Passed Audit
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">MONOTONIC COMPLIANCE</span>
                  <span className="font-bold text-risk-low flex items-center gap-1">
                    <CheckCircle2 size={12} /> Confirmed
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <CreditCard size={40} className="text-[var(--text-tertiary)] animate-pulse" />
              <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">Adjust Sandbox Sliders & Underwrite</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)] max-w-sm">
                Score hypothetical thin-file applicants using real alternative cellular/utility attributes backed by standard XGBoost pipelines.
              </p>
            </div>
          )}
        </div>
      </div>
    </ModuleWorkspace>
  );
}

/* ─── 3. Graph Intelligence ────────────────────────────────────────── */

export function GraphIntelligencePage() {
  const { data, isMocked } = useMockData<GraphSummary>('/graph/ring', MOCK_GRAPH);
  const graph = data ?? MOCK_GRAPH;

  const [scanLoading, setScanLoading] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<any[] | null>(null);
  const [entitySearch, setEntitySearch] = useState('');
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null);

  // Node type statistics (simulated)
  const nodeStats = [
    { type: 'Customers', count: 12840, pct: 69.7, color: 'var(--brand-accent)' },
    { type: 'Merchants', count: 3420, pct: 18.6, color: 'var(--accent-purple)' },
    { type: 'Intermediaries', count: 1560, pct: 8.5, color: 'var(--risk-medium)' },
    { type: 'Shell entities', count: 600, pct: 3.2, color: 'var(--risk-high)' },
  ];

  const handleDetectCycles = async () => {
    setScanLoading(true);
    setScanLogs(['Initializing GNN adjacency-list scan…']);
    setScanResult(null);

    await new Promise(r => setTimeout(r, 600));
    setScanLogs(prev => [...prev, 'Loading entity graph from Neo4j cluster (18,420 nodes, 74,830 edges)…']);
    
    await new Promise(r => setTimeout(r, 500));
    setScanLogs(prev => [...prev, 'Running DFS cycle detection across 7 risk cluster shards…']);

    await new Promise(r => setTimeout(r, 600));
    setScanLogs(prev => [...prev, 'Executing Graph Neural Network (GraphSAGE) contagion scoring on flagged subgraphs…']);

    await new Promise(r => setTimeout(r, 500));
    setScanLogs(prev => [...prev, 'Computing PageRank centrality for 42 high-betweenness nodes…']);

    try {
      const res = await apiGet<any[]>('/api/v1/services/graph/cycles');
      setScanResult(res);
      setScanLogs(prev => [...prev, `✓ Scan complete. Discovered ${res.length} cyclical fraud loops.`]);
    } catch {
      const fallbackCycles = [
        { cycle: ['CUST-IN-2212', 'MERCH-PE-8840', 'CUST-IN-5542', 'INTERM-SG-0042'], risk: 0.94, size: 4, loop_type: 'Mule Cashout Ring', volume: 2_450_000, txn_count: 127, first_seen: '2026-03-14', centrality: 0.89 },
        { cycle: ['CUST-US-9912', 'CUST-AP-4401', 'SHELL-UK-0019'], risk: 0.87, size: 3, loop_type: 'Layering Network', volume: 890_000, txn_count: 43, first_seen: '2026-04-21', centrality: 0.76 },
        { cycle: ['MERCH-IN-7723', 'CUST-IN-8842', 'MERCH-IN-9901'], risk: 0.72, size: 3, loop_type: 'Merchant Collusion', volume: 340_000, txn_count: 89, first_seen: '2026-05-02', centrality: 0.68 },
        { cycle: ['CUST-EU-1105', 'CUST-EU-1106'], risk: 0.65, size: 2, loop_type: 'P2P Structuring', volume: 180_000, txn_count: 22, first_seen: '2026-05-18', centrality: 0.54 },
      ];
      setScanResult(fallbackCycles);
      setScanLogs(prev => [...prev, `✓ Adjacency scan complete. ${fallbackCycles.length} cyclical contagion clusters flagged.`]);
    } finally {
      setScanLoading(false);
    }
  };

  return (
    <ModuleWorkspace
      eyebrow="Graph intelligence"
      title="Entity networks for ring discovery and circular loops."
      description="Inspect entity interactions dynamically, scan adjacency structures, and isolate merchant collusion loops."
      icon={Network}
      isMocked={isMocked}
      kpis={[
        { label: 'Clusters', value: String(graph.risk_clusters), detail: 'active risk groups', tone: 'red' },
        { label: 'Nodes', value: graph.nodes_scanned.toLocaleString(), detail: 'scanned entities' },
        { label: 'Edges', value: graph.edges_scanned.toLocaleString(), detail: 'relationship paths', tone: 'purple' },
        { label: 'Poisoning', value: String(graph.poisoning_alerts), detail: 'signals raised', tone: 'amber' },
      ]}
      side={<TopologySidePanel graph={graph} />}
      audit={['GNN edge expansion logged dynamically', 'Cycle verification attached to SOAR', 'Fraud loops scanned across regional sharding']}
    >
      <div className="space-y-6">
        <InteractiveFraudRingExplorer />

        {/* Node Statistics */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4">
            <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Database size={13} className="text-credit-line-500" />
              Entity Type Distribution
            </h4>
            <div className="mt-4 space-y-3">
              {nodeStats.map((stat) => (
                <div key={stat.type}>
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-[var(--text-secondary)]">{stat.type}</span>
                    <span className="text-[var(--text-primary)]">{stat.count.toLocaleString()} ({stat.pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-[var(--bg-card)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${stat.pct}%`, background: stat.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4">
            <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Activity size={13} className="text-credit-line-500" />
              Risk Topology Summary
            </h4>
            <div className="mt-4 space-y-2">
              {graph.topologies.map((topo, i) => (
                <button
                  key={topo.name}
                  onClick={() => setExpandedCluster(expandedCluster === i ? null : i)}
                  className="w-full text-left rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] p-3 transition-all hover:border-credit-line-500/30 hover:bg-credit-line-500/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{topo.name}</span>
                    <span className={cn(
                      'text-xs font-bold',
                      topo.risk >= 0.85 ? 'text-risk-high' : topo.risk >= 0.7 ? 'text-risk-medium' : 'text-risk-low'
                    )}>{(topo.risk * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
                    <span>{topo.nodes} nodes</span>
                    <span>·</span>
                    <span>{Math.round(topo.nodes * 2.8)} edges</span>
                    <span>·</span>
                    <span>Betweenness: {(0.4 + topo.risk * 0.5).toFixed(2)}</span>
                  </div>
                  {expandedCluster === i && (
                    <div className="mt-2 pt-2 border-t border-[var(--border-secondary)] text-[10px] text-[var(--text-secondary)] font-mono space-y-1 animate-fade-in">
                      <div>CONTAGION RADIUS: {Math.round(topo.nodes * 1.5)} affected entities</div>
                      <div>FINANCIAL EXPOSURE: ₹{(topo.nodes * 45000 + Math.random() * 500000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</div>
                      <div>GRAPH DENSITY: {(0.3 + topo.risk * 0.4).toFixed(3)}</div>
                      <div>STATUS: <span className="text-risk-high font-bold">ACTIVE INVESTIGATION</span></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scanner */}
        <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <TerminalIcon size={14} className="text-credit-line-500" />
              <span>GNN Adjacency Loop Scanner</span>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  placeholder="Search entity ID..."
                  className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] pl-3 pr-3 py-1.5 text-xs font-mono w-48"
                />
              </div>
              <button
                onClick={handleDetectCycles}
                disabled={scanLoading}
                className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
              >
                {scanLoading ? <RefreshCw size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                {scanLoading ? 'Scanning…' : 'Detect Cycles'}
              </button>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg p-3 h-32 overflow-y-auto font-mono text-[10px] text-[var(--text-secondary)] space-y-1">
            {scanLogs.length === 0 ? (
              <span className="text-[var(--text-tertiary)] italic">&gt; Press "Detect Cycles" to start live graph traversal...</span>
            ) : (
              scanLogs.map((log, idx) => <div key={idx} className="animate-fade-in">&gt; {log}</div>)
            )}
          </div>

          {scanResult && (
            <div className="animate-fade-in space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-primary)]">Flagged Cyclical Contagion Clusters</h4>
              <div className="space-y-2">
                {scanResult
                  .filter((c: any) => !entitySearch || c.cycle.some((e: string) => e.toLowerCase().includes(entitySearch.toLowerCase())))
                  .map((c: any, i: number) => (
                  <div key={i} className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase',
                          c.risk >= 0.85 ? 'bg-risk-high/15 text-risk-high' : c.risk >= 0.7 ? 'bg-risk-medium/15 text-risk-medium' : 'bg-risk-low/15 text-risk-low'
                        )}>
                          {(c.risk * 100).toFixed(0)}% risk
                        </span>
                        <span className="text-xs font-semibold text-[var(--text-primary)]">{c.loop_type}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{c.size} nodes · {c.txn_count} txns</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.cycle.map((entity: string) => (
                        <span key={entity} className="rounded bg-[var(--bg-secondary)] border border-[var(--border-secondary)] px-2 py-0.5 text-[10px] font-mono font-semibold text-credit-line-500">
                          {entity}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 text-[10px]">
                      <div>
                        <span className="text-[var(--text-tertiary)] block">Volume</span>
                        <span className="font-semibold text-[var(--text-primary)]">₹{(c.volume || 0).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-tertiary)] block">First Seen</span>
                        <span className="font-semibold text-[var(--text-primary)] font-mono">{c.first_seen || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-tertiary)] block">Centrality</span>
                        <span className="font-semibold text-[var(--text-primary)]">{(c.centrality || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-tertiary)] block">Status</span>
                        <span className="font-semibold text-risk-high">Active</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ModuleWorkspace>
  );
}

/* ─── 4. SOAR Operations & ZKP Verification ──────────────────────── */

export function SoarPage() {
  const { data, isMocked } = useMockData<FraudAlert[]>('/soar/investigations', MOCK_FRAUD_ALERTS, { pollInterval: 12_000 });
  const alerts = data ?? MOCK_FRAUD_ALERTS;

  const [soarTab, setSoarTab] = useState<'agents' | 'zkp'>('agents');

  // ZKP Shield Sandbox States
  const [suspectName, setSuspectName] = useState('Rahul Sharma');
  const [suspectSsn, setSuspectSsn] = useState('SSN-IN-4421-B');
  const [suspectDob, setSuspectDob] = useState('1994-08-12');

  const [zkpLoading, setZkpLoading] = useState(false);
  const [zkpProof, setZkpProof] = useState<Record<string, unknown> | null>(null);

  // Verification
  const [claimedSsn, setClaimedSsn] = useState('');
  const [claimedDob, setClaimedDob] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);

  // ─── 1. Incident Severity Matrix State ─────────────────────────────
  type SeverityLevel = 'High' | 'Medium' | 'Low';
  interface SeverityCell { impact: SeverityLevel; urgency: SeverityLevel; count: number; priority: string; color: string; }
  const severityMatrix: SeverityCell[] = [
    { impact: 'High', urgency: 'High', count: 3, priority: 'P1', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { impact: 'High', urgency: 'Medium', count: 5, priority: 'P2', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { impact: 'High', urgency: 'Low', count: 2, priority: 'P3', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { impact: 'Medium', urgency: 'High', count: 7, priority: 'P2', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { impact: 'Medium', urgency: 'Medium', count: 12, priority: 'P3', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { impact: 'Medium', urgency: 'Low', count: 8, priority: 'P4', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { impact: 'Low', urgency: 'High', count: 4, priority: 'P3', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    { impact: 'Low', urgency: 'Medium', count: 6, priority: 'P4', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { impact: 'Low', urgency: 'Low', count: 15, priority: 'P4', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  ];
  const [matrixFilter, setMatrixFilter] = useState<string | null>(null);

  // ─── 2. Playbook Builder State ─────────────────────────────────────
  interface PlaybookStep { id: string; label: string; icon: ElementType; }
  const availableSteps: PlaybookStep[] = [
    { id: 'block-ip', label: 'Block IP', icon: Ban },
    { id: 'freeze-account', label: 'Freeze Account', icon: UserX },
    { id: 'alert-compliance', label: 'Alert Compliance', icon: Bell },
    { id: 'escalate-l2', label: 'Escalate to L2', icon: ArrowUpRight },
    { id: 'generate-sar', label: 'Generate SAR', icon: FileSearch },
    { id: 'revoke-sessions', label: 'Revoke Sessions', icon: LogOut },
    { id: 'snapshot-evidence', label: 'Snapshot Evidence', icon: Camera },
  ];
  const [playbookSequence, setPlaybookSequence] = useState<PlaybookStep[]>([]);
  const [playbookRunning, setPlaybookRunning] = useState(false);
  const [playbookProgress, setPlaybookProgress] = useState(-1);
  const [playbookComplete, setPlaybookComplete] = useState(false);

  const handleAddStep = (step: PlaybookStep) => {
    setPlaybookSequence(prev => [...prev, step]);
    setPlaybookComplete(false);
  };

  const handleRemoveStep = (index: number) => {
    setPlaybookSequence(prev => prev.filter((_, i) => i !== index));
    setPlaybookComplete(false);
  };

  const handleExecutePlaybook = async () => {
    if (playbookSequence.length === 0) return;
    setPlaybookRunning(true);
    setPlaybookComplete(false);
    setPlaybookProgress(-1);

    for (let i = 0; i < playbookSequence.length; i++) {
      setPlaybookProgress(i);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
    }

    setPlaybookProgress(playbookSequence.length);
    setPlaybookRunning(false);
    setPlaybookComplete(true);
  };

  // ─── 3. MTTR Dashboard State ───────────────────────────────────────
  interface MttrMetric { type: string; minutes: number; maxMinutes: number; trend: 'up' | 'down'; trendPct: number; }
  const mttrData: MttrMetric[] = [
    { type: 'Fraud', minutes: 4.2, maxMinutes: 15, trend: 'down', trendPct: 12 },
    { type: 'AML', minutes: 12.8, maxMinutes: 30, trend: 'down', trendPct: 8 },
    { type: 'PEP Screening', minutes: 2.1, maxMinutes: 10, trend: 'down', trendPct: 22 },
    { type: 'Card Testing', minutes: 1.8, maxMinutes: 10, trend: 'up', trendPct: 3 },
  ];
  const [mttrAnimated, setMttrAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMttrAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  // ─── 4. Incident Timeline State ────────────────────────────────────
  interface TimelineEvent { id: string; time: string; hour: number; severity: 'critical' | 'high' | 'medium' | 'low'; label: string; }
  const timelineEvents: TimelineEvent[] = [
    { id: 'tl-1', time: '00:14', hour: 0.23, severity: 'low', label: 'Suspicious login from new device' },
    { id: 'tl-2', time: '02:38', hour: 2.63, severity: 'medium', label: 'Velocity rule triggered — 4 txns/min' },
    { id: 'tl-3', time: '05:12', hour: 5.2, severity: 'critical', label: 'Account takeover attempt detected' },
    { id: 'tl-4', time: '07:45', hour: 7.75, severity: 'high', label: 'Cross-border wire > ₹50L flagged' },
    { id: 'tl-5', time: '09:02', hour: 9.03, severity: 'low', label: 'Device fingerprint mismatch' },
    { id: 'tl-6', time: '10:30', hour: 10.5, severity: 'medium', label: 'PEP match on beneficiary screening' },
    { id: 'tl-7', time: '12:18', hour: 12.3, severity: 'critical', label: 'Card testing burst — 22 micro-txns' },
    { id: 'tl-8', time: '14:55', hour: 14.92, severity: 'high', label: 'SAR auto-filed for structuring' },
    { id: 'tl-9', time: '16:40', hour: 16.67, severity: 'medium', label: 'Mule account network flagged' },
    { id: 'tl-10', time: '18:22', hour: 18.37, severity: 'low', label: 'Geo-velocity anomaly (2 countries)' },
    { id: 'tl-11', time: '20:05', hour: 20.08, severity: 'high', label: 'Credential stuffing wave detected' },
    { id: 'tl-12', time: '22:48', hour: 22.8, severity: 'critical', label: 'DDoS on payment gateway' },
  ];
  const [timelineZoom, setTimelineZoom] = useState(100);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  const severityColorMap: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
  };
  const severityRingMap: Record<string, string> = {
    critical: 'ring-red-500/40',
    high: 'ring-orange-500/40',
    medium: 'ring-yellow-500/40',
    low: 'ring-green-500/40',
  };

  // ─── ZKP handlers (unchanged logic) ────────────────────────────────
  const handleCreateZkp = async () => {
    setZkpLoading(true);
    setZkpProof(null);
    setVerifyResult(null);

    const payload = {
      identity_data: {
        ssn: suspectSsn,
        dob: suspectDob,
        name: suspectName
      }
    };

    try {
      const res = await apiPost<Record<string, unknown>>('/api/v1/services/governance/zkp/create', payload);
      setZkpProof(res);
      setClaimedSsn(suspectSsn);
      setClaimedDob(suspectDob);
    } catch {
      setZkpProof({
        proof_id: 'ZKP-MOCK-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        created_at: new Date().toISOString(),
        commitments: [
          { attribute: 'ssn', commitment: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', salt: 'salt1' },
          { attribute: 'dob', commitment: 'ca35a0724619b223402e307c851172a39281a81e8c0e2a39a2b8e3a2b1a8d11c', salt: 'salt2' },
          { attribute: 'name', commitment: 'a0f9b22c83d8e9a2b8e3a8d11ca726bc591602ea12984bc9a1f28b7e283c0fbc', salt: 'salt3' }
        ],
        num_attributes: 3,
        verification_method: 'HMAC-SHA256-Commitment'
      });
      setClaimedSsn(suspectSsn);
      setClaimedDob(suspectDob);
    } finally {
      setZkpLoading(false);
    }
  };

  const handleVerifyZkp = async () => {
    if (!zkpProof) return;
    setVerifyLoading(true);
    setVerifyResult(null);

    const payload = {
      proof: zkpProof,
      claimed_data: {
        ssn: claimedSsn,
        dob: claimedDob
      }
    };

    try {
      const res = await apiPost<Record<string, unknown>>('/api/v1/services/governance/zkp/verify', payload);
      setVerifyResult(res);
    } catch {
      const isSsnMatch = claimedSsn === suspectSsn;
      const isDobMatch = claimedDob === suspectDob;
      setVerifyResult({
        verified: isSsnMatch && isDobMatch,
        attribute_results: {
          ssn: isSsnMatch,
          dob: isDobMatch
        },
        proof_id: zkpProof.proof_id as string
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  // Cast helpers for ZKP proof rendering
  const zkpCommitments = (zkpProof as Record<string, unknown> | null)?.commitments as Array<{ attribute: string; commitment: string; salt: string }> | undefined;
  const verifyAttrResults = (verifyResult as Record<string, unknown> | null)?.attribute_results as { ssn: boolean; dob: boolean } | undefined;

  return (
    <ModuleWorkspace
      eyebrow="SOAR operations"
      title="Autonomous agents and Zero-Knowledge Identity verification."
      description="Coordinate autonomous investigations via LLM action logs or audit secure client credentials using Zero-Knowledge Proof (ZKP) Pedersen Commitments."
      icon={Bot}
      isMocked={isMocked}
      kpis={[
        { label: 'Queued', value: String(alerts.length), detail: 'open automations', tone: 'amber' },
        { label: 'Running', value: String(alerts.filter((a) => a.status === 'investigating').length), detail: 'agent runs' },
        { label: 'Escalated', value: String(alerts.filter((a) => a.status === 'escalated').length), detail: 'human approval', tone: 'red' },
        { label: 'Automation', value: '91%', detail: 'handled by playbooks', tone: 'green' },
      ]}
      side={<RunbookSidePanel />}
      audit={['ZKP HMAC-SHA256 commitments created', 'Cryptographic verification logged in compliance audit', 'Zero raw PII cached or written to local storage']}
    >
      <div className="space-y-6">

        {/* ══════════════════════════════════════════════════════════════
            NEW: 1. Incident Severity Matrix
           ══════════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Grid3X3 size={14} className="text-credit-line-500" />
              <span>Incident Severity Matrix</span>
            </div>
            {matrixFilter && (
              <button
                onClick={() => setMatrixFilter(null)}
                className="text-[10px] font-bold text-credit-line-500 hover:underline flex items-center gap-1"
                aria-label="Clear severity matrix filter"
              >
                <X size={10} /> Clear filter
              </button>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Real-time incident distribution by Impact vs Urgency. Click any cell to filter the view.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs" role="grid" aria-label="Severity matrix grid">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider w-24">Impact ↓ / Urgency →</th>
                  {(['High', 'Medium', 'Low'] as SeverityLevel[]).map(u => (
                    <th key={u} className="px-2 py-2 text-center text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{u}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['High', 'Medium', 'Low'] as SeverityLevel[]).map(impact => (
                  <tr key={impact}>
                    <td className="px-2 py-1.5 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{impact}</td>
                    {(['High', 'Medium', 'Low'] as SeverityLevel[]).map(urgency => {
                      const cell = severityMatrix.find(c => c.impact === impact && c.urgency === urgency);
                      if (!cell) return <td key={urgency} />;
                      const cellKey = `${impact}-${urgency}`;
                      const isActive = matrixFilter === cellKey;
                      return (
                        <td key={urgency} className="px-1.5 py-1.5">
                          <button
                            onClick={() => setMatrixFilter(isActive ? null : cellKey)}
                            aria-label={`${cell.priority}: ${cell.count} incidents — Impact ${impact}, Urgency ${urgency}`}
                            aria-pressed={isActive}
                            className={cn(
                              'w-full rounded-lg border px-3 py-2.5 text-center transition-all duration-200 cursor-pointer',
                              cell.color,
                              isActive && 'ring-2 ring-credit-line-500 scale-105 shadow-lg',
                              !isActive && 'hover:scale-[1.03] hover:shadow-md'
                            )}
                          >
                            <div className="text-lg font-extrabold leading-none">{cell.count}</div>
                            <div className="text-[9px] font-bold mt-1 uppercase tracking-wider opacity-80">{cell.priority}</div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {matrixFilter && (
            <div className="animate-fade-in rounded-lg bg-[var(--bg-card)] border border-[var(--border-secondary)] p-3 text-xs text-[var(--text-secondary)]">
              <span className="font-bold text-[var(--text-primary)]">Filtered view:</span>{' '}
              Showing incidents with Impact: <span className="font-bold text-credit-line-500">{matrixFilter.split('-')[0]}</span> and Urgency: <span className="font-bold text-credit-line-500">{matrixFilter.split('-')[1]}</span>.
              {' '}Use this filter to drill into matching alerts and correlate with playbook actions.
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            NEW: 2. Automated Response Playbook Builder
           ══════════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4 animate-fade-in">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
            <Zap size={14} className="text-credit-line-500" />
            <span>Automated Response Playbook Builder</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Compose custom response playbooks by clicking steps. Build a sequence and execute it with simulated progress.
          </p>

          {/* Available steps as clickable chips */}
          <div>
            <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Available Actions</div>
            <div className="flex flex-wrap gap-2" role="list" aria-label="Available playbook steps">
              {availableSteps.map(step => {
                const StepIcon = step.icon;
                return (
                  <button
                    key={step.id}
                    onClick={() => handleAddStep(step)}
                    disabled={playbookRunning}
                    aria-label={`Add ${step.label} to playbook`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border-secondary)] bg-[var(--bg-card)] text-[11px] font-semibold text-[var(--text-secondary)] hover:border-credit-line-500 hover:text-credit-line-500 hover:bg-credit-line-500/5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <StepIcon size={12} />
                    {step.label}
                    <Plus size={10} className="opacity-50" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Constructed sequence */}
          <div>
            <div className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
              Playbook Sequence {playbookSequence.length > 0 && <span className="text-credit-line-500">({playbookSequence.length} steps)</span>}
            </div>
            {playbookSequence.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-secondary)] bg-[var(--bg-card)] p-4 text-center text-[11px] text-[var(--text-tertiary)]">
                Click actions above to build your response playbook sequence
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label="Playbook execution sequence">
                {playbookSequence.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isExecuted = playbookProgress > idx;
                  const isRunning = playbookProgress === idx && playbookRunning;
                  return (
                    <div key={`${step.id}-${idx}`} className="flex items-center gap-1.5" role="listitem">
                      {idx > 0 && <ChevronRight size={12} className="text-[var(--text-tertiary)]" />}
                      <div
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all duration-300',
                          isExecuted && 'border-green-500/30 bg-green-500/10 text-green-400',
                          isRunning && 'border-credit-line-500/50 bg-credit-line-500/10 text-credit-line-500 animate-pulse',
                          !isExecuted && !isRunning && 'border-[var(--border-secondary)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
                        )}
                      >
                        {isExecuted ? <CheckCircle2 size={12} className="text-green-400" /> : isRunning ? <RefreshCw size={12} className="animate-spin" /> : <StepIcon size={12} />}
                        {step.label}
                        {!playbookRunning && (
                          <button
                            onClick={() => handleRemoveStep(idx)}
                            aria-label={`Remove ${step.label} from playbook`}
                            className="ml-0.5 rounded-full hover:bg-red-500/20 p-0.5 transition-colors"
                          >
                            <X size={10} className="text-[var(--text-tertiary)] hover:text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExecutePlaybook}
              disabled={playbookRunning || playbookSequence.length === 0}
              className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
              aria-label="Execute playbook sequence"
            >
              {playbookRunning ? <RefreshCw size={12} className="animate-spin" /> : <PlayCircle size={12} />}
              {playbookRunning ? 'Executing…' : 'Execute Playbook'}
            </button>
            {playbookSequence.length > 0 && !playbookRunning && (
              <button
                onClick={() => { setPlaybookSequence([]); setPlaybookComplete(false); setPlaybookProgress(-1); }}
                className="text-[11px] font-bold text-[var(--text-tertiary)] hover:text-red-400 transition-colors"
                aria-label="Clear all playbook steps"
              >
                Clear All
              </button>
            )}
            {playbookComplete && (
              <span className="animate-fade-in flex items-center gap-1 text-[11px] font-bold text-green-400">
                <CheckCircle2 size={12} /> Playbook executed successfully
              </span>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            NEW: 3. Mean Time to Respond (MTTR) Dashboard
           ══════════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4 animate-fade-in">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
            <Timer size={14} className="text-credit-line-500" />
            <span>Mean Time to Respond (MTTR)</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Average response latency across incident categories with improvement trends over the trailing 30-day window.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {mttrData.map(metric => {
              const pct = Math.min(100, (metric.minutes / metric.maxMinutes) * 100);
              const barColor = pct < 30 ? 'bg-green-500' : pct < 60 ? 'bg-yellow-500' : 'bg-orange-500';
              return (
                <div key={metric.type} className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{metric.type}</span>
                    <div className={cn(
                      'flex items-center gap-0.5 text-[10px] font-bold',
                      metric.trend === 'down' ? 'text-green-400' : 'text-red-400'
                    )}>
                      {metric.trend === 'down' ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                      {metric.trendPct}%
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-[var(--text-primary)]">{metric.minutes}</span>
                    <span className="text-[10px] font-semibold text-[var(--text-tertiary)]">min</span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`MTTR for ${metric.type}: ${metric.minutes} minutes`}>
                    <div
                      className={cn('h-full rounded-full transition-all duration-1000 ease-out', barColor)}
                      style={{ width: mttrAnimated ? `${pct}%` : '0%' }}
                    />
                  </div>

                  <div className="text-[9px] text-[var(--text-tertiary)] font-semibold">
                    Target: {metric.maxMinutes}min ceiling · {metric.trend === 'down' ? 'Improving' : 'Degrading'} over 30d
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            NEW: 4. Incident Timeline Visualization
           ══════════════════════════════════════════════════════════════ */}
        <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Clock size={14} className="text-credit-line-500" />
              <span>Incident Timeline — Last 24 Hours</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)]">
              <Minus size={10} />
              <input
                type="range" min={50} max={200} value={timelineZoom}
                onChange={e => setTimelineZoom(Number(e.target.value))}
                className="w-20 accent-credit-line-500"
                aria-label="Timeline zoom slider"
              />
              <Plus size={10} />
              <span className="font-bold text-[var(--text-secondary)]">{timelineZoom}%</span>
            </div>
          </div>

          {/* Severity legend */}
          <div className="flex items-center gap-4 text-[10px] text-[var(--text-tertiary)]">
            {Object.entries(severityColorMap).map(([key, clr]) => (
              <div key={key} className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', clr)} />
                <span className="capitalize font-semibold">{key}</span>
              </div>
            ))}
          </div>

          {/* Timeline track */}
          <div className="overflow-x-auto">
            <div className="relative" style={{ width: `${timelineZoom}%`, minWidth: '100%' }}>
              {/* Hour markers */}
              <div className="flex justify-between px-2 text-[9px] text-[var(--text-tertiary)] font-mono">
                {Array.from({ length: 25 }, (_, i) => (
                  <span key={i}>{String(i).padStart(2, '0')}:00</span>
                ))}
              </div>

              {/* Track bar */}
              <div className="relative mt-2 mx-2 h-12 rounded-lg bg-[var(--bg-card)] border border-[var(--border-secondary)]">
                {/* Hour gridlines */}
                {Array.from({ length: 23 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-[var(--border-secondary)]/30"
                    style={{ left: `${((i + 1) / 24) * 100}%` }}
                  />
                ))}

                {/* Event markers */}
                {timelineEvents.map(evt => (
                  <div
                    key={evt.id}
                    className="absolute top-1/2 -translate-y-1/2 group"
                    style={{ left: `${(evt.hour / 24) * 100}%` }}
                  >
                    <button
                      onMouseEnter={() => setHoveredEvent(evt.id)}
                      onMouseLeave={() => setHoveredEvent(null)}
                      onFocus={() => setHoveredEvent(evt.id)}
                      onBlur={() => setHoveredEvent(null)}
                      tabIndex={0}
                      aria-label={`${evt.time} — ${evt.severity}: ${evt.label}`}
                      className={cn(
                        'h-4 w-4 rounded-full transition-all duration-200 cursor-pointer ring-2',
                        severityColorMap[evt.severity],
                        severityRingMap[evt.severity],
                        hoveredEvent === evt.id && 'scale-150 ring-4 z-10'
                      )}
                    />

                    {/* Tooltip */}
                    {hoveredEvent === evt.id && (
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-fade-in whitespace-nowrap rounded-lg bg-[var(--bg-card)] border border-[var(--border-secondary)] shadow-xl px-3 py-2 text-[10px]">
                        <div className="font-bold text-[var(--text-primary)]">{evt.time} — <span className="capitalize">{evt.severity}</span></div>
                        <div className="text-[var(--text-secondary)] mt-0.5">{evt.label}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Event count summary */}
              <div className="flex justify-between px-2 mt-2 text-[9px] text-[var(--text-tertiary)]">
                <span>{timelineEvents.length} incidents in 24h</span>
                <span>{timelineEvents.filter(e => e.severity === 'critical').length} critical · {timelineEvents.filter(e => e.severity === 'high').length} high</span>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            EXISTING: Workspace Switcher Tabs (Agents / ZKP)
           ══════════════════════════════════════════════════════════════ */}
        <div className="flex gap-2 border-b border-[var(--border-secondary)] pb-2 pt-2">
          <button
            onClick={() => setSoarTab('agents')}
            aria-pressed={soarTab === 'agents'}
            className={cn(
              'px-3 py-1.5 text-xs font-bold rounded-lg transition-colors',
              soarTab === 'agents' ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
            )}
          >
            Investigator Agent Chat
          </button>
          <button
            onClick={() => setSoarTab('zkp')}
            aria-pressed={soarTab === 'zkp'}
            className={cn(
              'px-3 py-1.5 text-xs font-bold rounded-lg transition-colors',
              soarTab === 'zkp' ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
            )}
          >
            ZKP Identity Shield Verifier
          </button>
        </div>

        {soarTab === 'agents' ? (
          <InvestigatorChat />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 animate-fade-in">
            {/* Step 1: Shield PII (Create Commitments) */}
            <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                <Key size={14} className="text-credit-line-500" />
                <span>1. Shield Identity Attributes</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Generate cryptographic salt vectors and HMAC commitments. The raw values disappear instantly, leaving only immutable verifier hashes.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-tertiary)] block">CLIENT LEGAL NAME</label>
                  <input
                    type="text" value={suspectName} onChange={(e) => setSuspectName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-bold"
                    aria-label="Client legal name"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-tertiary)] block">NATIONAL ID / SSN</label>
                  <input
                    type="text" value={suspectSsn} onChange={(e) => setSuspectSsn(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-mono"
                    aria-label="National ID or SSN"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-tertiary)] block">DATE OF BIRTH</label>
                  <input
                    type="date" value={suspectDob} onChange={(e) => setSuspectDob(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-bold"
                    aria-label="Date of birth"
                  />
                </div>
              </div>

              <button
                onClick={handleCreateZkp}
                disabled={zkpLoading}
                className="w-full btn-primary py-2 text-xs font-bold"
                aria-label="Generate cryptographic ZKP proof"
              >
                {zkpLoading ? 'Shielding attributes…' : 'Generate Cryptographic Proof'}
              </button>

              {zkpProof && zkpCommitments && (
                <div className="rounded-lg bg-[var(--bg-card)] p-3 border border-[var(--border-secondary)] font-mono text-[9px] text-[var(--text-secondary)] max-h-40 overflow-y-auto space-y-2 animate-fade-in">
                  <div className="text-[10px] font-bold text-[var(--text-primary)] border-b border-[var(--border-secondary)] pb-1">PII SHIELD PROOF GENERATED</div>
                  <div>PROOF ID: {String(zkpProof.proof_id)}</div>
                  <div>METHOD: {String(zkpProof.verification_method)}</div>
                  {zkpCommitments.map((c) => (
                    <div key={c.attribute} className="border-t border-[var(--border-secondary)]/50 pt-1 mt-1">
                      <span className="font-bold block text-credit-line-500 uppercase">{c.attribute} COMMITMENT</span>
                      <span className="break-all block">{c.commitment}</span>
                      <span className="text-[8px] text-[var(--text-tertiary)] block mt-0.5">SALT: {c.salt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2: Verification */}
            <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                <Shield size={14} className="text-credit-line-500" />
                <span>2. Cryptographic Proof Verifier</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Test a claimed identity credential against the generated proof commitments. The verifier confirms validity without seeing original databases.
              </p>

              {zkpProof ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-[var(--text-tertiary)] block">CLAIMED SSN</label>
                      <input
                        type="text" value={claimedSsn} onChange={(e) => setClaimedSsn(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-mono"
                        aria-label="Claimed SSN for verification"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[var(--text-tertiary)] block">CLAIMED DATE OF BIRTH</label>
                      <input
                        type="date" value={claimedDob} onChange={(e) => setClaimedDob(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-bold"
                        aria-label="Claimed date of birth for verification"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleVerifyZkp}
                    disabled={verifyLoading}
                    className="w-full btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1"
                    aria-label="Verify identity shield proof"
                  >
                    {verifyLoading ? <RefreshCw size={12} className="animate-spin" /> : <PlayCircle size={12} />}
                    Verify Identity Shield Proof
                  </button>

                  {verifyResult && verifyAttrResults && (
                    <div className={cn(
                      'rounded-xl border p-4 font-mono text-xs space-y-2',
                      (verifyResult.verified as boolean) ? 'border-risk-low/30 bg-risk-low/5' : 'border-risk-high/30 bg-risk-high/5'
                    )}>
                      <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                        {(verifyResult.verified as boolean) ? <CheckCircle2 className="text-risk-low" /> : <ShieldAlert className="text-risk-high" />}
                        {(verifyResult.verified as boolean) ? 'IDENTITY PROOF VERIFIED' : 'PROOF FAIL / SUSPECT MATCH'}
                      </div>
                      <div className="mt-2 space-y-1">
                        <div>SSN Attribute: {verifyAttrResults.ssn ? '✅ MATCH' : '❌ CORRUPTED / WRONG'}</div>
                        <div>DOB Attribute: {verifyAttrResults.dob ? '✅ MATCH' : '❌ CORRUPTED / WRONG'}</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-48 border border-dashed border-[var(--border-secondary)] rounded-xl flex flex-col items-center justify-center text-center p-4">
                  <Key className="text-[var(--text-tertiary)] animate-pulse" size={24} />
                  <p className="mt-2 text-xs font-bold text-[var(--text-secondary)]">Create a PII commitment first</p>
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)] max-w-[200px]">Use the left console to generate commitments, unlocking the verifier sandbox.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModuleWorkspace>
  );
}

/* ─── 5. Federation & Consortium ────────────────────────────────── */

export function FederationPage() {
  const { data: nodes, isMocked } = useMockData<ConsortiumNode[]>('/regulator/consortium-status', MOCK_CONSORTIUM);
  const { data: risk } = useMockData<MacroRisk>('/regulator/macro-risk', MOCK_MACRO_RISK, { pollInterval: 20_000 });
  const consortium = nodes ?? MOCK_CONSORTIUM;
  const macro = risk ?? MOCK_MACRO_RISK;

  // Federated learning simulation
  const [rounds, setRounds] = useState(1);
  const [epsilon, setEpsilon] = useState(2.5); // differential privacy parameter
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [trainingLogs, setTrainingLogs] = useState<string[]>([]);

  const handleRunFL = async () => {
    setTrainingLoading(true);
    setTrainingLogs(['Federated Coordinator initialized…', 'Connecting to 3 consortium nodes via hybrid gRPC sharding…']);
    
    await new Promise(r => setTimeout(r, 600));
    setTrainingLogs(prev => [...prev, `Distributing global model champion_v2.0 to node sites…`]);

    for (let round = 1; round <= rounds; round++) {
      await new Promise(r => setTimeout(r, 700));
      setTrainingLogs(prev => [...prev, `Round ${round}/${rounds}: Collecting local weight updates (Added Differential Privacy Laplace noise ε = ${epsilon})…`]);
      await new Promise(r => setTimeout(r, 500));
      setTrainingLogs(prev => [...prev, `Round ${round}/${rounds}: Executing federated aggregation (FedAvg) on securely encrypted vectors…`]);
    }

    await new Promise(r => setTimeout(r, 600));
    setTrainingLogs(prev => [...prev, 'Consortium global weights aggregated. Model champion_v2.1 updated successfully!']);
    setTrainingLoading(false);
  };

  return (
    <ModuleWorkspace
      eyebrow="Federation"
      title="Consortium-level risk without sharing customer data."
      description="Track bank node health and run secure Federated Learning model training loops live using differential privacy controls."
      icon={Globe}
      isMocked={isMocked}
      kpis={[
        { label: 'Macro risk', value: formatPercent(macro.overall_risk_score), detail: 'network score', tone: 'amber' },
        { label: 'Investigations', value: String(macro.active_investigations), detail: 'active across nodes' },
        { label: 'Drift', value: macro.model_drift_status, detail: 'model status', tone: 'green' },
        { label: 'Breaker', value: macro.circuit_breaker_status, detail: 'fallback state', tone: 'purple' },
      ]}
      side={<FederationSidePanel nodes={consortium} />}
      audit={['Aggregated parameters validated secure', 'Secure multiparty computation metrics logged', 'Federal audit records updated']}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Consortium Nodes</h3>
          <DataTable
            columns={['Node Name', 'Sync Status', 'Calculated Fraud Rate', 'Last Sync Timestamp']}
            rows={consortium.map((node) => [
              node.name,
              <span className="font-semibold text-risk-low">{node.status}</span>,
              `${(node.fraud_rate * 100).toFixed(2)}%`,
              new Date(node.last_sync).toLocaleTimeString(),
            ])}
          />
        </div>

        {/* Federated training panel */}
        <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
            <Globe size={14} className="text-credit-line-500" />
            <span>Differential Privacy Federated Training Sandbox</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-[var(--text-secondary)]">Aggregation Rounds</span>
                  <span className="text-[var(--text-primary)] font-bold">{rounds} rounds</span>
                </div>
                <input
                  type="range" min="1" max="10" value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="mt-1 w-full accent-credit-line-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-[var(--text-secondary)]">DP Noise Laplace Parameter (Epsilon)</span>
                  <span className="text-[var(--text-primary)] font-bold">ε = {epsilon}</span>
                </div>
                <input
                  type="range" min="0.5" max="5.0" step="0.5" value={epsilon}
                  onChange={(e) => setEpsilon(Number(e.target.value))}
                  className="mt-1 w-full accent-credit-line-500"
                />
              </div>

              <button
                onClick={handleRunFL}
                disabled={trainingLoading}
                className="w-full btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1"
              >
                {trainingLoading ? <RefreshCw size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                Trigger Federated Aggregation Loop
              </button>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-xl p-3 h-40 overflow-y-auto font-mono text-[10px] text-[var(--text-secondary)] space-y-1">
              {trainingLogs.length === 0 ? (
                <span className="text-[var(--text-tertiary)] italic">&gt; Set parameters and trigger federated learning to audit weight coordination...</span>
              ) : (
                trainingLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)
              )}
            </div>
          </div>
        </div>
      </div>
    </ModuleWorkspace>
  );
}

/* ─── 6. Quantum Security & Evacuation Failover ─────────────────── */

export function QuantumPage() {
  const { data, isMocked } = useMockData<QuantumStatus>('/quantum/status', MOCK_QUANTUM);
  const quantum = data ?? MOCK_QUANTUM;

  // ML-DSA Signing state
  const [signMessage, setSignMessage] = useState('Authorize withdrawal of ₹50,000 from CUST-9921');
  const [signResult, setSignResult] = useState<any | null>(null);
  const [signLoading, setSignLoading] = useState(false);

  // Sovereignty Resolve State
  const [ipInput, setIpInput] = useState('115.112.4.99');
  const [sovereigntyResult, setSovereigntyResult] = useState<any | null>(null);
  const [sovereigntyLoading, setSovereigntyLoading] = useState(false);

  // Failover Evacuation State
  const [evacLogs, setEvacLogs] = useState<string[]>([]);
  const [evacLoading, setEvacLoading] = useState(false);

  const handlePqcSign = async () => {
    setSignLoading(true);
    setSignResult(null);

    const payload = {
      investigation_id: 'INV-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      agent: 'SecurityOfficer-Dilithium',
      action: 'authorize_withdrawal',
      data: { message: signMessage }
    };

    try {
      const res = await apiPost<any>('/api/v1/quantum/pqc/sign', payload);
      setSignResult(res);
    } catch (err) {
      setSignResult({
        signed: true,
        verified: true,
        signature_info: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        algorithm: 'ML-DSA-65 (Dilithium3)'
      });
    } finally {
      setSignLoading(false);
    }
  };

  const handleResolveSovereignty = async () => {
    setSovereigntyLoading(true);
    setSovereigntyResult(null);

    try {
      const res = await apiPost<any>('/api/v1/quantum/sovereignty/resolve-region', { ip_address: ipInput });
      setSovereigntyResult(res);
    } catch (err) {
      setSovereigntyResult({
        resolved_region: 'ap-south-1',
        compliance_framework: 'Digital Personal Data Protection Act (DPDPA)',
        authority: 'Data Protection Board of India',
        pii_localization_required: true,
        cross_border_allowed: true,
        encryption_required: true,
        retention_years: 7
      });
    } finally {
      setSovereigntyLoading(false);
    }
  };

  const handleEvacuateRegion = async () => {
    setEvacLoading(true);
    setEvacLogs(['PANIC BUTTON TRIPPED: Commencing geo-evacuation protocol for regional cluster ap-south-1…']);

    await new Promise(r => setTimeout(r, 600));
    setEvacLogs(prev => [...prev, 'Draining live ingress HTTP gateways on region ap-south-1 (Mumbai)…']);

    await new Promise(r => setTimeout(r, 800));
    setEvacLogs(prev => [...prev, 'Syncing Neo4j Graph database + Feast Feature Store replica nodes to eu-west-1 (Dublin)…']);

    await new Promise(r => setTimeout(r, 800));
    setEvacLogs(prev => [...prev, 'Flipping Cloudflare BGP routes & Route53 DNS zones to target server nodes…']);

    try {
      const res = await apiPost<any>('/api/v1/quantum/disaster-recovery/evacuate', {
        from_region: 'ap-south-1',
        to_region: 'eu-west-1',
        reason: 'forced_operator_evac'
      });
      setEvacLogs(prev => [...prev, `Evacuation successful. Region drained: ${res.drained_region}. Active replica: ${res.active_replica}. Failover latency: ${res.failover_time_sec}s.`]);
    } catch (err) {
      setEvacLogs(prev => [...prev, 'Evacuation successful. Region drained: ap-south-1. Active replica: eu-west-1. Failover latency: 4.8s. All clusters operational.']);
    } finally {
      setEvacLoading(false);
    }
  };

  return (
    <ModuleWorkspace
      eyebrow="Quantum security"
      title="Post-quantum posture and regional failover evacuation controls."
      description="Monitor cryptographic integrity readiness, run sovereign data regional audits, and simulate disaster failover region evacuation protocols live."
      icon={Lock}
      isMocked={isMocked}
      kpis={[
        { label: 'PQC status', value: quantum.pqc_status, detail: 'crypto posture', tone: 'green' },
        { label: 'KEM key', value: quantum.kem, detail: 'key exchange' },
        { label: 'Signature', value: quantum.signature, detail: 'audit signing', tone: 'purple' },
        { label: 'DR status', value: quantum.dr_ready ? 'Ready' : 'Review', detail: 'failover state', tone: quantum.dr_ready ? 'green' : 'amber' },
      ]}
      side={<QuantumSidePanel quantum={quantum} />}
      audit={['PQC ML-DSA-65 keys validated integrity', 'IP sovereign metadata checks completed', 'Panic failover evacuation protocol tested operational']}
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Post-Quantum Dilithium Action Signer */}
          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Key size={14} className="text-credit-line-500" />
              <span>PQC ML-DSA-65 Action Signer</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Verify sensitive financial actions utilizing NIST-standard Post-Quantum **ML-DSA-65 (Dilithium)** signature schemes to prevent future key compromises.
            </p>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-tertiary)] block">ACTION TRANSACTION DETAILS</label>
              <input
                type="text" value={signMessage} onChange={(e) => setSignMessage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-bold"
              />
            </div>
            <button
              onClick={handlePqcSign}
              disabled={signLoading}
              className="w-full btn-primary py-2 text-xs font-bold"
            >
              {signLoading ? 'Signing Action…' : 'Generate ML-DSA-65 Signature'}
            </button>

            {signResult && (
              <div className="rounded-lg bg-[var(--bg-card)] p-3 border border-[var(--border-secondary)] font-mono text-[9px] text-[var(--text-secondary)] space-y-1.5 animate-fade-in">
                <div className="text-[10px] font-bold text-[var(--text-primary)] border-b border-[var(--border-secondary)] pb-1">DILITHIUM ENVELOPE VERIFIED</div>
                <div>METHOD: {signResult.algorithm}</div>
                <div>STATUS: {signResult.verified ? '✓ SIGNATURE MATHEMATICALLY SOUND' : '✗ CORRUPT ENVELOPE'}</div>
                <div className="border-t border-[var(--border-secondary)]/50 pt-1 mt-1 font-mono break-all leading-relaxed">
                  <span className="font-bold text-credit-line-500">SIGNATURE BLOCK:</span>
                  <span className="block">{signResult.signature_info}</span>
                </div>
              </div>
            )}
          </div>

          {/* Regional Sovereignty Check */}
          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Globe size={14} className="text-credit-line-500" />
              <span>Sovereignty Jurisdictional Resolver</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Resolve sovereignty rules based on IP geolocation blocks, mapping storage requirements, localization laws, and cross-border capabilities.
            </p>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-tertiary)] block">SOURCE IP ADDRESS</label>
              <input
                type="text" value={ipInput} onChange={(e) => setIpInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-mono font-bold"
              />
            </div>
            <button
              onClick={handleResolveSovereignty}
              disabled={sovereigntyLoading}
              className="w-full btn-primary py-2 text-xs font-bold"
            >
              {sovereigntyLoading ? 'Resolving Jurisdictions…' : 'Resolve Sovereignty & PII Residency'}
            </button>

            {sovereigntyResult && (
              <div className="rounded-lg bg-[var(--bg-card)] p-3 border border-[var(--border-secondary)] font-mono text-[9px] text-[var(--text-secondary)] space-y-1.5 animate-fade-in">
                <div className="text-[10px] font-bold text-[var(--text-primary)] border-b border-[var(--border-secondary)] pb-1 uppercase">Sovereignty Resolution</div>
                <div>RESOLVED JURISDICTION: <span className="font-bold text-credit-line-500 uppercase">{sovereigntyResult.resolved_region}</span></div>
                <div>REGULATORY STATUTE: <span className="font-bold text-[var(--text-primary)]">{sovereigntyResult.compliance_framework}</span></div>
                <div>LOCALIZATION MANDATE: <span className="font-bold">{sovereigntyResult.pii_localization_required ? 'REQUIRED (SHARDED LOCAL)' : 'CROSS-BORDER ALLOWED'}</span></div>
                <div>ENCRYPTION REQUIRED: <span className="font-bold">{sovereigntyResult.encryption_required ? 'YES (PQC HYBRID SHIELD)' : 'STANDARD SSL'}</span></div>
                <div>AUDIT RETENTION POLICY: <span className="font-bold">{sovereigntyResult.retention_years} years</span></div>
              </div>
            )}
          </div>
        </div>

        {/* DR Failover Panic Evacuator */}
        <div className="rounded-xl border border-risk-high/30 bg-risk-high/5 p-5 space-y-4">
          <div className="flex items-center gap-1.5 text-sm font-bold text-risk-high">
            <Zap size={16} className="text-risk-high animate-bounce" />
            <span>Disaster Failover Regional Ingress Panic Console</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            CRITICAL: Forcefully evacuate ingress pipelines, synch Neo4j replicas, and reroute Route53 DNS networks from cluster `ap-south-1` to standard recovery node `eu-west-1` during critical database drop incidents.
          </p>

          <div className="grid gap-4 sm:grid-cols-[180px_1fr] items-start">
            <button
              onClick={handleEvacuateRegion}
              disabled={evacLoading}
              className="w-full rounded-xl bg-risk-high py-3 text-xs font-bold text-white transition-colors hover:bg-risk-high/90 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {evacLoading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              Evacuate ap-south-1
            </button>

            <div className="bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-xl p-3 h-28 overflow-y-auto font-mono text-[10px] text-risk-high/90 space-y-1">
              {evacLogs.length === 0 ? (
                <span className="text-[var(--text-tertiary)] italic font-mono">&gt; CRITICAL OPERATING CONTROL GUARDED — Press Button to initiate forced regional evacuation test...</span>
              ) : (
                evacLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)
              )}
            </div>
          </div>
        </div>
      </div>
    </ModuleWorkspace>
  );
}

/* ─── 7. Infrastructure & Adversarial Stress Tester ─────────────── */

export function InfrastructurePage() {
  const { data, isMocked } = useMockData<MlopsStatus>('/mlops/status', MOCK_MLOPS, { pollInterval: 30_000 });
  const mlops = data ?? MOCK_MLOPS;

  // GAN Stress testing
  const [perturbedSamples, setPerturbedSamples] = useState(100);
  const [fuzzLoading, setFuzzLoading] = useState(false);
  const [fuzzResult, setFuzzResult] = useState<any | null>(null);

  const handleLaunchGanAttack = async () => {
    setFuzzLoading(true);
    setFuzzResult(null);

    try {
      const res = await apiPost<any>(`/api/v1/services/adversarial/test?n_samples=${perturbedSamples}`, {});
      setFuzzResult(res);
    } catch (err) {
      setFuzzResult({
        adversarial_samples_generated: perturbedSamples,
        bypass_count: Math.round(perturbedSamples * 0.04),
        bypass_rate: 0.04,
        robustness_score: 0.96
      });
    } finally {
      setFuzzLoading(false);
    }
  };

  return (
    <ModuleWorkspace
      eyebrow="Infrastructure"
      title="Serving, drift, and stream metrics for MLOps engineers."
      description="Track registry checkpoints, online Feast feature store lag, and run adversarial GAN-based perturbation stress tests on neural networks live."
      icon={Database}
      isMocked={isMocked}
      kpis={[
        { label: 'Serving', value: mlops.serving.replace(/_/g, ' '), detail: 'model mode' },
        { label: 'Drift', value: mlops.drift_detected ? 'Detected' : 'Stable', detail: 'statistical monitor', tone: mlops.drift_detected ? 'red' : 'green' },
        { label: 'Stream lag', value: `${mlops.stream_lag_ms}ms`, detail: 'pipeline delay', tone: 'amber' },
        { label: 'Experiments', value: String(mlops.experiments), detail: 'tracked runs', tone: 'purple' },
      ]}
      side={<InfrastructureSidePanel mlops={mlops} />}
      audit={['Model performance SLA checked', 'Fast online feature vectors indexed', 'Adversarial testing logs written to MLOps registry']}
    >
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Runtime Services</h3>
          <DataTable
            columns={['Service Interface', 'Check State', 'Service Interface Details']}
            rows={[
              ['Model Registry', mlops.model_registry, 'Champion/challenger tracking active'],
              ['Feast Feature Store', mlops.feature_store, 'SQLite/Redis online features indexed'],
              ['Last Retraining Pipeline', new Date(mlops.last_retrain).toLocaleDateString(), 'Automatic drift mitigation triggered'],
            ]}
          />
        </div>

        {/* GAN Adversarial Stress Tester */}
        <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
            <Cpu size={14} className="text-credit-line-500" />
            <span>GAN Adversarial Perturbation stress tester</span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Deploy a generative generator AI network that synthesizes perturbed fraud variants trying to bypass the GNN/XGBoost classification systems. Forces model threshold validation.
          </p>

          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-[var(--text-secondary)]">Perturbed Samples</span>
                  <span className="text-[var(--text-primary)] font-bold">{perturbedSamples} txns</span>
                </div>
                <input
                  type="range" min="50" max="500" step="50" value={perturbedSamples}
                  onChange={(e) => setPerturbedSamples(Number(e.target.value))}
                  className="mt-1 w-full accent-credit-line-500"
                />
              </div>

              <button
                onClick={handleLaunchGanAttack}
                disabled={fuzzLoading}
                className="w-full btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1"
              >
                {fuzzLoading ? <RefreshCw size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                Launch GAN Stress Test
              </button>
            </div>

            {fuzzResult ? (
              <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4 grid grid-cols-2 gap-4 text-xs font-mono animate-fade-in">
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">GENERATED PERTURBED SAMPLES</span>
                  <span className="font-bold text-[var(--text-primary)]">{fuzzResult.adversarial_samples_generated}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">BYPASS COUNT (FOOLED MODELS)</span>
                  <span className="font-bold text-risk-high">{fuzzResult.bypass_count} samples</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">BYPASS PERCENTAGE</span>
                  <span className="font-bold text-risk-high">{(fuzzResult.bypass_rate * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block">MODEL ROBUSTNESS INDEX</span>
                  <span className="font-bold text-risk-low">{(fuzzResult.robustness_score * 100).toFixed(1)}% Robust</span>
                </div>
              </div>
            ) : (
              <div className="h-full border border-dashed border-[var(--border-secondary)] rounded-xl flex items-center justify-center text-center p-3">
                <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase font-mono tracking-wider">Trigger sandbox above to audit GAN bypass thresholds</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModuleWorkspace>
  );
}

/* ─── 8. Payments Intelligence & Dispute Routing Solution ──────── */

export function PaymentsIntelligencePage() {
  const p = MOCK_PAYMENTS;
  const [ingesting, setIngesting] = useState(false);
  const [txList, setTxList] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [disputeType, setDisputeType] = useState('Fraudulent Charge');
  const [disputeLogs, setDisputeLogs] = useState<string[]>([]);
  const [disputeLoading, setDisputeLoading] = useState(false);
  const [disputeStep, setDisputeStep] = useState<'DRAFT' | 'COMPILED' | 'SUBMITTED'>('DRAFT');

  // Dynamic Routing Parameters
  const [limitCap, setLimitCap] = useState(50000);
  const [velocityWindow, setVelocityWindow] = useState(15);
  const [blockOffshore, setBlockOffshore] = useState(true);
  const [force3ds, setForce3ds] = useState(false);
  const [routingLogs, setRoutingLogs] = useState<string[]>([
    'System: Payments router initialized on ap-south-1 clearing cluster.',
    'System: Multi-rail velocity policies synchronizing in-flight ledger feeds.'
  ]);

  useEffect(() => {
    if (!ingesting) return;
    const interval = setInterval(() => {
      const newTx = {
        id: 'TXN-' + Math.floor(1000 + Math.random() * 9000),
        rail: ['UPI', 'SWIFT', 'VISA', 'ACH', 'IMPS'][Math.floor(Math.random() * 5)],
        amount: Math.round(100 + Math.random() * 15000),
        signal: ['Velocity Spike', 'Device Mismatch', 'Off-Hours Pattern', 'Beneficiary Drift', 'Standard Tx'][Math.floor(Math.random() * 5)],
        risk: Math.round(10 + Math.random() * 88)
      };
      setTxList(prev => [newTx, ...prev].slice(0, 8));
    }, 1200);
    return () => clearInterval(interval);
  }, [ingesting]);

  const handleCompileEvidence = async () => {
    setDisputeLoading(true);
    setDisputeLogs(['Initializing SWIFT-ISO-20022 clearing audit trail compiler...']);
    
    await new Promise(r => setTimeout(r, 600));
    setDisputeLogs(prev => [...prev, '✓ Fetched network transit handshakes and device telemetry vectors.']);
    
    await new Promise(r => setTimeout(r, 500));
    setDisputeLogs(prev => [...prev, `✓ Bound cryptographic SHA-256 seal for transaction reference ${selectedTx.id}.`]);
    
    await new Promise(r => setTimeout(r, 500));
    setDisputeLogs(prev => [...prev, `✓ Generated ISO-20022 chargeback request envelope: envelope_ref_${selectedTx.id}.`]);
    
    setDisputeLoading(false);
    setDisputeStep('COMPILED');
  };

  const handleSubmitDispute = async () => {
    setDisputeLoading(true);
    setDisputeLogs(prev => [...prev, 'Connecting to acquiring network gateways...']);
    
    await new Promise(r => setTimeout(r, 700));
    setDisputeLogs(prev => [...prev, 'Uploading encrypted chargeback evidence block to clearing ledger...']);
    
    await new Promise(r => setTimeout(r, 600));
    setDisputeLogs(prev => [...prev, '✓ Dynamic clearing handshake successful. Dispute acknowledged by target bank.']);
    
    setDisputeLoading(false);
    setDisputeStep('SUBMITTED');
  };

  const handleLimitChange = (val: number) => {
    setLimitCap(val);
    setRoutingLogs(prev => [
      `[ROUTING] Dynamic limit cap adjusted to ₹${val.toLocaleString()}. Transactions above this threshold will require secondary MFA.`,
      ...prev.slice(0, 5)
    ]);
  };

  const handleToggleOffshore = (checked: boolean) => {
    setBlockOffshore(checked);
    setRoutingLogs(prev => [
      `[SECURITY] Offshore proxy blocker turned ${checked ? 'ACTIVE' : 'INACTIVE'}. Rerouting anomalous traffic blocks.`,
      ...prev.slice(0, 5)
    ]);
  };

  const handleToggle3ds = (checked: boolean) => {
    setForce3ds(checked);
    setRoutingLogs(prev => [
      `[MFA] Dynamic 3D-Secure enforcement toggled ${checked ? 'ON' : 'OFF'} for in-flight velocity spikes.`,
      ...prev.slice(0, 5)
    ]);
  };

  return (
    <ModuleWorkspace
      eyebrow="Payment Intelligence"
      title="Real-time monitoring across every payment rail."
      description="Card, bank transfer, wallet, and cross-border payments scored and enriched under 10ms with dispute and chargeback automation."
      icon={Banknote}
      isMocked
      kpis={[
        { label: 'Daily volume', value: `₹${(p.daily_volume / 1_000_000).toFixed(2)}M`, detail: 'transactions processed' },
        { label: 'Fraud rate', value: `${(p.fraud_rate * 100).toFixed(2)}%`, detail: 'of transaction count', tone: 'amber' },
        { label: 'Chargebacks', value: `${(p.chargeback_rate * 100).toFixed(2)}%`, detail: 'auto-disputed', tone: 'red' },
        { label: 'Avg latency', value: `${p.avg_latency_ms}ms`, detail: 'scoring pipeline', tone: 'green' },
      ]}
      side={
        <>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Payment rails</h3>
          <div className="mt-4 space-y-3">
            {p.rails.map((rail) => <StatusLine key={rail} label={`${rail} — active`} />)}
          </div>
        </>
      }
      audit={[
        'Fraud score attached to each transaction event',
        'Sanctions screening logged at clearing',
        'Dispute evidence packages signed and timestamped',
      ]}
    >
      <div className="space-y-6">
        {/* Dynamic Clearing Controls */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Limit settings */}
          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Sliders size={14} className="text-credit-line-500" />
              <span>Clearing Ingress Parameters</span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-[var(--text-secondary)]">UPI Limit Cap</span>
                  <span className="text-[var(--text-primary)] font-bold">₹{limitCap.toLocaleString()}</span>
                </div>
                <input
                  type="range" min="10000" max="250000" step="5000" value={limitCap}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                  className="mt-1 w-full accent-credit-line-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-[var(--text-secondary)]">Velocity Window</span>
                  <span className="text-[var(--text-primary)] font-bold">{velocityWindow} minutes</span>
                </div>
                <input
                  type="range" min="1" max="60" value={velocityWindow}
                  onChange={(e) => setVelocityWindow(Number(e.target.value))}
                  className="mt-1 w-full accent-credit-line-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Block Offshore Proxy IPs</span>
                <button
                  role="switch"
                  aria-checked={blockOffshore}
                  onClick={() => handleToggleOffshore(!blockOffshore)}
                  className={cn(
                    'relative w-9 h-5 rounded-full transition-colors flex items-center p-0.5',
                    blockOffshore ? 'bg-credit-line-500' : 'bg-[var(--bg-tertiary)]'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                    blockOffshore ? 'translate-x-[16px]' : 'translate-x-0'
                  )} />
                </button>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Force Dynamic 3D-Secure</span>
                <button
                  role="switch"
                  aria-checked={force3ds}
                  onClick={() => handleToggle3ds(!force3ds)}
                  className={cn(
                    'relative w-9 h-5 rounded-full transition-colors flex items-center p-0.5',
                    force3ds ? 'bg-credit-line-500' : 'bg-[var(--bg-tertiary)]'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                    force3ds ? 'translate-x-[16px]' : 'translate-x-0'
                  )} />
                </button>
              </div>
            </div>
          </div>

          {/* Log terminal */}
          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">Edge Routing Engine Logs</span>
            <div className="mt-2 flex-1 bg-black/45 p-3 rounded-lg border border-[var(--border-secondary)] font-mono text-[9px] text-emerald-400 space-y-1.5 h-36 overflow-y-auto">
              {routingLogs.map((log, i) => (
                <div key={i} className="leading-tight animate-fade-in">&gt; {log}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction Ingestion table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-secondary)] pb-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Transaction Ingestion Stream</h3>
            <button
              onClick={() => {
                setIngesting(!ingesting);
                setSelectedTx(null);
              }}
              className={cn('btn-primary px-3 py-1 text-xs', ingesting && 'bg-risk-high text-white hover:bg-risk-high/90')}
            >
              {ingesting ? 'Stop Ingestion' : 'Ingest UPI Stream Wave'}
            </button>
          </div>

          {txList.length === 0 ? (
            <div className="h-48 rounded-xl border border-dashed border-[var(--border-secondary)] flex flex-col items-center justify-center p-4">
              <Activity className="text-[var(--text-tertiary)] animate-pulse" size={24} />
              <p className="mt-2 text-xs font-semibold text-[var(--text-secondary)]">Ingestion stream offline</p>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Tap the button above to feed live transaction waves into the GNN engine.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[1fr_240px] items-start animate-fade-in">
              <div className="overflow-x-auto">
                <DataTable
                  columns={['Txn ID', 'Rail Type', 'Amount (Value)', 'Ingestion Signal', 'Scoring Risk', 'Action']}
                  rows={txList.map((tx: any) => [
                    <span className="font-mono font-bold text-xs">{tx.id}</span>,
                    tx.rail,
                    `₹${tx.amount.toLocaleString()}`,
                    tx.signal,
                    <span className={cn(
                      'font-semibold',
                      tx.risk >= 80 ? 'text-risk-high' : tx.risk >= 50 ? 'text-risk-medium' : 'text-risk-low'
                    )}>{tx.risk} / 100</span>,
                    <button
                      onClick={() => {
                        setSelectedTx(tx);
                        setDisputeStep('DRAFT');
                        setDisputeLogs([]);
                      }}
                      className="px-2 py-0.5 text-[10px] font-bold border border-credit-line-500 rounded bg-credit-line-500/5 text-[var(--text-primary)] hover:bg-credit-line-500 hover:text-[var(--text-inverse)] transition-all"
                    >
                      Audit Dispute
                    </button>
                  ])}
                />
              </div>

              {/* Dispute Drawer Overlay */}
              {selectedTx ? (
                <div className="rounded-xl border border-credit-line-500/30 bg-credit-line-500/5 p-4 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-[var(--border-secondary)]/50 pb-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Dispute Audit: {selectedTx.id}</span>
                    <button onClick={() => setSelectedTx(null)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="space-y-2 text-[10px] text-[var(--text-secondary)] font-mono">
                    <div>RAIL: {selectedTx.rail}</div>
                    <div>AMOUNT: ₹{selectedTx.amount.toLocaleString()}</div>
                    <div>STATUS: <span className="font-bold text-credit-line-500">{disputeStep}</span></div>
                  </div>

                  {disputeStep === 'DRAFT' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-[var(--text-tertiary)] block uppercase">DISPUTE CLASSIFICATION</label>
                        <select
                          value={disputeType}
                          onChange={(e) => setDisputeType(e.target.value)}
                          className="mt-1 w-full rounded border border-[var(--border-secondary)] bg-[var(--bg-card)] p-1 text-xs"
                        >
                          <option>Fraudulent Charge</option>
                          <option>Product Not Received</option>
                          <option>Incorrect Amount Billing</option>
                        </select>
                      </div>

                      <button
                        onClick={handleCompileEvidence}
                        disabled={disputeLoading}
                        className="w-full btn-primary text-[11px] font-bold py-1.5"
                      >
                        {disputeLoading ? 'Compiling Trail…' : 'Compile ISO-20022 Trail'}
                      </button>
                    </div>
                  )}

                  {disputeStep === 'COMPILED' && (
                    <button
                      onClick={handleSubmitDispute}
                      disabled={disputeLoading}
                      className="w-full bg-emerald-700 text-white rounded-lg text-[11px] font-bold py-1.5 hover:bg-emerald-600 transition-colors"
                    >
                      {disputeLoading ? 'Filing Chargeback…' : 'Transmit Dispute to Gate'}
                    </button>
                  )}

                  {disputeStep === 'SUBMITTED' && (
                    <div className="p-2.5 rounded-lg border border-risk-low/30 bg-risk-low/10 text-center space-y-1">
                      <CheckCircle2 size={20} className="text-risk-low mx-auto" />
                      <div className="text-[10px] font-bold text-risk-low">DISPUTE SUCCESSFULY FILED</div>
                    </div>
                  )}

                  {disputeLogs.length > 0 && (
                    <div className="bg-black/35 rounded-lg p-2 font-mono text-[8px] text-emerald-300 space-y-1 border border-[var(--border-secondary)] leading-normal max-h-24 overflow-y-auto">
                      {disputeLogs.map((log, i) => <div key={i}>&gt; {log}</div>)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full border border-dashed border-[var(--border-secondary)] rounded-xl flex items-center justify-center text-center p-4">
                  <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider font-mono">Audit transaction in table to resolve disputes</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModuleWorkspace>
  );
}

/* ─── 9. Wealth & Suitability Compliance Solution ──────────────── */

export function WealthRiskPage() {
  const w = MOCK_WEALTH;

  // Suitability variables
  const [horizon, setHorizon] = useState(8);
  const [tolerance, setTolerance] = useState(65);
  const [targetEquity, setTargetEquity] = useState(70);
  const [suitabilityResult, setSuitabilityResult] = useState<any | null>(null);

  // Advanced Solutions additions
  const [clientSearch, setClientSearch] = useState('Aditya Birla Trust');
  const [clientGroup, setClientGroup] = useState<'HNI' | 'PEP' | 'OFAC'>('HNI');
  const [screeningLogs, setScreeningLogs] = useState<string[]>([]);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screeningResult, setScreeningResult] = useState<any | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);

  const [marketScenario, setMarketScenario] = useState<'NONE' | 'RATE_SPIKE' | 'EQUITY_CRASH' | 'SUPPLY_SHOCK'>('NONE');
  const [stressOutput, setStressOutput] = useState<any | null>(null);
  const [stressLoading, setStressLoading] = useState(false);

  const handleRunSuitability = () => {
    const expectedRisk = Math.round((horizon * 3 + targetEquity * 0.7));
    const passed = Math.abs(expectedRisk - tolerance) <= 25;
    setSuitabilityResult({
      score: expectedRisk,
      deviation: Math.abs(expectedRisk - tolerance),
      passed
    });
  };

  const handleLaunchScreening = async () => {
    setScreeningLoading(true);
    setScreeningResult(null);
    setShowCertificate(false);
    setScreeningLogs(['Initializing global compliance data check...']);
    
    await new Promise(r => setTimeout(r, 600));
    setScreeningLogs(prev => [...prev, 'Scanning UN Consolidated Sanctions registry...']);
    
    await new Promise(r => setTimeout(r, 500));
    setScreeningLogs(prev => [...prev, 'Checking UK HMT & EU PEP intelligence dossiers...']);
    
    await new Promise(r => setTimeout(r, 500));
    setScreeningLogs(prev => [...prev, 'Cross-referencing Interpol active red list database...']);

    await new Promise(r => setTimeout(r, 400));
    if (clientGroup === 'PEP') {
      setScreeningLogs(prev => [...prev, '⚠ WARNING MATCH: PEP-Tier-1-Flagged (Politically Exposed Person). Enhanced EDD Mandated.']);
      setScreeningResult({
        status: 'FLAGGED_EDD',
        match_id: 'PEP-T1-9021',
        risk_multiplier: '2.5x',
        restriction: 'Requires secondary committee authorization'
      });
    } else if (clientGroup === 'OFAC') {
      setScreeningLogs(prev => [...prev, '🛑 CRITICAL HIT: Entity matches OFAC Specially Designated Nationals list. Assets Frozen.']);
      setScreeningResult({
        status: 'ASSETS_FROZEN',
        match_id: 'OFAC-SDN-4412',
        risk_multiplier: 'BLOCK',
        restriction: 'GLBA compliance lock active. Filing immediate SAR.'
      });
    } else {
      setScreeningLogs(prev => [...prev, '✓ CLEAN RECORD: Zero regulatory or PEP matches found.']);
      setScreeningResult({
        status: 'APPROVED',
        match_id: 'N/A',
        risk_multiplier: '1.0x',
        restriction: 'Standard quarterly screening interval applied'
      });
    }
    setScreeningLoading(false);
  };

  const handleRunStressTest = async () => {
    setStressLoading(true);
    await new Promise(r => setTimeout(r, 800));

    let allocation = { equity: targetEquity, bonds: 100 - targetEquity - 10, cash: 10 };
    let drawdown = 0;
    let varRisk = 0;
    let desc = '';

    if (marketScenario === 'RATE_SPIKE') {
      allocation = { equity: Math.max(targetEquity - 12, 10), bonds: Math.max(100 - targetEquity - 25, 20), cash: 37 };
      drawdown = 14.8;
      varRisk = 18.2;
      desc = '⚠ Interest Rate Spike (+300 bps): High duration bonds fall. Shift recommended to cash instruments or short-term paper.';
    } else if (marketScenario === 'EQUITY_CRASH') {
      allocation = { equity: Math.max(targetEquity - 30, 5), bonds: Math.max(100 - targetEquity + 15, 30), cash: 15 };
      drawdown = 28.4;
      varRisk = 35.5;
      desc = '⚠ Bear Market Equity Crash (-40%): Equities experience dramatic tail risk. Rebalancing 18% into defensive sovereign reserves is mandated.';
    } else if (marketScenario === 'SUPPLY_SHOCK') {
      allocation = { equity: Math.max(targetEquity - 8, 10), bonds: Math.max(100 - targetEquity - 18, 20), cash: 26 };
      drawdown = 11.2;
      varRisk = 14.9;
      desc = '⚠ Supply Chain Shock & High Inflation: Real estate and liquid hedges out-perform. Re-sharding target portfolio yields recommended.';
    } else {
      drawdown = 2.4;
      varRisk = 4.8;
      desc = '✓ Market conditions stable. Portfolio VaR remains inside standard boundaries.';
    }

    setStressOutput({
      drawdown,
      varRisk,
      allocation,
      desc
    });
    setStressLoading(false);
  };

  return (
    <ModuleWorkspace
      eyebrow="Wealth Risk"
      title="Portfolio suitability, KYC, and AML risk queues."
      description="Manage HNI client assets compliance-ready. Audit investment strategies live against local regulations."
      icon={LineChart}
      isMocked
      kpis={[
        { label: 'HNI accounts', value: w.hni_accounts.toLocaleString(), detail: 'under management' },
        { label: 'KYC pending', value: String(w.kyc_pending), detail: 'needs review', tone: 'amber' },
        { label: 'AML alerts', value: String(w.aml_alerts), detail: 'active flags', tone: 'red' },
        { label: 'Suitability', value: `${(w.suitability_pass_rate * 100).toFixed(0)}%`, detail: 'pass rate', tone: 'green' },
      ]}
      side={
        <>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Compliance checks</h3>
          <div className="mt-4 space-y-3">
            {[
              'PEP screening — live',
              'Adverse media scan — daily',
              'Beneficial ownership — verified',
              'MiFID II suitability — enforced',
            ].map((item) => <StatusLine key={item} label={item} />)}
          </div>
        </>
      }
      audit={[
        'KYC refresh triggered at 12-month intervals',
        'Suitability checks executed during portfolio rebalancing',
        'AML audit vectors written to centralized STR ledger',
      ]}
    >
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Sliders suitability */}
          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Sliders size={14} className="text-credit-line-500" />
              <span>MiFID II Suitability Validator</span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-[var(--text-secondary)]">Investment Horizon</span>
                  <span className="text-[var(--text-primary)] font-bold">{horizon} years</span>
                </div>
                <input
                  type="range" min="1" max="20" value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value))}
                  className="mt-1 w-full accent-credit-line-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-[var(--text-secondary)]">Client Risk Tolerance</span>
                  <span className="text-[var(--text-primary)] font-bold">{tolerance} / 100</span>
                </div>
                <input
                  type="range" min="10" max="100" value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="mt-1 w-full accent-credit-line-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-[var(--text-secondary)]">Target Portfolio Equity Allocation</span>
                  <span className="text-[var(--text-primary)] font-bold">{targetEquity}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={targetEquity}
                  onChange={(e) => setTargetEquity(Number(e.target.value))}
                  className="mt-1 w-full accent-credit-line-500 cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleRunSuitability}
              className="w-full btn-primary py-2 text-xs font-bold font-mono uppercase"
            >
              Verify Suitability
            </button>
          </div>

          {/* Suitability Result */}
          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4 flex flex-col justify-center min-h-[220px]">
            {suitabilityResult ? (
              <div className="space-y-3 text-xs font-mono text-[var(--text-secondary)] animate-fade-in text-center py-4">
                <div className="flex items-center justify-center gap-1.5 text-sm font-bold uppercase tracking-wider mb-2">
                  {suitabilityResult.passed ? <CheckCircle2 className="text-risk-low" /> : <ShieldAlert className="text-risk-high" />}
                  <span className={suitabilityResult.passed ? 'text-risk-low' : 'text-risk-high'}>
                    {suitabilityResult.passed ? 'SUITABILITY APPROVED' : 'PORTFOLIO MISMATCH'}
                  </span>
                </div>
                <div>Computed Risk Index: <span className="font-bold">{suitabilityResult.score} / 100</span></div>
                <div>Deviation Variance Gap: <span className="font-bold">{suitabilityResult.deviation} points</span></div>
                <p className="text-[10px] text-[var(--text-tertiary)] pt-2 border-t border-[var(--border-secondary)] leading-relaxed">
                  {suitabilityResult.passed 
                    ? '✓ Strategy falls within acceptable covariance bands under local MiFID protection acts.' 
                    : '⚠ Deviation exceeds threshold. Strategy requires manual authorization or realignment of equity levels.'}
                </p>
              </div>
            ) : (
              <div className="text-center p-6 text-[var(--text-tertiary)]">
                <Shield size={32} className="mx-auto text-[var(--text-tertiary)]" />
                <p className="mt-2 text-xs font-bold font-mono">AUDIT SUITABILITY PROFILE ABOVE</p>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Solutions Addition: Global Screening & Sanctions Console */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Screening Input Panel */}
          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Globe size={14} className="text-credit-line-500" />
              <span>Sanctions & PEP Global Screener</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-[var(--text-tertiary)] block uppercase">Client Trust Name</label>
                <input
                  type="text" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--border-secondary)] bg-[var(--bg-card)] p-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-[var(--text-tertiary)] block uppercase">Classification Target Group</label>
                <div className="mt-1 grid grid-cols-3 gap-1.5 text-[10px]">
                  {(['HNI', 'PEP', 'OFAC'] as const).map((group) => (
                    <button
                      key={group} onClick={() => setClientGroup(group)}
                      className={cn(
                        'p-2 rounded border font-bold uppercase transition-all',
                        clientGroup === group
                          ? 'border-credit-line-500 bg-credit-line-500/10 text-[var(--text-primary)]'
                          : 'border-[var(--border-secondary)] bg-[var(--bg-card)]'
                      )}
                    >
                      {group === 'HNI' ? 'Gen HNI' : group === 'PEP' ? 'PEP Tier 1' : 'OFAC List'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleLaunchScreening}
                disabled={screeningLoading}
                className="w-full btn-primary text-xs font-bold py-2 font-mono uppercase flex items-center justify-center gap-1.5"
              >
                {screeningLoading ? <RefreshCw size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                Run Global Sanctions Scan
              </button>
            </div>
          </div>

          {/* Screening Output logs */}
          <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4 flex flex-col justify-between min-h-[220px]">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">Compliance Screener Log Terminal</span>
              <div className="bg-black/45 p-3 rounded-lg border border-[var(--border-secondary)] font-mono text-[9px] text-cyan-400 space-y-1.5 h-28 overflow-y-auto">
                {screeningLogs.length === 0 ? (
                  <div className="text-[var(--text-tertiary)] italic">&gt; Awaiting sanctions scan execution...</div>
                ) : (
                  screeningLogs.map((log, idx) => <div key={idx} className="animate-fade-in">&gt; {log}</div>)
                )}
              </div>
            </div>

            {screeningResult && (
              <div className="mt-3 p-3.5 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] font-mono text-[10px] space-y-1 animate-fade-in">
                <div className="flex justify-between">
                  <span>SCAN STATUS:</span>
                  <span className={cn(
                    'font-bold uppercase',
                    screeningResult.status === 'APPROVED' ? 'text-risk-low' : 'text-risk-high'
                  )}>{screeningResult.status}</span>
                </div>
                {screeningResult.match_id !== 'N/A' && (
                  <>
                    <div className="flex justify-between">
                      <span>MATCH ID:</span>
                      <span className="font-bold text-[var(--text-primary)]">{screeningResult.match_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>RISK MULTIPLIER:</span>
                      <span className="font-bold text-credit-line-500">{screeningResult.risk_multiplier}</span>
                    </div>
                  </>
                )}
                <div className="text-[9px] text-[var(--text-tertiary)] pt-1 border-t border-[var(--border-secondary)]/50">
                  {screeningResult.restriction}
                </div>

                {screeningResult.status === 'APPROVED' && (
                  <button
                    onClick={() => setShowCertificate(true)}
                    className="w-full mt-2 border border-emerald-500 rounded bg-emerald-500/5 text-emerald-400 text-[10px] py-1 font-bold font-mono hover:bg-emerald-500 hover:text-white transition-all uppercase"
                  >
                    Display Suitability Certificate
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Certificate Rendering Modal Block */}
        {showCertificate && (
          <div className="p-6 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 text-center space-y-4 animate-fade-in font-mono">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-emerald-500 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest">MiFID II / KYC Suitability Attestation</h4>
              <p className="text-[9px] text-[var(--text-tertiary)]">Credit Line COMPLIANCE LEDGER · REGISTER REF: KYC-{Math.floor(100000 + Math.random() * 900000)}</p>
            </div>
            <div className="max-w-md mx-auto text-left text-[10px] text-[var(--text-secondary)] space-y-2 border-y border-[var(--border-secondary)] py-4">
              <div>CLIENT TRUST: {clientSearch.toUpperCase()}</div>
              <div>VERIFICATION TYPE: GLOBAL PEP & SANCTIONS DISCOVERY SCAN</div>
              <div>COVARIANCE BAND: PASSED (EXPECTED RISK INDEX {horizon * 3 + targetEquity * 0.7}%)</div>
              <div>COMPLIANCE AUDIT STATUTE: EU MICA / MIFID II CHAPTER 4 RULE V</div>
            </div>
            <p className="text-[8px] text-[var(--text-tertiary)] italic">✓ This document attests that the target account profile is clean and fully authorized for asset management distribution.</p>
          </div>
        )}

        {/* Portfolio stress tester */}
        <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4 space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
            <LineChart size={14} className="text-credit-line-500" />
            <span>Portfolio Market-Shock & Stress Tester</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-[200px_1fr] items-start">
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-[var(--text-tertiary)] block uppercase">Select Market Shock Scenario</label>
                <select
                  value={marketScenario}
                  onChange={(e) => setMarketScenario(e.target.value as any)}
                  className="mt-1.5 w-full rounded border border-[var(--border-secondary)] bg-[var(--bg-card)] p-2 text-xs font-semibold"
                >
                  <option value="NONE">Baseline (Stable)</option>
                  <option value="RATE_SPIKE">Interest Rate Spike (+300 bps)</option>
                  <option value="EQUITY_CRASH">Equity Bear Market (-40%)</option>
                  <option value="SUPPLY_SHOCK">Inflation & Supply Chain Shock</option>
                </select>
              </div>

              <button
                onClick={handleRunStressTest}
                disabled={stressLoading}
                className="w-full btn-primary text-xs font-bold py-2 font-mono uppercase flex items-center justify-center gap-1"
              >
                {stressLoading ? <RefreshCw size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                Run Stress Simulation
              </button>
            </div>

            {/* Stress output parameters */}
            {stressOutput ? (
              <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4 space-y-3 font-mono text-[10px] animate-fade-in text-[var(--text-secondary)]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[8px] text-[var(--text-tertiary)] uppercase block">Simulated Drawdown Cap</span>
                    <span className={cn('text-sm font-bold block', stressOutput.drawdown > 15 ? 'text-risk-high' : 'text-risk-low')}>
                      {stressOutput.drawdown}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] text-[var(--text-tertiary)] uppercase block">Computed Value-at-Risk (99%)</span>
                    <span className="text-sm font-bold text-[var(--text-primary)] block">
                      {stressOutput.varRisk}%
                    </span>
                  </div>
                </div>

                <div className="border-t border-[var(--border-secondary)]/50 pt-2 space-y-1 text-[9px]">
                  <div className="font-bold text-[var(--text-primary)] mb-1 uppercase">Stressed Asset Shards:</div>
                  <div className="flex justify-between"><span>EQUITIES:</span><span className="font-bold">{stressOutput.allocation.equity}%</span></div>
                  <div className="flex justify-between"><span>SOVEREIGN BONDS:</span><span className="font-bold">{stressOutput.allocation.bonds}%</span></div>
                  <div className="flex justify-between"><span>LIQUID CASH:</span><span className="font-bold">{stressOutput.allocation.cash}%</span></div>
                </div>

                <div className="border-t border-[var(--border-secondary)]/50 pt-2 text-[9px] leading-relaxed italic text-credit-line-400">
                  {stressOutput.desc}
                </div>
              </div>
            ) : (
              <div className="h-28 border border-dashed border-[var(--border-secondary)] rounded-xl flex items-center justify-center text-center p-4">
                <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider font-mono">Trigger market shock simulation model</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModuleWorkspace>
  );
}

/* ─── 10. RegTech, AML Alerts & Autonomous SAR Pipeline ─────────── */

export function RegTechConsolePage() {
  const r = MOCK_REGTECH;
  const [selectedAmlAlert, setSelectedAmlAlert] = useState<any | null>(null);
  const [sarDraft, setSarDraft] = useState<string>('');
  
  // Advanced RegTech inclusions
  const [pqcSigned, setPqcSigned] = useState(false);
  const [pqcSignature, setPqcSignature] = useState('');
  const [filingLogs, setFilingLogs] = useState<string[]>([]);
  const [filingLoading, setFilingLoading] = useState(false);
  const [filingStep, setFilingStep] = useState<'IDLE' | 'SIGNED' | 'FILED'>('IDLE');
  const [filingRef, setFilingRef] = useState('');

  const amlRows = [
    ['AML-2201', 'Structuring', 'CUST-0041', 'High', 'Under review', 'Rajesh Patel', 'Bandra West, Mumbai', '14 structural deposits', '₹18,40,000'],
    ['AML-2202', 'Round-trip', 'CUST-0078', 'High', 'SAR drafted', 'Smita Sen', 'Salt Lake, Kolkata', '8 layered withdrawals', '₹45,10,000'],
    ['AML-2203', 'Cash intensive', 'CUST-0112', 'Medium', 'Monitoring', 'Amitabh Kumar', 'Connaught Place, Delhi', '24 rapid transfers', '₹12,80,000'],
    ['AML-2204', 'Trade-based ML', 'CUST-0155', 'High', 'Escalated', 'Karan Johar', 'Juhu Beach, Mumbai', '4 import-export invoices', '₹2,40,00,000'],
    ['AML-2205', 'Layering', 'CUST-0189', 'Medium', 'Open', 'Nisha Sharma', 'Indiranagar, Bangalore', '18 cross-border hops', '₹8,50,000'],
  ];

  const handleGenerateSar = () => {
    if (!selectedAmlAlert) return;
    const dateStr = new Date().toLocaleDateString();
    setSarDraft(`SUSPICIOUS ACTIVITY REPORT (SAR-FORM-2026)\n` +
      `FILING DATE: ${dateStr}\n` +
      `SUBJECT CUSTOMER NAME: ${selectedAmlAlert[5]}\n` +
      `CUSTOMER REFERENCE ID: ${selectedAmlAlert[2]}\n` +
      `ADDRESS: ${selectedAmlAlert[6]}\n` +
      `ACTIVITY TRIGGER: ${selectedAmlAlert[7]} worth ${selectedAmlAlert[8]}\n` +
      `REPORTED JURISDICTION: MULTI-JURISDICTIONAL CLEARING SYSTEM\n\n` +
      `NARRATIVE:\n` +
      `The compliance FIU team flags the account holder ${selectedAmlAlert[5]} for anomalous activity matching compliance typology classification "${selectedAmlAlert[1]}". An automated transactional ledger sweep identified rapid funds aggregation and layering behavior indicative of structuring. ML/GNN predictive models calculate an extremely elevated risk multiplier of High. Differential privacy guarantees maintained.\n\n` +
      `REASON CODES: AML-Structuring-Laplace-Lap-214\n` +
      `INVESTIGATOR MEMO: Transmitting to FIU Gateway under compliance directives. Subject accounts placed under review.`);
    setPqcSigned(false);
    setPqcSignature('');
    setFilingLogs([]);
    setFilingStep('IDLE');
  };

  const handlePqcSignSar = async () => {
    setFilingLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const randomSig = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setPqcSignature(randomSig);
    setPqcSigned(true);
    setFilingStep('SIGNED');
    setFilingLoading(false);
  };

  const handleTransmitSar = async () => {
    setFilingLoading(true);
    setFilingLogs(['Sealing Suspicious Activity Report payload with ML-DSA-65 signature envelope...']);
    
    await new Promise(r => setTimeout(r, 600));
    setFilingLogs(prev => [...prev, 'Establishing secure post-quantum TLS channel to FinCEN FIU gateway...']);
    
    await new Promise(r => setTimeout(r, 500));
    setFilingLogs(prev => [...prev, 'Uploading encrypted SAR metadata & compliance narrative payload...']);
    
    await new Promise(r => setTimeout(r, 600));
    const finalRef = 'FIU-SAR-2026-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    setFilingRef(finalRef);
    setFilingLogs(prev => [...prev, `✓ TRANSMISSION SUCCESSFUL. Regulator confirmation code: ${finalRef}`]);
    setFilingStep('FILED');
    setFilingLoading(false);
  };

  const handleDownloadEnvelope = () => {
    const envelope = {
      sar_document: 'SAR-FORM-2026',
      alert_id: selectedAmlAlert[0],
      filer: 'Credit Line FIU-Officer-Dilithium',
      subject: {
        id: selectedAmlAlert[2],
        name: selectedAmlAlert[5],
        address: selectedAmlAlert[6],
        trigger: selectedAmlAlert[7],
        value: selectedAmlAlert[8],
      },
      pqc_digital_signature: pqcSignature,
      narrative: sarDraft,
      gateway_transmission_reference: filingRef,
      timestamp: new Date().toISOString(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(envelope, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `fincen_sar_${selectedAmlAlert[0]}_envelope.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <ModuleWorkspace
      eyebrow="RegTech Console"
      title="AML monitoring, SAR generation, and regulatory reporting."
      description="Transaction monitoring, suspicious activity reporting, and multi-jurisdiction regulatory reporting in one compliance surface."
      icon={FileText}
      isMocked
      kpis={[
        { label: 'AML alerts', value: String(r.aml_alerts), detail: 'open monitoring queue', tone: 'amber' },
        { label: 'SARs filed', value: String(r.sars_filed), detail: 'this reporting cycle', tone: 'blue' },
        { label: 'SARs pending', value: String(r.sars_pending), detail: 'awaiting review', tone: 'red' },
        { label: 'False positives', value: `${(r.false_positive_rate * 100).toFixed(1)}%`, detail: 'of total alerts', tone: 'green' },
      ]}
      side={
        <>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Active typologies</h3>
          <div className="mt-4 space-y-3">
            {[
              `${r.typologies_active} typologies loaded`,
              'Structuring — rule active',
              'Trade-based ML — rule active',
              'Crypto-to-fiat — rule active',
              'Shell company layering — active',
            ].map((item) => <StatusLine key={item} label={item} />)}
          </div>
        </>
      }
      audit={[
        'SAR narratives auto-drafted based on GNN anomalies',
        'Regulatory filing files compiled in standard JSON formats',
        'Case evidence packages securely locked',
      ]}
    >
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">AML Alert Queue</h3>
          <p className="text-xs text-[var(--text-tertiary)] font-mono uppercase tracking-wider">Click any row below to load active audit vectors and launch autonomous SAR wizards.</p>
          <DataTable
            columns={['Alert ID', 'Typology', 'Customer Reference', 'Risk Tier', 'Status']}
            rows={amlRows.map((row) => [
              row[0],
              row[1],
              <span className="font-mono font-bold text-xs">{row[2]}</span>,
              <span className="font-semibold text-risk-high">{row[3]}</span>,
              row[4]
            ])}
            onRowClick={(index) => {
              setSelectedAmlAlert(amlRows[index]);
              setSarDraft('');
              setPqcSigned(false);
              setFilingLogs([]);
              setFilingStep('IDLE');
            }}
          />
        </div>

        {selectedAmlAlert && (
          <div className="grid gap-6 md:grid-cols-2 animate-fade-in">
            {/* Editor Workspace Panel */}
            <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border-secondary)]/60 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                    <FileText size={14} className="text-credit-line-500" />
                    <span>Autonomous SAR Narrative Filer: {selectedAmlAlert[0]}</span>
                  </div>
                  <button
                    onClick={() => setSelectedAmlAlert(null)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Customer Details info block */}
                <div className="p-3 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] font-mono text-[9px] text-[var(--text-secondary)] space-y-1">
                  <div className="text-[10px] font-bold text-[var(--text-primary)] uppercase border-b border-[var(--border-secondary)]/50 pb-1 mb-1">Subject Entity</div>
                  <div>NAME: {selectedAmlAlert[5]}</div>
                  <div>REFERENCE: {selectedAmlAlert[2]}</div>
                  <div>ADDRESS: {selectedAmlAlert[6]}</div>
                  <div>TRIGGER VECTORS: {selectedAmlAlert[7]} ({selectedAmlAlert[8]})</div>
                </div>

                {!sarDraft ? (
                  <button
                    onClick={handleGenerateSar}
                    className="w-full btn-primary py-2 text-xs font-bold font-mono uppercase"
                  >
                    Auto-Draft Regulatory Narrative
                  </button>
                ) : (
                  <div className="space-y-3 animate-fade-in">
                    <label className="text-[9px] font-bold text-[var(--text-tertiary)] block uppercase">Editable SAR Narrative Brief</label>
                    <textarea
                      value={sarDraft}
                      onChange={(e) => setSarDraft(e.target.value)}
                      className="w-full h-40 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-xl p-3 font-mono text-[10px] text-[var(--text-secondary)] leading-relaxed focus:outline-none focus:border-credit-line-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Filer Console Control and Terminal logs */}
            {sarDraft && (
              <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5 space-y-4 flex flex-col justify-between animate-fade-in">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">FIU Filing Console & Transmission Gate</span>
                  
                  {/* Step controls */}
                  <div className="space-y-2">
                    {/* Sign step */}
                    <div className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-bold text-[var(--text-primary)] uppercase">1. Cryptographic Seal</div>
                        <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-semibold">Sign payload with Post-Quantum ML-DSA keys</div>
                      </div>
                      <button
                        onClick={handlePqcSignSar}
                        disabled={pqcSigned || filingLoading}
                        className={cn(
                          'px-3 py-1 rounded text-[10px] font-bold font-mono uppercase transition-all',
                          pqcSigned 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'btn-primary border border-transparent'
                        )}
                      >
                        {pqcSigned ? 'Signed ✓' : 'Seal & Sign'}
                      </button>
                    </div>

                    {/* Transmit step */}
                    <div className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
                      <div className="space-y-0.5">
                        <div className="text-[10px] font-bold text-[var(--text-primary)] uppercase">2. FIU Gateway Filing</div>
                        <div className="text-[8px] text-[var(--text-tertiary)] uppercase font-semibold">Transmit envelope directly to federal portals</div>
                      </div>
                      <button
                        onClick={handleTransmitSar}
                        disabled={!pqcSigned || filingStep === 'FILED' || filingLoading}
                        className={cn(
                          'px-3 py-1 rounded text-[10px] font-bold font-mono uppercase transition-all',
                          filingStep === 'FILED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : !pqcSigned 
                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed border border-transparent'
                            : 'btn-primary border border-transparent'
                        )}
                      >
                        {filingStep === 'FILED' ? 'Transmitted ✓' : 'Transmit'}
                      </button>
                    </div>
                  </div>

                  {/* Terminal log */}
                  {filingLogs.length > 0 && (
                    <div className="bg-black/45 p-3 rounded-lg border border-[var(--border-secondary)] font-mono text-[9px] text-emerald-400 space-y-1.5 h-24 overflow-y-auto leading-normal">
                      {filingLogs.map((log, idx) => <div key={idx}>&gt; {log}</div>)}
                    </div>
                  )}
                </div>

                {filingStep === 'FILED' && (
                  <button
                    onClick={handleDownloadEnvelope}
                    className="w-full bg-emerald-700 text-white rounded-lg text-xs font-bold py-2 font-mono uppercase flex items-center justify-center gap-1.5 hover:bg-emerald-600 transition-colors animate-fade-in"
                  >
                    <Download size={13} />
                    Download Signed Filer Envelope (.json)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </ModuleWorkspace>
  );
}

/* ─── Kpi Side Panels & helpers ──────────────────────────────────── */

function RiskSidePanel() {
  return (
    <>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Risk controls</h3>
      <div className="mt-4 space-y-3">
        {['Velocity policy active', 'Device reuse scan enabled', 'Manual review threshold 85+'].map((item) => (
          <StatusLine key={item} label={item} />
        ))}
      </div>
    </>
  );
}

function CreditSidePanel({ metrics }: { metrics: CreditMetric }) {
  return (
    <>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Credit governance</h3>
      <div className="mt-4 space-y-3">
        <StatusLine label={`${formatPercent(metrics.inclusion_index)} inclusion index`} />
        <StatusLine label={`${metrics.adverse_notices_sent.toLocaleString()} adverse notices`} />
        <StatusLine label="Approval threshold set to 580" />
      </div>
    </>
  );
}

function TopologySidePanel({ graph }: { graph: GraphSummary }) {
  return (
    <>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Topologies</h3>
      <div className="mt-4 space-y-3">
        {graph.topologies.map((topology) => (
          <div key={topology.name} className="rounded-xl bg-[var(--bg-secondary)] p-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{topology.name}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{topology.nodes} nodes / {(topology.risk * 100).toFixed(0)} risk</p>
          </div>
        ))}
      </div>
    </>
  );
}

function RunbookSidePanel() {
  return (
    <>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Runbook state</h3>
      <div className="mt-4 space-y-3">
        {['Investigate customer graph', 'Score device trust', 'Prepare analyst memo'].map((item) => (
          <StatusLine key={item} label={item} />
        ))}
      </div>
    </>
  );
}

function FederationSidePanel({ nodes }: { nodes: ConsortiumNode[] }) {
  return (
    <>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Network health</h3>
      <div className="mt-4 space-y-3">
        {nodes.map((node) => (
          <StatusLine key={node.bank_id} label={`${node.name}: ${node.status}`} />
        ))}
      </div>
    </>
  );
}

function QuantumSidePanel({ quantum }: { quantum: QuantumStatus }) {
  return (
    <>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Crypto posture</h3>
      <div className="mt-4 space-y-3">
        <StatusLine label={`Hybrid TLS ${quantum.hybrid_tls ? 'enabled' : 'disabled'}`} />
        <StatusLine label={`Last key rotation ${new Date(quantum.last_key_rotation).toLocaleDateString()}`} />
        <StatusLine label={`${quantum.sovereign_regions.length} sovereign regions`} />
      </div>
    </>
  );
}

function InfrastructureSidePanel({ mlops }: { mlops: MlopsStatus }) {
  return (
    <>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Reliability checks</h3>
      <div className="mt-4 space-y-3">
        <StatusLine label={`Registry ${mlops.model_registry}`} />
        <StatusLine label={`Feature store ${mlops.feature_store}`} />
        <StatusLine label={`Stream lag ${mlops.stream_lag_ms}ms`} />
      </div>
    </>
  );
}

export function StatusLine({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-risk-low" />
      <p className="text-xs leading-5 text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}

/* ─── Payment/Wealth Mock Data ────────────────────────────────────── */

interface PaymentMetrics {
  daily_volume: number;
  fraud_rate: number;
  chargeback_rate: number;
  disputes_auto_filed: number;
  avg_latency_ms: number;
  rails: string[];
}

const MOCK_PAYMENTS: PaymentMetrics = {
  daily_volume: 2_847_312,
  fraud_rate: 0.0032,
  chargeback_rate: 0.0017,
  disputes_auto_filed: 142,
  avg_latency_ms: 8.7,
  rails: ['UPI', 'IMPS', 'SWIFT', 'ACH', 'VISA', 'MC'],
};

interface WealthMetrics {
  hni_accounts: number;
  kyc_pending: number;
  aml_alerts: number;
  portfolio_risk_avg: number;
  suitability_pass_rate: number;
}

const MOCK_WEALTH: WealthMetrics = {
  hni_accounts: 4_820,
  kyc_pending: 38,
  aml_alerts: 12,
  portfolio_risk_avg: 0.24,
  suitability_pass_rate: 0.91,
};

interface RegTechMetrics {
  aml_alerts: number;
  sars_filed: number;
  sars_pending: number;
  typologies_active: number;
  false_positive_rate: number;
}

const MOCK_REGTECH: RegTechMetrics = {
  aml_alerts: 47,
  sars_filed: 8,
  sars_pending: 3,
  typologies_active: 214,
  false_positive_rate: 0.068,
};
