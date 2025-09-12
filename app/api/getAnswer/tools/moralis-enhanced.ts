// Moralis API tool for enhanced account analysis with portfolio data, NFTs, and transaction history
// Comprehensive financial analytics including PnL, fees, volume, and trading patterns

import { z } from 'zod';
import { ToolDefinition } from '../types';

// Enhanced Moralis API tools for advanced financial analytics
export const moralisAdvancedAnalyticsTool: ToolDefinition = {
    name: 'getMoralisAdvancedAnalytics',
    description: 'Get comprehensive financial analytics including PnL for each position, fees paid, top inflow/outflow analysis, top 10 transactions by volume and value in USD',
    inputSchema: z.string().describe('Solana address to analyze for advanced financial metrics'),
    execute: async (address: string) => {
        return { tool: 'getMoralisAdvancedAnalytics', input: address };
    }
};

export const moralisPnlAnalysisTool: ToolDefinition = {
    name: 'getMoralisPnlAnalysis',
    description: 'Calculate profit/loss for each token position based on buy/sell transactions, including unrealized gains on current holdings',
    inputSchema: z.string().describe('Solana address to calculate PnL for'),
    execute: async (address: string) => {
        return { tool: 'getMoralisPnlAnalysis', input: address };
    }
};

export const moralisFeesAnalysisTool: ToolDefinition = {
    name: 'getMoralisFeesAnalysis',
    description: 'Analyze total fees paid across all transactions, including swap fees, transaction fees, and network costs',
    inputSchema: z.string().describe('Solana address to analyze fees for'),
    execute: async (address: string) => {
        return { tool: 'getMoralisFeesAnalysis', input: address };
    }
};

export const moralisInflowOutflowTool: ToolDefinition = {
    name: 'getMoralisInflowOutflow',
    description: 'Analyze top inflows and outflows of funds, identifying largest deposits and withdrawals by value and frequency',
    inputSchema: z.string().describe('Solana address to analyze fund flows for'),
    execute: async (address: string) => {
        return { tool: 'getMoralisInflowOutflow', input: address };
    }
};

export const moralisVolumeAnalysisTool: ToolDefinition = {
    name: 'getMoralisVolumeAnalysis',
    description: 'Get top 10 tokens by trading volume and top 10 individual transactions by USD value',
    inputSchema: z.string().describe('Solana address to analyze trading volume for'),
    execute: async (address: string) => {
        return { tool: 'getMoralisVolumeAnalysis', input: address };
    }
};

export const moralisPortfolioTool: ToolDefinition = {
    name: 'getMoralisPortfolio',
    description: 'Get comprehensive portfolio including native SOL and all token holdings with USD values using Moralis API',
    inputSchema: z.string().describe('Solana address to analyze'),
    execute: async (address: string) => {
        return { tool: 'getMoralisPortfolio', input: address };
    }
};

export const moralisTokenBalancesTool: ToolDefinition = {
    name: 'getMoralisTokenBalances',
    description: 'Get detailed SPL token balances with metadata, prices, and USD values using Moralis API',
    inputSchema: z.string().describe('Solana address to get token balances for'),
    execute: async (address: string) => {
        return { tool: 'getMoralisTokenBalances', input: address };
    }
};

export const moralisNFTsTool: ToolDefinition = {
    name: 'getMoralisNFTs',
    description: 'Get NFT holdings with metadata, collections, and valuations using Moralis API',
    inputSchema: z.string().describe('Solana address to get NFTs for'),
    execute: async (address: string) => {
        return { tool: 'getMoralisNFTs', input: address };
    }
};

export const moralisSwapHistoryTool: ToolDefinition = {
    name: 'getMoralisSwapHistory',
    description: 'Get recent swap transactions and DeFi activity patterns using Moralis API',
    inputSchema: z.string().describe('Solana address to get swap history for'),
    execute: async (address: string) => {
        return { tool: 'getMoralisSwapHistory', input: address };
    }
};

export const moralisTransactionHistoryTool: ToolDefinition = {
    name: 'getMoralisTransactionHistory',
    description: 'Get comprehensive transaction history with enhanced metadata using Moralis API',
    inputSchema: z.string().describe('Solana address to get transaction history for'),
    execute: async (address: string) => {
        return { tool: 'getMoralisTransactionHistory', input: address };
    }
};

// Reference to Moralis API Swagger Documentation 
export const moralis_swagger = `
"swaggerDoc": {
    "openapi": "3.0.0",
    "info": {
      "title": "Moralis Solana API",
      "version": "1.0"
    },
    "servers": [
      {
        "url": "https://solana-gateway.moralis.io"
      }
    ],
    "paths": {
      "/token/{network}/{address}/pairs/stats": {
        "get": {
          "description": "Get aggregated statistics across supported pairs of a token.",
          "operationId": "getAggregatedTokenPairStats",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/SupportedPairStatsResponse"
                  }
                }
              }
            }
          },
          "summary": "Get aggregated token pair statistics by address",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/account/{network}/{address}/swaps": {
        "get": {
          "description": "Get all swap related transactions (buy, sell) for a specific wallet address.",
          "operationId": "getSwapsByWalletAddress",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "kXB7FfzdrfZpAZEW3TZcp8a8CwQbsowa6BdfAHZ4gVs",
                "type": "string"
              }
            },
            {
              "name": "limit",
              "required": false,
              "in": "query",
              "description": "The limit per page",
              "schema": {
                "minimum": 1,
                "maximum": 100,
                "default": 100,
                "type": "number"
              }
            },
            {
              "name": "cursor",
              "required": false,
              "in": "query",
              "description": "The cursor to the next page",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "order",
              "required": false,
              "in": "query",
              "description": "The order of items",
              "schema": {
                "default": "DESC",
                "enum": [
                  "ASC",
                  "DESC"
                ],
                "type": "string"
              }
            },
            {
              "name": "fromDate",
              "required": false,
              "in": "query",
              "description": "The starting date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "toDate",
              "required": false,
              "in": "query",
              "description": "The ending date (format in seconds or datestring accepted by momentjs)",
              "schema": {
                "type": "string"
              }
            },
            {
              "name": "transactionTypes",
              "required": false,
              "in": "query",
              "description": "Transaction types to fetch. Possible values: 'buy','sell' or both separated by comma",
              "schema": {
                "default": "buy,sell",
                "example": "buy,sell",
                "type": "string"
              }
            },
            {
              "name": "tokenAddress",
              "required": false,
              "in": "query",
              "description": "Token address to get transactions for",
              "schema": {
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/GetSwapsByWalletAddressResponseDto"
                  }
                }
              }
            }
          },
          "summary": "Get all swap related transactions (buy, sell) for a specific wallet address.",
          "tags": [
            "Account"
          ],
          "x-tag-sdk": "account",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/account/{network}/{address}/portfolio": {
        "get": {
          "description": "Gets all the native and token balances of the given address",
          "operationId": "getPortfolio",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "kXB7FfzdrfZpAZEW3TZcp8a8CwQbsowa6BdfAHZ4gVs",
                "type": "string"
              }
            },
            {
              "name": "nftMetadata",
              "required": false,
              "in": "query",
              "description": "Should return the full NFT metadata",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            },
            {
              "name": "mediaItems",
              "required": false,
              "in": "query",
              "description": "Should return media items",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            },
            {
              "name": "excludeSpam",
              "required": false,
              "in": "query",
              "description": "Should exclude spam NFTs",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/Portfolio"
                  }
                }
              }
            }
          },
          "summary": "Gets the portfolio of the given address",
          "tags": [
            "Account"
          ],
          "x-tag-sdk": "account",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/account/{network}/{address}/tokens": {
        "get": {
          "description": "Gets token balances owned by the given address",
          "operationId": "getSPL",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "kXB7FfzdrfZpAZEW3TZcp8a8CwQbsowa6BdfAHZ4gVs",
                "type": "string"
              }
            },
            {
              "name": "excludeSpam",
              "required": false,
              "in": "query",
              "description": "Should exclude spam tokens",
              "schema": {
                "default": false,
                "type": "boolean"
              }
            }
          ],
          "responses": {
            "200": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "type": "array",
                    "items": {
                      "$ref": "#/components/schemas/SPLTokenBalance"
                    }
                  }
                }
              }
            }
          },
          "summary": "Gets token balances owned by the given address",
          "tags": [
            "Account"
          ],
          "x-tag-sdk": "account",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      },
      "/token/{network}/{address}/price": {
        "get": {
          "description": "Gets the token price (usd and native) for a given contract address and network.",
          "operationId": "getTokenPrice",
          "parameters": [
            {
              "name": "network",
              "required": true,
              "in": "path",
              "description": "The network to query",
              "schema": {
                "enum": [
                  "mainnet",
                  "devnet"
                ],
                "type": "string"
              }
            },
            {
              "name": "address",
              "required": true,
              "in": "path",
              "description": "The address to query",
              "schema": {
                "example": "So11111111111111111111111111111111111111112",
                "type": "string"
              }
            }
          ],
          "responses": {
            "200": {
              "description": ""
            },
            "default": {
              "description": "",
              "content": {
                "application/json": {
                  "schema": {
                    "$ref": "#/components/schemas/SPLTokenPrice"
                  }
                }
              }
            }
          },
          "summary": "Get token price",
          "tags": [
            "Token"
          ],
          "x-tag-sdk": "token",
          "security": [
            {
              "ApiKeyAuth": []
            }
          ]
        }
      }
    }
  }
}
`;
