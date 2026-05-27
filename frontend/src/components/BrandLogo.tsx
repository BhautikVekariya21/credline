import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  to?: string;
};

function Mark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" role="img" focusable="false">
        <rect x="3" y="3" width="34" height="34" rx="8" />
        <path d="M10.5 25.5 17.5 18.5 22.5 23.5 30 13.5" />
        <path d="M10.5 31H30.5" />
        <circle cx="10.5" cy="25.5" r="2.2" />
        <circle cx="17.5" cy="18.5" r="2.2" />
        <circle cx="22.5" cy="23.5" r="2.2" />
        <circle cx="30" cy="13.5" r="2.2" />
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
          <span className="brand-name">Credit Line</span>
          <span className="brand-subtitle">fintech solution</span>
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
    <Link to={to} className={cn('brand-lockup', className)} aria-label="Credit Line home">
      <Lockup compact={compact} />
    </Link>
  );
}
