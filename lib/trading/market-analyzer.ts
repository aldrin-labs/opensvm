/**
 * Market Condition Analyzer
 *
 * Analyzes market conditions for AI-powered DCA timing optimization.
 * Phase 1 of AI-Powered Dynamic DCA system.
 */

export interface MarketConditions {
  price: number;
  change24h: number;
  rsi14: number; // Relative Strength Index (14-period)
  ma7: number; // 7-day Moving Average
  ma30: number; // 30-day Moving Average
  volume24h: number;
  volatility30d: number;
  isDip: boolean; // Price dropped >5% from recent high
  isOverbought: boolean; // RSI > 70
  isOversold: boolean; // RSI < 30
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface PriceHistory {
  timestamp: number;
  price: number;
  volume: number;
}

/**
 * Calculate Relative Strength Index (RSI)
 *
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss over n periods
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) {
    throw new Error(`Need at least ${period + 1} prices to calculate RSI`);
  }

  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Separate gains and losses
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

  // Calculate initial average gain/loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Use smoothed moving average for remaining periods
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  // Avoid division by zero
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Number(rsi.toFixed(2));
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateMA(prices: number[], period: number): number {
  if (prices.length < period) {
    throw new Error(`Need at least ${period} prices to calculate MA`);
  }

  const recentPrices = prices.slice(-period);
  const sum = recentPrices.reduce((a, b) => a + b, 0);
  return Number((sum / period).toFixed(2));
}

/**
 * Calculate volatility (standard deviation of returns)
 */
export function calculateVolatility(prices: number[], period: number = 30): number {
  if (prices.length < period + 1) {
    throw new Error(`Need at least ${period + 1} prices to calculate volatility`);
  }

  const recentPrices = prices.slice(-period - 1);

  // Calculate returns
  const returns: number[] = [];
  for (let i = 1; i < recentPrices.length; i++) {
    returns.push((recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1]);
  }

  // Calculate mean return
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Calculate variance
  const squaredDiffs = returns.map(r => Math.pow(r - meanReturn, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;

  // Standard deviation (annualized)
  const volatility = Math.sqrt(variance) * Math.sqrt(365) * 100;

  return Number(volatility.toFixed(2));
}

/**
 * Detect if current price is a dip (>5% drop from recent high)
 */
export function detectDip(prices: number[], lookbackPeriod: number = 7, dipThreshold: number = 0.05): boolean {
  if (prices.length < lookbackPeriod + 1) return false;

  const recentPrices = prices.slice(-(lookbackPeriod + 1));
  const currentPrice = recentPrices[recentPrices.length - 1];
  const recentHigh = Math.max(...recentPrices.slice(0, -1));

  const dropPercentage = (recentHigh - currentPrice) / recentHigh;

  return dropPercentage >= dipThreshold;
}

/**
 * Detect market trend using moving averages
 */
export function detectTrend(prices: number[]): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (prices.length < 30) return 'NEUTRAL';

  const currentPrice = prices[prices.length - 1];
  const ma7 = calculateMA(prices, 7);
  const ma30 = calculateMA(prices, 30);

  // Golden cross: MA7 > MA30 and price > MA7 = Bullish
  // Death cross: MA7 < MA30 and price < MA7 = Bearish

  if (currentPrice > ma7 && ma7 > ma30) {
    return 'BULLISH';
  } else if (currentPrice < ma7 && ma7 < ma30) {
    return 'BEARISH';
  } else {
    return 'NEUTRAL';
  }
}

/**
 * Fetch historical prices for an asset
 *
 * In production, this would call Jupiter Price API or CoinGecko
 */
export async function fetchHistoricalPrices(
  asset: string,
  days: number
): Promise<PriceHistory[]> {
  // TODO: Replace with actual API call
  // For now, use Jupiter Price API or CoinGecko

  // Mock implementation for testing
  if (process.env.NODE_ENV === 'development') {
    return generateMockPriceHistory(asset, days);
  }

  try {
    // Jupiter Price API (v4)
    const response = await fetch(
      `https://price.jup.ag/v4/price?ids=${asset}&vsToken=USDC`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch price: ${response.statusText}`);
    }

    const data = await response.json();

    // Jupiter only provides current price, need to call historical endpoint
    // or use alternative like CoinGecko for historical data

    // Fallback to CoinGecko for historical data
    return await fetchCoinGeckoHistoricalPrices(asset, days);
  } catch (error) {
    console.error('Error fetching historical prices:', error);
    throw error;
  }
}

/**
 * Fetch historical prices from CoinGecko
 */
async function fetchCoinGeckoHistoricalPrices(
  asset: string,
  days: number
): Promise<PriceHistory[]> {
  const coinGeckoIds: Record<string, string> = {
    SOL: 'solana',
    BTC: 'bitcoin',
    ETH: 'ethereum',
    USDC: 'usd-coin',
    BONK: 'bonk',
  };

  const coinId = coinGeckoIds[asset];
  if (!coinId) {
    throw new Error(`Unsupported asset: ${asset}`);
  }

  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.statusText}`);
  }

  const data = await response.json();

  return data.prices.map((item: [number, number]) => ({
    timestamp: item[0],
    price: item[1],
    volume: 0, // Volume data separate in CoinGecko response
  }));
}

/**
 * Generate mock price history for testing
 */
function generateMockPriceHistory(asset: string, days: number): PriceHistory[] {
  const basePrices: Record<string, number> = {
    SOL: 200,
    BTC: 45000,
    ETH: 2500,
    BONK: 0.00001,
  };

  const basePrice = basePrices[asset] || 100;
  const history: PriceHistory[] = [];
  const now = Date.now();

  for (let i = days; i >= 0; i--) {
    // Simulate price with random walk
    const randomChange = (Math.random() - 0.5) * 0.1; // ±5% per day
    const price = basePrice * (1 + randomChange * (days - i) / days);

    history.push({
      timestamp: now - (i * 24 * 60 * 60 * 1000),
      price: Number(price.toFixed(6)),
      volume: Math.random() * 1000000,
    });
  }

  return history;
}

/**
 * Fetch current 24h volume
 */
export async function fetchVolume(asset: string, hours: number = 24): Promise<number> {
  // TODO: Implement actual volume fetching from Jupiter or CoinGecko

  // Mock for now
  const mockVolumes: Record<string, number> = {
    SOL: 500000000,
    BTC: 20000000000,
    ETH: 10000000000,
    BONK: 50000000,
  };

  return mockVolumes[asset] || 1000000;
}

/**
 * Calculate average volume over a period
 */
export async function fetchAvgVolume(asset: string, days: number): Promise<number> {
  // TODO: Implement actual average volume calculation

  const currentVolume = await fetchVolume(asset, 24);
  return currentVolume; // Simplified for now
}

/**
 * Main market analysis function
 *
 * Analyzes current market state for a given asset
 */
export async function analyzeMarket(asset: string): Promise<MarketConditions> {
  // Fetch historical prices (last 30 days)
  const priceHistory = await fetchHistoricalPrices(asset, 30);
  const prices = priceHistory.map(p => p.price);

  if (prices.length < 30) {
    throw new Error(`Insufficient price data for ${asset}`);
  }

  const currentPrice = prices[prices.length - 1];
  const previousPrice = prices[prices.length - 2];

  // Calculate all indicators
  const rsi14 = calculateRSI(prices, 14);
  const ma7 = calculateMA(prices, 7);
  const ma30 = calculateMA(prices, 30);
  const volatility30d = calculateVolatility(prices, 30);
  const isDip = detectDip(prices);
  const trend = detectTrend(prices);

  // Fetch volume
  const volume24h = await fetchVolume(asset, 24);

  return {
    price: currentPrice,
    change24h: ((currentPrice - previousPrice) / previousPrice) * 100,
    rsi14,
    ma7,
    ma30,
    volume24h,
    volatility30d,
    isDip,
    isOverbought: rsi14 > 70,
    isOversold: rsi14 < 30,
    trend,
  };
}
