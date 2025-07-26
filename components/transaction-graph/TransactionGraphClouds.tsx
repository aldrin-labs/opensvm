'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SavedGraphState, GraphStateCache } from '@/lib/graph-state-cache';
import { Cloud, Trash, Save } from 'lucide-react';

interface TransactionGraphCloudsProps {
  currentFocusedTransaction: string;
  onLoadState: (state: SavedGraphState) => void;
  onSaveCurrentState: () => void;
}

// Define a local interface to match what GraphStateCache.getSavedGraphs() returns
interface SavedGraphMetadata {
  signature: string;
  title?: string;
  timestamp?: number;
}

export const TransactionGraphClouds: React.FC<TransactionGraphCloudsProps> = ({
  onLoadState,
  onSaveCurrentState,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [savedGraphs, setSavedGraphs] = useState<SavedGraphMetadata[]>([]);
  
  // Load saved graphs when component mounts or dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSavedGraphs(GraphStateCache.getSavedGraphs());
    }
  }, [isOpen]);
  
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
        className="flex items-center space-x-1 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Saved graph states"
      >
        <Cloud className="w-5 h-5" />
        <span className="hidden md:inline">Saved Graphs</span>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 shadow-lg rounded-md z-50 border border-gray-200 dark:border-gray-700 p-2">
          <div className="flex justify-between items-center mb-2 p-2 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium">Graph Clouds</h3>
            <button 
              className="text-blue-500 hover:text-blue-700 flex items-center space-x-1 transition-colors"
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
              <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                No saved graphs
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {savedGraphs.map(graph => (
                  <li 
                    key={graph.signature}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md cursor-pointer flex justify-between items-start transition-colors"
                    onClick={() => handleLoadState(graph)}
                  >
                    <div className="flex-1 pr-2 min-w-0">
                      <div className="font-medium truncate">{graph.title}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(graph.timestamp)}
                      </div>
                      <div className="text-xs truncate text-gray-600 dark:text-gray-400">
                        {graph.signature.substring(0, 12)}...
                      </div>
                    </div>
                    <button
                      className="text-red-500 hover:text-red-700 p-1 transition-colors"
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
};

export default TransactionGraphClouds;