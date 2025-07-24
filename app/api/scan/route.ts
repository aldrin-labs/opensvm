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

// Send a JSON message through the WebSocket
function send(ws: WebSocket, data: unknown) {
    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

export async function GET(request: Request) {
    // WebSocket upgrade validation
    const upgradeHeader = request.headers.get('upgrade') || '';
    if (upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket', { status: 400 });
    }

    // Create WebSocket pair (Edge runtime)
    const { 0: client, 1: server } = new WebSocketPair();

    // Handle connection on the server side
    server.accept();

    // On open, immediately send initial batch
    const initialBatch = Array.from({ length: 20 }, () => createRandomMemecoin());
    send(server, { type: 'snapshot', data: initialBatch });

    // Periodically push updates
    const intervalId = setInterval(() => {
        const update = createRandomMemecoin();
        send(server, { type: 'update', data: update });
    }, 1000);

    // Cleanup on close
    server.addEventListener('close', () => {
        clearInterval(intervalId);
    });

    return new Response(null, {
        status: 101,
        webSocket: client,
    });
} 