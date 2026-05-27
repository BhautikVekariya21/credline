import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck, Key, Copy, RefreshCw, Play, Trash2, Code, Layers,
  Layers2, CreditCard, Receipt
} from 'lucide-react';
import { apiGet, apiPost, requestJson } from '../../lib/api';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';

// Interfaces
interface DeveloperKey {
  key_masked: string;
  tenant_id: string;
  name: string;
  tier: string;
  rpm_limit: number;
  accumulated_usage: number;
}

interface DeveloperMetricsResponse {
  active_keys_count: number;
  keys: DeveloperKey[];
}

interface WebhookHistoryItem {
  event_id: string;
  target_url: string;
  delivered: boolean;
  attempts_count: number;
  last_status: number | null;
  last_response: string | null;
}

interface WebhookHistoryResponse {
  history: WebhookHistoryItem[];
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function EshodhaDevPortal() {
  const { theme, font } = useAppStore();

  // Local Toast System
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef<number>(0);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = `toast-${++toastCounter.current}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Developer Keys and Metrics State
  const [metrics, setMetrics] = useState<DeveloperMetricsResponse | null>(null);
  const [webhookHistory, setWebhookHistory] = useState<WebhookHistoryItem[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState<boolean>(false);

  // Key generation state
  const [newKeyName, setNewKeyName] = useState<string>('Production App Link');
  const [newKeyTier, setNewKeyTier] = useState<string>('GROWTH');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);

  // Playground state
  const [selectedLang, setSelectedLang] = useState<'curl' | 'python' | 'js'>('curl');
  const [selectedEndpoint, setSelectedEndpoint] = useState<'categorize' | 'query' | 'graphql'>('categorize');
  const [apiKeyValue, setApiKeyValue] = useState<string>('sk_live_tenantA_secret_key_8923');
  const [requestBody, setRequestBody] = useState<string>(
    JSON.stringify({
      amount: 15000.0,
      category: "IT Support Services",
      hsn_code: "9983"
    }, null, 2)
  );
  
  // Custom headers state
  const [rlsTransactionId, setRlsTransactionId] = useState<string>('tx_01');
  const graphqlQuery = `query GetDetails {
  user(id: "usr-9081") {
    name
    company
  }
  fraudGraph(userId: "usr-9081") {
    risk_score
    hops {
      node_name
      risk_contribution
    }
  }
  taxLiability(tenantId: "tenant-a-9981") {
    total_tax
    filing_status
  }
}`;

  const [isRunningPlayground, setIsRunningPlayground] = useState<boolean>(false);
  const [playgroundResponse, setPlaygroundResponse] = useState<string>('');
  const [playgroundStatus, setPlaygroundStatus] = useState<number | null>(null);
  const [playgroundLatency, setPlaygroundLatency] = useState<number | null>(null);

  // Webhook Tester State
  const [whUrl, setWhUrl] = useState<string>('https://sandbox.requestbin.com/webhooks');
  const [isSendingWebhook, setIsSendingWebhook] = useState<boolean>(false);

  // Fetch metrics and history
  const fetchData = async () => {
    setIsLoadingKeys(true);
    try {
      const keysRes = await apiGet<DeveloperMetricsResponse>('/api/v1/gateway/developer/metrics');
      setMetrics(keysRes);
      
      const whRes = await apiGet<WebhookHistoryResponse>('/api/v1/developer/webhook/history');
      setWebhookHistory(whRes.history);
    } catch (err: any) {
      addToast(err.message || 'Failed to sync developer metadata', 'error');
    } finally {
      setIsLoadingKeys(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update Request Body templates based on selected endpoint
  useEffect(() => {
    if (selectedEndpoint === 'categorize') {
      setRequestBody(JSON.stringify({
        amount: 15000.0,
        category: "IT Support Services",
        hsn_code: "9983"
      }, null, 2));
    } else if (selectedEndpoint === 'query') {
      setRequestBody(JSON.stringify({
        transaction_id: rlsTransactionId
      }, null, 2));
    } else if (selectedEndpoint === 'graphql') {
      setRequestBody(JSON.stringify({
        query: graphqlQuery,
        variables: {}
      }, null, 2));
    }
  }, [selectedEndpoint, rlsTransactionId, graphqlQuery]);

  // Generate Key API Action
  const handleCreateKey = async () => {
    try {
      const res = await apiPost<{ success: boolean; api_key: string; tenant_id: string }>('/api/v1/gateway/keys/generate', {
        name: newKeyName,
        tier: newKeyTier
      });
      setGeneratedKey(res.api_key);
      setShowKeyModal(true);
      addToast('New API key generated successfully', 'success');
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Failed to generate key', 'error');
    }
  };

  // Revoke Key API Action
  const handleRevokeKey = async (keyMasked: string) => {
    const confirm = window.confirm(`Are you sure you want to revoke key ${keyMasked}? This action is permanent!`);
    if (!confirm) return;

    let actualKey = '';
    if (keyMasked.includes('tenantA') || keyMasked.includes('_8923')) {
      actualKey = 'sk_live_tenantA_secret_key_8923';
    } else if (keyMasked.includes('tenantB') || keyMasked.includes('_4412')) {
      actualKey = 'sk_live_tenantB_secret_key_4412';
    } else {
      actualKey = keyMasked;
    }

    try {
      await requestJson('/api/v1/gateway/keys/revoke', {
        method: 'POST',
        headers: { "api-key": actualKey }
      });
      addToast('API key revoked and deleted', 'success');
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Failed to revoke key', 'error');
    }
  };

  // Stripe Billing Webhook Simulation
  const handleTriggerStripeWebhook = async (api_key: string) => {
    addToast('Executing Stripe invoicing cycle...', 'info');
    let actualKey = api_key;
    if (api_key.includes('tenantA') || api_key.includes('_8923')) {
      actualKey = 'sk_live_tenantA_secret_key_8923';
    } else if (api_key.includes('tenantB') || api_key.includes('_4412')) {
      actualKey = 'sk_live_tenantB_secret_key_4412';
    }

    try {
      const res = await apiPost<{ usage_recorded: number; invoice_total_usd: number }>('/api/v1/gateway/stripe/webhook', {
        id: `evt_stripe_test_${Math.floor(Math.random() * 100000)}`,
        type: "invoice.created",
        data: {
          customer: "cus_simulated_9081",
          metadata: { api_key: actualKey }
        }
      });
      addToast(`Invoice generated: $${res.invoice_total_usd.toFixed(2)} USD for ${res.usage_recorded} API requests. usage reset!`, 'success');
      fetchData();
    } catch (err: any) {
      addToast('Failed to trigger Stripe webhook', 'error');
    }
  };

  // Webhook Test Dispatch Trigger
  const handleTestWebhook = async () => {
    setIsSendingWebhook(true);
    try {
      await apiPost('/api/v1/developer/webhook/test', {
        developer_id: 'dev_a_9081',
        webhook_url: whUrl,
        signing_secret: 'whsec_startupA_secret_key_112233',
        event_type: 'tax_return.filed_successfully',
        payload: {
          period: '042026',
          gstin: '29AAAAA1111A1Z1',
          tax_due: 432000.0,
          status: 'SUCCESS'
        }
      });
      addToast('Webhook event dispatched with HMAC signature!', 'success');
      fetchData();
    } catch (err: any) {
      addToast(err.message || 'Webhook dispatcher failed', 'error');
    } finally {
      setIsSendingWebhook(false);
    }
  };

  // Run Sandbox Request in API Playground
  const handleRunPlayground = async () => {
    setIsRunningPlayground(true);
    setPlaygroundResponse('');
    setPlaygroundStatus(null);
    setPlaygroundLatency(null);

    const startTime = Date.now();
    let url = '';
    let payload = {};
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKeyValue
    };

    if (selectedEndpoint === 'categorize') {
      url = '/api/v1/gateway/tax/categorize';
      payload = JSON.parse(requestBody);
    } else if (selectedEndpoint === 'query') {
      url = '/api/v1/gateway/ledger/query';
      payload = JSON.parse(requestBody);
    } else if (selectedEndpoint === 'graphql') {
      url = '/api/v1/graphql';
      payload = JSON.parse(requestBody);
    }

    try {
      const res = await requestJson<any>(url, {
        method: 'POST',
        headers,
        body: payload
      });
      const latency = Math.round((Date.now() - startTime));
      setPlaygroundResponse(JSON.stringify(res, null, 2));
      setPlaygroundStatus(200);
      setPlaygroundLatency(latency);
      addToast('Request executed successfully', 'success');
    } catch (err: any) {
      const latency = Math.round((Date.now() - startTime));
      setPlaygroundStatus(err.status || 500);
      setPlaygroundLatency(latency);
      setPlaygroundResponse(JSON.stringify(err.response || { error: err.message }, null, 2));
      addToast('Sandbox API returned an error', 'error');
    } finally {
      setIsRunningPlayground(false);
    }
  };

  // Helper to generate code block copy text based on selected language
  const getPlaygroundCode = () => {
    const headers = `-H "Content-Type: application/json" \\\n  -H "x-api-key: ${apiKeyValue}"`;
    const dataStr = requestBody.replace(/\n/g, '\n  ');

    if (selectedLang === 'curl') {
      if (selectedEndpoint === 'graphql') {
        return `curl -X POST http://api.creditline.io/api/v1/graphql \\\n  ${headers} \\\n  -d '${dataStr}'`;
      }
      return `curl -X POST http://api.creditline.io/api/v1/gateway/tax/${selectedEndpoint} \\\n  ${headers} \\\n  -d '${dataStr}'`;
    }
    
    if (selectedLang === 'python') {
      const path = selectedEndpoint === 'graphql' ? '/api/v1/graphql' : `/api/v1/gateway/tax/${selectedEndpoint}`;
      return `import requests\n\nurl = "http://api.creditline.io${path}"\nheaders = {\n    "Content-Type": "application/json",\n    "x-api-key": "${apiKeyValue}"\n}\npayload = ${dataStr}\n\nresponse = requests.post(url, json=payload, headers=headers)\nprint(response.json())`;
    }

    if (selectedLang === 'js') {
      const path = selectedEndpoint === 'graphql' ? '/api/v1/graphql' : `/api/v1/gateway/tax/${selectedEndpoint}`;
      return `const axios = require('axios');\n\nconst url = 'http://api.creditline.io${path}';\nconst headers = {\n  'Content-Type': 'application/json',\n  'x-api-key': '${apiKeyValue}'\n};\nconst payload = ${dataStr};\n\naxios.post(url, payload, { headers })\n  .then(res => console.log(res.data))\n  .catch(err => console.error(err));`;
    }
    return '';
  };

  return (
    <div className="space-y-8 p-6 text-zinc-100 max-w-7xl mx-auto" data-theme={theme} data-font={font}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-zinc-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-3">
            <Layers className="w-8 h-8 text-indigo-500" />
            BaaS Developer Platform
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Global API ecosystem. Expose the core ledger engine, tax categorization endpoints, and federated GraphQL schemas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-mono bg-zinc-900 border border-zinc-850 px-3 py-1.5 rounded-lg">
            API Gateway: Operational (100.0% Uptime)
          </span>
        </div>
      </div>

      {/* STRIPE billing usage dashboard */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          Active Tenant Subscriptions & Stripe Metering
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoadingKeys ? (
            <div className="col-span-3 text-center py-6 text-zinc-500 font-mono">Syncing usage counters...</div>
          ) : (
            metrics?.keys.map((key, idx) => {
              const estimateBill = key.accumulated_usage * 0.02;
              return (
                <div key={idx} className="bg-zinc-900/60 p-5 rounded-xl border border-zinc-850 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-white uppercase tracking-wider block">{key.name}</span>
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded font-bold tracking-widest uppercase border",
                        key.tier === 'ENTERPRISE' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      )}>
                        {key.tier}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono block">Tenant ID: {key.tenant_id}</span>
                    <span className="text-[10px] text-zinc-500 font-mono block">API Key: {key.key_masked}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-3 text-xs">
                    <div>Accumulated Calls:</div>
                    <div className="text-right font-mono font-semibold text-white">{key.accumulated_usage} reqs</div>
                    <div>Stripe Bill (Est):</div>
                    <div className="text-right font-mono font-bold text-emerald-400">${estimateBill.toFixed(2)} USD</div>
                  </div>

                  <button
                    onClick={() => handleTriggerStripeWebhook(key.key_masked)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-zinc-950 hover:bg-zinc-850 text-[10px] text-zinc-400 border border-zinc-800 rounded font-mono transition-all"
                  >
                    <Receipt className="w-3 h-3 text-indigo-400" />
                    Simulate Stripe Invoicing
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* DUAL PANE API PLAYGROUND & DOCUMENTATION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT PANE: Stripe Docs Style documentation */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between h-[650px] overflow-y-auto">
          <div className="space-y-6 text-sm text-zinc-300 leading-relaxed font-sans">
            <div className="border-b border-zinc-900 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers2 className="w-5 h-5 text-indigo-400" />
                API References & Authentication
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Integrate automated tax calculations and ledgers with your enterprise pipeline.
              </p>
            </div>

            {/* Docs Section: Auth */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white">Authentication</h3>
              <p className="text-xs text-zinc-400">
                Authenticate your API requests by providing your secret key in the <code className="text-indigo-400 font-mono">x-api-key</code> HTTP header. Key requests are limited according to your tier bucket allowance:
              </p>
              <ul className="text-xs list-disc pl-4 space-y-1 text-zinc-400">
                <li><strong className="text-white">SANDBOX:</strong> 10 requests / minute burst capacity</li>
                <li><strong className="text-white">GROWTH:</strong> 60 requests / minute bucket</li>
                <li><strong className="text-white">ENTERPRISE:</strong> 240 requests / minute multi-core limit</li>
              </ul>
            </div>

            {/* Docs Section: Endpoints */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">API Endpoint Specs</h3>
              
              <div className="space-y-3">
                <div className="p-3 bg-zinc-900/40 rounded border border-zinc-850 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[9px] font-bold rounded border border-green-500/20">POST</span>
                    <span className="font-mono font-semibold text-white">/api/v1/gateway/tax/categorize</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Uses the Phase 13 taxation logic to classify goods/services into slabs based on HSN code and returns computed GST values. Costs <strong className="text-emerald-400">$0.02</strong> per call.
                  </p>
                </div>

                <div className="p-3 bg-zinc-900/40 rounded border border-zinc-850 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[9px] font-bold rounded border border-green-500/20">POST</span>
                    <span className="font-mono font-semibold text-white">/api/v1/gateway/ledger/query</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Accesses transaction ledger records. The PostgreSQL Row-Level Security (RLS) policies dynamically isolate and return rows matching the authenticated tenant ID only.
                  </p>
                </div>

                <div className="p-3 bg-zinc-900/40 rounded border border-zinc-850 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[9px] font-bold rounded border border-green-500/20">POST</span>
                    <span className="font-mono font-semibold text-white">/api/v1/graphql</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    Aggregates user, GraphSAGE 3-hop fraud path networks, and tax liabilities into a federated query output, minimizing inter-service roundtrip network trips.
                  </p>
                </div>
              </div>
            </div>

            {/* Docs Section: Webhooks */}
            <div className="space-y-2 border-t border-zinc-900 pt-4">
              <h3 className="text-sm font-semibold text-white">HMAC Signed Webhooks</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Credit Line dispatches webhooks when key asynchronous routines complete (e.g. <code className="text-indigo-400 font-mono">tax_return.filed_successfully</code>). Payloads are HMAC-SHA256 signed. Read the <code className="text-indigo-400 font-mono">X-CreditLine-Signature</code> header and match it locally using your subscription secret key.
              </p>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-4 text-xs text-zinc-500 font-mono">
            Platform Documentation v18.4 | Credit Line Developers
          </div>
        </div>

        {/* RIGHT PANE: Interactive API Playground */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between h-[650px] overflow-hidden">
          <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
            
            {/* Header: Selector */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedEndpoint('categorize')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded transition-all",
                    selectedEndpoint === 'categorize' ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Categorize
                </button>
                <button
                  onClick={() => setSelectedEndpoint('query')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded transition-all",
                    selectedEndpoint === 'query' ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  RLS Query
                </button>
                <button
                  onClick={() => setSelectedEndpoint('graphql')}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded transition-all",
                    selectedEndpoint === 'graphql' ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  GraphQL
                </button>
              </div>
              
              <div className="flex gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-800 font-mono text-[9px]">
                {(['curl', 'python', 'js'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLang(lang)}
                    className={cn(
                      "px-1.5 py-0.5 rounded uppercase font-bold",
                      selectedLang === lang ? "bg-indigo-600 text-white" : "text-zinc-500"
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Request Settings panel */}
            <div className="grid grid-cols-2 gap-4 text-xs py-1 border-b border-zinc-900 pb-3">
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Credential API Key</label>
                <select
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-white font-mono"
                >
                  <option value="sk_live_tenantA_secret_key_8923">Startup A (growth key)</option>
                  <option value="sk_live_tenantB_secret_key_4412">E-Commerce B (enterprise key)</option>
                  {generatedKey && <option value={generatedKey}>Generated Live Key</option>}
                  <option value="sk_live_unauthorized_key_9999">Unauthorized / Invalid Key</option>
                </select>
              </div>

              {selectedEndpoint === 'query' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Target Transaction Row</label>
                  <select
                    value={rlsTransactionId}
                    onChange={(e) => setRlsTransactionId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-white font-mono"
                  >
                    <option value="tx_01">tx_01 (Tenant A row)</option>
                    <option value="tx_02">tx_02 (Tenant A row)</option>
                    <option value="tx_03">tx_03 (Tenant B row)</option>
                    <option value="tx_04">tx_04 (Tenant B row)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Editor Block */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-[160px]">
              <span className="text-[10px] text-zinc-500 font-mono mb-1 uppercase tracking-widest font-bold">Outbound Request Source:</span>
              <textarea
                value={getPlaygroundCode()}
                readOnly
                className="w-full h-full bg-zinc-950 border border-zinc-900 rounded-lg p-3 font-mono text-[10px] text-indigo-300 resize-none focus:outline-none overflow-y-auto leading-relaxed border-l-2 border-l-indigo-500"
              />
            </div>

            {/* Response Panel */}
            <div className="h-44 bg-zinc-950 border border-zinc-900 rounded-lg p-3 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between text-[9px] font-mono border-b border-zinc-900 pb-1.5 text-zinc-500 uppercase tracking-wider">
                <span>Response Console</span>
                {playgroundStatus && (
                  <div className="flex gap-2">
                    <span className={cn(playgroundStatus === 200 ? "text-green-400" : "text-rose-400")}>
                      Status: {playgroundStatus}
                    </span>
                    <span>|</span>
                    <span>Latency: {playgroundLatency}ms</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto font-mono text-[9px] text-emerald-400 p-1 leading-relaxed mt-2 select-text">
                {playgroundResponse ? (
                  <pre>{playgroundResponse}</pre>
                ) : (
                  <span className="text-zinc-650 italic">Execute a request in the playground to view sandbox output...</span>
                )}
              </div>
            </div>

          </div>

          {/* Trigger Button */}
          <div className="border-t border-zinc-900 pt-4 mt-2">
            <button
              onClick={handleRunPlayground}
              disabled={isRunningPlayground}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm py-2 rounded-lg transition-all shadow-lg shadow-indigo-950/20"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              {isRunningPlayground ? "Sending Sandbox API request..." : "Send Request"}
            </button>
          </div>
        </div>

      </div>

      {/* WEBHOOK DISPATCH TESTING PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Controls */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-400" />
                Webhook Outbound Tester
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Post signed events to external URL logs with automatic exponential retry backoffs.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 block font-medium">Destination URL Endpoint</label>
                <input
                  type="text"
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="bg-zinc-900/60 p-4 border border-zinc-850 rounded-lg text-xs leading-relaxed space-y-2 text-zinc-400">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">HMAC Signature Header</span>
                <div className="font-mono text-[9px] text-indigo-400 break-all bg-zinc-950 p-2 rounded border border-zinc-900">
                  X-CreditLine-Signature: 5a8e0f9b1c...
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-6">
            <button
              onClick={handleTestWebhook}
              disabled={isSendingWebhook}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isSendingWebhook && "animate-spin")} />
              {isSendingWebhook ? "Dispatching event..." : "Fire Test Event Webhook"}
            </button>
          </div>
        </div>

        {/* History Logger */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl flex flex-col justify-between h-[360px] overflow-hidden">
          <div className="border-b border-zinc-900 pb-3">
            <h3 className="text-base font-bold text-white">Event Delivery History logs</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 py-4 pr-1">
            {webhookHistory.length === 0 ? (
              <div className="text-zinc-650 flex flex-col items-center justify-center h-full gap-2 font-mono text-xs">
                <span>No webhook dispatch events logged. Trigger a test event.</span>
              </div>
            ) : (
              webhookHistory.map((item, idx) => (
                <div key={idx} className="p-3 bg-zinc-900/50 border border-zinc-850 rounded-lg text-xs flex flex-col md:flex-row md:items-center justify-between gap-4 leading-relaxed font-mono">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-[10px]">{item.event_id}</span>
                      <span className={cn(
                        "text-[8px] px-1.5 rounded font-bold tracking-widest border uppercase",
                        item.delivered ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      )}>
                        {item.delivered ? "Delivered" : "Failed"}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block truncate max-w-sm">{item.target_url}</span>
                  </div>

                  <div className="flex gap-4 text-[10px] text-zinc-400">
                    <div>Attempts: {item.attempts_count}</div>
                    <div>Status: {item.last_status || "N/A"}</div>
                    <div className="text-zinc-500 truncate max-w-[120px]">{item.last_response || ""}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="text-[10px] text-zinc-500 font-mono border-t border-zinc-900 pt-3">
            Webhook logs are stored for 30 days.
          </div>
        </div>

      </div>

      {/* KEY GENERATOR SETTING PANEL */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 shadow-2xl space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            Cryptographic API Key Management
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Create, reveal, and revoke keys to access developer sandbox environments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400 block font-medium">Application Name</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-zinc-400 block font-medium">Pricing Tier</label>
            <select
              value={newKeyTier}
              onChange={(e) => setNewKeyTier(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="SANDBOX">SANDBOX (10 requests/min limit)</option>
              <option value="GROWTH">GROWTH ($0.02 per query, 60 req/min limit)</option>
              <option value="ENTERPRISE">ENTERPRISE ($0.02 per query, 240 req/min limit)</option>
            </select>
          </div>

          <button
            onClick={handleCreateKey}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg text-sm transition-all"
          >
            <Key className="w-4 h-4" />
            Generate New API Key
          </button>
        </div>

        <div className="border-t border-zinc-900 pt-6">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Currently Active Developer Keys:</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-zinc-400 leading-normal">
              <thead className="text-[10px] text-zinc-500 uppercase bg-zinc-900/60 border border-zinc-850">
                <tr>
                  <th className="px-4 py-3">Client App Name</th>
                  <th className="px-4 py-3">API Key Mask</th>
                  <th className="px-4 py-3">Tenant ID</th>
                  <th className="px-4 py-3">RPM Limit</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {metrics?.keys.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/25">
                    <td className="px-4 py-3 text-white font-semibold">{item.name}</td>
                    <td className="px-4 py-3 font-mono text-indigo-400">{item.key_masked}</td>
                    <td className="px-4 py-3 font-mono">{item.tenant_id}</td>
                    <td className="px-4 py-3 font-mono">{item.rpm_limit} rpm</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRevokeKey(item.key_masked)}
                        className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 mx-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Revoke Key
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CRYPTOGRAPHIC KEY REVEAL MODAL */}
      {showKeyModal && generatedKey && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl p-6 space-y-6 animate-scale-in">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                API Key Generated Successfully
              </h3>
              <p className="text-xs text-rose-400 font-semibold leading-relaxed">
                ⚠️ WARNING: This key will only be displayed ONCE. Copy and save it securely. If lost, you must generate a new key.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-zinc-900 p-3 rounded-lg border border-zinc-800 font-mono text-xs select-all text-indigo-300 relative break-all">
              {generatedKey}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey);
                  addToast('API key copied to clipboard', 'success');
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy API Key
              </button>
              <button
                onClick={() => {
                  setShowKeyModal(false);
                  setGeneratedKey(null);
                }}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-850 text-xs font-semibold rounded-lg"
              >
                I Saved the Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Float Toasts System */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 w-96 font-sans">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "p-4 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-xl animate-slide-in text-xs font-semibold leading-relaxed",
              t.type === 'success' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
              t.type === 'error' && "bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400",
              t.type === 'info' && "bg-indigo-500/10 border-indigo-500/30 text-indigo-500 dark:text-indigo-400"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 size={15} />}
              {t.type === 'error' && <ShieldAlert size={15} />}
              {t.type === 'info' && <RefreshCw size={15} className="animate-spin" />}
            </div>
            <p className="flex-1">{t.message}</p>
          </div>
        ))}
      </div>

    </div>
  );
}

// Inline fallback for CheckCircle2
function CheckCircle2({ size }: { size: number }) {
  return <CheckCircle2Component size={size} />;
}
import { CheckCircle2 as CheckCircle2Component } from 'lucide-react';

function ShieldAlert({ size }: { size: number }) {
  return <ShieldAlertComponent size={size} />;
}
import { ShieldAlert as ShieldAlertComponent } from 'lucide-react';
