import { useEffect, type CSSProperties } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, Network, Bot, Settings,
  ChevronLeft, ChevronRight, Activity, Globe, Zap,
  Database, AlertTriangle, Receipt, DatabaseZap,
  Banknote, LineChart, FileText,
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
  // ─── New Service Modules ──────────────────────────
  { id: 'payments',       label: 'Payment Intel',       icon: Banknote,        path: '/admin/payments' },
  { id: 'wealth',         label: 'Wealth Risk',         icon: LineChart,       path: '/admin/wealth' },
  { id: 'regtech',        label: 'RegTech Console',     icon: FileText,        path: '/admin/regtech' },
  // ─── Settings ─────────────────────────────────────
  { id: 'settings',       label: 'Preferences',         icon: Settings,        path: '/admin/settings' },
];

export default function AppLayout() {
  const { sidebarOpen, setSidebarOpen, theme, font } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const activeItem = NAV_ITEMS.find(n => n.path === location.pathname) || NAV_ITEMS[0];
  const shellStyle = { '--admin-sidebar-width': sidebarOpen ? '16rem' : '72px' } as CSSProperties;

  useEffect(() => {
    const root = document.documentElement;
    const hadDarkClass = root.classList.contains('dark');
    root.classList.remove('dark');

    return () => {
      if (hadDarkClass) root.classList.add('dark');
    };
  }, []);

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
                {isActive && sidebarOpen && (
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase text-[var(--text-tertiary)]">Credline</span>
              <span className="text-[var(--text-tertiary)]">/</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {activeItem.label}
              </span>
            </div>

            {/* Right Side Controls */}
            <div className="flex items-center gap-4">
              {/* System Status */}
              <div className="hidden items-center gap-2 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5 sm:flex">
                <div className="w-2 h-2 rounded-sm bg-risk-low pulse-dot" />
                <span className="text-xs font-medium text-risk-low">All Systems Operational</span>
              </div>

              {/* Live Indicator */}
              <div className="flex items-center gap-1.5">
                <Activity size={14} className="text-eshodha-500" />
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
    </div>
  );
}
