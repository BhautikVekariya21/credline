import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  to?: string;
};

function Mark() {
  return (
    <span className="brand-mark animate-pulse-subtle" aria-hidden="true" style={{ background: 'transparent', width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="brandGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand-accent)" />
            <stop offset="50%" stopColor="#cc746c" />
            <stop offset="100%" stopColor="var(--brand-green)" />
          </linearGradient>
          <linearGradient id="brandGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--brand-green)" />
            <stop offset="100%" stopColor="var(--brand-soft)" />
          </linearGradient>
        </defs>
        
        {/* Outer glassmorphic frame */}
        <rect x="2" y="2" width="36" height="36" rx="10" fill="var(--bg-card)" stroke="url(#brandGrad1)" strokeWidth="1.5" style={{ opacity: 0.95 }} />
        
        {/* Dynamic Connected Risk Nodes path */}
        <path d="M10 20 Q 20 5, 30 20 T 10 20" stroke="url(#brandGrad1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M10 20 Q 20 35, 30 20" stroke="url(#brandGrad2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        
        {/* Central Core Shield Node representing Credline security */}
        <circle cx="20" cy="20" r="4.5" fill="var(--bg-secondary)" stroke="url(#brandGrad1)" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="1.5" fill="var(--brand-accent)" />
        
        {/* Active connection pulses */}
        <circle cx="10" cy="20" r="2.5" fill="var(--brand-green)" />
        <circle cx="30" cy="20" r="2.5" fill="var(--brand-accent)" />
      </svg>
    </span>
  );
}

function Lockup({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <Mark />
      {!compact && (
        <span className="brand-copy">
          <span className="brand-name" style={{ letterSpacing: '-0.02em', fontSize: '1.05rem', fontWeight: 800 }}>Credline</span>
          <span className="brand-subtitle" style={{ fontSize: '0.52rem', letterSpacing: '0.16em', color: 'var(--brand-accent)' }}>risk intelligence</span>
        </span>
      )}
    </>
  );
}

export default function BrandLogo({ className, compact = false, to = '/' }: BrandLogoProps) {
  if (!to) {
    return (
      <span className={cn('brand-lockup', className)}>
        <Lockup compact={compact} />
      </span>
    );
  }

  return (
    <Link to={to} className={cn('brand-lockup', className)} aria-label="Credline home">
      <Lockup compact={compact} />
    </Link>
  );
}
