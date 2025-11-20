import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { isValidSolanaAddress } from '@/lib/utils';

import {
  MIN_TRANSFER_SOL,
  TRANSACTION_BATCH_SIZE,
  MAX_SIGNATURES_LIMIT,
  MAX_RETRIES,
  INITIAL_BACKOFF_MS,
  BATCH_DELAY_MS,
  isSpamAddress,
  isAboveDustThreshold,
  MIN_WALLET_ADDRESS_LENGTH,
  MAX_CONCURRENT_BATCHES,
  EFFECTIVE_MAX_RPS
} from '@/lib/blockchain/transaction-constants';
import {
  getCachedTransfers,
  storeTransferEntry,
  batchStoreTransferEntries,
  markTransfersCached,
  isSolanaOnlyTransaction,
  type TransferEntry
} from '@/lib/search/qdrant';
import { batchFetchTokenMetadata } from '@/lib/trading/token-registry';
import { withRetry } from '@/lib/solana/rpc/rpc-retry';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// In-memory coordination to prevent duplicate concurrent requests
const pendingRequests = new Map<string, Promise<any>>();

// Rate limiting: Track requests per address to prevent abuse
const requestTimestamps = new Map<string, number[]>();
const MAX_REQUESTS_PER_MINUTE = 10; // Max 10 requests per minute per address
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Request limits to prevent abuse
const MAX_LIMIT = 5000;
const MAX_OFFSET = 100000; // Prevent absurdly large offsets
const MIN_LIMIT = 1;
const MAX_RPC_CALLS_PER_REQUEST = 10000; // Limit RPC usage per request

// RPC call counter class for tracking usage
class RPCCallCounter {
  private count = 0;
  
  increment(amount = 1): void {
    this.count += amount;
  }
  
  getCount(): number {
    return this.count;
  }
  
  hasExceeded(limit: number): boolean {
    return this.count >= limit;
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export type TransactionType = 'sol' | 'spl' | 'defi' | 'nft' | 'program' | 'system' | 'funding';

interface Transfer {
  txId: string;
  date: string;
  from: string;
  to: string;
  tokenSymbol: string;
  tokenAmount: string;
  transferType: 'IN' | 'OUT';
  mint: string; // Token mint address or "SOL" for native transfers
  txType: TransactionType; // Transaction category
  programId?: string; // Program ID for DeFi/complex transactions
}

/**
 * Create a unique key for a transfer to enable deduplication
 * Uses txId, from, to, mint, and amount to ensure uniqueness
 */
function createTransferKey(transfer: Transfer): string {
  return `${transfer.txId}:${transfer.from}:${transfer.to}:${transfer.mint}:${transfer.tokenAmount}`;
}

/**
 * Deduplicate transfers by unique key (txId + from + to + mint + amount)
 * Keeps the first occurrence of each unique transfer
 */
function deduplicateTransfers(transfers: Transfer[]): Transfer[] {
  const seen = new Set<string>();
  const deduplicated: Transfer[] = [];
  
  for (const transfer of transfers) {
    const key = createTransferKey(transfer);
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(transfer);
    }
  }
  
  return deduplicated;
}

/**
 * Fetch token symbols for multiple mints via RPC
 * Returns a map of mint address -> token symbol
 */
async function batchFetchTokenSymbols(mints: string[]): Promise<Map<string, string>> {
  const symbolMap = new Map<string, string>();
  
  if (mints.length === 0) return symbolMap;
  
  try {
    const connection = await getConnection();
    
    // Batch fetch account info for all mints
    const mintPubkeys = mints.map(mint => new PublicKey(mint));
    const accountInfos = await connection.getMultipleAccountsInfo(mintPubkeys);
    
    for (let i = 0; i < accountInfos.length; i++) {
      const accountInfo = accountInfos[i];
      const mint = mints[i];
      
      if (!accountInfo || !accountInfo.data) {
        symbolMap.set(mint, mint);
        continue;
      }
      
      try {
        // Try to parse token metadata from account data
        // Token metadata is typically stored in the first few bytes
        const data = accountInfo.data;
        
        // For SPL tokens, we can try to read metadata if it exists
        // Use full mint address for now
        symbolMap.set(mint, mint);
      } catch (error) {
        symbolMap.set(mint, mint);
      }
    }
  } catch (error) {
    console.error('Error batch fetching token symbols:', error);
    // Fallback to full mint addresses
    for (const mint of mints) {
      symbolMap.set(mint, mint);
    }
  }
  
  return symbolMap;
}

// Known program IDs and addresses
const KNOWN_PROGRAMS = {
  TOKEN_PROGRAM: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  TOKEN_2022: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  SYSTEM_PROGRAM: '11111111111111111111111111111111',
  STAKE_PROGRAM: 'Stake11111111111111111111111111111111111111',
  ASSOCIATED_TOKEN: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  // DEX/AMM programs
  RAYDIUM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  RAYDIUM_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  RAYDIUM_CLMM: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  ORCA: '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP',
  ORCA_WHIRLPOOL: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  JUPITER: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  JUPITER_V6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  PHOENIX: 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
  LIFINITY: 'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S',
  METEORA: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  METEORA_DLMM: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  SABER: 'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ',
  MERCURIAL: 'MERLuDFBMmsHnsBSb5Q6pR9bxaENa8zD6zF8g5nKX',
  ALDRIN: 'AMM55ShdkoGRB5jVYPjWziwk8m5MpwyDgsMWHaMSQWH6',
  CROPPER: 'CTMAxxk34HjKWxQ3QLZK1HpaLXmBveao3ESePXbiyfzh',
  OPENBOOK_V1: 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',
  OPENBOOK_V2: 'opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb',
  // Lending protocols
  SOLEND: 'So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo',
  MANGO_V4: '4MangoMjqJ2firMokCjjGgoK8d4MXcrgL7XJaL3w6fVg',
  // Wrapped SOL mint address
  WRAPPED_SOL: 'So11111111111111111111111111111111111111112',
};

// Known spam addresses to filter out
const SPAM_ADDRESSES = new Set([
  'FLipG5QHjZe1H12f6rr5LCnrmqjhwuBTBp78GwzxnwkR', // Spam address
]);

/**
 * Detect transaction type and primary program based on instructions and programs involved
 * Types: 'sol', 'spl', 'defi', 'nft', 'program', 'system', 'funding'
 * Returns both type and programId for DeFi/complex transactions
 */
function detectTransactionType(tx: any): { type: TransactionType; programId?: string } {
  const instructions = tx.transaction.message.instructions || [];
  const programIds = instructions.map((ix: any) => ix.programId?.toString() || '').filter(Boolean);
  
  // Check for DEX/DeFi programs (defi) - return the specific DeFi program
  const defiPrograms = [
    KNOWN_PROGRAMS.RAYDIUM,
    KNOWN_PROGRAMS.RAYDIUM_V4,
    KNOWN_PROGRAMS.RAYDIUM_CLMM,
    KNOWN_PROGRAMS.ORCA,
    KNOWN_PROGRAMS.ORCA_WHIRLPOOL,
    KNOWN_PROGRAMS.JUPITER,
    KNOWN_PROGRAMS.JUPITER_V6,
    KNOWN_PROGRAMS.PHOENIX,
    KNOWN_PROGRAMS.LIFINITY,
    KNOWN_PROGRAMS.METEORA,
    KNOWN_PROGRAMS.METEORA_DLMM,
    KNOWN_PROGRAMS.SABER,
    KNOWN_PROGRAMS.MERCURIAL,
    KNOWN_PROGRAMS.ALDRIN,
    KNOWN_PROGRAMS.CROPPER,
    KNOWN_PROGRAMS.OPENBOOK_V1,
    KNOWN_PROGRAMS.OPENBOOK_V2,
    KNOWN_PROGRAMS.SOLEND,
    KNOWN_PROGRAMS.MANGO_V4,
    KNOWN_PROGRAMS.STAKE_PROGRAM,
  ];
  
  for (const defiProgram of defiPrograms) {
    if (programIds.includes(defiProgram)) {
      return { type: 'defi', programId: defiProgram };
    }
  }
  
  // Check for NFT minting/operations (nft)
  const hasNFTOperation = instructions.some((ix: any) => {
    const parsed = ix.parsed;
    return (parsed?.type === 'mintTo' && parsed?.info?.mintAmount === '1') || // NFT mint
           (parsed?.type === 'initializeMint' && parsed?.info?.decimals === 0); // NFT token
  });
  
  if (hasNFTOperation) {
    return { type: 'nft' };
  }
  
  // Check for account creation/funding (funding)
  const hasAccountCreation = instructions.some((ix: any) => {
    const parsed = ix.parsed;
    return parsed?.type === 'createAccount' || 
           parsed?.type === 'createAccountWithSeed' ||
           parsed?.type === 'initializeAccount';
  });
  
  if (hasAccountCreation) {
    return { type: 'funding' };
  }
  
  // Check for token program operations (spl)
  const hasTokenProgram = programIds.includes(KNOWN_PROGRAMS.TOKEN_PROGRAM) || 
                          programIds.includes(KNOWN_PROGRAMS.TOKEN_2022);
  
  if (hasTokenProgram) {
    const hasTokenTransfer = instructions.some((ix: any) => {
      const parsed = ix.parsed;
      return parsed?.type === 'transfer' || parsed?.type === 'transferChecked';
    });
    
    if (hasTokenTransfer) {
      return { type: 'spl' };
    }
  }
  
  // Check for system/consensus transactions (system)
  // These typically only involve system program with special operations
  const isSystemOnly = programIds.length === 1 && programIds[0] === KNOWN_PROGRAMS.SYSTEM_PROGRAM;
  const hasSystemOperation = instructions.some((ix: any) => {
    const parsed = ix.parsed;
    return parsed?.type === 'advanceNonceAccount' || 
           parsed?.type === 'allocate' ||
           parsed?.type === 'assign';
  });
  
  if (isSystemOnly && hasSystemOperation) {
    return { type: 'system' };
  }
  
  // Check for complex program interactions (program) - return the first complex program
  const complexProgram = programIds.find((pid: string) => 
    pid !== KNOWN_PROGRAMS.SYSTEM_PROGRAM && 
    pid !== KNOWN_PROGRAMS.TOKEN_PROGRAM &&
    pid !== KNOWN_PROGRAMS.TOKEN_2022 &&
    pid !== KNOWN_PROGRAMS.ASSOCIATED_TOKEN
  );
  
  if (complexProgram) {
    return { type: 'program', programId: complexProgram };
  }
  
  // Default to simple SOL transfer
  return { type: 'sol' };
}

/**
 * Process a batch of transactions and extract transfer data
 * Using smaller batches to improve performance and reliability
 * Gets fresh RPC connection for each call to maximize OpenSVM rotation
 */
async function fetchTransactionBatch(
  signatures: string[],
  address: string,
  rpcCounter: RPCCallCounter
): Promise<{ transfers: Transfer[]; hitRpcLimit: boolean }> {
  const transfers: Transfer[] = [];
  const startTime = Date.now();

  // Process in small batches to avoid connection overload
  const batches: string[][] = [];

  for (let i = 0; i < signatures.length; i += TRANSACTION_BATCH_SIZE) {
    batches.push(signatures.slice(i, i + TRANSACTION_BATCH_SIZE));
  }

  // Process batches with rate limiting to respect 300 RPS OpenSVM Business Plan limit
  // Limit concurrent batches to stay under EFFECTIVE_MAX_RPS (240 RPS)
  console.log(`Rate limiting: Processing ${batches.length} batches with max ${MAX_CONCURRENT_BATCHES} concurrent`);

  const results: Transfer[][] = [];

  // Process batches in chunks to respect rate limits
  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
    // Check if we've been running too long (simple check without passing startTime)
    if (Date.now() - startTime > 45000) { // 45s timeout for batch processing
       console.warn(`Batch processing timed out after ${Date.now() - startTime}ms`);
       break;
    }

    const batchChunk = batches.slice(i, i + MAX_CONCURRENT_BATCHES);
    console.log(`Processing batch chunk ${Math.floor(i / MAX_CONCURRENT_BATCHES) + 1}/${Math.ceil(batches.length / MAX_CONCURRENT_BATCHES)} with ${batchChunk.length} batches`);

    const chunkPromises = batchChunk.map((batch, batchIndex) => {
      const globalBatchIndex = i + batchIndex;
      return (async (): Promise<Transfer[]> => {
        let retries = MAX_RETRIES;
        let backoff = INITIAL_BACKOFF_MS;

        while (retries > 0) {
          try {
            // Get fresh connection for batch RPC call to maximize OpenSVM rotation
            const freshConnection = await getConnection();

            // Track RPC call - getParsedTransactions counts as 1 call
            rpcCounter.increment(1);

            // Use getParsedTransactions for much better performance than individual calls - with retry wrapper
            const batchTransactionsResult = await withRetry(
              () => freshConnection.getParsedTransactions(batch, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
              }),
              freshConnection.rpcEndpoint,
              {
                maxRetries: MAX_RETRIES,
                initialBackoffMs: INITIAL_BACKOFF_MS,
                timeoutMs: 60000,
                onRetry: (retryAttempt, error) => {
                  console.warn(`Retry ${retryAttempt} for getParsedTransactions batch ${globalBatchIndex + 1}: ${error?.message}`);
                }
              }
            );

            // Ensure we have a valid array before processing
            const batchTransactions = Array.isArray(batchTransactionsResult) 
              ? batchTransactionsResult 
              : [];

            if (!Array.isArray(batchTransactions)) {
              console.error(`getParsedTransactions returned non-array:`, typeof batchTransactionsResult);
              return []; // Return empty array if result is not an array
            }

            const batchTransfers: Transfer[] = [];

            // Process all transactions in this batch
            for (let txIndex = 0; txIndex < batchTransactions.length; txIndex++) {
              const tx = batchTransactions[txIndex];
              const signature = batch[txIndex];

              if (!tx?.meta) {
                continue; // Skip failed/missing transactions
              }

              const { preBalances, postBalances, preTokenBalances, postTokenBalances } = tx.meta;
              const accountKeys = tx.transaction.message.accountKeys;
              const blockTime = tx.blockTime! * 1000;

              // Detect transaction type and program
              const txInfo = detectTransactionType(tx);
              const txType = txInfo.type;
              const programId = txInfo.programId;

              // Collect all instructions (both top-level and inner)
              const allInstructions = [...(tx.transaction.message.instructions || [])];
              
              // Add inner instructions if they exist
              if (tx.meta.innerInstructions) {
                for (const inner of tx.meta.innerInstructions) {
                  allInstructions.push(...(inner.instructions || []));
                }
              }
              
              // FIRST: Process SOL transfers from System Program transfer instructions
              for (const instruction of allInstructions) {
                // Type guard: only process parsed instructions
                if (!('parsed' in instruction) || !instruction.parsed) continue;
                
                const { type, info } = instruction.parsed;
                
                // Handle System Program SOL transfers
                if (type === 'transfer' && info.source && info.destination && info.lamports) {
                  const sourceAddr = info.source;
                  const destAddr = info.destination;
                  
                  // Skip spam addresses
                  if (SPAM_ADDRESSES.has(sourceAddr) || SPAM_ADDRESSES.has(destAddr)) {
                    continue;
                  }
                  
                  // Only create transfer if queried address is involved
                  if (sourceAddr === address || destAddr === address) {
                    const amountSOL = info.lamports / 1e9;
                    
                    // Skip dust
                    if (amountSOL < MIN_TRANSFER_SOL) continue;
                    
                    batchTransfers.push({
                      txId: signature,
                      date: new Date(blockTime).toISOString(),
                      from: sourceAddr,
                      to: destAddr,
                      tokenSymbol: 'SOL',
                      tokenAmount: amountSOL.toString(),
                      transferType: sourceAddr === address ? 'OUT' : 'IN',
                      mint: 'SOL',
                      txType,
                      programId,
                    });
                  }
                }
                
                // Handle SPL token transferChecked and transfer instructions
                if (type === 'transferChecked' || type === 'transfer') {
                  const source = info.source;
                  const destination = info.destination;
                  
                  // Get the actual amount and mint
                  let amount: number;
                  let decimals: number;
                  let mint: string;
                  
                  if (type === 'transferChecked' && info.tokenAmount && info.mint) {
                    // transferChecked has all info we need
                    amount = info.tokenAmount.uiAmount || 0;
                    decimals = info.tokenAmount.decimals || 0;
                    mint = info.mint;
                  } else if (type === 'transfer' && info.amount) {
                    // For regular transfer, we need to look up mint from token balances
                    amount = parseFloat(info.amount || '0');
                    
                    // Find the mint by looking up the source token account in balances
                    const allTokenBalances = [
                      ...(preTokenBalances || []),
                      ...(postTokenBalances || [])
                    ];
                    
                    let foundMint: string | null = null;
                    for (const balance of allTokenBalances) {
                      const tokenAccount = accountKeys[balance.accountIndex]?.pubkey.toString();
                      if (tokenAccount === source || tokenAccount === destination) {
                        foundMint = balance.mint;
                        decimals = balance.uiTokenAmount?.decimals || 0;
                        // Convert raw amount to UI amount if we have decimals
                        if (decimals > 0) {
                          amount = amount / Math.pow(10, decimals);
                        }
                        break;
                      }
                    }
                    
                    if (!foundMint) {
                      console.warn(`Could not find mint for transfer instruction with source ${source}`);
                      continue; // Skip if we can't find the mint
                    }
                    
                    mint = foundMint;
                  } else {
                    continue;
                  }
                  
                  if (amount === 0) continue;
                  
                  // Map token accounts to their owners
                  // Source and destination are token accounts, we need to find the owners
                  let sourceOwner = 'Unknown';
                  let destOwner = 'Unknown';
                  
                  // Find source and destination owners from preTokenBalances or postTokenBalances
                  const allTokenBalances = [
                    ...(preTokenBalances || []),
                    ...(postTokenBalances || [])
                  ];
                  
                  for (const balance of allTokenBalances) {
                    const tokenAccount = accountKeys[balance.accountIndex]?.pubkey.toString();
                    if (tokenAccount === source) {
                      sourceOwner = balance.owner || sourceOwner;
                    }
                    if (tokenAccount === destination) {
                      destOwner = balance.owner || destOwner;
                    }
                  }
                  
                  // Skip spam addresses
                  if (SPAM_ADDRESSES.has(sourceOwner) || SPAM_ADDRESSES.has(destOwner)) {
                    continue;
                  }
                  
                  // Only create transfer if the queried address is involved
                  if (sourceOwner === address || destOwner === address) {
                    const isWrappedSOL = mint === KNOWN_PROGRAMS.WRAPPED_SOL;
                    
                    // Use full mint address as symbol for SPL tokens
                    const tokenSymbol = isWrappedSOL ? 'SOL' : mint;
                    
                    batchTransfers.push({
                      txId: signature,
                      date: new Date(blockTime).toISOString(),
                      from: sourceOwner,
                      to: destOwner,
                      tokenSymbol,
                      tokenAmount: amount.toString(),
                      transferType: sourceOwner === address ? 'OUT' : 'IN',
                      mint: isWrappedSOL ? 'SOL' : mint,
                      txType: isWrappedSOL ? 'sol' : 'spl',
                      programId,
                    });
                  }
                }
              }

              // SECOND: Process SPL token transfers from balance changes (fallback for non-parsed transactions)
              if (preTokenBalances && postTokenBalances && preTokenBalances.length > 0 && postTokenBalances.length > 0) {
                // Create a map of account indices to their token changes
                const tokenChanges = new Map<number, {
                  mint: string;
                  decimals: number;
                  preBal: number;
                  postBal: number;
                  owner: string;
                }>();

                // Map pre-balances
                for (const preBal of preTokenBalances) {
                  const accountIndex = preBal.accountIndex;
                  const owner = accountKeys[accountIndex]?.pubkey.toString() || '';
                  const mint = preBal.mint;
                  const decimals = preBal.uiTokenAmount?.decimals || 0;
                  
                  tokenChanges.set(accountIndex, {
                    mint,
                    decimals,
                    preBal: parseFloat(preBal.uiTokenAmount?.uiAmountString || '0'),
                    postBal: 0,
                    owner,
                  });
                }

                // Update with post-balances
                for (const postBal of postTokenBalances) {
                  const accountIndex = postBal.accountIndex;
                  const existing = tokenChanges.get(accountIndex);
                  const owner = accountKeys[accountIndex]?.pubkey.toString() || '';
                  const mint = postBal.mint;
                  const decimals = postBal.uiTokenAmount?.decimals || 0;
                  
                  if (existing) {
                    existing.postBal = parseFloat(postBal.uiTokenAmount?.uiAmountString || '0');
                  } else {
                    tokenChanges.set(accountIndex, {
                      mint,
                      decimals,
                      preBal: 0,
                      postBal: parseFloat(postBal.uiTokenAmount?.uiAmountString || '0'),
                      owner,
                    });
                  }
                }

                // Create transfers from ALL token balance changes (not just paired)
                // This captures airdrops, burns, and single-sided transfers
                tokenChanges.forEach((change) => {
                  const delta = change.postBal - change.preBal;
                  if (delta === 0) return;

                  const amount = Math.abs(delta);
                  if (amount === 0) return;

                  // Check if this is wrapped SOL
                  const isWrappedSOL = change.mint === KNOWN_PROGRAMS.WRAPPED_SOL;
                  
                  // Skip spam addresses
                  if (SPAM_ADDRESSES.has(change.owner)) {
                    return;
                  }
                  
                  // Only include if the address is involved
                  if (change.owner !== address) {
                    return; // Skip if this address isn't involved in the token transfer
                  }

                  // Use full mint address as symbol for SPL tokens
                  const tokenSymbol = isWrappedSOL ? 'SOL' : change.mint;
                  
                  batchTransfers.push({
                    txId: signature,
                    date: new Date(blockTime).toISOString(),
                    from: delta < 0 ? change.owner : 'Unknown',
                    to: delta > 0 ? change.owner : 'Unknown',
                    tokenSymbol,
                    tokenAmount: amount.toString(),
                    transferType: delta < 0 ? 'OUT' : 'IN',
                    mint: isWrappedSOL ? 'SOL' : change.mint,
                    txType: isWrappedSOL ? 'sol' : 'spl',
                    programId,
                  });
                });
              }

              // Process SOL transfers
              const maxLength = Math.min(
                accountKeys.length,
                preBalances?.length || 0,
                postBalances?.length || 0
              );

              if (maxLength > 0) {
                // First pass: collect all balance changes with their accounts
                const balanceChanges: Array<{
                  account: string;
                  delta: number;
                  amount: number;
                  index: number;
                }> = [];

                for (let index = 0; index < maxLength; index++) {
                  const preBalance = preBalances?.[index] || 0;
                  const postBalance = postBalances?.[index] || 0;
                  const delta = postBalance - preBalance;
                  const account = accountKeys[index]?.pubkey.toString() || '';

                  if (delta === 0 || !account) {
                    continue;
                  }

                  const amount = Math.abs(delta / 1e9);

                  // Skip spam addresses
                  if (isSpamAddress(account) || SPAM_ADDRESSES.has(account)) {
                    continue;
                  }

                  // Skip dust transactions
                  if (!isAboveDustThreshold(amount, MIN_TRANSFER_SOL)) {
                    continue;
                  }

                  balanceChanges.push({ account, delta, amount, index });
                }

                // Second pass: create transfers only for accounts involved in the transfer
                // FIXED: No longer using cartesian product - only create transfers for accounts that are directly involved
                const senders = balanceChanges.filter(change => change.delta < 0);
                const receivers = balanceChanges.filter(change => change.delta > 0);

                // Only create transfers if the address we're querying is involved
                if (senders.length > 0 && receivers.length > 0) {
                  // Check if address is a sender
                  const senderEntry = senders.find(s => s.account === address);
                  if (senderEntry) {
                    // Address is sending - create OUT transfer to PRIMARY receiver
                    // Use the largest receiver as the primary destination
                    const primaryReceiver = receivers.reduce((max, r) => 
                      r.amount > max.amount ? r : max
                    );
                    
                    if (senderEntry.account !== primaryReceiver.account) {
                      batchTransfers.push({
                        txId: signature,
                        date: new Date(blockTime).toISOString(),
                        from: senderEntry.account,
                        to: primaryReceiver.account,
                        tokenSymbol: 'SOL',
                        tokenAmount: senderEntry.amount.toString(),
                      transferType: 'OUT',
                      mint: 'SOL',
                      txType,
                      programId,
                    });
                    }
                  }

                  // Check if address is a receiver
                  const receiverEntry = receivers.find(r => r.account === address);
                  if (receiverEntry) {
                    // Address is receiving - create IN transfer from PRIMARY sender
                    // Use the largest sender as the primary source
                    const primarySender = senders.reduce((max, s) => 
                      s.amount > max.amount ? s : max
                    );
                    
                    if (primarySender.account !== receiverEntry.account) {
                      batchTransfers.push({
                        txId: signature,
                        date: new Date(blockTime).toISOString(),
                        from: primarySender.account,
                        to: receiverEntry.account,
                        tokenSymbol: 'SOL',
                        tokenAmount: receiverEntry.amount.toString(),
                      transferType: 'IN',
                      mint: 'SOL',
                      txType,
                      programId,
                    });
                    }
                  }
                }
              }
            }

            // Deduplicate transfers before caching
            const deduplicatedBatchTransfers = deduplicateTransfers(batchTransfers);

            // STREAMING CACHE UPDATE: Immediately cache this batch's results
            if (deduplicatedBatchTransfers.length > 0) {
              // Cache this batch asynchronously (don't wait for it)
              (async () => {
                try {
                  console.log(`Streaming cache update: Batch ${globalBatchIndex + 1} - caching ${deduplicatedBatchTransfers.length} transfers (deduplicated from ${batchTransfers.length})`);

                  const transferEntries: TransferEntry[] = deduplicatedBatchTransfers.map((transfer) => ({
                    id: crypto.randomUUID(),
                    walletAddress: address,
                    signature: transfer.txId || '',
                    timestamp: new Date(transfer.date).getTime(),
                    type: (transfer.transferType || 'transfer').toLowerCase() as 'in' | 'out' | 'transfer',
                    amount: parseFloat(transfer.tokenAmount) || 0,
                    token: transfer.tokenSymbol || 'SOL',
                    tokenSymbol: transfer.tokenSymbol || 'SOL',
                    tokenName: transfer.tokenSymbol || 'SOL',
                    from: transfer.from || '',
                    to: transfer.to || '',
                    mint: undefined,
                    usdValue: undefined,
                    isSolanaOnly: isSolanaOnlyTransaction({
                      tokenSymbol: transfer.tokenSymbol,
                      token: transfer.tokenSymbol,
                      from: transfer.from,
                      to: transfer.to
                    } as any),
                    cached: true,
                    lastUpdated: Date.now()
                  }));

                  // Store this batch immediately
                  await batchStoreTransferEntries(transferEntries);
                  await markTransfersCached(batch, address);

                  console.log(`Streaming cache complete: Batch ${globalBatchIndex + 1} cached successfully`);
                } catch (error) {
                  console.error(`Streaming cache failed for batch ${globalBatchIndex + 1}:`, error);
                  // Don't throw - this is async caching, shouldn't block main flow
                }
              })();
            }

            // If we got here, the batch was successful - return deduplicated transfers
            return deduplicatedBatchTransfers;

          } catch (err) {
            console.error(`Batch ${globalBatchIndex + 1} transaction error (${retries} retries left):`, err);
            retries--;

            if (retries > 0) {
              // Use exponential backoff
              await new Promise(resolve => setTimeout(resolve, backoff));
              backoff *= 2;
            }
          }
        }

        return []; // Return empty array if all retries failed
      })();
    });

    // Execute chunk promises in parallel and collect results
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);

    // RPC LIMIT CHECK: Stop processing if we've exceeded the RPC call limit
    if (rpcCounter.hasExceeded(MAX_RPC_CALLS_PER_REQUEST)) {
      console.warn(`RPC limit reached: ${rpcCounter.getCount()}/${MAX_RPC_CALLS_PER_REQUEST} calls. Stopping batch processing early and returning ${results.flat().length} transfers.`);
      break; // Stop processing more batches
    }

    // Add delay between chunks to respect rate limits (except for last chunk)
    if (i + MAX_CONCURRENT_BATCHES < batches.length) {
      const delayMs = Math.ceil(1000 / (EFFECTIVE_MAX_RPS / MAX_CONCURRENT_BATCHES)); // Ensure we don't exceed RPS
      console.log(`Rate limiting: Waiting ${delayMs}ms before next chunk`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // Flatten all results into transfers array
  results.forEach((batchTransfers: Transfer[]) => {
    transfers.push(...batchTransfers);
  });

  const hitRpcLimit = rpcCounter.hasExceeded(MAX_RPC_CALLS_PER_REQUEST);
  console.log(`Processed ${transfers.length} transfers in ${Date.now() - startTime}ms`);
  return { transfers, hitRpcLimit };
}

export async function processTransferRequest(
  address: string,
  offset: number,
  limit: number,
  transferType: string,
  solanaOnly: boolean,
  startTime: number,
  searchParams: URLSearchParams,
  txTypeFilters: TransactionType[] | null,
  bypassCache: boolean,
  mintFilters: string[] | null
) {
  try {
    // Check cache for existing transfers (use any cached data, not just recent)
    console.log(`Checking cache for ${address} with limit: ${limit}, offset: ${offset}`);

    // TIMEOUT PROTECTION: Fail fast if processing takes too long
    const TIMEOUT_MS = 55000; // 55 seconds
    const checkTimeout = () => {
      if (Date.now() - startTime > TIMEOUT_MS) {
        throw new Error(`Request timed out after ${Date.now() - startTime}ms`);
      }
    };

    let cachedTransfers: TransferEntry[] = [];
    
    // Skip cache if bypass requested
    if (!bypassCache) {
      try {
        const cacheResult = await getCachedTransfers(address, {
          limit: limit * 2, // Get more from cache to account for filtering
          offset,
          solanaOnly,
          transferType: transferType === 'SOL' ? 'SOL' : transferType === 'TOKEN' ? 'TOKEN' : 'ALL'
        });
        cachedTransfers = cacheResult.transfers;
        console.log(`Found ${cachedTransfers.length} cached transfers for ${address}`);
      } catch (error) {
        console.warn('Cache lookup failed, proceeding with live fetch:', error);
        cachedTransfers = [];
      }
    } else {
      console.log(`Bypassing cache as requested`);
    }

    // Combine cached transfers with fresh RPC data to meet user's request
    let allTransfers: Transfer[] = [];

    // Convert cached transfers to expected format first
    const formattedCachedTransfers = cachedTransfers.map(transfer => {
      // Determine transferType correctly based on whether the requested address is sender or receiver
      let transferType: 'IN' | 'OUT';
      if (transfer.to === address) {
        transferType = 'IN';
      } else if (transfer.from === address) {
        transferType = 'OUT';
      } else {
        // Fallback to stored type if address doesn't match (shouldn't happen but safety check)
        transferType = transfer.type.toUpperCase() === 'IN' ? 'IN' : 'OUT';
      }

      return {
        txId: transfer.signature,
        date: new Date(transfer.timestamp).toISOString(),
        from: transfer.from,
        to: transfer.to,
        tokenSymbol: transfer.tokenSymbol || transfer.token,
        tokenAmount: transfer.amount.toString(),
        transferType,
        mint: transfer.mint || (transfer.tokenSymbol === 'SOL' ? 'SOL' : 'Unknown'), // Use cached mint or default
        txType: 'sol' as TransactionType, // Default for cached (old data doesn't have this)
      };
    });

    // Always combine cache + RPC to fulfill user's complete request
    console.log(`User requested ${limit} transfers, have ${cachedTransfers.length} cached. Will fetch additional if needed...`);

    allTransfers = [...formattedCachedTransfers];
    
    // When filtering by txType, we need to fetch MORE transfers since many will be filtered out
    const effectiveLimit = txTypeFilters && txTypeFilters.length > 0 ? limit * 5 : limit;
    let remainingNeeded = effectiveLimit - cachedTransfers.length;
    
    // Declare allSignatures at outer scope so it's accessible for hitMaxLimit check
    let allSignatures: { signature: string; blockTime: number }[] = [];
    
    // Create RPC call counter for tracking usage
    const rpcCounter = new RPCCallCounter();
    
    // Track if we hit RPC limit (declare at function scope for proper access)
    let hitRpcLimit = false;

    // Smart cursor initialization: use oldest cached signature if no beforeSignature provided
    let beforeSignature = searchParams.get('beforeSignature');
    if (!beforeSignature && cachedTransfers.length > 0) {
      // Find oldest cached transaction by timestamp and use its signature
      const oldestCached = cachedTransfers.reduce((oldest, current) =>
        current.timestamp < oldest.timestamp ? current : oldest
      );
      beforeSignature = oldestCached.signature;
      console.log(`Using oldest cached signature as cursor: ${beforeSignature.substring(0, 8)}...`);
    }

    // Early exit if we already have enough transfers
    if (remainingNeeded <= 0) {
      console.log(`Cache already satisfies request: ${allTransfers.length}/${limit} transfers`);
    } else {
      // Get connection from pool for signature fetching
      const connection = await getConnection();
      const pubkey = new PublicKey(address);

      // STRATEGY: Fetch signatures from BOTH the main account AND all token accounts
      console.log(`Need ${remainingNeeded} more transfers. Fetching signatures from main account and token accounts...`);

      const seenSignatures = new Set<string>();
      
      // Phase 1a: Get signatures from main wallet address
      console.log(`Fetching signatures from main wallet: ${address.substring(0, 8)}...`);
      let currentCursor = beforeSignature;
      let signatureFetchIterations = 0;
      const maxSignatureFetches = 200; // Prevent infinite loops
      
      // SMART PAGINATION: Limit total signatures to 10k to prevent excessive memory usage
      // This prevents issues with accounts that have millions of transactions
      const MAX_TOTAL_SIGNATURES = 10000;
      
      // Calculate initial fetch target based on offset + limit
      // We need to fetch enough to satisfy the current page request
      const targetSignatures = Math.min(
        offset + limit * 2, // Fetch enough for current page + buffer for filtering
        MAX_TOTAL_SIGNATURES
      );

      console.log(`SMART PAGINATION: Target ${targetSignatures} signatures (offset: ${offset}, limit: ${limit}, max: ${MAX_TOTAL_SIGNATURES})`);

      // Fetch signatures up to our calculated limit
      while (signatureFetchIterations < maxSignatureFetches) {
        checkTimeout(); // Check for timeout
        signatureFetchIterations++;

        const signatures = await connection.getSignaturesForAddress(
          pubkey,
          {
            limit: MAX_SIGNATURES_LIMIT,
            before: currentCursor || undefined
          }
        );

        if (signatures.length === 0) break;

        // Add to collection (avoiding duplicates)
        for (const sig of signatures) {
          if (!seenSignatures.has(sig.signature)) {
            seenSignatures.add(sig.signature);
            allSignatures.push({
              signature: sig.signature,
              blockTime: sig.blockTime || 0
            });
          }
        }

        currentCursor = signatures[signatures.length - 1].signature;
        
        // EARLY STOP: Stop after fetching enough signatures for current request
        if (allSignatures.length >= targetSignatures) {
          console.log(`SMART PAGINATION: Collected ${allSignatures.length} signatures (target: ${targetSignatures})`);
          break;
        }
        
        // HARD STOP: Never fetch more than MAX_TOTAL_SIGNATURES
        if (allSignatures.length >= MAX_TOTAL_SIGNATURES) {
          console.log(`SMART PAGINATION: Hit max limit of ${MAX_TOTAL_SIGNATURES} signatures`);
          break;
        }
      }

      console.log(`Phase 1a complete: Collected ${allSignatures.length} signatures from main wallet`);

      // Phase 1b: Get all token accounts and their signatures (both SPL Token and Token2022)
      try {
        // Fetch both regular SPL Token accounts and Token2022 accounts
        const [tokenAccounts, token2022Accounts] = await Promise.all([
          connection.getParsedTokenAccountsByOwner(
            pubkey,
            { programId: new PublicKey(KNOWN_PROGRAMS.TOKEN_PROGRAM) }
          ),
          connection.getParsedTokenAccountsByOwner(
            pubkey,
            { programId: new PublicKey(KNOWN_PROGRAMS.TOKEN_2022) }
          ).catch(() => ({ value: [] })) // Token2022 might not exist, handle gracefully
        ]);

        const allTokenAccounts = [...tokenAccounts.value, ...token2022Accounts.value];

        console.log(`Found ${allTokenAccounts.length} token accounts (${tokenAccounts.value.length} SPL + ${token2022Accounts.value.length} Token2022)`);

        // Helper: sleep
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Helper: fetch signatures for a single address with pagination, rotating fresh connections per page
        async function fetchAllSignaturesForAddressPaginated(tokenPubkey: PublicKey, maxTotal = 2000) {
          const collected: { signature: string; blockTime: number }[] = [];
          const seenLocal = new Set<string>();
          let cursor: string | undefined = undefined;
          let iterations = 0;
          const perPage = Math.min(MAX_SIGNATURES_LIMIT, 1000);

          while (iterations < 50 && collected.length < maxTotal) {
            iterations++;

            let attempt = 0;
            let backoff = INITIAL_BACKOFF_MS;
            let pageResult: any[] = [];

            while (attempt < MAX_RETRIES) {
              attempt++;
              try {
                const freshConn = await getConnection();
                // Use limit=perPage and pass cursor - with retry wrapper
                const sigs = await withRetry(
                  () => freshConn.getSignaturesForAddress(tokenPubkey, {
                    limit: perPage,
                    before: cursor
                  }),
                  freshConn.rpcEndpoint,
                  {
                    maxRetries: MAX_RETRIES,
                    initialBackoffMs: INITIAL_BACKOFF_MS,
                    onRetry: (retryAttempt, error) => {
                      console.warn(`Retry ${retryAttempt} for getSignaturesForAddress ${tokenPubkey.toString().substring(0,8)}: ${error?.message}`);
                    }
                  }
                );

                if (!Array.isArray(sigs) || sigs.length === 0) {
                  pageResult = [];
                } else {
                  pageResult = sigs;
                }

                break; // success
              } catch (err: any) {
                console.warn(`getSignaturesForAddress error for ${tokenPubkey.toString().substring(0,8)} (attempt ${attempt}):`, err?.message || err);
                // Backoff on transient network errors
                await sleep(backoff);
                backoff *= 2;
              }
            }

            if (!pageResult || pageResult.length === 0) break;

            for (const s of pageResult) {
              if (!seenLocal.has(s.signature)) {
                seenLocal.add(s.signature);
                collected.push({
                  signature: s.signature,
                  blockTime: s.blockTime || 0
                });
              }
            }

            // Prepare cursor for next page
            const last = pageResult[pageResult.length - 1];
            if (!last || !last.signature) break;
            cursor = last.signature;

            // Stop early if we've collected enough
            if (collected.length >= maxTotal) break;
          }

          return collected;
        }

        // Limit parallelism so we don't flood RPC endpoints (use chunks)
        const TOKEN_SIG_FETCH_CONCURRENCY = 128; // Increased from 8 to 32 for faster parallel fetching
        for (let i = 0; i < allTokenAccounts.length; i += TOKEN_SIG_FETCH_CONCURRENCY) {
          checkTimeout(); // Check for timeout
          const chunk = allTokenAccounts.slice(i, i + TOKEN_SIG_FETCH_CONCURRENCY);
          console.log(`Fetching signatures for token account chunk ${Math.floor(i / TOKEN_SIG_FETCH_CONCURRENCY) + 1}/${Math.ceil(allTokenAccounts.length / TOKEN_SIG_FETCH_CONCURRENCY)} with ${chunk.length} accounts`);

          const chunkPromises = chunk.map(async (tokenAccount) => {
            const tokenAccountPubkey = tokenAccount.pubkey;
            try {
              // Fetch paginated signatures for this token account (rotating connections internally)
              const sigs = await fetchAllSignaturesForAddressPaginated(tokenAccountPubkey, 2000);
              console.log(`Token account ${tokenAccountPubkey.toString().substring(0, 8)}... contributed ${sigs.length} signatures (paginated)`);
              return sigs;
            } catch (error) {
              console.warn(`Failed to get signatures for token account ${tokenAccountPubkey.toString()}:`, error);
              return [];
            }
          });

          const tokenAccountSigResults = await Promise.all(chunkPromises);

          for (const tokenAccountSigs of tokenAccountSigResults) {
            for (const sig of tokenAccountSigs) {
              if (!seenSignatures.has(sig.signature)) {
                seenSignatures.add(sig.signature);
                allSignatures.push(sig);
              }
            }
          }

          // Small delay between chunks to reduce burstiness
          if (i + TOKEN_SIG_FETCH_CONCURRENCY < allTokenAccounts.length) {
            await sleep(50);
          }
        }

        console.log(`Phase 1b complete: Collected ${allSignatures.length} total signatures (including ${allTokenAccounts.length} token accounts) - PAGINATED FETCH`);
      } catch (error) {
        console.warn('Failed to fetch token accounts:', error);
      }

      // Phase 1c: Deduplicate signatures again (final check before processing)
      // Use a Map to keep the object with the blockTime
      const uniqueSignaturesMap = new Map<string, { signature: string; blockTime: number }>();
      for (const sig of allSignatures) {
        if (!uniqueSignaturesMap.has(sig.signature)) {
          uniqueSignaturesMap.set(sig.signature, sig);
        }
      }
      
      let uniqueSignatures = Array.from(uniqueSignaturesMap.values());
      
      if (uniqueSignatures.length < allSignatures.length) {
        console.log(`Deduplicated signatures: ${allSignatures.length} → ${uniqueSignatures.length} (removed ${allSignatures.length - uniqueSignatures.length} duplicates)`);
        allSignatures = uniqueSignatures;
      }

      // Phase 2: Process all transactions in parallel for maximum performance
      if (allSignatures.length > 0) {
        // SORT by blockTime descending (newest first)
        allSignatures.sort((a, b) => b.blockTime - a.blockTime);
        
        // SLICE to reduce RPC calls - fetch only what we likely need
        // Fetch 2x the limit (reduced from 4x) since we are more efficient now
        const fetchLimit = offset + limit * 2;
        const signaturesToFetch = allSignatures.slice(0, fetchLimit);
        
        console.log(`Phase 2: Processing ${signaturesToFetch.length} unique transactions (sliced from ${allSignatures.length}) in parallel...`);

        // Map to strings for the batch fetcher
        const signatureStrings = signaturesToFetch.map(s => s.signature);

        checkTimeout(); // Check for timeout before batch processing
        const result = await fetchTransactionBatch(signatureStrings, address, rpcCounter);
        hitRpcLimit = result.hitRpcLimit;
        
        // Check RPC limit
        if (hitRpcLimit || rpcCounter.hasExceeded(MAX_RPC_CALLS_PER_REQUEST)) {
          console.warn(`RPC limit reached: ${rpcCounter.getCount()} calls (max: ${MAX_RPC_CALLS_PER_REQUEST})`);
        }

        // Apply filtering to new transfers
        // const filteredNewTransfers = result.transfers
        //   .filter(transfer => {
        //     const amount = parseFloat(transfer.tokenAmount);
        //     return isAboveDustThreshold(amount, MIN_TRANSFER_SOL) &&
        //       transfer.from !== transfer.to &&
        //       transfer.from.length >= MIN_WALLET_ADDRESS_LENGTH &&
        //       transfer.to.length >= MIN_WALLET_ADDRESS_LENGTH;
        //   });

        // console.log(`Processed ${result.transfers.length} raw transfers, ${filteredNewTransfers.length} after filtering`);

        // Add to our collection
        allTransfers.push(...result.transfers);
      }
    }

    // Deduplicate all transfers before filtering and sorting
    console.log(`Deduplicating ${allTransfers.length} total transfers...`);
    allTransfers = deduplicateTransfers(allTransfers);
    console.log(`After deduplication: ${allTransfers.length} unique transfers`);

    // Fetch token metadata for all SPL tokens to get real symbols
    const splTransfers = allTransfers.filter(t => t.txType === 'spl' && t.mint !== 'SOL' && t.mint !== 'Unknown');
    if (splTransfers.length > 0) {
      const uniqueMints = [...new Set(splTransfers.map(t => t.mint))];
      console.log(`Fetching metadata for ${uniqueMints.length} unique token mints...`);
      
      try {
        const connection = await getConnection();
        const tokenMetadata = await batchFetchTokenMetadata(connection, uniqueMints);
        
        // Update tokenSymbol for all SPL transfers with fetched metadata
        for (const transfer of allTransfers) {
          if (transfer.txType === 'spl' && transfer.mint !== 'SOL' && transfer.mint !== 'Unknown') {
            const metadata = tokenMetadata.get(transfer.mint);
            if (metadata) {
              transfer.tokenSymbol = metadata.symbol;
            }
          }
        }
        
        console.log(`Updated ${allTransfers.filter(t => tokenMetadata.has(t.mint)).length} transfers with token symbols`);
      } catch (error) {
        console.warn('Failed to fetch token metadata, using mint addresses as symbols:', error);
      }
    }

    // Apply data quality filters
    allTransfers = allTransfers.filter(transfer => {
      // Remove self-transfers (from === to)
      if (transfer.from === transfer.to) {
        return false;
      }
      
      // Ensure both from and to are valid addresses
      if (transfer.from.length < MIN_WALLET_ADDRESS_LENGTH || 
          transfer.to.length < MIN_WALLET_ADDRESS_LENGTH) {
        return false;
      }
      
      // Ensure amount is valid
      const amount = parseFloat(transfer.tokenAmount);
      if (isNaN(amount) || amount <= 0) {
        return false;
      }
      
      return true;
    });

    // Apply txType filter if specified
    if (txTypeFilters && txTypeFilters.length > 0) {
      console.log(`Applying txType filter: ${txTypeFilters.join(',')}`);
      allTransfers = allTransfers.filter(transfer => txTypeFilters.includes(transfer.txType));
    }

    // Apply mint filter if specified
    if (mintFilters && mintFilters.length > 0) {
      console.log(`Applying mint filter for ${mintFilters.length} mints`);
      allTransfers = allTransfers.filter(transfer => 
        mintFilters.includes(transfer.mint)
      );
    }

    // Sort all transfers by date descending (newest first) and trim to requested limit
    const finalTransfers = allTransfers
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(offset, offset + limit);

    const hasMore = allTransfers.length > offset + limit;

    // Determine if we hit the max signature limit (indicating there may be more data)
    const hitMaxLimit = allSignatures && allSignatures.length >= 10000;
    
    const rpcCallCount = rpcCounter.getCount();
    console.log(`API returning ${finalTransfers.length} transfers (${cachedTransfers.length} from cache + ${allTransfers.length - cachedTransfers.length} from RPC)`);
    console.log(`Total unique transfers found: ${allTransfers.length}${hitMaxLimit ? '+' : ''}`);
    console.log(`RPC calls made: ${rpcCallCount}`);

    return NextResponse.json({
      data: finalTransfers,
      hasMore,
      total: finalTransfers.length,
      originalTotal: allTransfers.length,
      hitMaxLimit, // Indicates if we stopped at 10k limit (there may be more)
      hitRpcLimit, // Indicates if we stopped due to RPC call limit (1000 calls)
      totalDisplay: hitMaxLimit ? `${allTransfers.length}+` : allTransfers.length, // For UI display
      nextPageSignature: beforeSignature,
      fromCache: cachedTransfers.length === allTransfers.length,
      rpcCalls: rpcCallCount // Include RPC call count in response
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('processTransferRequest Error:', error);
    const errorTime = Date.now() - startTime;
    console.error(`processTransferRequest failed after ${errorTime}ms`);

    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const startTime = Date.now();

  try {
    console.log(`[API] Starting transfer fetch`);
    const params = await context.params;
    const { address: rawAddress } = params;
    const address = decodeURIComponent(String(rawAddress));
    console.log(`Starting transfer fetch for ${address}`);

    const searchParams = request.nextUrl.searchParams;
    
    // RATE LIMITING: Check if this address has exceeded request limits
    const now = Date.now();
    const addressTimestamps = requestTimestamps.get(address) || [];
    
    // Remove timestamps older than the window
    const recentTimestamps = addressTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    
    if (recentTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      console.warn(`Rate limit exceeded for address ${address}: ${recentTimestamps.length} requests in last minute`);
      return NextResponse.json(
        { 
          error: 'Too many requests. Please wait before trying again.',
          retryAfter: Math.ceil((recentTimestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000)
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Retry-After': Math.ceil((recentTimestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000).toString()
          }
        }
      );
    }
    
    // Record this request
    recentTimestamps.push(now);
    requestTimestamps.set(address, recentTimestamps);
    
    // Clean up old entries periodically (keep map from growing unbounded)
    if (requestTimestamps.size > 10000) {
      console.log(`Cleaning up rate limit map (size: ${requestTimestamps.size})`);
      const cutoff = now - RATE_LIMIT_WINDOW_MS * 2;
      for (const [addr, timestamps] of requestTimestamps.entries()) {
        const recent = timestamps.filter(ts => ts > cutoff);
        if (recent.length === 0) {
          requestTimestamps.delete(addr);
        } else {
          requestTimestamps.set(addr, recent);
        }
      }
    }

    // INPUT VALIDATION: Validate and sanitize offset parameter
    const rawOffset = searchParams.get('offset');
    let offset = parseInt(rawOffset || '0');
    
    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid offset parameter. Must be a non-negative integer.' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (offset > MAX_OFFSET) {
      console.warn(`Offset ${offset} exceeds maximum of ${MAX_OFFSET}, rejecting request`);
      return NextResponse.json(
        { error: `Offset too large. Maximum offset is ${MAX_OFFSET}.` },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // INPUT VALIDATION: Validate and sanitize limit parameter
    const rawLimit = searchParams.get('limit');
    const requestedLimit = parseInt(rawLimit || '50');
    
    if (isNaN(requestedLimit) || requestedLimit < MIN_LIMIT) {
      return NextResponse.json(
        { error: `Invalid limit parameter. Must be an integer >= ${MIN_LIMIT}.` },
        { status: 400, headers: corsHeaders }
      );
    }
    
    if (requestedLimit > MAX_LIMIT) {
      console.warn(`Requested limit ${requestedLimit} exceeds maximum of ${MAX_LIMIT}, rejecting request`);
      return NextResponse.json(
        { error: `Limit too large. Maximum limit is ${MAX_LIMIT}.` },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const limit = requestedLimit; // Use validated limit directly
    const transferType = searchParams.get('transferType') || 'ALL';
    const solanaOnly = searchParams.get('solanaOnly') === 'true';
    const bypassCache = searchParams.get('bypassCache') === 'true';
    // Get transaction type filters (comma-separated: sol,spl,defi,nft,program,system,funding)
    // Default to ALL types if not specified
    const txTypeFilter = searchParams.get('txType');
    const txTypeFilters: TransactionType[] | null = txTypeFilter 
      ? txTypeFilter.split(',').filter(t => ['sol', 'spl', 'defi', 'nft', 'program', 'system', 'funding'].includes(t)) as TransactionType[]
      : ['sol', 'spl', 'defi', 'nft', 'program', 'system', 'funding']; // Default to ALL types
    // Get mint filters (comma-separated mint addresses to track specific tokens)
    const mintFilter = searchParams.get('mints');
    const mintFilters: string[] | null = mintFilter
      ? mintFilter.split(',').map(m => m.trim()).filter(m => m.length > 0)
      : null;

    // Validate address
    if (!isValidSolanaAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Solana address format' },
        {
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Create request key for coordination
    const requestKey = `${address}-${offset}-${limit}-${transferType}-${solanaOnly}`;

    // Check if there's already a pending request for this exact query
    if (pendingRequests.has(requestKey)) {
      console.log(`Waiting for existing request: ${requestKey}`);
      try {
        const result = await pendingRequests.get(requestKey);
        console.log(`Reusing result from concurrent request`);
        return result;
      } catch (error) {
        console.error('Concurrent request failed, proceeding with new request:', error);
        pendingRequests.delete(requestKey);
      }
    }

    // Create promise for this request
    const requestPromise = (async () => {
      try {
        return await processTransferRequest(address, offset, limit, transferType, solanaOnly, startTime, searchParams, txTypeFilters, bypassCache, mintFilters);
      } finally {
        // Always clean up the pending request
        pendingRequests.delete(requestKey);
      }
    })();

    // Store the promise
    pendingRequests.set(requestKey, requestPromise);

    // Execute and return the result
    return await requestPromise;

  } catch (error) {
    console.error('API Error:', error);
    const errorTime = Date.now() - startTime;
    console.error(`Request failed after ${errorTime}ms`);

    return NextResponse.json(
      { error: 'Failed to fetch transfers' },
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
