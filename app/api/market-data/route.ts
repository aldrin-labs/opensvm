import { NextRequest, NextResponse } from 'next/server';

// Route segment config: Set timeout to 120 seconds
export const maxDuration = 120;


export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mint = searchParams.get('mint') || 'pvv4fu1RvQBkKXozyH5A843sp1mt6gTy9rPoZrBBAGS';
    const endpoint = searchParams.get('endpoint') || 'ohlcv';
    const baseMint = searchParams.get('baseMint'); // Optional: filter by base token
    const poolAddress = searchParams.get('poolAddress'); // Optional: specific pool

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
            
            // Support custom time ranges via query parameters
            const customTimeTo = searchParams.get('time_to');
            const customTimeFrom = searchParams.get('time_from');
            
            let time_to: number;
            let time_from: number;
            
            if (customTimeTo && customTimeFrom) {
                // Use custom time range if provided
                time_to = parseInt(customTimeTo);
                time_from = parseInt(customTimeFrom);
            } else if (customTimeTo) {
                // If only time_to provided, calculate time_from using default ranges
                time_to = parseInt(customTimeTo);
                const defaultTimeRanges: Record<string, number> = {
                    '1m': 20 * 60 * 60,         // 20 hours = 1,200 candles
                    '3m': 60 * 60 * 60,         // 60 hours = 1,200 candles
                    '5m': 100 * 60 * 60,        // 100 hours = 1,200 candles
                    '15m': 10 * 24 * 60 * 60,   // 10 days = 960 candles
                    '30m': 20 * 24 * 60 * 60,   // 20 days = 960 candles
                    '1H': 70 * 24 * 60 * 60,    // 70 days = 1,680 candles
                    '2H': 100 * 24 * 60 * 60,   // 100 days = 1,200 candles
                    '4H': 200 * 24 * 60 * 60,   // 200 days = 1,200 candles
                    '6H': 300 * 24 * 60 * 60,   // 300 days = 1,200 candles
                    '8H': 300 * 24 * 60 * 60,   // 300 days = 900 candles
                    '12H': 300 * 24 * 60 * 60,  // 300 days = 600 candles
                    '1D': 900 * 24 * 60 * 60,   // 900 days = 900 candles
                    '3D': 1800 * 24 * 60 * 60,  // 1800 days = 600 candles
                    '1W': 3650 * 24 * 60 * 60,  // 10 years = 520 candles
                    '1M': 7300 * 24 * 60 * 60,  // 20 years = 240 candles
                };
                const timeRange = defaultTimeRanges[type] || (24 * 60 * 60);
                time_from = time_to - timeRange;
            } else {
                // Use default time ranges (10x original for batch support)
                time_to = Math.floor(Date.now() / 1000);
                const defaultTimeRanges: Record<string, number> = {
                    '1m': 20 * 60 * 60,         // 20 hours = 1,200 candles
                    '3m': 60 * 60 * 60,         // 60 hours = 1,200 candles
                    '5m': 100 * 60 * 60,        // 100 hours = 1,200 candles
                    '15m': 10 * 24 * 60 * 60,   // 10 days = 960 candles
                    '30m': 20 * 24 * 60 * 60,   // 20 days = 960 candles
                    '1H': 70 * 24 * 60 * 60,    // 70 days = 1,680 candles
                    '2H': 100 * 24 * 60 * 60,   // 100 days = 1,200 candles
                    '4H': 200 * 24 * 60 * 60,   // 200 days = 1,200 candles
                    '6H': 300 * 24 * 60 * 60,   // 300 days = 1,200 candles
                    '8H': 300 * 24 * 60 * 60,   // 300 days = 900 candles
                    '12H': 300 * 24 * 60 * 60,  // 300 days = 600 candles
                    '1D': 900 * 24 * 60 * 60,   // 900 days = 900 candles
                    '3D': 1800 * 24 * 60 * 60,  // 1800 days = 600 candles
                    '1W': 3650 * 24 * 60 * 60,  // 10 years = 520 candles
                    '1M': 7300 * 24 * 60 * 60,  // 20 years = 240 candles
                };
                const timeRange = defaultTimeRanges[type] || (24 * 60 * 60);
                time_from = time_to - timeRange;
            }
            
            // Helper function to fetch OHLCV data with batching support
            const fetchOHLCVBatch = async (mint: string, type: string, from: number, to: number): Promise<any[]> => {
                // Calculate optimal batch size based on interval to maximize candles per request
                // Target ~800-1000 candles per batch (Birdeye limit is ~1000)
                const batchSizes: Record<string, number> = {
                    '1m': 16 * 60 * 60,        // 16 hours = 960 candles per batch
                    '3m': 48 * 60 * 60,        // 48 hours = 960 candles per batch
                    '5m': 80 * 60 * 60,        // 80 hours = 960 candles per batch
                    '15m': 10 * 24 * 60 * 60,  // 10 days = 960 candles per batch
                    '30m': 20 * 24 * 60 * 60,  // 20 days = 960 candles per batch
                    '1H': 40 * 24 * 60 * 60,   // 40 days = 960 candles per batch
                    '2H': 80 * 24 * 60 * 60,   // 80 days = 960 candles per batch
                    '4H': 160 * 24 * 60 * 60,  // 160 days = 960 candles per batch
                    '6H': 240 * 24 * 60 * 60,  // 240 days = 960 candles per batch
                    '8H': 250 * 24 * 60 * 60,  // 250 days = 750 candles per batch
                    '12H': 250 * 24 * 60 * 60, // 250 days = 500 candles per batch
                    '1D': 900 * 24 * 60 * 60,  // 900 days = 900 candles per batch
                    '3D': 1800 * 24 * 60 * 60, // 1800 days = 600 candles per batch
                    '1W': 3650 * 24 * 60 * 60, // 10 years = 520 candles per batch
                    '1M': 7300 * 24 * 60 * 60, // 20 years = 240 candles per batch
                };
                
                const batchSize = batchSizes[type] || (24 * 60 * 60);
                const totalRange = to - from;
                
                // If the range fits in one batch, make a single request
                if (totalRange <= batchSize) {
                    const url = `https://public-api.birdeye.so/defi/ohlcv?address=${mint}&type=${type}&time_from=${from}&time_to=${to}`;
                    const response = await fetch(url, { headers });
                    
                    if (!response.ok) {
                        throw new Error(`Birdeye API returned ${response.status}`);
                    }
                    
                    const data = await response.json();
                    return data.data?.items || [];
                }
                
                // Split into multiple batches
                const batches: Promise<any[]>[] = [];
                let currentFrom = from;
                
                while (currentFrom < to) {
                    const currentTo = Math.min(currentFrom + batchSize, to);
                    const url = `https://public-api.birdeye.so/defi/ohlcv?address=${mint}&type=${type}&time_from=${currentFrom}&time_to=${currentTo}`;
                    
                    const batchPromise = fetch(url, { headers })
                        .then(async (response) => {
                            if (!response.ok) {
                                console.error(`Batch failed for range ${currentFrom}-${currentTo}: ${response.status}`);
                                return [];
                            }
                            const data = await response.json();
                            return data.data?.items || [];
                        })
                        .catch((error) => {
                            console.error(`Batch error for range ${currentFrom}-${currentTo}:`, error);
                            return [];
                        });
                    
                    batches.push(batchPromise);
                    currentFrom = currentTo;
                }
                
                // Wait for all batches and concatenate results
                const results = await Promise.all(batches);
                const allItems = results.flat();
                
                // Sort by timestamp to ensure correct order
                allItems.sort((a, b) => a.unixTime - b.unixTime);
                
                // Remove duplicates (by timestamp)
                const uniqueItems = allItems.filter((item, index, self) =>
                    index === self.findIndex((t) => t.unixTime === item.unixTime)
                );
                
                return uniqueItems;
            };
            
            // If poolAddress is provided, fetch pool-specific data
            if (poolAddress) {
                // Use pair OHLCV endpoint for specific pool
                url = `https://public-api.birdeye.so/defi/ohlcv/pair?address=${poolAddress}&type=${type}&time_from=${time_from}&time_to=${time_to}`;
                
                const response = await fetch(url, { 
                    headers: {
                        ...headers,
                        'x-chain': 'solana'
                    }
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    return NextResponse.json({ 
                        error: `Birdeye API returned ${response.status}`,
                        details: errorText
                    }, { status: response.status });
                }

                const data = await response.json();
                
                // Get pool info
                const poolInfoUrl = `https://public-api.birdeye.so/defi/v3/pair?address=${poolAddress}`;
                const poolInfoResp = await fetch(poolInfoUrl, { 
                    headers: {
                        ...headers,
                        'x-chain': 'solana'
                    }
                });
                
                let poolInfo: any = null;
                if (poolInfoResp.ok) {
                    const poolData = await poolInfoResp.json();
                    if (poolData.success && poolData.data) {
                        poolInfo = {
                            symbol: poolData.data.baseToken?.symbol || 'UNKNOWN',
                            name: poolData.data.name || 'Unknown Pool',
                            liquidity: poolData.data.liquidity || 0,
                            price: poolData.data.price || 0,
                            volume24h: poolData.data.volume24h || 0,
                            dex: poolData.data.source || 'Unknown',
                            pair: `${poolData.data.baseToken?.symbol || '?'}/${poolData.data.quoteToken?.symbol || '?'}`,
                            poolAddress: poolAddress,
                            baseToken: poolData.data.baseToken,
                            quoteToken: poolData.data.quoteToken
                        };
                    }
                }
                
                return NextResponse.json({
                    success: true,
                    endpoint,
                    mint: poolAddress,
                    tokenInfo: poolInfo,
                    mainPair: {
                        pair: poolInfo?.pair || '?/?',
                        dex: poolInfo?.dex || 'Unknown',
                        poolAddress: poolAddress
                    },
                    pools: poolInfo ? [poolInfo] : [],
                    data: data.data || data,
                    indicators: {
                        ma7: [],
                        ma25: [],
                        macd: { line: [], signal: [], histogram: [] }
                    },
                    raw: data,
                    _debug: {
                        poolMode: true,
                        poolAddress
                    }
                });
            }
            
            // First, get token overview for pair/pool info
            const overviewUrl = `https://public-api.birdeye.so/defi/token_overview?address=${mint}`;
            const overviewResp = await fetch(overviewUrl, { headers });
            let pairInfo: any = null;
            let pools: any[] = [];
            
            if (overviewResp.ok) {
                const overview = await overviewResp.json();
                if (overview.success && overview.data) {
                    pairInfo = {
                        symbol: overview.data.symbol || 'UNKNOWN',
                        name: overview.data.name || 'Unknown Token',
                        liquidity: overview.data.liquidity || 0,
                        price: overview.data.price || 0,
                        volume24h: overview.data.v24hUSD || 0,
                        extensions: overview.data.extensions || {}
                    };
                }
            }
            
            // Get pool/DEX information from recent transactions (fetch more for better stats)
            const txUrl = `https://public-api.birdeye.so/defi/txs/token?address=${mint}&tx_type=swap&limit=100`;
            const txResp = await fetch(txUrl, { headers });
            
            if (txResp.ok) {
                const txData = await txResp.json();
                
                if (txData.success && txData.data?.items) {
                    // Extract unique pools from transactions with basic stats
                    const poolMap = new Map<string, any>();
                    const now = Date.now();
                    const oneDayAgo = now - (24 * 60 * 60 * 1000);
                    
                    console.log('Processing', txData.data.items.length, 'transactions...');
                    let processedCount = 0;
                    
                    for (const tx of txData.data.items) {
                        if (tx.source && tx.poolId && tx.base && tx.quote) {
                            processedCount++;
                            // Determine which token is our target and which is the pair
                            const isBase = tx.base.address?.toLowerCase() === mint.toLowerCase();
                            const pairToken = isBase ? tx.quote : tx.base;
                            const ourToken = isBase ? tx.base : tx.quote;
                            
                            const key = `${tx.poolId}`;
                            const txTime = tx.blockUnixTime * 1000;
                            
                            if (!poolMap.has(key)) {
                                console.log('Adding pool:', key, `(${tx.source})`, `${ourToken.symbol}/${pairToken.symbol}`);
                                poolMap.set(key, {
                                    dex: tx.source,
                                    pair: `${ourToken.symbol}/${pairToken.symbol}`,
                                    poolAddress: tx.poolId,
                                    pairToken: pairToken.symbol,
                                    pairAddress: pairToken.address,
                                    price: tx.pricePair || 0,
                                    volume24h: 0,
                                    txCount24h: 0,
                                    lastSeen: new Date(txTime).toISOString()
                                });
                            }
                            
                            // Count 24h activity
                            const pool = poolMap.get(key)!;
                            if (txTime >= oneDayAgo) {
                                // Calculate trade value in USD
                                const baseValue = (tx.base.uiAmount || 0) * (tx.base.price || 0);
                                const quoteValue = Math.abs(tx.quote.uiChangeAmount || 0) * (tx.quote.price || 0);
                                const tradeValue = Math.max(baseValue, quoteValue);
                                
                                pool.volume24h += tradeValue;
                                pool.txCount24h += 1;
                                
                                // Update price and last seen to most recent
                                if (txTime > new Date(pool.lastSeen).getTime()) {
                                    pool.price = tx.pricePair || pool.price;
                                    pool.lastSeen = new Date(txTime).toISOString();
                                }
                            }
                        }
                    }
                    
                    pools = Array.from(poolMap.values());
                    // Sort by 24h volume descending
                    pools.sort((a, b) => b.volume24h - a.volume24h);
                    console.log('Pools extracted:', pools.length, 'pools from', processedCount, 'transactions');
                }
            }
            
            // Fetch OHLCV data using batch support for large time ranges
            const items = await fetchOHLCVBatch(mint, type, time_from, time_to);
            
            // Calculate technical indicators (MACD, MA7, MA25)
            const closes = items.map((item: any) => item.c);
            
            // Calculate moving averages
            const ma7: (number | null)[] = [];
            const ma25: (number | null)[] = [];
            
            for (let i = 0; i < closes.length; i++) {
                // MA7
                if (i >= 6) {
                    const sum = closes.slice(i - 6, i + 1).reduce((a: number, b: number) => a + b, 0);
                    ma7.push(sum / 7);
                } else {
                    ma7.push(null);
                }
                
                // MA25
                if (i >= 24) {
                    const sum = closes.slice(i - 24, i + 1).reduce((a: number, b: number) => a + b, 0);
                    ma25.push(sum / 25);
                } else {
                    ma25.push(null);
                }
            }
            
            // Calculate MACD (12, 26, 9)
            const calculateEMA = (data: number[], period: number): number[] => {
                const k = 2 / (period + 1);
                const ema: number[] = [];
                ema[0] = data[0];
                
                for (let i = 1; i < data.length; i++) {
                    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
                }
                return ema;
            };
            
            let macdLine: (number | null)[] = [];
            let signalLine: (number | null)[] = [];
            let histogram: (number | null)[] = [];
            
            if (closes.length >= 26) {
                const ema12 = calculateEMA(closes, 12);
                const ema26 = calculateEMA(closes, 26);
                const macd = ema12.map((val, i) => val - ema26[i]);
                const signal = calculateEMA(macd, 9);
                
                macdLine = macd.map((val, i) => i >= 25 ? val : null);
                signalLine = signal.map((val, i) => i >= 33 ? val : null);
                histogram = macdLine.map((val, i) => 
                    val !== null && signalLine[i] !== null ? val - signalLine[i]! : null
                );
            }
            
            // Main pair (use most common from pools or default to USDC)
            const mainPair = {
                pair: pools.length > 0 ? pools[0].pair : `${pairInfo?.symbol || 'TOKEN'}/USDC`,
                dex: pools.length > 0 ? pools[0].dex : null,
                poolAddress: pools.length > 0 ? pools[0].poolAddress : null,
            };
            
            // Calculate batch metadata (must match fetchOHLCVBatch sizes)
            const batchSizes: Record<string, number> = {
                '1m': 16 * 60 * 60,
                '3m': 48 * 60 * 60,
                '5m': 80 * 60 * 60,
                '15m': 10 * 24 * 60 * 60,
                '30m': 20 * 24 * 60 * 60,
                '1H': 40 * 24 * 60 * 60,
                '2H': 80 * 24 * 60 * 60,
                '4H': 160 * 24 * 60 * 60,
                '6H': 240 * 24 * 60 * 60,
                '8H': 250 * 24 * 60 * 60,
                '12H': 250 * 24 * 60 * 60,
                '1D': 900 * 24 * 60 * 60,
                '3D': 1800 * 24 * 60 * 60,
                '1W': 3650 * 24 * 60 * 60,
                '1M': 7300 * 24 * 60 * 60,
            };
            const batchSize = batchSizes[type] || (24 * 60 * 60);
            const totalRange = time_to - time_from;
            const batchCount = Math.ceil(totalRange / batchSize);
            
            return NextResponse.json({
                success: true,
                endpoint,
                mint,
                tokenInfo: pairInfo,
                mainPair,
                pools,  // All available pools/pairs
                data: {
                    items,
                    type,
                    unixTime: Math.floor(Date.now() / 1000)
                },
                indicators: {
                    ma7,
                    ma25,
                    macd: {
                        line: macdLine,
                        signal: signalLine,
                        histogram
                    }
                },
                _meta: {
                    requestedRange: {
                        from: time_from,
                        to: time_to,
                        duration: totalRange
                    },
                    batching: {
                        enabled: batchCount > 1,
                        batchCount,
                        batchSize
                    },
                    candleCount: items.length
                }
            });
            
        } else if (endpoint === 'markets') {
            // Fetch top 3 pools by liquidity using markets API
            url = `https://public-api.birdeye.so/defi/v2/markets?address=${mint}&time_frame=24h&sort_type=desc&sort_by=liquidity&offset=0&limit=3`;
            
            const response = await fetch(url, { 
                headers: {
                    ...headers,
                    'x-chain': 'solana'
                }
            });
            
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
                    error: 'Markets API returned unsuccessful response',
                    details: data.message || 'Unknown error'
                }, { status: 400 });
            }
            
            // Transform to simplified format
            let pools = (data.data?.items || []).map((pool: any) => ({
                dex: pool.source || 'Unknown',
                pair: pool.name || 'Unknown',
                poolAddress: pool.address,
                price: pool.price || 0,
                liquidity: pool.liquidity || 0,
                volume24h: pool.volume24h || 0,
                txCount24h: pool.trade24h || 0,
                baseToken: pool.base?.symbol || '',
                quoteToken: pool.quote?.symbol || '',
                baseAddress: pool.base?.address || '',
                quoteAddress: pool.quote?.address || ''
            }));
            
            // Filter by baseMint if provided
            if (baseMint) {
                pools = pools.filter((pool: any) => 
                    pool.baseAddress?.toLowerCase() === baseMint.toLowerCase() ||
                    pool.quoteAddress?.toLowerCase() === baseMint.toLowerCase()
                );
            }
            
            // Filter by poolAddress if provided
            if (poolAddress) {
                pools = pools.filter((pool: any) => 
                    pool.poolAddress?.toLowerCase() === poolAddress.toLowerCase()
                );
            }
            
            return NextResponse.json({
                success: true,
                endpoint,
                mint,
                pools,
                count: pools.length,
                filters: {
                    baseMint: baseMint || null,
                    poolAddress: poolAddress || null
                }
            });
            
        } else if (endpoint === 'orderbook') {
            const offset = searchParams.get('offset') || '100';
            url = `https://public-api.birdeye.so/defi/orderbook?address=${mint}&offset=${offset}`;
            
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
        } else {
            return NextResponse.json({ 
                error: 'Invalid endpoint. Use "ohlcv", "markets", or "orderbook"' 
            }, { status: 400 });
        }

    } catch (error) {
        return NextResponse.json({ 
            error: (error as Error).message 
        }, { status: 500 });
    }
}
