import { useState, useCallback, useMemo } from 'react';
import {
  ClipboardList, Download, Search, Filter, ChevronDown, ChevronLeft, ChevronRight,
  X, Eye, User, Globe, Clock, Activity, Shield, CreditCard, AlertTriangle, Cpu,
} from 'lucide-react';
import { cn } from '../../lib/utils';

/* ─── Types ──────────────────────────────────────────────────────── */

interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  module: string;
  ip: string;
  region: string;
  severity: 'info' | 'warning' | 'critical';
  payload: Record<string, unknown>;
}

/* ─── Mock data generator ────────────────────────────────────────── */

const ACTORS = ['admin@creditline.io', 'analyst.sharma@creditline.io', 'system.scheduler', 'ml.pipeline', 'soar.orchestrator', 'compliance.bot', 'api.gateway'];
const ACTIONS = [
  'fraud.alert.created', 'fraud.alert.escalated', 'fraud.alert.resolved',
  'credit.score.computed', 'credit.batch.completed', 'credit.adverse.sent',
  'model.retrained', 'model.promoted', 'model.drift.detected',
  'user.login', 'user.logout', 'user.settings.updated',
  'sar.report.generated', 'sar.report.transmitted', 'pep.screening.completed',
  'db.connection.established', 'db.schema.migrated', 'db.backup.completed',
  'graph.scan.completed', 'graph.cycle.detected', 'graph.poisoning.alert',
  'quantum.key.rotated', 'quantum.failover.triggered',
  'api.rate.limit.exceeded', 'circuit.breaker.tripped', 'circuit.breaker.reset',
];
const TARGETS = ['FA-001', 'FA-002', 'USR-IN-7a4f', 'USR-EU-3b2c', 'model-v2.4.1', 'Credit Line_prod.transactions', 'SAR-2026-Q2-014', 'graph-cluster-7', 'ML-KEM-768-key-42'];
const MODULES = ['fraud', 'credit', 'graph', 'soar', 'compliance', 'system', 'quantum', 'database', 'auth'];
const REGIONS = ['ap-south-1', 'eu-west-1', 'us-east-1', 'ap-southeast-1'];
const IPS = ['10.0.1.42', '10.0.2.18', '172.16.0.5', '192.168.1.100', '10.0.3.77', '0.0.0.0 (system)'];

function generateMockAuditEvents(count: number): AuditEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
    const severity: AuditEvent['severity'] =
      action.includes('critical') || action.includes('breaker.tripped') || action.includes('poisoning') || action.includes('failover')
        ? 'critical'
        : action.includes('escalated') || action.includes('drift') || action.includes('rate.limit') || action.includes('alert')
          ? 'warning'
          : 'info';

    return {
      id: `AUD-${String(count - i).padStart(5, '0')}`,
      timestamp: new Date(Date.now() - i * (60_000 + Math.random() * 300_000)).toISOString(),
      actor: ACTORS[Math.floor(Math.random() * ACTORS.length)],
      action,
      target: TARGETS[Math.floor(Math.random() * TARGETS.length)],
      module: MODULES[Math.floor(Math.random() * MODULES.length)],
      ip: IPS[Math.floor(Math.random() * IPS.length)],
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
      severity,
      payload: {
        action_type: action,
        correlation_id: `COR-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        duration_ms: Math.round(Math.random() * 500 + 5),
        metadata: { environment: 'production', version: '2.4.1' },
      },
    };
  });
}

const ALL_EVENTS = generateMockAuditEvents(150);

const MODULE_ICONS: Record<string, typeof Shield> = {
  fraud: AlertTriangle,
  credit: CreditCard,
  system: Cpu,
  graph: Activity,
  soar: Shield,
  compliance: ClipboardList,
  quantum: Shield,
  database: Cpu,
  auth: User,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-risk-high/15 text-risk-high border-risk-high/20',
  warning: 'bg-risk-medium/15 text-risk-medium border-risk-medium/20',
  info: 'bg-credit-line-500/15 text-credit-line-500 border-credit-line-500/20',
};

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const [events] = useState(ALL_EVENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filterModule !== 'all' && e.module !== filterModule) return false;
      if (filterSeverity !== 'all' && e.severity !== filterSeverity) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          e.action.toLowerCase().includes(q) ||
          e.actor.toLowerCase().includes(q) ||
          e.target.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [events, filterModule, filterSeverity, searchQuery]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageEvents = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const handleFilterChange = useCallback((setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(0);
  }, []);

  // Timeline bar — density of events by hour over the last 24h
  const timelineBuckets = useMemo(() => {
    const buckets = new Array(24).fill(0);
    const now = Date.now();
    events.forEach((e) => {
      const age = now - new Date(e.timestamp).getTime();
      const hour = Math.floor(age / 3_600_000);
      if (hour >= 0 && hour < 24) buckets[23 - hour]++;
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((v) => v / max);
  }, [events]);

  const handleExport = useCallback(() => {
    const rows = [
      ['ID', 'Timestamp', 'Actor', 'Action', 'Target', 'Module', 'IP', 'Region', 'Severity'],
      ...filtered.map((e) => [e.id, e.timestamp, e.actor, e.action, e.target, e.module, e.ip, e.region, e.severity]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credit-line-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent-purple/10 text-accent-purple">
              <ClipboardList size={24} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Compliance & Governance</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">Audit Trail</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                Immutable record of all system actions, model decisions, and user operations across the platform.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowFilters((v) => !v)} className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs">
              <Filter size={13} /> Filters <ChevronDown size={11} className={cn('transition-transform', showFilters && 'rotate-180')} />
            </button>
            <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs">
              <Download size={13} /> Export CSV
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border-secondary)] pt-4 animate-fade-in">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                placeholder="Search by action, actor, target, or ID..."
                className="w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <select
              value={filterModule}
              onChange={(e) => handleFilterChange(setFilterModule, e.target.value)}
              className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold"
            >
              <option value="all">All Modules</option>
              {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => handleFilterChange(setFilterSeverity, e.target.value)}
              className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>
        )}
      </section>

      {/* Timeline visualization */}
      <section className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">Event Density — Last 24 Hours</h3>
          <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{events.length} total events</span>
        </div>
        <div className="flex items-end gap-[2px] h-12">
          {timelineBuckets.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-credit-line-500/60 transition-all duration-300 hover:bg-credit-line-500"
              style={{ height: `${Math.max(v * 100, 4)}%` }}
              title={`${23 - i}h ago — ${Math.round(v * Math.max(...timelineBuckets.map((b) => b * events.length)))} events`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[var(--text-tertiary)]">24h ago</span>
          <span className="text-[9px] text-[var(--text-tertiary)]">Now</span>
        </div>
      </section>

      {/* Stats row */}
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Total Events', value: String(filtered.length), detail: filterModule !== 'all' ? `${filterModule} module` : 'all modules', icon: Activity },
          { label: 'Unique Actors', value: String(new Set(filtered.map((e) => e.actor)).size), detail: 'active identities', icon: User },
          { label: 'Regions', value: String(new Set(filtered.map((e) => e.region)).size), detail: 'geographic zones', icon: Globe },
          { label: 'Critical Actions', value: String(filtered.filter((e) => e.severity === 'critical').length), detail: 'requires attention', icon: AlertTriangle },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center gap-2">
              <s.icon size={14} className="text-[var(--text-tertiary)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{s.label}</p>
            </div>
            <p className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{s.value}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{s.detail}</p>
          </div>
        ))}
      </section>

      {/* Event table */}
      <section className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-secondary)] text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">ID</th>
                <th className="px-4 py-3 text-left font-semibold">Timestamp</th>
                <th className="px-4 py-3 text-left font-semibold">Actor</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Target</th>
                <th className="px-4 py-3 text-left font-semibold">Module</th>
                <th className="px-4 py-3 text-left font-semibold">Severity</th>
                <th className="px-4 py-3 text-left font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pageEvents.map((event) => {
                const ModIcon = MODULE_ICONS[event.module] || Activity;
                return (
                  <tr
                    key={event.id}
                    className="border-t border-[var(--border-secondary)] cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[var(--text-secondary)]">{event.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                      {new Date(event.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-primary)]">{event.actor}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <ModIcon size={12} className="text-[var(--text-tertiary)]" />
                        <span className="font-mono text-xs text-[var(--text-primary)]">{event.action}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-credit-line-500">{event.target}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[9px] font-semibold capitalize">
                        {event.module}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase', SEVERITY_COLORS[event.severity])}>
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Eye size={14} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-4 py-3">
          <span className="text-xs text-[var(--text-secondary)]">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-card)] disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = page < 3 ? i : page - 2 + i;
              if (pageNum >= totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                    pageNum === page
                      ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                  )}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-card)] disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Detail drawer */}
      {selectedEvent && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-[var(--border-secondary)] bg-[var(--bg-overlay)] p-6 shadow-2xl backdrop-blur-xl overflow-y-auto">
          <div className="flex items-center justify-between border-b border-[var(--border-secondary)] pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)]">Event Detail</p>
              <h4 className="text-lg font-bold text-[var(--text-primary)]">{selectedEvent.id}</h4>
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Timestamp', value: new Date(selectedEvent.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }), icon: Clock },
                { label: 'Actor', value: selectedEvent.actor, icon: User },
                { label: 'Module', value: selectedEvent.module, icon: Shield },
                { label: 'Region', value: selectedEvent.region, icon: Globe },
                { label: 'IP Address', value: selectedEvent.ip, icon: Activity },
                { label: 'Severity', value: selectedEvent.severity, icon: AlertTriangle },
              ].map((field) => (
                <div key={field.label} className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
                  <div className="flex items-center gap-1.5">
                    <field.icon size={11} className="text-[var(--text-tertiary)]" />
                    <p className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">{field.label}</p>
                  </div>
                  <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)] capitalize">{field.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
              <p className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Action</p>
              <p className="mt-1 font-mono text-sm font-semibold text-credit-line-500">{selectedEvent.action}</p>
            </div>

            <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3">
              <p className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Target</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[var(--text-primary)]">{selectedEvent.target}</p>
            </div>

            <div className="rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4">
              <h5 className="text-xs font-bold text-[var(--text-primary)]">Raw Event Payload</h5>
              <pre className="mt-3 rounded-lg bg-[var(--bg-secondary)] p-3 text-[11px] font-mono text-[var(--text-secondary)] overflow-x-auto leading-5">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
