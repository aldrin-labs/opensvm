import { NextRequest } from 'next/server';
import type { DetailedTransactionInfo } from '@/lib/solana';
import { enhancedTransactionFetcher } from '@/lib/enhanced-transaction-fetcher';
import type { ParsedTransactionWithMeta } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

const DEBUG = true; // Set to true to enable detailed logging

// Demo transaction data for specific signatures
const DEMO_TRANSACTIONS: Record<string, any> = {
  // Demo transaction data for the transaction shown in user feedback
  '4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43': {
    signature: '4RwR2w12LydcoutGYJz2TbVxY8HVV44FCN2xoo1L9xu7ZcFxFBpoxxpSFTRWf9MPwMzmr9yTuJZjGqSmzcrawF43',
    blockTime: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    slot: 123456789,
    meta: {
      err: null,
      logMessages: [
        'Program 11111111111111111111111111111111 invoke [1]',
        'Program 11111111111111111111111111111111 success',
        'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [1]',
        'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA success'
      ],
      preBalances: [10000000, 5000000, 1000000],
      postBalances: [9500000, 5500000, 1000000],
      preTokenBalances: [
        {
          accountIndex: 1,
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          uiTokenAmount: {
            amount: '1000000000',
            decimals: 6,
            uiAmount: 1000,
            uiAmountString: '1000'
          }
        }
      ],
      postTokenBalances: [
        {
          accountIndex: 1,
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          uiTokenAmount: {
            amount: '2000000000',
            decimals: 6,
            uiAmount: 2000,
            uiAmountString: '2000'
          }
        }
      ],
      innerInstructions: [
        {
          index: 0,
          instructions: [
            {
              programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              accounts: [
                'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt',
                'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs'
              ],
              data: 'Transfer 1000000000'
            }
          ]
        }
      ]
    },
    transaction: {
      message: {
        accountKeys: [
          {
            pubkey: 'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt',
            signer: true,
            writable: true
          },
          {
            pubkey: 'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs',
            signer: false,
            writable: true
          },
          {
            pubkey: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            signer: false,
            writable: false
          }
        ],
        instructions: [
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            accounts: [
              'WaLLeTaS7qTaSnKFTYJNGAeu7VzoLMUV9QCMfKxFsgt',
              'RecipienTEKQQQQQQQQQQQQQQQQQQQQQQQQQQFrThs'
            ],
            data: '3DdGGhkhJbjm'
          }
        ]
      }
    }
  },
  // Add more demo transactions as needed with different signatures
};

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
} as const;

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: new Headers({
      ...defaultHeaders,
      'Access-Control-Max-Age': '86400',
    })
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ signature: string }> }
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    // Get signature from params - properly awaited in Next.js 13+
    const params = await context.params;
    const { signature } = await params;

    if (DEBUG) {
      console.log(`[API] Processing transaction request for signature: ${signature}`);
    }

    // Check if this is a demo transaction
    if (signature.startsWith('demo-') || DEMO_TRANSACTIONS[signature]) {
      if (DEBUG) {
        console.log(`[API] Serving demo transaction data for: ${signature}`);
      }

      // Use predefined demo data if available, otherwise generate a new demo
      const demoTx = DEMO_TRANSACTIONS[signature] || generateDemoTransaction(signature);

      // Transform and return the demo transaction data
      const transactionInfo = transformTransactionData(signature, demoTx);

      return new Response(
        JSON.stringify(transactionInfo),
        {
          status: 200,
          headers: new Headers(defaultHeaders)
        }
      );
    }

    if (!signature) {
      const error = 'Transaction signature is missing';
      if (DEBUG) {
        console.error(`[API] ${error}`);
      }
      return new Response(
        JSON.stringify({ error: 'Transaction signature is required' }),
        {
          status: 400,
          headers: new Headers(defaultHeaders)
        }
      );
    }

    // Get connection from pool (commented out since not used)
    // const connection = await getConnection();
    if (DEBUG) {
      console.log(`[API] Using OpenSVM RPC connection to fetch transaction data`);
    }

    // Use enhanced transaction fetcher for comprehensive data
    const enhancedTx = await Promise.race([
      enhancedTransactionFetcher.fetchEnhancedTransaction(signature),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('RPC request timed out')), 15000); // Increase timeout to 15 seconds
      })
    ]) as ParsedTransactionWithMeta;

    clearTimeout(timeoutId);

    if (DEBUG) {
      console.log(`[API] Enhanced transaction data received: ${enhancedTx ? 'YES' : 'NO'}`);
    }

    // Transform enhanced data to existing format for backward compatibility
    const transactionInfo = transformEnhancedTransactionData(enhancedTx);

    if (DEBUG) {
      console.log(`[API] Successfully processed transaction data, returning to client`);
    }

    return new Response(
      JSON.stringify(transactionInfo),
      {
        status: 200,
        headers: new Headers(defaultHeaders)
      }
    );

  } catch (error) {
    clearTimeout(timeoutId);
    if (DEBUG) {
      console.error('[API] Transaction error:', error);
    }

    let status = 500;
    let message = 'Failed to fetch transaction';

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timed out')) {
        status = 504;
        message = 'Request timed out. Please try again.';
      } else if (error.message.includes('429') || error.message.includes('Too many requests')) {
        status = 429;
        message = 'Rate limit exceeded. Please try again in a few moments.';
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        status = 403;
        message = 'Access denied. Please check your permissions.';
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        status = 404;
        message = 'Transaction not found. Please check the signature and try again.';
      } else if (error.message.includes('500') || error.message.includes('Internal')) {
        status = 500;
        message = 'Server error. Please try again later.';
      }
    }

    return new Response(
      JSON.stringify({
        error: message
      }),
      {
        status,
        headers: new Headers(defaultHeaders)
      }
    );
  }
}

// Helper function to transform transaction data into the DetailedTransactionInfo format
function transformTransactionData(signature: string, tx: ParsedTransactionWithMeta): DetailedTransactionInfo {
  if (DEBUG) {
    console.log(`[API] Transforming transaction data for UI presentation`);
  }

  const transactionInfo: DetailedTransactionInfo = {
    signature,
    timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
    slot: tx.slot,
    success: tx.meta?.err === null,
    type: 'unknown',
    details: {
      instructions: tx.transaction.message.instructions.map((ix: any) => {
        try {
          if ('parsed' in ix) {
            return {
              program: ix.program || '',
              programId: ix.programId?.toString() || '',
              parsed: ix.parsed || {},
              accounts: ix.accounts?.map((acc: any) => acc?.toString() || '') || [],
              data: JSON.stringify(ix.parsed || {}),
              computeUnits: undefined,
              computeUnitsConsumed: undefined
            };
          } else {
            return {
              programId: ix.programId?.toString() || '',
              accounts: ix.accounts?.map((acc: any) => acc?.toString() || '') || [],
              data: ix.data || '',
              computeUnits: undefined,
              computeUnitsConsumed: undefined
            };
          }
        } catch (error) {
          console.error('Error converting instruction:', error);
          return {
            program: '',
            programId: '',
            parsed: {},
            accounts: [],
            data: '',
            computeUnits: undefined,
            computeUnitsConsumed: undefined
          };
        }
      }),
      accounts: tx.transaction.message.accountKeys.map((key: any) => ({
        pubkey: key?.pubkey?.toString() || '',
        signer: key?.signer || false,
        writable: key?.writable || false
      })),
      preBalances: tx.meta?.preBalances || [],
      postBalances: tx.meta?.postBalances || [],
      preTokenBalances: tx.meta?.preTokenBalances || [],
      postTokenBalances: tx.meta?.postTokenBalances || [],
      logs: tx.meta?.logMessages || [],
      innerInstructions: tx.meta?.innerInstructions?.map(inner => ({
        index: inner.index,
        instructions: inner.instructions.map((ix: any) => {
          try {
            if ('parsed' in ix) {
              return {
                program: ix.program || '',
                programId: ix.programId?.toString() || '',
                parsed: ix.parsed || {},
                accounts: ix.accounts?.map((acc: any) => acc?.toString() || '') || [],
                data: JSON.stringify(ix.parsed || {}),
                computeUnits: undefined,
                computeUnitsConsumed: undefined
              };
            } else {
              return {
                programId: ix.programId?.toString() || '',
                accounts: ix.accounts?.map((acc: any) => acc?.toString() || '') || [],
                data: ix.data || '',
                computeUnits: undefined,
                computeUnitsConsumed: undefined
              };
            }
          } catch (error) {
            console.error('Error converting inner instruction:', error);
            return {
              program: '',
              programId: '',
              parsed: {},
              accounts: [],
              data: '',
              computeUnits: undefined,
              computeUnitsConsumed: undefined
            };
          }
        })
      })) || [],
      tokenChanges: [],
      solChanges: []
    }
  };

  // Try to determine transaction type and extract relevant details
  if (tx.meta?.preTokenBalances?.length && tx.meta.postTokenBalances?.length) {
    transactionInfo.type = 'token';
    if (transactionInfo.details) {
      // Extract token transfer details if available
      transactionInfo.details.tokenChanges = tx.meta.postTokenBalances
        .map(post => {
          const pre = tx.meta?.preTokenBalances?.find(p => p.accountIndex === post.accountIndex);
          return {
            mint: post.mint || '',
            preAmount: pre?.uiTokenAmount?.uiAmount || 0,
            postAmount: post.uiTokenAmount?.uiAmount || 0,
            change: (post.uiTokenAmount?.uiAmount || 0) - (pre?.uiTokenAmount?.uiAmount || 0)
          };
        })
        .filter(change => change.mint && (change.preAmount !== 0 || change.postAmount !== 0));
    }
  } else if (tx.meta?.preBalances?.length && tx.meta.postBalances?.length) {
    transactionInfo.type = 'sol';
    if (transactionInfo.details) {
      // Extract SOL transfer details
      transactionInfo.details.solChanges = tx.meta.postBalances
        .map((post, i) => ({
          accountIndex: i,
          preBalance: tx.meta?.preBalances?.[i] || 0,
          postBalance: post || 0,
          change: (post || 0) - (tx.meta?.preBalances?.[i] || 0)
        }))
        .filter(change => change.change !== 0);
    }
  }

  return transactionInfo;
}

// Helper function to transform enhanced transaction data to existing format
function transformEnhancedTransactionData(enhancedTx: ParsedTransactionWithMeta): DetailedTransactionInfo {
  if (DEBUG) {
    console.log(`[API] Transforming enhanced transaction data for UI presentation`);
  }

  const transactionInfo: DetailedTransactionInfo = {
    signature: enhancedTx.transaction.signatures[0],
    timestamp: enhancedTx.blockTime ? enhancedTx.blockTime * 1000 : Date.now(),
    slot: enhancedTx.slot,
    success: enhancedTx.meta?.err === null,
    type: 'unknown',
    details: {
      instructions: enhancedTx.transaction.message.instructions.map((ix, _index) => ({
        program: 'Unknown',
        programId: enhancedTx.transaction.message.accountKeys[(ix as any).programIdIndex || 0].toString(),
        parsed: 'parsed' in ix ? ix.parsed : {},
        accounts: 'accounts' in ix ? (ix as any).accounts?.map((accIndex: number) => enhancedTx.transaction.message.accountKeys[accIndex].toString()) || [] : [],
        data: 'data' in ix ? ix.data : '',
        computeUnits: undefined,
        computeUnitsConsumed: enhancedTx.meta?.computeUnitsConsumed
      })),
      accounts: enhancedTx.transaction.message.accountKeys.map(key => ({
        pubkey: key.toString(),
        signer: false,
        writable: true
      })),
      preBalances: enhancedTx.meta?.preBalances || [],
      postBalances: enhancedTx.meta?.postBalances || [],
      preTokenBalances: enhancedTx.meta?.preTokenBalances || [],
      postTokenBalances: enhancedTx.meta?.postTokenBalances || [],
      logs: enhancedTx.meta?.logMessages || [],
      innerInstructions: enhancedTx.meta?.innerInstructions?.map(inner => ({
        index: inner.index,
        instructions: inner.instructions.map(innerIx => ({
          program: 'Unknown',
          programId: enhancedTx.transaction.message.accountKeys[(innerIx as any).programIdIndex || 0].toString(),
          parsed: 'parsed' in innerIx ? innerIx.parsed : {},
          accounts: 'accounts' in innerIx ? (innerIx as any).accounts?.map((accIndex: number) => enhancedTx.transaction.message.accountKeys[accIndex].toString()) || [] : [],
          data: 'data' in innerIx ? innerIx.data : '',
          computeUnits: undefined,
          computeUnitsConsumed: undefined
        }))
      })) || []
    }
  };

  return transactionInfo;
}

// Helper function to generate a demo transaction with the given signature
function generateDemoTransaction(signature: string): ParsedTransactionWithMeta {
  // We use 'as unknown as ParsedTransactionWithMeta' to bypass type checking
  return ({
    signature,
    blockTime: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
    slot: 123456789,
    meta: {
      err: null,
      logMessages: ['Program demo invoke [1]', 'Program demo success'],
      preBalances: [10000000, 5000000],
      postBalances: [9000000, 6000000],
      preTokenBalances: [],
      postTokenBalances: [],
      innerInstructions: []
    },
    transaction: {
      signatures: [signature],
      message: {
        recentBlockhash: 'demoBlockhash1111111111111111111111111111111',
        accountKeys: [
          {
            pubkey: new PublicKey('11111111111111111111111111111111'),
            signer: true,
            writable: true
          },
          {
            pubkey: new PublicKey('222222222222222222222222222222222'),
            signer: false,
            writable: true
          }
        ],
        instructions: [
          {
            programId: 'DemoProgramId33333333333333333333333333',
            accounts: [
              'DemoWalletAddress1111111111111111111111111',
              'DemoWalletAddress2222222222222222222222222'
            ],
            data: 'Demo instruction data'
          }
        ]
      }
    }
  }) as unknown as ParsedTransactionWithMeta;
}