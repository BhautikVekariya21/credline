import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Check, CheckCheck, Download, Filter, Pin, PinOff,
  Search, Trash2, X, AlertTriangle, CreditCard, Cpu,
  Shield, FileText, ChevronDown,
} from 'lucide-react';
import { useAppStore, type AppNotification } from '../../store/useAppStore';
import { cn } from '../../lib/utils';

/* ─── Simulated notification generator ──────────────────────────────── */

const NOTIFICATION_TEMPLATES: Array<Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'pinned'>> = [
  { type: 'fraud', severity: 'critical', title: 'High-risk transaction flagged', message: 'USR-IN-7a4f attempted ₹94,500 transfer to new payee. GNN risk score: 94. Auto-blocked pending review.', source: '/admin/fraud' },
  { type: 'fraud', severity: 'warning', title: 'Velocity anomaly detected', message: '3 rapid card-not-present transactions from USR-EU-3b2c in 45 seconds. Pattern matches card-testing typology.', source: '/admin/fraud' },
  { type: 'credit', severity: 'info', title: 'Batch scoring completed', message: '2,847 thin-file applications scored. Approval rate: 73.4%. No fairness drift detected.', source: '/admin/credit' },
  { type: 'credit', severity: 'warning', title: 'Adverse action notices pending', message: '12 declined applicants require ECOA-compliant adverse action notices within 30-day window.', source: '/admin/credit' },
  { type: 'system', severity: 'info', title: 'Model retraining complete', message: 'Champion model v2.4.1 promoted after A/B validation. Challenger accuracy: 94.2% vs champion 93.8%.', source: '/admin/infra' },
  { type: 'system', severity: 'critical', title: 'Circuit breaker tripped', message: 'Fraud scoring latency exceeded 500ms threshold. Circuit breaker opened. Fallback rules engine active.', source: '/admin/infra' },
  { type: 'system', severity: 'warning', title: 'Feature store lag detected', message: 'Feast materialization lag: 847ms. Stream processor consumer group rebalancing in progress.', source: '/admin/infra' },
  { type: 'compliance', severity: 'critical', title: 'SAR filing deadline approaching', message: 'Case FA-001 requires SAR submission within 48 hours per BSA/AML regulations.', source: '/admin/regtech' },
  { type: 'compliance', severity: 'info', title: 'Regulatory report generated', message: 'Q2 2026 STR batch report generated. 14 cases included. Ready for FIU transmission.', source: '/admin/regtech' },
  { type: 'model', severity: 'warning', title: 'Model drift signal', message: 'KS statistic for transaction_amount feature: 0.18 (threshold: 0.15). Monitoring escalated.', source: '/admin/infra' },
  { type: 'model', severity: 'info', title: 'Experiment logged', message: 'MLflow experiment #19 recorded. XGBoost hyperparameter sweep completed with 42 trials.', source: '/admin/infra' },
  { type: 'fraud', severity: 'info', title: 'Graph scan completed', message: 'Neo4j topology scan: 18,420 nodes, 74,830 edges. 7 risk clusters identified. 2 poisoning alerts.', source: '/admin/graph' },
  { type: 'system', severity: 'info', title: 'Database sync active', message: 'PostgreSQL ingestion stream processing at 1,240 rows/sec. Latency: 18ms. Schema: credline_prod.', source: '/admin/database' },
  { type: 'compliance', severity: 'warning', title: 'PEP screening match', message: 'Client WM-0042 matched against OFAC SDN list entry. Manual review required before account clearance.', source: '/admin/wealth' },
];

const TYPE_ICONS: Record<string, typeof Bell> = {
  fraud: AlertTriangle,
  credit: CreditCard,
  system: Cpu,
  compliance: FileText,
  model: Shield,
};

const TYPE_COLORS: Record<string, string> = {
  fraud: 'text-risk-high',
  credit: 'text-eshodha-500',
  system: 'text-accent-purple',
  compliance: 'text-risk-medium',
  model: 'text-risk-low',
};

const SEVERITY_BADGES: Record<string, string> = {
  critical: 'bg-risk-high/15 text-risk-high border-risk-high/20',
  warning: 'bg-risk-medium/15 text-risk-medium border-risk-medium/20',
  info: 'bg-eshodha-500/15 text-eshodha-500 border-eshodha-500/20',
};

type FilterType = 'all' | 'fraud' | 'credit' | 'system' | 'compliance' | 'model';
type FilterSeverity = 'all' | 'critical' | 'warning' | 'info';
type FilterRead = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const { notifications, addNotification, markAsRead, markAllAsRead, togglePin, dismissNotification, clearNotifications } = useAppStore();

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('all');
  const [filterRead, setFilterRead] = useState<FilterRead>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Seed initial notifications if empty
  useEffect(() => {
    if (notifications.length === 0) {
      const shuffled = [...NOTIFICATION_TEMPLATES].sort(() => Math.random() - 0.5);
      shuffled.slice(0, 8).forEach((template, i) => {
        setTimeout(() => addNotification(template), i * 100);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Simulate real-time stream — new notification every 20-40 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const template = NOTIFICATION_TEMPLATES[Math.floor(Math.random() * NOTIFICATION_TEMPLATES.length)];
      addNotification(template);
    }, 20_000 + Math.random() * 20_000);
    return () => clearInterval(interval);
  }, [addNotification]);

  const filtered = notifications.filter((n) => {
    if (filterType !== 'all' && n.type !== filterType) return false;
    if (filterSeverity !== 'all' && n.severity !== filterSeverity) return false;
    if (filterRead === 'unread' && n.read) return false;
    if (filterRead === 'read' && !n.read) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  // Sort: pinned first, then by timestamp desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleExport = useCallback(() => {
    const rows = [
      ['ID', 'Type', 'Severity', 'Title', 'Message', 'Timestamp', 'Read', 'Pinned'],
      ...sorted.map((n) => [n.id, n.type, n.severity, n.title, n.message, n.timestamp, String(n.read), String(n.pinned)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credline-notifications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [sorted]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-eshodha-500/10 text-eshodha-500">
              <Bell size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Notifications Center</p>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-risk-high/20 px-2 py-0.5 text-[10px] font-bold text-risk-high">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">Notifications</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                Real-time alerts from fraud detection, credit scoring, compliance monitoring, and system operations.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowFilters((v) => !v)} className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs">
              <Filter size={13} /> Filters <ChevronDown size={11} className={cn('transition-transform', showFilters && 'rotate-180')} />
            </button>
            <button onClick={markAllAsRead} className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs">
              <CheckCheck size={13} /> Mark all read
            </button>
            <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs">
              <Download size={13} /> Export
            </button>
            <button onClick={clearNotifications} className="btn-secondary flex items-center gap-1.5 px-4 py-2 text-xs text-risk-high">
              <Trash2 size={13} /> Clear all
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border-secondary)] pt-4 animate-fade-in">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notifications..."
                className="w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold"
            >
              <option value="all">All Types</option>
              <option value="fraud">Fraud</option>
              <option value="credit">Credit</option>
              <option value="system">System</option>
              <option value="compliance">Compliance</option>
              <option value="model">Model</option>
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as FilterSeverity)}
              className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select
              value={filterRead}
              onChange={(e) => setFilterRead(e.target.value as FilterRead)}
              className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-semibold"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
        )}
      </section>

      {/* Stats row */}
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Total', value: String(notifications.length), detail: 'all notifications', tone: 'blue' as const },
          { label: 'Unread', value: String(unreadCount), detail: 'pending review', tone: 'red' as const },
          { label: 'Critical', value: String(notifications.filter((n) => n.severity === 'critical').length), detail: 'high priority', tone: 'amber' as const },
          { label: 'Pinned', value: String(notifications.filter((n) => n.pinned).length), detail: 'bookmarked', tone: 'purple' as const },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{s.label}</p>
            <p className={cn('mt-3 text-2xl font-semibold', {
              'text-eshodha-500': s.tone === 'blue',
              'text-risk-high': s.tone === 'red',
              'text-risk-medium': s.tone === 'amber',
              'text-accent-purple': s.tone === 'purple',
            })}>{s.value}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{s.detail}</p>
          </div>
        ))}
      </section>

      {/* Notification list */}
      <section className="rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {sorted.length} notification{sorted.length !== 1 ? 's' : ''}
            {filterType !== 'all' || filterSeverity !== 'all' || filterRead !== 'all' || searchQuery
              ? ' (filtered)'
              : ''}
          </h3>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell size={40} className="text-[var(--text-tertiary)] animate-pulse" />
            <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">No notifications</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              {searchQuery || filterType !== 'all' ? 'Try adjusting your filters.' : 'New alerts will appear here in real-time.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((notif) => {
              const TypeIcon = TYPE_ICONS[notif.type] || Bell;
              return (
                <div
                  key={notif.id}
                  className={cn(
                    'group relative flex gap-3 rounded-xl border p-4 transition-all duration-200',
                    notif.read
                      ? 'border-[var(--border-secondary)] bg-[var(--bg-secondary)]/50'
                      : 'border-[var(--border-secondary)] bg-[var(--bg-card)] shadow-sm',
                    notif.pinned && 'border-eshodha-500/30 bg-eshodha-500/5'
                  )}
                >
                  {/* Left icon */}
                  <div className={cn('mt-0.5 flex-shrink-0', TYPE_COLORS[notif.type])}>
                    <TypeIcon size={18} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={cn('text-sm font-semibold', notif.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>
                        {notif.title}
                      </h4>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider', SEVERITY_BADGES[notif.severity])}>
                        {notif.severity}
                      </span>
                      <span className="rounded-full border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[9px] font-semibold text-[var(--text-tertiary)] capitalize">
                        {notif.type}
                      </span>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-eshodha-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{notif.message}</p>
                    <p className="mt-1.5 text-[10px] font-mono text-[var(--text-tertiary)]">
                      {new Date(notif.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
                      {notif.source && <span className="ml-2 text-eshodha-500">→ {notif.source}</span>}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {!notif.read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-risk-low"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => togglePin(notif.id)}
                      className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-eshodha-500"
                      title={notif.pinned ? 'Unpin' : 'Pin'}
                    >
                      {notif.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                    <button
                      onClick={() => dismissNotification(notif.id)}
                      className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-risk-high"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
