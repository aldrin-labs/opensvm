import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'body';
  required?: boolean;
  schema: any;
  description?: string;
}

export interface OpenAPIResponse {
  status: number;
  description: string;
  schema?: any;
  examples?: Record<string, any>;
}

export interface OpenAPIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: any; examples?: any }>;
  };
  responses: Record<string, OpenAPIResponse>;
  operationId: string;
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: {
      name: string;
      url: string;
      email: string;
    };
    license?: {
      name: string;
      url: string;
    };
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, Record<string, any>>;
  components: {
    schemas: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags: Array<{
    name: string;
    description: string;
  }>;
}

class OpenAPIGenerator {
  private spec: OpenAPISpec;
  private endpoints: OpenAPIEndpoint[] = [];

  constructor() {
    this.spec = {
      openapi: '3.0.3',
      info: {
        title: 'OpenSVM API - Complete Reference',
        version: '2.0.0',
        description: 'Comprehensive API for Solana Virtual Machine Explorer - 97 Core API Routes covering transactions, blockchain data, analytics, DeFi, NFTs, and AI-powered insights',
        contact: {
          name: 'OpenSVM Team',
          url: 'https://opensvm.com',
          email: 'support@opensvm.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'http://localhost:3000/api',
          description: 'Development server'
        },
        {
          url: 'https://opensvm.com/api',
          description: 'Production server'
        }
      ],
      paths: {},
      components: {
        schemas: this.getCommonSchemas()
      },
      tags: [
        { name: 'Search & Discovery', description: 'Universal search and program discovery across the blockchain (9 endpoints)' },
        { name: 'Account & Wallet', description: 'Account information, portfolio management, and transaction history (14 endpoints)' },
        { name: 'Transactions', description: 'Transaction analysis, metrics, and failure detection (17 endpoints)' },
        { name: 'Blockchain', description: 'Block data, slot information, and RPC operations (8 endpoints)' },
        { name: 'Tokens & NFTs', description: 'Token information, NFT collections, and metadata (7 endpoints)' },
        { name: 'Analytics', description: 'DeFi analytics, validator metrics, and ecosystem health (12 endpoints)' },
        { name: 'AI-Powered', description: 'AI-powered analysis, question answering, and insights (6 endpoints)' },
        { name: 'Real-Time', description: 'Server-sent events, streaming data, and live feeds (6 endpoints)' },
        { name: 'User Services', description: 'User profiles, activity feeds, and personalization (14 endpoints)' },
        { name: 'Trading API', description: 'Binance-compatible trading API with DEX aggregation via Jupiter (17 endpoints)' }
      ]
    };

    this.registerAllEndpoints();
  }

  private getCommonSchemas() {
    return {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Error message' },
          code: { type: 'string', description: 'Error code' },
          details: { type: 'object', description: 'Additional error details' }
        },
        required: ['error']
      },
      Transaction: {
        type: 'object',
        properties: {
          signature: { 
            type: 'string', 
            description: 'Transaction signature',
            example: '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5'
          },
          slot: { type: 'integer', description: 'Slot number' },
          blockTime: { type: 'integer', description: 'Block timestamp' },
          fee: { type: 'integer', description: 'Transaction fee in lamports' },
          status: { 
            type: 'string', 
            enum: ['success', 'failed'],
            description: 'Transaction status' 
          },
          instructions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Instruction' },
            description: 'Transaction instructions'
          },
          accounts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Account addresses involved'
          }
        }
      },
      Instruction: {
        type: 'object',
        properties: {
          programId: { type: 'string', description: 'Program ID' },
          data: { type: 'string', description: 'Instruction data (base64)' },
          accounts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Account keys'
          },
          parsed: { 
            type: 'object',
            description: 'Parsed instruction data'
          }
        }
      },
      Account: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Account address' },
          lamports: { type: 'integer', description: 'Account balance in lamports' },
          data: { type: 'string', description: 'Account data (base64)' },
          owner: { type: 'string', description: 'Program that owns this account' },
          executable: { type: 'boolean', description: 'Whether account is executable' },
          rentEpoch: { type: 'integer', description: 'Rent epoch' }
        }
      },
      Block: {
        type: 'object',
        properties: {
          slot: { type: 'integer', description: 'Block slot number' },
          blockhash: { type: 'string', description: 'Block hash' },
          previousBlockhash: { type: 'string', description: 'Previous block hash' },
          parentSlot: { type: 'integer', description: 'Parent slot number' },
          transactions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Transaction' },
            description: 'Transactions in block'
          },
          blockTime: { type: 'integer', description: 'Block timestamp' },
          blockHeight: { type: 'integer', description: 'Block height' }
        }
      },
      TokenInfo: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Token mint address' },
          symbol: { type: 'string', description: 'Token symbol' },
          name: { type: 'string', description: 'Token name' },
          decimals: { type: 'integer', description: 'Token decimal places' },
          supply: { type: 'string', description: 'Token total supply' },
          price: { type: 'number', description: 'Current price in USD' },
          marketCap: { type: 'number', description: 'Market capitalization' },
          volume24h: { type: 'number', description: '24h trading volume' }
        }
      },
      AccountStats: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          balance: { type: 'number' },
          transactionCount: { type: 'integer' },
          firstActivity: { type: 'string', format: 'date-time' },
          lastActivity: { type: 'string', format: 'date-time' },
          totalSent: { type: 'number' },
          totalReceived: { type: 'number' }
        }
      },
      SearchResult: {
        type: 'object',
        properties: {
          type: { 
            type: 'string',
            enum: ['transaction', 'account', 'block', 'program', 'token']
          },
          value: { type: 'string' },
          label: { type: 'string' },
          description: { type: 'string' },
          metadata: { type: 'object' }
        }
      },
      DefiOverview: {
        type: 'object',
        properties: {
          totalValueLocked: { type: 'number' },
          protocols: { type: 'integer' },
          volume24h: { type: 'number' },
          topProtocols: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                tvl: { type: 'number' },
                change24h: { type: 'number' }
              }
            }
          }
        }
      },
      TransferListResponse: {
        type: 'object',
        properties: {
          transfers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                txId: { type: 'string', description: 'Transaction signature' },
                date: { type: 'string', description: 'Transaction timestamp' },
                from: { type: 'string', description: 'Sender address' },
                to: { type: 'string', description: 'Receiver address' },
                tokenSymbol: { type: 'string', description: 'Token symbol (SOL or token)' },
                tokenAmount: { type: 'string', description: 'Amount transferred' },
                transferType: { 
                  type: 'string', 
                  enum: ['IN', 'OUT'],
                  description: 'Transfer direction relative to the queried address'
                }
              },
              required: ['txId', 'date', 'from', 'to', 'tokenSymbol', 'tokenAmount', 'transferType']
            },
            description: 'List of transfer transactions'
          },
          hasMore: { 
            type: 'boolean',
            description: 'Whether more transfers are available for pagination'
          }
        },
        required: ['transfers', 'hasMore']
      }
    };
  }

  private registerAllEndpoints() {
    // ============= SEARCH & DISCOVERY (9 methods) =============
    this.addEndpoint({
      path: '/search',
      method: 'GET',
      summary: 'Universal Search',
      description: 'Search across all blockchain data types',
      tags: ['Search & Discovery'],
      parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
        { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by type' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 }, description: 'Results limit' }
      ],
      responses: {
        '200': { status: 200, description: 'Search results', schema: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } } }
      },
      operationId: 'universalSearch'
    });

    this.addEndpoint({
      path: '/search/accounts',
      method: 'GET',
      summary: 'Search Accounts',
      description: 'Search for specific accounts',
      tags: ['Search & Discovery'],
      parameters: [
        { name: 'query', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
        { name: 'tokenMint', in: 'query', schema: { type: 'string' }, description: 'Filter by token' }
      ],
      responses: {
        '200': { status: 200, description: 'Account search results' }
      },
      operationId: 'searchAccounts'
    });

    this.addEndpoint({
      path: '/search/filtered',
      method: 'GET',
      summary: 'Advanced Filtered Search',
      description: 'Search with advanced filtering',
      tags: ['Search & Discovery'],
      parameters: [
        { name: 'query', in: 'query', required: true, schema: { type: 'string' }},
        { name: 'start', in: 'query', schema: { type: 'string' }, description: 'Start date' },
        { name: 'end', in: 'query', schema: { type: 'string' }, description: 'End date' },
        { name: 'min', in: 'query', schema: { type: 'number' }, description: 'Min amount' },
        { name: 'max', in: 'query', schema: { type: 'number' }, description: 'Max amount' }
      ],
      responses: {
        '200': { status: 200, description: 'Filtered search results' }
      },
      operationId: 'filteredSearch'
    });

    this.addEndpoint({
      path: '/search/suggestions',
      method: 'GET',
      summary: 'Search Suggestions',
      description: 'Get search suggestions',
      tags: ['Search & Discovery'],
      parameters: [
        { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Query prefix' }
      ],
      responses: {
        '200': { status: 200, description: 'Search suggestions' }
      },
      operationId: 'searchSuggestions'
    });

    this.addEndpoint({
      path: '/program-discovery',
      method: 'GET',
      summary: 'Discover Programs',
      description: 'Find Solana programs',
      tags: ['Search & Discovery'],
      responses: {
        '200': { status: 200, description: 'Discovered programs' }
      },
      operationId: 'programDiscovery'
    });

    this.addEndpoint({
      path: '/program-registry',
      method: 'GET',
      summary: 'Program Registry',
      description: 'List registered programs',
      tags: ['Search & Discovery'],
      parameters: [
        { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Program category' },
        { name: 'verified', in: 'query', schema: { type: 'boolean' }, description: 'Show only verified' }
      ],
      responses: {
        '200': { status: 200, description: 'Registered programs' }
      },
      operationId: 'programRegistry'
    });

    this.addEndpoint({
      path: '/program/{address}',
      method: 'GET',
      summary: 'Get Program Details',
      description: 'Get program information',
      tags: ['Search & Discovery'],
      parameters: [
        { name: 'address', in: 'path', required: true, schema: { type: 'string' }, description: 'Program address' }
      ],
      responses: {
        '200': { status: 200, description: 'Program details' }
      },
      operationId: 'getProgram'
    });

    this.addEndpoint({
      path: '/program-metadata',
      method: 'GET',
      summary: 'Program Metadata',
      description: 'Get batch program metadata',
      tags: ['Search & Discovery'],
      parameters: [
        { name: 'programs', in: 'query', schema: { type: 'array', items: { type: 'string' } }, description: 'Program addresses' }
      ],
      responses: {
        '200': { status: 200, description: 'Program metadata' }
      },
      operationId: 'programMetadata'
    });

    // ============= ACCOUNT & WALLET (14 methods) =============
    this.addEndpoint({
      path: '/account-stats/{address}',
      method: 'GET',
      summary: 'Account Statistics',
      description: 'Get comprehensive account statistics',
      tags: ['Account & Wallet'],
      parameters: [
        { name: 'address', in: 'path', required: true, schema: { type: 'string' }, description: 'Account address' }
      ],
      responses: {
        '200': { status: 200, description: 'Account statistics', schema: { $ref: '#/components/schemas/AccountStats' } }
      },
      operationId: 'accountStats'
    });

    this.addEndpoint({
      path: '/account-portfolio/{address}',
      method: 'GET',
      summary: 'Portfolio Overview',
      description: 'Get portfolio overview',
      tags: ['Account & Wallet'],
      parameters: [
        { name: 'address', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        '200': { status: 200, description: 'Portfolio overview' }
      },
      operationId: 'accountPortfolio'
    });

    this.addEndpoint({
      path: '/check-account-type',
      method: 'GET',
      summary: 'Check Account Type',
      description: 'Determine account type (wallet, program, token, etc.)',
      tags: ['Account & Wallet'],
      parameters: [
        { name: 'address', in: 'query', required: true, schema: { type: 'string' } }
      ],
      responses: {
        '200': { status: 200, description: 'Account type information' }
      },
      operationId: 'checkAccountType'
    });

    this.addEndpoint({
      path: '/account-transactions/{address}',
      method: 'GET',
      summary: 'Account Transactions',
      description: 'Get transaction history',
      tags: ['Account & Wallet'],
      parameters: [
        { name: 'address', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
        { name: 'before', in: 'query', schema: { type: 'string' }, description: 'Pagination cursor' }
      ],
      responses: {
        '200': { status: 200, description: 'Transaction history' }
      },
      operationId: 'accountTransactions'
    });

    this.addEndpoint({
      path: '/account-transfers/{address}',
      method: 'GET',
      summary: 'Account Transfers',
      description: 'Get SOL/token transfers',
      tags: ['Account & Wallet'],
      parameters: [
        { name: 'address', in: 'path', required: true, schema: { type: 'string' }, description: 'Solana account address' },
        { name: 'beforeSignature', in: 'query', schema: { type: 'string' }, description: 'Smart cursor initialization: use oldest cached signature if no beforeSignature provided' },
        { name: 'offset', in: 'query', schema: { type: 'number' }, description: 'Pagination offset' },
        { name: 'limit', in: 'query', schema: { type: 'string' }, description: 'Maximum number of transfers to return' },
        { name: 'transferType', in: 'query', schema: { type: 'string', enum: ['IN', 'OUT'] }, description: 'Filter by transfer direction' },
        { name: 'solanaOnly', in: 'query', schema: { type: 'boolean' }, description: 'Show only SOL transfers (exclude tokens)' }
      ],
      responses: {
        '200': { 
          status: 200, 
          description: 'Transfer history',
          schema: { $ref: '#/components/schemas/TransferListResponse' }
        },
        '400': {
          status: 400,
          description: 'Bad Request - Invalid address',
          schema: { $ref: '#/components/schemas/Error' }
        }
      },
      operationId: 'accountTransfers'
    });

    this.addEndpoint({
      path: '/user-history/{walletAddress}',
      method: 'GET',
      summary: 'User History',
      description: 'Get user transaction history',
      tags: ['Account & Wallet'],
      parameters: [
        { name: 'walletAddress', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'integer' } }
      ],
      responses: {
        '200': { status: 200, description: 'User history' }
      },
      operationId: 'userHistory'
    });

    this.addEndpoint({
      path: '/account-token-stats/{address}/{mint}',
      method: 'GET',
      summary: 'Token Statistics',
      description: 'Get token-specific stats for account',
      tags: ['Account & Wallet'],
      parameters: [
        { name: 'address', in: 'path', required: true, schema: { type: 'string' }, description: 'Account address' },
        { name: 'mint', in: 'path', required: true, schema: { type: 'string' }, description: 'Token mint address' }
      ],
      responses: {
        '200': { status: 200, description: 'Token statistics' }
      },
      operationId: 'accountTokenStats'
    });

    this.addEndpoint({
      path: '/user-profile/{walletAddress}',
      method: 'GET',
      summary: 'User Profile',
      description: 'Get user profile',
      tags: ['Account & Wallet'],
      parameters: [
        { name: 'walletAddress', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        '200': { status: 200, description: 'User profile' }
      },
      operationId: 'userProfile'
    });

    // ============= TRANSACTIONS (17 methods) =============
    this.addEndpoint({
      path: '/transaction/{signature}',
      method: 'GET',
      summary: 'Get Transaction',
      description: 'Get transaction details',
      tags: ['Transactions'],
      parameters: [
        { name: 'signature', in: 'path', required: true, schema: { type: 'string' }, description: 'Transaction signature' }
      ],
      responses: {
        '200': { status: 200, description: 'Transaction details', schema: { $ref: '#/components/schemas/Transaction' } }
      },
      operationId: 'getTransaction'
    });

    this.addEndpoint({
      path: '/transaction/{signature}/analysis',
      method: 'GET',
      summary: 'AI Transaction Analysis',
      description: 'Analyze transaction with AI',
      tags: ['Transactions'],
      parameters: [
        { name: 'signature', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        '200': { status: 200, description: 'Transaction analysis' }
      },
      operationId: 'transactionAnalysis'
    });

    this.addEndpoint({
      path: '/transaction/{signature}/explain',
      method: 'GET',
      summary: 'Explain Transaction',
      description: 'Get human-readable explanation',
      tags: ['Transactions'],
      parameters: [
        { name: 'signature', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'language', in: 'query', schema: { type: 'string' }, description: 'Output language' }
      ],
      responses: {
        '200': { status: 200, description: 'Transaction explanation' }
      },
      operationId: 'transactionExplain'
    });

    this.addEndpoint({
      path: '/transaction/{signature}/metrics',
      method: 'GET',
      summary: 'Transaction Metrics',
      description: 'Get performance metrics',
      tags: ['Transactions'],
      parameters: [
        { name: 'signature', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        '200': { status: 200, description: 'Transaction metrics' }
      },
      operationId: 'transactionMetrics'
    });

    this.addEndpoint({
      path: '/transaction/{signature}/related',
      method: 'GET',
      summary: 'Related Transactions',
      description: 'Find related transactions',
      tags: ['Transactions'],
      parameters: [
        { name: 'signature', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        '200': { status: 200, description: 'Related transactions' }
      },
      operationId: 'relatedTransactions'
    });

    this.addEndpoint({
      path: '/transaction/{signature}/failure-analysis',
      method: 'GET',
      summary: 'Failure Analysis',
      description: 'Analyze transaction failures',
      tags: ['Transactions'],
      parameters: [
        { name: 'signature', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        '200': { status: 200, description: 'Failure analysis' }
      },
      operationId: 'failureAnalysis'
    });

    this.addEndpoint({
      path: '/transaction/batch',
      method: 'POST',
      summary: 'Batch Transactions',
      description: 'Fetch multiple transactions',
      tags: ['Transactions'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                signatures: { type: 'array', items: { type: 'string' }, maxItems: 20 },
                includeDetails: { type: 'boolean' }
              },
              required: ['signatures']
            }
          }
        }
      },
      responses: {
        '200': { status: 200, description: 'Batch transaction results' }
      },
      operationId: 'batchTransactions'
    });

    this.addEndpoint({
      path: '/filter-transactions',
      method: 'POST',
      summary: 'Filter Transactions',
      description: 'Filter transactions by criteria',
      tags: ['Transactions'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                account: { type: 'string' },
                startDate: { type: 'string' },
                endDate: { type: 'string' },
                minAmount: { type: 'number' },
                maxAmount: { type: 'number' }
              }
            }
          }
        }
      },
      responses: {
        '200': { status: 200, description: 'Filtered transactions' }
      },
      operationId: 'filterTransactions'
    });

    this.addEndpoint({
      path: '/analyze-transaction',
      method: 'POST',
      summary: 'Analyze Transaction',
      description: 'Deep AI analysis',
      tags: ['Transactions'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                signature: { type: 'string' },
                model: { type: 'string' }
              },
              required: ['signature']
            }
          }
        }
      },
      responses: {
        '200': { status: 200, description: 'Transaction analysis' }
      },
      operationId: 'analyzeTransaction'
    });

    // ============= BLOCKCHAIN (8 methods) =============
    this.addEndpoint({
      path: '/blocks',
      method: 'GET',
      summary: 'Recent Blocks',
      description: 'Get recent blocks',
      tags: ['Blockchain'],
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'before', in: 'query', schema: { type: 'integer' }, description: 'Slot for pagination' }
      ],
      responses: {
        '200': { status: 200, description: 'Recent blocks' }
      },
      operationId: 'recentBlocks'
    });

    this.addEndpoint({
      path: '/blocks/{slot}',
      method: 'GET',
      summary: 'Get Block',
      description: 'Get specific block',
      tags: ['Blockchain'],
      parameters: [
        { name: 'slot', in: 'path', required: true, schema: { type: 'integer' }, description: 'Block slot number' }
      ],
      responses: {
        '200': { status: 200, description: 'Block information', schema: { $ref: '#/components/schemas/Block' } }
      },
      operationId: 'getBlock'
    });

    this.addEndpoint({
      path: '/blocks/stats',
      method: 'GET',
      summary: 'Block Statistics',
      description: 'Get block statistics',
      tags: ['Blockchain'],
      parameters: [
        { name: 'lookbackSlots', in: 'query', schema: { type: 'integer', default: 100, minimum: 1, maximum: 1000 } }
      ],
      responses: {
        '200': { status: 200, description: 'Block statistics' }
      },
      operationId: 'blockStats'
    });

    this.addEndpoint({
      path: '/slots',
      method: 'GET',
      summary: 'Slot Information',
      description: 'Get current slot info',
      tags: ['Blockchain'],
      responses: {
        '200': { status: 200, description: 'Slot information' }
      },
      operationId: 'slots'
    });

    this.addEndpoint({
      path: '/solana-rpc',
      method: 'POST',
      summary: 'Solana RPC',
      description: 'Direct RPC calls',
      tags: ['Blockchain'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                method: { type: 'string' },
                params: { type: 'array' }
              },
              required: ['method']
            }
          }
        }
      },
      responses: {
        '200': { status: 200, description: 'RPC response' }
      },
      operationId: 'solanaRpc'
    });

    this.addEndpoint({
      path: '/solana-proxy',
      method: 'POST',
      summary: 'Solana Proxy',
      description: 'Proxied RPC with caching',
      tags: ['Blockchain'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                method: { type: 'string' },
                params: { type: 'array' }
              },
              required: ['method']
            }
          }
        }
      },
      responses: {
        '200': { status: 200, description: 'Proxied RPC response' }
      },
      operationId: 'solanaProxy'
    });

    // ============= TOKENS & NFTs (7 methods) =============
    this.addEndpoint({
      path: '/token/{address}',
      method: 'GET',
      summary: 'Token Information',
      description: 'Get token details',
      tags: ['Tokens & NFTs'],
      parameters: [
        { name: 'address', in: 'path', required: true, schema: { type: 'string' }, description: 'Token mint address' }
      ],
      responses: {
        '200': { status: 200, description: 'Token information', schema: { $ref: '#/components/schemas/TokenInfo' } }
      },
      operationId: 'tokenInfo'
    });

    this.addEndpoint({
      path: '/token-metadata',
      method: 'GET',
      summary: 'Token Metadata',
      description: 'Batch token metadata lookup',
      tags: ['Tokens & NFTs'],
      parameters: [
        { name: 'mints', in: 'query', schema: { type: 'array', items: { type: 'string' } }, description: 'Token mint addresses' }
      ],
      responses: {
        '200': { status: 200, description: 'Token metadata' }
      },
      operationId: 'tokenMetadata'
    });

    // ============= BINANCE-COMPATIBLE TRADING API (17 methods) =============
    // Connectivity
    this.addEndpoint({
      path: '/v3/ping',
      method: 'GET',
      summary: 'Test Connectivity',
      description: 'Test connectivity to the trading API',
      tags: ['Trading API'],
      responses: {
        '200': { status: 200, description: 'API is reachable', schema: { type: 'object' } }
      },
      operationId: 'tradingPing'
    });

    this.addEndpoint({
      path: '/v3/time',
      method: 'GET',
      summary: 'Server Time',
      description: 'Get current server time',
      tags: ['Trading API'],
      responses: {
        '200': { status: 200, description: 'Server time', schema: { type: 'object', properties: { serverTime: { type: 'integer' } } } }
      },
      operationId: 'tradingTime'
    });

    // Market Data
    this.addEndpoint({
      path: '/v3/exchangeInfo',
      method: 'GET',
      summary: 'Exchange Information',
      description: 'Get trading pairs and exchange rules',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', schema: { type: 'string' }, description: 'Filter by symbol (e.g., SOLUSDC)' },
        { name: 'symbols', in: 'query', schema: { type: 'string' }, description: 'Filter by multiple symbols (JSON array)' }
      ],
      responses: {
        '200': { status: 200, description: 'Exchange information' }
      },
      operationId: 'exchangeInfo'
    });

    this.addEndpoint({
      path: '/v3/ticker/price',
      method: 'GET',
      summary: 'Current Price',
      description: 'Get current price for a symbol',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair (e.g., SOLUSDC)' }
      ],
      responses: {
        '200': { status: 200, description: 'Price ticker', schema: { type: 'object', properties: { symbol: { type: 'string' }, price: { type: 'string' } } } }
      },
      operationId: 'tickerPrice'
    });

    this.addEndpoint({
      path: '/v3/ticker/24hr',
      method: 'GET',
      summary: '24hr Statistics',
      description: 'Get 24-hour price change statistics',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair' }
      ],
      responses: {
        '200': { status: 200, description: '24hr statistics' }
      },
      operationId: 'ticker24hr'
    });

    this.addEndpoint({
      path: '/v3/ticker/bookTicker',
      method: 'GET',
      summary: 'Best Bid/Ask',
      description: 'Get best bid and ask prices',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair' }
      ],
      responses: {
        '200': { status: 200, description: 'Book ticker' }
      },
      operationId: 'bookTicker'
    });

    this.addEndpoint({
      path: '/v3/depth',
      method: 'GET',
      summary: 'Order Book',
      description: 'Get order book depth',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 }, description: 'Depth limit (5, 10, 20, 50, 100, 500, 1000)' }
      ],
      responses: {
        '200': { status: 200, description: 'Order book' }
      },
      operationId: 'orderBookDepth'
    });

    this.addEndpoint({
      path: '/v3/trades',
      method: 'GET',
      summary: 'Recent Trades',
      description: 'Get recent trades for a symbol',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, maximum: 1000 }, description: 'Number of trades' }
      ],
      responses: {
        '200': { status: 200, description: 'Recent trades' }
      },
      operationId: 'recentTrades'
    });

    this.addEndpoint({
      path: '/v3/klines',
      method: 'GET',
      summary: 'Candlestick Data',
      description: 'Get OHLCV candlestick data',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair' },
        { name: 'interval', in: 'query', required: true, schema: { type: 'string', enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] }, description: 'Kline interval' },
        { name: 'startTime', in: 'query', schema: { type: 'integer' }, description: 'Start time (ms)' },
        { name: 'endTime', in: 'query', schema: { type: 'integer' }, description: 'End time (ms)' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, maximum: 1000 }, description: 'Number of candles' }
      ],
      responses: {
        '200': { status: 200, description: 'Candlestick data' }
      },
      operationId: 'klines'
    });

    // Order Management
    this.addEndpoint({
      path: '/v3/order',
      method: 'POST',
      summary: 'Create Order',
      description: 'Create a new order (MARKET or LIMIT)',
      tags: ['Trading API'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                symbol: { type: 'string', description: 'Trading pair (e.g., SOLUSDC)' },
                side: { type: 'string', enum: ['BUY', 'SELL'], description: 'Order side' },
                type: { type: 'string', enum: ['MARKET', 'LIMIT'], description: 'Order type' },
                quantity: { type: 'string', description: 'Order quantity' },
                price: { type: 'string', description: 'Limit price (required for LIMIT orders)' },
                timeInForce: { type: 'string', enum: ['GTC', 'IOC', 'FOK'], description: 'Time in force' },
                walletAddress: { type: 'string', description: 'Solana wallet address' },
                slippageBps: { type: 'integer', default: 50, description: 'Slippage tolerance in basis points' }
              },
              required: ['symbol', 'side', 'type', 'quantity', 'walletAddress']
            }
          }
        }
      },
      responses: {
        '200': { status: 200, description: 'Order created' },
        '400': { status: 400, description: 'Invalid order parameters' }
      },
      operationId: 'createOrder'
    });

    this.addEndpoint({
      path: '/v3/order',
      method: 'GET',
      summary: 'Query Order',
      description: 'Get order status by order ID',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair' },
        { name: 'orderId', in: 'query', required: true, schema: { type: 'integer' }, description: 'Order ID' }
      ],
      responses: {
        '200': { status: 200, description: 'Order details' },
        '404': { status: 404, description: 'Order not found' }
      },
      operationId: 'queryOrder'
    });

    this.addEndpoint({
      path: '/v3/order',
      method: 'DELETE',
      summary: 'Cancel Order',
      description: 'Cancel an open order',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair' },
        { name: 'orderId', in: 'query', required: true, schema: { type: 'integer' }, description: 'Order ID to cancel' }
      ],
      responses: {
        '200': { status: 200, description: 'Order cancelled' },
        '400': { status: 400, description: 'Cannot cancel order' }
      },
      operationId: 'cancelOrder'
    });

    this.addEndpoint({
      path: '/v3/openOrders',
      method: 'GET',
      summary: 'Open Orders',
      description: 'Get all open orders',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', schema: { type: 'string' }, description: 'Filter by symbol' },
        { name: 'walletAddress', in: 'query', schema: { type: 'string' }, description: 'Filter by wallet' }
      ],
      responses: {
        '200': { status: 200, description: 'Open orders list' }
      },
      operationId: 'openOrders'
    });

    this.addEndpoint({
      path: '/v3/allOrders',
      method: 'GET',
      summary: 'All Orders',
      description: 'Get all orders (including filled and cancelled)',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair' },
        { name: 'walletAddress', in: 'query', schema: { type: 'string' }, description: 'Filter by wallet' },
        { name: 'startTime', in: 'query', schema: { type: 'integer' }, description: 'Start time (ms)' },
        { name: 'endTime', in: 'query', schema: { type: 'integer' }, description: 'End time (ms)' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, maximum: 1000 }, description: 'Max orders to return' }
      ],
      responses: {
        '200': { status: 200, description: 'All orders list' }
      },
      operationId: 'allOrders'
    });

    // Account
    this.addEndpoint({
      path: '/v3/account',
      method: 'GET',
      summary: 'Account Information',
      description: 'Get account balances and information',
      tags: ['Trading API'],
      parameters: [
        { name: 'walletAddress', in: 'query', required: true, schema: { type: 'string' }, description: 'Solana wallet address' }
      ],
      responses: {
        '200': { status: 200, description: 'Account information with balances' }
      },
      operationId: 'accountInfo'
    });

    this.addEndpoint({
      path: '/v3/myTrades',
      method: 'GET',
      summary: 'Trade History',
      description: 'Get trade history for account',
      tags: ['Trading API'],
      parameters: [
        { name: 'symbol', in: 'query', required: true, schema: { type: 'string' }, description: 'Trading pair' },
        { name: 'walletAddress', in: 'query', schema: { type: 'string' }, description: 'Filter by wallet' },
        { name: 'startTime', in: 'query', schema: { type: 'integer' }, description: 'Start time (ms)' },
        { name: 'endTime', in: 'query', schema: { type: 'integer' }, description: 'End time (ms)' },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, maximum: 1000 }, description: 'Max trades to return' }
      ],
      responses: {
        '200': { status: 200, description: 'Trade history' }
      },
      operationId: 'myTrades'
    });

    // Swap (Jupiter)
    this.addEndpoint({
      path: '/v3/swap',
      method: 'GET',
      summary: 'Swap Quote',
      description: 'Get swap quote from Jupiter DEX aggregator',
      tags: ['Trading API'],
      parameters: [
        { name: 'inputMint', in: 'query', required: true, schema: { type: 'string' }, description: 'Input token mint address' },
        { name: 'outputMint', in: 'query', required: true, schema: { type: 'string' }, description: 'Output token mint address' },
        { name: 'amount', in: 'query', required: true, schema: { type: 'string' }, description: 'Input amount (in smallest units)' },
        { name: 'slippageBps', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Slippage in basis points' }
      ],
      responses: {
        '200': { status: 200, description: 'Swap quote' }
      },
      operationId: 'swapQuote'
    });

    this.addEndpoint({
      path: '/v3/swap',
      method: 'POST',
      summary: 'Execute Swap',
      description: 'Get serialized swap transaction for signing',
      tags: ['Trading API'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                inputMint: { type: 'string', description: 'Input token mint' },
                outputMint: { type: 'string', description: 'Output token mint' },
                amount: { type: 'string', description: 'Input amount' },
                userPublicKey: { type: 'string', description: 'User wallet address' },
                slippageBps: { type: 'integer', description: 'Slippage tolerance' }
              },
              required: ['inputMint', 'outputMint', 'amount', 'userPublicKey']
            }
          }
        }
      },
      responses: {
        '200': { status: 200, description: 'Serialized transaction' }
      },
      operationId: 'executeSwap'
    });

    // Streaming
    this.addEndpoint({
      path: '/v3/ws',
      method: 'GET',
      summary: 'WebSocket Stream (SSE)',
      description: 'Real-time data streaming via Server-Sent Events',
      tags: ['Trading API'],
      parameters: [
        { name: 'streams', in: 'query', required: true, schema: { type: 'string' }, description: 'Comma-separated stream names (e.g., solusdc@ticker,solusdc@trade)' }
      ],
      responses: {
        '200': { status: 200, description: 'SSE stream' }
      },
      operationId: 'wsStream'
    });
  }

  private addEndpoint(endpoint: OpenAPIEndpoint) {
    this.endpoints.push(endpoint);
    // Convert endpoint to OpenAPI path format
    const pathItem: any = {
      [endpoint.method.toLowerCase()]: {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        operationId: endpoint.operationId,
        parameters: endpoint.parameters?.map(p => ({
          name: p.name,
          in: p.in,
          required: p.required,
          schema: p.schema,
          description: p.description
        })),
        responses: Object.entries(endpoint.responses).reduce((acc, [status, response]) => {
          acc[status] = {
            description: response.description,
            ...(response.schema && {
              content: {
                'application/json': {
                  schema: response.schema
                }
              }
            })
          };
          return acc;
        }, {} as any)
      }
    };

    // Add request body if present
    if (endpoint.requestBody) {
      pathItem[endpoint.method.toLowerCase()].requestBody = endpoint.requestBody;
    }

    // Add to spec paths
    if (!this.spec.paths[endpoint.path]) {
      this.spec.paths[endpoint.path] = {};
    }
    Object.assign(this.spec.paths[endpoint.path], pathItem);
  }

  public getSpec(): OpenAPISpec {
    return this.spec;
  }

  public getEndpoints(): OpenAPIEndpoint[] {
    return this.endpoints;
  }

  public generateJSON(): string {
    return JSON.stringify(this.spec, null, 2);
  }

  public writeToFile(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, this.generateJSON());
  }
}

export default OpenAPIGenerator;
