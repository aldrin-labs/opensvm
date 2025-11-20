import { NextRequest, NextResponse } from 'next/server';
import { getProgramInfoWithQdrantCache } from '@/lib/solana/program-metadata-cache';

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
        const programId = searchParams.get('programId');

        if (!programId) {
            return NextResponse.json(
                { error: 'programId parameter is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        const programInfo = await getProgramInfoWithQdrantCache(programId);

        if (!programInfo) {
            return NextResponse.json(
                { error: 'Program metadata not found' },
                { status: 404, headers: corsHeaders }
            );
        }

        return NextResponse.json({
            ...programInfo
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Error fetching program metadata:', error);
        return NextResponse.json(
            { error: 'Failed to fetch program metadata' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { programIds } = body;

        if (!Array.isArray(programIds) || programIds.length === 0) {
            return NextResponse.json(
                { error: 'programIds array is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        if (programIds.length > 50) {
            return NextResponse.json(
                { error: 'Maximum 50 program IDs allowed per request' },
                { status: 400, headers: corsHeaders }
            );
        }

        const results: { [key: string]: any } = {};

        // Process in smaller batches for better performance
        const batchSize = 10;
        for (let i = 0; i < programIds.length; i += batchSize) {
            const batch = programIds.slice(i, i + batchSize);

            const promises = batch.map(async (programId: string) => {
                try {
                    const programInfo = await getProgramInfoWithQdrantCache(programId);
                    if (programInfo) {
                        results[programId] = programInfo;
                    } else {
                        results[programId] = null;
                    }
                } catch (error) {
                    console.warn(`Failed to fetch metadata for program ${programId}:`, error);
                    results[programId] = null;
                }
            });

            await Promise.all(promises);
        }

        return NextResponse.json({
            results
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Error batch fetching program metadata:', error);
        return NextResponse.json(
            { error: 'Failed to batch fetch program metadata' },
            { status: 500, headers: corsHeaders }
        );
    }
}
