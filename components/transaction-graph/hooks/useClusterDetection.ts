'use client';

import { useState, useCallback, useRef } from 'react';
import cytoscape from 'cytoscape';

interface Cluster {
  id: string;
  nodes: string[];
  centerNode: string;
  size: number;
  density: number;
  totalVolume: number;
  isCollapsed: boolean;
  label: string;
  color: string;
  riskScore: number;
  patterns: string[];
}

interface ClusterAnalysis {
  clusters: Cluster[];
  isolatedNodes: string[];
  bridgeNodes: string[]; // Nodes connecting multiple clusters
  stats: {
    clusterCount: number;
    avgClusterSize: number;
    modularity: number;
    largestCluster: number;
  };
}

const CLUSTER_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(200, 70%, 50%)',
  'hsl(280, 70%, 50%)',
  'hsl(340, 70%, 50%)',
  'hsl(60, 70%, 50%)',
  'hsl(160, 70%, 50%)'
];

/**
 * Hook for cluster detection using Louvain algorithm
 */
export function useClusterDetection() {
  const [analysis, setAnalysis] = useState<ClusterAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const clusterMapRef = useRef<Map<string, Cluster>>(new Map());

  /**
   * Louvain-inspired community detection algorithm
   * Simplified implementation for browser performance
   */
  const detectCommunities = useCallback((cy: cytoscape.Core): Map<string, number> => {
    const nodes = cy.nodes('[type="account"]');
    const communityMap = new Map<string, number>();

    // Initialize each node in its own community
    nodes.forEach((node, i) => {
      communityMap.set(node.id(), i);
    });

    let improved = true;
    let iterations = 0;
    const maxIterations = 10;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      nodes.forEach(node => {
        const nodeId = node.id();
        const currentCommunity = communityMap.get(nodeId)!;

        // Get neighbor communities
        const neighborCommunities = new Map<number, number>();
        node.neighborhood('node[type="account"]').forEach(neighbor => {
          const neighborCommunity = communityMap.get(neighbor.id())!;
          neighborCommunities.set(
            neighborCommunity,
            (neighborCommunities.get(neighborCommunity) || 0) + 1
          );
        });

        // Find best community (most neighbors)
        let bestCommunity = currentCommunity;
        let maxNeighbors = neighborCommunities.get(currentCommunity) || 0;

        neighborCommunities.forEach((count, community) => {
          if (count > maxNeighbors) {
            maxNeighbors = count;
            bestCommunity = community;
          }
        });

        // Move to best community if different
        if (bestCommunity !== currentCommunity) {
          communityMap.set(nodeId, bestCommunity);
          improved = true;
        }
      });
    }

    return communityMap;
  }, []);

  /**
   * Detect and analyze clusters
   */
  const analyzeClusters = useCallback((cy: cytoscape.Core): ClusterAnalysis => {
    setIsAnalyzing(true);

    try {
      // Run community detection
      const communityMap = detectCommunities(cy);

      // Group nodes by community
      const communityNodes = new Map<number, string[]>();
      communityMap.forEach((community, nodeId) => {
        if (!communityNodes.has(community)) {
          communityNodes.set(community, []);
        }
        communityNodes.get(community)!.push(nodeId);
      });

      // Build cluster objects
      const clusters: Cluster[] = [];
      const clusterMap = new Map<string, Cluster>();
      let colorIndex = 0;

      communityNodes.forEach((nodes, communityId) => {
        if (nodes.length < 2) return; // Skip single-node "clusters"

        const clusterId = `cluster-${communityId}`;

        // Calculate cluster metrics
        let totalVolume = 0;
        let internalEdges = 0;
        let externalEdges = 0;
        const nodeSet = new Set(nodes);

        nodes.forEach(nodeId => {
          const node = cy.getElementById(nodeId);
          node.connectedEdges().forEach(edge => {
            const amount = edge.data('amount') || 0;
            totalVolume += amount;

            const source = edge.data('source');
            const target = edge.data('target');
            const otherNode = source === nodeId ? target : source;

            if (nodeSet.has(otherNode)) {
              internalEdges++;
            } else {
              externalEdges++;
            }
          });
        });

        // Find center node (highest degree)
        let centerNode = nodes[0];
        let maxDegree = 0;
        nodes.forEach(nodeId => {
          const degree = cy.getElementById(nodeId).degree();
          if (degree > maxDegree) {
            maxDegree = degree;
            centerNode = nodeId;
          }
        });

        // Calculate density
        const possibleEdges = nodes.length * (nodes.length - 1);
        const density = possibleEdges > 0 ? internalEdges / possibleEdges : 0;

        // Detect patterns
        const patterns: string[] = [];
        if (density > 0.5) patterns.push('Dense cluster');
        if (totalVolume > 1000) patterns.push('High volume');
        if (nodes.length > 10) patterns.push('Large group');
        if (externalEdges < internalEdges * 0.1) patterns.push('Isolated cluster');

        // Calculate risk score (0-100)
        let riskScore = 0;
        if (density > 0.7) riskScore += 30; // High density = potential wash trading
        if (nodes.length > 5 && nodes.length < 20) riskScore += 20; // Suspicious size
        if (externalEdges < internalEdges * 0.2) riskScore += 25; // Isolated
        if (totalVolume > 10000) riskScore += 25; // Large volume

        const cluster: Cluster = {
          id: clusterId,
          nodes,
          centerNode,
          size: nodes.length,
          density: Math.round(density * 100) / 100,
          totalVolume,
          isCollapsed: false,
          label: `Cluster ${colorIndex + 1} (${nodes.length} wallets)`,
          color: CLUSTER_COLORS[colorIndex % CLUSTER_COLORS.length],
          riskScore: Math.min(100, riskScore),
          patterns
        };

        clusters.push(cluster);
        clusterMap.set(clusterId, cluster);
        colorIndex++;
      });

      // Find bridge nodes (connect multiple clusters)
      const bridgeNodes: string[] = [];
      cy.nodes('[type="account"]').forEach(node => {
        const nodeId = node.id();
        const connectedClusters = new Set<string>();

        node.neighborhood('node[type="account"]').forEach(neighbor => {
          clusters.forEach(cluster => {
            if (cluster.nodes.includes(neighbor.id())) {
              connectedClusters.add(cluster.id);
            }
          });
        });

        if (connectedClusters.size >= 2) {
          bridgeNodes.push(nodeId);
        }
      });

      // Find isolated nodes
      const allClusteredNodes = new Set(clusters.flatMap(c => c.nodes));
      const isolatedNodes = cy.nodes('[type="account"]')
        .filter(n => !allClusteredNodes.has(n.id()))
        .map(n => n.id());

      // Calculate stats
      const stats = {
        clusterCount: clusters.length,
        avgClusterSize: clusters.length > 0
          ? Math.round(clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length)
          : 0,
        modularity: 0, // Would need full modularity calculation
        largestCluster: clusters.length > 0
          ? Math.max(...clusters.map(c => c.size))
          : 0
      };

      clusterMapRef.current = clusterMap;

      const result: ClusterAnalysis = {
        clusters: clusters.sort((a, b) => b.size - a.size),
        isolatedNodes,
        bridgeNodes,
        stats
      };

      setAnalysis(result);
      return result;

    } finally {
      setIsAnalyzing(false);
    }
  }, [detectCommunities]);

  /**
   * Highlight a specific cluster
   */
  const highlightCluster = useCallback((cy: cytoscape.Core, clusterId: string) => {
    const cluster = clusterMapRef.current.get(clusterId);
    if (!cluster) return;

    // Dim all nodes first
    cy.elements().addClass('cluster-dimmed');

    // Highlight cluster nodes
    cluster.nodes.forEach(nodeId => {
      const node = cy.getElementById(nodeId);
      node.removeClass('cluster-dimmed');
      node.addClass('cluster-highlighted');
      node.style('background-color', cluster.color);
    });

    // Highlight internal edges
    cy.edges().forEach(edge => {
      const source = edge.data('source');
      const target = edge.data('target');
      if (cluster.nodes.includes(source) && cluster.nodes.includes(target)) {
        edge.removeClass('cluster-dimmed');
        edge.addClass('cluster-highlighted');
      }
    });

    setSelectedCluster(clusterId);

    // Fit view to cluster
    const clusterNodes = cy.nodes().filter(n => cluster.nodes.includes(n.id()));
    cy.animate({
      fit: { eles: clusterNodes, padding: 50 },
      duration: 500
    });
  }, []);

  /**
   * Clear cluster highlighting
   */
  const clearHighlighting = useCallback((cy: cytoscape.Core) => {
    cy.elements().removeClass('cluster-dimmed cluster-highlighted');
    cy.nodes().removeStyle('background-color');
    setSelectedCluster(null);
  }, []);

  /**
   * Collapse a cluster into a single super-node
   */
  const collapseCluster = useCallback((cy: cytoscape.Core, clusterId: string) => {
    const cluster = clusterMapRef.current.get(clusterId);
    if (!cluster || cluster.isCollapsed) return;

    // Calculate center position
    let centerX = 0, centerY = 0;
    cluster.nodes.forEach(nodeId => {
      const pos = cy.getElementById(nodeId).position();
      centerX += pos.x;
      centerY += pos.y;
    });
    centerX /= cluster.nodes.length;
    centerY /= cluster.nodes.length;

    // Hide cluster nodes
    cluster.nodes.forEach(nodeId => {
      cy.getElementById(nodeId).addClass('cluster-collapsed');
    });

    // Add super-node
    cy.add({
      group: 'nodes',
      data: {
        id: `supernode-${clusterId}`,
        type: 'cluster',
        label: cluster.label,
        clusterSize: cluster.size,
        clusterId,
        color: cluster.color
      },
      position: { x: centerX, y: centerY },
      classes: 'super-node'
    });

    // Update cluster state
    cluster.isCollapsed = true;
    clusterMapRef.current.set(clusterId, cluster);
  }, []);

  /**
   * Expand a collapsed cluster
   */
  const expandCluster = useCallback((cy: cytoscape.Core, clusterId: string) => {
    const cluster = clusterMapRef.current.get(clusterId);
    if (!cluster || !cluster.isCollapsed) return;

    // Remove super-node
    cy.getElementById(`supernode-${clusterId}`).remove();

    // Show cluster nodes
    cluster.nodes.forEach(nodeId => {
      cy.getElementById(nodeId).removeClass('cluster-collapsed');
    });

    // Update cluster state
    cluster.isCollapsed = false;
    clusterMapRef.current.set(clusterId, cluster);
  }, []);

  /**
   * Apply cluster colors to graph
   */
  const applyClusterColors = useCallback((cy: cytoscape.Core) => {
    if (!analysis) return;

    analysis.clusters.forEach(cluster => {
      cluster.nodes.forEach(nodeId => {
        cy.getElementById(nodeId).style('background-color', cluster.color);
      });
    });

    // Style bridge nodes
    analysis.bridgeNodes.forEach(nodeId => {
      cy.getElementById(nodeId).style({
        'border-width': 3,
        'border-color': 'hsl(var(--warning))'
      });
    });
  }, [analysis]);

  /**
   * Detect wash trading patterns
   */
  const detectWashTrading = useCallback((cy: cytoscape.Core): string[][] => {
    const cycles: string[][] = [];
    const visited = new Set<string>();

    const dfs = (
      start: string,
      current: string,
      path: string[],
      depth: number
    ) => {
      if (depth > 5) return; // Max cycle length
      if (path.length > 2 && current === start) {
        cycles.push([...path]);
        return;
      }
      if (path.includes(current) && current !== start) return;

      const node = cy.getElementById(current);
      node.neighborhood('node[type="account"]').forEach(neighbor => {
        const neighborId = neighbor.id();
        dfs(start, neighborId, [...path, current], depth + 1);
      });
    };

    cy.nodes('[type="account"]').forEach(node => {
      if (!visited.has(node.id())) {
        dfs(node.id(), node.id(), [], 0);
        visited.add(node.id());
      }
    });

    return cycles;
  }, []);

  return {
    // State
    analysis,
    isAnalyzing,
    selectedCluster,

    // Actions
    analyzeClusters,
    highlightCluster,
    clearHighlighting,
    collapseCluster,
    expandCluster,
    applyClusterColors,
    detectWashTrading,
    setSelectedCluster
  };
}

export default useClusterDetection;
