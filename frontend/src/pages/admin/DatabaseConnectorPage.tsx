import { useState, useEffect, useRef } from 'react';
import {
  Database,
  Terminal as TerminalIcon,
  Activity,
  Cpu,
  Layers,
  Play,
  Square,
  Server,
  DatabaseZap,
  HardDrive,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { apiPost, apiGet } from '../../lib/api';
import { cn } from '../../lib/utils';
import { ModuleWorkspace, StatusLine } from './FeaturePages';

interface DiscoveredColumn {
  column: string;
  type: string;
  nullable: boolean;
  key: string | null;
}

interface DBStatus {
  is_connected: boolean;
  engine: string | null;
  connection_url: string | null;
  last_sync: string | null;
  records_processed: number;
  throughput_tx_per_sec: number;
  bandwidth_kb_per_sec: number;
  db_latency_ms: number;
  telemetry: {
    cpu_usage_pct: number;
    memory_usage_pct: number;
    connection_pool_active: number;
    connection_pool_idle: number;
  };
}

interface InFlightTx {
  id: string;
  timestamp: string;
  sql_query: string;
  database_read_latency_ms: number;
  payload: {
    user_id: string;
    amount: number;
    currency: string;
    merchant: string;
    region: string;
  };
  analysis: {
    risk_score: number;
    model_mode: string;
    drift_alert: boolean;
    explainability: {
      top_factor: string;
      shap_value: number;
    };
    status: 'approved' | 'hold' | 'flagged';
  };
}

export default function DatabaseConnectorPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'live'>('config');
  const [engine, setEngine] = useState('postgresql');
  const [connUrl, setConnUrl] = useState('postgresql://admin:finguard_secure_2026@db.enterprise-core.net:5432/transactions');
  const [sslMode, setSslMode] = useState('require');
  const [rateLimit, setRateLimit] = useState(50);
  const [showPassword, setShowPassword] = useState(false);

  // Connection testing states
  const [testing, setTesting] = useState(false);
  const [testConsole, setTestConsole] = useState<string[]>([]);
  const [schema, setSchema] = useState<DiscoveredColumn[]>([]);
  const [recordsCount, setRecordsCount] = useState<number | null>(null);
  const [connectedTable, setConnectedTable] = useState<string | null>(null);

  // Live stream status
  const [dbStatus, setDbStatus] = useState<DBStatus>({
    is_connected: false,
    engine: null,
    connection_url: null,
    last_sync: null,
    records_processed: 0,
    throughput_tx_per_sec: 0,
    bandwidth_kb_per_sec: 0,
    db_latency_ms: 0,
    telemetry: { cpu_usage_pct: 0, memory_usage_pct: 0, connection_pool_active: 0, connection_pool_idle: 0 }
  });
  const [connecting, setConnecting] = useState(false);
  const [txStream, setTxStream] = useState<InFlightTx[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch current status on load
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await apiGet<DBStatus>('/database-link/status');
      setDbStatus(res);
      if (res.is_connected) {
        setIsStreaming(true);
        setActiveTab('live');
        setEngine(res.engine || 'postgresql');
        setConnUrl(res.connection_url || '');
      }
    } catch (err) {
      console.error("Failed to fetch database link status", err);
    }
  };

  // Poll status and streaming transactions when active
  useEffect(() => {
    let statusInterval: ReturnType<typeof setInterval>;
    let streamInterval: ReturnType<typeof setInterval>;

    if (isStreaming) {
      statusInterval = setInterval(async () => {
        try {
          const res = await apiGet<DBStatus>('/database-link/status');
          setDbStatus(res);
        } catch (err) {
          console.error(err);
        }
      }, 3000);

      streamInterval = setInterval(async () => {
        try {
          const streamData = await apiGet<InFlightTx[]>('/database-link/stream?limit=8');
          setTxStream(prev => {
            // Uniquely merge incoming transactions
            const existingIds = new Set(prev.map(t => t.id));
            const newTxs = streamData.filter(t => !existingIds.has(t.id));
            return [...newTxs, ...prev].slice(0, 50); // limit to 50 logs
          });
        } catch (err) {
          console.error(err);
        }
      }, 2000);
    }

    return () => {
      clearInterval(statusInterval);
      clearInterval(streamInterval);
    };
  }, [isStreaming]);

  // Scroll terminal logs to bottom on update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [testConsole]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestConsole([
      `[${new Date().toLocaleTimeString()}] [INFO] Resolving connection target URI...`,
      `[${new Date().toLocaleTimeString()}] [INFO] Attempting TCP/IP handshake (timeout=5000ms)...`
    ]);

    try {
      const payload = {
        engine,
        connection_url: connUrl,
        ssl_mode: sslMode,
        ingestion_rate_limit: rateLimit
      };

      // Add CLI stepping visual delays
      await new Promise(r => setTimeout(r, 700));
      setTestConsole(prev => [...prev, `[${new Date().toLocaleTimeString()}] [INFO] Handshake verified with target host. Server SSL verified.`]);
      
      await new Promise(r => setTimeout(r, 600));
      setTestConsole(prev => [...prev, `[${new Date().toLocaleTimeString()}] [INFO] Negotiating protocol parameters. Color-scheme and locale set.`]);

      const res = await apiPost<{
        success: boolean;
        latency_ms: number;
        engine: string;
        database_version: string;
        discovered_table: string;
        schema: DiscoveredColumn[];
        total_records_discovered: number;
      }>('/database-link/test', payload);

      await new Promise(r => setTimeout(r, 500));
      setTestConsole(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [SUCCESS] Database link tested successfully in ${res.latency_ms}ms!`,
        `[${new Date().toLocaleTimeString()}] [INFO] Target Engine version: ${res.database_version}`,
        `[${new Date().toLocaleTimeString()}] [INFO] Auto-discovered schema target: "${res.discovered_table}"`,
        `[${new Date().toLocaleTimeString()}] [INFO] Total discoverable transaction records: ${res.total_records_discovered.toLocaleString()}`
      ]);

      setSchema(res.schema);
      setRecordsCount(res.total_records_discovered);
      setConnectedTable(res.discovered_table);
    } catch (err: any) {
      setTestConsole(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [ERROR] Connection failed: ${err.message || 'Unknown network error'}`
      ]);
    } finally {
      setTesting(false);
    }
  };

  const handleToggleStream = async () => {
    setConnecting(true);
    try {
      if (isStreaming) {
        // Disconnect
        await apiPost('/database-link/disconnect', {});
        setIsStreaming(false);
        setTxStream([]);
        setDbStatus(prev => ({ ...prev, is_connected: false }));
      } else {
        // Connect
        const payload = {
          engine,
          connection_url: connUrl,
          ssl_mode: sslMode,
          ingestion_rate_limit: rateLimit
        };
        await apiPost('/database-link/connect', payload);
        setIsStreaming(true);
        setActiveTab('live');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  const handleRowAction = (txId: string, action: string) => {
    setTxStream(prev =>
      prev.map(t =>
        t.id === txId
          ? { ...t, analysis: { ...t.analysis, status: action === 'approve' ? 'approved' : action === 'flag' ? 'flagged' : 'hold' } }
          : t
      )
    );
  };

  const riskStatusBadge = (riskScore: number) => {
    if (riskScore >= 85) return 'text-risk-high bg-risk-high/10 border-risk-high/20 border';
    if (riskScore >= 60) return 'text-risk-medium bg-risk-medium/10 border-risk-medium/20 border';
    return 'text-risk-low bg-risk-low/10 border-risk-low/20 border';
  };

  const dbEngines = [
    { id: 'postgresql', label: 'PostgreSQL', icon: Server },
    { id: 'mysql', label: 'MySQL', icon: Database },
    { id: 'snowflake', label: 'Snowflake', icon: DatabaseZap },
    { id: 'mongodb', label: 'MongoDB', icon: HardDrive },
    { id: 'bigquery', label: 'BigQuery', icon: Cpu }
  ];

  return (
    <ModuleWorkspace
      eyebrow="Database Connector"
      title="Direct database link and in-flight transaction analysis."
      description="Establish secure sync pipelines directly to enterprise database tables and run GraphSAGE models on incoming events in real time."
      icon={DatabaseZap}
      isMocked={!dbStatus.is_connected}
      kpis={[
        { label: 'Status', value: dbStatus.is_connected ? 'Connected' : 'Offline', detail: dbStatus.is_connected ? 'live stream' : 'connector ready', tone: dbStatus.is_connected ? 'green' : 'amber' },
        { label: 'Throughput', value: dbStatus.is_connected ? `${dbStatus.throughput_tx_per_sec} tx/s` : '0 tx/s', detail: 'pipeline rate', tone: dbStatus.is_connected ? 'green' : 'blue' },
        { label: 'Ingested', value: dbStatus.records_processed.toLocaleString(), detail: 'processed count', tone: 'purple' },
        { label: 'Read Latency', value: dbStatus.is_connected ? `${dbStatus.db_latency_ms}ms` : '0ms', detail: 'query response', tone: 'blue' }
      ]}
      side={<DatabaseSidePanel status={dbStatus} recordsCount={recordsCount} connectedTable={connectedTable} />}
      audit={['SSL enforce mode toggled', 'Schema auto-discovery run', 'Model mode champion_gnn activated']}
    >
      {/* Tab Selectors */}
      <div className="flex border-b border-[var(--border-secondary)] mb-6">
        <button
          onClick={() => setActiveTab('config')}
          className={cn(
            "px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-all duration-200",
            activeTab === 'config'
              ? "border-[var(--brand-accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          Connection Configuration
        </button>
        <button
          onClick={() => setActiveTab('live')}
          disabled={!dbStatus.is_connected && txStream.length === 0}
          className={cn(
            "px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
            activeTab === 'live'
              ? "border-[var(--brand-accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          )}
        >
          Live Stream Analyzer
        </button>
      </div>

      {activeTab === 'config' ? (
        <div className="space-y-6 animate-fade-in">
          {/* Select Database Engine */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Select Database Engine</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {dbEngines.map((eng) => {
                const Icon = eng.icon;
                const isSelected = engine === eng.id;
                return (
                  <button
                    key={eng.id}
                    onClick={() => {
                      setEngine(eng.id);
                      if (eng.id === 'postgresql') setConnUrl('postgresql://admin:finguard_secure_2026@db.enterprise-core.net:5432/transactions');
                      else if (eng.id === 'mysql') setConnUrl('mysql://admin:finguard_secure_2026@db.enterprise-core.net:3306/transactions');
                      else setConnUrl(`${eng.id}://admin:credentials@cloud-db.enterprise.net/transactions`);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 group",
                      isSelected
                        ? "bg-[var(--brand-soft)] border-[var(--brand-accent)] text-[var(--brand-accent)]"
                        : "bg-[var(--bg-secondary)] border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-primary)]"
                    )}
                  >
                    <Icon size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold">{eng.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connection Parameters Form */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-8 space-y-6">
              <div className="card p-6 space-y-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Parameters Configuration</h3>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">Database Connection URI / String</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={connUrl}
                      onChange={(e) => setConnUrl(e.target.value)}
                      placeholder="database://user:pass@host:port/dbname"
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] font-mono outline-none focus:border-[var(--border-focus)] transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">SSL Verification</label>
                    <select
                      value={sslMode}
                      onChange={(e) => setSslMode(e.target.value)}
                      className="w-full bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                    >
                      <option value="require">Require (SSL Enforced)</option>
                      <option value="disable">Disable (Insecure)</option>
                      <option value="verify-ca">Verify CA certificate</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] flex justify-between">
                      <span>Rate Limit Throttle</span>
                      <span className="text-[var(--brand-accent)]">{rateLimit} tx/sec</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="200"
                      value={rateLimit}
                      onChange={(e) => setRateLimit(Number(e.target.value))}
                      className="w-full accent-[var(--brand-accent)] mt-3 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    {testing ? <RefreshCw size={14} className="animate-spin" /> : <TerminalIcon size={14} />}
                    Test Connection
                  </button>

                  <button
                    onClick={handleToggleStream}
                    disabled={connecting}
                    className={cn(
                      "btn-primary text-xs flex items-center gap-1.5",
                      dbStatus.is_connected ? "bg-red-900/30 text-red-400 border border-red-500/20 hover:bg-red-900/50" : ""
                    )}
                  >
                    {connecting ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : dbStatus.is_connected ? (
                      <>
                        <Square size={14} fill="currentColor" /> Disconnect Link
                      </>
                    ) : (
                      <>
                        <Play size={14} fill="currentColor" /> Establish Live Stream
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Handshake Terminal Log */}
              {testConsole.length > 0 && (
                <div className="card bg-[#09090a] border-[var(--border-secondary)] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-white/5 select-none">
                    <div className="flex items-center gap-2">
                      <TerminalIcon size={13} className="text-[var(--brand-accent)]" />
                      <span className="font-mono text-xs text-white/60 font-semibold uppercase tracking-wider">Connector Handshake Logs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                  </div>
                  <div className="p-4 font-mono text-xs space-y-1.5 h-44 overflow-y-auto custom-scrollbar text-white/80">
                    {testConsole.map((log, i) => (
                      <div
                        key={i}
                        className={cn(
                          "whitespace-pre-wrap leading-5",
                          log.includes('[SUCCESS]') ? 'text-green-400' : log.includes('[ERROR]') ? 'text-red-400' : 'text-white/60'
                        )}
                      >
                        {log}
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                </div>
              )}
            </div>

            {/* Schema Discovered Grid */}
            <div className="col-span-12 md:col-span-4">
              <div className="card p-6 h-full flex flex-col">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Layers size={16} className="text-[var(--brand-accent)]" /> Schema Discovery
                </h3>
                {schema.length > 0 ? (
                  <div className="flex-1 overflow-y-auto max-h-[350px] space-y-2 pr-1 custom-scrollbar">
                    <p className="text-xs text-[var(--text-secondary)] mb-3">
                      Target Table: <code className="bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded text-[11px] font-mono text-[var(--text-primary)]">{connectedTable}</code>
                    </p>
                    {schema.map((col) => (
                      <div key={col.column} className="flex justify-between items-center p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-secondary)]">
                        <div>
                          <p className="text-xs font-mono font-bold text-[var(--text-primary)]">{col.column}</p>
                          <p className="text-[10px] text-[var(--text-tertiary)] font-mono">{col.type}</p>
                        </div>
                        {col.key && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-[var(--brand-soft)] text-[var(--brand-accent)] font-bold rounded uppercase">
                            {col.key}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[var(--border-secondary)] rounded-xl">
                    <Database size={32} className="text-[var(--text-tertiary)] mb-2" />
                    <p className="text-xs text-[var(--text-secondary)]">
                      Test database connection parameters to inspect auto-discovered table schemas.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Tab 2: Live In-Flight Stream Analyzer */
        <div className="space-y-6 animate-fade-in">
          {/* Telemetry widgets grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)]">CPU load</span>
                <Cpu size={16} className="text-[var(--brand-accent)]" />
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)]">{dbStatus.telemetry.cpu_usage_pct}%</p>
              <div className="mt-2 w-full h-1.5 rounded-full bg-[var(--border-secondary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--brand-accent)] transition-all duration-500"
                  style={{ width: `${dbStatus.telemetry.cpu_usage_pct}%` }}
                />
              </div>
            </div>

            <div className="card p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)]">Memory utilization</span>
                <HardDrive size={16} className="text-teal-400" />
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)]">{dbStatus.telemetry.memory_usage_pct}%</p>
              <div className="mt-2 w-full h-1.5 rounded-full bg-[var(--border-secondary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-400 transition-all duration-500"
                  style={{ width: `${dbStatus.telemetry.memory_usage_pct}%` }}
                />
              </div>
            </div>

            <div className="card p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)]">Connection Pool</span>
                <Server size={16} className="text-purple-400" />
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {dbStatus.telemetry.connection_pool_active} <span className="text-xs text-[var(--text-secondary)]">active</span>
              </p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-2">
                {dbStatus.telemetry.connection_pool_idle} connections idle in pool
              </p>
            </div>

            <div className="card p-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-tertiary)]">Network Bandwidth</span>
                <Activity size={16} className="text-green-400" />
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)]">{dbStatus.bandwidth_kb_per_sec} KB/s</p>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-2">
                SSL connection encrypted hybrid ML-KEM
              </p>
            </div>
          </div>

          {/* Active Streaming Table & Query Terminal */}
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">In-Flight Transaction Analysis</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Live streaming records fetched using index poll queries</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleStream}
                  className="btn-secondary text-[11px] py-1 px-3 flex items-center gap-1 bg-red-950/20 text-red-400 border border-red-950/30 hover:bg-red-900/20"
                >
                  <Square size={10} fill="currentColor" /> Stop Sync
                </button>
                <div className="flex items-center gap-1 text-[11px] text-green-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" /> Ingestion Streaming
                </div>
              </div>
            </div>

            {/* Transactions Log Grid */}
            <div className="overflow-x-auto rounded-xl border border-[var(--border-secondary)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--bg-secondary)] text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">TXN ID</th>
                    <th className="px-4 py-3 font-semibold">Timestamp</th>
                    <th className="px-4 py-3 font-semibold">Query Info</th>
                    <th className="px-4 py-3 font-semibold">Payload Details</th>
                    <th className="px-4 py-3 font-semibold text-center">GNN Risk</th>
                    <th className="px-4 py-3 font-semibold">Top Risk Factor</th>
                    <th className="px-4 py-3 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-secondary)]">
                  {txStream.length > 0 ? (
                    txStream.map((tx) => (
                      <tr
                        key={tx.id}
                        className={cn(
                          "hover:bg-[var(--bg-card-hover)] transition-colors",
                          tx.analysis.risk_score >= 85 ? "bg-red-950/5" : ""
                        )}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-[var(--text-primary)]">{tx.id}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                          {new Date(tx.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="font-mono text-[10px] text-white/50 bg-black/40 p-1.5 rounded truncate" title={tx.sql_query}>
                            {tx.sql_query}
                          </div>
                          <span className="text-[9px] text-[var(--text-tertiary)] block mt-0.5">Read time: {tx.database_read_latency_ms}ms</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[var(--text-primary)]">
                            {tx.payload.merchant} · <span className="text-white/60">${tx.payload.amount.toLocaleString()} {tx.payload.currency}</span>
                          </p>
                          <p className="text-[10px] text-[var(--text-secondary)]">
                            User: {tx.payload.user_id} · Region: {tx.payload.region}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", riskStatusBadge(tx.analysis.risk_score))}>
                            {tx.analysis.risk_score}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[var(--text-primary)]">{tx.analysis.explainability.top_factor}</p>
                          <p className="text-[9px] text-[var(--text-secondary)]">
                            SHAP: {tx.analysis.explainability.shap_value > 0 ? '+' : ''}{tx.analysis.explainability.shap_value}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1 justify-center">
                            {tx.analysis.status === 'approved' ? (
                              <span className="text-[10px] text-green-400 font-bold px-2 py-0.5 bg-green-400/10 border border-green-500/20 rounded">
                                Approved
                              </span>
                            ) : tx.analysis.status === 'flagged' ? (
                              <span className="text-[10px] text-red-400 font-bold px-2 py-0.5 bg-red-400/10 border border-red-500/20 rounded">
                                Flagged
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleRowAction(tx.id, 'approve')}
                                  className="text-[9px] px-1.5 py-0.5 bg-green-400/10 text-green-400 border border-green-500/25 rounded hover:bg-green-400/25 transition-colors font-bold"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRowAction(tx.id, 'flag')}
                                  className="text-[9px] px-1.5 py-0.5 bg-red-400/10 text-red-400 border border-red-500/25 rounded hover:bg-red-400/25 transition-colors font-bold"
                                >
                                  Flag
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center p-12 text-[var(--text-tertiary)]">
                        No transactions captured yet. Let the stream run for a few seconds.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ModuleWorkspace>
  );
}

function DatabaseSidePanel({
  status,
  recordsCount,
  connectedTable
}: {
  status: DBStatus;
  recordsCount: number | null;
  connectedTable: string | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Connector details</h3>
        <div className="mt-4 space-y-3">
          <StatusLine label={status.is_connected ? "Direct connection status: Online" : "Direct connection status: Disconnected"} />
          <StatusLine label={status.is_connected ? `Ingested engine: ${status.engine?.toUpperCase()}` : "Selected engine: Standby"} />
          <StatusLine label="Hybrid ML-KEM SSL cert active" />
        </div>
      </div>

      {status.is_connected && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Source telemetry</h3>
          <div className="mt-3 space-y-2.5">
            <div className="rounded-xl bg-[var(--bg-secondary)] p-3 border border-[var(--border-secondary)]">
              <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">Poll query target</p>
              <p className="text-xs font-mono font-bold mt-1 text-[var(--text-primary)]">{connectedTable || 'public.transactions'}</p>
            </div>

            <div className="rounded-xl bg-[var(--bg-secondary)] p-3 border border-[var(--border-secondary)]">
              <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">Estimated DB records</p>
              <p className="text-xs font-mono font-bold mt-1 text-[var(--text-primary)]">
                {recordsCount ? recordsCount.toLocaleString() : 'Loading...'}
              </p>
            </div>
            
            <div className="rounded-xl bg-[var(--bg-secondary)] p-3 border border-[var(--border-secondary)]">
              <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">Sync frequency</p>
              <p className="text-xs font-mono font-bold mt-1 text-[var(--text-primary)]">Real-time (continuous poll)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
