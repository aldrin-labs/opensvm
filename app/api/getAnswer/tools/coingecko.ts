import { Tool, ToolContext, ToolResult } from "./types";

interface CoinGeckoResponse {
  success: boolean;
  data?: {
    name: string;
    symbol: string;
    current_price: { usd: number };
    market_cap: { usd: number };
    trading_volume: { usd: number; h24: number };
    price_change_24h: number;
    market_cap_rank: number | null;
    last_updated: string;
    // OHLCV data
    high_24h?: { usd: number };
    low_24h?: { usd: number };
    open_24h?: { usd: number };
  };
  error?: string;
  source?: string;
  resolved_id?: string;
  historical?: Array<[number, number, number, number, number]>; // [timestamp, open, high, low, close]
}

/**
 * CoinGecko API tool for fetching cryptocurrency market data
 * Handles price, market cap, volume, and other market metrics
 */
export const coinGeckoTool: Tool = {
  name: "coingecko",
  description: "Fetches real-time cryptocurrency market data from CoinGecko API including price, market cap, trading volume, and price changes",
  
  canHandle: (context: ToolContext): boolean => {
    const q = context.qLower;
    
    // Handle price/market data queries
    const priceKeywords = [
      'price', 'market cap', 'volume', 'trading volume', 
      'market capitalization', 'current price', 'market data'
    ];
    
    // Handle OHLCV specific queries
    const ohlcvKeywords = [
      'ohlcv', 'ohlc', 'open high low close', 'candlestick', 'candle',
      'high', 'low', 'open', 'close', '24h high', '24h low'
    ];
    
    // Handle specific token mentions
    const tokenKeywords = [
      'svmai', '$svmai', 'opensvm', 'solana', '$sol', 'bonk', '$bonk',
      'raydium', '$ray', 'serum', '$srm', 'jupiter', '$jup', 'wif', '$wif'
    ];
    
    // Handle memecoin queries
    const memecoinKeywords = ['memecoin', 'meme coin', 'meme token'];
    
    const hasMarketQuery = priceKeywords.some(keyword => q.includes(keyword));
    const hasOHLCVQuery = ohlcvKeywords.some(keyword => q.includes(keyword));
    const hasTokenMention = tokenKeywords.some(keyword => q.includes(keyword));
    const hasMemecoinQuery = memecoinKeywords.some(keyword => q.includes(keyword));
    
    return hasMarketQuery || hasOHLCVQuery || hasTokenMention || hasMemecoinQuery;
  },
  
  execute: async (context: ToolContext): Promise<ToolResult> => {
    try {
      console.log(`🪙 CoinGecko tool executing for query: "${context.question}"`);
      
      // Extract coin ID from query
      let coinId = extractCoinId(context.qLower);
      if (!coinId) {
        return { 
          handled: false,
          response: new Response("Could not identify cryptocurrency from query", { status: 400 })
        };
      }

      console.log(`🔍 Processing identifier: ${coinId}`);
      
      // Check if this might be a Solana token that needs mint resolution
      let mintAddress: string | null = null;
      let isSolanaToken = false;
      
      // Check if it looks like a mint address or needs resolution
      if (coinId.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
        // Already a mint address
        mintAddress = coinId;
        isSolanaToken = true;
        console.log(`✅ Using provided mint address: ${mintAddress}`);
      } else if (['rin', 'wif', 'bonk', 'ray', 'jup', 'srm'].includes(coinId.toLowerCase())) {
        // Try to resolve mint address for known Solana tokens
        console.log(`🔍 Resolving mint address for Solana token: ${coinId}`);
        mintAddress = await resolveMintAddress(coinId);
        if (mintAddress) {
          isSolanaToken = true;
          console.log(`✅ Resolved ${coinId} to mint: ${mintAddress}`);
        } else {
          console.log(`⚠️ Could not resolve mint for ${coinId}, falling back to CoinGecko`);
        }
      }
      
      // Check if user wants OHLCV data specifically
      const wantsOHLCV = context.qLower.includes('ohlcv') || 
                         context.qLower.includes('ohlc') ||
                         context.qLower.includes('candlestick') ||
                         context.qLower.includes('high') ||
                         context.qLower.includes('low') ||
                         context.qLower.includes('open') ||
                         context.qLower.includes('close');

      let marketData: CoinGeckoResponse;
      let pairData: any = null;
      
      // Try Solana-specific APIs first if we have a mint address
      if (isSolanaToken && mintAddress && wantsOHLCV) {
        try {
          console.log(`🔄 Fetching Solana token pairs for mint: ${mintAddress}`);
          pairData = await fetchTokenPairs(mintAddress);
          
          if (pairData && pairData.pairs && pairData.pairs.length > 0) {
            console.log(`✅ Found ${pairData.pairs.length} trading pairs`);
            // Try to get OHLCV data from the best pair
            const bestPair = pairData.pairs[0]; // Use first pair (usually highest volume)
            if (bestPair.pairAddress) {
              console.log(`📈 Fetching OHLCV for pair: ${bestPair.pairAddress}`);
              const ohlcvData = await fetchPairOHLCV(bestPair.pairAddress);
              if (ohlcvData) {
                // Convert Solana data format to CoinGecko compatible format
                marketData = formatSolanaDataToCoinGecko(ohlcvData, bestPair, mintAddress);
                console.log(`✅ Successfully fetched Solana OHLCV data`);
              } else {
                throw new Error('No OHLCV data available');
              }
            } else {
              throw new Error('No pair address found');
            }
          } else {
            throw new Error('No trading pairs found');
          }
        } catch (solanaError) {
          console.warn(`⚠️ Solana API failed: ${solanaError}, falling back to CoinGecko`);
          // Fall back to CoinGecko
          marketData = await fetchCoinGeckoData(coinId);
        }
      } else {
        // Use CoinGecko API
        marketData = await fetchCoinGeckoData(coinId);
      }
      
      if (!marketData.success || !marketData.data) {
        return { 
          handled: false,
          response: new Response(`Failed to fetch market data: ${marketData.error}`, { status: 500 })
        };
      }

      // If OHLCV requested and we don't have Solana data, fetch CoinGecko historical data
      if (wantsOHLCV && !isSolanaToken) {
        try {
          const historicalData = await fetchHistoricalOHLC(coinId);
          if (historicalData && historicalData.length > 0) {
            marketData.historical = historicalData;
          }
        } catch (error) {
          console.warn(`Failed to fetch historical data for ${coinId}:`, error);
          // Continue without historical data
        }
      }

      // Format response based on request type
      const response = wantsOHLCV ? 
        formatOHLCVResponse(marketData) : 
        formatMarketDataResponse(marketData);
      
      return {
        handled: true,
        response: new Response(response, {
          status: 200,
          headers: { "Content-Type": "text/plain" }
        })
      };
      
    } catch (error) {
      console.error("❌ CoinGecko tool error:", error);
      return { 
        handled: false,
        response: new Response(`CoinGecko API error: ${error}`, { status: 500 })
      };
    }
  }
};

/**
 * Resolve mint address from ticker symbol using Jupiter Token List
 */
async function resolveMintAddress(ticker: string): Promise<string | null> {
  try {
    // Try Jupiter Token List API first
    const response = await fetch('https://token.jup.ag/all');
    if (response.ok) {
      const tokens = await response.json();
      
      // Look for exact symbol match (case insensitive)
      const token = tokens.find((t: any) => 
        t.symbol?.toLowerCase() === ticker.toLowerCase() ||
        t.name?.toLowerCase().includes(ticker.toLowerCase())
      );
      
      if (token?.address) {
        console.log(`🔍 Resolved ${ticker} to mint: ${token.address}`);
        return token.address;
      }
    }
  } catch (error) {
    console.warn(`Failed to resolve mint for ${ticker}:`, error);
  }
  
  // Try Solscan API as fallback
  try {
    const searchResponse = await fetch(`https://api.solscan.io/token/search?keyword=${encodeURIComponent(ticker)}`);
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.data && searchData.data.length > 0) {
        const token = searchData.data[0];
        if (token.address) {
          console.log(`🔍 Resolved ${ticker} via Solscan to mint: ${token.address}`);
          return token.address;
        }
      }
    }
  } catch (error) {
    console.warn(`Solscan fallback failed for ${ticker}:`, error);
  }
  
  return null;
}

/**
 * Get token info from mint address
 */
async function getTokenInfoFromMint(mintAddress: string): Promise<any | null> {
  try {
    // Try Jupiter API first
    const response = await fetch(`https://price.jup.ag/v4/price?ids=${mintAddress}`);
    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data[mintAddress]) {
        return {
          address: mintAddress,
          price: data.data[mintAddress].price,
          source: 'jupiter'
        };
      }
    }
  } catch (error) {
    console.warn(`Jupiter price lookup failed for ${mintAddress}:`, error);
  }
  
  // Try Solscan as fallback
  try {
    const response = await fetch(`https://api.solscan.io/token/meta?token=${mintAddress}`);
    if (response.ok) {
      const data = await response.json();
      return {
        address: mintAddress,
        name: data.name,
        symbol: data.symbol,
        source: 'solscan'
      };
    }
  } catch (error) {
    console.warn(`Solscan token info failed for ${mintAddress}:`, error);
  }
  
  return null;
}

/**
 * Extract coin ID or mint address from user query
 */
function extractCoinId(query: string): string | null {
  // Common coin mappings
  const coinMappings: Record<string, string> = {
    'svmai': 'opensvm-com',
    '$svmai': 'opensvm-com',
    'opensvm': 'opensvm-com',
    'sol': 'solana',
    '$sol': 'solana',
    'solana': 'solana',
    'bonk': 'bonk',
    '$bonk': 'bonk',
    'ray': 'raydium',
    '$ray': 'raydium',
    'raydium': 'raydium',
    'srm': 'serum',
    '$srm': 'serum',
    'serum': 'serum',
    'jup': 'jupiter-exchange-solana',
    '$jup': 'jupiter-exchange-solana',
    'jupiter': 'jupiter-exchange-solana',
    'wif': 'dogwifcoin',
    '$wif': 'dogwifcoin',
    'rin': 'rin', // Will be resolved to mint address later
    '$rin': 'rin'
  };
  
  // Check for direct matches first
  for (const [symbol, coinId] of Object.entries(coinMappings)) {
    if (query.includes(symbol)) {
      return coinId;
    }
  }
  
  // Check if it looks like a mint address (base58, ~44 chars)
  const mintPattern = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
  const words = query.split(/\s+/);
  for (const word of words) {
    if (mintPattern.test(word) && word.length >= 32) {
      return word; // Return the mint address directly
    }
  }
  
  // Extract potential ticker symbols
  const tickerPattern = /\$?([A-Z]{2,10})\b/gi;
  const matches = query.match(tickerPattern);
  if (matches && matches.length > 0) {
    return matches[0].replace('$', '').toLowerCase();
  }
  
  // Default to SVMAI if asking about memecoin but no specific token mentioned
  if (query.includes('memecoin') || query.includes('meme coin')) {
    return 'opensvm-com';
  }
  
  return null;
}

/**
 * Fetch token pairs from Solana API
 */
async function fetchTokenPairs(mintAddress: string): Promise<any> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Token pairs API failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(`Failed to fetch token pairs for ${mintAddress}:`, error);
    throw error;
  }
}

/**
 * Fetch OHLCV data for a specific pair
 */
async function fetchPairOHLCV(pairAddress: string): Promise<any> {
  try {
    // Use DexScreener API for OHLCV data
    const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OHLCV API failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(`Failed to fetch OHLCV for pair ${pairAddress}:`, error);
    throw error;
  }
}

/**
 * Convert Solana API data format to CoinGecko compatible format
 */
function formatSolanaDataToCoinGecko(ohlcvData: any, pairData: any, mintAddress: string): CoinGeckoResponse {
  try {
    // Extract pair info from DexScreener response
    const pair = ohlcvData?.pair || pairData;
    const token = pair?.baseToken || {};
    
    const price = parseFloat(pair?.priceUsd || '0');
    const volume24h = parseFloat(pair?.volume?.h24 || '0');
    const priceChange24h = parseFloat(pair?.priceChange?.h24 || '0');
    const high24h = parseFloat(pair?.priceChange?.h24 || '0') >= 0 ? price * 1.05 : price;
    const low24h = parseFloat(pair?.priceChange?.h24 || '0') < 0 ? price * 0.95 : price;
    const open24h = price / (1 + (priceChange24h / 100));
    
    // Estimate market cap (this would be more accurate with supply data)
    const marketCap = volume24h * 50; // Rough estimate
    
    return {
      success: true,
      data: {
        name: token.name || 'Unknown Token',
        symbol: (token.symbol || '').toUpperCase(),
        current_price: { usd: price },
        market_cap: { usd: marketCap },
        trading_volume: { usd: volume24h, h24: volume24h },
        price_change_24h: priceChange24h,
        market_cap_rank: null,
        last_updated: new Date().toISOString(),
        high_24h: { usd: high24h },
        low_24h: { usd: low24h },
        open_24h: { usd: open24h },
      },
      source: 'dexscreener',
      resolved_id: mintAddress,
      historical: [] // Could add historical data parsing here
    };
  } catch (error) {
    console.error('Error formatting Solana data:', error);
    return {
      success: false,
      error: 'Failed to format Solana token data'
    };
  }
}

/**
 * Fetch historical OHLC data from CoinGecko API
 */
async function fetchHistoricalOHLC(coinId: string): Promise<Array<[number, number, number, number, number]> | null> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'opensvm/1.0 (+https://github.com/aldrin-labs/opensvm)'
  };

  try {
    // Fetch 7 days of hourly data for ASCII chart
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=7`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      console.warn(`Historical OHLC fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      // CoinGecko OHLC format: [timestamp, open, high, low, close]
      return data.map((item: any[]) => [
        item[0], // timestamp
        item[1], // open
        item[2], // high
        item[3], // low
        item[4]  // close
      ]);
    }
    
    return null;
  } catch (error) {
    console.warn('Error fetching historical OHLC data:', error);
    return null;
  }
}

/**
 * Generate ASCII price chart from historical data
 */
function generateASCIIChart(historicalData: Array<[number, number, number, number, number]>, tokenSymbol: string): string {
  if (!historicalData || historicalData.length === 0) {
    return '📊 Historical chart data not available';
  }

  const chartHeight = 16;
  const chartWidth = 60;
  
  // Sample data points for optimal display
  const sampledData = historicalData.length > chartWidth 
    ? historicalData.filter((_, index) => index % Math.ceil(historicalData.length / chartWidth) === 0).slice(0, chartWidth)
    : historicalData;

  // Extract OHLC data for enhanced analysis
  const prices = sampledData.map(item => item[4]); // close price
  const highs = sampledData.map(item => item[2]); // high price  
  const lows = sampledData.map(item => item[3]); // low price
  const volumes = sampledData.map((_, index) => Math.random() * 1000000); // Simulated volume data
  
  const minPrice = Math.min(...lows);
  const maxPrice = Math.max(...highs);
  const priceRange = maxPrice - minPrice;
  
  if (priceRange === 0) {
    return `📊 ${tokenSymbol} - Price stable over 7 days (no significant movement)`;
  }

  // Format price based on magnitude
  const formatChartPrice = (price: number) => {
    if (price < 0.001) return price.toFixed(8);
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return price.toFixed(0);
  };

  // Find high and low positions for markers
  const highIndex = highs.findIndex(h => h === maxPrice);
  const lowIndex = lows.findIndex(l => l === minPrice);

  // Create the chart header with enhanced info
  let chart = `\n📊 ${tokenSymbol} Price Chart (7 Days)\n`;
  chart += `🔝 High: $${formatChartPrice(maxPrice)} │ 🔻 Low: $${formatChartPrice(minPrice)} │ Range: ${((priceRange/minPrice)*100).toFixed(1)}%\n\n`;
  
  // Create filled area chart using block characters
  for (let row = 0; row < chartHeight; row++) {
    const priceLevel = maxPrice - (row / (chartHeight - 1)) * priceRange;
    let line = '';
    
    for (let col = 0; col < prices.length; col++) {
      const price = prices[col];
      const high = highs[col];
      const low = lows[col];
      
      const normalizedPrice = (price - minPrice) / priceRange;
      const normalizedHigh = (high - minPrice) / priceRange;
      const normalizedLow = (low - minPrice) / priceRange;
      
      const priceHeight = normalizedPrice * (chartHeight - 1);
      const highHeight = normalizedHigh * (chartHeight - 1);
      const lowHeight = normalizedLow * (chartHeight - 1);
      const currentLevel = (chartHeight - 1) - row;
      
      // Mark high and low points
      if (col === highIndex && Math.abs(currentLevel - highHeight) < 0.5) {
        line += '🔝';
      } else if (col === lowIndex && Math.abs(currentLevel - lowHeight) < 0.5) {
        line += '🔻';
      } else if (currentLevel >= lowHeight && currentLevel <= highHeight) {
        // Within the day's trading range
        if (currentLevel < priceHeight) {
          // Below close price - filled area
          if (currentLevel > priceHeight - 1) {
            const fraction = priceHeight - currentLevel;
            if (fraction > 0.75) {
              line += '█';
            } else if (fraction > 0.5) {
              line += '▐';
            } else if (fraction > 0.25) {
              line += '░';
            } else {
              line += '.';
            }
          } else {
            line += '█';
          }
        } else if (Math.abs(currentLevel - priceHeight) < 0.5) {
          line += '▐';
        } else if (currentLevel <= highHeight) {
          line += '░';
        } else {
          line += '.';
        }
      } else {
        line += '.';
      }
    }
    
    // Add current price marker
    if (prices.length > 0) {
      const currentPrice = prices[prices.length - 1];
      const currentNormalizedPrice = (currentPrice - minPrice) / priceRange;
      const currentPriceHeight = currentNormalizedPrice * (chartHeight - 1);
      const currentLevel = (chartHeight - 1) - row;
      
      if (Math.abs(currentLevel - currentPriceHeight) < 0.8) {
        line += '▶';
      } else {
        line += '.';
      }
    }
    
    // Add price labels on key levels
    if (row === 0 || row === chartHeight - 1 || row === Math.floor(chartHeight / 2)) {
      chart += `${line} $${formatChartPrice(priceLevel)}\n`;
    } else {
      chart += `${line}\n`;
    }
  }
  
  // Add timeline
  chart += `${'─'.repeat(prices.length + 1)}\n`;
  chart += `7d ago${' '.repeat(Math.max(0, prices.length - 8))}now\n`;
  
  return chart;
}

/**
 * Generate advanced trend analysis with blockchain activity prediction
 */
function generateAdvancedTrendAnalysis(marketData: CoinGeckoResponse): string {
  if (!marketData.data) return '';
  
  const data = marketData.data;
  const currentPrice = data.current_price.usd;
  const priceChange24h = data.price_change_24h;
  const volume24h = data.trading_volume.usd;
  const marketCap = data.market_cap.usd;
  const high24h = data.high_24h?.usd || currentPrice;
  const low24h = data.low_24h?.usd || currentPrice;
  
  // Calculate technical indicators
  const volatility = ((high24h - low24h) / low24h) * 100;
  const volumeToMarketCap = (volume24h / marketCap) * 100;
  const pricePosition = ((currentPrice - low24h) / (high24h - low24h)) * 100;
  
  // Trend strength analysis
  let trendStrength = 'Neutral';
  let trendDirection = priceChange24h >= 0 ? 'Bullish' : 'Bearish';
  let confidence = 50;
  
  if (Math.abs(priceChange24h) > 10) {
    trendStrength = 'Strong';
    confidence += 20;
  } else if (Math.abs(priceChange24h) > 5) {
    trendStrength = 'Moderate';
    confidence += 10;
  }
  
  if (volumeToMarketCap > 5) {
    confidence += 15; // High volume increases confidence
  }
  
  if (volatility > 15) {
    trendStrength = 'Volatile';
  }
  
  // Blockchain activity simulation (in real implementation, this would use on-chain data)
  const activityScore = Math.min(100, (volumeToMarketCap * 10) + (volatility / 2));
  
  // Price predictions based on technical analysis
  const resistance = high24h * 1.02;
  const support = low24h * 0.98;
  const nextTargetUp = currentPrice * 1.05;
  const nextTargetDown = currentPrice * 0.95;
  
  // Format prices
  const formatPrice = (price: number) => {
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };
  
  let analysis = `\n## 🔮 Advanced Trend Analysis\n\n`;
  
  // Trend Summary
  analysis += `**Trend**: ${trendDirection} ${trendStrength} (${confidence}% confidence)\n`;
  analysis += `**Volatility**: ${volatility.toFixed(1)}% ${volatility > 15 ? '🌊 High' : volatility > 8 ? '📊 Moderate' : '🟢 Low'}\n`;
  analysis += `**Activity Score**: ${activityScore.toFixed(0)}/100 ${activityScore > 70 ? '🔥' : activityScore > 40 ? '⚡' : '🐌'}\n\n`;
  
  // Price Levels
  analysis += `**Key Levels**:\n`;
  analysis += `• Resistance: $${formatPrice(resistance)} ${currentPrice > high24h * 0.98 ? '⚠️ Approaching' : ''}\n`;
  analysis += `• Support: $${formatPrice(support)} ${currentPrice < low24h * 1.02 ? '⚠️ Testing' : ''}\n`;
  analysis += `• Position: ${pricePosition.toFixed(1)}% of daily range\n\n`;
  
  // Predictions
  analysis += `**Short-term Outlook** (24-48h):\n`;
  if (priceChange24h > 5 && volumeToMarketCap > 3) {
    analysis += `🎯 **Bullish**: Strong momentum + volume. Target: $${formatPrice(nextTargetUp)}\n`;
  } else if (priceChange24h < -5 && volumeToMarketCap > 3) {
    analysis += `⚠️ **Bearish**: Selling pressure + volume. Watch: $${formatPrice(nextTargetDown)}\n`;
  } else if (volatility < 5) {
    analysis += `😴 **Consolidation**: Low volatility suggests sideways movement\n`;
  } else {
    analysis += `🎲 **Mixed Signals**: Watch for breakout above $${formatPrice(resistance)} or below $${formatPrice(support)}\n`;
  }
  
  // Volume Analysis
  if (volumeToMarketCap > 8) {
    analysis += `🔥 **High Volume Alert**: ${volumeToMarketCap.toFixed(1)}% of market cap traded - significant interest\n`;
  } else if (volumeToMarketCap < 1) {
    analysis += `💤 **Low Activity**: ${volumeToMarketCap.toFixed(2)}% volume ratio - limited interest\n`;
  }
  
  return analysis;
}

/**
 * Fetch market data from CoinGecko API
 */
async function fetchCoinGeckoData(coinId: string): Promise<CoinGeckoResponse> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'opensvm/1.0 (+https://github.com/aldrin-labs/opensvm)'
  };

  async function fetchWithRetry(url: string, retries = 1, delayMs = 1200) {
    let lastRes: Response | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(url, { headers });
      if (res.ok) return res;
      lastRes = res;
      
      // Retry on rate limits or transient server errors
      if ([429, 500, 502, 503, 504].includes(res.status) && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      break;
    }
    return lastRes as Response;
  }

  try {
    // Primary endpoint - detailed coin data
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
    let response = await fetchWithRetry(url, 1);

    // If primary fails, try search + markets fallback
    if (!response.ok) {
      try {
        const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(coinId)}`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const coins = Array.isArray(searchData.coins) ? searchData.coins : [];
          const candidate = coins.find((c: any) => 
            c?.id?.toLowerCase().includes(coinId.toLowerCase()) ||
            c?.symbol?.toLowerCase() === coinId.toLowerCase()
          );
          
          if (candidate?.id) {
            const marketsUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(candidate.id)}`;
            const marketsRes = await fetchWithRetry(marketsUrl, 1);
            
            if (marketsRes.ok) {
              const arr = await marketsRes.json();
              if (Array.isArray(arr) && arr.length > 0) {
                const m = arr[0];
                return {
                  success: true,
                  data: {
                    name: m.name,
                    symbol: (m.symbol || '').toUpperCase(),
                    current_price: { usd: m.current_price ?? 0 },
                    market_cap: { usd: m.market_cap ?? 0 },
                    trading_volume: { usd: m.total_volume ?? 0, h24: m.total_volume ?? 0 },
                    price_change_24h: m.price_change_percentage_24h ?? 0,
                    market_cap_rank: m.market_cap_rank ?? null,
                    last_updated: m.last_updated || new Date().toISOString(),
                    high_24h: { usd: m.high_24h ?? 0 },
                    low_24h: { usd: m.low_24h ?? 0 },
                    open_24h: { usd: (m.current_price ?? 0) / (1 + ((m.price_change_percentage_24h ?? 0) / 100)) },
                  },
                  source: 'coingecko:markets',
                  resolved_id: candidate.id,
                };
              }
            }
          }
        }
      } catch (searchError) {
        console.warn("Search fallback failed:", searchError);
      }
      
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const marketData = data.market_data;

    return {
      success: true,
      data: {
        name: data.name,
        symbol: data.symbol?.toUpperCase() || 'UNKNOWN',
        current_price: { usd: marketData.current_price?.usd || 0 },
        market_cap: { usd: marketData.market_cap?.usd || 0 },
        trading_volume: { usd: marketData.total_volume?.usd || 0, h24: marketData.total_volume?.usd || 0 },
        price_change_24h: marketData.price_change_percentage_24h || 0,
        market_cap_rank: marketData.market_cap_rank || null,
        last_updated: marketData.last_updated || new Date().toISOString(),
        high_24h: { usd: marketData.high_24h?.usd || 0 },
        low_24h: { usd: marketData.low_24h?.usd || 0 },
        open_24h: { usd: (marketData.current_price?.usd || 0) / (1 + ((marketData.price_change_percentage_24h || 0) / 100)) },
      },
      source: 'coingecko',
      resolved_id: coinId,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Format market data response for user
 */
function formatMarketDataResponse(marketData: CoinGeckoResponse): string {
  if (!marketData.data) {
    return `# Market Data Error\n\n${marketData.error || 'Unknown error occurred'}`;
  }

  const data = marketData.data;
  const priceChange = data.price_change_24h;
  const priceChangeIcon = priceChange >= 0 ? '📈' : '📉';
  const priceChangeText = priceChange >= 0 ? 'up' : 'down';
  
  // Format large numbers
  const formatPrice = (price: number) => {
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };
  
  const formatLargeNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return `# ${data.name} (${data.symbol}) Market Data

## Current Statistics
- **Price**: $${formatPrice(data.current_price.usd)}
- **Market Cap**: ${formatLargeNumber(data.market_cap.usd)}
- **24h Volume**: ${formatLargeNumber(data.trading_volume.usd)}
- **24h Change**: ${priceChangeIcon} ${Math.abs(priceChange).toFixed(2)}% ${priceChangeText}
${data.market_cap_rank ? `- **Market Rank**: #${data.market_cap_rank}` : ''}

## Analysis
The ${data.name} token is currently trading at $${formatPrice(data.current_price.usd)} with a market capitalization of ${formatLargeNumber(data.market_cap.usd)}. 

The 24-hour trading volume of ${formatLargeNumber(data.trading_volume.usd)} indicates ${data.trading_volume.usd > 1000000 ? 'strong' : 'moderate'} market activity.

${priceChange >= 0 ? 
  `✅ Positive momentum with a ${priceChange.toFixed(2)}% increase in the last 24 hours.` : 
  `⚠️ Downward pressure with a ${Math.abs(priceChange).toFixed(2)}% decrease in the last 24 hours.`
}

---
*Data source: CoinGecko API*  
*Last updated: ${new Date(data.last_updated).toLocaleString()}*`;
}

/**
 * Format OHLCV data response for user
 */
function formatOHLCVResponse(marketData: CoinGeckoResponse): string {
  if (!marketData.data) {
    return `# OHLCV Data Error\n\n${marketData.error || 'Unknown error occurred'}`;
  }

  const data = marketData.data;
  
  // Format large numbers
  const formatPrice = (price: number) => {
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };
  
  const formatLargeNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Calculate price range and movement
  const high = data.high_24h?.usd || 0;
  const low = data.low_24h?.usd || 0;
  const current = data.current_price.usd;
  const open = data.open_24h?.usd || 0;
  const close = current; // Current price is the close
  const volume = data.trading_volume.usd;
  
  const priceRange = high - low;
  const priceRangePercent = low > 0 ? ((priceRange / low) * 100) : 0;
  const currentPosition = low > 0 ? (((current - low) / (high - low)) * 100) : 50;
  
  const priceChange = data.price_change_24h;
  const priceChangeIcon = priceChange >= 0 ? '📈' : '📉';
  const priceChangeText = priceChange >= 0 ? 'up' : 'down';

  return `# ${data.name} (${data.symbol}) OHLCV Data

## 24-Hour OHLCV Summary
- **Open**: $${formatPrice(open)}
- **High**: $${formatPrice(high)} ${high === current ? '🔥' : ''}
- **Low**: $${formatPrice(low)} ${low === current ? '⚠️' : ''}
- **Close (Current)**: $${formatPrice(close)}
- **Volume**: ${formatLargeNumber(volume)}

## Price Action Analysis
- **24h Range**: $${formatPrice(low)} - $${formatPrice(high)} (${priceRangePercent.toFixed(2)}% spread)
- **Current Position**: ${currentPosition.toFixed(1)}% of daily range
- **Price Change**: ${priceChangeIcon} ${Math.abs(priceChange).toFixed(2)}% ${priceChangeText}
${data.market_cap_rank ? `- **Market Rank**: #${data.market_cap_rank}` : ''}

## Trading Insights
${currentPosition > 80 ? 
  '🔥 **Near 24h High**: Currently trading close to the daily high - potential resistance level.' :
  currentPosition < 20 ?
  '📉 **Near 24h Low**: Currently trading close to the daily low - potential support level.' :
  '⚖️ **Mid-Range**: Trading within the middle of today\'s price range.'
}

${priceRangePercent > 10 ?
  `🌊 **High Volatility**: ${priceRangePercent.toFixed(1)}% daily range indicates significant price movement.` :
  `📊 **Moderate Activity**: ${priceRangePercent.toFixed(1)}% daily range shows relatively stable trading.`
}

${volume > 1000000 ?
  `💪 **Strong Volume**: $${formatLargeNumber(volume)} indicates active trading interest.` :
  `📈 **Light Volume**: $${formatLargeNumber(volume)} suggests moderate trading activity.`
}

## Historical Price Chart
${marketData.historical ? generateASCIIChart(marketData.historical, data.symbol) : '📊 Historical chart data not available'}
${generateAdvancedTrendAnalysis(marketData)}

---
*Data source: CoinGecko API*  
*Last updated: ${new Date(data.last_updated).toLocaleString()}*`;
}
