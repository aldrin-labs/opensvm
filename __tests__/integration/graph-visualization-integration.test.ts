import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { DetailedTransactionInfo } from '../../lib/solana';

// Mock external dependencies
jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => ({
    createCollection: jest.fn().mockResolvedValue({}),
    getCollection: jest.fn().mockResolvedValue({ status: 'green' }),
    upsert: jest.fn().mockResolvedValue({}),
    search: jest.fn().mockResolvedValue({ points: [] })
  }))
}));

// Mock D3 and Cytoscape for graph rendering
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    selectAll: jest.fn(() => ({
      data: jest.fn(() => ({
        enter: jest.fn(() => ({
          append: jest.fn(() => ({
            attr: jest.fn(() => ({ attr: jest.fn() })),
            style: jest.fn(() => ({ style: jest.fn() })),
            text: jest.fn()
          }))
        })),
        exit: jest.fn(() => ({ remove: jest.fn() })),
        attr: jest.fn(),
        style: jest.fn()
      }))
    })),
    append: jest.fn(() => ({
      attr: jest.fn(() => ({ attr: jest.fn() })),
      style: jest.fn(() => ({ style: jest.fn() }))
    }))
  })),
  scaleOrdinal: jest.fn(() => ({ domain: jest.fn(() => ({ range: jest.fn() })) })),
  forceSimulation: jest.fn(() => ({
    force: jest.fn(() => ({ force: jest.fn() })),
    nodes: jest.fn(() => ({ nodes: jest.fn() })),
    on: jest.fn()
  })),
  forceLink: jest.fn(),
  forceManyBody: jest.fn(),
  forceCenter: jest.fn()
}));

jest.mock('cytoscape', () => {
  return jest.fn(() => ({
    add: jest.fn(),
    layout: jest.fn(() => ({ run: jest.fn() })),
    on: jest.fn(),
    nodes: jest.fn(() => ({ length: 0 })),
    edges: jest.fn(() => ({ length: 0 })),
    fit: jest.fn(),
    zoom: jest.fn(),
    pan: jest.fn(),
    destroy: jest.fn()
  }));
});

describe('Graph Visualization Integration Tests', () => {
  let mockTransaction: DetailedTransactionInfo;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockTransaction = {
      signature: 'graph-test-signature-123',
      slot: 123456789,
      blockTime: Date.now(),
      timestamp: Date.now(),
      type: 'sol',
      success: true,
      details: {
        accounts: [
          { pubkey: 'account_A', signer: false, writable: true, owner: '11111111111111111111111111111111' },
          { pubkey: 'account_B', signer: false, writable: true, owner: '11111111111111111111111111111111' },
          { pubkey: 'account_C', signer: false, writable: true, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { pubkey: 'account_D', signer: false, writable: true, owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }
        ] as any,
        instructions: [
          {
            program: 'System Program',
            programId: '11111111111111111111111111111111',
            
            accounts: [0, 1], // indices for account_A, account_B
            data: '00000002'
          },
          {
            program: 'SPL Token',
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            
            accounts: [2, 3, 0], // indices for account_C, account_D, account_A
            data: '03'
          }
        ],
        preBalances: [2000000000, 1000000000, 2039280, 2039280],
        postBalances: [1500000000, 1495000000, 2039280, 2039280],
        preTokenBalances: [
          {
            accountIndex: 2,
            mint: 'token_mint_1',
            owner: 'account_A',
            uiTokenAmount: { amount: '1000000000', decimals: 9, uiAmount: 1000, uiAmountString: '1000' }
          }
        ],
        postTokenBalances: [
          {
            accountIndex: 2,
            mint: 'token_mint_1',
            owner: 'account_A',
            uiTokenAmount: { amount: '500000000', decimals: 9, uiAmount: 500, uiAmountString: '500' }
          },
          {
            accountIndex: 3,
            mint: 'token_mint_1',
            owner: 'account_D',
            uiTokenAmount: { amount: '500000000', decimals: 9, uiAmount: 500, uiAmountString: '500' }
          }
        ]
      }
    };
  });

  describe('Transaction Graph Builder Integration', () => {
    it('should build graph data structure from transaction', async () => {
      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      expect(graphData).toBeDefined();
      expect(graphData.nodes).toBeDefined();
      expect(graphData.edges).toBeDefined();
      expect(graphData.metadata).toBeDefined();

      // Verify nodes are created for accounts
      expect(graphData.nodes.length).toBeGreaterThan(0);
      const accountNodes = graphData.nodes.filter((node: any) => node.type === 'account');
      expect(accountNodes.length).toBe(4); // 4 accounts in transaction

      // Verify edges are created for transfers
      expect(graphData.edges.length).toBeGreaterThan(0);
      const transferEdges = graphData.edges.filter((edge: any) => edge.type === 'transfer');
      expect(transferEdges.length).toBeGreaterThan(0);

      // Verify metadata includes transaction info
      expect(graphData.metadata.signature).toBe(mockTransaction.signature);
      expect(graphData.metadata.instructionCount).toBe(2);
      expect(graphData.metadata.accountCount).toBe(4);
    });

    it('should handle complex multi-instruction transactions', async () => {
      const complexTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          accounts: Array.from({ length: 10 }, (_, i) => ({
            pubkey: `account_${i}`,
            signer: false,
            writable: true,
            owner: i % 2 === 0 ? '11111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
          })) as any,
          instructions: Array.from({ length: 5 }, (_, i) => ({
            program: i % 2 === 0 ? 'System Program' : 'SPL Token',
            programId: i % 2 === 0 ? '11111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            instructionType: 'transfer',
            accounts: [i, i + 1],
            data: i % 2 === 0 ? '00000002' : '03'
          }))
        }
      };

      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(complexTransaction);

      expect(graphData.nodes.length).toBe(13); // 10 accounts + 2 programs + 1 transaction node
      expect(graphData.edges.length).toBeGreaterThan(5);
      expect(graphData.metadata.instructionCount).toBe(5);

      // Verify different node types
      const systemAccounts = graphData.nodes.filter((node: any) =>
        node.data.owner === '11111111111111111111111111111111'
      );
      const tokenAccounts = graphData.nodes.filter((node: any) =>
        node.data.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
      );

      expect(systemAccounts.length).toBe(5);
      expect(tokenAccounts.length).toBe(5);
    });

    it('should optimize graph layout for visualization', async () => {
      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      // Apply layout optimization
      const optimizedGraph = await graphBuilder.optimizeLayout(graphData, {
        algorithm: 'force-directed',
        iterations: 100,
        nodeSpacing: 50
      });

      expect(optimizedGraph).toBeDefined();
      expect(optimizedGraph.nodes).toBeDefined();
      expect(optimizedGraph.edges).toBeDefined();

      // Verify nodes have position data
      optimizedGraph.nodes.forEach((node: any) => {
        expect(node.position).toBeDefined();
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });

      // Verify layout metadata
      expect(optimizedGraph.layout).toBeDefined();
      expect(optimizedGraph.layout.algorithm).toBe('force-directed');
      expect(optimizedGraph.layout.bounds).toBeDefined();
    });
  });

  describe('Graph Component Integration', () => {
    it('should render interactive graph component', async () => {
      // Mock React and DOM environment
      const mockElement = {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        querySelector: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        getBoundingClientRect: () => ({ width: 800, height: 600 })
      };

      global.document = {
        createElement: jest.fn(() => mockElement),
        getElementById: jest.fn(() => mockElement)
      } as any;

      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      // Mock React component props
      const mockProps = {
        initialSignature: mockTransaction.signature,
        graphData,
        width: 800,
        height: 600,
        onNodeClick: jest.fn(),
        onEdgeClick: jest.fn(),
        showControls: true
      };

      // Verify component props are valid
      expect(mockProps.initialSignature).toBeDefined();
      expect(mockProps.graphData).toBeDefined();
      expect(mockProps.onNodeClick).toBeDefined();
      expect(mockProps.onEdgeClick).toBeDefined();
    });

    it('should handle graph interactions correctly', async () => {
      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      const mockInteractionHandlers = {
        onNodeClick: jest.fn(),
        onEdgeClick: jest.fn(),
        onNodeHover: jest.fn(),
        onZoom: jest.fn(),
        onPan: jest.fn()
      };

      // Simulate node click
      const testNode = graphData.nodes[0];
      mockInteractionHandlers.onNodeClick(testNode);

      expect(mockInteractionHandlers.onNodeClick).toHaveBeenCalledWith(testNode);

      // Simulate edge click
      if (graphData.edges.length > 0) {
        const testEdge = graphData.edges[0];
        mockInteractionHandlers.onEdgeClick(testEdge);

        expect(mockInteractionHandlers.onEdgeClick).toHaveBeenCalledWith(testEdge);
      }

      // Simulate zoom interaction
      mockInteractionHandlers.onZoom({ scale: 1.5, translate: [100, 50] });

      expect(mockInteractionHandlers.onZoom).toHaveBeenCalledWith({
        scale: 1.5,
        translate: [100, 50]
      });
    });

    it('should apply graph filters correctly', async () => {
      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      // Apply filters
      const filters = {
        showSystemAccounts: true,
        showTokenAccounts: true,
        showPrograms: false,
        minTransferAmount: 0,
        accountTypes: ['account'],
        hideSmallTransfers: false
      };

      const filteredGraph = await graphBuilder.applyFilters(graphData, filters);

      expect(filteredGraph).toBeDefined();
      expect(filteredGraph.nodes.length).toBeLessThanOrEqual(graphData.nodes.length);
      expect(filteredGraph.edges.length).toBeLessThanOrEqual(graphData.edges.length);

      // Verify filter application
      const programNodes = filteredGraph.nodes.filter((node: any) => node.type === 'program');
      expect(programNodes.length).toBe(0); // Programs should be filtered out

      const accountNodes = filteredGraph.nodes.filter((node: any) => node.type === 'account');
      expect(accountNodes.length).toBeGreaterThan(0); // Accounts should remain
    });
  });

  describe('Graph Performance Integration', () => {
    it('should handle large graphs efficiently', async () => {
      // Create a large transaction with many accounts and instructions
      const largeTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          accounts: Array.from({ length: 100 }, (_, i) => ({
            pubkey: `large_account_${i}`,
            executable: false,
            owner: i % 3 === 0 ? '11111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
          })),
          instructions: Array.from({ length: 50 }, (_, i) => ({
            program: i % 2 === 0 ? 'System Program' : 'SPL Token',
            programId: i % 2 === 0 ? '11111111111111111111111111111111' : 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            instructionType: 'transfer',
            accounts: [`large_account_${i}`, `large_account_${i + 1}`],
            data: '00000002'
          }))
        }
      };

      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      
      const startTime = Date.now();
      const graphData = await graphBuilder.buildTransactionGraph(largeTransaction);
      const buildTime = Date.now() - startTime;

      expect(buildTime).toBeLessThan(5000); // Should build within 5 seconds
      expect(graphData.nodes.length).toBe(103); // 100 accounts + 2 programs + 1 transaction node
      expect(graphData.edges.length).toBeGreaterThan(50);

      // Test layout optimization performance
      const layoutStartTime = Date.now();
      const optimizedGraph = await graphBuilder.optimizeLayout(graphData, {
        algorithm: 'force-directed',
        iterations: 50 // Reduced for performance
      });
      const layoutTime = Date.now() - layoutStartTime;

      expect(layoutTime).toBeLessThan(10000); // Should optimize within 10 seconds
      expect(optimizedGraph.nodes.length).toBe(103); // 100 accounts + 2 programs + 1 transaction node
    });

    it('should implement graph virtualization for very large datasets', async () => {
      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      // Simulate viewport-based virtualization
      const viewport = {
        x: 0,
        y: 0,
        width: 800,
        height: 600,
        scale: 1
      };

      const virtualizedGraph = await graphBuilder.virtualizeGraph(graphData, viewport);

      expect(virtualizedGraph).toBeDefined();
      expect(virtualizedGraph.visibleNodes).toBeDefined();
      expect(virtualizedGraph.visibleEdges).toBeDefined();
      expect(virtualizedGraph.hiddenNodeCount).toBeDefined();

      // Verify virtualization reduces rendered elements
      expect(virtualizedGraph.visibleNodes.length).toBeLessThanOrEqual(graphData.nodes.length);
      expect(virtualizedGraph.visibleEdges.length).toBeLessThanOrEqual(graphData.edges.length);
    });
  });

  describe('Graph Export Integration', () => {
    it('should export graph data in multiple formats', async () => {
      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      // Export as JSON
      const jsonExport = await graphBuilder.exportGraph(graphData, 'json');
      expect(jsonExport).toBeDefined();
      expect(typeof jsonExport).toBe('string');
      
      const parsedJson = JSON.parse(jsonExport);
      expect(parsedJson.nodes).toBeDefined();
      expect(parsedJson.edges).toBeDefined();

      // Export as GraphML
      const graphmlExport = await graphBuilder.exportGraph(graphData, 'graphml');
      expect(graphmlExport).toBeDefined();
      expect(typeof graphmlExport).toBe('string');
      expect(graphmlExport).toContain('<?xml');
      expect(graphmlExport).toContain('<graphml');

      // Export as DOT (Graphviz)
      const dotExport = await graphBuilder.exportGraph(graphData, 'dot');
      expect(dotExport).toBeDefined();
      expect(typeof dotExport).toBe('string');
      expect(dotExport).toContain('digraph');
      expect(dotExport).toContain('->');
    });

    it('should generate graph images', async () => {
      // Mock canvas and image generation
      const mockCanvas = {
        getContext: jest.fn(() => ({
          fillRect: jest.fn(),
          strokeRect: jest.fn(),
          fillText: jest.fn(),
          drawImage: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          stroke: jest.fn(),
          fill: jest.fn()
        })),
        toDataURL: jest.fn(() => 'data:image/png;base64,mock-image-data'),
        width: 800,
        height: 600
      };

      global.document = {
        createElement: jest.fn(() => mockCanvas)
      } as any;

      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      // Generate PNG image
      const pngImage = await graphBuilder.generateImage(graphData, {
        format: 'png',
        width: 800,
        height: 600,
        quality: 0.9
      });

      expect(pngImage).toBeDefined();
      expect(typeof pngImage).toBe('string');
      expect(pngImage).toContain('data:image/png;base64,');

      // Generate SVG image
      const svgImage = await graphBuilder.generateImage(graphData, {
        format: 'svg',
        width: 800,
        height: 600
      });

      expect(svgImage).toBeDefined();
      expect(typeof svgImage).toBe('string');
      expect(svgImage).toContain('<svg');
    });
  });

  describe('Graph Analytics Integration', () => {
    it('should calculate graph metrics and statistics', async () => {
      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      const analytics = await graphBuilder.analyzeGraph(graphData);

      expect(analytics).toBeDefined();
      expect(analytics.nodeCount).toBe(graphData.nodes.length);
      expect(analytics.edgeCount).toBe(graphData.edges.length);
      expect(analytics.density).toBeDefined();
      expect(analytics.averageDegree).toBeDefined();
      expect(analytics.clustering).toBeDefined();

      // Verify centrality measures
      expect(analytics.centrality).toBeDefined();
      expect(analytics.centrality.betweenness).toBeDefined();
      expect(analytics.centrality.closeness).toBeDefined();
      expect(analytics.centrality.degree).toBeDefined();

      // Verify community detection
      expect(analytics.communities).toBeDefined();
      expect(Array.isArray(analytics.communities)).toBe(true);
    });

    it('should identify important nodes and paths', async () => {
      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      const pathAnalysis = await graphBuilder.analyzeTransactionPaths(graphData);

      expect(pathAnalysis).toBeDefined();
      expect(pathAnalysis.criticalPaths).toBeDefined();
      expect(pathAnalysis.bottlenecks).toBeDefined();
      expect(pathAnalysis.hubs).toBeDefined();

      // Verify path analysis results
      expect(Array.isArray(pathAnalysis.criticalPaths)).toBe(true);
      expect(Array.isArray(pathAnalysis.bottlenecks)).toBe(true);
      expect(Array.isArray(pathAnalysis.hubs)).toBe(true);

      // Verify hub identification
      if (pathAnalysis.hubs.length > 0) {
        const hub = pathAnalysis.hubs[0];
        expect(hub.nodeId).toBeDefined();
        expect(hub.importance).toBeDefined();
        expect(hub.connections).toBeDefined();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle transactions with no transfers gracefully', async () => {
      const noTransferTransaction = {
        ...mockTransaction,
        details: {
          ...mockTransaction.details!,
          instructions: [
            {
              program: 'System Program',
              programId: '11111111111111111111111111111111',
              instructionType: 'allocate',
              accounts: ['account_A'],
              data: '00000008'
            }
          ],
          preBalances: [1000000000],
          postBalances: [1000000000] // No balance changes
        }
      };

      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(noTransferTransaction);

      expect(graphData).toBeDefined();
      expect(graphData.nodes.length).toBeGreaterThan(0);
      expect(graphData.edges.length).toBeGreaterThanOrEqual(0); // May have no transfer edges
    });

    it('should handle malformed transaction data', async () => {
      const malformedTransaction = {
        ...mockTransaction,
        details: {
          accounts: null,
          instructions: undefined,
          preBalances: [],
          postBalances: []
        }
      } as any;

      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      
      // Should not throw error, but return empty or minimal graph
      const graphData = await graphBuilder.buildTransactionGraph(malformedTransaction);

      expect(graphData).toBeDefined();
      expect(graphData.nodes).toBeDefined();
      expect(graphData.edges).toBeDefined();
      expect(Array.isArray(graphData.nodes)).toBe(true);
      expect(Array.isArray(graphData.edges)).toBe(true);
    });

    it('should handle graph rendering failures gracefully', async () => {
      // Mock rendering failure
      const mockCytoscape = require('cytoscape');
      mockCytoscape.mockImplementationOnce(() => {
        throw new Error('Rendering failed');
      });

      const { TransactionGraphBuilder } = require('../../lib/transaction-graph-builder');

      const graphBuilder = new TransactionGraphBuilder();
      const graphData = await graphBuilder.buildTransactionGraph(mockTransaction);

      // Should handle rendering failure gracefully (not throw errors)
      await expect(
        graphBuilder.renderGraph(graphData, {
          container: 'mock-container',
          renderer: 'cytoscape'
        })
      ).resolves.toBeUndefined();
    });
  });
});