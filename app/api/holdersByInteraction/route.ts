import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import NodeCache from 'node-cache';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


// Shared cache (5 minute TTL)
const cache = new NodeCache({ stdTTL: 300 });

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        
        // Required parameter: program address
        const program = searchParams.get('program');
        if (!program) {
            return NextResponse.json(
                { error: 'Missing required parameter: program' },
                { status: 400 }
            );
        }

        // Optional parameters
        const period = searchParams.get('period') || '24h';
        const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
        const offset = parseInt(searchParams.get('offset') || '0');
        const minInteractions = parseInt(searchParams.get('minInteractions') || '1');

        // Parse period to hours
        let periodHours = 24; // default
        if (period.endsWith('h')) {
            periodHours = parseInt(period.slice(0, -1));
        } else if (period.endsWith('d')) {
            periodHours = parseInt(period.slice(0, -1)) * 24;
        }

        // Validate program address
        let programPubkey: PublicKey;
        try {
            programPubkey = new PublicKey(program);
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid program address' },
                { status: 400 }
            );
        }

        // Try cache first
        const cacheKey = `interactors-${program}-${period}-${limit}-${offset}-${minInteractions}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            return NextResponse.json(cached);
        }

        // Get RPC endpoint
        const rpcEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcEndpoint, 'confirmed');

        // Get recent signatures for the program
        const programSignatures = await connection.getSignaturesForAddress(
            programPubkey,
            { limit: 1000 } // Get more signatures to find unique interactors
        );

        // Calculate cutoff time
        const cutoffTime = Date.now() - (periodHours * 60 * 60 * 1000);
        
        // Filter signatures by time and extract unique signers
        const interactorMap = new Map<string, {
            address: string;
            interactionCount: number;
            firstSeen: number;
            lastSeen: number;
            signatures: string[];
        }>();

        for (const sig of programSignatures) {
            if (sig.blockTime && sig.blockTime * 1000 >= cutoffTime) {
                // Get transaction details to find the signer
                try {
                    const tx = await connection.getParsedTransaction(sig.signature, {
                        maxSupportedTransactionVersion: 0
                    });
                    
                    if (tx && tx.transaction) {
                        // Get the fee payer (first signer)
                        const signer = tx.transaction.message.accountKeys[0]?.pubkey?.toBase58();
                        
                        if (signer) {
                            const existing = interactorMap.get(signer) || {
                                address: signer,
                                interactionCount: 0,
                                firstSeen: sig.blockTime * 1000,
                                lastSeen: sig.blockTime * 1000,
                                signatures: []
                            };
                            
                            existing.interactionCount++;
                            existing.firstSeen = Math.min(existing.firstSeen, sig.blockTime * 1000);
                            existing.lastSeen = Math.max(existing.lastSeen, sig.blockTime * 1000);
                            if (existing.signatures.length < 10) { // Keep up to 10 signatures as examples
                                existing.signatures.push(sig.signature);
                            }
                            
                            interactorMap.set(signer, existing);
                        }
                    }
                } catch (error) {
                    console.error(`Error processing signature ${sig.signature}:`, error);
                }
            }
        }

        // Convert map to array and filter by minimum interactions
        const allInteractors = Array.from(interactorMap.values())
            .filter(interactor => interactor.interactionCount >= minInteractions);

        // Sort by interaction count
        allInteractors.sort((a, b) => b.interactionCount - a.interactionCount);

        // Add ranks
        allInteractors.forEach((interactor, index) => {
            (interactor as any).rank = index + 1;
        });

        // Apply pagination
        const paginatedInteractors = allInteractors.slice(offset, offset + limit);

        // Get program info
        const programInfo = await connection.getAccountInfo(programPubkey);
        const isProgram = programInfo?.executable || false;

        const response = {
            success: true,
            program: {
                address: program,
                isExecutable: isProgram,
                exists: !!programInfo
            },
            period,
            periodHours,
            totalInteractors: allInteractors.length,
            activeInteractors: allInteractors.filter(i => i.interactionCount >= 5).length, // Users with 5+ interactions
            highFrequencyInteractors: allInteractors.filter(i => i.interactionCount >= 20).length, // Power users
            pagination: {
                limit,
                offset,
                total: allInteractors.length,
                hasMore: offset + limit < allInteractors.length
            },
            filters: {
                minInteractions,
                period
            },
            interactors: paginatedInteractors.map(i => ({
                ...i,
                averageInteractionsPerHour: i.interactionCount / periodHours
            }))
        };

        // Cache the response
        cache.set(cacheKey, response);

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error fetching program interactors:', error);
        return NextResponse.json(
            { 
                error: 'Failed to fetch program interactors', 
                details: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}
