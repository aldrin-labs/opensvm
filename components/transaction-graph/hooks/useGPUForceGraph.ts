'use client';

import { useState, useCallback, useEffect } from 'react';
import { debugLog } from '../utils';

export function useGPUForceGraph() {
  const [useGPUGraph, setUseGPUGraph] = useState<boolean>(false); // Disable GPU force-graph for now; use Cytoscape only
  const [gpuGraphData, setGpuGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });

  // Store callbacks for GPU handlers
  const [onTransactionSelect, setOnTransactionSelect] = useState<((signature: string) => void) | null>(null);
  const [onAccountSelect, setOnAccountSelect] = useState<((address: string) => void) | null>(null);

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

        // Ensure labels follow 5...5 truncation for long ids
        const rawLabel = (nodeData.label || nodeData.id) as string;
        const shouldTruncate = typeof rawLabel === 'string' && rawLabel.length > 12;
        const truncated =
          (nodeData.type === 'account' || nodeData.type === 'transaction') && shouldTruncate
            ? `${rawLabel.slice(0, 5)}...${rawLabel.slice(-5)}`
            : rawLabel;

        return {
          id: nodeData.id,
          label: truncated,
          type: nodeData.type || 'transaction',
          group: nodeData.group || 'default',
          x: position.x,
          y: position.y,
          size: nodeData.size || 10,
          color: nodeData.color || 'hsl(var(--success))',
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
          color: edgeData.color || 'hsl(var(--muted-foreground))',
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
    if (!cy) return;

    try {
      const gpuData = convertCytoscapeToGPUData(cy);
      setGpuGraphData(gpuData);
      debugLog(`GPU graph data updated: ${gpuData.nodes.length} nodes, ${gpuData.links.length} links`);
    } catch (error) {
      console.error('Error updating GPU graph data:', error);
    }
  }, [convertCytoscapeToGPUData]);

  // GPU Graph event handlers
  const handleGPUNodeClick = useCallback((node: any) => {
    debugLog('GPU node clicked:', node, 'Callbacks available:', {
      account: !!onAccountSelect,
      transaction: !!onTransactionSelect
    });

    if (node.type === 'account') {
      // Handle account click - use callback if available, otherwise fallback
      const address = node.id;
      console.log('GPU: Account node clicked:', address, 'Callback available:', !!onAccountSelect);

      if (onAccountSelect && typeof onAccountSelect === 'function') {
        console.log('GPU: Using account callback for navigation');
        onAccountSelect(address);
      } else {
        console.log('GPU: No callback available, using page navigation fallback');
        if (typeof window !== 'undefined') {
          window.location.href = `/account/${address}`;
        }
      }
    } else if (node.type === 'transaction') {
      // Handle transaction click - use callback if available, otherwise fallback
      const signature = node.id;
      console.log('GPU: Transaction node clicked:', signature, 'Callback available:', !!onTransactionSelect);

      if (onTransactionSelect && typeof onTransactionSelect === 'function') {
        console.log('GPU: Using transaction callback');
        onTransactionSelect(signature);
      } else {
        console.log('GPU: No callback available, using page navigation fallback');
        if (typeof window !== 'undefined') {
          window.open(`/tx/${signature}`, '_blank');
        }
      }
    }
  }, [onAccountSelect, onTransactionSelect]);

  // Handle link clicks - should open transaction pages
  const handleGPULinkClick = useCallback((link: any) => {
    debugLog('GPU link clicked:', link);

    // Links represent connections between accounts and transactions
    // When a link is clicked, we want to navigate to the transaction
    if (link.source && link.target) {
      // Determine which end is the transaction
      let transactionId = null;

      if (typeof link.source === 'object' && link.source.type === 'transaction') {
        transactionId = link.source.id;
      } else if (typeof link.target === 'object' && link.target.type === 'transaction') {
        transactionId = link.target.id;
      } else if (typeof link.source === 'string') {
        // If source is string, check if it looks like a transaction signature (longer than account address)
        transactionId = link.source.length > 50 ? link.source : link.target;
      }

      if (transactionId) {
        if (onTransactionSelect) {
          onTransactionSelect(transactionId);
        } else if (typeof window !== 'undefined') {
          window.open(`/tx/${transactionId}`, '_blank');
        }
      }
    }
  }, [onTransactionSelect]);

  const handleGPUNodeHover = useCallback((node: any) => {
    debugLog('GPU node hovered:', node?.id);
  }, []);

  // Function to set the callbacks for GPU handlers
  const setGPUCallbacks = useCallback((
    transactionCallback?: (signature: string) => void,
    accountCallback?: (address: string) => void
  ) => {
    setOnTransactionSelect(() => transactionCallback || null);
    setOnAccountSelect(() => accountCallback || null);
  }, []);

  return {
    useGPUGraph,
    setUseGPUGraph,
    gpuGraphData,
    setGpuGraphData,
    convertCytoscapeToGPUData,
    updateGPUGraphData,
    handleGPUNodeClick,
    handleGPULinkClick,
    handleGPUNodeHover,
    setGPUCallbacks
  };
}
