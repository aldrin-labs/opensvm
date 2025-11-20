import { NextRequest, NextResponse } from 'next/server';
import { getTokenInfo } from '@/lib/trading/token-registry';
import { getConnection } from '@/lib/solana/solana-connection-server';
import { PublicKey } from '@solana/web3.js';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const mintAddress = searchParams.get('mint');

        if (!mintAddress) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'mint parameter is required' 
                },
                { status: 400 }
            );
        }

        // Validate mint address format
        try {
            new PublicKey(mintAddress);
        } catch (error) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'Invalid mint address format. Must be a valid Solana public key.' 
                },
                { status: 400 }
            );
        }

        const connection = await getConnection();
        const tokenInfo = await getTokenInfo(connection, mintAddress);

        if (!tokenInfo) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'Token metadata not found' 
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                mintAddress,
                ...tokenInfo
            }
        });

    } catch (error) {
        console.error('Error fetching token metadata:', error);
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch token metadata' 
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { mintAddresses } = body;

        if (!mintAddresses) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'mintAddresses field is required' 
                },
                { status: 400 }
            );
        }

        if (!Array.isArray(mintAddresses)) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'mintAddresses must be an array' 
                },
                { status: 400 }
            );
        }

        if (mintAddresses.length === 0) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'mintAddresses array cannot be empty' 
                },
                { status: 400 }
            );
        }

        if (mintAddresses.length > 50) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'Maximum 50 mint addresses allowed per request' 
                },
                { status: 400 }
            );
        }

        // Validate all mint addresses
        const invalidAddresses: string[] = [];
        for (const addr of mintAddresses) {
            if (typeof addr !== 'string') {
                invalidAddresses.push(String(addr));
                continue;
            }
            try {
                new PublicKey(addr);
            } catch (error) {
                invalidAddresses.push(addr);
            }
        }

        if (invalidAddresses.length > 0) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'Invalid mint addresses found',
                    details: {
                        invalidAddresses: invalidAddresses.slice(0, 10), // Show first 10
                        count: invalidAddresses.length
                    }
                },
                { status: 400 }
            );
        }

        const connection = await getConnection();
        const results: { [key: string]: any } = {};

        // Process in smaller batches for better performance
        const batchSize = 10;
        for (let i = 0; i < mintAddresses.length; i += batchSize) {
            const batch = mintAddresses.slice(i, i + batchSize);

            const promises = batch.map(async (mintAddress: string) => {
                try {
                    const tokenInfo = await getTokenInfo(connection, mintAddress);
                    if (tokenInfo) {
                        results[mintAddress] = tokenInfo;
                    } else {
                        results[mintAddress] = null;
                    }
                } catch (error) {
                    console.warn(`Failed to fetch metadata for ${mintAddress}:`, error);
                    results[mintAddress] = { error: 'Failed to fetch metadata' };
                }
            });

            await Promise.all(promises);
        }

        return NextResponse.json({
            success: true,
            data: { results }
        });

    } catch (error) {
        console.error('Error batch fetching token metadata:', error);
        
        // Handle JSON parse errors specifically
        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { 
                    success: false,
                    error: 'Invalid JSON in request body' 
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : 'Failed to batch fetch token metadata' 
            },
            { status: 500 }
        );
    }
}
