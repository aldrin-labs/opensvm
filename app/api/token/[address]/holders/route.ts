import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { getConnection } from '@/lib/solana-connection-server';
import { rateLimiter, RateLimitError } from '@/lib/rate-limit';

// Constants
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_ACCOUNT_SIZE = 165;
const BALANCE_OFFSET = 64;
const BALANCE_LENGTH = 8;

// Cache for token holder data
const holdersCache = new Map<string, { holders: any[]; totalHolders: number; timestamp: number }>();
const volumeCache = new Map<string, { volume: number; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const VOLUME_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for volume data

// Rate limit configuration
const HOLDERS_RATE_LIMIT = {
  limit: 50,
  windowMs: 60000,
  maxRetries: 1,
  initialRetryDelay: 100,
  maxRetryDelay: 1000
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const baseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  try {
    // Apply rate limiting
    try {
      await rateLimiter.rateLimit('TOKEN_HOLDERS', HOLDERS_RATE_LIMIT);
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.warn('Rate limit exceeded for TOKEN_HOLDERS');
        return NextResponse.json(
          {
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil(error.retryAfter / 1000)
          },
          {
            status: 429,
            headers: {
              ...baseHeaders,
              'Retry-After': Math.ceil(error.retryAfter / 1000).toString()
            }
          }
        );
      }
      throw error;
    }

    const params = await context.params;
    const { address } = params;
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const minBalance = searchParams.get('minBalance') ? parseFloat(searchParams.get('minBalance')!) : 0;
    const minVolume = searchParams.get('minVolume') ? parseFloat(searchParams.get('minVolume')!) : 0;
    const volumeHours = searchParams.get('volumeHours') ? parseInt(searchParams.get('volumeHours')!) : 24;
    const sortBy = searchParams.get('sortBy') || 'balance'; // balance, address, or volume
    const order = searchParams.get('order') || 'desc'; // desc or asc
    const includeVolume = minVolume > 0 || sortBy === 'volume' || searchParams.get('includeVolume') === 'true';

    // Validate mint address
    let mintPubkey: PublicKey;
    try {
      mintPubkey = new PublicKey(address);
    } catch (error) {
      console.error('Invalid mint address format:', address);
      return NextResponse.json(
        { error: 'Invalid mint address format' },
        { status: 400, headers: baseHeaders }
      );
    }

    // Check cache first (only if not filtering/sorting by volume)
    const cacheKey = `${address}-${minBalance}-${includeVolume ? `vol${minVolume}-${volumeHours}h` : 'novol'}`;
    const cached = holdersCache.get(cacheKey);
    const now = Date.now();
    
    if (!includeVolume && cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log(`Using cached holder data for ${address}: ${cached.totalHolders} total holders`);
      
      // Apply sorting
      let sortedHolders = [...cached.holders];
      if (sortBy === 'balance') {
        sortedHolders.sort((a, b) => {
          const diff = BigInt(b.balance) - BigInt(a.balance);
          return order === 'desc' ? Number(diff) : -Number(diff);
        });
      } else if (sortBy === 'address') {
        sortedHolders.sort((a, b) => {
          const comp = a.address.localeCompare(b.address);
          return order === 'desc' ? -comp : comp;
        });
      }
      
      // Apply pagination
      const paginatedHolders = sortedHolders.slice(offset, offset + limit);
      
      return NextResponse.json({
        mint: address,
        totalHolders: cached.totalHolders,
        fetchedAt: new Date(cached.timestamp).toISOString(),
        holders: paginatedHolders,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < cached.totalHolders,
          nextOffset: offset + limit < cached.totalHolders ? offset + limit : null
        }
      }, { headers: baseHeaders });
    }

    // Get connection
    const connection = await getConnection();

    // Get mint info for decimals
    let decimals = 9; // Default decimals
    try {
      const mintInfo = await getMint(connection, mintPubkey);
      decimals = mintInfo.decimals;
    } catch (error) {
      console.warn('Could not fetch mint info, using default decimals:', error);
    }

    console.log(`Fetching holders for mint ${address} with decimals ${decimals}`);

    // Fetch all token accounts for this mint using getProgramAccounts
    const accounts = await connection.getProgramAccounts(
      TOKEN_PROGRAM_ID,
      {
        dataSlice: {
          offset: BALANCE_OFFSET,
          length: BALANCE_LENGTH
        },
        filters: [
          {
            dataSize: TOKEN_ACCOUNT_SIZE
          },
          {
            memcmp: {
              offset: 0,
              bytes: mintPubkey.toBase58()
            }
          }
        ]
      }
    );

    console.log(`Found ${accounts.length} total accounts for mint ${address}`);

    // Process accounts and filter out zero balances
    let holders: any[] = [];
    const minBalanceRaw = minBalance * Math.pow(10, decimals);
    
    for (const account of accounts) {
      try {
        // Read balance from the data slice (8 bytes, little-endian)
        const balanceBuffer = account.account.data;
        
        // Check if balance is non-zero
        if (!balanceBuffer.equals(Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]))) {
          const balance = balanceBuffer.readBigUInt64LE();
          const balanceNumber = Number(balance);
          
          // Apply minimum balance filter
          if (balanceNumber >= minBalanceRaw) {
            const uiBalance = balanceNumber / Math.pow(10, decimals);
            
            holders.push({
              address: account.pubkey.toBase58(),
              balance: balance.toString(),
              uiBalance: uiBalance,
              decimals: decimals
            });
          }
        }
      } catch (error) {
        console.error('Error processing account:', error);
      }
    }

    console.log(`Found ${holders.length} non-zero holders (after filtering)`);

    // If volume filtering is requested, fetch transaction data for each holder
    if (includeVolume) {
      console.log(`Fetching volume data for ${holders.length} holders (last ${volumeHours} hours)...`);
      
      const cutoffTime = Math.floor(Date.now() / 1000) - (volumeHours * 3600);
      const volumePromises = holders.slice(0, 100).map(async (holder) => { // Limit to first 100 for performance
        const volumeCacheKey = `${holder.address}-${volumeHours}h`;
        
        // Check volume cache
        const cachedVolume = volumeCache.get(volumeCacheKey);
        if (cachedVolume && (now - cachedVolume.timestamp) < VOLUME_CACHE_DURATION) {
          return { ...holder, volume24h: cachedVolume.volume };
        }
        
        try {
          // Fetch recent signatures for this holder
          const signatures = await connection.getSignaturesForAddress(
            new PublicKey(holder.address),
            { limit: 100 } // Get last 100 transactions
          );
          
          let totalVolume = 0;
          
          // Filter signatures by time and fetch transaction details
          const recentSignatures = signatures.filter(sig => sig.blockTime && sig.blockTime > cutoffTime);
          
          for (const sig of recentSignatures.slice(0, 20)) { // Limit to 20 transactions for performance
            try {
              const tx = await connection.getParsedTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0
              });
              
              if (tx && tx.meta && tx.transaction) {
                // Look for token transfers involving this holder and mint
                const instructions = tx.transaction.message.instructions;
                
                for (const instruction of instructions) {
                  if ('parsed' in instruction && instruction.program === 'spl-token') {
                    const parsed = instruction.parsed;
                    if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
                      const info = parsed.info;
                      
                      // Check if this transfer involves our mint
                      if ((info.source === holder.address || info.destination === holder.address) &&
                          (info.mint === address || info.tokenAmount?.mint === address)) {
                        
                        const amount = info.amount || info.tokenAmount?.amount || '0';
                        const uiAmount = parseFloat(amount) / Math.pow(10, decimals);
                        totalVolume += uiAmount;
                      }
                    }
                  }
                }
              }
            } catch (txError) {
              console.warn(`Error fetching transaction ${sig.signature}:`, txError);
            }
          }
          
          // Cache the volume data
          volumeCache.set(volumeCacheKey, {
            volume: totalVolume,
            timestamp: now
          });
          
          return { ...holder, volume24h: totalVolume };
        } catch (error) {
          console.warn(`Error fetching volume for ${holder.address}:`, error);
          return { ...holder, volume24h: 0 };
        }
      });
      
      // Wait for all volume calculations
      const holdersWithVolume = await Promise.all(volumePromises);
      
      // Add volume data to remaining holders (set to 0)
      for (let i = 100; i < holders.length; i++) {
        holders[i].volume24h = 0;
      }
      
      // Replace first 100 holders with volume data
      holders.splice(0, 100, ...holdersWithVolume);
      
      // Filter by minimum volume if specified
      if (minVolume > 0) {
        const beforeFilter = holders.length;
        holders = holders.filter(h => h.volume24h >= minVolume);
        console.log(`Filtered from ${beforeFilter} to ${holders.length} holders by volume > ${minVolume}`);
      }
    }

    // Cache the results
    holdersCache.set(cacheKey, {
      holders,
      totalHolders: holders.length,
      timestamp: now
    });
    
    // Cache cleanup - remove old entries
    for (const [key, value] of holdersCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION * 2) {
        holdersCache.delete(key);
      }
    }

    // Apply sorting
    if (sortBy === 'balance') {
      holders.sort((a, b) => {
        const diff = BigInt(b.balance) - BigInt(a.balance);
        return order === 'desc' ? Number(diff) : -Number(diff);
      });
    } else if (sortBy === 'address') {
      holders.sort((a, b) => {
        const comp = a.address.localeCompare(b.address);
        return order === 'desc' ? -comp : comp;
      });
    } else if (sortBy === 'volume' && includeVolume) {
      holders.sort((a, b) => {
        const aVol = a.volume24h || 0;
        const bVol = b.volume24h || 0;
        return order === 'desc' ? bVol - aVol : aVol - bVol;
      });
    }

    // Apply pagination
    const paginatedHolders = holders.slice(offset, offset + limit);

    // Calculate statistics
    const totalBalance = holders.reduce((sum, h) => sum + parseFloat(h.uiBalance), 0);
    const avgBalance = holders.length > 0 ? totalBalance / holders.length : 0;
    const topHolders = holders.slice(0, 10);
    const topHoldersPercentage = topHolders.reduce((sum, h) => sum + parseFloat(h.uiBalance), 0) / totalBalance * 100;
    
    const statistics: any = {
      totalSupplyHeld: totalBalance,
      averageBalance: avgBalance,
      medianBalance: holders.length > 0 ? holders[Math.floor(holders.length / 2)]?.uiBalance : 0,
      top10Concentration: isNaN(topHoldersPercentage) ? 0 : topHoldersPercentage.toFixed(2) + '%'
    };
    
    // Add volume statistics if included
    if (includeVolume) {
      const totalVolume = holders.reduce((sum, h) => sum + (h.volume24h || 0), 0);
      const avgVolume = holders.length > 0 ? totalVolume / holders.length : 0;
      const activeTraders = holders.filter(h => h.volume24h > 0).length;
      
      statistics.volumeStats = {
        totalVolume: totalVolume,
        averageVolume: avgVolume,
        activeTraders: activeTraders,
        activeTradersPercentage: holders.length > 0 ? ((activeTraders / holders.length) * 100).toFixed(2) + '%' : '0%',
        volumePeriodHours: volumeHours
      };
    }

    return NextResponse.json({
      mint: address,
      totalHolders: holders.length,
      fetchedAt: new Date().toISOString(),
      statistics,
      holders: paginatedHolders,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < holders.length,
        nextOffset: offset + limit < holders.length ? offset + limit : null
      },
      filters: {
        minBalance: minBalance > 0 ? minBalance : undefined,
        minVolume: includeVolume && minVolume > 0 ? minVolume : undefined,
        volumeHours: includeVolume ? volumeHours : undefined
      }
    }, { headers: baseHeaders });

  } catch (error) {
    console.error('Error fetching token holders:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Specific error handling
    if (errorMessage.includes('getProgramAccounts')) {
      return NextResponse.json(
        { 
          error: 'RPC provider does not support getProgramAccounts',
          message: 'Please use an RPC provider that supports the full Solana RPC spec (e.g., Helius, QuickNode, or a self-hosted node).'
        },
        { status: 503, headers: baseHeaders }
      );
    }
    
    if (errorMessage.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout - this token may have too many holders. Try using pagination.' },
        { status: 408, headers: baseHeaders }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch token holders', details: errorMessage },
      { status: 500, headers: baseHeaders }
    );
  }
}
