import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CommandEntry {
  id: string;
  command: string;
  output: string | React.ReactNode;
  isError?: boolean;
}

export default function EmbeddedInvestigatorTerminal() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CommandEntry[]>([
    {
      id: 'init-1',
      command: 'sys info',
      output: 'FinGuard 2026 Core v1.0.0\nStatus: Operational\nModules: [GraphSAGE, TFT, XGBoost]\nActive Users: 12,405'
    }
  ]);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Focus input on click anywhere in terminal
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  const handleCommand = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = input.trim();
      if (!cmd) return;
      
      setInput('');
      
      // Add command immediately
      const entryId = Math.random().toString(36).slice(2, 9);
      setHistory(prev => [...prev, { id: entryId, command: cmd, output: '...' }]);
      
      // Simulate processing
      setTimeout(() => {
        let output = '';
        let isError = false;
        
        const lowerCmd = cmd.toLowerCase();
        
        if (lowerCmd === 'clear') {
          setHistory([]);
          return;
        } else if (lowerCmd.startsWith('query graph')) {
          const target = cmd.split(' ')[2] || 'unknown';
          output = `Executing Cypher query for ${target}...\nMATCH (u:User {id: '${target}'})-[r:TRANSFERRED]->(m) RETURN m LIMIT 5\nFound 3 high-risk connections.`;
        } else if (lowerCmd === 'trigger retrain') {
          output = `Initiating Airflow DAG finguard_retraining...\n[OK] DAG triggered successfully. Run ID: drift-run-8492`;
        } else if (lowerCmd === 'drift status') {
          output = `Checking KS-tests...\nFeature 'amount' drift score: 0.12 (Alert)\nFeature 'velocity' drift score: 0.04 (OK)`;
        } else if (lowerCmd === 'help') {
          output = `Available commands:\n  query graph <id>    - Run Cypher query against Neo4j\n  trigger retrain     - Start model fine-tuning job\n  drift status        - Show KS-test metrics\n  clear               - Clear terminal\n  sys info            - Show system status`;
        } else {
          output = `Command not recognized: ${cmd}. Type 'help' for available commands.`;
          isError = true;
        }

        setHistory(prev => prev.map(entry => 
          entry.id === entryId ? { ...entry, output, isError } : entry
        ));
      }, 600);
    }
  };

  return (
    <div 
      className={cn(
        "glass rounded-xl flex flex-col transition-all duration-300 relative border-t-2 border-t-credit-line-500",
        isExpanded ? "h-[600px] fixed inset-10 z-[100] shadow-2xl" : "h-[300px]"
      )}
      onClick={handleTerminalClick}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/40 rounded-t-xl select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-credit-line-400" />
          <span className="text-xs font-mono text-white/70 font-semibold tracking-wider">Investigator CLI</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="text-white/50 hover:text-white transition-colors p-1"
        >
          {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 p-4 font-mono text-[13px] overflow-y-auto bg-[#0a0a0c] custom-scrollbar">
        <div className="text-credit-line-400 mb-4 opacity-80">
          Welcome to FinGuard Investigator CLI. Type 'help' for commands.
        </div>
        
        {history.map((entry) => (
          <div key={entry.id} className="mb-4">
            <div className="flex items-center text-white/50">
              <span className="text-green-400 mr-2">finguard@admin:~$</span>
              <span className="text-white">{entry.command}</span>
            </div>
            <div className={cn(
              "mt-1 whitespace-pre-wrap pl-2 border-l-2",
              entry.isError ? "border-red-500/50 text-red-400" : "border-white/10 text-white/70"
            )}>
              {entry.output}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Terminal Input */}
      <div className="px-4 py-3 bg-[#0a0a0c] border-t border-white/10 rounded-b-xl flex items-center">
        <span className="text-green-400 font-mono text-[13px] mr-2">finguard@admin:~$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleCommand}
          className="flex-1 bg-transparent border-none outline-none text-white font-mono text-[13px] caret-white"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="w-1.5 h-3 bg-white/50 animate-pulse" /> {/* Cursor block */}
      </div>
    </div>
  );
}
