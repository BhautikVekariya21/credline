/**
 * eshodha fintech solution — Consumer Portal Layout.
 *
 * Clean, accessible, Apple-esque layout for unbanked credit applicants.
 * WCAG 2.2 AA compliant with SF Pro typography.
 */

import { Outlet } from 'react-router-dom';
import { Shield, Sun, Moon, ArrowRight } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import { cn } from '../../lib/utils';

export default function PortalLayout() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <div className={cn('min-h-screen transition-colors duration-300', theme === 'dark' ? 'dark' : '')}>
      {/* ─── Header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 glass border-b border-[var(--border-secondary)] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-eshodha-500 flex items-center justify-center shadow-lg">
              <Shield size={24} className="text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display text-[var(--text-primary)] tracking-tight">
                eshodha
              </h1>
              <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-[0.2em]">
                fintech solution
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              aria-label="Toggle color mode"
            >
              {theme === 'dark'
                ? <Sun size={16} className="text-amber-400" />
                : <Moon size={16} className="text-surface-500" />
              }
            </button>

            {/* Admin Link */}
            <button
              className="btn-primary text-sm"
              onClick={() => window.location.href = '/admin'}
              aria-label="Admin Login"
            >
              Admin <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Content ───────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <Outlet />
      </main>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-secondary)] mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-eshodha-500" />
            <span className="text-sm font-semibold text-[var(--text-primary)] font-display">
              eshodha fintech solution
            </span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            © 2026 eshodha. Inclusive credit scoring for everyone.
            <span className="mx-2">·</span>
            Quantum-safe · FCRA compliant · WCAG 2.2 AA
          </p>
        </div>
      </footer>
    </div>
  );
}
