import { useEffect, useState } from 'react';
import { useSessionStore } from '../../store/useSessionStore';
import { Lock, ShieldAlert } from 'lucide-react';

export default function AdminSessionIntegrity({ children }: { children: React.ReactNode }) {
  const { isLocked, updateActivity, unlockSession } = useSessionStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  // Monitor activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    
    // Throttle the update to avoid excessive state changes
    let timeout: ReturnType<typeof setTimeout>;
    const handleActivity = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        updateActivity();
      }, 1000);
    };

    events.forEach(e => window.addEventListener(e, handleActivity));
    
    // Also check periodically in case of no activity
    const interval = setInterval(updateActivity, 60000); // Check every minute

    return () => {
      events.forEach(e => window.removeEventListener(e, handleActivity));
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [updateActivity]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockSession(pin)) {
      setPin('');
      setError(false);
    } else {
      setError(true);
      setPin('');
    }
  };

  if (isLocked) {
    return (
      <div className="fixed inset-0 z-[9999] bg-surface-950 flex items-center justify-center backdrop-blur-xl">
        <div className="max-w-md w-full p-8 glass rounded-2xl text-center border-t-2 border-t-eshodha-500 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-eshodha-500/20 flex items-center justify-center mx-auto mb-6 glow-blue">
            <Lock size={32} className="text-eshodha-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Session Locked</h2>
          <p className="text-white/50 mb-8">
            Your session was locked due to inactivity to protect sensitive financial data.
          </p>

          <form onSubmit={handleUnlock}>
            <div className="space-y-4">
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Enter Admin PIN (try 1234)"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-center text-lg tracking-widest text-white outline-none focus:border-eshodha-500/50 transition-colors"
                autoFocus
              />
              {error && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-sm">
                  <ShieldAlert size={14} /> Incorrect PIN. Please try again.
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-eshodha-600 hover:bg-eshodha-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Unlock Session
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
