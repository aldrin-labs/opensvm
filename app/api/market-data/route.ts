import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mint = searchParams.get('mint') || 'pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS';
    const endpoint = searchParams.get('endpoint') || 'ohlcv';

    if (!process.env.BIRDEYE_API_KEY) {
        return NextResponse.json({ 
            error: 'BIRDEYE_API_KEY not configured' 
        }, { status: 500 });
    }

    try {
        let url: string;
        const headers = {
            'Accept': 'application/json',
            'X-API-KEY': process.env.BIRDEYE_API_KEY
        };

        if (endpoint === 'ohlcv') {
            const type = searchParams.get('type') || '1H';
            const time_to = Math.floor(Date.now() / 1000);
            const time_from = time_to - (24 * 60 * 60); // 24h ago
            
            url = `https://public-api.birdeye.so/defi/ohlcv?address=${mint}&type=${type}&time_from=${time_from}&time_to=${time_to}`;
        } else if (endpoint === 'orderbook') {
            const offset = searchParams.get('offset') || '100';
            url = `https://public-api.birdeye.so/defi/orderbook?address=${mint}&offset=${offset}`;
        } else {
            return NextResponse.json({ 
                error: 'Invalid endpoint. Use "ohlcv" or "orderbook"' 
            }, { status: 400 });
        }

        console.log(`Fetching Birdeye ${endpoint} from: ${url}`);
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ 
                error: `Birdeye API returned ${response.status}`,
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();
        
        return NextResponse.json({
            success: true,
            endpoint,
            mint,
            data: data.data || data,
            raw: data
        });

    } catch (error) {
        return NextResponse.json({ 
            error: (error as Error).message 
        }, { status: 500 });
    }
}
