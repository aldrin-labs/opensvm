'use client';

import React, { useEffect, useState, useRef } from 'react';
import { getRecentTransactions } from '@/lib/solana';

interface Transaction {
  signature: string;
  timestamp: string;
  from: string;
  to: string;
  amount: number;
  tokenSymbol?: string;
  type: string;
  status: 'success' | 'failed';
}

interface Node {
  id: string;
  label: string;
  type: 'account' | 'transaction';
  x: number;
  y: number;
  connections: number;
}

interface Edge {
  from: string;
  to: string;
  amount?: number;
  tokenSymbol?: string;
  signature: string;
}

interface TransactionGraphProps {
  address: string;
}

export default function TransactionGraph({ address }: TransactionGraphProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredTx, setHoveredTx] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch last 100 transactions
        const txs = await getRecentTransactions(address, 100);
        setTransactions(txs);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError('Failed to load transaction data');
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      fetchTransactions();
    }
  }, [address]);

  // Generate graph data from transactions
  const generateGraphData = () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeMap = new Map<string, number>();

    // Add central account node
    nodes.push({
      id: address,
      label: `${address.slice(0, 4)}...${address.slice(-4)}`,
      type: 'account',
      x: 150,
      y: 150,
      connections: transactions.length
    });
    nodeMap.set(address, transactions.length);

    // Process transactions to create nodes and edges
    transactions.forEach((tx, index) => {
      const angle = (index / transactions.length) * 2 * Math.PI;
      const radius = 80 + Math.random() * 40; // Add some randomness
      const x = 150 + radius * Math.cos(angle);
      const y = 150 + radius * Math.sin(angle);

      // Add transaction node
      nodes.push({
        id: tx.signature,
        label: `${tx.signature.slice(0, 4)}...`,
        type: 'transaction',
        x,
        y,
        connections: 1
      });

      // Add edges
      if (tx.from === address) {
        // Outgoing transaction
        edges.push({
          from: address,
          to: tx.signature,
          amount: tx.amount,
          tokenSymbol: tx.tokenSymbol,
          signature: tx.signature
        });
      } else if (tx.to === address) {
        // Incoming transaction
        edges.push({
          from: tx.signature,
          to: address,
          amount: tx.amount,
          tokenSymbol: tx.tokenSymbol,
          signature: tx.signature
        });
      }

      // Track other addresses
      const otherAddress = tx.from === address ? tx.to : tx.from;
      if (otherAddress && otherAddress !== address) {
        const count = nodeMap.get(otherAddress) || 0;
        nodeMap.set(otherAddress, count + 1);
      }
    });

    return { nodes, edges };
  };

  const { nodes, edges } = generateGraphData();

  if (loading) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground">
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Transaction Graph</h3>
          <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading last 100 transactions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground">
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Transaction Graph</h3>
          <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-red-500">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-2 px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Transaction Graph</h3>
          <span className="text-xs bg-muted px-2 py-1 rounded">
            {transactions.length} transactions
          </span>
        </div>
        
        <div className="h-[300px] bg-muted rounded-lg relative overflow-hidden">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox="0 0 300 300"
            className="absolute inset-0"
          >
            {/* Render edges */}
            {edges.map((edge, index) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              
              if (!fromNode || !toNode) return null;
              
              const isHovered = hoveredTx === edge.signature;
              
              return (
                <g key={index}>
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={isHovered ? "#3b82f6" : "#e5e7eb"}
                    strokeWidth={isHovered ? 2 : 1}
                    strokeOpacity={isHovered ? 1 : 0.6}
                    className="transition-all duration-200"
                  />
                  
                  {/* Arrow head for direction */}
                  <polygon
                    points={`${toNode.x-3},${toNode.y-3} ${toNode.x+3},${toNode.y-3} ${toNode.x},${toNode.y+3}`}
                    fill={isHovered ? "#3b82f6" : "#9ca3af"}
                    className="transition-all duration-200"
                  />
                </g>
              );
            })}
            
            {/* Render nodes */}
            {nodes.map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.type === 'account' ? 8 : 4}
                  fill={node.type === 'account' ? "#3b82f6" : "#10b981"}
                  stroke={node.type === 'account' ? "#1e40af" : "#059669"}
                  strokeWidth={1}
                  className="cursor-pointer hover:fill-opacity-80 transition-all duration-200"
                  onMouseEnter={() => {
                    if (node.type === 'transaction') {
                      setHoveredTx(node.id);
                    }
                  }}
                  onMouseLeave={() => setHoveredTx(null)}
                />
                
                {/* Node labels */}
                <text
                  x={node.x}
                  y={node.y + (node.type === 'account' ? 18 : 12)}
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  className="pointer-events-none select-none opacity-70"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
          
          {/* Legend */}
          <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm rounded p-2 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Account</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Transaction</span>
            </div>
          </div>
          
          {/* Transaction details on hover */}
          {hoveredTx && (
            <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm rounded p-2 text-xs max-w-[200px]">
              {(() => {
                const tx = transactions.find(t => t.signature === hoveredTx);
                if (!tx) return null;
                
                return (
                  <div className="space-y-1">
                    <div className="font-medium">Transaction Details</div>
                    <div>Type: {tx.type}</div>
                    <div>Amount: {tx.amount} {tx.tokenSymbol || 'SOL'}</div>
                    <div>Status: <span className={tx.status === 'success' ? 'text-green-600' : 'text-red-600'}>{tx.status}</span></div>
                    <div className="text-xs text-muted-foreground">
                      {tx.signature.slice(0, 8)}...
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        
        {/* Summary Stats */}
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>
            {transactions.filter(t => t.from === address).length} outgoing
          </span>
          <span>
            {transactions.filter(t => t.to === address).length} incoming
          </span>
          <span>
            {transactions.filter(t => t.status === 'success').length} successful
          </span>
        </div>
      </div>
    </div>
  );
}