import { Shield, TrendingUp, AlertTriangle, Users } from 'lucide-react';

const metrics = [
  { label: 'Transactions / sec', value: '4,827', delta: '+12%', icon: <TrendingUp size={20} />, color: 'from-credit-line-500 to-blue-500' },
  { label: 'Fraud Blocked', value: '2,341', delta: '+8 today', icon: <Shield size={20} />, color: 'from-red-500 to-orange-500' },
  { label: 'Active Alerts', value: '7', delta: '-3 vs avg', icon: <AlertTriangle size={20} />, color: 'from-amber-500 to-yellow-500' },
  { label: 'Credit Scores Issued', value: '18,472', delta: '+340 today', icon: <Users size={20} />, color: 'from-green-500 to-emerald-500' },
];

export default function MetricsCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m, i) => (
        <div key={i} className="glass p-5 hover:bg-white/10 transition-all duration-300 group cursor-default">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider">{m.label}</p>
              <p className="text-3xl font-bold mt-1 bg-gradient-to-r bg-clip-text text-transparent" style={{backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`}}>
                {m.value}
              </p>
              <p className="text-xs text-green-400 mt-1">{m.delta}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity`}>
              {m.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
