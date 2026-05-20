import { useState } from 'react';

interface GraphNode {
  id: string; type: 'user' | 'device' | 'ip' | 'merchant'; risk: number; x: number; y: number;
}

const nodeColors = { user: '#6366f1', device: '#06b6d4', ip: '#f59e0b', merchant: '#22c55e' };

const mockNodes: GraphNode[] = [
  { id: 'USR-001', type: 'user', risk: 0.15, x: 400, y: 250 },
  { id: 'USR-002', type: 'user', risk: 0.82, x: 250, y: 120 },
  { id: 'USR-003', type: 'user', risk: 0.45, x: 550, y: 380 },
  { id: 'DEV-001', type: 'device', risk: 0.1, x: 550, y: 150 },
  { id: 'DEV-002', type: 'device', risk: 0.7, x: 300, y: 350 },
  { id: 'IP-TOR', type: 'ip', risk: 0.9, x: 150, y: 250 },
  { id: 'MRC-CRYPTO', type: 'merchant', risk: 0.8, x: 200, y: 400 },
  { id: 'MRC-SHOP', type: 'merchant', risk: 0.05, x: 600, y: 250 },
];

const mockEdges = [
  ['USR-001', 'DEV-001'], ['USR-001', 'MRC-SHOP'], ['USR-002', 'DEV-002'],
  ['USR-002', 'IP-TOR'], ['USR-002', 'MRC-CRYPTO'], ['USR-003', 'DEV-002'],
  ['USR-003', 'MRC-SHOP'], ['USR-001', 'DEV-002'],
];

export default function GraphView() {
  const [selected, setSelected] = useState<string | null>(null);
  const sel = mockNodes.find(n => n.id === selected);

  return (
    <div className="glass p-6">
      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Explorable Graph — Entity Relationships</h3>
      <div className="flex gap-4 mb-4">
        {Object.entries(nodeColors).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-white/50">
            <span className="w-3 h-3 rounded-full" style={{ background: color }} /> {type}
          </span>
        ))}
      </div>
      <div className="relative bg-surface-900/50 rounded-xl overflow-hidden" style={{ height: 500 }}>
        <svg width="100%" height="100%" viewBox="0 0 750 500">
          {/* Edges */}
          {mockEdges.map(([from, to], i) => {
            const a = mockNodes.find(n => n.id === from)!;
            const b = mockNodes.find(n => n.id === to)!;
            const isHighlighted = selected === from || selected === to;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isHighlighted ? '#6366f1' : 'rgba(255,255,255,0.1)'}
                strokeWidth={isHighlighted ? 2.5 : 1} />
            );
          })}
          {/* Nodes */}
          {mockNodes.map(node => {
            const isSelected = selected === node.id;
            const r = 18 + node.risk * 12;
            return (
              <g key={node.id} onClick={() => setSelected(node.id)} className="cursor-pointer">
                {isSelected && <circle cx={node.x} cy={node.y} r={r + 8} fill="none" stroke={nodeColors[node.type]} strokeWidth={2} opacity={0.4} />}
                <circle cx={node.x} cy={node.y} r={r} fill={nodeColors[node.type]}
                  opacity={node.risk > 0.6 ? 1 : 0.7}
                  stroke={node.risk > 0.6 ? '#ef4444' : 'transparent'} strokeWidth={node.risk > 0.6 ? 2 : 0} />
                <text x={node.x} y={node.y + r + 16} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={10}>
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {sel && (
        <div className="mt-4 glass p-4">
          <h4 className="font-semibold text-eshodha-400">{sel.id}</h4>
          <p className="text-sm text-white/50 mt-1">Type: <span className="text-white/80 capitalize">{sel.type}</span> · Risk Score: <span className={sel.risk > 0.6 ? 'text-red-400' : 'text-green-400'}>{(sel.risk * 100).toFixed(0)}%</span></p>
        </div>
      )}
    </div>
  );
}
