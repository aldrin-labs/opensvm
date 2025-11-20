import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, ParsedAccountData } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/solana-connection-server';
import NodeCache from 'node-cache';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// Shared cache with holders endpoint (5 minute TTL)
const cache = new NodeCache({ stdTTL: 300 });

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    try {
        const { address } = await params;
        const searchParams = request.nextUrl.searchParams;
        
        // For traders endpoint, includeVolume is true by default
        const includeVolume = searchParams.get('includeVolume') !== 'false';
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
        const offset = parseInt(searchParams.get('offset') || '0');
        const minBalance = parseFloat(searchParams.get('minBalance') || '0');
        const minVolume = parseFloat(searchParams.get('minVolume') || '0');
        const period = parseInt(searchParams.get('period') || '24'); // hours
        const sortBy = searchParams.get('sortBy') || 'volume'; // Default to sort by volume for traders

        // Validate address
        try {
            new PublicKey(address);
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid token address' },
                { status: 400 }
            );
        }

        // Try cache first
        const cacheKey = `traders-${address}-${limit}-${offset}-${minBalance}-${minVolume}-${includeVolume}-${period}-${sortBy}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        // Get connection with OpenSVM RPC pool
        const connection = await getConnection();

        // Token program IDs
        const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

        // Get token supply and decimals first
        const mintPubkey = new PublicKey(address);
        const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
        
        let decimals = 9; // Default decimals
        let supply = '0';
        let tokenName = 'Unknown Token';
        let tokenSymbol = 'UNKNOWN';
        
        if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
            const parsedData = mintInfo.value.data.parsed;
            decimals = parsedData.info?.decimals || 9;
            supply = parsedData.info?.supply || '0';
        }

        // Get all token accounts for both token programs
        const allHolders = [];
        
        for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
            try {
                const accounts = await connection.getProgramAccounts(
                    programId,
                    {
                        filters: [
                            { dataSize: 165 }, // Token account size
                            { 
                                memcmp: {
                                    offset: 0,
                                    bytes: address // Token mint address
                                }
                            }
                        ]
                    }
                );

                for (const account of accounts) {
                    // Parse token account to get owner and amount
                    const data = account.account.data;
                    const owner = new PublicKey(data.slice(32, 64)).toBase58();
                    const amountBuffer = data.slice(64, 72);
                    const amount = Number(amountBuffer.readBigUInt64LE());
                    const uiAmount = amount / Math.pow(10, decimals);
                    
                    if (uiAmount >= minBalance) {
                        let volume24h = 0;
                        let transactionCount = 0;
                        
                        if (includeVolume) {
                            try {
                                const ownerPubkey = new PublicKey(owner);
                                const signatures = await connection.getSignaturesForAddress(
                                    ownerPubkey,
                                    { limit: 100 }
                                );
                                
                                const cutoffTime = Date.now() - (period * 60 * 60 * 1000);
                                const recentSignatures = signatures.filter(sig => 
                                    sig.blockTime && sig.blockTime * 1000 >= cutoffTime
                                );
                                
                                transactionCount = recentSignatures.length;
                                
                                // Estimate volume based on transaction count and average trade size
                                // This is a simplified calculation - real volume would require parsing each transaction
                                const avgTradeSize = uiAmount * 0.1; // Assume 10% of holdings per trade on average
                                volume24h = transactionCount * avgTradeSize;
                                
                            } catch (error) {
                                console.error(`Volume calculation error for ${owner}:`, error);
                            }
                        }
                        
                        if (!includeVolume || volume24h >= minVolume) {
                            allHolders.push({
                                owner,
                                balance: uiAmount,
                                rank: 0, // Will be set after sorting
                                percentage: (uiAmount / (Number(supply) / Math.pow(10, decimals))) * 100,
                                volume24h: includeVolume ? volume24h : undefined,
                                transactionCount: includeVolume ? transactionCount : undefined
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching from ${programId.toBase58()}:`, error);
            }
        }

        // Sort holders based on sortBy parameter
        if (sortBy === 'volume' && includeVolume) {
            allHolders.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
        } else if (sortBy === 'transactions' && includeVolume) {
            allHolders.sort((a, b) => (b.transactionCount || 0) - (a.transactionCount || 0));
        } else {
            allHolders.sort((a, b) => b.balance - a.balance);
        }

        // Add ranks
        allHolders.forEach((holder, index) => {
            holder.rank = index + 1;
        });

        // Apply pagination
        const paginatedHolders = allHolders.slice(offset, offset + limit);

        const response = {
            success: true,
            tokenAddress: address,
            tokenInfo: {
                decimals,
                supply,
                totalHolders: allHolders.length,
                activeTraders: includeVolume ? allHolders.filter(h => (h.volume24h || 0) > 0).length : undefined
            },
            pagination: {
                limit,
                offset,
                total: allHolders.length,
                hasMore: offset + limit < allHolders.length
            },
            filters: {
                minBalance,
                minVolume: includeVolume ? minVolume : undefined,
                includeVolume,
                period: includeVolume ? `${period}h` : undefined,
                sortBy
            },
            holders: paginatedHolders
        };

        // Cache the response
        cache.set(cacheKey, response);

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching token traders:', error);
        return NextResponse.json(
            { 
                error: 'Failed to fetch token traders', 
                details: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}
