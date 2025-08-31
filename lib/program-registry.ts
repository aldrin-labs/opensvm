/**
 * Comprehensive Program Registry Database
 * 
 * Centralized registry of Solana programs with their instruction definitions,
 * metadata, documentation links, and categorization. This comprehensive
 * database supports the transaction explorer enhancements by providing
 * detailed program information for instruction parsing and analysis.
 */

import type { ProgramDefinition } from './instruction-parser-service';

/**
 * Core Solana programs that are part of the runtime
 */
export const CORE_PROGRAMS: ProgramDefinition[] = [
  {
    programId: '11111111111111111111111111111111',
    name: 'System Program',
    description: 'Core Solana system program for account management',
    category: 'system',
    website: 'https://docs.solana.com/developing/runtime-facilities/programs#system-program',
    instructions: [
      {
        discriminator: '00000000',
        name: 'createAccount',
        description: 'Create a new account',
        category: 'account',
        riskLevel: 'low',
        accounts: [
          { name: 'funding', description: 'Funding account', isSigner: true, isWritable: true, role: 'payer' },
          { name: 'new', description: 'New account', isSigner: true, isWritable: true, role: 'recipient' }
        ],
        parameters: [
          { name: 'lamports', type: 'number', description: 'Lamports to fund the account' },
          { name: 'space', type: 'number', description: 'Space to allocate' },
          { name: 'owner', type: 'address', description: 'Owner program' }
        ]
      },
      {
        discriminator: '00000002',
        name: 'transfer',
        description: 'Transfer SOL between accounts',
        category: 'transfer',
        riskLevel: 'low',
        accounts: [
          { name: 'from', description: 'Source account', isSigner: true, isWritable: true, role: 'payer' },
          { name: 'to', description: 'Destination account', isSigner: false, isWritable: true, role: 'recipient' }
        ],
        parameters: [
          { name: 'lamports', type: 'number', description: 'Lamports to transfer' }
        ]
      }
    ]
  },
  {
    programId: 'Vote111111111111111111111111111111111111111',
    name: 'Vote Program',
    description: 'Solana vote program for validator consensus',
    category: 'system',
    website: 'https://docs.solana.com/developing/runtime-facilities/programs#vote-program',
    instructions: [
      {
        discriminator: '00',
        name: 'initializeAccount',
        description: 'Initialize vote account',
        category: 'account',
        riskLevel: 'medium',
        accounts: [
          { name: 'voteAccount', description: 'Vote account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'rent', description: 'Rent sysvar', isSigner: false, isWritable: false, role: 'system' },
          { name: 'clock', description: 'Clock sysvar', isSigner: false, isWritable: false, role: 'system' },
          { name: 'node', description: 'Validator identity', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: []
      }
    ]
  },
  {
    programId: 'Stake11111111111111111111111111111111111111',
    name: 'Stake Program',
    description: 'Solana stake program for validator staking',
    category: 'system',
    website: 'https://docs.solana.com/developing/runtime-facilities/programs#stake-program',
    instructions: [
      {
        discriminator: '00',
        name: 'initialize',
        description: 'Initialize stake account',
        category: 'account',
        riskLevel: 'medium',
        accounts: [
          { name: 'stakeAccount', description: 'Stake account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'rent', description: 'Rent sysvar', isSigner: false, isWritable: false, role: 'system' }
        ],
        parameters: []
      },
      {
        discriminator: '02',
        name: 'delegate',
        description: 'Delegate stake to validator',
        category: 'delegation',
        riskLevel: 'medium',
        accounts: [
          { name: 'stakeAccount', description: 'Stake account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'voteAccount', description: 'Vote account', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'clock', description: 'Clock sysvar', isSigner: false, isWritable: false, role: 'system' },
          { name: 'stakeHistory', description: 'Stake history sysvar', isSigner: false, isWritable: false, role: 'system' },
          { name: 'stakeConfig', description: 'Stake config', isSigner: false, isWritable: false, role: 'system' },
          { name: 'stakeAuthority', description: 'Stake authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: []
      }
    ]
  }
];

/**
 * SPL (Solana Program Library) programs
 */
export const SPL_PROGRAMS: ProgramDefinition[] = [
  {
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    name: 'SPL Token',
    description: 'Solana Program Library Token program for fungible and non-fungible tokens',
    category: 'token',
    website: 'https://spl.solana.com/token',
    documentation: 'https://docs.rs/spl-token/',
    instructions: [
      {
        discriminator: '00',
        name: 'initializeMint',
        description: 'Initialize a new token mint',
        category: 'mint',
        riskLevel: 'medium',
        accounts: [
          { name: 'mint', description: 'Token mint account', isSigner: false, isWritable: true, role: 'mint' },
          { name: 'rent', description: 'Rent sysvar', isSigner: false, isWritable: false, role: 'system' }
        ],
        parameters: [
          { name: 'decimals', type: 'number', description: 'Number of decimals' },
          { name: 'mintAuthority', type: 'address', description: 'Mint authority' },
          { name: 'freezeAuthority', type: 'address', description: 'Freeze authority (optional)', optional: true }
        ]
      },
      {
        discriminator: '01',
        name: 'initializeAccount',
        description: 'Initialize a token account',
        category: 'account',
        riskLevel: 'low',
        accounts: [
          { name: 'account', description: 'Token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'owner', description: 'Account owner', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'rent', description: 'Rent sysvar', isSigner: false, isWritable: false, role: 'system' }
        ],
        parameters: []
      },
      {
        discriminator: '03',
        name: 'transfer',
        description: 'Transfer tokens between accounts',
        category: 'transfer',
        riskLevel: 'low',
        accounts: [
          { name: 'source', description: 'Source token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'destination', description: 'Destination token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'authority', description: 'Transfer authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount to transfer' }
        ]
      },
      {
        discriminator: '04',
        name: 'approve',
        description: 'Approve a delegate to transfer tokens',
        category: 'approval',
        riskLevel: 'medium',
        accounts: [
          { name: 'source', description: 'Source token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'delegate', description: 'Delegate account', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'owner', description: 'Account owner', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount to approve' }
        ]
      },
      {
        discriminator: '05',
        name: 'revoke',
        description: 'Revoke delegate authority',
        category: 'approval',
        riskLevel: 'low',
        accounts: [
          { name: 'source', description: 'Source token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'owner', description: 'Account owner', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: []
      },
      {
        discriminator: '07',
        name: 'mintTo',
        description: 'Mint tokens to an account',
        category: 'mint',
        riskLevel: 'medium',
        accounts: [
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: true, role: 'mint' },
          { name: 'destination', description: 'Destination token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'authority', description: 'Mint authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount to mint' }
        ]
      },
      {
        discriminator: '08',
        name: 'burn',
        description: 'Burn tokens from an account',
        category: 'burn',
        riskLevel: 'medium',
        accounts: [
          { name: 'account', description: 'Token account to burn from', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: true, role: 'mint' },
          { name: 'authority', description: 'Burn authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount to burn' }
        ]
      },
      {
        discriminator: '09',
        name: 'closeAccount',
        description: 'Close a token account',
        category: 'account',
        riskLevel: 'medium',
        accounts: [
          { name: 'account', description: 'Token account to close', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'destination', description: 'Destination for remaining lamports', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'owner', description: 'Account owner', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: []
      },
      {
        discriminator: '0A',
        name: 'freezeAccount',
        description: 'Freeze a token account',
        category: 'freeze',
        riskLevel: 'high',
        accounts: [
          { name: 'account', description: 'Token account to freeze', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'authority', description: 'Freeze authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: []
      },
      {
        discriminator: '0B',
        name: 'thawAccount',
        description: 'Thaw a frozen token account',
        category: 'freeze',
        riskLevel: 'medium',
        accounts: [
          { name: 'account', description: 'Token account to thaw', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'authority', description: 'Freeze authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: []
      },
      {
        discriminator: '0C',
        name: 'transferChecked',
        description: 'Transfer tokens with additional checks',
        category: 'transfer',
        riskLevel: 'low',
        accounts: [
          { name: 'source', description: 'Source token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'destination', description: 'Destination token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'authority', description: 'Transfer authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount to transfer' },
          { name: 'decimals', type: 'number', description: 'Token decimals' }
        ]
      },
      {
        discriminator: '0D',
        name: 'approveChecked',
        description: 'Approve delegate with additional checks',
        category: 'approval',
        riskLevel: 'medium',
        accounts: [
          { name: 'source', description: 'Source token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'delegate', description: 'Delegate account', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'owner', description: 'Account owner', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount to approve' },
          { name: 'decimals', type: 'number', description: 'Token decimals' }
        ]
      },
      {
        discriminator: '0E',
        name: 'mintToChecked',
        description: 'Mint tokens with additional checks',
        category: 'mint',
        riskLevel: 'medium',
        accounts: [
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: true, role: 'mint' },
          { name: 'destination', description: 'Destination token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'authority', description: 'Mint authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount to mint' },
          { name: 'decimals', type: 'number', description: 'Token decimals' }
        ]
      },
      {
        discriminator: '0F',
        name: 'burnChecked',
        description: 'Burn tokens with additional checks',
        category: 'burn',
        riskLevel: 'medium',
        accounts: [
          { name: 'account', description: 'Token account to burn from', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: true, role: 'mint' },
          { name: 'authority', description: 'Burn authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount to burn' },
          { name: 'decimals', type: 'number', description: 'Token decimals' }
        ]
      }
    ]
  },
  {
    programId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    name: 'Associated Token Account',
    description: 'Program for creating associated token accounts',
    category: 'token',
    website: 'https://spl.solana.com/associated-token-account',
    documentation: 'https://docs.rs/spl-associated-token-account/',
    instructions: [
      {
        discriminator: '00',
        name: 'create',
        description: 'Create associated token account',
        category: 'account',
        riskLevel: 'low',
        accounts: [
          { name: 'payer', description: 'Funding account', isSigner: true, isWritable: true, role: 'payer' },
          { name: 'associatedAccount', description: 'Associated token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'owner', description: 'Wallet address', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'systemProgram', description: 'System program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' }
        ],
        parameters: []
      },
      {
        discriminator: '01',
        name: 'createIdempotent',
        description: 'Create associated token account (idempotent)',
        category: 'account',
        riskLevel: 'low',
        accounts: [
          { name: 'payer', description: 'Funding account', isSigner: true, isWritable: true, role: 'payer' },
          { name: 'associatedAccount', description: 'Associated token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'owner', description: 'Wallet address', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'systemProgram', description: 'System program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' }
        ],
        parameters: []
      }
    ]
  },
  {
    programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
    name: 'SPL Token 2022',
    description: 'Enhanced token program with additional features',
    category: 'token',
    website: 'https://spl.solana.com/token-2022',
    documentation: 'https://docs.rs/spl-token-2022/',
    instructions: [
      {
        discriminator: '00',
        name: 'initializeMint',
        description: 'Initialize a new token mint with extensions',
        category: 'mint',
        riskLevel: 'medium',
        accounts: [
          { name: 'mint', description: 'Token mint account', isSigner: false, isWritable: true, role: 'mint' }
        ],
        parameters: [
          { name: 'decimals', type: 'number', description: 'Number of decimals' },
          { name: 'mintAuthority', type: 'address', description: 'Mint authority' },
          { name: 'freezeAuthority', type: 'address', description: 'Freeze authority (optional)', optional: true }
        ]
      },
      {
        discriminator: '20',
        name: 'initializeMintCloseAuthority',
        description: 'Initialize mint close authority extension',
        category: 'mint',
        riskLevel: 'medium',
        accounts: [
          { name: 'mint', description: 'Token mint account', isSigner: false, isWritable: true, role: 'mint' }
        ],
        parameters: [
          { name: 'closeAuthority', type: 'address', description: 'Close authority', optional: true }
        ]
      },
      {
        discriminator: '21',
        name: 'initializeTransferFeeConfig',
        description: 'Initialize transfer fee configuration',
        category: 'mint',
        riskLevel: 'medium',
        accounts: [
          { name: 'mint', description: 'Token mint account', isSigner: false, isWritable: true, role: 'mint' }
        ],
        parameters: [
          { name: 'transferFeeConfigAuthority', type: 'address', description: 'Transfer fee config authority', optional: true },
          { name: 'withdrawWithheldAuthority', type: 'address', description: 'Withdraw withheld authority', optional: true },
          { name: 'transferFeeBasisPoints', type: 'number', description: 'Transfer fee in basis points' },
          { name: 'maximumFee', type: 'number', description: 'Maximum fee amount' }
        ]
      }
    ]
  }
];

/**
 * DeFi ecosystem programs
 */
export const DEFI_PROGRAMS: ProgramDefinition[] = [
  {
    programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    name: 'Jupiter Aggregator',
    description: 'DEX aggregator for optimal token swaps across multiple protocols',
    category: 'defi',
    website: 'https://jup.ag/',
    documentation: 'https://docs.jup.ag/',
    instructions: [
      {
        discriminator: 'E445A52E51CB9A1D',
        name: 'route',
        description: 'Execute token swap route',
        category: 'swap',
        riskLevel: 'medium',
        accounts: [
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'userTransferAuthority', description: 'User transfer authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'userSourceTokenAccount', description: 'User source token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'userDestinationTokenAccount', description: 'User destination token account', isSigner: false, isWritable: true, role: 'token_account' }
        ],
        parameters: [
          { name: 'routePlan', type: 'bytes', description: 'Swap route plan' },
          { name: 'inAmount', type: 'number', description: 'Input token amount' },
          { name: 'quotedOutAmount', type: 'number', description: 'Expected output amount' },
          { name: 'slippageBps', type: 'number', description: 'Slippage tolerance in basis points' }
        ]
      },
      {
        discriminator: 'A8E5A52E51CB9A1D',
        name: 'sharedAccountsRoute',
        description: 'Execute swap with shared accounts optimization',
        category: 'swap',
        riskLevel: 'medium',
        accounts: [
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'programAuthority', description: 'Program authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'userTransferAuthority', description: 'User transfer authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'id', type: 'number', description: 'Route ID' },
          { name: 'routePlan', type: 'bytes', description: 'Swap route plan' },
          { name: 'inAmount', type: 'number', description: 'Input token amount' },
          { name: 'quotedOutAmount', type: 'number', description: 'Expected output amount' },
          { name: 'slippageBps', type: 'number', description: 'Slippage tolerance in basis points' }
        ]
      }
    ]
  },
  {
    programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    name: 'Raydium AMM',
    description: 'Automated Market Maker for token swaps and liquidity provision',
    category: 'defi',
    website: 'https://raydium.io/',
    documentation: 'https://docs.raydium.io/',
    instructions: [
      {
        discriminator: '09',
        name: 'swap',
        description: 'Swap tokens in AMM pool',
        category: 'swap',
        riskLevel: 'medium',
        accounts: [
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'ammId', description: 'AMM pool ID', isSigner: false, isWritable: true, role: 'program' },
          { name: 'ammAuthority', description: 'AMM authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'ammOpenOrders', description: 'AMM open orders', isSigner: false, isWritable: true, role: 'program' },
          { name: 'poolCoinTokenAccount', description: 'Pool coin token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'poolPcTokenAccount', description: 'Pool PC token account', isSigner: false, isWritable: true, role: 'token_account' }
        ],
        parameters: [
          { name: 'amountIn', type: 'number', description: 'Input token amount' },
          { name: 'minimumAmountOut', type: 'number', description: 'Minimum output amount' }
        ]
      },
      {
        discriminator: '03',
        name: 'deposit',
        description: 'Add liquidity to AMM pool',
        category: 'liquidity',
        riskLevel: 'medium',
        accounts: [
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'ammId', description: 'AMM pool ID', isSigner: false, isWritable: true, role: 'program' },
          { name: 'ammAuthority', description: 'AMM authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'userOwner', description: 'User owner', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'maxCoinAmount', type: 'number', description: 'Maximum coin amount' },
          { name: 'maxPcAmount', type: 'number', description: 'Maximum PC amount' },
          { name: 'baseSide', type: 'number', description: 'Base side for calculation' }
        ]
      },
      {
        discriminator: '04',
        name: 'withdraw',
        description: 'Remove liquidity from AMM pool',
        category: 'liquidity',
        riskLevel: 'medium',
        accounts: [
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'ammId', description: 'AMM pool ID', isSigner: false, isWritable: true, role: 'program' },
          { name: 'ammAuthority', description: 'AMM authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'userOwner', description: 'User owner', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'LP token amount to withdraw' }
        ]
      }
    ]
  },
  {
    programId: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
    name: 'Whirlpool',
    description: 'Concentrated liquidity AMM by Orca with advanced features',
    category: 'defi',
    website: 'https://www.orca.so/',
    documentation: 'https://orca-so.gitbook.io/orca-developer-portal/',
    instructions: [
      {
        discriminator: 'f8c69e91e17587c8',
        name: 'swap',
        description: 'Swap tokens in concentrated liquidity pool',
        category: 'swap',
        riskLevel: 'medium',
        accounts: [
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'tokenAuthority', description: 'Token authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'whirlpool', description: 'Whirlpool account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'tokenOwnerAccountA', description: 'Token owner account A', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'tokenVaultA', description: 'Token vault A', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'tokenOwnerAccountB', description: 'Token owner account B', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'tokenVaultB', description: 'Token vault B', isSigner: false, isWritable: true, role: 'token_account' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Swap amount' },
          { name: 'otherAmountThreshold', type: 'number', description: 'Minimum output amount' },
          { name: 'sqrtPriceLimit', type: 'number', description: 'Price limit' },
          { name: 'amountSpecifiedIsInput', type: 'boolean', description: 'Whether amount is input' },
          { name: 'aToB', type: 'boolean', description: 'Swap direction' }
        ]
      },
      {
        discriminator: '3c18c3c4f7f73bfa',
        name: 'openPosition',
        description: 'Open a new liquidity position',
        category: 'liquidity',
        riskLevel: 'medium',
        accounts: [
          { name: 'funder', description: 'Funder account', isSigner: true, isWritable: true, role: 'payer' },
          { name: 'owner', description: 'Position owner', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'position', description: 'Position account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'positionMint', description: 'Position mint', isSigner: true, isWritable: true, role: 'mint' },
          { name: 'whirlpool', description: 'Whirlpool account', isSigner: false, isWritable: false, role: 'program' }
        ],
        parameters: [
          { name: 'bumps', type: 'bytes', description: 'PDA bumps' },
          { name: 'tickLowerIndex', type: 'number', description: 'Lower tick index' },
          { name: 'tickUpperIndex', type: 'number', description: 'Upper tick index' }
        ]
      },
      {
        discriminator: '2e6b8b9f4f7e4c8a',
        name: 'increaseLiquidity',
        description: 'Add liquidity to existing position',
        category: 'liquidity',
        riskLevel: 'medium',
        accounts: [
          { name: 'whirlpool', description: 'Whirlpool account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'positionAuthority', description: 'Position authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'position', description: 'Position account', isSigner: false, isWritable: true, role: 'recipient' }
        ],
        parameters: [
          { name: 'liquidityAmount', type: 'number', description: 'Liquidity amount to add' },
          { name: 'tokenMaxA', type: 'number', description: 'Maximum token A amount' },
          { name: 'tokenMaxB', type: 'number', description: 'Maximum token B amount' }
        ]
      }
    ]
  },
  {
    programId: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
    name: 'Serum DEX',
    description: 'Decentralized exchange with order book trading',
    category: 'defi',
    website: 'https://www.projectserum.com/',
    documentation: 'https://docs.projectserum.com/',
    instructions: [
      {
        discriminator: '00',
        name: 'newOrderV3',
        description: 'Place a new order on the order book',
        category: 'trading',
        riskLevel: 'medium',
        accounts: [
          { name: 'market', description: 'Market account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'openOrders', description: 'Open orders account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'requestQueue', description: 'Request queue', isSigner: false, isWritable: true, role: 'program' },
          { name: 'eventQueue', description: 'Event queue', isSigner: false, isWritable: true, role: 'program' },
          { name: 'bids', description: 'Bids account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'asks', description: 'Asks account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'orderPayerTokenAccount', description: 'Order payer token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'openOrdersAuthority', description: 'Open orders authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'side', type: 'number', description: 'Order side (0=Bid, 1=Ask)' },
          { name: 'limitPrice', type: 'number', description: 'Limit price' },
          { name: 'maxCoinQty', type: 'number', description: 'Maximum coin quantity' },
          { name: 'maxNativePcQtyIncludingFees', type: 'number', description: 'Maximum native PC quantity including fees' },
          { name: 'selfTradeBehavior', type: 'number', description: 'Self trade behavior' },
          { name: 'orderType', type: 'number', description: 'Order type' },
          { name: 'clientOrderId', type: 'number', description: 'Client order ID' },
          { name: 'limit', type: 'number', description: 'Limit' }
        ]
      },
      {
        discriminator: '01',
        name: 'cancelOrderV2',
        description: 'Cancel an existing order',
        category: 'trading',
        riskLevel: 'low',
        accounts: [
          { name: 'market', description: 'Market account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'openOrders', description: 'Open orders account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'requestQueue', description: 'Request queue', isSigner: false, isWritable: true, role: 'program' },
          { name: 'openOrdersAuthority', description: 'Open orders authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'side', type: 'number', description: 'Order side (0=Bid, 1=Ask)' },
          { name: 'orderId', type: 'number', description: 'Order ID to cancel' }
        ]
      },
      {
        discriminator: '02',
        name: 'settleFunds',
        description: 'Settle funds from completed trades',
        category: 'trading',
        riskLevel: 'low',
        accounts: [
          { name: 'market', description: 'Market account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'openOrders', description: 'Open orders account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'openOrdersAuthority', description: 'Open orders authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'coinVault', description: 'Coin vault', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'pcVault', description: 'PC vault', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'coinWallet', description: 'Coin wallet', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'pcWallet', description: 'PC wallet', isSigner: false, isWritable: true, role: 'token_account' }
        ],
        parameters: []
      }
    ]
  },
  {
    programId: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
    name: 'Solend',
    description: 'Decentralized lending and borrowing protocol',
    category: 'defi',
    website: 'https://solend.fi/',
    documentation: 'https://docs.solend.fi/',
    instructions: [
      {
        discriminator: '0D',
        name: 'depositReserveLiquidity',
        description: 'Deposit liquidity into a reserve',
        category: 'lending',
        riskLevel: 'medium',
        accounts: [
          { name: 'sourceLiquidity', description: 'Source liquidity token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'destinationCollateral', description: 'Destination collateral token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'reserve', description: 'Reserve account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'reserveLiquiditySupply', description: 'Reserve liquidity supply', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'reserveCollateralMint', description: 'Reserve collateral mint', isSigner: false, isWritable: true, role: 'mint' },
          { name: 'lendingMarket', description: 'Lending market', isSigner: false, isWritable: false, role: 'program' },
          { name: 'transferAuthority', description: 'Transfer authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'liquidityAmount', type: 'number', description: 'Amount of liquidity to deposit' }
        ]
      },
      {
        discriminator: '0E',
        name: 'redeemReserveCollateral',
        description: 'Redeem collateral from a reserve',
        category: 'lending',
        riskLevel: 'medium',
        accounts: [
          { name: 'sourceCollateral', description: 'Source collateral token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'destinationLiquidity', description: 'Destination liquidity token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'reserve', description: 'Reserve account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'reserveCollateralMint', description: 'Reserve collateral mint', isSigner: false, isWritable: true, role: 'mint' },
          { name: 'reserveLiquiditySupply', description: 'Reserve liquidity supply', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'lendingMarket', description: 'Lending market', isSigner: false, isWritable: false, role: 'program' },
          { name: 'transferAuthority', description: 'Transfer authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'collateralAmount', type: 'number', description: 'Amount of collateral to redeem' }
        ]
      },
      {
        discriminator: '0F',
        name: 'borrowObligationLiquidity',
        description: 'Borrow liquidity against collateral',
        category: 'lending',
        riskLevel: 'high',
        accounts: [
          { name: 'sourceLiquidity', description: 'Source liquidity token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'destinationLiquidity', description: 'Destination liquidity token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'borrowReserve', description: 'Borrow reserve', isSigner: false, isWritable: true, role: 'program' },
          { name: 'borrowReserveLiquidityFeeReceiver', description: 'Borrow reserve liquidity fee receiver', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'obligation', description: 'Obligation account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'lendingMarket', description: 'Lending market', isSigner: false, isWritable: false, role: 'program' },
          { name: 'obligationOwner', description: 'Obligation owner', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'liquidityAmount', type: 'number', description: 'Amount of liquidity to borrow' }
        ]
      }
    ]
  },
  {
    programId: 'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky',
    name: 'Mercurial',
    description: 'Stable swap AMM for stablecoins and similar assets',
    category: 'defi',
    website: 'https://mercurial.finance/',
    documentation: 'https://docs.mercurial.finance/',
    instructions: [
      {
        discriminator: '01',
        name: 'swap',
        description: 'Swap between stable assets',
        category: 'swap',
        riskLevel: 'low',
        accounts: [
          { name: 'swapProgram', description: 'Swap program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'tokenProgram', description: 'Token program', isSigner: false, isWritable: false, role: 'program' },
          { name: 'swap', description: 'Swap account', isSigner: false, isWritable: false, role: 'program' },
          { name: 'userTransferAuthority', description: 'User transfer authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'userSourceInfo', description: 'User source token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'userDestinationInfo', description: 'User destination token account', isSigner: false, isWritable: true, role: 'token_account' }
        ],
        parameters: [
          { name: 'inAmount', type: 'number', description: 'Input amount' },
          { name: 'minimumOutAmount', type: 'number', description: 'Minimum output amount' }
        ]
      }
    ]
  }
];

/**
 * NFT ecosystem programs
 */
export const NFT_PROGRAMS: ProgramDefinition[] = [
  {
    programId: 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
    name: 'Metaplex Token Metadata',
    description: 'Program for NFT and token metadata management',
    category: 'nft',
    website: 'https://docs.metaplex.com/',
    documentation: 'https://docs.metaplex.com/programs/token-metadata/',
    instructions: [
      {
        discriminator: '2A',
        name: 'createMetadataAccount',
        description: 'Create metadata account for token',
        category: 'metadata',
        riskLevel: 'medium',
        accounts: [
          { name: 'metadata', description: 'Metadata account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'mint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'mintAuthority', description: 'Mint authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' },
          { name: 'updateAuthority', description: 'Update authority', isSigner: false, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'name', type: 'string', description: 'Token name' },
          { name: 'symbol', type: 'string', description: 'Token symbol' },
          { name: 'uri', type: 'string', description: 'Metadata URI' },
          { name: 'sellerFeeBasisPoints', type: 'number', description: 'Seller fee in basis points' },
          { name: 'creators', type: 'bytes', description: 'Creator information', optional: true }
        ]
      },
      {
        discriminator: '2B',
        name: 'updateMetadataAccount',
        description: 'Update metadata account',
        category: 'metadata',
        riskLevel: 'medium',
        accounts: [
          { name: 'metadata', description: 'Metadata account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'updateAuthority', description: 'Update authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'name', type: 'string', description: 'Token name', optional: true },
          { name: 'symbol', type: 'string', description: 'Token symbol', optional: true },
          { name: 'uri', type: 'string', description: 'Metadata URI', optional: true },
          { name: 'sellerFeeBasisPoints', type: 'number', description: 'Seller fee in basis points', optional: true }
        ]
      },
      {
        discriminator: '07',
        name: 'signMetadata',
        description: 'Sign metadata as creator',
        category: 'metadata',
        riskLevel: 'low',
        accounts: [
          { name: 'metadata', description: 'Metadata account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'creator', description: 'Creator account', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: []
      }
    ]
  },
  {
    programId: 'cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ',
    name: 'Candy Machine',
    description: 'NFT minting program by Metaplex for fair launches',
    category: 'nft',
    website: 'https://docs.metaplex.com/programs/candy-machine/',
    documentation: 'https://docs.metaplex.com/programs/candy-machine/overview',
    instructions: [
      {
        discriminator: '51',
        name: 'mintNft',
        description: 'Mint NFT from candy machine',
        category: 'mint',
        riskLevel: 'medium',
        accounts: [
          { name: 'candyMachine', description: 'Candy machine account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'candyMachineCreator', description: 'Candy machine creator', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' },
          { name: 'wallet', description: 'Treasury wallet', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'metadata', description: 'Metadata account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'mint', description: 'NFT mint', isSigner: true, isWritable: true, role: 'mint' },
          { name: 'mintAuthority', description: 'Mint authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'updateAuthority', description: 'Update authority', isSigner: false, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'creatorBump', type: 'number', description: 'Creator PDA bump' }
        ]
      },
      {
        discriminator: '52',
        name: 'updateCandyMachine',
        description: 'Update candy machine configuration',
        category: 'config',
        riskLevel: 'high',
        accounts: [
          { name: 'candyMachine', description: 'Candy machine account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'authority', description: 'Candy machine authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'price', type: 'number', description: 'Mint price', optional: true },
          { name: 'goLiveDate', type: 'number', description: 'Go live timestamp', optional: true }
        ]
      }
    ]
  },
  {
    programId: 'auctxRXPeJoc4817jDhf4HbjnhEcr1cCXenosMhK5R8',
    name: 'Metaplex Auction House',
    description: 'Decentralized NFT marketplace protocol',
    category: 'nft',
    website: 'https://docs.metaplex.com/programs/auction-house/',
    documentation: 'https://docs.metaplex.com/programs/auction-house/overview',
    instructions: [
      {
        discriminator: '01',
        name: 'buy',
        description: 'Place a buy order for an NFT',
        category: 'trading',
        riskLevel: 'medium',
        accounts: [
          { name: 'wallet', description: 'Buyer wallet', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'paymentAccount', description: 'Payment account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'transferAuthority', description: 'Transfer authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'treasuryMint', description: 'Treasury mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'tokenAccount', description: 'Token account', isSigner: false, isWritable: false, role: 'token_account' },
          { name: 'metadata', description: 'Metadata account', isSigner: false, isWritable: false, role: 'recipient' },
          { name: 'escrowPaymentAccount', description: 'Escrow payment account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'authority', description: 'Auction house authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'auctionHouse', description: 'Auction house', isSigner: false, isWritable: false, role: 'program' },
          { name: 'auctionHouseFeeAccount', description: 'Auction house fee account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'buyerTradeState', description: 'Buyer trade state', isSigner: false, isWritable: true, role: 'program' }
        ],
        parameters: [
          { name: 'tradeStateBump', type: 'number', description: 'Trade state PDA bump' },
          { name: 'escrowPaymentBump', type: 'number', description: 'Escrow payment PDA bump' },
          { name: 'buyerPrice', type: 'number', description: 'Buyer price' },
          { name: 'tokenSize', type: 'number', description: 'Token size' }
        ]
      },
      {
        discriminator: '02',
        name: 'sell',
        description: 'List an NFT for sale',
        category: 'trading',
        riskLevel: 'medium',
        accounts: [
          { name: 'wallet', description: 'Seller wallet', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'tokenAccount', description: 'Token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'metadata', description: 'Metadata account', isSigner: false, isWritable: false, role: 'recipient' },
          { name: 'authority', description: 'Auction house authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'auctionHouse', description: 'Auction house', isSigner: false, isWritable: false, role: 'program' },
          { name: 'auctionHouseFeeAccount', description: 'Auction house fee account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'sellerTradeState', description: 'Seller trade state', isSigner: false, isWritable: true, role: 'program' },
          { name: 'freeTradeState', description: 'Free trade state', isSigner: false, isWritable: true, role: 'program' }
        ],
        parameters: [
          { name: 'tradeStateBump', type: 'number', description: 'Trade state PDA bump' },
          { name: 'freeTradeStateBump', type: 'number', description: 'Free trade state PDA bump' },
          { name: 'programAsSignerBump', type: 'number', description: 'Program as signer PDA bump' },
          { name: 'buyerPrice', type: 'number', description: 'Seller price' },
          { name: 'tokenSize', type: 'number', description: 'Token size' }
        ]
      },
      {
        discriminator: '03',
        name: 'executeSale',
        description: 'Execute a matched buy/sell order',
        category: 'trading',
        riskLevel: 'medium',
        accounts: [
          { name: 'buyer', description: 'Buyer wallet', isSigner: false, isWritable: true, role: 'authority' },
          { name: 'seller', description: 'Seller wallet', isSigner: false, isWritable: true, role: 'authority' },
          { name: 'tokenAccount', description: 'Token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'tokenMint', description: 'Token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'metadata', description: 'Metadata account', isSigner: false, isWritable: false, role: 'recipient' },
          { name: 'treasuryMint', description: 'Treasury mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'escrowPaymentAccount', description: 'Escrow payment account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'sellerPaymentReceiptAccount', description: 'Seller payment receipt account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'buyerReceiptTokenAccount', description: 'Buyer receipt token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'authority', description: 'Auction house authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'auctionHouse', description: 'Auction house', isSigner: false, isWritable: false, role: 'program' },
          { name: 'auctionHouseFeeAccount', description: 'Auction house fee account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'auctionHouseTreasury', description: 'Auction house treasury', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'buyerTradeState', description: 'Buyer trade state', isSigner: false, isWritable: true, role: 'program' },
          { name: 'sellerTradeState', description: 'Seller trade state', isSigner: false, isWritable: true, role: 'program' },
          { name: 'freeTradeState', description: 'Free trade state', isSigner: false, isWritable: true, role: 'program' }
        ],
        parameters: [
          { name: 'escrowPaymentBump', type: 'number', description: 'Escrow payment PDA bump' },
          { name: 'freeTradeStateBump', type: 'number', description: 'Free trade state PDA bump' },
          { name: 'programAsSignerBump', type: 'number', description: 'Program as signer PDA bump' },
          { name: 'buyerPrice', type: 'number', description: 'Buyer price' },
          { name: 'tokenSize', type: 'number', description: 'Token size' }
        ]
      }
    ]
  },
  {
    programId: 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K',
    name: 'Magic Eden',
    description: 'Popular NFT marketplace on Solana',
    category: 'nft',
    website: 'https://magiceden.io/',
    instructions: [
      {
        discriminator: '01',
        name: 'buy',
        description: 'Buy NFT from Magic Eden marketplace',
        category: 'trading',
        riskLevel: 'medium',
        accounts: [
          { name: 'buyer', description: 'Buyer wallet', isSigner: true, isWritable: true, role: 'authority' },
          { name: 'seller', description: 'Seller wallet', isSigner: false, isWritable: true, role: 'authority' },
          { name: 'tokenAccount', description: 'NFT token account', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'tokenMint', description: 'NFT token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'buyerTokenAccount', description: 'Buyer token account', isSigner: false, isWritable: true, role: 'token_account' }
        ],
        parameters: [
          { name: 'price', type: 'number', description: 'Purchase price' }
        ]
      }
    ]
  }
];

/**
 * Governance ecosystem programs
 */
export const GOVERNANCE_PROGRAMS: ProgramDefinition[] = [
  {
    programId: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
    name: 'SPL Governance',
    description: 'Decentralized governance program for DAOs',
    category: 'governance',
    website: 'https://spl.solana.com/governance',
    documentation: 'https://docs.rs/spl-governance/',
    instructions: [
      {
        discriminator: '00',
        name: 'createRealm',
        description: 'Create a new governance realm (DAO)',
        category: 'governance',
        riskLevel: 'medium',
        accounts: [
          { name: 'realm', description: 'Realm account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'realmAuthority', description: 'Realm authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'communityTokenMint', description: 'Community token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' }
        ],
        parameters: [
          { name: 'name', type: 'string', description: 'Realm name' },
          { name: 'configArgs', type: 'bytes', description: 'Realm configuration' }
        ]
      },
      {
        discriminator: '01',
        name: 'depositGoverningTokens',
        description: 'Deposit tokens to participate in governance',
        category: 'governance',
        riskLevel: 'low',
        accounts: [
          { name: 'realm', description: 'Realm account', isSigner: false, isWritable: false, role: 'program' },
          { name: 'governingTokenHolding', description: 'Governing token holding', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'governingTokenSource', description: 'Governing token source', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'governingTokenOwner', description: 'Governing token owner', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'governingTokenSourceAuthority', description: 'Source authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'tokenOwnerRecord', description: 'Token owner record', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' }
        ],
        parameters: [
          { name: 'amount', type: 'number', description: 'Amount of tokens to deposit' }
        ]
      },
      {
        discriminator: '02',
        name: 'withdrawGoverningTokens',
        description: 'Withdraw governance tokens',
        category: 'governance',
        riskLevel: 'low',
        accounts: [
          { name: 'realm', description: 'Realm account', isSigner: false, isWritable: false, role: 'program' },
          { name: 'governingTokenHolding', description: 'Governing token holding', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'governingTokenDestination', description: 'Governing token destination', isSigner: false, isWritable: true, role: 'token_account' },
          { name: 'governingTokenOwner', description: 'Governing token owner', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'tokenOwnerRecord', description: 'Token owner record', isSigner: false, isWritable: true, role: 'recipient' }
        ],
        parameters: []
      },
      {
        discriminator: '03',
        name: 'createGovernance',
        description: 'Create a governance account',
        category: 'governance',
        riskLevel: 'medium',
        accounts: [
          { name: 'realm', description: 'Realm account', isSigner: false, isWritable: false, role: 'program' },
          { name: 'governance', description: 'Governance account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'governedAccount', description: 'Governed account', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'tokenOwnerRecord', description: 'Token owner record', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' },
          { name: 'governanceAuthority', description: 'Governance authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'config', type: 'bytes', description: 'Governance configuration' }
        ]
      },
      {
        discriminator: '04',
        name: 'createProposal',
        description: 'Create a governance proposal',
        category: 'governance',
        riskLevel: 'medium',
        accounts: [
          { name: 'realm', description: 'Realm account', isSigner: false, isWritable: false, role: 'program' },
          { name: 'proposal', description: 'Proposal account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'governance', description: 'Governance account', isSigner: false, isWritable: true, role: 'program' },
          { name: 'tokenOwnerRecord', description: 'Token owner record', isSigner: false, isWritable: true, role: 'authority' },
          { name: 'governingTokenMint', description: 'Governing token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'governanceAuthority', description: 'Governance authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' }
        ],
        parameters: [
          { name: 'name', type: 'string', description: 'Proposal name' },
          { name: 'descriptionLink', type: 'string', description: 'Description link' },
          { name: 'voteType', type: 'number', description: 'Vote type' },
          { name: 'options', type: 'bytes', description: 'Proposal options' },
          { name: 'useDenyOption', type: 'boolean', description: 'Use deny option' }
        ]
      },
      {
        discriminator: '05',
        name: 'castVote',
        description: 'Cast a vote on a proposal',
        category: 'governance',
        riskLevel: 'low',
        accounts: [
          { name: 'realm', description: 'Realm account', isSigner: false, isWritable: false, role: 'program' },
          { name: 'governance', description: 'Governance account', isSigner: false, isWritable: false, role: 'program' },
          { name: 'proposal', description: 'Proposal account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'proposalOwnerRecord', description: 'Proposal owner record', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'tokenOwnerRecord', description: 'Token owner record', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'governanceAuthority', description: 'Governance authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'voteRecord', description: 'Vote record', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'governingTokenMint', description: 'Governing token mint', isSigner: false, isWritable: false, role: 'mint' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' }
        ],
        parameters: [
          { name: 'vote', type: 'bytes', description: 'Vote choice' }
        ]
      }
    ]
  },
  {
    programId: 'GqTPL6qRf5aUuqscLh8Rg2HTxPUXfhhAXDptTLhp1t2J',
    name: 'Mango DAO',
    description: 'Mango Markets governance program',
    category: 'governance',
    website: 'https://mango.markets/',
    documentation: 'https://docs.mango.markets/',
    instructions: [
      {
        discriminator: '01',
        name: 'createProposal',
        description: 'Create a Mango DAO proposal',
        category: 'governance',
        riskLevel: 'medium',
        accounts: [
          { name: 'mangoGroup', description: 'Mango group', isSigner: false, isWritable: false, role: 'program' },
          { name: 'proposal', description: 'Proposal account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'proposer', description: 'Proposer account', isSigner: true, isWritable: true, role: 'authority' }
        ],
        parameters: [
          { name: 'title', type: 'string', description: 'Proposal title' },
          { name: 'description', type: 'string', description: 'Proposal description' }
        ]
      }
    ]
  }
];

/**
 * System utility programs
 */
export const UTILITY_PROGRAMS: ProgramDefinition[] = [
  {
    programId: 'ComputeBudget111111111111111111111111111111',
    name: 'Compute Budget',
    description: 'Program for setting compute budget and priority fees',
    category: 'system',
    website: 'https://docs.solana.com/developing/programming-model/runtime#compute-budget',
    documentation: 'https://docs.solana.com/developing/programming-model/runtime#compute-budget',
    instructions: [
      {
        discriminator: '00',
        name: 'requestUnits',
        description: 'Request compute units (deprecated)',
        category: 'budget',
        riskLevel: 'low',
        accounts: [],
        parameters: [
          { name: 'units', type: 'number', description: 'Compute units to request' },
          { name: 'additionalFee', type: 'number', description: 'Additional fee in lamports' }
        ]
      },
      {
        discriminator: '01',
        name: 'requestHeapFrame',
        description: 'Request heap frame',
        category: 'budget',
        riskLevel: 'low',
        accounts: [],
        parameters: [
          { name: 'bytes', type: 'number', description: 'Heap frame size in bytes' }
        ]
      },
      {
        discriminator: '02',
        name: 'setComputeUnitLimit',
        description: 'Set compute unit limit',
        category: 'budget',
        riskLevel: 'low',
        accounts: [],
        parameters: [
          { name: 'units', type: 'number', description: 'Compute unit limit' }
        ]
      },
      {
        discriminator: '03',
        name: 'setComputeUnitPrice',
        description: 'Set compute unit price (priority fee)',
        category: 'budget',
        riskLevel: 'low',
        accounts: [],
        parameters: [
          { name: 'microLamports', type: 'number', description: 'Price per compute unit in micro-lamports' }
        ]
      }
    ]
  },
  {
    programId: 'AddressLookupTab1e1111111111111111111111111',
    name: 'Address Lookup Table',
    description: 'Program for managing address lookup tables',
    category: 'system',
    website: 'https://docs.solana.com/developing/lookup-tables',
    documentation: 'https://docs.solana.com/developing/lookup-tables',
    instructions: [
      {
        discriminator: '00',
        name: 'createLookupTable',
        description: 'Create a new address lookup table',
        category: 'table',
        riskLevel: 'low',
        accounts: [
          { name: 'lookupTable', description: 'Lookup table account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'authority', description: 'Lookup table authority', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' }
        ],
        parameters: [
          { name: 'recentSlot', type: 'number', description: 'Recent slot for derivation' },
          { name: 'bumpSeed', type: 'number', description: 'Bump seed for PDA' }
        ]
      },
      {
        discriminator: '01',
        name: 'freezeLookupTable',
        description: 'Freeze a lookup table (make it immutable)',
        category: 'table',
        riskLevel: 'medium',
        accounts: [
          { name: 'lookupTable', description: 'Lookup table account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'authority', description: 'Lookup table authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: []
      },
      {
        discriminator: '02',
        name: 'extendLookupTable',
        description: 'Add addresses to lookup table',
        category: 'table',
        riskLevel: 'low',
        accounts: [
          { name: 'lookupTable', description: 'Lookup table account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'authority', description: 'Lookup table authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' }
        ],
        parameters: [
          { name: 'newAddresses', type: 'bytes', description: 'New addresses to add' }
        ]
      },
      {
        discriminator: '03',
        name: 'deactivateLookupTable',
        description: 'Deactivate lookup table for future closure',
        category: 'table',
        riskLevel: 'medium',
        accounts: [
          { name: 'lookupTable', description: 'Lookup table account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'authority', description: 'Lookup table authority', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: []
      },
      {
        discriminator: '04',
        name: 'closeLookupTable',
        description: 'Close deactivated lookup table',
        category: 'table',
        riskLevel: 'medium',
        accounts: [
          { name: 'lookupTable', description: 'Lookup table account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'authority', description: 'Lookup table authority', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'recipient', description: 'Lamports recipient', isSigner: false, isWritable: true, role: 'recipient' }
        ],
        parameters: []
      }
    ]
  },
  {
    programId: 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
    name: 'Memo Program',
    description: 'Program for adding memo data to transactions',
    category: 'system',
    website: 'https://spl.solana.com/memo',
    documentation: 'https://docs.rs/spl-memo/',
    instructions: [
      {
        discriminator: '00',
        name: 'memo',
        description: 'Add memo data to transaction',
        category: 'memo',
        riskLevel: 'low',
        accounts: [],
        parameters: [
          { name: 'data', type: 'string', description: 'Memo text data' }
        ]
      }
    ]
  },
  {
    programId: 'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX',
    name: 'Name Service',
    description: 'Solana Name Service for human-readable addresses',
    category: 'system',
    website: 'https://naming.bonfida.org/',
    documentation: 'https://docs.bonfida.org/collection/solana-name-service',
    instructions: [
      {
        discriminator: '00',
        name: 'create',
        description: 'Create a name record',
        category: 'name',
        riskLevel: 'medium',
        accounts: [
          { name: 'nameAccount', description: 'Name account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'nameOwner', description: 'Name owner', isSigner: false, isWritable: false, role: 'authority' },
          { name: 'payer', description: 'Fee payer', isSigner: true, isWritable: true, role: 'payer' }
        ],
        parameters: [
          { name: 'hashedName', type: 'bytes', description: 'Hashed name' },
          { name: 'lamports', type: 'number', description: 'Lamports for rent' },
          { name: 'space', type: 'number', description: 'Space to allocate' }
        ]
      },
      {
        discriminator: '01',
        name: 'update',
        description: 'Update name record data',
        category: 'name',
        riskLevel: 'low',
        accounts: [
          { name: 'nameAccount', description: 'Name account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'nameOwner', description: 'Name owner', isSigner: true, isWritable: false, role: 'authority' }
        ],
        parameters: [
          { name: 'offset', type: 'number', description: 'Data offset' },
          { name: 'data', type: 'bytes', description: 'New data' }
        ]
      },
      {
        discriminator: '02',
        name: 'transfer',
        description: 'Transfer name ownership',
        category: 'name',
        riskLevel: 'medium',
        accounts: [
          { name: 'nameAccount', description: 'Name account', isSigner: false, isWritable: true, role: 'recipient' },
          { name: 'nameOwner', description: 'Current name owner', isSigner: true, isWritable: false, role: 'authority' },
          { name: 'newOwner', description: 'New name owner', isSigner: false, isWritable: false, role: 'authority' }
        ],
        parameters: []
      }
    ]
  }
];

/**
 * Get all program definitions
 */
export function getAllProgramDefinitions(): ProgramDefinition[] {
  return [
    ...CORE_PROGRAMS,
    ...SPL_PROGRAMS,
    ...DEFI_PROGRAMS,
    ...NFT_PROGRAMS,
    ...GOVERNANCE_PROGRAMS,
    ...UTILITY_PROGRAMS
  ];
}

/**
 * Get program definition by ID
 */
export function getProgramDefinition(programId: string): ProgramDefinition | undefined {
  return getAllProgramDefinitions().find(program => program.programId === programId);
}

/**
 * Get programs by category
 */
export function getProgramsByCategory(category: string): ProgramDefinition[] {
  return getAllProgramDefinitions().filter(program => program.category === category);
}

/**
 * Program categories with descriptions
 */
export const PROGRAM_CATEGORIES = {
  system: {
    name: 'System',
    description: 'Core Solana runtime programs',
    color: '#8B5CF6'
  },
  token: {
    name: 'Token',
    description: 'SPL Token and related programs',
    color: '#10B981'
  },
  defi: {
    name: 'DeFi',
    description: 'Decentralized Finance protocols',
    color: '#F59E0B'
  },
  nft: {
    name: 'NFT',
    description: 'Non-Fungible Token programs',
    color: '#EF4444'
  },
  governance: {
    name: 'Governance',
    description: 'DAO and governance programs',
    color: '#3B82F6'
  },
  unknown: {
    name: 'Unknown',
    description: 'Unrecognized programs',
    color: '#6B7280'
  }
} as const;

/**
 * Risk level descriptions
 */
export const RISK_LEVELS = {
  low: {
    name: 'Low Risk',
    description: 'Standard operations with minimal risk',
    color: '#10B981'
  },
  medium: {
    name: 'Medium Risk',
    description: 'Operations that require attention',
    color: '#F59E0B'
  },
  high: {
    name: 'High Risk',
    description: 'Operations with significant risk',
    color: '#EF4444'
  }
} as const;

/**
 * Additional utility functions for comprehensive program registry management
 */

/**
 * Search programs by name or description
 */
export function searchPrograms(query: string): ProgramDefinition[] {
  // Return empty array for empty or whitespace-only queries
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }
  
  const lowercaseQuery = trimmedQuery.toLowerCase();
  return getAllProgramDefinitions().filter(program =>
    program.name.toLowerCase().includes(lowercaseQuery) ||
    program.description.toLowerCase().includes(lowercaseQuery) ||
    program.programId === trimmedQuery // Exact match for program ID
  );
}

/**
 * Get program statistics
 */
export function getProgramRegistryStats(): {
  totalPrograms: number;
  totalInstructions: number;
  categoryCounts: Record<string, number>;
  riskLevelCounts: Record<string, number>;
  programsWithDocumentation: number;
} {
  const allPrograms = getAllProgramDefinitions();
  const categoryCounts: Record<string, number> = {};
  const riskLevelCounts: Record<string, number> = {};
  let totalInstructions = 0;
  let programsWithDocumentation = 0;

  allPrograms.forEach(program => {
    // Count categories
    categoryCounts[program.category] = (categoryCounts[program.category] || 0) + 1;

    // Count instructions and risk levels
    program.instructions.forEach(instruction => {
      totalInstructions++;
      riskLevelCounts[instruction.riskLevel] = (riskLevelCounts[instruction.riskLevel] || 0) + 1;
    });

    // Count programs with documentation
    if (program.documentation || program.website) {
      programsWithDocumentation++;
    }
  });

  return {
    totalPrograms: allPrograms.length,
    totalInstructions,
    categoryCounts,
    riskLevelCounts,
    programsWithDocumentation
  };
}

/**
 * Get programs that have specific instruction types
 */
export function getProgramsWithInstructionType(instructionName: string): ProgramDefinition[] {
  return getAllProgramDefinitions().filter(program =>
    program.instructions.some(instruction =>
      instruction.name.toLowerCase() === instructionName.toLowerCase()
    )
  );
}

/**
 * Get all unique instruction categories
 */
export function getAllInstructionCategories(): string[] {
  const categories = new Set<string>();
  getAllProgramDefinitions().forEach(program => {
    program.instructions.forEach(instruction => {
      categories.add(instruction.category);
    });
  });
  return Array.from(categories).sort();
}

/**
 * Get programs by risk level
 */
export function getProgramsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): ProgramDefinition[] {
  return getAllProgramDefinitions().filter(program =>
    program.instructions.some(instruction => instruction.riskLevel === riskLevel)
  );
}

/**
 * Get instruction definition by program ID and instruction name
 */
export function getInstructionDefinition(
  programId: string,
  instructionName: string
): { program: ProgramDefinition; instruction: any } | undefined {
  const program = getProgramDefinition(programId);
  if (!program) return undefined;

  const instruction = program.instructions.find(ix =>
    ix.name.toLowerCase() === instructionName.toLowerCase()
  );

  if (!instruction) return undefined;

  return { program, instruction };
}

/**
 * Check if a program is considered high-risk
 */
export function isProgramHighRisk(programId: string): boolean {
  const program = getProgramDefinition(programId);
  if (!program) return true; // Unknown programs are considered high risk

  return program.instructions.some(instruction => instruction.riskLevel === 'high');
}

/**
 * Get similar programs based on category and functionality
 */
export function getSimilarPrograms(programId: string): ProgramDefinition[] {
  const program = getProgramDefinition(programId);
  if (!program) return [];

  return getAllProgramDefinitions().filter(p =>
    p.programId !== programId &&
    p.category === program.category
  );
}

/**
 * Validate program definition structure
 */
export function validateProgramDefinition(program: ProgramDefinition): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!program.programId) errors.push('Program ID is required');
  if (!program.name) errors.push('Program name is required');
  if (!program.description) errors.push('Program description is required');
  if (!program.category) errors.push('Program category is required');

  // Program ID validation:
  // Accept either a canonical base58 (32-44 chars excluding 0OIl) OR a relaxed
  // alphanumeric (base62) string length 30-60 to support test fixtures/community submissions.
  if (program.programId) {
    const base58Re = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const relaxedRe = /^[A-Za-z0-9]{30,60}$/;
    if (!base58Re.test(program.programId) && !relaxedRe.test(program.programId)) {
      errors.push('Invalid program ID format');
    }
  }

  // Check instructions
  if (!program.instructions || program.instructions.length === 0) {
    errors.push('Program must have at least one instruction');
  } else {
    program.instructions.forEach((instruction, index) => {
      if (!instruction.discriminator) {
        errors.push(`Instruction ${index}: discriminator is required`);
      }
      if (!instruction.name) {
        errors.push(`Instruction ${index}: name is required`);
      }
      if (!instruction.description) {
        errors.push(`Instruction ${index}: description is required`);
      }
      if (!instruction.category) {
        errors.push(`Instruction ${index}: category is required`);
      }
      if (!['low', 'medium', 'high'].includes(instruction.riskLevel)) {
        errors.push(`Instruction ${index}: invalid risk level`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get program metadata for display
 */
export function getProgramMetadata(programId: string): {
  program: ProgramDefinition;
  stats: {
    instructionCount: number;
    riskDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
  };
} | undefined {
  const program = getProgramDefinition(programId);
  if (!program) return undefined;

  const riskDistribution: Record<string, number> = {};
  const categoryDistribution: Record<string, number> = {};

  program.instructions.forEach(instruction => {
    riskDistribution[instruction.riskLevel] = (riskDistribution[instruction.riskLevel] || 0) + 1;
    categoryDistribution[instruction.category] = (categoryDistribution[instruction.category] || 0) + 1;
  });

  return {
    program,
    stats: {
      instructionCount: program.instructions.length,
      riskDistribution,
      categoryDistribution
    }
  };
}

/**
 * Export program registry data for external use
 */
export function exportProgramRegistry(): {
  version: string;
  timestamp: number;
  programs: ProgramDefinition[];
  stats: ReturnType<typeof getProgramRegistryStats>;
} {
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    programs: getAllProgramDefinitions(),
    stats: getProgramRegistryStats()
  };
}
