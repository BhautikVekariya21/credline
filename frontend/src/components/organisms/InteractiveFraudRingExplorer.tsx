import { useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { cn } from '../../lib/utils';
import { Network, Search, Maximize2, RefreshCw } from 'lucide-react';

function EntityNode({ data }: { data: any }) {
  return (
    <div className={cn(
      "min-w-[120px] rounded-xl border px-4 py-2 transition-shadow",
      data.risk === 'high' ? "bg-risk-high/10 border-risk-high/30" :
      data.risk === 'medium' ? "bg-risk-medium/10 border-risk-medium/35" :
      "bg-[var(--bg-card)] border-[var(--border-secondary)]"
    )}>
      <div className="mb-1 text-[10px] font-bold uppercase text-[var(--text-tertiary)]">
        {data.type}
      </div>
      <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">
        {data.label}
      </div>
      {data.riskScore && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
          <div 
            className={cn("h-full", data.risk === 'high' ? "bg-risk-high" : "bg-risk-medium")} 
            style={{ width: `${data.riskScore * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  entity: EntityNode,
};

const initialNodes: Node[] = [
  { id: '1', type: 'entity', position: { x: 400, y: 200 }, data: { label: 'USR-89X1', type: 'USER', risk: 'high', riskScore: 0.92 } },
  { id: '2', type: 'entity', position: { x: 200, y: 100 }, data: { label: 'IP: 192.168.1.1', type: 'IP', risk: 'medium', riskScore: 0.65 } },
  { id: '3', type: 'entity', position: { x: 600, y: 100 }, data: { label: 'DEV-A49F', type: 'DEVICE', risk: 'high', riskScore: 0.88 } },
  { id: '4', type: 'entity', position: { x: 300, y: 350 }, data: { label: 'USR-22L9', type: 'USER', risk: 'medium', riskScore: 0.54 } },
  { id: '5', type: 'entity', position: { x: 500, y: 350 }, data: { label: 'MERCH-CRYPT', type: 'MERCHANT', risk: 'high', riskScore: 0.95 } },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '2', target: '1', animated: true, style: { stroke: '#b4433a' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#b4433a' } },
  { id: 'e1-3', source: '3', target: '1', animated: true, style: { stroke: '#b4433a' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#b4433a' } },
  { id: 'e4-2', source: '2', target: '4', style: { stroke: '#9a6a00', strokeDasharray: '5 5' } },
  { id: 'e1-5', source: '1', target: '5', animated: true, style: { stroke: '#b4433a', strokeWidth: 2 }, label: '$4,500', labelStyle: { fill: '#252526', fontSize: 12, fontWeight: 'bold' }, labelBgStyle: { fill: '#fbfbfb', fillOpacity: 0.92 } },
  { id: 'e4-5', source: '4', target: '5', style: { stroke: '#9a6a00' }, label: '$120', labelStyle: { fill: '#252526', fontSize: 10 }, labelBgStyle: { fill: '#fbfbfb', fillOpacity: 0.92 } },
];

export default function InteractiveFraudRingExplorer() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [isExpanding, setIsExpanding] = useState(false);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Simulate expanding a node to find more connections (GraphSAGE hop)
    if (isExpanding) return;
    setIsExpanding(true);
    
    setTimeout(() => {
      const newNodeId = `ext-${Math.random().toString(36).slice(2, 6)}`;
      const newNode: Node = {
        id: newNodeId,
        type: 'entity',
        position: { x: node.position.x + (Math.random() * 200 - 100), y: node.position.y + 150 },
        data: { 
          label: `USR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, 
          type: 'USER', 
          risk: 'medium', 
          riskScore: 0.6 
        }
      };
      
      const newEdge: Edge = {
        id: `e-${node.id}-${newNodeId}`,
        source: node.id,
        target: newNodeId,
        animated: true,
        style: { stroke: '#9a6a00' }
      };

      setNodes(nds => [...nds, newNode]);
      setEdges(eds => [...eds, newEdge]);
      setIsExpanding(false);
    }, 600);
  }, [isExpanding]);

  return (
    <div className="glass rounded-xl flex flex-col h-[500px] overflow-hidden relative">
      {/* Header Toolbar */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b border-[var(--border-secondary)] bg-[var(--bg-overlay)] p-4">
        <div>
          <h3 className="pointer-events-auto flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Network size={16} className="text-eshodha-500" />
            Interactive Fraud Ring Explorer
          </h3>
          <p className="pointer-events-auto mt-1 text-xs text-[var(--text-tertiary)]">
            Click nodes to expand GraphSAGE connections. Pan and scroll to zoom.
          </p>
        </div>
        
        <div className="flex gap-2 pointer-events-auto">
          <div className="flex items-center rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] px-3 py-1.5">
            <Search size={14} className="mr-2 text-[var(--text-tertiary)]" />
            <input 
              type="text" 
              placeholder="Search entity..." 
              className="w-32 border-none bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <button className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)]">
            <RefreshCw size={14} className={isExpanding ? "animate-spin" : ""} />
          </button>
          <button className="rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-card)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)]">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* React Flow Graph */}
      <div className="flex-1 bg-[var(--bg-primary)] pt-[76px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#b8b8bb" gap={18} size={1} style={{ opacity: 0.45 }} />
          <Controls 
            className="border border-[var(--border-secondary)] bg-[var(--bg-card)] fill-[var(--text-primary)] !text-[var(--text-primary)] shadow-none" 
            style={{ display: 'flex', flexDirection: 'column' }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
