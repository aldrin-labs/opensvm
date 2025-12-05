'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import cytoscape from 'cytoscape';

/**
 * Interface for cached account graph data
 */
export interface CachedAccountGraph {
  account: string;
  nodes: cytoscape.NodeDefinition[];
  edges: cytoscape.EdgeDefinition[];
  timestamp: number;
  viewportState?: { zoom: number; pan: { x: number; y: number } };
}

/**
 * Interface for multi-account view state
 */
export interface MultiAccountViewState {
  accounts: string[];
  isActive: boolean;
  connections: Array<{
    from: string;
    to: string;
    transfers: number;
    volume: number;
  }>;
}

// LRU cache for account graphs with max 20 accounts
const MAX_CACHE_SIZE = 20;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Hook for caching account graph data with LRU eviction
 */
export function useAccountGraphCache() {
  // In-memory LRU cache
  const cacheRef = useRef<Map<string, CachedAccountGraph>>(new Map());
  const accessOrderRef = useRef<string[]>([]);

  // Multi-account view state
  const [multiAccountView, setMultiAccountView] = useState<MultiAccountViewState>({
    accounts: [],
    isActive: false,
    connections: []
  });

  // Morphing transition state
  const [isMorphing, setIsMorphing] = useState(false);
  const morphingNodesRef = useRef<Map<string, { from: cytoscape.Position; to: cytoscape.Position }>>(new Map());

  /**
   * Get cached graph data for an account
   */
  const getCachedGraph = useCallback((account: string): CachedAccountGraph | null => {
    const cache = cacheRef.current;
    const cached = cache.get(account);

    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      cache.delete(account);
      accessOrderRef.current = accessOrderRef.current.filter(a => a !== account);
      return null;
    }

    // Update access order (LRU)
    accessOrderRef.current = accessOrderRef.current.filter(a => a !== account);
    accessOrderRef.current.push(account);

    return cached;
  }, []);

  /**
   * Cache graph data for an account
   */
  const cacheGraph = useCallback((
    account: string,
    nodes: cytoscape.NodeDefinition[],
    edges: cytoscape.EdgeDefinition[],
    viewportState?: { zoom: number; pan: { x: number; y: number } }
  ) => {
    const cache = cacheRef.current;

    // Evict oldest if at capacity
    while (cache.size >= MAX_CACHE_SIZE && accessOrderRef.current.length > 0) {
      const oldest = accessOrderRef.current.shift();
      if (oldest) {
        cache.delete(oldest);
      }
    }

    // Store in cache
    cache.set(account, {
      account,
      nodes: JSON.parse(JSON.stringify(nodes)), // Deep clone
      edges: JSON.parse(JSON.stringify(edges)), // Deep clone
      timestamp: Date.now(),
      viewportState
    });

    // Update access order
    accessOrderRef.current = accessOrderRef.current.filter(a => a !== account);
    accessOrderRef.current.push(account);
  }, []);

  /**
   * Save current cytoscape state to cache
   */
  const saveCurrentState = useCallback((account: string, cy: cytoscape.Core) => {
    if (!cy) return;

    const nodes = cy.nodes().map(node => ({
      data: { ...node.data() },
      position: node.position()
    }));

    const edges = cy.edges().map(edge => ({
      data: { ...edge.data() }
    }));

    const viewportState = {
      zoom: cy.zoom(),
      pan: cy.pan()
    };

    cacheGraph(account, nodes, edges, viewportState);
  }, [cacheGraph]);

  /**
   * Restore graph from cache with morphing animation
   */
  const restoreFromCache = useCallback(async (
    account: string,
    cy: cytoscape.Core,
    animate: boolean = true
  ): Promise<boolean> => {
    const cached = getCachedGraph(account);
    if (!cached || !cy) return false;

    if (animate) {
      setIsMorphing(true);

      // Find common nodes between current and cached
      const currentNodes = new Map<string, cytoscape.NodeSingular>();
      cy.nodes().forEach(node => currentNodes.set(node.id(), node));

      const cachedNodeMap = new Map<string, cytoscape.NodeDefinition>();
      cached.nodes.forEach(node => cachedNodeMap.set(node.data.id, node));

      // Calculate morphing transitions for shared nodes
      morphingNodesRef.current.clear();
      currentNodes.forEach((node, id) => {
        const cachedNode = cachedNodeMap.get(id);
        if (cachedNode && cachedNode.position) {
          morphingNodesRef.current.set(id, {
            from: node.position(),
            to: cachedNode.position as cytoscape.Position
          });
        }
      });

      // Fade out nodes that will be removed
      const nodesToRemove = cy.nodes().filter(node => !cachedNodeMap.has(node.id()));
      const edgesToRemove = cy.edges().filter(edge => {
        const cachedEdge = cached.edges.find(e => e.data.id === edge.id());
        return !cachedEdge;
      });

      // Animate removal
      await Promise.all([
        ...nodesToRemove.map(node =>
          node.animate({
            style: { opacity: 0 },
            duration: 200,
            easing: 'ease-out'
          }).promise()
        ),
        ...edgesToRemove.map(edge =>
          edge.animate({
            style: { opacity: 0 },
            duration: 200,
            easing: 'ease-out'
          }).promise()
        )
      ]);

      // Remove faded elements
      nodesToRemove.remove();
      edgesToRemove.remove();

      // Add new nodes with fade in
      const newNodes = cached.nodes.filter(node => !currentNodes.has(node.data.id));
      const newEdges = cached.edges.filter(edge => {
        const currentEdge = cy.getElementById(edge.data.id);
        return currentEdge.length === 0;
      });

      // Add new elements
      cy.batch(() => {
        newNodes.forEach(node => {
          cy.add({
            ...node,
            style: { opacity: 0 }
          });
        });
        newEdges.forEach(edge => {
          cy.add({
            ...edge,
            style: { opacity: 0 }
          });
        });
      });

      // Animate shared nodes to new positions and fade in new nodes
      const animations: Promise<void>[] = [];

      // Morph shared nodes
      morphingNodesRef.current.forEach((positions, id) => {
        const node = cy.getElementById(id);
        if (node.length > 0) {
          animations.push(
            node.animate({
              position: positions.to,
              duration: 400,
              easing: 'ease-in-out'
            }).promise() as Promise<void>
          );
        }
      });

      // Fade in new nodes
      newNodes.forEach(nodeDef => {
        const node = cy.getElementById(nodeDef.data.id);
        if (node.length > 0) {
          animations.push(
            node.animate({
              style: { opacity: 1 },
              duration: 300,
              easing: 'ease-in'
            }).promise() as Promise<void>
          );
        }
      });

      // Fade in new edges
      newEdges.forEach(edgeDef => {
        const edge = cy.getElementById(edgeDef.data.id);
        if (edge.length > 0) {
          animations.push(
            edge.animate({
              style: { opacity: 1 },
              duration: 300,
              easing: 'ease-in'
            }).promise() as Promise<void>
          );
        }
      });

      await Promise.all(animations);

      // Restore viewport
      if (cached.viewportState) {
        cy.animate({
          zoom: cached.viewportState.zoom,
          pan: cached.viewportState.pan,
          duration: 300
        });
      }

      setIsMorphing(false);
    } else {
      // Instant restore without animation
      cy.elements().remove();
      cy.add(cached.nodes);
      cy.add(cached.edges);

      if (cached.viewportState) {
        cy.viewport(cached.viewportState);
      }
    }

    return true;
  }, [getCachedGraph]);

  /**
   * Check if account is in cache
   */
  const hasCachedGraph = useCallback((account: string): boolean => {
    return getCachedGraph(account) !== null;
  }, [getCachedGraph]);

  /**
   * Add account to multi-account view
   */
  const addAccountToMultiView = useCallback((account: string) => {
    setMultiAccountView(prev => {
      if (prev.accounts.includes(account)) return prev;
      return {
        ...prev,
        accounts: [...prev.accounts, account],
        isActive: true
      };
    });
  }, []);

  /**
   * Remove account from multi-account view
   */
  const removeAccountFromMultiView = useCallback((account: string) => {
    setMultiAccountView(prev => {
      const accounts = prev.accounts.filter(a => a !== account);
      return {
        ...prev,
        accounts,
        isActive: accounts.length > 1,
        connections: prev.connections.filter(
          c => c.from !== account && c.to !== account
        )
      };
    });
  }, []);

  /**
   * Toggle multi-account view mode
   */
  const toggleMultiAccountView = useCallback(() => {
    setMultiAccountView(prev => ({
      ...prev,
      isActive: !prev.isActive && prev.accounts.length > 1
    }));
  }, []);

  /**
   * Calculate connections between accounts in multi-view
   */
  const calculateMultiAccountConnections = useCallback(async (
    accounts: string[]
  ): Promise<Array<{ from: string; to: string; transfers: number; volume: number }>> => {
    const connections: Array<{ from: string; to: string; transfers: number; volume: number }> = [];

    // For each pair of accounts, find shared addresses
    for (let i = 0; i < accounts.length; i++) {
      for (let j = i + 1; j < accounts.length; j++) {
        const account1 = accounts[i];
        const account2 = accounts[j];

        const cached1 = getCachedGraph(account1);
        const cached2 = getCachedGraph(account2);

        if (!cached1 || !cached2) continue;

        // Find edges that connect these accounts
        const edges1Set = new Set(cached1.edges.map(e => e.data.id));
        const edges2Set = new Set(cached2.edges.map(e => e.data.id));

        // Check for direct connections
        let directTransfers = 0;
        let directVolume = 0;

        cached1.edges.forEach(edge => {
          if (edge.data.source === account2 || edge.data.target === account2) {
            directTransfers++;
            directVolume += edge.data.amount || 0;
          }
        });

        cached2.edges.forEach(edge => {
          if (edge.data.source === account1 || edge.data.target === account1) {
            directTransfers++;
            directVolume += edge.data.amount || 0;
          }
        });

        if (directTransfers > 0) {
          connections.push({
            from: account1,
            to: account2,
            transfers: directTransfers,
            volume: directVolume
          });
        }
      }
    }

    setMultiAccountView(prev => ({
      ...prev,
      connections
    }));

    return connections;
  }, [getCachedGraph]);

  /**
   * Build merged graph for multi-account view
   */
  const buildMultiAccountGraph = useCallback((
    cy: cytoscape.Core,
    accounts: string[]
  ) => {
    if (!cy || accounts.length < 2) return;

    const allNodes = new Map<string, cytoscape.NodeDefinition>();
    const allEdges = new Map<string, cytoscape.EdgeDefinition>();
    const accountColors = [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))'
    ];

    accounts.forEach((account, index) => {
      const cached = getCachedGraph(account);
      if (!cached) return;

      const color = accountColors[index % accountColors.length];

      // Add nodes with account-specific styling
      cached.nodes.forEach(node => {
        const existingNode = allNodes.get(node.data.id);
        if (existingNode) {
          // Node exists - mark as shared
          existingNode.data.isShared = true;
          existingNode.data.sharedWith = [
            ...(existingNode.data.sharedWith || []),
            account
          ];
        } else {
          allNodes.set(node.data.id, {
            ...node,
            data: {
              ...node.data,
              accountGroup: account,
              accountColor: color,
              isShared: false,
              sharedWith: []
            }
          });
        }
      });

      // Add edges
      cached.edges.forEach(edge => {
        if (!allEdges.has(edge.data.id)) {
          allEdges.set(edge.data.id, {
            ...edge,
            data: {
              ...edge.data,
              accountGroup: account
            }
          });
        }
      });
    });

    // Clear and rebuild graph
    cy.elements().remove();
    cy.add(Array.from(allNodes.values()));
    cy.add(Array.from(allEdges.values()));

    // Apply multi-account layout
    const layout = cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 500,
      nodeRepulsion: () => 8000,
      idealEdgeLength: () => 100,
      edgeElasticity: () => 100,
      nestingFactor: 1.2,
      gravity: 0.25,
      numIter: 1000,
      initialTemp: 200,
      coolingFactor: 0.95,
      minTemp: 1.0
    } as any);

    layout.run();
  }, [getCachedGraph]);

  /**
   * Clear all cached graphs
   */
  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    accessOrderRef.current = [];
  }, []);

  /**
   * Get cache stats
   */
  const getCacheStats = useCallback(() => ({
    size: cacheRef.current.size,
    maxSize: MAX_CACHE_SIZE,
    accounts: Array.from(cacheRef.current.keys()),
    oldestAccess: accessOrderRef.current[0] || null,
    newestAccess: accessOrderRef.current[accessOrderRef.current.length - 1] || null
  }), []);

  return {
    // Caching
    getCachedGraph,
    cacheGraph,
    saveCurrentState,
    restoreFromCache,
    hasCachedGraph,
    clearCache,
    getCacheStats,

    // Morphing
    isMorphing,

    // Multi-account view
    multiAccountView,
    addAccountToMultiView,
    removeAccountFromMultiView,
    toggleMultiAccountView,
    calculateMultiAccountConnections,
    buildMultiAccountGraph
  };
}
