import { NextRequest, NextResponse } from 'next/server';

/**
 * Trades API - Fetch recent trades for a specific token
 * 
 * Query Parameters:
 * - mint: Token mint address (required)
 * - limit: Number of trades to return (default: 50, max: 100)
 * - type: Transaction type filter (swap, add, remove, optional)
 * - offset: Pagination offset (optional)
 * 
 * Examples:
 * - GET /api/trades?mint=YOUR_MINT
 * - GET /api/trades?mint=YOUR_MINT&limit=100
 * - GET /api/trades?mint=YOUR_MINT&type=swap&limit=50
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mint = searchParams.get('mint');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const txType = searchParams.get('type') || 'swap';
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!mint) {
        return NextResponse.json({ 
            error: 'Missing required parameter: mint',
            usage: 'GET /api/trades?mint=YOUR_MINT&limit=50'
        }, { status: 400 });
    }

    if (!process.env.BIRDEYE_API_KEY) {
        return NextResponse.json({ 
            error: 'BIRDEYE_API_KEY not configured' 
        }, { status: 500 });
    }

    try {
        const headers = {
            'Accept': 'application/json',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        };

        // Build Birdeye API URL
        const url = `https://public-api.birdeye.so/defi/txs/token?address=${mint}&tx_type=${txType}&limit=${limit}&offset=${offset}`;
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ 
                error: `Birdeye API returned ${response.status}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();
        
        if (!data.success) {
            return NextResponse.json({
                error: 'Birdeye API returned unsuccessful response',
                details: data.message || 'Unknown error'
            }, { status: 400 });
        }

        // Transform trades to a cleaner format
        const trades = (data.data?.items || []).map((tx: any) => {
            // Determine which token is our target
            const isBase = tx.base?.address?.toLowerCase() === mint.toLowerCase();
            const targetToken = isBase ? tx.base : tx.quote;
            const pairToken = isBase ? tx.quote : tx.base;

            return {
                signature: tx.txHash,
                timestamp: tx.blockUnixTime,
                type: tx.txType,
                side: tx.side, // buy or sell
                price: tx.price || tx.pricePair,
                priceUSD: tx.price,
                amount: targetToken?.uiAmount || 0,
                amountUSD: (targetToken?.uiAmount || 0) * (targetToken?.price || 0),
                token: {
                    symbol: targetToken?.symbol,
                    address: targetToken?.address,
                    decimals: targetToken?.decimals
                },
                pairToken: {
                    symbol: pairToken?.symbol,
                    address: pairToken?.address,
                    decimals: pairToken?.decimals
                },
                dex: tx.source,
                poolAddress: tx.poolId,
                owner: tx.owner,
                slot: tx.slot,
                // Raw transaction data
                raw: {
                    base: tx.base,
                    quote: tx.quote,
                    pricePair: tx.pricePair
                }
            };
        });

        return NextResponse.json({
            success: true,
            mint,
            trades,
            count: trades.length,
            metadata: {
                limit,
                offset,
                txType,
                hasMore: data.data?.hasNext || false
            }
        });

    } catch (error) {
        return NextResponse.json({ 
            error: (error as Error).message 
        }, { status: 500 });
    }
}
