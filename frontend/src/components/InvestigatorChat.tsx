import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, User } from 'lucide-react';
import { apiPost } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolUsed?: string;
  latencyMs?: number;
  timestamp: string;
}

interface InvestigatorResponse {
  answer?: string;
  tool_used?: string;
  latency_ms?: number;
}

export default function InvestigatorChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'I am the Credit Line Investigator. Ask me about fraud cases, user risk profiles, graph connections, or system health.\n\nTry: "Why was USR-002 flagged?" or "Show system health".',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const query = input.trim();
    if (!query || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: query, timestamp: new Date().toLocaleTimeString() }]);
    setInput('');
    setLoading(true);

    try {
      const data = await apiPost<InvestigatorResponse>('/agent/investigate', { query });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || 'No response generated.',
          toolUsed: data.tool_used,
          latencyMs: data.latency_ms,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Could not reach the API. Is the backend running?',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass flex flex-col h-[calc(100vh-160px)] min-h-[520px] rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--border-secondary)] p-4">
        <div className="w-9 h-9 rounded-xl bg-[var(--text-primary)] flex items-center justify-center">
          <Sparkles size={18} className="text-[var(--text-inverse)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI Investigator</h3>
          <p className="text-xs text-[var(--text-tertiary)]">Graph RAG / SHAP / Neo4j</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={`${msg.timestamp}-${index}`} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-risk-low/10 flex items-center justify-center shrink-0 mt-1">
                <Bot size={14} className="text-risk-low" />
              </div>
            )}
            <div className={`max-w-[75%] ${msg.role === 'user'
              ? 'bg-[var(--text-primary)] border border-[var(--text-primary)] rounded-2xl rounded-br-md px-4 py-2.5'
              : 'bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-2xl rounded-bl-md px-4 py-2.5'}`}>
              <p className={`text-sm whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'text-[var(--text-inverse)]' : 'text-[var(--text-primary)]'}`}>{msg.content}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-[10px] ${msg.role === 'user' ? 'text-white/50' : 'text-[var(--text-tertiary)]'}`}>{msg.timestamp}</span>
                {msg.toolUsed && <span className="rounded bg-risk-low/10 px-1.5 py-0.5 text-[10px] text-risk-low">{msg.toolUsed}</span>}
                {msg.latencyMs && <span className={`text-[10px] ${msg.role === 'user' ? 'text-white/50' : 'text-[var(--text-tertiary)]'}`}>{msg.latencyMs}ms</span>}
              </div>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-credit-line-500/20 flex items-center justify-center shrink-0 mt-1">
                <User size={14} className="text-credit-line-500" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-risk-low/10 flex items-center justify-center">
              <Loader2 size={14} className="text-risk-low animate-spin" />
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-secondary)] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-4 border-t border-[var(--border-secondary)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
            placeholder="Ask about fraud cases, user risk, graph connections..."
            className="flex-1 rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] focus:border-credit-line-500 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-[var(--text-primary)] px-4 py-2.5 text-[var(--text-inverse)] transition-colors hover:bg-[var(--text-secondary)] disabled:opacity-30"
            aria-label="Send investigator question"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
