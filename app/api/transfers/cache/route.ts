import { NextRequest, NextResponse } from 'next/server';
import {
    markTransfersCached,
    storeTransferEntry,
    getCachedTransfers,
    type TransferEntry
} from '@/lib/qdrant';

const corsHeaders = {
    ...corsHeaders,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const walletAddress = searchParams.get('walletAddress');

        if (!walletAddress) {
            return NextResponse.json(
                { error: 'walletAddress parameter is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        const cachedTransfers = await getCachedTransfers(walletAddress);

        return NextResponse.json({
            data: cachedTransfers
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('Error fetching cached transfers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch cached transfers' },
            { status: 500, headers: corsHeaders }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, data } = body;

        switch (action) {
            case 'store':
                if (!data || !Array.isArray(data)) {
                    return NextResponse.json(
                        { error: 'data must be an array of transfer entries' },
                        { status: 400, headers: corsHeaders }
                    );
                }

                // Store each transfer entry
                for (const entry of data as TransferEntry[]) {
                    await storeTransferEntry(entry);
                }

                return NextResponse.json(
                    { success: true, stored: data.length },
                    { headers: corsHeaders }
                );

            case 'markCached':
                const { signatures, walletAddress } = data;

                if (!signatures || !Array.isArray(signatures) || !walletAddress) {
                    return NextResponse.json(
                        { error: 'signatures (array) and walletAddress are required' },
                        { status: 400, headers: corsHeaders }
                    );
                }

                await markTransfersCached(signatures, walletAddress);

                return NextResponse.json(
                    { success: true, markedCached: signatures.length },
                    { headers: corsHeaders }
                );

            default:
                return NextResponse.json(
                    { error: 'Invalid action. Use "store" or "markCached"' },
                    { status: 400, headers: corsHeaders }
                );
        }

    } catch (error) {
        console.error('Error processing transfer cache request:', error);
        return NextResponse.json(
            { error: 'Failed to process transfer cache request' },
            { status: 500, headers: corsHeaders }
        );
    }
}
