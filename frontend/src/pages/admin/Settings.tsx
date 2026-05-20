import { useState } from 'react';
import {
  Bell, Key, Globe, Shield, Monitor,
  Copy, Check, Eye, EyeOff, RefreshCw, Type, RotateCcw,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../lib/utils';

export default function SettingsPage() {
  const { resetToDefaults } = useAppStore();
  const [resetMessage, setResetMessage] = useState<string | null>(null);

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
      <APIKeySection />
      <RegionSection />
      <DiagnosticsSection />
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


// ─── API Keys ───────────────────────────────────────────────────────

function APIKeySection() {
  const { apiKey, setApiKey } = useAppStore();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    setRegenerating(true);
    setSuccessMsg(false);
    setTimeout(() => {
      const chars = '0123456789abcdef';
      const randomHex = Array.from({ length: 20 }, () => chars[Math.floor(Math.random() * 16)]).join('');
      const newKey = `efs_live_${randomHex}_2026`;
      setApiKey(newKey);
      setRegenerating(false);
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 3000);
    }, 800);
  };

  return (
    <SettingsCard title="API Keys" description="Manage developer access tokens for webhook integrations" icon={Key}>
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
          {showKey ? apiKey : '•'.repeat(40)}
        </code>
      </div>

      {successMsg && (
        <div className="mt-2 text-[11px] font-bold text-risk-low text-center animate-fade-in">
          ✓ API Key regenerated and saved successfully!
        </div>
      )}

      <button 
        onClick={handleRegenerate}
        disabled={regenerating}
        className="btn-secondary w-full mt-3 text-xs font-bold flex items-center justify-center gap-1.5 py-2 disabled:opacity-50"
      >
        <RefreshCw size={13} className={cn(regenerating && 'animate-spin')} /> 
        {regenerating ? 'Regenerating Webhook Token…' : 'Regenerate API Key'}
      </button>
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
