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
        
        // Force include volume and sort by volume
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
        const offset = parseInt(searchParams.get('offset') || '0');
        const minBalance = parseFloat(searchParams.get('minBalance') || '0');
        const minVolume = parseFloat(searchParams.get('minVolume') || '0');
        const period = parseInt(searchParams.get('period') || '24'); // hours

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
        const cacheKey = `holdersByVolume-${address}-${limit}-${offset}-${minBalance}-${minVolume}-${period}`;
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
                        
                        if (volume24h >= minVolume) {
                            allHolders.push({
                                owner,
                                balance: uiAmount,
                                rank: 0, // Will be set after sorting
                                percentage: (uiAmount / (Number(supply) / Math.pow(10, decimals))) * 100,
                                volume24h,
                                transactionCount
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching from ${programId.toBase58()}:`, error);
            }
        }

        // Sort holders by volume
        allHolders.sort((a, b) => b.volume24h - a.volume24h);

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
                activeTraders: allHolders.filter(h => h.volume24h > 0).length
            },
            pagination: {
                limit,
                offset,
                total: allHolders.length,
                hasMore: offset + limit < allHolders.length
            },
            filters: {
                minBalance,
                minVolume,
                period: `${period}h`,
                sortedBy: 'volume'
            },
            holders: paginatedHolders
        };

        // Cache the response
        cache.set(cacheKey, response);

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching token holders by volume:', error);
        return NextResponse.json(
            { 
                error: 'Failed to fetch token holders by volume', 
                details: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}
