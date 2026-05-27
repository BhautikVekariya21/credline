import { useState } from 'react';
import { Shield, Eye, BarChart3, Network, AlertTriangle, ToggleLeft, ToggleRight, MessageCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

import MetricsCards from '../components/MetricsCards';
import RiskChart from '../components/RiskChart';
import TransparencyPanel from '../components/TransparencyPanel';
import InvestigatorChat from '../components/InvestigatorChat';

import StreamingTelemetryGrid from '../components/organisms/StreamingTelemetryGrid';
import InteractiveFraudRingExplorer from '../components/organisms/InteractiveFraudRingExplorer';
import EmbeddedInvestigatorTerminal from '../components/organisms/EmbeddedInvestigatorTerminal';

type Tab = 'overview' | 'graph' | 'transparency' | 'investigator' | 'shadow';

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const { shadowMode, toggleShadowMode } = useAppStore();

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Command Center', icon: <BarChart3 size={18} /> },
    { id: 'graph', label: 'Graph Explorer', icon: <Network size={18} /> },
    { id: 'transparency', label: 'Transparency', icon: <Eye size={18} /> },
    { id: 'investigator', label: 'Investigator', icon: <MessageCircle size={18} /> },
    { id: 'shadow', label: 'Shadow Mode', icon: <AlertTriangle size={18} /> },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 glass border-b border-white/10 px-6 py-3">
        <div className="flex items-center justify-between max-w-[1920px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-credit-line-500 to-accent-purple flex items-center justify-center glow-blue cursor-pointer"
                 onClick={() => window.location.href = '/'}>
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-credit-line-400 to-accent-purple bg-clip-text text-transparent">
                Credit Line Admin
              </h1>
              <p className="text-xs text-white/40">Enterprise Command Center</p>
            </div>
          </div>

          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? 'bg-credit-line-600/20 text-credit-line-400 border border-credit-line-500/30'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">Shadow Mode</span>
            <button onClick={toggleShadowMode}
              className={`transition-colors ${shadowMode ? 'text-amber-400' : 'text-white/30'}`}>
              {shadowMode ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
            <div className="flex items-center gap-2 ml-4">
              <div className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
              <span className="text-xs text-green-400/80">Live</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto p-6 relative">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <MetricsCards />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2"><RiskChart /></div>
              <div><StreamingTelemetryGrid /></div>
            </div>
          </div>
        )}
        {activeTab === 'graph' && <InteractiveFraudRingExplorer />}
        {activeTab === 'transparency' && <TransparencyPanel />}
        {activeTab === 'investigator' && <InvestigatorChat />}
        {activeTab === 'shadow' && (
          <div className="glass p-8 text-center">
            <AlertTriangle size={48} className="mx-auto text-amber-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Shadow Mode {shadowMode ? 'Active' : 'Inactive'}</h2>
            <p className="text-white/50 max-w-lg mx-auto mb-6">
              When active, new ML models run in parallel with the production system.
              Predictions are logged but do not affect live transactions.
            </p>
            <button onClick={toggleShadowMode}
              className={`px-8 py-3 rounded-xl font-semibold transition-all ${shadowMode
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-credit-line-600 text-white hover:bg-credit-line-700'}`}>
              {shadowMode ? 'Deactivate Shadow Mode' : 'Activate Shadow Mode'}
            </button>
          </div>
        )}

        {/* Embedded Terminal is always available via floating overlay */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl z-50">
          <EmbeddedInvestigatorTerminal />
        </div>
      </main>
    </>
  );
}
