import { Link } from 'react-router-dom';
import { ArrowUpRight, Github, Linkedin, Mail, Shield, Twitter } from 'lucide-react';
import BrandLogo from './BrandLogo';

const FOOTER_COLS = [
  {
    title: 'Services',
    links: [
      { label: 'Smart Lending',       path: '/services/lending' },
      { label: 'Payment Intelligence',path: '/services/payments' },
      { label: 'Wealth & Investment', path: '/services/wealth' },
      { label: 'InsurTech',           path: '/services/insurance' },
      { label: 'Open Banking',        path: '/services/openbanking' },
      { label: 'RegTech & Compliance',path: '/services/regtech' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Overview',        path: '/platform' },
      { label: 'Security',        path: '/security' },
      { label: 'Graph Intelligence', path: '/platform' },
      { label: 'MLOps & Infra',   path: '/platform' },
      { label: 'Credit Portal',   path: '/portal' },
      { label: 'Risk Console',    path: '/admin' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About',         path: '/about' },
      { label: 'All Services',  path: '/services' },
      { label: 'Documentation', path: '/platform' },
      { label: 'Changelog',     path: '/about' },
    ],
  },
  {
    title: 'Compliance',
    links: [
      { label: 'Privacy Policy',    path: '/about' },
      { label: 'Terms of Service',  path: '/about' },
      { label: 'GDPR & DPDP',       path: '/security' },
      { label: 'SOC 2 Report',      path: '/security' },
      { label: 'PCI DSS',           path: '/security' },
    ],
  },
];

const BADGES = ['SOC 2 Type II', 'PCI DSS', 'ISO 27001', 'GDPR', 'FCRA'];

const SOCIAL = [
  { Icon: Github,   label: 'GitHub',     href: '#' },
  { Icon: Linkedin, label: 'LinkedIn',   href: '#' },
  { Icon: Twitter,  label: 'Twitter/X',  href: '#' },
  { Icon: Mail,     label: 'Email',      href: 'mailto:hello@creditline.io' },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      {/* Top band: newsletter / CTA */}
      <div className="footer-top-band">
        <div className="public-wrap footer-top-inner">
          <div>
            <p className="footer-top-eyebrow">Stay in the loop</p>
            <p className="footer-top-title">Product updates, risk intelligence insights,<br />and compliance guides — monthly.</p>
          </div>
          <form
            className="footer-form"
            onSubmit={(e) => { e.preventDefault(); (e.currentTarget.querySelector('input') as HTMLInputElement).value = ''; }}
          >
            <input
              type="email"
              placeholder="your@bank.com"
              required
              className="footer-input"
              aria-label="Email address"
            />
            <button type="submit" className="footer-form-btn">
              Subscribe <ArrowUpRight size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* Main grid */}
      <div className="footer-main">
        <div className="public-wrap footer-main-inner">
          {/* Brand col */}
          <div className="footer-brand-col">
            <BrandLogo />
            <p className="footer-tagline">
              AI decision infrastructure for fraud prevention, inclusive credit scoring,
              graph intelligence, and audit-ready compliance.
            </p>

            {/* Compliance badges */}
            <div className="footer-badges">
              {BADGES.map(b => (
                <span key={b} className="footer-badge">
                  <Shield size={10} /> {b}
                </span>
              ))}
            </div>

            {/* Social */}
            <div className="footer-social">
              {SOCIAL.map(({ Icon, label, href }) => (
                <a key={label} href={href} aria-label={label} className="footer-social-btn">
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map(col => (
            <div key={col.title} className="footer-col">
              <p className="footer-col-title">{col.title}</p>
              <ul className="footer-col-list">
                {col.links.map(link => (
                  <li key={link.label}>
                    <Link to={link.path} className="footer-col-link">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <div className="public-wrap footer-bottom-inner">
          <p className="footer-copy">© {new Date().getFullYear()} Credit Line Technologies. All rights reserved.</p>
          <p className="footer-copy footer-copy-right">
            Built for regulated institutions ·{' '}
            <Link to="/security" className="footer-bottom-link">Privacy</Link>
            {' · '}
            <Link to="/security" className="footer-bottom-link">Terms</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
