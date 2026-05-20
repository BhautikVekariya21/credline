import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowUpRight, Banknote,
  ChevronDown, Database, FileText, Globe2,
  LineChart, Menu, Network, Shield, ShieldCheck, X,
} from 'lucide-react';
import BrandLogo from './BrandLogo';
import { cn } from '../lib/utils';

const NAV_LINKS = [
  { label: 'Platform', path: '/platform' },
  { label: 'Security', path: '/security' },
  { label: 'About', path: '/about' },
];

const SERVICES = [
  { icon: Shield,      label: 'Smart Lending',       path: '/services/lending',     sub: 'Alt-data underwriting & FCRA decisioning', tag: 'Credit' },
  { icon: Banknote,    label: 'Payment Intelligence', path: '/services/payments',    sub: 'Multi-rail fraud detection & disputes',     tag: 'Payments' },
  { icon: LineChart,   label: 'Wealth & Investment',  path: '/services/wealth',      sub: 'Portfolio risk, KYC & suitability checks',   tag: 'Wealth' },
  { icon: ShieldCheck, label: 'InsurTech',            path: '/services/insurance',   sub: 'Claims fraud detection & telematics UW',    tag: 'Insurance' },
  { icon: Globe2,      label: 'Open Banking',         path: '/services/openbanking', sub: 'PSD2 / AA aggregation & consent mgmt',     tag: 'Open Banking' },
  { icon: FileText,    label: 'RegTech & Compliance', path: '/services/regtech',     sub: 'AML monitoring, SAR & multi-jurisdiction reporting', tag: 'Compliance' },
  { icon: Network,     label: 'Graph Intelligence',   path: '/platform',             sub: 'Fraud ring, mule & contagion detection',    tag: 'Risk' },
  { icon: Database,    label: 'MLOps & Infra',        path: '/platform',             sub: 'Drift monitoring, feature store & serving', tag: 'Infra' },
];

const MEGA_STATS = [
  { value: '<10ms', label: 'Decision latency' },
  { value: '6.8%',  label: 'AML false-positive rate' },
  { value: '214+',  label: 'AML typologies' },
  { value: '8',     label: 'Service verticals' },
];

export default function Navbar() {
  const loc = useLocation();
  const [scrolled, setScrolled]     = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); setServicesOpen(false); }, [loc.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <header className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        'border-b border-[var(--border-secondary)]',
        scrolled ? 'bg-[var(--bg-primary)]/95 backdrop-blur-xl shadow-sm' : 'bg-[var(--bg-primary)]'
      )}>
        <div className="public-wrap flex h-14 items-center gap-6">

          {/* Logo */}
          <BrandLogo />

          {/* Center nav */}
          <nav className="hidden items-center gap-1 md:flex ml-2" aria-label="Primary navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'nav-link',
                  loc.pathname === link.path && 'nav-link-active'
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* Services mega-menu trigger */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setServicesOpen((v) => !v)}
                className={cn(
                  'nav-link flex items-center gap-1',
                  loc.pathname.startsWith('/services') && 'nav-link-active'
                )}
              >
                Services
                <ChevronDown size={13} className={cn('transition-transform duration-200', servicesOpen && 'rotate-180')} />
              </button>

              {/* Mega-menu panel */}
              {servicesOpen && (
                <div className="mega-menu">
                  {/* Left: service grid */}
                  <div className="mega-menu-grid">
                    {SERVICES.map(({ icon: Icon, label, path, sub, tag }) => (
                      <Link key={path + label} to={path} className="mega-item">
                        <span className="mega-item-icon"><Icon size={15} /></span>
                        <span className="mega-item-body">
                          <span className="mega-item-label">{label}</span>
                          <span className="mega-item-sub">{sub}</span>
                        </span>
                        <span className="mega-item-tag">{tag}</span>
                      </Link>
                    ))}
                  </div>

                  {/* Right: stats + CTA */}
                  <div className="mega-menu-side">
                    <p className="mega-side-title">Platform at a glance</p>
                    <div className="mega-stats">
                      {MEGA_STATS.map(s => (
                        <div key={s.label} className="mega-stat">
                          <strong>{s.value}</strong>
                          <span>{s.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mega-side-cta">
                      <Link to="/services" className="mega-all-link">
                        View all services <ArrowUpRight size={13} />
                      </Link>
                      <Link to="/admin" className="mega-console-link">
                        Open console <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Right actions */}
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <Link to="/portal" className="nav-link">Portal</Link>
            <Link to="/admin" className="nav-cta">
              Console <ArrowUpRight size={13} />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="ml-auto p-2 text-[var(--text-secondary)] md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="mobile-drawer">
          <div className="mobile-drawer-inner">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.path} to={link.path} className="mobile-nav-link">{link.label}</Link>
              ))}
              <div className="mobile-section-label">Services</div>
              {SERVICES.map(({ label, path }) => (
                <Link key={path + label} to={path} className="mobile-nav-link">{label}</Link>
              ))}
            </nav>
            <div className="mobile-drawer-actions">
              <Link to="/admin" className="btn-dark w-full text-center">Open console</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
