import { useEffect, useState, useRef, type CSSProperties } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, Network, Bot, Settings,
  ChevronLeft, ChevronRight, Activity, Globe, Zap,
  Database, AlertTriangle, Receipt, DatabaseZap,
  Banknote, LineChart, FileText, Bell, ClipboardList,
  Check, TrendingUp, ShieldCheck, ShieldAlert, Code, Scale
} from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { id: 'overview',       label: 'Dashboard',          icon: LayoutDashboard, path: '/admin' },
  { id: 'fraud',          label: 'Fraud Alerts',        icon: AlertTriangle,   path: '/admin/fraud' },
  { id: 'credit',         label: 'Credit Engine',       icon: CreditCard,      path: '/admin/credit' },
  { id: 'graph',          label: 'Graph Explorer',      icon: Network,         path: '/admin/graph' },
  { id: 'soar',           label: 'SOAR Agents',         icon: Bot,             path: '/admin/soar' },
  { id: 'federation',     label: 'Federation',          icon: Globe,           path: '/admin/federation' },
  { id: 'quantum',        label: 'Quantum Security',    icon: Zap,             path: '/admin/quantum' },
  { id: 'infrastructure', label: 'Infrastructure',      icon: Database,        path: '/admin/infra' },
  { id: 'database',       label: 'DB Connector',        icon: DatabaseZap,     path: '/admin/database' },
  { id: 'tax',            label: 'Tax Center',          icon: Receipt,         path: '/admin/tax' },
  { id: 'strategy',       label: 'CFO Strategy',        icon: TrendingUp,      path: '/admin/strategy' },
  { id: 'treasury',       label: 'Trust & Treasury',    icon: ShieldCheck,     path: '/admin/treasury' },
  { id: 'ceo',            label: 'CEO Control Room',    icon: ShieldAlert,     path: '/admin/ceo' },
  { id: 'godseye',        label: 'God\'s Eye Resiliency', icon: Activity,        path: '/admin/godseye' },
  { id: 'developers',     label: 'Developer Portal',    icon: Code,            path: '/admin/developers' },
  { id: 'institutional',  label: 'Institutional RWA',   icon: Scale,           path: '/admin/institutional' },
  // ─── Service Modules ──────────────────────────────
  { id: 'payments',       label: 'Payment Intel',       icon: Banknote,        path: '/admin/payments' },
  { id: 'wealth',         label: 'Wealth Risk',         icon: LineChart,       path: '/admin/wealth' },
  { id: 'regtech',        label: 'RegTech Console',     icon: FileText,        path: '/admin/regtech' },
  // ─── Operations ───────────────────────────────────
  { id: 'notifications',  label: 'Notifications',       icon: Bell,            path: '/admin/notifications' },
  { id: 'audit',          label: 'Audit Trail',         icon: ClipboardList,   path: '/admin/audit' },
  // ─── Settings ─────────────────────────────────────
  { id: 'settings',       label: 'Preferences',         icon: Settings,        path: '/admin/settings' },
];

export default function AppLayout() {
  const { sidebarOpen, setSidebarOpen, theme, font, notifications, markAsRead, setTheme, setFont } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const cmdPaletteInputRef = useRef<HTMLInputElement>(null);

  const activeItem = NAV_ITEMS.find(n => n.path === location.pathname) || NAV_ITEMS[0];
  const shellStyle = { '--admin-sidebar-width': sidebarOpen ? '16rem' : '72px' } as CSSProperties;
  const unreadCount = notifications.filter(n => !n.read).length;

  // Command palette event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdPaletteOpen(v => !v);
      }
      if (e.key === 'Escape') {
        setIsCmdPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isCmdPaletteOpen) {
      setTimeout(() => cmdPaletteInputRef.current?.focus(), 80);
    } else {
      setSearchQuery('');
    }
  }, [isCmdPaletteOpen]);

  const actions = [
    ...NAV_ITEMS.map(item => ({
      name: `Navigate: Go to ${item.label}`,
      category: 'Navigation',
      icon: item.icon,
      perform: () => { navigate(item.path); setIsCmdPaletteOpen(false); }
    })),
    {
      name: 'Theme: Toggle Dark Mode',
      category: 'Preferences',
      icon: Settings,
      perform: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); setIsCmdPaletteOpen(false); }
    },
    {
      name: 'Font: Default to SF Pro / System',
      category: 'Preferences',
      icon: Code,
      perform: () => { setFont('system'); setIsCmdPaletteOpen(false); }
    },
    {
      name: 'Font: Set Atkinson Hyperlegible Mono',
      category: 'Preferences',
      icon: Code,
      perform: () => { setFont('mono'); setIsCmdPaletteOpen(false); }
    },
    {
      name: 'Font: Set Satoshi (Harmonious)',
      category: 'Preferences',
      icon: Code,
      perform: () => { setFont('satoshi'); setIsCmdPaletteOpen(false); }
    }
  ];

  const filteredActions = actions.filter(act =>
    act.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    act.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Synchronization handled by ThemeContext.tsx


  // Close bell dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close bell on route change
  useEffect(() => { setBellOpen(false); }, [location.pathname]);

  const recentNotifs = notifications.slice(0, 6);

  return (
    <div className="admin-site min-h-screen flex" data-theme={theme} data-font={font} style={shellStyle}>
      {/* ─── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={cn(
          'admin-sidebar fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300',
          'bg-[var(--bg-overlay)] border-r border-[var(--border-secondary)]',
          sidebarOpen ? 'w-64' : 'w-[72px]'
        )}
      >
        {/* Brand */}
        <div className="px-4 py-5 flex items-center gap-3 border-b border-[var(--border-secondary)]">
          <BrandLogo compact={!sidebarOpen} to="" className={cn(!sidebarOpen && 'w-full justify-center')} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeItem.id === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-[var(--text-primary)] text-[var(--text-inverse)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                )}
                title={item.label}
              >
                <item.icon size={20} className="flex-shrink-0" />
                {sidebarOpen && (
                  <span className="admin-nav-label animate-fade-in truncate">{item.label}</span>
                )}
                {/* Show unread badge on Notifications nav item */}
                {item.id === 'notifications' && unreadCount > 0 && sidebarOpen && (
                  <span className="ml-auto rounded-full bg-risk-high px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {item.id === 'notifications' && unreadCount > 0 && !sidebarOpen && (
                  <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-risk-high" />
                )}
                {isActive && sidebarOpen && item.id !== 'notifications' && (
                  <div className="admin-active-dot ml-auto h-1.5 w-1.5 rounded-sm bg-[var(--brand-accent)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-[var(--border-secondary)]">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            {sidebarOpen && <span className="admin-collapse-label text-xs font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────────────────── */}
      <div className={cn(
        'admin-content-shell flex-1 flex flex-col transition-all duration-300',
        sidebarOpen ? 'ml-64' : 'ml-[72px]'
      )}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-[var(--border-secondary)] bg-[var(--bg-overlay)] px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase text-[var(--text-tertiary)]">Credit Line</span>
                <span className="text-[var(--text-tertiary)]">/</span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {activeItem.label}
                </span>
              </div>
              
              {/* CMD+K Global Command Button */}
              <button
                onClick={() => setIsCmdPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all cursor-pointer select-none"
              >
                <span>Search controls...</span>
                <kbd className="font-mono bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[10px] border border-[var(--border-secondary)] font-bold">⌘K</kbd>
              </button>
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-3">
              {/* System Status */}
              <div className="hidden items-center gap-2 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 sm:flex">
                <div className="w-2 h-2 rounded-sm bg-risk-low pulse-dot" />
                <span className="text-xs font-medium text-risk-low">All Systems Operational</span>
              </div>

              {/* Notification Bell */}
              <div className="relative" ref={bellRef}>
                <button
                  onClick={() => setBellOpen(v => !v)}
                  className="relative rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-risk-high px-1 text-[9px] font-bold text-white leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Bell dropdown */}
                {bellOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[380px] rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-overlay)] shadow-2xl backdrop-blur-xl animate-fade-in z-50">
                    <div className="flex items-center justify-between border-b border-[var(--border-secondary)] px-4 py-3">
                      <span className="text-xs font-bold text-[var(--text-primary)]">Notifications</span>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-risk-high/15 px-2 py-0.5 text-[9px] font-bold text-risk-high">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto">
                      {recentNotifs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <Bell size={24} className="text-[var(--text-tertiary)]" />
                          <p className="mt-2 text-xs text-[var(--text-secondary)]">No notifications</p>
                        </div>
                      ) : (
                        recentNotifs.map((notif) => (
                          <div
                            key={notif.id}
                            className={cn(
                              'flex items-start gap-3 px-4 py-3 border-b border-[var(--border-secondary)] last:border-0 transition-colors hover:bg-[var(--bg-secondary)]/50',
                              !notif.read && 'bg-credit-line-500/5'
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                {!notif.read && <span className="h-1.5 w-1.5 rounded-full bg-credit-line-500 flex-shrink-0" />}
                                <p className={cn('text-xs font-semibold truncate', notif.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>
                                  {notif.title}
                                </p>
                              </div>
                              <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)] line-clamp-2">{notif.message}</p>
                              <p className="mt-1 text-[9px] font-mono text-[var(--text-tertiary)]">
                                {new Date(notif.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
                              </p>
                            </div>
                            {!notif.read && (
                              <button
                                onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                className="mt-1 rounded p-1 text-[var(--text-tertiary)] hover:text-risk-low hover:bg-[var(--bg-secondary)]"
                                title="Mark as read"
                              >
                                <Check size={12} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-t border-[var(--border-secondary)] px-4 py-2.5">
                      <button
                        onClick={() => { navigate('/admin/notifications'); setBellOpen(false); }}
                        className="w-full rounded-lg bg-[var(--bg-secondary)] py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
                      >
                        View all notifications
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Indicator */}
              <div className="flex items-center gap-1.5">
                <Activity size={14} className="text-credit-line-500" />
                <span className="text-xs font-medium text-[var(--text-secondary)]">Live</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="admin-main flex-1 bg-[var(--bg-primary)] p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Global CMD+K Command Palette Modal */}
      {isCmdPaletteOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex justify-center pt-[15vh] p-4 font-sans animate-fade-in" onClick={() => setIsCmdPaletteOpen(false)}>
          <div 
            className="w-full max-w-xl bg-[var(--bg-overlay)] border border-[var(--border-secondary)] rounded-xl shadow-2xl overflow-hidden flex flex-col h-[400px] animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input bar */}
            <div className="flex items-center border-b border-[var(--border-secondary)] px-4 py-3 gap-3 bg-[var(--bg-card)]">
              <Code size={18} className="text-[var(--text-secondary)] shrink-0" />
              <input
                ref={cmdPaletteInputRef}
                type="text"
                placeholder="Search pages, actions, and developer resources... (ESC to close)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
              />
            </div>

            {/* Actions list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredActions.length === 0 ? (
                <div className="text-center py-12 text-xs text-[var(--text-tertiary)] font-mono">
                  No matching admin controls or pages found...
                </div>
              ) : (
                filteredActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={action.perform}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <action.icon size={16} className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] flex-shrink-0" />
                      <span>{action.name}</span>
                    </div>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold tracking-wider font-mono border border-[var(--border-secondary)] bg-[var(--bg-secondary)] text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]">
                      {action.category}
                    </span>
                  </button>
                ))
              )}
            </div>
            
            {/* Command Palette Footer */}
            <div className="border-t border-[var(--border-secondary)] px-4 py-2 bg-[var(--bg-card)] text-[10px] text-[var(--text-tertiary)] flex items-center justify-between font-mono">
              <span>Navigate with arrow keys & enter</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
