import { NextRequest, NextResponse } from 'next/server';
import { getTokenInfo } from '@/lib/token-registry';
import { getConnection } from '@/lib/solana-connection';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const mintAddress = searchParams.get('mint');

        if (!mintAddress) {
            return NextResponse.json(
                { error: 'mint parameter is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        const connection = await getConnection();
        const tokenInfo = await getTokenInfo(connection, mintAddress);

        if (!tokenInfo) {
            return NextResponse.json(
                { error: 'Token metadata not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        return NextResponse.json({
            mintAddress,
            ...tokenInfo
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Error fetching token metadata:', error);
        return NextResponse.json(
            { error: 'Failed to fetch token metadata' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { mintAddresses } = body;

        if (!Array.isArray(mintAddresses) || mintAddresses.length === 0) {
            return NextResponse.json(
                { error: 'mintAddresses array is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        if (mintAddresses.length > 50) {
            return NextResponse.json(
                { error: 'Maximum 50 mint addresses allowed per request' },
                { status: 400, headers: corsHeaders }
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
                    results[mintAddress] = null;
                }
            });

            await Promise.all(promises);
        }

        return NextResponse.json({
            results
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Error batch fetching token metadata:', error);
        return NextResponse.json(
            { error: 'Failed to batch fetch token metadata' },
            { status: 500, headers: corsHeaders }
        );
    }
}
