'use client';

import { useState, useCallback, useEffect } from 'react';
import { debugLog } from '../utils';

export function useGPUForceGraph() {
  const [useGPUGraph, setUseGPUGraph] = useState<boolean>(true); // Always use GPU by default
  const [gpuGraphData, setGpuGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });

  // Debug GPU graph data changes
  useEffect(() => {
    debugLog(`GPU graph data updated: ${gpuGraphData.nodes.length} nodes, ${gpuGraphData.links.length} links`);
  }, [gpuGraphData]);

  // Convert Cytoscape data to GPU graph format
  const convertCytoscapeToGPUData = useCallback((cy: cytoscape.Core) => {
    if (!cy) return { nodes: [], links: [] };

    try {
      const nodes = cy.nodes().map((node) => {
        const nodeData = node.data();
        const position = node.position();
        
        return {
          id: nodeData.id,
          label: nodeData.label || nodeData.id,
          type: nodeData.type || 'transaction',
          group: nodeData.group || 'default',
          x: position.x,
          y: position.y,
          size: nodeData.size || 10,
          color: nodeData.color || '#4ade80',
          data: nodeData
        };
      });

      const links = cy.edges().map((edge) => {
        const edgeData = edge.data();
        return {
          id: edgeData.id,
          source: edgeData.source,
          target: edgeData.target,
          value: edgeData.value || 1,
          color: edgeData.color || '#6b7280',
          type: edgeData.type || 'transfer',
          data: edgeData
        };
      });

      debugLog(`Converted cytoscape data: ${nodes.length} nodes, ${links.length} links`);
      return { nodes, links };
    } catch (error) {
      console.error('Error converting cytoscape data to GPU format:', error);
      return { nodes: [], links: [] };
    }
  }, []);

  // Update GPU graph data when Cytoscape changes
  const updateGPUGraphData = useCallback((cy: cytoscape.Core) => {
    if (!cy || !useGPUGraph) return;

    try {
      const gpuData = convertCytoscapeToGPUData(cy);
      setGpuGraphData(gpuData);
    } catch (error) {
      console.error('Error updating GPU graph data:', error);
    }
  }, [useGPUGraph, convertCytoscapeToGPUData]);

  // GPU Graph event handlers
  const handleGPUNodeClick = useCallback((node: any) => {
    debugLog('GPU node clicked:', node);
    
    if (node.type === 'transaction') {
      // Handle transaction click
      const signature = node.id;
      if (typeof window !== 'undefined') {
        window.open(`/tx/${signature}`, '_blank');
      }
    } else if (node.type === 'account') {
      // Handle account click
      const address = node.id;
      if (typeof window !== 'undefined') {
        window.open(`/account/${address}`, '_blank');
      }
    }
  }, []);

  const handleGPUNodeHover = useCallback((node: any) => {
    debugLog('GPU node hovered:', node?.id);
  }, []);

  return {
    useGPUGraph,
    setUseGPUGraph,
    gpuGraphData,
    setGpuGraphData,
    convertCytoscapeToGPUData,
    updateGPUGraphData,
    handleGPUNodeClick,
    handleGPUNodeHover
  };
}