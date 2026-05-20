import { useState, useEffect } from 'react';

interface Transaction {
  id: string; user: string; amount: string; risk: 'low' | 'medium' | 'high' | 'critical'; time: string;
}

const riskColors = { low: 'text-green-400', medium: 'text-amber-400', high: 'text-red-400', critical: 'text-red-600' };
const riskBg = { low: 'bg-green-400/10', medium: 'bg-amber-400/10', high: 'bg-red-400/10', critical: 'bg-red-600/10' };

const mockTx = (): Transaction => {
  const risks: Transaction['risk'][] = ['low', 'low', 'low', 'medium', 'high', 'critical'];
  const risk = risks[Math.floor(Math.random() * risks.length)];
  return {
    id: `TXN-${Math.random().toString(36).slice(2, 8)}`,
    user: `USR-${Math.random().toString(36).slice(2, 6)}`,
    amount: `$${(Math.random() * 5000 + 10).toFixed(2)}`,
    risk,
    time: new Date().toLocaleTimeString(),
  };
};

export default function TransactionFeed() {
  const [transactions, setTransactions] = useState<Transaction[]>(
    Array.from({ length: 8 }, mockTx)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTransactions(prev => [mockTx(), ...prev.slice(0, 19)]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass p-5 h-[420px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Live Feed</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
          <span className="text-xs text-green-400/70">Streaming</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {transactions.map((tx, i) => (
          <div key={`${tx.id}-${i}`}
            className={`flex items-center justify-between p-3 rounded-xl ${riskBg[tx.risk]} hover:bg-white/10 transition-all duration-200 ${i === 0 ? 'animate-pulse' : ''}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-white/50">{tx.id}</span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${riskColors[tx.risk]} ${riskBg[tx.risk]}`}>
                  {tx.risk}
                </span>
              </div>
              <p className="text-xs text-white/40 mt-0.5">{tx.user} • {tx.time}</p>
            </div>
            <span className="text-sm font-semibold text-white/80 ml-2">{tx.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
