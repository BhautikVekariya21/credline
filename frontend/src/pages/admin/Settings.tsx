import { useState, useCallback, useMemo } from 'react';
import {
  Bell, Key, Globe, Shield, Monitor,
  Copy, Check, Eye, EyeOff, RefreshCw, Type, RotateCcw,
  ClipboardList, Users, Database, Download, Server,
  ChevronDown, X, UserPlus, Mail, AlertTriangle,
  BarChart3, Calendar, HardDrive, FileDown, Camera,
  ToggleLeft, Info,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../lib/utils';

// ─── Toast System ────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  progress?: number;
}

let _toastCounter = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success', duration = 3000) => {
    const id = `toast-${++_toastCounter}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
    return id;
  }, []);

  const addProgressToast = useCallback((message: string) => {
    const id = `toast-${++_toastCounter}`;
    setToasts((prev) => [...prev, { id, message, type: 'info', progress: 0 }]);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, progress: 100, type: 'success' as const, message: `${message} — Complete!` } : t))
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 2000);
      } else {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, progress: Math.min(progress, 99) } : t))
        );
      }
    }, 400);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, addProgressToast, removeToast };
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  const toastColors: Record<Toast['type'], string> = {
    success: 'border-risk-low/30 bg-risk-low/10 text-risk-low',
    info: 'border-eshodha-500/30 bg-eshodha-500/10 text-eshodha-500',
    warning: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'p-3 rounded-xl border text-xs font-semibold animate-fade-in flex items-center gap-2 shadow-lg backdrop-blur-sm',
            toastColors[toast.type]
          )}
        >
          {toast.type === 'success' && <Check size={14} className="flex-shrink-0" />}
          {toast.type === 'info' && <Info size={14} className="flex-shrink-0 animate-pulse" />}
          {toast.type === 'warning' && <AlertTriangle size={14} className="flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <span className="block truncate">{toast.message}</span>
            {toast.progress !== undefined && (
              <div className="mt-1.5 h-1 w-full rounded-full bg-black/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-current transition-all duration-300 ease-out"
                  style={{ width: `${toast.progress}%` }}
                />
              </div>
            )}
          </div>
          <button
            onClick={() => onRemove(toast.id)}
            className="p-0.5 rounded hover:bg-black/10 flex-shrink-0"
            aria-label="Dismiss notification"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}


// ─── Main Settings Page ──────────────────────────────────────────────

export default function SettingsPage() {
  const { resetToDefaults } = useAppStore();
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const toast = useToast();

  const handleReset = () => {
    resetToDefaults();
    setResetMessage('Preferences successfully restored to factory defaults.');
    setTimeout(() => setResetMessage(null), 3000);
  };

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-[var(--text-primary)]">Preferences</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Configure and customize the Credline operating console.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border-secondary)] hover:border-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
        >
          <RotateCcw size={13} />
          Reset Defaults
        </button>
      </div>

      {resetMessage && (
        <div className="p-3.5 rounded-xl border border-risk-low/30 bg-risk-low/10 text-xs font-semibold text-risk-low animate-fade-in flex items-center gap-2">
          <Check size={14} />
          {resetMessage}
        </div>
      )}

      <AppearanceSection />
      <TypographySection />
      <NotificationSection />
      <APIKeySection toast={toast} />
      <RegionSection />
      <AuditPreferencesSection toast={toast} />
      <TeamRoleManagementSection toast={toast} />
      <DataRetentionSection />
      <ExportBackupSection toast={toast} />
      <SystemInfoSection />
      <DiagnosticsSection />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}


// ─── Appearance (Theme) ──────────────────────────────────────────────

function AppearanceSection() {
  const { theme, setTheme } = useAppStore();

  const themes = [
    { id: 'dark', label: 'Dark Mode', detail: 'Sleek dark room experience', color: '#161617' },
    { id: 'light', label: 'Light Mode', detail: 'Clean and bright canvas', color: '#ffffff' },
    { id: 'high-contrast', label: 'High Contrast', detail: 'Extreme clarity & accessibility', color: '#000000' },
  ] as const;

  return (
    <SettingsCard title="Appearance" description="Select the color scheme for the administration platform" icon={Monitor}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              'relative flex flex-col gap-3 rounded-xl border p-4 transition-all text-left w-full hover:bg-[var(--bg-secondary)]/50',
              theme === t.id
                ? 'border-eshodha-500 bg-eshodha-500/5'
                : 'border-[var(--border-secondary)]'
            )}
          >
            {/* Visual Mini Preview Container */}
            <div 
              style={{ backgroundColor: t.color }}
              className={cn(
                'h-16 w-full rounded-lg border flex flex-col justify-between p-2.5',
                t.id === 'light' ? 'border-gray-200' : 'border-neutral-800'
              )}
            >
              <div className="space-y-1">
                <div className={cn('h-1.5 w-12 rounded-full', t.id === 'light' ? 'bg-gray-800' : 'bg-gray-200')} />
                <div className={cn('h-1.5 w-8 rounded-full', t.id === 'light' ? 'bg-gray-400' : 'bg-gray-600')} />
              </div>
              <div className="flex justify-end">
                <div className={cn('h-3.5 w-3.5 rounded-full flex items-center justify-center', t.id === 'light' ? 'bg-gray-200' : 'bg-neutral-900')}>
                  <div className={cn('h-2 w-2 rounded-full', theme === t.id ? 'bg-eshodha-500' : 'bg-transparent')} />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                {theme === t.id && <Check size={14} className="text-eshodha-500 flex-shrink-0" />}
                <span className="text-xs font-bold text-[var(--text-primary)]">{t.label}</span>
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)] leading-tight">{t.detail}</p>
            </div>
          </button>
        ))}
      </div>
    </SettingsCard>
  );
}


// ─── Typography (Fonts) ──────────────────────────────────────────────

function TypographySection() {
  const { font, setFont } = useAppStore();

  const fonts = [
    { id: 'satoshi', label: 'Editorial Satoshi', detail: 'Premium geometrical display typography', sample: 'Satoshi font active' },
    { id: 'system', label: 'SF Pro System', detail: 'Standard San Francisco system typography', sample: 'SF Pro Font Active' },
    { id: 'mono', label: 'Atkinson Mono', detail: 'High-legibility monospaced typeface', sample: 'mono font active' },
  ] as const;

  return (
    <SettingsCard title="Console Typography" description="Select typeface for metrics, logs, and layout UI" icon={Type}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {fonts.map((f) => (
          <button
            key={f.id}
            onClick={() => setFont(f.id)}
            className={cn(
              'relative flex flex-col justify-between gap-3 rounded-xl border p-4 transition-all text-left w-full hover:bg-[var(--bg-secondary)]/50',
              font === f.id
                ? 'border-eshodha-500 bg-eshodha-500/5'
                : 'border-[var(--border-secondary)]'
            )}
          >
            <div className="w-full">
              <div className="flex items-center gap-1.5">
                {font === f.id && <Check size={14} className="text-eshodha-500 flex-shrink-0" />}
                <span className="text-xs font-bold text-[var(--text-primary)]">{f.label}</span>
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-tertiary)] leading-tight">{f.detail}</p>
            </div>

            <div className={cn(
              'w-full py-2.5 px-3 rounded bg-[var(--bg-secondary)] text-[11px] border border-[var(--border-secondary)] uppercase tracking-wider text-center font-bold',
              f.id === 'mono' ? 'font-mono' : ''
            )}>
              {f.sample}
            </div>
          </button>
        ))}
      </div>
    </SettingsCard>
  );
}


// ─── Notifications ──────────────────────────────────────────────────

function NotificationSection() {
  const { 
    notificationThreshold, setNotificationThreshold,
    emailNotifications, setEmailNotifications,
    slackNotifications, setSlackNotifications,
    soarEscalations, setSoarEscalations
  } = useAppStore();

  return (
    <SettingsCard title="Notifications" description="Alert thresholds and regional distribution preferences" icon={Bell}>
      <div className="space-y-5">
        {/* Fraud Alert Threshold */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              Fraud Alert Threshold
            </label>
            <span className="text-sm font-bold text-eshodha-500 font-display">
              {notificationThreshold}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={99}
            value={notificationThreshold}
            onChange={(e) => setNotificationThreshold(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-[var(--bg-tertiary)] accent-eshodha-500 cursor-pointer"
            aria-label="Fraud alert threshold percentage"
          />
          <div className="mt-1 flex justify-between text-[10px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">
            <span>More alerts (50%)</span>
            <span>Critical only (99%)</span>
          </div>
        </div>

        <div className="border-t border-[var(--border-secondary)]/50 pt-4 space-y-4">
          <ToggleRow 
            label="Email notifications" 
            checked={emailNotifications} 
            onChange={setEmailNotifications} 
          />
          <ToggleRow 
            label="Slack integration" 
            checked={slackNotifications} 
            onChange={setSlackNotifications} 
          />
          <ToggleRow 
            label="SOAR escalation alerts" 
            checked={soarEscalations} 
            onChange={setSoarEscalations} 
          />
        </div>
      </div>
    </SettingsCard>
  );
}


// ─── API Key Management Panel ────────────────────────────────────────

interface ToastApi {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type'], duration?: number) => string;
  addProgressToast: (message: string) => string;
  removeToast: (id: string) => void;
}

interface ApiUsageDay {
  day: string;
  requests: number;
}

const MOCK_API_USAGE: ApiUsageDay[] = [
  { day: 'Mon', requests: 1_842 },
  { day: 'Tue', requests: 2_391 },
  { day: 'Wed', requests: 1_956 },
  { day: 'Thu', requests: 3_104 },
  { day: 'Fri', requests: 2_678 },
  { day: 'Sat', requests: 1_203 },
  { day: 'Sun', requests: 987 },
];

function APIKeySection({ toast }: { toast: ToastApi }) {
  const { apiKey, setApiKey } = useAppStore();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const keyCreatedDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 42);
    return d;
  }, []);

  const keyExpiryDate = useMemo(() => {
    const d = new Date(keyCreatedDate);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [keyCreatedDate]);

  const maskedKey = useMemo(() => {
    if (apiKey.length <= 12) return '•'.repeat(40);
    return apiKey.slice(0, 8) + '•'.repeat(apiKey.length - 12) + apiKey.slice(-4);
  }, [apiKey]);

  const maxRequests = Math.max(...MOCK_API_USAGE.map((d) => d.requests));

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.addToast('API key copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setShowConfirmDialog(true);
  };

  const confirmRegenerate = () => {
    setShowConfirmDialog(false);
    setRegenerating(true);
    setTimeout(() => {
      const chars = '0123456789abcdef';
      const randomHex = Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * 16)]).join('');
      const newKey = `efs_live_${randomHex}_2026`;
      setApiKey(newKey);
      setRegenerating(false);
      toast.addToast('API Key regenerated and saved successfully!', 'success');
    }, 800);
  };

  return (
    <SettingsCard title="API Key Management" description="Manage developer access tokens for webhook integrations" icon={Key}>
      {/* Key display */}
      <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            Production API Key
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowKey(!showKey)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Copy key"
            >
              {copied ? <Check size={14} className="text-risk-low" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
        <code className="block text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-card)] p-2.5 rounded border border-[var(--border-secondary)]">
          {showKey ? apiKey : maskedKey}
        </code>
      </div>

      {/* Key metadata */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Created', value: keyCreatedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), icon: Calendar },
          { label: 'Expires', value: keyExpiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), icon: Calendar },
          { label: 'Today', value: '2,341 req', icon: BarChart3 },
          { label: 'Rate Limit', value: '7,659 left', icon: AlertTriangle },
        ].map((stat) => (
          <div key={stat.label} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
            <div className="flex items-center gap-1.5 mb-1">
              <stat.icon size={11} className="text-[var(--text-tertiary)]" />
              <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{stat.label}</span>
            </div>
            <span className="text-xs font-bold text-[var(--text-primary)] font-mono">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Mini bar chart — 7-day usage */}
      <div className="mt-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">API Usage — Last 7 Days</span>
          <span className="text-[10px] font-mono text-[var(--text-tertiary)]">{MOCK_API_USAGE.reduce((a, d) => a + d.requests, 0).toLocaleString()} total</span>
        </div>
        <div className="flex items-end gap-1.5 h-16" role="img" aria-label="Bar chart showing API usage over the last 7 days">
          {MOCK_API_USAGE.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-eshodha-500/60 hover:bg-eshodha-500 transition-colors cursor-default"
                style={{ height: `${Math.max((d.requests / maxRequests) * 100, 8)}%` }}
                title={`${d.day}: ${d.requests.toLocaleString()} requests`}
              />
              <span className="text-[8px] font-bold text-[var(--text-tertiary)] uppercase">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regenerate button */}
      <button 
        onClick={handleRegenerate}
        disabled={regenerating}
        className="btn-secondary w-full mt-3 text-xs font-bold flex items-center justify-center gap-1.5 py-2 disabled:opacity-50"
      >
        <RefreshCw size={13} className={cn(regenerating && 'animate-spin')} /> 
        {regenerating ? 'Regenerating Webhook Token…' : 'Regenerate API Key'}
      </button>

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <ConfirmDialog
          title="Regenerate API Key?"
          message="This will invalidate the current production API key immediately. All active integrations using this key will stop working. This action cannot be undone."
          confirmLabel="Regenerate Key"
          onConfirm={confirmRegenerate}
          onCancel={() => setShowConfirmDialog(false)}
        />
      )}
    </SettingsCard>
  );
}


// ─── Data Region ────────────────────────────────────────────────────

function RegionSection() {
  const { region, setRegion } = useAppStore();
  const [syncing, setSyncing] = useState(false);

  const regions = [
    { id: 'ap-south-1', label: 'India (Mumbai)', law: 'DPDP Act 2023' },
    { id: 'eu-west-1', label: 'EU (Ireland)', law: 'GDPR Directive' },
    { id: 'us-east-1', label: 'US (Virginia)', law: 'GLBA + CCPA Mandates' },
    { id: 'ap-southeast-1', label: 'APAC (Singapore)', law: 'PDPA Compliance' },
  ] as const;

  const handleRegionChange = (regId: typeof region) => {
    setRegion(regId);
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1200);
  };

  return (
    <SettingsCard title="Data Region" description="Data residency and sovereignty localization rules" icon={Globe}>
      <div className="space-y-2">
        {regions.map((r) => (
          <button
            key={r.id}
            onClick={() => handleRegionChange(r.id)}
            className={cn(
              'w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left',
              region === r.id
                ? 'border-eshodha-500 bg-eshodha-500/5'
                : 'border-[var(--border-secondary)] hover:border-[var(--border-primary)]'
            )}
          >
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">{r.label}</p>
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold mt-0.5">{r.law}</p>
            </div>
            {region === r.id && (
              <div className="w-5 h-5 rounded-full bg-eshodha-500 flex items-center justify-center flex-shrink-0">
                <Check size={12} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      {syncing && (
        <div className="mt-3 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3 text-[10px] font-mono text-[var(--text-secondary)] space-y-1 animate-pulse">
          <div>&gt; Dynamic regional re-routing triggered for {region}...</div>
          <div>&gt; Mapping sharded database nodes to local data vaults...</div>
          <div>&gt; Propagating BGP geo-dns edge rules across 4 locations...</div>
        </div>
      )}
    </SettingsCard>
  );
}


// ─── Audit Preferences ──────────────────────────────────────────────

interface AuditPreference {
  id: string;
  label: string;
  description: string;
}

const AUDIT_PREFS: AuditPreference[] = [
  { id: 'log-decisions', label: 'Log all model decisions', description: 'Record every ML model inference with input features and output scores for full audit trail' },
  { id: 'session-recording', label: 'Enable session recording', description: 'Capture anonymized operator session replays for compliance review and training' },
  { id: 'export-on-logout', label: 'Export audit on logout', description: 'Automatically export session audit log as encrypted bundle when operators sign out' },
  { id: 'auto-sar', label: 'Automatic SAR filing at risk >90', description: 'Trigger Suspicious Activity Report workflow when any transaction risk score exceeds 90%' },
];

function AuditPreferencesSection({ toast }: { toast: ToastApi }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    'log-decisions': true,
    'session-recording': false,
    'export-on-logout': false,
    'auto-sar': true,
  });

  const handleToggle = useCallback((id: string, label: string) => {
    setPrefs((prev) => {
      const newVal = !prev[id];
      toast.addToast(`${label} ${newVal ? 'enabled' : 'disabled'}`, newVal ? 'success' : 'warning');
      return { ...prev, [id]: newVal };
    });
  }, [toast]);

  return (
    <SettingsCard title="Audit Preferences" description="Configure compliance logging and automated filing rules" icon={ClipboardList}>
      <div className="space-y-1">
        {AUDIT_PREFS.map((pref) => (
          <div
            key={pref.id}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-secondary)]/50 transition-colors"
          >
            <div className="flex-1 min-w-0 mr-4">
              <span className="text-xs font-bold text-[var(--text-primary)]">{pref.label}</span>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 leading-tight">{pref.description}</p>
            </div>
            <button
              role="switch"
              aria-checked={prefs[pref.id]}
              aria-label={`Toggle ${pref.label}`}
              onClick={() => handleToggle(pref.id, pref.label)}
              className={cn(
                'relative w-10 h-5.5 rounded-full transition-colors flex items-center p-0.5 border border-[var(--border-secondary)] flex-shrink-0',
                prefs[pref.id] ? 'bg-eshodha-500' : 'bg-[var(--bg-tertiary)]'
              )}
            >
              <div className={cn(
                'w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform',
                prefs[pref.id] ? 'translate-x-[18px]' : 'translate-x-0'
              )} />
            </button>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}


// ─── Team & Role Management ─────────────────────────────────────────

type TeamRole = 'Admin' | 'Analyst' | 'Compliance Officer' | 'Viewer';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  lastActive: string;
  status: 'active' | 'inactive';
  avatar: string;
}

const MOCK_TEAM: TeamMember[] = [
  { id: 'TM-001', name: 'Arjun Mehta', email: 'arjun.m@credline.io', role: 'Admin', lastActive: '2 min ago', status: 'active', avatar: 'AM' },
  { id: 'TM-002', name: 'Priya Sharma', email: 'priya.s@credline.io', role: 'Compliance Officer', lastActive: '15 min ago', status: 'active', avatar: 'PS' },
  { id: 'TM-003', name: 'Rahul Gupta', email: 'rahul.g@credline.io', role: 'Analyst', lastActive: '1 hr ago', status: 'active', avatar: 'RG' },
  { id: 'TM-004', name: 'Sarah Chen', email: 'sarah.c@credline.io', role: 'Analyst', lastActive: '3 hr ago', status: 'active', avatar: 'SC' },
  { id: 'TM-005', name: 'David Park', email: 'david.p@credline.io', role: 'Viewer', lastActive: '2 days ago', status: 'inactive', avatar: 'DP' },
  { id: 'TM-006', name: 'Aisha Khan', email: 'aisha.k@credline.io', role: 'Compliance Officer', lastActive: '45 min ago', status: 'active', avatar: 'AK' },
];

const ROLE_COLORS: Record<TeamRole, string> = {
  'Admin': 'bg-accent-purple/15 text-accent-purple border-accent-purple/20',
  'Analyst': 'bg-eshodha-500/15 text-eshodha-500 border-eshodha-500/20',
  'Compliance Officer': 'bg-risk-medium/15 text-risk-medium border-risk-medium/20',
  'Viewer': 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-secondary)]',
};

function TeamRoleManagementSection({ toast }: { toast: ToastApi }) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [members] = useState<TeamMember[]>(MOCK_TEAM);

  return (
    <SettingsCard title="Team & Roles" description="Manage team member access levels and permissions" icon={Users}>
      {/* Stats header */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: 'Total', value: members.length },
          { label: 'Active', value: members.filter((m) => m.status === 'active').length },
          { label: 'Admins', value: members.filter((m) => m.role === 'Admin').length },
          { label: 'Roles', value: new Set(members.map((m) => m.role)).size },
        ].map((s) => (
          <div key={s.label} className="text-center p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
            <div className="text-lg font-bold text-[var(--text-primary)] font-display">{s.value}</div>
            <div className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Team table */}
      <div className="rounded-xl border border-[var(--border-secondary)] overflow-hidden">
        <table className="w-full text-xs" role="table" aria-label="Team members table">
          <thead className="bg-[var(--bg-secondary)]">
            <tr>
              <th className="px-3 py-2.5 text-left text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Member</th>
              <th className="px-3 py-2.5 text-left text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider hidden sm:table-cell">Role</th>
              <th className="px-3 py-2.5 text-left text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider hidden md:table-cell">Last Active</th>
              <th className="px-3 py-2.5 text-right text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                className="border-t border-[var(--border-secondary)]/50 hover:bg-[var(--bg-secondary)]/30 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-eshodha-500/20 flex items-center justify-center text-[10px] font-bold text-eshodha-500 flex-shrink-0">
                      {member.avatar}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">{member.name}</div>
                      <div className="text-[10px] text-[var(--text-tertiary)] truncate">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 hidden sm:table-cell">
                  <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold', ROLE_COLORS[member.role])}>
                    {member.role}
                  </span>
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono">{member.lastActive}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={cn(
                    'inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider',
                    member.status === 'active' ? 'text-risk-low' : 'text-[var(--text-tertiary)]'
                  )}>
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      member.status === 'active' ? 'bg-risk-low animate-pulse' : 'bg-[var(--text-tertiary)]'
                    )} />
                    {member.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite button */}
      <button
        onClick={() => setShowInviteModal(true)}
        className="btn-secondary w-full mt-3 text-xs font-bold flex items-center justify-center gap-1.5 py-2"
        aria-label="Invite new team member"
      >
        <UserPlus size={13} />
        Invite Team Member
      </button>

      {/* Invite modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInvite={(name: string, email: string, role: TeamRole) => {
            setShowInviteModal(false);
            toast.addToast(`Invitation sent to ${name} (${email}) as ${role}`, 'success');
          }}
        />
      )}
    </SettingsCard>
  );
}

function InviteModal({ onClose, onInvite }: { onClose: () => void; onInvite: (name: string, email: string, role: TeamRole) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('Viewer');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim()) {
      onInvite(name.trim(), email.trim(), role);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Invite team member"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-eshodha-500/10 flex items-center justify-center">
              <UserPlus size={16} className="text-eshodha-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Invite Member</h3>
              <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Send a secure invitation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)]" aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
              className="w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-eshodha-500"
              aria-label="Full name"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                required
                className="w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] pl-9 pr-3 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-eshodha-500"
                aria-label="Email address"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
              className="w-full rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-3 py-2.5 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-eshodha-500"
              aria-label="Select role"
            >
              <option value="Admin">Admin</option>
              <option value="Analyst">Analyst</option>
              <option value="Compliance Officer">Compliance Officer</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[var(--border-secondary)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg bg-eshodha-500 text-white text-xs font-bold hover:bg-eshodha-500/90 transition-colors flex items-center justify-center gap-1.5"
            >
              <Mail size={13} />
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── Data Retention Policy ──────────────────────────────────────────

interface RetentionPolicy {
  id: string;
  label: string;
  description: string;
  min: number;
  max: number;
  unit: string;
  storagePerDay: number; // MB per day of retention
}

const RETENTION_POLICIES: RetentionPolicy[] = [
  { id: 'transaction', label: 'Transaction Data', description: 'Raw payment and transaction records', min: 30, max: 365, unit: 'days', storagePerDay: 2.4 },
  { id: 'audit', label: 'Audit Log Retention', description: 'System event logs and compliance records', min: 90, max: 730, unit: 'days', storagePerDay: 0.8 },
  { id: 'model', label: 'Model Artifact Retention', description: 'Trained model weights and feature stores', min: 30, max: 180, unit: 'days', storagePerDay: 12.5 },
];

function DataRetentionSection() {
  const [values, setValues] = useState<Record<string, number>>({
    transaction: 180,
    audit: 365,
    model: 90,
  });

  const totalStorage = useMemo(() => {
    return RETENTION_POLICIES.reduce((sum, p) => sum + (values[p.id] ?? p.min) * p.storagePerDay, 0);
  }, [values]);

  const handleChange = useCallback((id: string, val: number) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  }, []);

  const formatStorage = (mb: number): string => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <SettingsCard title="Data Retention Policy" description="Configure how long different data categories are stored" icon={Database}>
      <div className="space-y-5">
        {RETENTION_POLICIES.map((policy) => {
          const currentVal = values[policy.id] ?? policy.min;
          const storageEstimate = currentVal * policy.storagePerDay;
          const progressPercent = ((currentVal - policy.min) / (policy.max - policy.min)) * 100;

          return (
            <div key={policy.id} className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-xs font-bold text-[var(--text-primary)]">{policy.label}</span>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{policy.description}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <span className="text-sm font-bold text-eshodha-500 font-display">{currentVal}</span>
                  <span className="text-[10px] text-[var(--text-tertiary)] ml-1">{policy.unit}</span>
                </div>
              </div>

              <input
                type="range"
                min={policy.min}
                max={policy.max}
                value={currentVal}
                onChange={(e) => handleChange(policy.id, Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-[var(--bg-tertiary)] accent-eshodha-500 cursor-pointer mt-3"
                aria-label={`${policy.label} retention period in ${policy.unit}`}
              />

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">{policy.min}d</span>
                <div className="flex items-center gap-2">
                  <HardDrive size={10} className="text-[var(--text-tertiary)]" />
                  <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                    ~{formatStorage(storageEstimate)}
                  </span>
                  <div className="w-16 h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        progressPercent > 75 ? 'bg-risk-high' : progressPercent > 50 ? 'bg-risk-medium' : 'bg-risk-low'
                      )}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                <span className="text-[9px] text-[var(--text-tertiary)] font-bold uppercase tracking-wider">{policy.max}d</span>
              </div>
            </div>
          );
        })}

        {/* Total storage estimate */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-eshodha-500/20 bg-eshodha-500/5">
          <div className="flex items-center gap-2">
            <HardDrive size={14} className="text-eshodha-500" />
            <span className="text-xs font-bold text-[var(--text-primary)]">Estimated Total Storage</span>
          </div>
          <span className="text-sm font-bold text-eshodha-500 font-mono">{formatStorage(totalStorage)}</span>
        </div>
      </div>
    </SettingsCard>
  );
}


// ─── Export & Backup ────────────────────────────────────────────────

interface ExportAction {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  filename: string;
}

const EXPORT_ACTIONS: ExportAction[] = [
  { id: 'settings', label: 'Export All Settings', description: 'Download current platform configuration as encrypted JSON', icon: FileDown, filename: 'credline-settings-export' },
  { id: 'compliance', label: 'Export Compliance Report', description: 'Generate SOX/SOC2 compliance summary with audit attestation', icon: ClipboardList, filename: 'credline-compliance-report' },
  { id: 'snapshot', label: 'Create System Snapshot', description: 'Full system state backup including model weights and configs', icon: Camera, filename: 'credline-system-snapshot' },
];

function ExportBackupSection({ toast }: { toast: ToastApi }) {
  const [activeExport, setActiveExport] = useState<string | null>(null);

  const handleExport = useCallback((action: ExportAction) => {
    setActiveExport(action.id);
    toast.addProgressToast(`Preparing ${action.label}`);
    setTimeout(() => setActiveExport(null), 2500);
  }, [toast]);

  return (
    <SettingsCard title="Export & Backup" description="Platform data exports, compliance reports, and system snapshots" icon={Download}>
      <div className="space-y-2">
        {EXPORT_ACTIONS.map((action) => {
          const IconComp = action.icon;
          const isActive = activeExport === action.id;
          return (
            <button
              key={action.id}
              onClick={() => handleExport(action)}
              disabled={isActive}
              className={cn(
                'w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left',
                isActive
                  ? 'border-eshodha-500/30 bg-eshodha-500/5 cursor-wait'
                  : 'border-[var(--border-secondary)] hover:border-[var(--border-primary)] hover:bg-[var(--bg-secondary)]/50'
              )}
              aria-label={action.label}
            >
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border',
                isActive
                  ? 'bg-eshodha-500/10 border-eshodha-500/20'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-secondary)]'
              )}>
                <IconComp size={16} className={cn(
                  isActive ? 'text-eshodha-500 animate-pulse' : 'text-[var(--text-secondary)]'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)]">{action.label}</p>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{action.description}</p>
              </div>
              <Download size={14} className={cn(
                'flex-shrink-0',
                isActive ? 'text-eshodha-500 animate-bounce' : 'text-[var(--text-tertiary)]'
              )} />
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}


// ─── System Information ─────────────────────────────────────────────

interface SystemInfoField {
  label: string;
  value: string;
  mono?: boolean;
  badge?: { text: string; color: string };
}

const SYSTEM_INFO: SystemInfoField[] = [
  { label: 'Platform Version', value: 'Credline v2026.5.0-rc.3' },
  { label: 'API Version', value: 'v4.2.1-stable', mono: true },
  { label: 'Build Hash', value: 'a9f3c7e2b41d', mono: true },
  { label: 'Environment', value: 'Production', badge: { text: 'LIVE', color: 'bg-risk-low/15 text-risk-low border-risk-low/20' } },
  { label: 'Node Count', value: '12 active / 14 provisioned' },
  { label: 'Feature Flags', value: '23 enabled / 31 total', badge: { text: 'MANAGED', color: 'bg-eshodha-500/15 text-eshodha-500 border-eshodha-500/20' } },
  { label: 'Last Deployment', value: new Date(Date.now() - 86_400_000 * 3).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
  { label: 'Uptime', value: '99.97% (30d rolling)' },
  { label: 'TLS Certificate', value: 'Valid — expires Dec 2026', badge: { text: 'VALID', color: 'bg-risk-low/15 text-risk-low border-risk-low/20' } },
  { label: 'PQC Status', value: 'ML-KEM-768 + ML-DSA-65', badge: { text: 'NIST', color: 'bg-accent-purple/15 text-accent-purple border-accent-purple/20' } },
];

function SystemInfoSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <SettingsCard title="System Information" description="Platform versioning, deployment, and infrastructure details" icon={Server}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--border-secondary)] hover:bg-[var(--bg-secondary)]/50 transition-all text-left"
        aria-expanded={expanded}
        aria-controls="system-info-panel"
      >
        <div className="flex items-center gap-2">
          <ToggleLeft size={14} className="text-[var(--text-tertiary)]" />
          <span className="text-xs font-bold text-[var(--text-primary)]">
            {expanded ? 'Hide System Details' : 'Show System Details'}
          </span>
        </div>
        <ChevronDown size={14} className={cn('text-[var(--text-tertiary)] transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div id="system-info-panel" className="mt-3 space-y-0 rounded-xl border border-[var(--border-secondary)] overflow-hidden animate-fade-in" role="region" aria-label="System information details">
          {SYSTEM_INFO.map((field, idx) => (
            <div
              key={field.label}
              className={cn(
                'flex items-center justify-between px-4 py-3',
                idx > 0 && 'border-t border-[var(--border-secondary)]/50'
              )}
            >
              <span className="text-xs text-[var(--text-secondary)] font-semibold">{field.label}</span>
              <div className="flex items-center gap-2">
                {field.badge && (
                  <span className={cn('rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider', field.badge.color)}>
                    {field.badge.text}
                  </span>
                )}
                <span className={cn('text-xs font-bold text-[var(--text-primary)]', field.mono && 'font-mono')}>
                  {field.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}


// ─── Diagnostics ────────────────────────────────────────────────────

function DiagnosticsSection() {
  const info = [
    { label: 'Frontend Engine', value: 'React 19 + Vite 6' },
    { label: 'Backend Layer', value: 'FastAPI 0.115' },
    { label: 'Intelligence Engine', value: 'XGBoost GPU + PyTorch 2.5' },
    { label: 'Cryptographic Suite', value: 'ML-KEM-768 + ML-DSA-65 (NIST)' },
    { label: 'Operational Version', value: 'Credline v2026.5.0' },
  ];

  return (
    <SettingsCard title="System Diagnostics" description="Operational details and tech stack info" icon={Shield}>
      <div className="space-y-3">
        {info.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between border-b border-[var(--border-secondary)]/30 pb-2 last:border-0 last:pb-0">
            <span className="text-xs text-[var(--text-secondary)] font-semibold">{label}</span>
            <span className="text-xs font-bold text-[var(--text-primary)] font-mono">{value}</span>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}


// ─── Confirmation Dialog ────────────────────────────────────────────

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-card)] p-6 shadow-2xl animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-risk-high/10 flex items-center justify-center">
            <AlertTriangle size={20} className="text-risk-high" />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-5 mb-5">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-[var(--border-secondary)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg bg-risk-high text-white text-xs font-bold hover:bg-risk-high/90 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Shared Components ──────────────────────────────────────────────

interface SettingsCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function SettingsCard({ title, description, icon: Icon, children }: SettingsCardProps) {
  return (
    <div className="card overflow-hidden p-5 bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-2xl shadow-sm">
      <div className="flex items-center gap-3 mb-5 border-b border-[var(--border-secondary)]/30 pb-4">
        <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--border-secondary)]">
          <Icon size={16} className="text-eshodha-500" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold font-display text-[var(--text-primary)]">{title}</h3>
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs font-bold text-[var(--text-primary)]">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${label}`}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-5.5 rounded-full transition-colors flex items-center p-0.5 border border-[var(--border-secondary)]',
          checked ? 'bg-eshodha-500' : 'bg-[var(--bg-tertiary)]'
        )}
      >
        <div className={cn(
          'w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        )} />
      </button>
    </div>
  );
}
