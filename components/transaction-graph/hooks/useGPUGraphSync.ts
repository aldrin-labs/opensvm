'use client';

import { useCallback, useEffect, useState } from 'react';
import cytoscape from 'cytoscape';
import { debugLog } from '../';

interface GraphData {
  nodes: Array<{
    id: string;
    type: 'account' | 'transaction';
    label: string;
    color?: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    type?: string;
    color?: string;
  }>;
}

interface UseGPUGraphSyncProps {
  cyRef: React.MutableRefObject<cytoscape.Core | null>;
  useGPUGraph: boolean;
}

interface UseGPUGraphSyncReturn {
  gpuGraphData: GraphData;
  updateGPUGraphData: () => void;
  convertToGPUGraphData: () => GraphData;
}

/**
 * Custom hook for synchronizing Cytoscape graph data with GPU-accelerated visualization
 * Handles the conversion and updates between different graph representations
 */
export function useGPUGraphSync({
  cyRef,
  useGPUGraph
}: UseGPUGraphSyncProps): UseGPUGraphSyncReturn {
  const [gpuGraphData, setGpuGraphData] = useState<GraphData>({ nodes: [], links: [] });

  // Convert Cytoscape data to GPU graph format
  const convertToGPUGraphData = useCallback((): GraphData => {
    const cy = cyRef.current;
    if (!cy || !useGPUGraph) {
      return { nodes: [], links: [] };
    }

    try {
      const nodes = cy.nodes().map(node => ({
        id: node.id(),
        type: (node.data('type') || 'account') as 'account' | 'transaction',
        label: node.data('label') || node.id().substring(0, 8) + '...',
        color: node.style('background-color') || '#666'
      }));

      const links = cy.edges().map(edge => ({
        source: edge.source().id(),
        target: edge.target().id(),
        type: edge.data('type') || 'transfer',
        color: edge.style('line-color') || '#666'
      }));

      debugLog(`🔄 [GPU_CONVERT] Converted ${nodes.length} nodes and ${links.length} links to GPU format`);
      
      return { nodes, links };
    } catch (error) {
      console.error('Error converting to GPU graph data:', error);
      return { nodes: [], links: [] };
    }
  }, [cyRef, useGPUGraph]);

  // Update GPU graph data from current Cytoscape state
  const updateGPUGraphData = useCallback(() => {
    if (!useGPUGraph) return;
    
    const newData = convertToGPUGraphData();
    setGpuGraphData(newData);
    
    debugLog(`🔄 [GPU_STATE] GPU graph data updated: ${newData.nodes.length} nodes, ${newData.links.length} links`);
  }, [convertToGPUGraphData, useGPUGraph]);

  // Set up GPU graph synchronization
  useEffect(() => {
    if (!cyRef.current || !useGPUGraph) return;

    debugLog('🔄 [GPU_LISTENER] Setting up GPU graph update listeners');
    
    // Set up listener for graph changes
    const updateHandler = () => {
      debugLog('🔄 [GPU_LISTENER] Cytoscape graph changed, updating GPU graph');
      updateGPUGraphData();
    };
    
    // Listen to more events to ensure updates
    cyRef.current.on('add remove data position', updateHandler);
    
    // Initial update
    updateGPUGraphData();
    
    return () => {
      if (cyRef.current) {
        cyRef.current.removeListener('add remove data position', updateHandler);
      }
    };
  }, [cyRef, useGPUGraph, updateGPUGraphData]);

  return {
    gpuGraphData,
    updateGPUGraphData,
    convertToGPUGraphData
  };
}