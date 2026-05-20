import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const data = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  fraud: Math.floor(Math.random() * 40 + 5),
  normal: Math.floor(Math.random() * 500 + 200),
  blocked: Math.floor(Math.random() * 20 + 2),
}));

export default function RiskChart() {
  return (
    <div className="glass p-5 h-[420px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Transaction Risk (24h)</h3>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-eshodha-500" /> Normal</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Fraud</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Blocked</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="gNormal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gFraud" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="hour" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} />
          <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }} />
          <Area type="monotone" dataKey="normal" stroke="#6366f1" fill="url(#gNormal)" strokeWidth={2} />
          <Area type="monotone" dataKey="fraud" stroke="#ef4444" fill="url(#gFraud)" strokeWidth={2} />
          <Area type="monotone" dataKey="blocked" stroke="#f59e0b" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
