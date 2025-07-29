/**
 * Transaction Graph Builder
 * 
 * Builds graph data structures from transaction data for visualization.
 * Creates nodes for accounts, programs, and tokens, with edges representing
 * relationships, transfers, and interactions.
 */

import type { DetailedTransactionInfo } from './solana';
import type { RelatedTransaction } from './related-transaction-finder';

// Graph node types
export type NodeType = 
  | 'account' 
  | 'program' 
  | 'token' 
  | 'transaction'
  | 'system_account'
  | 'token_account'
  | 'program_account';

// Graph edge types
export type EdgeType = 
  | 'transfer'
  | 'instruction'
  | 'account_access'
  | 'program_invocation'
  | 'token_transfer'
  | 'account_creation'
  | 'account_closure'
  | 'delegation'
  | 'approval';

// Graph node interface
export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  data: {
    address?: string;
    balance?: number;
    tokenBalance?: number;
    symbol?: string;
    decimals?: number;
    programId?: string;
    owner?: string;
    executable?: boolean;
    lamports?: number;
    metadata?: Record<string, any>;
  };
  style: {
    size: number;
    color: string;
    borderColor?: string;
    borderWidth?: number;
    shape: 'circle' | 'square' | 'diamond' | 'triangle' | 'hexagon';
    opacity?: number;
  };
  position?: {
    x: number;
    y: number;
  };
  group?: string;
  importance: number; // 0-1 scale for layout prioritization
}

// Graph edge interface
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  data: {
    amount?: number;
    symbol?: string;
    usdValue?: number;
    instructionIndex?: number;
    programId?: string;
    direction: 'in' | 'out' | 'bidirectional';
    metadata?: Record<string, any>;
  };
  style: {
    width: number;
    color: string;
    opacity?: number;
    dashed?: boolean;
    animated?: boolean;
    curvature?: number;
  };
  weight: number; // For layout algorithms
}

// Complete graph structure
export interface TransactionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    transactionSignature: string;
    centerNode: string;
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    layout: 'force' | 'hierarchical' | 'circular' | 'grid';
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    };
  };
  groups: {
    [groupId: string]: {
      name: string;
      color: string;
      nodes: string[];
    };
  };
  statistics: {
    nodeTypeDistribution: Record<NodeType, number>;
    edgeTypeDistribution: Record<EdgeType, number>;
    totalValue: number;
    largestTransfer: number;
    programsInvolved: number;
    accountsAffected: number;
  };
}

// Graph building options
export interface GraphBuilderOptions {
  includeSystemAccounts: boolean;
  includeTokenAccounts: boolean;
  includePrograms: boolean;
  maxDepth: number;
  minTransferAmount: number;
  layout: 'force' | 'hierarchical' | 'circular' | 'grid';
  groupByProgram: boolean;
  groupByTokenType: boolean;
  showInstructionFlow: boolean;
  includeRelatedTransactions: boolean;
  nodeSize: 'uniform' | 'by_balance' | 'by_activity';
  edgeWidth: 'uniform' | 'by_amount' | 'by_frequency';
}

// Default options
const DEFAULT_OPTIONS: GraphBuilderOptions = {
  includeSystemAccounts: true,
  includeTokenAccounts: true,
  includePrograms: true,
  maxDepth: 3,
  minTransferAmount: 0,
  layout: 'force',
  groupByProgram: false,
  groupByTokenType: false,
  showInstructionFlow: true,
  includeRelatedTransactions: false,
  nodeSize: 'by_balance',
  edgeWidth: 'by_amount'
};

// Color schemes for different node types
const NODE_COLORS = {
  account: '#3B82F6', // Blue
  program: '#8B5CF6', // Purple
  token: '#10B981', // Green
  transaction: '#F59E0B', // Amber
  system_account: '#6B7280', // Gray
  token_account: '#06B6D4', // Cyan
  program_account: '#EC4899' // Pink
};

// Color schemes for different edge types
const EDGE_COLORS = {
  transfer: '#10B981', // Green
  instruction: '#3B82F6', // Blue
  account_access: '#6B7280', // Gray
  program_invocation: '#8B5CF6', // Purple
  token_transfer: '#06B6D4', // Cyan
  account_creation: '#F59E0B', // Amber
  account_closure: '#EF4444', // Red
  delegation: '#EC4899', // Pink
  approval: '#84CC16' // Lime
};

export class TransactionGraphBuilder {
  private options: GraphBuilderOptions;
  private nodeMap: Map<string, GraphNode> = new Map();
  private edgeMap: Map<string, GraphEdge> = new Map();
  private nodeImportanceCache: Map<string, number> = new Map();

  constructor(options: Partial<GraphBuilderOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Build a complete transaction graph from transaction data
   */
  async buildTransactionGraph(
    transaction: DetailedTransactionInfo,
    relatedTransactions: RelatedTransaction[] = []
  ): Promise<TransactionGraph> {
    this.reset();

    // Build main transaction graph
    await this.processTransaction(transaction, 0);

    // Add related transactions if enabled
    if (this.options.includeRelatedTransactions && relatedTransactions.length > 0) {
      for (const relatedTx of relatedTransactions.slice(0, 10)) { // Limit to prevent overcrowding
        await this.processRelatedTransaction(relatedTx, 1);
      }
    }

    // Calculate node positions based on layout
    await this.calculateLayout();

    // Build final graph structure
    return this.buildFinalGraph(transaction.signature);
  }

  /**
   * Process a single transaction and add its nodes/edges to the graph
   */
  private async processTransaction(transaction: DetailedTransactionInfo, depth: number): Promise<void> {
    if (depth > this.options.maxDepth) return;

    // Create transaction node
    const txNode = this.createTransactionNode(transaction);
    this.addNode(txNode);

    // Process accounts involved in the transaction
    const accountKeys = transaction.transaction.message.accountKeys || [];
    for (let i = 0; i < accountKeys.length; i++) {
      const account = accountKeys[i];
      const accountNode = await this.createAccountNode(account, transaction, i);
      this.addNode(accountNode);

      // Create edge from transaction to account
      const edge = this.createTransactionAccountEdge(txNode.id, accountNode.id, i);
      this.addEdge(edge);
    }

    // Process instructions
    if (transaction.transaction.message.instructions) {
      for (let i = 0; i < transaction.transaction.message.instructions.length; i++) {
        const instruction = transaction.transaction.message.instructions[i];
        await this.processInstruction(instruction, transaction, i, depth);
      }
    }

    // Process token transfers
    if (transaction.meta?.preTokenBalances && transaction.meta?.postTokenBalances) {
      await this.processTokenTransfers(transaction);
    }

    // Process account changes
    if (transaction.meta?.preBalances && transaction.meta?.postBalances) {
      await this.processAccountChanges(transaction);
    }
  }

  /**
   * Process a related transaction with reduced detail
   */
  private async processRelatedTransaction(relatedTx: RelatedTransaction, depth: number): Promise<void> {
    // Create a simplified node for the related transaction
    const relatedNode: GraphNode = {
      id: `tx_${relatedTx.signature}`,
      type: 'transaction',
      label: `Related: ${relatedTx.signature.substring(0, 8)}...`,
      data: {
        metadata: {
          signature: relatedTx.signature,
          relationship: relatedTx.relationship,
          relevanceScore: relatedTx.relevanceScore,
          summary: relatedTx.summary
        }
      },
      style: {
        size: this.calculateNodeSize('transaction', { relevanceScore: relatedTx.relevanceScore }),
        color: this.getNodeColor('transaction'),
        shape: 'diamond',
        opacity: 0.7
      },
      importance: relatedTx.relevanceScore,
      group: 'related_transactions'
    };

    this.addNode(relatedNode);

    // Create connections to shared accounts
    if (relatedTx.relationship.sharedElements.accounts) {
      for (const accountAddress of relatedTx.relationship.sharedElements.accounts) {
        const existingAccountNode = this.nodeMap.get(`account_${accountAddress}`);
        if (existingAccountNode) {
          const relationshipEdge: GraphEdge = {
            id: `rel_${relatedNode.id}_${existingAccountNode.id}`,
            source: relatedNode.id,
            target: existingAccountNode.id,
            type: 'account_access',
            label: relatedTx.relationship.type.replace(/_/g, ' '),
            data: {
              direction: 'bidirectional',
              metadata: {
                relationshipType: relatedTx.relationship.type,
                strength: relatedTx.relationship.strength,
                confidence: relatedTx.relationship.confidence
              }
            },
            style: {
              width: this.calculateEdgeWidth('account_access', { strength: relatedTx.relationship.strength }),
              color: EDGE_COLORS.account_access,
              opacity: 0.6,
              dashed: true
            },
            weight: relatedTx.relevanceScore
          };

          this.addEdge(relationshipEdge);
        }
      }
    }
  }

  /**
   * Process a single instruction and create relevant nodes/edges
   */
  private async processInstruction(
    instruction: any,
    transaction: DetailedTransactionInfo,
    instructionIndex: number,
    depth: number
  ): Promise<void> {
    const programId = transaction.transaction.message.accountKeys?.[instruction.programIdIndex];
    if (!programId || !this.options.includePrograms) return;

    // Create program node
    const programNode = await this.createProgramNode(programId, transaction);
    this.addNode(programNode);

    // Create instruction edges to involved accounts
    if (instruction.accounts) {
      for (const accountIndex of instruction.accounts) {
        const accountAddress = transaction.transaction.message.accountKeys?.[accountIndex];
        if (accountAddress) {
          const accountNodeId = `account_${accountAddress}`;
          const instructionEdge = this.createInstructionEdge(
            programNode.id,
            accountNodeId,
            instructionIndex,
            instruction
          );
          this.addEdge(instructionEdge);
        }
      }
    }
  }

  /**
   * Process token transfers and create token-specific nodes/edges
   */
  private async processTokenTransfers(transaction: DetailedTransactionInfo): Promise<void> {
    const preBalances = transaction.meta?.preTokenBalances || [];
    const postBalances = transaction.meta?.postTokenBalances || [];

    // Create a map of account changes
    const balanceChanges = new Map<string, {
      mint: string;
      owner: string;
      preAmount: number;
      postAmount: number;
      change: number;
    }>();

    // Process pre-balances
    for (const preBalance of preBalances) {
      const key = `${preBalance.accountIndex}_${preBalance.mint}`;
      balanceChanges.set(key, {
        mint: preBalance.mint,
        owner: preBalance.owner,
        preAmount: parseFloat(preBalance.uiTokenAmount.amount),
        postAmount: 0,
        change: 0
      });
    }

    // Process post-balances and calculate changes
    for (const postBalance of postBalances) {
      const key = `${postBalance.accountIndex}_${postBalance.mint}`;
      const existing = balanceChanges.get(key);
      
      if (existing) {
        existing.postAmount = parseFloat(postBalance.uiTokenAmount.amount);
        existing.change = existing.postAmount - existing.preAmount;
      } else {
        balanceChanges.set(key, {
          mint: postBalance.mint,
          owner: postBalance.owner,
          preAmount: 0,
          postAmount: parseFloat(postBalance.uiTokenAmount.amount),
          change: parseFloat(postBalance.uiTokenAmount.amount)
        });
      }
    }

    // Create token transfer edges for significant changes
    for (const [key, change] of balanceChanges.entries()) {
      if (Math.abs(change.change) >= this.options.minTransferAmount) {
        await this.createTokenTransferEdge(change, transaction);
      }
    }
  }

  /**
   * Process account balance changes (SOL transfers)
   */
  private async processAccountChanges(transaction: DetailedTransactionInfo): Promise<void> {
    const preBalances = transaction.meta?.preBalances || [];
    const postBalances = transaction.meta?.postBalances || [];
    const accountKeys = transaction.transaction.message.accountKeys || [];

    for (let i = 0; i < Math.min(preBalances.length, postBalances.length); i++) {
      const preBalance = preBalances[i];
      const postBalance = postBalances[i];
      const change = postBalance - preBalance;

      if (Math.abs(change) >= this.options.minTransferAmount) {
        const accountAddress = accountKeys[i];
        if (accountAddress) {
          // This change will be reflected in the account node data
          const accountNode = this.nodeMap.get(`account_${accountAddress}`);
          if (accountNode) {
            accountNode.data.balance = postBalance;
            accountNode.data.metadata = {
              ...accountNode.data.metadata,
              balanceChange: change,
              preBalance,
              postBalance
            };
          }
        }
      }
    }
  }  /**
 
  * Create a transaction node
   */
  private createTransactionNode(transaction: DetailedTransactionInfo): GraphNode {
    return {
      id: `tx_${transaction.signature}`,
      type: 'transaction',
      label: `TX: ${transaction.signature.substring(0, 8)}...`,
      data: {
        metadata: {
          signature: transaction.signature,
          slot: transaction.slot,
          blockTime: transaction.blockTime,
          fee: transaction.meta?.fee,
          status: transaction.meta?.err ? 'failed' : 'success'
        }
      },
      style: {
        size: this.calculateNodeSize('transaction', transaction),
        color: this.getNodeColor('transaction'),
        shape: 'diamond',
        borderColor: transaction.meta?.err ? '#EF4444' : '#10B981',
        borderWidth: 2
      },
      importance: 1.0, // Transaction is always most important
      group: 'transactions'
    };
  }

  /**
   * Create an account node
   */
  private async createAccountNode(
    address: string,
    transaction: DetailedTransactionInfo,
    accountIndex: number
  ): Promise<GraphNode> {
    const accountInfo = await this.getAccountInfo(address);
    const nodeType = this.determineAccountNodeType(accountInfo);
    
    return {
      id: `account_${address}`,
      type: nodeType,
      label: this.formatAccountLabel(address, accountInfo),
      data: {
        address,
        balance: accountInfo?.lamports || 0,
        owner: accountInfo?.owner,
        executable: accountInfo?.executable || false,
        metadata: {
          accountIndex,
          ...accountInfo
        }
      },
      style: {
        size: this.calculateNodeSize(nodeType, accountInfo),
        color: this.getNodeColor(nodeType),
        shape: this.getNodeShape(nodeType),
        opacity: this.shouldIncludeAccount(accountInfo) ? 1.0 : 0.5
      },
      importance: this.calculateNodeImportance(address, accountInfo),
      group: this.getAccountGroup(accountInfo)
    };
  }

  /**
   * Create a program node
   */
  private async createProgramNode(
    programId: string,
    transaction: DetailedTransactionInfo
  ): Promise<GraphNode> {
    const programInfo = await this.getProgramInfo(programId);
    
    return {
      id: `program_${programId}`,
      type: 'program',
      label: programInfo?.name || `Program: ${programId.substring(0, 8)}...`,
      data: {
        address: programId,
        programId,
        metadata: {
          ...programInfo,
          isSystemProgram: this.isSystemProgram(programId)
        }
      },
      style: {
        size: this.calculateNodeSize('program', programInfo),
        color: this.getNodeColor('program'),
        shape: 'hexagon'
      },
      importance: this.calculateProgramImportance(programId),
      group: 'programs'
    };
  }

  /**
   * Create an edge between transaction and account
   */
  private createTransactionAccountEdge(
    transactionId: string,
    accountId: string,
    accountIndex: number
  ): GraphEdge {
    return {
      id: `tx_acc_${transactionId}_${accountId}`,
      source: transactionId,
      target: accountId,
      type: 'account_access',
      data: {
        direction: 'out',
        instructionIndex: -1, // Transaction-level connection
        metadata: { accountIndex }
      },
      style: {
        width: 2,
        color: EDGE_COLORS.account_access,
        opacity: 0.6
      },
      weight: 0.5
    };
  }

  /**
   * Create an instruction edge between program and account
   */
  private createInstructionEdge(
    programId: string,
    accountId: string,
    instructionIndex: number,
    instruction: any
  ): GraphEdge {
    return {
      id: `inst_${programId}_${accountId}_${instructionIndex}`,
      source: programId,
      target: accountId,
      type: 'instruction',
      label: `Instruction ${instructionIndex}`,
      data: {
        direction: 'out',
        instructionIndex,
        metadata: { instruction }
      },
      style: {
        width: this.calculateEdgeWidth('instruction', instruction),
        color: EDGE_COLORS.instruction,
        animated: this.options.showInstructionFlow
      },
      weight: 0.8
    };
  }

  /**
   * Create a token transfer edge
   */
  private async createTokenTransferEdge(
    change: {
      mint: string;
      owner: string;
      preAmount: number;
      postAmount: number;
      change: number;
    },
    transaction: DetailedTransactionInfo
  ): Promise<void> {
    const tokenInfo = await this.getTokenInfo(change.mint);
    const amount = Math.abs(change.change);
    
    // Create token node if it doesn't exist
    const tokenNodeId = `token_${change.mint}`;
    if (!this.nodeMap.has(tokenNodeId)) {
      const tokenNode: GraphNode = {
        id: tokenNodeId,
        type: 'token',
        label: tokenInfo?.symbol || `Token: ${change.mint.substring(0, 8)}...`,
        data: {
          address: change.mint,
          symbol: tokenInfo?.symbol,
          decimals: tokenInfo?.decimals,
          metadata: tokenInfo
        },
        style: {
          size: this.calculateNodeSize('token', { amount }),
          color: this.getNodeColor('token'),
          shape: 'circle'
        },
        importance: this.calculateTokenImportance(change.mint, amount),
        group: 'tokens'
      };
      this.addNode(tokenNode);
    }

    // Create transfer edge
    const ownerNodeId = `account_${change.owner}`;
    const transferEdge: GraphEdge = {
      id: `transfer_${ownerNodeId}_${tokenNodeId}_${Date.now()}`,
      source: change.change > 0 ? tokenNodeId : ownerNodeId,
      target: change.change > 0 ? ownerNodeId : tokenNodeId,
      type: 'token_transfer',
      label: `${amount} ${tokenInfo?.symbol || 'tokens'}`,
      data: {
        amount,
        symbol: tokenInfo?.symbol,
        direction: change.change > 0 ? 'in' : 'out',
        metadata: { change, tokenInfo }
      },
      style: {
        width: this.calculateEdgeWidth('token_transfer', { amount }),
        color: EDGE_COLORS.token_transfer,
        animated: amount > 1000 // Animate large transfers
      },
      weight: Math.min(amount / 10000, 1.0) // Normalize weight
    };

    this.addEdge(transferEdge);
  } 
 /**
   * Calculate layout positions for all nodes
   */
  private async calculateLayout(): Promise<void> {
    const nodes = Array.from(this.nodeMap.values());
    const edges = Array.from(this.edgeMap.values());

    switch (this.options.layout) {
      case 'force':
        await this.calculateForceLayout(nodes, edges);
        break;
      case 'hierarchical':
        await this.calculateHierarchicalLayout(nodes, edges);
        break;
      case 'circular':
        await this.calculateCircularLayout(nodes, edges);
        break;
      case 'grid':
        await this.calculateGridLayout(nodes, edges);
        break;
    }
  }

  /**
   * Force-directed layout calculation
   */
  private async calculateForceLayout(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Initialize positions randomly
    nodes.forEach(node => {
      node.position = {
        x: centerX + (Math.random() - 0.5) * width * 0.8,
        y: centerY + (Math.random() - 0.5) * height * 0.8
      };
    });

    // Simple force simulation (simplified version)
    const iterations = 100;
    const repulsionStrength = 1000;
    const attractionStrength = 0.1;
    const damping = 0.9;

    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map<string, { x: number; y: number }>();
      
      // Initialize forces
      nodes.forEach(node => {
        forces.set(node.id, { x: 0, y: 0 });
      });

      // Repulsion forces between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeA = nodes[i];
          const nodeB = nodes[j];
          const dx = nodeB.position!.x - nodeA.position!.x;
          const dy = nodeB.position!.y - nodeA.position!.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = repulsionStrength / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          const forceA = forces.get(nodeA.id)!;
          const forceB = forces.get(nodeB.id)!;
          
          forceA.x -= fx;
          forceA.y -= fy;
          forceB.x += fx;
          forceB.y += fy;
        }
      }

      // Attraction forces along edges
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.position!.x - sourceNode.position!.x;
          const dy = targetNode.position!.y - sourceNode.position!.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = attractionStrength * distance * edge.weight;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          const sourceForce = forces.get(sourceNode.id)!;
          const targetForce = forces.get(targetNode.id)!;
          
          sourceForce.x += fx;
          sourceForce.y += fy;
          targetForce.x -= fx;
          targetForce.y -= fy;
        }
      });

      // Apply forces
      nodes.forEach(node => {
        const force = forces.get(node.id)!;
        node.position!.x += force.x * damping;
        node.position!.y += force.y * damping;
        
        // Keep nodes within bounds
        node.position!.x = Math.max(50, Math.min(width - 50, node.position!.x));
        node.position!.y = Math.max(50, Math.min(height - 50, node.position!.y));
      });
    }
  }

  /**
   * Hierarchical layout calculation
   */
  private async calculateHierarchicalLayout(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    const width = 800;
    const height = 600;
    const layers = new Map<number, GraphNode[]>();
    
    // Find transaction nodes (root level)
    const transactionNodes = nodes.filter(n => n.type === 'transaction');
    layers.set(0, transactionNodes);
    
    // Find program nodes (level 1)
    const programNodes = nodes.filter(n => n.type === 'program');
    layers.set(1, programNodes);
    
    // Find account nodes (level 2)
    const accountNodes = nodes.filter(n => n.type.includes('account'));
    layers.set(2, accountNodes);
    
    // Find token nodes (level 3)
    const tokenNodes = nodes.filter(n => n.type === 'token');
    layers.set(3, tokenNodes);
    
    // Position nodes in layers
    let currentY = 100;
    const layerHeight = (height - 200) / layers.size;
    
    layers.forEach((layerNodes, level) => {
      const nodeWidth = width / (layerNodes.length + 1);
      
      layerNodes.forEach((node, index) => {
        node.position = {
          x: nodeWidth * (index + 1),
          y: currentY
        };
      });
      
      currentY += layerHeight;
    });
  }

  /**
   * Circular layout calculation
   */
  private async calculateCircularLayout(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    const centerX = 400;
    const centerY = 300;
    const radius = 200;
    
    // Place transaction in center
    const transactionNodes = nodes.filter(n => n.type === 'transaction');
    transactionNodes.forEach(node => {
      node.position = { x: centerX, y: centerY };
    });
    
    // Place other nodes in circle
    const otherNodes = nodes.filter(n => n.type !== 'transaction');
    const angleStep = (2 * Math.PI) / otherNodes.length;
    
    otherNodes.forEach((node, index) => {
      const angle = index * angleStep;
      node.position = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      };
    });
  }

  /**
   * Grid layout calculation
   */
  private async calculateGridLayout(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    const cellWidth = 800 / cols;
    const cellHeight = 600 / rows;
    
    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      node.position = {
        x: col * cellWidth + cellWidth / 2,
        y: row * cellHeight + cellHeight / 2
      };
    });
  }  /**

   * Build the final graph structure
   */
  private buildFinalGraph(transactionSignature: string): TransactionGraph {
    const nodes = Array.from(this.nodeMap.values());
    const edges = Array.from(this.edgeMap.values());
    
    // Calculate bounds
    const positions = nodes.map(n => n.position!).filter(p => p);
    const bounds = {
      minX: Math.min(...positions.map(p => p.x)) - 50,
      maxX: Math.max(...positions.map(p => p.x)) + 50,
      minY: Math.min(...positions.map(p => p.y)) - 50,
      maxY: Math.max(...positions.map(p => p.y)) + 50
    };
    
    // Build groups
    const groups: TransactionGraph['groups'] = {};
    nodes.forEach(node => {
      if (node.group && !groups[node.group]) {
        groups[node.group] = {
          name: node.group.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          color: this.getGroupColor(node.group),
          nodes: []
        };
      }
      if (node.group) {
        groups[node.group].nodes.push(node.id);
      }
    });
    
    // Calculate statistics
    const nodeTypeDistribution = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<NodeType, number>);
    
    const edgeTypeDistribution = edges.reduce((acc, edge) => {
      acc[edge.type] = (acc[edge.type] || 0) + 1;
      return acc;
    }, {} as Record<EdgeType, number>);
    
    const totalValue = edges
      .filter(e => e.data.usdValue)
      .reduce((sum, e) => sum + (e.data.usdValue || 0), 0);
    
    const largestTransfer = Math.max(
      ...edges
        .filter(e => e.data.amount)
        .map(e => e.data.amount || 0),
      0
    );
    
    return {
      nodes,
      edges,
      metadata: {
        transactionSignature,
        centerNode: `tx_${transactionSignature}`,
        totalNodes: nodes.length,
        totalEdges: edges.length,
        maxDepth: this.options.maxDepth,
        layout: this.options.layout,
        bounds
      },
      groups,
      statistics: {
        nodeTypeDistribution,
        edgeTypeDistribution,
        totalValue,
        largestTransfer,
        programsInvolved: nodes.filter(n => n.type === 'program').length,
        accountsAffected: nodes.filter(n => n.type.includes('account')).length
      }
    };
  }

  // Helper methods for node and edge creation
  private calculateNodeSize(type: NodeType, data: any): number {
    const baseSizes = {
      transaction: 20,
      account: 15,
      program: 18,
      token: 12,
      system_account: 10,
      token_account: 12,
      program_account: 14
    };
    
    let size = baseSizes[type] || 15;
    
    if (this.options.nodeSize === 'by_balance' && data?.balance) {
      size += Math.min(data.balance / 1000000000, 10); // Scale by SOL balance
    } else if (this.options.nodeSize === 'by_activity' && data?.relevanceScore) {
      size += data.relevanceScore * 10;
    }
    
    return size;
  }

  private calculateEdgeWidth(type: EdgeType, data: any): number {
    const baseWidths = {
      transfer: 3,
      instruction: 2,
      account_access: 1,
      program_invocation: 2,
      token_transfer: 3,
      account_creation: 2,
      account_closure: 2,
      delegation: 1,
      approval: 1
    };
    
    let width = baseWidths[type] || 2;
    
    if (this.options.edgeWidth === 'by_amount' && data?.amount) {
      width += Math.min(Math.log10(data.amount + 1), 5);
    } else if (this.options.edgeWidth === 'by_frequency' && data?.strength) {
      const strengthMultiplier = {
        weak: 1,
        medium: 1.5,
        strong: 2,
        very_strong: 3
      };
      width *= strengthMultiplier[data.strength as keyof typeof strengthMultiplier] || 1;
    }
    
    return Math.max(1, width);
  }

  private getNodeColor(type: NodeType): string {
    return NODE_COLORS[type] || '#6B7280';
  }

  private getNodeShape(type: NodeType): GraphNode['style']['shape'] {
    const shapes: Record<NodeType, GraphNode['style']['shape']> = {
      transaction: 'diamond',
      account: 'circle',
      program: 'hexagon',
      token: 'circle',
      system_account: 'square',
      token_account: 'circle',
      program_account: 'triangle'
    };
    
    return shapes[type] || 'circle';
  }

  private getGroupColor(group: string): string {
    const colors: Record<string, string> = {
      transactions: '#F59E0B',
      programs: '#8B5CF6',
      accounts: '#3B82F6',
      tokens: '#10B981',
      related_transactions: '#EC4899'
    };
    
    return colors[group] || '#6B7280';
  }

  // Utility methods
  private addNode(node: GraphNode): void {
    this.nodeMap.set(node.id, node);
  }

  private addEdge(edge: GraphEdge): void {
    this.edgeMap.set(edge.id, edge);
  }

  private reset(): void {
    this.nodeMap.clear();
    this.edgeMap.clear();
    this.nodeImportanceCache.clear();
  }

  // Mock methods for external data (to be implemented with actual data sources)
  private async getAccountInfo(address: string): Promise<any> {
    // Mock implementation - replace with actual Solana RPC calls
    return {
      lamports: Math.floor(Math.random() * 10000000000),
      owner: '11111111111111111111111111111111',
      executable: false
    };
  }

  private async getProgramInfo(programId: string): Promise<any> {
    // Mock implementation - replace with program registry lookup
    const knownPrograms: Record<string, any> = {
      '11111111111111111111111111111111': { name: 'System Program' },
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': { name: 'SPL Token Program' },
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': { name: 'Jupiter Aggregator' }
    };
    
    return knownPrograms[programId] || { name: null };
  }

  private async getTokenInfo(mint: string): Promise<any> {
    // Mock implementation - replace with token registry lookup
    const knownTokens: Record<string, any> = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
      'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9 }
    };
    
    return knownTokens[mint] || { symbol: null, decimals: 9 };
  }

  private determineAccountNodeType(accountInfo: any): NodeType {
    if (accountInfo?.executable) return 'program_account';
    if (accountInfo?.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') return 'token_account';
    if (accountInfo?.owner === '11111111111111111111111111111111') return 'system_account';
    return 'account';
  }

  private formatAccountLabel(address: string, accountInfo: any): string {
    if (accountInfo?.executable) return `Program: ${address.substring(0, 8)}...`;
    return `Account: ${address.substring(0, 8)}...`;
  }

  private shouldIncludeAccount(accountInfo: any): boolean {
    if (!this.options.includeSystemAccounts && accountInfo?.owner === '11111111111111111111111111111111') {
      return false;
    }
    if (!this.options.includeTokenAccounts && accountInfo?.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
      return false;
    }
    return true;
  }

  private calculateNodeImportance(address: string, accountInfo: any): number {
    // Cache importance calculations
    if (this.nodeImportanceCache.has(address)) {
      return this.nodeImportanceCache.get(address)!;
    }
    
    let importance = 0.5; // Base importance
    
    // Higher importance for accounts with more SOL
    if (accountInfo?.lamports) {
      importance += Math.min(accountInfo.lamports / 10000000000, 0.3);
    }
    
    // Higher importance for executable accounts (programs)
    if (accountInfo?.executable) {
      importance += 0.2;
    }
    
    this.nodeImportanceCache.set(address, importance);
    return importance;
  }

  private calculateProgramImportance(programId: string): number {
    // System programs are more important
    if (this.isSystemProgram(programId)) {
      return 0.9;
    }
    
    // Known DeFi programs are important
    const defiPrograms = [
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter
      '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Raydium
    ];
    
    if (defiPrograms.includes(programId)) {
      return 0.8;
    }
    
    return 0.6;
  }

  private calculateTokenImportance(mint: string, amount: number): number {
    // Major tokens are more important
    const majorTokens = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'So11111111111111111111111111111111111111112', // SOL
    ];
    
    let importance = 0.5;
    
    if (majorTokens.includes(mint)) {
      importance += 0.3;
    }
    
    // Higher amounts are more important
    importance += Math.min(Math.log10(amount + 1) / 10, 0.2);
    
    return importance;
  }

  private getAccountGroup(accountInfo: any): string {
    if (accountInfo?.executable) return 'programs';
    if (accountInfo?.owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') return 'token_accounts';
    return 'accounts';
  }

  private isSystemProgram(programId: string): boolean {
    const systemPrograms = [
      '11111111111111111111111111111111', // System Program
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token
    ];
    
    return systemPrograms.includes(programId);
  }
}

// Export utility functions for external use
export const transactionGraphBuilder = new TransactionGraphBuilder();

export function createGraphBuilder(options?: Partial<GraphBuilderOptions>): TransactionGraphBuilder {
  return new TransactionGraphBuilder(options);
}

export function getDefaultGraphOptions(): GraphBuilderOptions {
  return { ...DEFAULT_OPTIONS };
}

export function validateGraphData(graph: TransactionGraph): boolean {
  // Validate that all edge sources and targets exist as nodes
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      return false;
    }
  }
  
  return true;
}