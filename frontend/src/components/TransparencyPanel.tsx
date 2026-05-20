import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CheckCircle, XCircle, Info } from 'lucide-react';

const factors = [
  { name: 'Utility On-Time Rate', impact: 0.22, value: '92%', positive: true },
  { name: 'SIM Tenure', impact: 0.15, value: '24 months', positive: true },
  { name: 'Data Usage Consistency', impact: 0.12, value: '0.87', positive: true },
  { name: 'Top-Up Regularity', impact: -0.18, value: '0.34', positive: false },
  { name: 'Missed Payments', impact: -0.10, value: '2', positive: false },
];

const chartData = factors.map(f => ({ name: f.name, impact: Math.round(f.impact * 100) }));

export default function TransparencyPanel() {
  const creditScore = 672;
  const scoreColor = creditScore >= 700 ? 'text-green-400' : creditScore >= 580 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      <div className="glass p-8 text-center">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Your AI Credit Score</p>
        <p className={`text-7xl font-extrabold ${scoreColor}`}>{creditScore}</p>
        <p className="text-sm text-white/40 mt-2">Range: 300 – 850 · Confidence: ±45 pts</p>
        <div className="mt-6 w-full max-w-md mx-auto h-3 rounded-full bg-surface-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-green-500"
            style={{ width: `${((creditScore - 300) / 550) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Factor Breakdown */}
        <div className="glass p-6">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Info size={16} /> Score Factors
          </h3>
          <div className="space-y-3">
            {factors.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                {f.positive ? <CheckCircle size={18} className="text-green-400 shrink-0" /> : <XCircle size={18} className="text-red-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80">{f.name}</p>
                  <p className="text-xs text-white/40">Value: {f.value}</p>
                </div>
                <span className={`text-sm font-bold ${f.positive ? 'text-green-400' : 'text-red-400'}`}>
                  {f.impact > 0 ? '+' : ''}{(f.impact * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Impact Chart */}
        <div className="glass p-6">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Feature Impact</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <XAxis type="number" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={150} stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
              <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
              <Bar dataKey="impact" radius={[0, 6, 6, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.impact >= 0 ? '#22c55e' : '#ef4444'} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
