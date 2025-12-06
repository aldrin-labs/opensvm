'use client';

import { useState, useCallback } from 'react';
import cytoscape from 'cytoscape';

interface NodeMetrics {
  id: string;
  type: string;
  degree: number;
  inDegree: number;
  outDegree: number;
  pageRank: number;
  betweennessCentrality: number;
  closenessCentrality: number;
  clusteringCoefficient: number;
  totalVolume: number;
  avgTransactionSize: number;
  transactionCount: number;
}

interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  diameter: number;
  averagePathLength: number;
  clusteringCoefficient: number;
  components: number;
  totalVolume: number;
  topNodesByPageRank: NodeMetrics[];
  topNodesByBetweenness: NodeMetrics[];
  topNodesByVolume: NodeMetrics[];
}

/**
 * Hook for advanced graph analytics
 * Implements PageRank, Centrality, and other graph metrics
 */
export function useGraphAnalytics() {
  const [metrics, setMetrics] = useState<GraphMetrics | null>(null);
  const [nodeMetrics, setNodeMetrics] = useState<Map<string, NodeMetrics>>(new Map());
  const [isCalculating, setIsCalculating] = useState(false);

  /**
   * Calculate PageRank scores for all nodes
   * Uses iterative power method
   */
  const calculatePageRank = useCallback((
    cy: cytoscape.Core,
    dampingFactor: number = 0.85,
    iterations: number = 20
  ): Map<string, number> => {
    const nodes = cy.nodes();
    const nodeCount = nodes.length;
    if (nodeCount === 0) return new Map();

    // Initialize scores
    const scores = new Map<string, number>();
    const newScores = new Map<string, number>();
    nodes.forEach(node => scores.set(node.id(), 1 / nodeCount));

    // Iterative calculation
    for (let i = 0; i < iterations; i++) {
      nodes.forEach(node => {
        const nodeId = node.id();
        let sum = 0;

        // Get incoming edges (nodes pointing to this node)
        const incomingNodes = node.incomers('node');
        incomingNodes.forEach(incomer => {
          const incomerScore = scores.get(incomer.id()) || 0;
          const incomerOutDegree = incomer.outgoers('node').length || 1;
          sum += incomerScore / incomerOutDegree;
        });

        // Apply damping factor
        const newScore = (1 - dampingFactor) / nodeCount + dampingFactor * sum;
        newScores.set(nodeId, newScore);
      });

      // Update scores
      newScores.forEach((score, nodeId) => scores.set(nodeId, score));
    }

    return scores;
  }, []);

  /**
   * Calculate Betweenness Centrality
   * Measures how often a node appears on shortest paths
   */
  const calculateBetweennessCentrality = useCallback((cy: cytoscape.Core): Map<string, number> => {
    const nodes = cy.nodes('[type="account"]');
    const centrality = new Map<string, number>();
    nodes.forEach(n => centrality.set(n.id(), 0));

    // Sample-based approximation for performance
    const sampleSize = Math.min(nodes.length, 50);
    const sampledNodes = nodes.toArray()
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize);

    sampledNodes.forEach(source => {
      // BFS from source
      const distances = new Map<string, number>();
      const paths = new Map<string, string[][]>();
      const queue: string[] = [source.id()];

      distances.set(source.id(), 0);
      paths.set(source.id(), [[source.id()]]);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentDist = distances.get(current)!;
        const currentNode = cy.getElementById(current);

        currentNode.neighborhood('node[type="account"]').forEach(neighbor => {
          const neighborId = neighbor.id();

          if (!distances.has(neighborId)) {
            distances.set(neighborId, currentDist + 1);
            paths.set(neighborId, []);
            queue.push(neighborId);
          }

          if (distances.get(neighborId) === currentDist + 1) {
            const currentPaths = paths.get(current) || [];
            currentPaths.forEach(path => {
              const existingPaths = paths.get(neighborId) || [];
              existingPaths.push([...path, neighborId]);
              paths.set(neighborId, existingPaths);
            });
          }
        });
      }

      // Count node appearances on shortest paths
      paths.forEach((pathList, target) => {
        if (target === source.id()) return;

        pathList.forEach(path => {
          // Skip source and target
          for (let i = 1; i < path.length - 1; i++) {
            const nodeId = path[i];
            centrality.set(nodeId, (centrality.get(nodeId) || 0) + 1 / pathList.length);
          }
        });
      });
    });

    // Normalize
    const maxCentrality = Math.max(...Array.from(centrality.values()), 1);
    centrality.forEach((value, key) => {
      centrality.set(key, value / maxCentrality);
    });

    return centrality;
  }, []);

  /**
   * Calculate Closeness Centrality
   * Measures average distance to all other nodes
   */
  const calculateClosenessCentrality = useCallback((cy: cytoscape.Core): Map<string, number> => {
    const nodes = cy.nodes('[type="account"]');
    const centrality = new Map<string, number>();

    nodes.forEach(source => {
      // BFS to find distances
      const distances = new Map<string, number>();
      const queue: string[] = [source.id()];
      distances.set(source.id(), 0);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentDist = distances.get(current)!;

        cy.getElementById(current).neighborhood('node[type="account"]').forEach(neighbor => {
          if (!distances.has(neighbor.id())) {
            distances.set(neighbor.id(), currentDist + 1);
            queue.push(neighbor.id());
          }
        });
      }

      // Calculate closeness (inverse of avg distance)
      const totalDist = Array.from(distances.values()).reduce((a, b) => a + b, 0);
      const reachable = distances.size - 1;
      const closeness = reachable > 0 ? reachable / totalDist : 0;
      centrality.set(source.id(), closeness);
    });

    return centrality;
  }, []);

  /**
   * Calculate Clustering Coefficient for a node
   */
  const calculateNodeClusteringCoefficient = useCallback((
    cy: cytoscape.Core,
    nodeId: string
  ): number => {
    const node = cy.getElementById(nodeId);
    const neighbors = node.neighborhood('node[type="account"]');
    const k = neighbors.length;

    if (k < 2) return 0;

    // Count edges between neighbors
    let edgesBetweenNeighbors = 0;
    const neighborIds = new Set(neighbors.map(n => n.id()));

    neighbors.forEach(neighbor => {
      neighbor.neighborhood('node[type="account"]').forEach(nn => {
        if (neighborIds.has(nn.id()) && nn.id() !== neighbor.id()) {
          edgesBetweenNeighbors++;
        }
      });
    });

    // Each edge counted twice
    edgesBetweenNeighbors /= 2;

    // Clustering coefficient
    const maxEdges = (k * (k - 1)) / 2;
    return maxEdges > 0 ? edgesBetweenNeighbors / maxEdges : 0;
  }, []);

  /**
   * Calculate all metrics for the graph
   */
  const calculateAllMetrics = useCallback((cy: cytoscape.Core): GraphMetrics => {
    setIsCalculating(true);

    try {
      const nodes = cy.nodes();
      const edges = cy.edges();
      const accountNodes = cy.nodes('[type="account"]');

      // Basic metrics
      const nodeCount = nodes.length;
      const edgeCount = edges.length;
      const maxPossibleEdges = nodeCount * (nodeCount - 1);
      const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
      const averageDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;

      // Calculate centrality metrics
      const pageRankScores = calculatePageRank(cy);
      const betweennessScores = calculateBetweennessCentrality(cy);
      const closenessScores = calculateClosenessCentrality(cy);

      // Calculate node metrics
      const metricsMap = new Map<string, NodeMetrics>();
      let totalClusteringCoeff = 0;
      let totalVolume = 0;

      accountNodes.forEach(node => {
        const nodeId = node.id();

        // Calculate volume
        let nodeVolume = 0;
        let txCount = 0;
        node.connectedEdges().forEach(edge => {
          nodeVolume += edge.data('amount') || 0;
          txCount++;
        });
        totalVolume += nodeVolume;

        const clusteringCoeff = calculateNodeClusteringCoefficient(cy, nodeId);
        totalClusteringCoeff += clusteringCoeff;

        const nodeMetric: NodeMetrics = {
          id: nodeId,
          type: 'account',
          degree: node.degree(),
          inDegree: node.indegree(),
          outDegree: node.outdegree(),
          pageRank: pageRankScores.get(nodeId) || 0,
          betweennessCentrality: betweennessScores.get(nodeId) || 0,
          closenessCentrality: closenessScores.get(nodeId) || 0,
          clusteringCoefficient: clusteringCoeff,
          totalVolume: nodeVolume,
          avgTransactionSize: txCount > 0 ? nodeVolume / txCount : 0,
          transactionCount: txCount
        };

        metricsMap.set(nodeId, nodeMetric);
      });

      setNodeMetrics(metricsMap);

      // Calculate graph-level clustering coefficient
      const graphClusteringCoeff = accountNodes.length > 0
        ? totalClusteringCoeff / accountNodes.length
        : 0;

      // Get top nodes
      const sortedByPageRank = Array.from(metricsMap.values())
        .sort((a, b) => b.pageRank - a.pageRank)
        .slice(0, 10);

      const sortedByBetweenness = Array.from(metricsMap.values())
        .sort((a, b) => b.betweennessCentrality - a.betweennessCentrality)
        .slice(0, 10);

      const sortedByVolume = Array.from(metricsMap.values())
        .sort((a, b) => b.totalVolume - a.totalVolume)
        .slice(0, 10);

      // Count connected components
      const visited = new Set<string>();
      let components = 0;

      nodes.forEach(node => {
        if (!visited.has(node.id())) {
          components++;
          // BFS to mark component
          const queue = [node.id()];
          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            cy.getElementById(current).neighborhood('node').forEach(n => {
              if (!visited.has(n.id())) {
                queue.push(n.id());
              }
            });
          }
        }
      });

      const result: GraphMetrics = {
        nodeCount,
        edgeCount,
        density: Math.round(density * 10000) / 10000,
        averageDegree: Math.round(averageDegree * 100) / 100,
        diameter: 0, // Would need full BFS
        averagePathLength: 0, // Would need full BFS
        clusteringCoefficient: Math.round(graphClusteringCoeff * 1000) / 1000,
        components,
        totalVolume,
        topNodesByPageRank: sortedByPageRank,
        topNodesByBetweenness: sortedByBetweenness,
        topNodesByVolume: sortedByVolume
      };

      setMetrics(result);
      return result;

    } finally {
      setIsCalculating(false);
    }
  }, [calculatePageRank, calculateBetweennessCentrality, calculateClosenessCentrality, calculateNodeClusteringCoefficient]);

  /**
   * Color nodes by metric
   */
  const colorByMetric = useCallback((
    cy: cytoscape.Core,
    metric: 'pageRank' | 'betweennessCentrality' | 'closenessCentrality' | 'totalVolume'
  ) => {
    if (nodeMetrics.size === 0) return;

    // Get min/max for normalization
    let min = Infinity, max = -Infinity;
    nodeMetrics.forEach(m => {
      const value = m[metric];
      min = Math.min(min, value);
      max = Math.max(max, value);
    });

    const range = max - min || 1;

    // Apply colors
    cy.nodes('[type="account"]').forEach(node => {
      const m = nodeMetrics.get(node.id());
      if (m) {
        const normalized = (m[metric] - min) / range;
        // Blue (low) -> Yellow -> Red (high)
        const hue = 240 - (normalized * 240);
        node.style('background-color', `hsl(${hue}, 70%, 50%)`);
      }
    });
  }, [nodeMetrics]);

  /**
   * Size nodes by metric
   */
  const sizeByMetric = useCallback((
    cy: cytoscape.Core,
    metric: 'pageRank' | 'totalVolume' | 'degree',
    minSize: number = 20,
    maxSize: number = 60
  ) => {
    if (nodeMetrics.size === 0) return;

    // Get min/max for normalization
    let min = Infinity, max = -Infinity;
    nodeMetrics.forEach(m => {
      const value = metric === 'degree' ? m.degree : m[metric as keyof NodeMetrics] as number;
      min = Math.min(min, value);
      max = Math.max(max, value);
    });

    const range = max - min || 1;

    // Apply sizes
    cy.nodes('[type="account"]').forEach(node => {
      const m = nodeMetrics.get(node.id());
      if (m) {
        const value = metric === 'degree' ? m.degree : m[metric as keyof NodeMetrics] as number;
        const normalized = (value - min) / range;
        const size = minSize + (normalized * (maxSize - minSize));
        node.style({
          'width': size,
          'height': size
        });
      }
    });
  }, [nodeMetrics]);

  return {
    // State
    metrics,
    nodeMetrics,
    isCalculating,

    // Actions
    calculateAllMetrics,
    calculatePageRank,
    calculateBetweennessCentrality,
    calculateClosenessCentrality,
    calculateNodeClusteringCoefficient,

    // Visualization
    colorByMetric,
    sizeByMetric
  };
}

export default useGraphAnalytics;
