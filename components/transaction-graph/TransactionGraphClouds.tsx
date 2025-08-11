import React, { useState, useCallback } from 'react';
import { Cloud, Save, Trash } from 'lucide-react';
import { GraphStateCache, SavedGraphState } from '@/lib/graph-state-cache';

// Types
interface SavedGraphMetadata {
  signature: string;
  title?: string;
  timestamp?: number;
  context?: string;
  nodeCount?: number;
  edgeCount?: number;
  graphType?: string;
}

interface TransactionGraphCloudsProps {
  graphs: SavedGraphMetadata[];
  onLoadState: (state: any) => void;
  onSaveCurrentState: () => void;
}

function inferGraphType(graph: SavedGraphMetadata): string {
  if (graph.graphType) return graph.graphType;
  if (graph.context && graph.context.toLowerCase().includes('account')) return 'Account';
  if (graph.context && graph.context.toLowerCase().includes('transaction')) return 'Transaction';
  if (graph.title && graph.title.toLowerCase().includes('account')) return 'Account';
  if (graph.title && graph.title.toLowerCase().includes('transaction')) return 'Transaction';
  if (typeof graph.signature === 'string' && /^[A-Za-z0-9]{32,44}$/.test(graph.signature)) return 'Account';
  return 'Custom';
}

// TransactionGraphClouds main component
const TransactionGraphClouds: React.FC<TransactionGraphCloudsProps> = ({ graphs, onLoadState, onSaveCurrentState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [savedGraphs, setSavedGraphs] = useState<SavedGraphMetadata[]>(graphs);
  // If you use GraphStateCache, import it here
  // import { GraphStateCache } from '...';
  // ...existing code...
  // All logic and hooks go here
  // ...existing code...

  // Format date for display
  const formatDate = useCallback((timestamp?: number): string => {
    if (!timestamp) return 'Unknown date';
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Load a saved graph state
  const handleLoadState = useCallback((graph: SavedGraphMetadata) => {
    const savedState = GraphStateCache.loadState(graph.signature);
    if (savedState) {
      // Pass the state to the parent component
      onLoadState(savedState as SavedGraphState);
      setIsOpen(false);
    }
  }, [onLoadState]);

  // Delete a saved graph
  const handleDelete = useCallback((e: React.MouseEvent, signature: string) => {
    e.stopPropagation();
    GraphStateCache.deleteGraph(signature);
    setSavedGraphs(GraphStateCache.getSavedGraphs());
  }, []);

  return (
    <div className="relative">
      <button
        className="flex items-center space-x-1 p-2 rounded-md hover:bg-muted transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Saved graph states"
      >
        <Cloud className="w-5 h-5" />
        <span className="hidden md:inline">Saved Graphs</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-popover text-popover-foreground shadow-lg rounded-md z-50 border border-border p-2">
          <div className="flex justify-between items-center mb-2 p-2 border-b border-border">
            <h3 className="font-medium">Graph Clouds</h3>
            <button
              className="text-primary hover:text-primary/90 flex items-center space-x-1 transition-colors"
              onClick={() => {
                onSaveCurrentState();
                // Refresh the list after saving
                setTimeout(() => setSavedGraphs(GraphStateCache.getSavedGraphs()), 100);
              }}
              aria-label="Save current graph state"
            >
              <Save className="w-4 h-4" />
              <span>Save Current</span>
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {savedGraphs.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No saved graphs
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {savedGraphs.map(graph => (
                  <li
                    key={graph.signature}
                    className="p-2 hover:bg-muted rounded-md cursor-pointer flex justify-between items-start transition-colors"
                    onClick={() => handleLoadState(graph)}
                  >
                    <div className="flex-1 pr-2 min-w-0">
                      <div className="font-medium break-all">{graph.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Last updated: {formatDate(graph.timestamp)}
                      </div>
                      <div className="text-xs text-primary mt-1">
                        Type: {inferGraphType(graph)}
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        Address: {graph.signature}
                      </div>
                      {graph.context && (
                        <div className="text-xs text-primary mt-1">
                          Context: {graph.context}
                        </div>
                      )}
                      {(typeof graph.nodeCount === 'number' || typeof graph.edgeCount === 'number') && (
                        <div className="text-xs text-success mt-1">
                          Stats: {typeof graph.nodeCount === 'number' ? `${graph.nodeCount} nodes` : ''}
                          {typeof graph.nodeCount === 'number' && typeof graph.edgeCount === 'number' ? ', ' : ''}
                          {typeof graph.edgeCount === 'number' ? `${graph.edgeCount} edges` : ''}
                        </div>
                      )}
                    </div>
                    <button
                      className="text-destructive hover:text-destructive/90 p-1 transition-colors"
                      onClick={(e) => handleDelete(e, graph.signature)}
                      aria-label="Delete saved graph"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionGraphClouds;