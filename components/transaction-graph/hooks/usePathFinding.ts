'use client';

import { useState, useCallback, useRef } from 'react';
import cytoscape from 'cytoscape';

interface PathNode {
  id: string;
  type: 'account' | 'transaction';
  label: string;
}

interface PathEdge {
  id: string;
  source: string;
  target: string;
  amount?: number;
  tokenSymbol?: string;
  txSignature?: string;
}

interface FoundPath {
  nodes: PathNode[];
  edges: PathEdge[];
  totalAmount: number;
  length: number;
  transactions: string[];
}

interface PathFindingState {
  isActive: boolean;
  sourceAccount: string | null;
  targetAccount: string | null;
  paths: FoundPath[];
  isSearching: boolean;
  error: string | null;
}

/**
 * Hook for finding paths between accounts in the graph
 * Implements BFS shortest path and all-paths algorithms
 */
export function usePathFinding() {
  const [state, setState] = useState<PathFindingState>({
    isActive: false,
    sourceAccount: null,
    targetAccount: null,
    paths: [],
    isSearching: false,
    error: null
  });

  const highlightedElementsRef = useRef<cytoscape.Collection | null>(null);

  /**
   * Toggle path finding mode
   */
  const togglePathFindingMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: !prev.isActive,
      sourceAccount: prev.isActive ? null : prev.sourceAccount,
      targetAccount: prev.isActive ? null : prev.targetAccount,
      paths: prev.isActive ? [] : prev.paths,
      error: null
    }));
  }, []);

  /**
   * Exit path finding mode
   */
  const exitPathFindingMode = useCallback(() => {
    setState({
      isActive: false,
      sourceAccount: null,
      targetAccount: null,
      paths: [],
      isSearching: false,
      error: null
    });
  }, []);

  /**
   * Select source account for path finding
   */
  const selectSourceAccount = useCallback((account: string) => {
    setState(prev => ({
      ...prev,
      sourceAccount: account,
      paths: [],
      error: null
    }));
  }, []);

  /**
   * Select target account for path finding
   */
  const selectTargetAccount = useCallback((account: string) => {
    setState(prev => ({
      ...prev,
      targetAccount: account,
      paths: [],
      error: null
    }));
  }, []);

  /**
   * Handle node click in path finding mode
   */
  const handleNodeClickInPathMode = useCallback((nodeId: string, nodeType: string) => {
    if (nodeType !== 'account') return;

    setState(prev => {
      if (!prev.sourceAccount) {
        return { ...prev, sourceAccount: nodeId, error: null };
      } else if (nodeId === prev.sourceAccount) {
        // Clicked same node, deselect
        return { ...prev, sourceAccount: null, error: null };
      } else {
        return { ...prev, targetAccount: nodeId, error: null };
      }
    });
  }, []);

  /**
   * Find shortest path using BFS
   */
  const findShortestPath = useCallback((
    cy: cytoscape.Core,
    source: string,
    target: string
  ): FoundPath | null => {
    const sourceNode = cy.getElementById(source);
    const targetNode = cy.getElementById(target);

    if (sourceNode.length === 0 || targetNode.length === 0) {
      return null;
    }

    // Use Cytoscape's built-in BFS for shortest path
    const bfs = cy.elements().bfs({
      root: sourceNode,
      goal: targetNode,
      directed: false
    });

    if (!bfs.found) {
      return null;
    }

    const pathNodes: PathNode[] = [];
    const pathEdges: PathEdge[] = [];
    const transactions: string[] = [];
    let totalAmount = 0;

    bfs.path.forEach((ele) => {
      if (ele.isNode()) {
        pathNodes.push({
          id: ele.id(),
          type: ele.data('type') as 'account' | 'transaction',
          label: ele.data('label') || ele.id().slice(0, 8) + '...'
        });
      } else if (ele.isEdge()) {
        const edgeData = ele.data();
        pathEdges.push({
          id: ele.id(),
          source: edgeData.source,
          target: edgeData.target,
          amount: edgeData.amount,
          tokenSymbol: edgeData.tokenSymbol,
          txSignature: edgeData.fullSignature
        });
        if (edgeData.amount) {
          totalAmount += edgeData.amount;
        }
        if (edgeData.fullSignature) {
          transactions.push(edgeData.fullSignature);
        }
      }
    });

    return {
      nodes: pathNodes,
      edges: pathEdges,
      totalAmount,
      length: pathNodes.length,
      transactions: [...new Set(transactions)] // Dedupe
    };
  }, []);

  /**
   * Find all paths between two accounts (limited depth)
   */
  const findAllPaths = useCallback((
    cy: cytoscape.Core,
    source: string,
    target: string,
    maxDepth: number = 5,
    maxPaths: number = 10
  ): FoundPath[] => {
    const paths: FoundPath[] = [];
    const visited = new Set<string>();

    const dfs = (
      currentId: string,
      currentPath: string[],
      currentEdges: string[],
      depth: number
    ) => {
      if (depth > maxDepth || paths.length >= maxPaths) return;

      if (currentId === target && currentPath.length > 1) {
        // Found a path
        const pathNodes: PathNode[] = [];
        const pathEdges: PathEdge[] = [];
        const transactions: string[] = [];
        let totalAmount = 0;

        currentPath.forEach(nodeId => {
          const node = cy.getElementById(nodeId);
          if (node.length > 0) {
            pathNodes.push({
              id: nodeId,
              type: node.data('type') as 'account' | 'transaction',
              label: node.data('label') || nodeId.slice(0, 8) + '...'
            });
          }
        });

        currentEdges.forEach(edgeId => {
          const edge = cy.getElementById(edgeId);
          if (edge.length > 0) {
            const edgeData = edge.data();
            pathEdges.push({
              id: edgeId,
              source: edgeData.source,
              target: edgeData.target,
              amount: edgeData.amount,
              tokenSymbol: edgeData.tokenSymbol,
              txSignature: edgeData.fullSignature
            });
            if (edgeData.amount) {
              totalAmount += edgeData.amount;
            }
            if (edgeData.fullSignature) {
              transactions.push(edgeData.fullSignature);
            }
          }
        });

        paths.push({
          nodes: pathNodes,
          edges: pathEdges,
          totalAmount,
          length: pathNodes.length,
          transactions: [...new Set(transactions)]
        });
        return;
      }

      visited.add(currentId);

      const currentNode = cy.getElementById(currentId);
      const connectedEdges = currentNode.connectedEdges();

      connectedEdges.forEach(edge => {
        const sourceId = edge.data('source');
        const targetId = edge.data('target');
        const neighborId = sourceId === currentId ? targetId : sourceId;

        if (!visited.has(neighborId)) {
          dfs(
            neighborId,
            [...currentPath, neighborId],
            [...currentEdges, edge.id()],
            depth + 1
          );
        }
      });

      visited.delete(currentId);
    };

    dfs(source, [source], [], 0);

    // Sort by path length (shortest first)
    return paths.sort((a, b) => a.length - b.length);
  }, []);

  /**
   * Search for paths between selected accounts
   */
  const searchPaths = useCallback(async (
    cy: cytoscape.Core,
    mode: 'shortest' | 'all' = 'all'
  ) => {
    const { sourceAccount, targetAccount } = state;

    if (!sourceAccount || !targetAccount) {
      setState(prev => ({
        ...prev,
        error: 'Please select both source and target accounts'
      }));
      return;
    }

    if (sourceAccount === targetAccount) {
      setState(prev => ({
        ...prev,
        error: 'Source and target must be different accounts'
      }));
      return;
    }

    setState(prev => ({ ...prev, isSearching: true, error: null }));

    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));

      let foundPaths: FoundPath[];

      if (mode === 'shortest') {
        const shortestPath = findShortestPath(cy, sourceAccount, targetAccount);
        foundPaths = shortestPath ? [shortestPath] : [];
      } else {
        foundPaths = findAllPaths(cy, sourceAccount, targetAccount);
      }

      if (foundPaths.length === 0) {
        setState(prev => ({
          ...prev,
          isSearching: false,
          paths: [],
          error: 'No path found between these accounts. They may not be connected in the current graph.'
        }));
      } else {
        setState(prev => ({
          ...prev,
          isSearching: false,
          paths: foundPaths,
          error: null
        }));
      }
    } catch (error) {
      console.error('Path finding error:', error);
      setState(prev => ({
        ...prev,
        isSearching: false,
        error: 'An error occurred while searching for paths'
      }));
    }
  }, [state.sourceAccount, state.targetAccount, findShortestPath, findAllPaths]);

  /**
   * Highlight a specific path in the graph
   */
  const highlightPath = useCallback((cy: cytoscape.Core, pathIndex: number) => {
    const path = state.paths[pathIndex];
    if (!path) return;

    // Clear previous highlights
    if (highlightedElementsRef.current) {
      highlightedElementsRef.current.removeClass('path-highlighted');
    }

    // Highlight path elements
    const nodeIds = path.nodes.map(n => n.id);
    const edgeIds = path.edges.map(e => e.id);

    const elements = cy.collection();
    nodeIds.forEach(id => {
      const node = cy.getElementById(id);
      if (node.length > 0) elements.merge(node);
    });
    edgeIds.forEach(id => {
      const edge = cy.getElementById(id);
      if (edge.length > 0) elements.merge(edge);
    });

    elements.addClass('path-highlighted');
    highlightedElementsRef.current = elements;

    // Animate to fit path in view
    cy.animate({
      fit: {
        eles: elements,
        padding: 50
      },
      duration: 500,
      easing: 'ease-in-out'
    });
  }, [state.paths]);

  /**
   * Clear all path highlights
   */
  const clearHighlights = useCallback((cy: cytoscape.Core) => {
    if (highlightedElementsRef.current) {
      highlightedElementsRef.current.removeClass('path-highlighted');
      highlightedElementsRef.current = null;
    }
    cy.elements().removeClass('path-source path-target');
  }, []);

  /**
   * Swap source and target accounts
   */
  const swapSourceTarget = useCallback(() => {
    setState(prev => ({
      ...prev,
      sourceAccount: prev.targetAccount,
      targetAccount: prev.sourceAccount,
      paths: [],
      error: null
    }));
  }, []);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      sourceAccount: null,
      targetAccount: null,
      paths: [],
      error: null
    }));
  }, []);

  return {
    // State
    isPathFindingMode: state.isActive,
    sourceAccount: state.sourceAccount,
    targetAccount: state.targetAccount,
    paths: state.paths,
    isSearching: state.isSearching,
    error: state.error,

    // Actions
    togglePathFindingMode,
    exitPathFindingMode,
    selectSourceAccount,
    selectTargetAccount,
    handleNodeClickInPathMode,
    searchPaths,
    highlightPath,
    clearHighlights,
    swapSourceTarget,
    clearSelection
  };
}

export default usePathFinding;
