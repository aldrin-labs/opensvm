/**
 * Transaction Graph Builder
 * 
 * Builds graph data structures from Solana transaction data for visualization
 */

import type { DetailedTransactionInfo } from './solana';

export interface GraphNode {
  id: string;
  type: 'account' | 'program' | 'instruction' | 'transaction';
  data: {
    pubkey?: string;
    owner?: string;
    balance?: number;
    executable?: boolean;
    [key: string]: any;
  };
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'transfer' | 'invoke' | 'dependency';
  data: {
    amount?: number;
    instructionIndex?: number;
    [key: string]: any;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    signature: string;
    instructionCount: number;
    accountCount: number;
    [key: string]: any;
  };
  layout?: {
    algorithm: string;
    bounds: { width: number; height: number };
  };
}

export interface GraphFilter {
  showSystemAccounts: boolean;
  showTokenAccounts: boolean;
  showPrograms: boolean;
  minTransferAmount: number;
  accountTypes: string[];
  hideSmallTransfers: boolean;
}

export interface VirtualizedGraph {
  visibleNodes: GraphNode[];
  visibleEdges: GraphEdge[];
  hiddenNodeCount: number;
}

export interface GraphAnalytics {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  clustering: number;
  centrality: {
    betweenness: Record<string, number>;
    closeness: Record<string, number>;
    degree: Record<string, number>;
  };
  communities: string[][];
}

export interface PathAnalysis {
  criticalPaths: string[][];
  bottlenecks: { nodeId: string; importance: number }[];
  hubs: { nodeId: string; importance: number; connections: number }[];
}

export class TransactionGraphBuilder {
  constructor() {}

  /**
   * Build graph data structure from transaction
   */
  async buildTransactionGraph(transaction: DetailedTransactionInfo): Promise<GraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Add transaction node
    nodes.push({
      id: `tx_${transaction.signature}`,
      type: 'transaction',
      data: {
        signature: transaction.signature,
        success: transaction.success,
        blockTime: transaction.blockTime
      }
    });

    // Process accounts
    const accounts = transaction.details?.accounts || [];
    accounts.forEach((account, index) => {
      nodes.push({
        id: account.pubkey,
        type: 'account',
        data: {
          pubkey: account.pubkey,
          owner: account.owner,
          executable: account.executable,
          balance: transaction.details?.preBalances?.[index] || 0
        }
      });
    });

    // Process instructions and create edges
    const instructions = transaction.details?.instructions || [];
    instructions.forEach((instruction, instructionIndex) => {
      // Add program node if not already added
      const programNodeId = instruction.programId;
      if (!nodes.find(n => n.id === programNodeId)) {
        nodes.push({
          id: programNodeId,
          type: 'program',
          data: {
            pubkey: programNodeId,
            name: instruction.program
          }
        });
      }

      // Create edges for instruction relationships
      instruction.accounts?.forEach((accountKey, accountIndex) => {
        // Edge from transaction to program
        const txToProgramEdgeId = `${transaction.signature}_to_${programNodeId}_${instructionIndex}`;
        if (!edges.find(e => e.id === txToProgramEdgeId)) {
          edges.push({
            id: txToProgramEdgeId,
            source: `tx_${transaction.signature}`,
            target: programNodeId,
            type: 'invoke',
            data: { instructionIndex }
          });
        }

        // Edge from program to account
        edges.push({
          id: `${programNodeId}_to_${accountKey}_${instructionIndex}_${accountIndex}`,
          source: programNodeId,
          target: accountKey,
          type: 'dependency',
          data: { instructionIndex, accountIndex }
        });
      });
    });

    // Add transfer edges based on balance changes
    const preBalances = transaction.details?.preBalances || [];
    const postBalances = transaction.details?.postBalances || [];

    for (let i = 0; i < Math.min(preBalances.length, postBalances.length); i++) {
      const preBalance = preBalances[i];
      const postBalance = postBalances[i];
      const balanceChange = postBalance - preBalance;

      if (balanceChange !== 0 && accounts[i]) {
        // Find the counterparty (simplified logic)
        for (let j = 0; j < Math.min(preBalances.length, postBalances.length); j++) {
          if (i !== j && accounts[j]) {
            const otherBalanceChange = postBalances[j] - preBalances[j];
            // If balances are roughly opposite, it's likely a transfer
            if (Math.abs(balanceChange + otherBalanceChange) < Math.abs(balanceChange) * 0.1) {
              edges.push({
                id: `transfer_${accounts[i].pubkey}_to_${accounts[j].pubkey}`,
                source: accounts[i].pubkey,
                target: accounts[j].pubkey,
                type: 'transfer',
                data: { amount: Math.abs(balanceChange) }
              });
              break;
            }
          }
        }
      }
    }

    return {
      nodes,
      edges,
      metadata: {
        signature: transaction.signature,
        instructionCount: instructions.length,
        accountCount: accounts.length
      }
    };
  }

  /**
   * Optimize graph layout for visualization
   */
  async optimizeLayout(graphData: GraphData, options: {
    algorithm: string;
    iterations?: number;
    nodeSpacing?: number;
  }): Promise<GraphData> {
    const optimizedData = { ...graphData };
    
    // Simple force-directed layout simulation
    const { nodes } = optimizedData;
    const nodeSpacing = options.nodeSpacing || 50;
    const iterations = options.iterations || 100;

    // Initialize positions randomly
    nodes.forEach((node, index) => {
      node.position = {
        x: Math.random() * 800,
        y: Math.random() * 600
      };
    });

    // Simple layout algorithm (force-directed simulation)
    for (let iter = 0; iter < iterations; iter++) {
      // Apply repulsive forces between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].position!.x - nodes[j].position!.x;
          const dy = nodes[i].position!.y - nodes[j].position!.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (distance < nodeSpacing * 2) {
            const force = nodeSpacing / distance;
            nodes[i].position!.x += dx * force * 0.01;
            nodes[i].position!.y += dy * force * 0.01;
            nodes[j].position!.x -= dx * force * 0.01;
            nodes[j].position!.y -= dy * force * 0.01;
          }
        }
      }
    }

    optimizedData.layout = {
      algorithm: options.algorithm,
      bounds: { width: 800, height: 600 }
    };

    return optimizedData;
  }

  /**
   * Apply filters to graph data
   */
  async applyFilters(graphData: GraphData, filters: GraphFilter): Promise<GraphData> {
    let filteredNodes = [...graphData.nodes];
    let filteredEdges = [...graphData.edges];

    // Filter by account types
    if (!filters.showSystemAccounts) {
      filteredNodes = filteredNodes.filter(node => 
        node.type !== 'account' || node.data.owner !== '11111111111111111111111111111111'
      );
    }

    if (!filters.showTokenAccounts) {
      filteredNodes = filteredNodes.filter(node => 
        node.type !== 'account' || node.data.owner !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
      );
    }

    if (!filters.showPrograms) {
      filteredNodes = filteredNodes.filter(node => node.type !== 'program');
    }

    // Filter by account types array
    if (filters.accountTypes.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        filters.accountTypes.includes(node.type)
      );
    }

    // Filter edges based on remaining nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    // Filter small transfers
    if (filters.hideSmallTransfers) {
      filteredEdges = filteredEdges.filter(edge => 
        edge.type !== 'transfer' || (edge.data.amount || 0) >= filters.minTransferAmount
      );
    }

    return {
      ...graphData,
      nodes: filteredNodes,
      edges: filteredEdges
    };
  }

  /**
   * Virtualize graph for large datasets
   */
  async virtualizeGraph(graphData: GraphData, viewport: {
    x: number; y: number; width: number; height: number; scale: number;
  }): Promise<VirtualizedGraph> {
    // Simple viewport-based virtualization
    const visibleNodes = graphData.nodes.filter(node => {
      if (!node.position) return true; // Always show nodes without position
      
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      
      return nodeX >= viewport.x - 100 && 
             nodeX <= viewport.x + viewport.width + 100 &&
             nodeY >= viewport.y - 100 && 
             nodeY <= viewport.y + viewport.height + 100;
    });

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    const visibleEdges = graphData.edges.filter(edge => 
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    return {
      visibleNodes,
      visibleEdges,
      hiddenNodeCount: graphData.nodes.length - visibleNodes.length
    };
  }

  /**
   * Export graph in various formats
   */
  async exportGraph(graphData: GraphData, format: 'json' | 'graphml' | 'dot'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(graphData, null, 2);
      
      case 'graphml':
        let graphml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns
         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <graph id="TransactionGraph" edgedefault="directed">
`;
        
        graphData.nodes.forEach(node => {
          graphml += `    <node id="${node.id}"/>\n`;
        });
        
        graphData.edges.forEach(edge => {
          graphml += `    <edge source="${edge.source}" target="${edge.target}"/>\n`;
        });
        
        graphml += `  </graph>
</graphml>`;
        return graphml;
      
      case 'dot':
        let dot = `digraph TransactionGraph {\n`;
        
        graphData.nodes.forEach(node => {
          const label = node.id.length > 10 ? node.id.substring(0, 10) + '...' : node.id;
          dot += `  "${node.id}" [label="${label}"];\n`;
        });
        
        graphData.edges.forEach(edge => {
          dot += `  "${edge.source}" -> "${edge.target}";\n`;
        });
        
        dot += `}`;
        return dot;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate graph images
   */
  async generateImage(graphData: GraphData, options: {
    format: 'png' | 'svg';
    width: number;
    height: number;
    quality?: number;
  }): Promise<string> {
    if (options.format === 'svg') {
      // Generate SVG
      let svg = `<svg width="${options.width}" height="${options.height}" xmlns="http://www.w3.org/2000/svg">`;
      
      // Draw edges first
      graphData.edges.forEach(edge => {
        const sourceNode = graphData.nodes.find(n => n.id === edge.source);
        const targetNode = graphData.nodes.find(n => n.id === edge.target);
        
        if (sourceNode?.position && targetNode?.position) {
          svg += `<line x1="${sourceNode.position.x}" y1="${sourceNode.position.y}" 
                       x2="${targetNode.position.x}" y2="${targetNode.position.y}" 
                       stroke="gray" stroke-width="1"/>`;
        }
      });
      
      // Draw nodes
      graphData.nodes.forEach(node => {
        if (node.position) {
          const color = node.type === 'account' ? 'blue' : 
                       node.type === 'program' ? 'red' : 'green';
          svg += `<circle cx="${node.position.x}" cy="${node.position.y}" r="5" fill="${color}"/>`;
        }
      });
      
      svg += `</svg>`;
      return svg;
    } else {
      // Return mock PNG data URL
      return 'data:image/png;base64,mock-image-data';
    }
  }

  /**
   * Analyze graph metrics
   */
  async analyzeGraph(graphData: GraphData): Promise<GraphAnalytics> {
    const nodeCount = graphData.nodes.length;
    const edgeCount = graphData.edges.length;
    const maxPossibleEdges = nodeCount * (nodeCount - 1);
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
    
    // Calculate degree centrality
    const degreeCentrality: Record<string, number> = {};
    graphData.nodes.forEach(node => {
      const degree = graphData.edges.filter(edge => 
        edge.source === node.id || edge.target === node.id
      ).length;
      degreeCentrality[node.id] = degree;
    });

    const totalDegree = Object.values(degreeCentrality).reduce((sum, degree) => sum + degree, 0);
    const averageDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;

    // Simple community detection (connected components)
    const communities: string[][] = [];
    const visited = new Set<string>();
    
    graphData.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const community = this.findConnectedComponent(node.id, graphData, visited);
        if (community.length > 0) {
          communities.push(community);
        }
      }
    });

    return {
      nodeCount,
      edgeCount,
      density,
      averageDegree,
      clustering: 0.1, // Simplified clustering coefficient
      centrality: {
        betweenness: {}, // Simplified - would need complex calculation
        closeness: {}, // Simplified - would need complex calculation
        degree: degreeCentrality
      },
      communities
    };
  }

  /**
   * Analyze transaction paths
   */
  async analyzeTransactionPaths(graphData: GraphData): Promise<PathAnalysis> {
    const degreeCentrality: Record<string, number> = {};
    
    // Calculate node degrees for hub identification
    graphData.nodes.forEach(node => {
      const degree = graphData.edges.filter(edge => 
        edge.source === node.id || edge.target === node.id
      ).length;
      degreeCentrality[node.id] = degree;
    });

    // Identify hubs (nodes with high degree)
    const hubs = Object.entries(degreeCentrality)
      .filter(([_, degree]) => degree > 2)
      .map(([nodeId, degree]) => ({
        nodeId,
        importance: degree / graphData.edges.length,
        connections: degree
      }))
      .sort((a, b) => b.importance - a.importance);

    // Identify bottlenecks (similar to hubs for simplification)
    const bottlenecks = hubs.map(hub => ({
      nodeId: hub.nodeId,
      importance: hub.importance
    }));

    // Find critical paths (paths through high-degree nodes)
    const criticalPaths: string[][] = [];
    if (hubs.length > 1) {
      criticalPaths.push([hubs[0].nodeId, hubs[1].nodeId]);
    }

    return {
      criticalPaths,
      bottlenecks: bottlenecks.slice(0, 5), // Top 5 bottlenecks
      hubs: hubs.slice(0, 5) // Top 5 hubs
    };
  }

  /**
   * Render graph with specific renderer
   */
  async renderGraph(graphData: GraphData, options: {
    container: string;
    renderer: string;
  }): Promise<void> {
    // Mock rendering - in real implementation would integrate with actual renderers
    console.log(`Rendering graph with ${options.renderer} in container ${options.container}`);
    // This would typically integrate with D3, Cytoscape, or other graph libraries
  }

  /**
   * Helper method to find connected components
   */
  private findConnectedComponent(startNodeId: string, graphData: GraphData, visited: Set<string>): string[] {
    const component: string[] = [];
    const queue: string[] = [startNodeId];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      
      visited.add(nodeId);
      component.push(nodeId);
      
      // Find all connected nodes
      graphData.edges.forEach(edge => {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          queue.push(edge.target);
        }
        if (edge.target === nodeId && !visited.has(edge.source)) {
          queue.push(edge.source);
        }
      });
    }
    
    return component;
  }
}

// Export default instance
export const transactionGraphBuilder = new TransactionGraphBuilder();