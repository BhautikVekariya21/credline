import { useState, useEffect, useRef } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../lib/utils';
import { AlertCircle, ShieldAlert, ShieldCheck, Activity } from 'lucide-react';

interface Transaction {
  id: string;
  user: string;
  amount: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  time: string;
  merchant: string;
}

const riskConfig = {
  low: { color: 'text-green-400', bg: 'bg-green-400/10', icon: ShieldCheck },
  medium: { color: 'text-amber-400', bg: 'bg-amber-400/10', icon: Activity },
  high: { color: 'text-red-400', bg: 'bg-red-400/10', icon: AlertCircle },
  critical: { color: 'text-red-600', bg: 'bg-red-600/10 animate-pulse', icon: ShieldAlert },
};

const columnHelper = createColumnHelper<Transaction>();

const columns = [
  columnHelper.accessor('id', {
    header: 'TXN ID',
    cell: info => <span className="font-mono text-xs text-white/50">{info.getValue()}</span>,
    size: 100,
  }),
  columnHelper.accessor('time', {
    header: 'Time',
    cell: info => <span className="text-xs text-white/40">{info.getValue()}</span>,
    size: 90,
  }),
  columnHelper.accessor('user', {
    header: 'User',
    cell: info => <span className="text-xs text-white/70">{info.getValue()}</span>,
    size: 100,
  }),
  columnHelper.accessor('merchant', {
    header: 'Merchant',
    cell: info => <span className="text-xs text-white/60 truncate block">{info.getValue()}</span>,
    size: 150,
  }),
  columnHelper.accessor('amount', {
    header: 'Amount',
    cell: info => (
      <span className="text-sm font-semibold text-white/90">
        ${info.getValue().toFixed(2)}
      </span>
    ),
    size: 100,
  }),
  columnHelper.accessor('risk', {
    header: 'Risk',
    cell: info => {
      const risk = info.getValue();
      const config = riskConfig[risk];
      const Icon = config.icon;
      return (
        <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase", config.color, config.bg)}>
          <Icon size={12} />
          {risk}
        </div>
      );
    },
    size: 100,
  }),
];

// Mock generator
const generateMockData = (count: number): Transaction[] => {
  const risks: Transaction['risk'][] = ['low', 'low', 'low', 'low', 'medium', 'high', 'critical'];
  const merchants = ['Amazon', 'Walmart', 'CryptoX', 'Local Coffee', 'Uber', 'Apple Store'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `TXN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    user: `USR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    amount: Math.random() * 5000 + 10,
    risk: risks[Math.floor(Math.random() * risks.length)],
    time: new Date(Date.now() - i * 1000).toLocaleTimeString(),
    merchant: merchants[Math.floor(Math.random() * merchants.length)],
  }));
};

export default function StreamingTelemetryGrid() {
  // Start with 5000 transactions to demonstrate virtualized rendering
  const [data, setData] = useState<Transaction[]>(() => generateMockData(5000));
  const [isStreaming, setIsStreaming] = useState(true);

  // Simulate incoming WebSocket stream
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setData(prev => [generateMockData(1)[0], ...prev.slice(0, 9999)]); // Cap at 10k
    }, 500);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44, // row height
    overscan: 20,
  });

  return (
    <div className="glass p-5 flex flex-col h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">
            Streaming Telemetry Grid
          </h3>
          <p className="text-xs text-white/40 mt-1">
            Monitoring {data.length.toLocaleString()} active connections
          </p>
        </div>
        <button 
          onClick={() => setIsStreaming(!isStreaming)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
            isStreaming 
              ? "bg-green-400/10 text-green-400 border-green-400/20 hover:bg-green-400/20" 
              : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"
          )}
        >
          <div className={cn("w-2 h-2 rounded-full", isStreaming ? "bg-green-400 pulse-dot" : "bg-white/30")} />
          {isStreaming ? 'Live Stream Active' : 'Stream Paused'}
        </button>
      </div>

      <div 
        ref={parentRef}
        className="flex-1 overflow-auto rounded-lg border border-white/5 bg-black/20 custom-scrollbar"
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {/* Header (Sticky) */}
          <div className="sticky top-0 z-10 bg-surface-900/90 backdrop-blur border-b border-white/10 flex">
            {table.getFlatHeaders().map(header => (
              <div 
                key={header.id} 
                className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider"
                style={{ width: header.getSize() }}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
              </div>
            ))}
          </div>

          {/* Virtualized Rows */}
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = rows[virtualRow.index];
            const isAnomalous = row.original.risk === 'critical';
            return (
              <div
                key={row.id}
                className={cn(
                  "absolute top-0 left-0 flex items-center border-b border-white/5 transition-colors hover:bg-white/5",
                  isAnomalous ? "bg-red-900/20" : ""
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start + 41}px)`, // +41 for header height
                  width: '100%'
                }}
              >
                {row.getVisibleCells().map(cell => (
                  <div 
                    key={cell.id} 
                    className="px-4 flex items-center"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
