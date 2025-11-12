import { NextRequest } from 'next/server';
import { GET as marketDataGET } from '../market-data/route';

/**
 * Chart API - Clean alias for OHLCV candlestick data
 * 
 * This is a convenience endpoint that wraps the market-data API
 * with endpoint=ohlcv pre-configured.
 * 
 * Query Parameters:
 * - mint: Token mint address (required)
 * - type: Interval type (1m, 3m, 5m, 15m, 30m, 1H, 2H, 4H, 6H, 8H, 12H, 1D, 3D, 1W, 1M)
 * - time_from: Start timestamp (unix seconds, optional)
 * - time_to: End timestamp (unix seconds, optional)
 * - poolAddress: Specific pool address (optional)
 * 
 * Examples:
 * - GET /api/chart?mint=YOUR_MINT&type=1m
 * - GET /api/chart?mint=YOUR_MINT&type=1H&time_from=1234567890&time_to=1234567999
 */
export async function GET(request: NextRequest) {
    // Clone the URL and add endpoint=ohlcv
    const url = new URL(request.url);
    url.searchParams.set('endpoint', 'ohlcv');
    
    // Create a new request with the modified URL
    const modifiedRequest = new NextRequest(url, request);
    
    // Forward to the market-data endpoint
    return marketDataGET(modifiedRequest);
}
