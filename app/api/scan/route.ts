
// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;
export const runtime = 'edge';

// Simple list of sample launchpads to mock aggregate data from
const LAUNCHPADS = ['Pump.fun', 'Birdeye', 'Moonshot', 'SolScan', 'DexScreener'];

interface MemecoinInfo {
    id: string;
    name: string;
    symbol: string;
    launchpad: string;
    priceUsd: number;
    marketCapUsd: number;
    liquidityUsd: number;
    volume24hUsd: number;
    ageMinutes: number;
}

// Helper to create a random memecoin
function createRandomMemecoin(): MemecoinInfo {
    const id = crypto.randomUUID();
    const name = `MEME${Math.floor(Math.random() * 10000)}`;
    const symbol = name.slice(0, 4);
    const launchpad = LAUNCHPADS[Math.floor(Math.random() * LAUNCHPADS.length)];
    const priceUsd = +(Math.random() * 0.1).toFixed(6);
    const marketCapUsd = +(Math.random() * 10_000_000).toFixed(2);
    const liquidityUsd = +(Math.random() * 1_000_000).toFixed(2);
    const volume24hUsd = +(Math.random() * 5_000_000).toFixed(2);
    const ageMinutes = Math.floor(Math.random() * 120);
    return { id, name, symbol, launchpad, priceUsd, marketCapUsd, liquidityUsd, volume24hUsd, ageMinutes };
}



export async function GET(_request: Request) {
    // Return mock data for now since WebSocket is not supported in Edge runtime
    const mockData = Array.from({ length: 20 }, () => createRandomMemecoin());

    return new Response(JSON.stringify({
        type: 'snapshot',
        data: mockData,
        message: 'WebSocket not supported in Edge runtime. Use SSE instead.'
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        }
    });
} 