/**
 * API Response Schemas
 * Defines the exact response structure for each API endpoint
 */

export type SchemaFieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'object' 
  | 'array' 
  | 'null'
  | 'bigint'
  | 'any';

export interface SchemaField {
  type: SchemaFieldType;
  description: string;
  optional?: boolean;
  example?: any;
  // For objects, define nested fields
  fields?: Record<string, SchemaField>;
  // For arrays, define item type
  items?: SchemaField;
  // For union types
  oneOf?: SchemaField[];
}

export interface ResponseSchema {
  [fieldName: string]: SchemaField;
}

export interface ApiResponseSchema {
  success?: ResponseSchema;
  error?: ResponseSchema;
}

// Token endpoint schema
const tokenResponseSchema: ResponseSchema = {
  metadata: {
    type: 'object',
    description: 'Token metadata information',
    fields: {
      name: {
        type: 'string',
        description: 'Token name',
        example: 'OSVM.AI'
      },
      symbol: {
        type: 'string',
        description: 'Token symbol',
        example: 'OVSM'
      },
      uri: {
        type: 'string',
        description: 'Metadata URI',
        example: 'https://ipfs.io/ipfs/...'
      },
      description: {
        type: 'string',
        description: 'Token description',
        example: 'OSVM.AI at pvv4fu1...'
      }
    }
  },
  supply: {
    type: 'number',
    description: 'Total token supply (raw amount)',
    example: 999859804306166700
  },
  decimals: {
    type: 'number',
    description: 'Number of decimal places',
    example: 9
  },
  holders: {
    type: 'number',
    description: 'Number of holders from Birdeye API',
    example: 953
  },
  totalHolders: {
    type: 'number',
    description: 'Exact on-chain holder count from getProgramAccounts',
    optional: true,
    example: 951
  },
  volume24h: {
    type: 'number',
    description: '24-hour trading volume in USD',
    example: 154246.03
  },
  price: {
    type: 'number',
    description: 'Current token price in USD',
    optional: true,
    example: 0.001097
  },
  liquidity: {
    type: 'number',
    description: 'Total liquidity in USD',
    optional: true,
    example: 141275.71
  },
  priceChange24h: {
    type: 'number',
    description: '24-hour price change percentage',
    optional: true,
    example: 31.44
  },
  top10Balance: {
    type: 'number',
    description: 'Balance of the 10th largest holder',
    optional: true,
    example: 16422985.50
  },
  top50Balance: {
    type: 'number',
    description: 'Balance of the 50th largest holder',
    optional: true,
    example: 5094760.09
  },
  top100Balance: {
    type: 'number',
    description: 'Balance of the 100th largest holder',
    optional: true,
    example: 2227241.35
  },
  isInitialized: {
    type: 'boolean',
    description: 'Whether the token mint is initialized',
    example: true
  },
  freezeAuthority: {
    type: 'string',
    description: 'Public key of freeze authority',
    optional: true,
    example: null
  },
  mintAuthority: {
    type: 'string',
    description: 'Public key of mint authority',
    optional: true,
    example: null
  }
};

// Transaction endpoint schema
const transactionResponseSchema: ResponseSchema = {
  signature: {
    type: 'string',
    description: 'Transaction signature',
    example: '5vYsYWPF4gdN1imxLpJAWi9QKpN3MSrFTFXK8pfmPogFjQNPiAkxFQCGzEEWNto16mWnwmdwNQH7KPCnkMcZ9Ba5'
  },
  slot: {
    type: 'number',
    description: 'Slot number',
    example: 284943627
  },
  blockTime: {
    type: 'number',
    description: 'Unix timestamp',
    optional: true,
    example: 1742636107
  },
  fee: {
    type: 'number',
    description: 'Transaction fee in lamports',
    example: 5000
  },
  status: {
    type: 'object',
    description: 'Transaction status',
    fields: {
      Ok: {
        type: 'null',
        description: 'Success status (null if successful)',
        optional: true,
        example: null
      },
      Err: {
        type: 'object',
        description: 'Error details if failed',
        optional: true
      }
    }
  },
  instructions: {
    type: 'array',
    description: 'List of instructions',
    items: {
      type: 'object',
      description: 'Transaction instruction',
      fields: {
        programId: {
          type: 'string',
          description: 'Program ID',
          example: '11111111111111111111111111111111'
        },
        accounts: {
          type: 'array',
          description: 'Account keys involved',
          items: {
            type: 'string',
            description: 'Account public key',
            example: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck'
          }
        },
        data: {
          type: 'string',
          description: 'Base58-encoded instruction data',
          example: '3Bxs4h24kvAd...'
        }
      }
    }
  },
  accountKeys: {
    type: 'array',
    description: 'All account keys in transaction',
    items: {
      type: 'string',
      description: 'Account public key',
      example: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck'
    }
  }
};

// Wallet endpoint schema
const walletResponseSchema: ResponseSchema = {
  address: {
    type: 'string',
    description: 'Wallet address',
    example: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck'
  },
  balance: {
    type: 'number',
    description: 'SOL balance in lamports',
    example: 1500000000
  },
  solBalance: {
    type: 'number',
    description: 'SOL balance in SOL (human-readable)',
    example: 1.5
  },
  tokens: {
    type: 'array',
    description: 'Token holdings',
    items: {
      type: 'object',
      description: 'Token holding',
      fields: {
        mint: {
          type: 'string',
          description: 'Token mint address',
          example: 'So11111111111111111111111111111111111111112'
        },
        amount: {
          type: 'string',
          description: 'Token amount (raw)',
          example: '1000000000'
        },
        decimals: {
          type: 'number',
          description: 'Token decimals',
          example: 9
        },
        uiAmount: {
          type: 'number',
          description: 'Token amount (human-readable)',
          example: 1.0
        }
      }
    }
  },
  transactionCount: {
    type: 'number',
    description: 'Total number of transactions',
    example: 143
  }
};

// Block endpoint schema
const blockResponseSchema: ResponseSchema = {
  blockhash: {
    type: 'string',
    description: 'Block hash',
    example: 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N'
  },
  previousBlockhash: {
    type: 'string',
    description: 'Previous block hash',
    example: 'C7qA7Lnhde5bCuJ1qCCHvfNvMWs3LQdEZmF7qMCaJT2b'
  },
  parentSlot: {
    type: 'number',
    description: 'Parent slot number',
    example: 284943626
  },
  blockTime: {
    type: 'number',
    description: 'Unix timestamp',
    optional: true,
    example: 1742636107
  },
  blockHeight: {
    type: 'number',
    description: 'Block height',
    optional: true,
    example: 265382491
  },
  transactions: {
    type: 'array',
    description: 'Transactions in block',
    items: {
      type: 'object',
      description: 'Transaction with metadata',
      fields: {
        transaction: {
          type: 'object',
          description: 'Transaction data'
        },
        meta: {
          type: 'object',
          description: 'Transaction metadata'
        }
      }
    }
  },
  rewards: {
    type: 'array',
    description: 'Block rewards',
    optional: true,
    items: {
      type: 'object',
      description: 'Reward entry',
      fields: {
        pubkey: {
          type: 'string',
          description: 'Recipient public key',
          example: 'REVXui3vBCcsDHd7oUaiTNc885YiXT773yoD8DuFuck'
        },
        lamports: {
          type: 'number',
          description: 'Reward amount in lamports',
          example: 5000
        },
        rewardType: {
          type: 'string',
          description: 'Type of reward',
          example: 'fee'
        }
      }
    }
  }
};

// Market data endpoint schema
const marketDataResponseSchema: ResponseSchema = {
  success: {
    type: 'boolean',
    description: 'Request success status',
    example: true
  },
  endpoint: {
    type: 'string',
    description: 'API endpoint called',
    example: 'ohlcv'
  },
  mint: {
    type: 'string',
    description: 'Token mint address',
    example: 'pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS'
  },
  tokenInfo: {
    type: 'object',
    description: 'Token information from Birdeye',
    optional: true,
    fields: {
      symbol: {
        type: 'string',
        description: 'Token symbol',
        example: 'OVSM'
      },
      name: {
        type: 'string',
        description: 'Token name',
        example: 'OSVM.AI'
      },
      liquidity: {
        type: 'number',
        description: 'Total liquidity in USD',
        example: 141275.71
      },
      price: {
        type: 'number',
        description: 'Current price in USD',
        example: 0.001097
      },
      volume24h: {
        type: 'number',
        description: '24h trading volume in USD',
        example: 154246.03
      }
    }
  },
  pools: {
    type: 'array',
    description: 'DEX pools for this token',
    items: {
      type: 'object',
      description: 'Pool information',
      fields: {
        poolAddress: {
          type: 'string',
          description: 'Pool address',
          example: '8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj'
        },
        dex: {
          type: 'string',
          description: 'DEX name',
          example: 'Raydium'
        },
        pair: {
          type: 'string',
          description: 'Trading pair',
          example: 'OVSM/SOL'
        },
        liquidity: {
          type: 'number',
          description: 'Pool liquidity in USD',
          example: 75000.50
        },
        volume24h: {
          type: 'number',
          description: '24h volume in USD',
          example: 50000.25
        }
      }
    }
  },
  data: {
    type: 'object',
    description: 'OHLCV data',
    fields: {
      items: {
        type: 'array',
        description: 'Price candles',
        items: {
          type: 'object',
          description: 'OHLCV candle',
          fields: {
            time: {
              type: 'number',
              description: 'Unix timestamp',
              example: 1742636107
            },
            open: {
              type: 'number',
              description: 'Open price',
              example: 0.00109
            },
            high: {
              type: 'number',
              description: 'High price',
              example: 0.00112
            },
            low: {
              type: 'number',
              description: 'Low price',
              example: 0.00108
            },
            close: {
              type: 'number',
              description: 'Close price',
              example: 0.00110
            },
            volume: {
              type: 'number',
              description: 'Volume',
              example: 15000
            }
          }
        }
      }
    }
  }
};

// Analytics endpoint schemas
const analyticsBotsResponseSchema: ResponseSchema = {
  total: {
    type: 'number',
    description: 'Total number of bots',
    example: 42
  },
  bots: {
    type: 'array',
    description: 'List of trading/analytics bots',
    items: {
      type: 'object',
      description: 'Bot information',
      fields: {
        name: {
          type: 'string',
          description: 'Bot name',
          example: 'Birdeye Bot'
        },
        category: {
          type: 'string',
          description: 'Bot category',
          example: 'Analytics'
        },
        description: {
          type: 'string',
          description: 'Bot description',
          example: 'Real-time token analytics and alerts'
        },
        website: {
          type: 'string',
          description: 'Bot website/link',
          example: 'https://t.me/BirdeyeBot'
        },
        features: {
          type: 'array',
          description: 'Bot features',
          items: {
            type: 'string',
            description: 'Feature name',
            example: 'Price alerts'
          }
        },
        rating: {
          type: 'number',
          description: 'User rating (1-5)',
          example: 4.5
        }
      }
    }
  }
};

// Error response schema
const errorResponseSchema: ResponseSchema = {
  error: {
    type: 'string',
    description: 'Error message',
    example: 'Invalid address format'
  },
  message: {
    type: 'string',
    description: 'Detailed error message',
    optional: true,
    example: 'The provided address is not a valid Solana public key'
  },
  status: {
    type: 'number',
    description: 'HTTP status code',
    optional: true,
    example: 400
  }
};

// Export schema map for all endpoints
export const apiResponseSchemas: Record<string, ApiResponseSchema> = {
  '/api/token/{address}': {
    success: tokenResponseSchema,
    error: errorResponseSchema
  },
  '/api/transaction/{signature}': {
    success: transactionResponseSchema,
    error: errorResponseSchema
  },
  '/api/wallet/{address}': {
    success: walletResponseSchema,
    error: errorResponseSchema
  },
  '/api/block/{slot}': {
    success: blockResponseSchema,
    error: errorResponseSchema
  },
  '/api/market-data': {
    success: marketDataResponseSchema,
    error: errorResponseSchema
  },
  '/api/analytics/bots': {
    success: analyticsBotsResponseSchema,
    error: errorResponseSchema
  }
};

// Helper function to get schema for endpoint
export function getSchemaForEndpoint(endpoint: string): ApiResponseSchema | null {
  // Try exact match first
  if (apiResponseSchemas[endpoint]) {
    return apiResponseSchemas[endpoint];
  }
  
  // Try pattern matching for dynamic routes
  for (const [pattern, schema] of Object.entries(apiResponseSchemas)) {
    const regexPattern = pattern.replace(/\{[^}]+\}/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(endpoint)) {
      return schema;
    }
  }
  
  return null;
}
