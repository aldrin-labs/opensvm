/**
 * Prediction Markets Historical Data Service
 *
 * Features:
 * - OHLC candlestick data collection
 * - 7-day price history storage
 * - Multiple timeframe support (5m, 15m, 1h, 4h, 1d)
 * - In-memory cache with periodic persistence
 */

export type Timeframe = '5m' | '15m' | '1h' | '4h' | '1d';

export interface OHLC {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketHistory {
  marketId: string;
  platform: string;
  title: string;
  candles: Map<Timeframe, OHLC[]>;
  lastPrice: number;
  lastUpdate: number;
}

export interface CandleData {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

// Timeframe durations in milliseconds
const TIMEFRAME_MS: Record<Timeframe, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

// Max candles to keep per timeframe
const MAX_CANDLES: Record<Timeframe, number> = {
  '5m': 288 * 7,   // 7 days of 5m candles
  '15m': 96 * 7,   // 7 days of 15m candles
  '1h': 24 * 7,    // 7 days of 1h candles
  '4h': 6 * 7,     // 7 days of 4h candles
  '1d': 30,        // 30 days of daily candles
};

/**
 * HistoricalDataStore - In-memory store for market price history
 */
export class HistoricalDataStore {
  private history: Map<string, MarketHistory> = new Map();
  private currentCandles: Map<string, Map<Timeframe, OHLC>> = new Map();

  // Get key for market
  private getKey(platform: string, marketId: string): string {
    return `${platform}:${marketId}`;
  }

  // Get or create market history
  private getOrCreateHistory(platform: string, marketId: string, title: string): MarketHistory {
    const key = this.getKey(platform, marketId);
    let history = this.history.get(key);

    if (!history) {
      history = {
        marketId,
        platform,
        title,
        candles: new Map([
          ['5m', []],
          ['15m', []],
          ['1h', []],
          ['4h', []],
          ['1d', []],
        ]),
        lastPrice: 0,
        lastUpdate: 0,
      };
      this.history.set(key, history);
    }

    return history;
  }

  // Get candle bucket timestamp
  private getCandleBucket(timestamp: number, timeframe: Timeframe): number {
    const ms = TIMEFRAME_MS[timeframe];
    return Math.floor(timestamp / ms) * ms;
  }

  // Record a price update
  recordPrice(params: {
    platform: string;
    marketId: string;
    title: string;
    price: number;
    volume: number;
    timestamp?: number;
  }): void {
    const { platform, marketId, title, price, volume, timestamp = Date.now() } = params;
    const key = this.getKey(platform, marketId);
    const history = this.getOrCreateHistory(platform, marketId, title);

    // Update each timeframe
    const timeframes: Timeframe[] = ['5m', '15m', '1h', '4h', '1d'];

    timeframes.forEach(tf => {
      const bucket = this.getCandleBucket(timestamp, tf);
      const candleKey = `${key}:${tf}`;

      let currentCandles = this.currentCandles.get(key);
      if (!currentCandles) {
        currentCandles = new Map();
        this.currentCandles.set(key, currentCandles);
      }

      let candle = currentCandles.get(tf);

      // Check if we need a new candle
      if (!candle || candle.timestamp !== bucket) {
        // Save previous candle if exists
        if (candle) {
          const candles = history.candles.get(tf)!;
          candles.push(candle);
          // Trim to max
          if (candles.length > MAX_CANDLES[tf]) {
            candles.splice(0, candles.length - MAX_CANDLES[tf]);
          }
        }

        // Create new candle
        candle = {
          timestamp: bucket,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume,
        };
        currentCandles.set(tf, candle);
      } else {
        // Update existing candle
        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price;
        candle.volume = volume;
      }
    });

    history.lastPrice = price;
    history.lastUpdate = timestamp;
  }

  // Get candles for a market
  getCandles(platform: string, marketId: string, timeframe: Timeframe): OHLC[] {
    const key = this.getKey(platform, marketId);
    const history = this.history.get(key);
    if (!history) return [];

    const candles = [...(history.candles.get(timeframe) || [])];

    // Add current candle if exists
    const currentCandles = this.currentCandles.get(key);
    if (currentCandles) {
      const current = currentCandles.get(timeframe);
      if (current) {
        candles.push(current);
      }
    }

    return candles;
  }

  // Get formatted candle data for charts
  getCandleData(platform: string, marketId: string, timeframe: Timeframe): CandleData[] {
    const candles = this.getCandles(platform, marketId, timeframe);

    return candles.map((candle, index) => {
      const prevClose = index > 0 ? candles[index - 1].close : candle.open;
      const change = candle.close - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        time: this.formatTime(candle.timestamp, timeframe),
        timestamp: candle.timestamp,
        open: candle.open * 100, // Convert to percentage
        high: candle.high * 100,
        low: candle.low * 100,
        close: candle.close * 100,
        volume: candle.volume,
        change: change * 100,
        changePercent,
      };
    });
  }

  // Format timestamp for display
  private formatTime(timestamp: number, timeframe: Timeframe): string {
    const date = new Date(timestamp);

    switch (timeframe) {
      case '5m':
      case '15m':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '1h':
      case '4h':
        return date.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
        });
      case '1d':
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  // Get price statistics
  getStats(platform: string, marketId: string): {
    current: number;
    high24h: number;
    low24h: number;
    change24h: number;
    changePercent24h: number;
    volume24h: number;
  } | null {
    const key = this.getKey(platform, marketId);
    const history = this.history.get(key);
    if (!history) return null;

    // Get 1h candles for last 24h
    const candles = this.getCandles(platform, marketId, '1h').slice(-24);
    if (candles.length === 0) return null;

    const current = history.lastPrice;
    const high24h = Math.max(...candles.map(c => c.high));
    const low24h = Math.min(...candles.map(c => c.low));
    const open24h = candles[0].open;
    const change24h = current - open24h;
    const changePercent24h = open24h > 0 ? (change24h / open24h) * 100 : 0;
    const volume24h = candles.reduce((sum, c) => sum + c.volume, 0);

    return {
      current: current * 100,
      high24h: high24h * 100,
      low24h: low24h * 100,
      change24h: change24h * 100,
      changePercent24h,
      volume24h,
    };
  }

  // Get all tracked markets
  getTrackedMarkets(): Array<{
    platform: string;
    marketId: string;
    title: string;
    lastPrice: number;
    lastUpdate: number;
  }> {
    return Array.from(this.history.values()).map(h => ({
      platform: h.platform,
      marketId: h.marketId,
      title: h.title,
      lastPrice: h.lastPrice * 100,
      lastUpdate: h.lastUpdate,
    }));
  }

  // Clear old data
  cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;

    this.history.forEach((history, key) => {
      if (history.lastUpdate < cutoff) {
        this.history.delete(key);
        this.currentCandles.delete(key);
      }
    });
  }

  // Export data for persistence
  export(): string {
    const data: Record<string, {
      marketId: string;
      platform: string;
      title: string;
      candles: Record<Timeframe, OHLC[]>;
      lastPrice: number;
      lastUpdate: number;
    }> = {};

    this.history.forEach((history, key) => {
      data[key] = {
        marketId: history.marketId,
        platform: history.platform,
        title: history.title,
        candles: {
          '5m': history.candles.get('5m') || [],
          '15m': history.candles.get('15m') || [],
          '1h': history.candles.get('1h') || [],
          '4h': history.candles.get('4h') || [],
          '1d': history.candles.get('1d') || [],
        },
        lastPrice: history.lastPrice,
        lastUpdate: history.lastUpdate,
      };
    });

    return JSON.stringify(data);
  }

  // Import data from persistence
  import(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);

      Object.entries(data).forEach(([key, value]: [string, any]) => {
        const history: MarketHistory = {
          marketId: value.marketId,
          platform: value.platform,
          title: value.title,
          candles: new Map([
            ['5m', value.candles['5m'] || []],
            ['15m', value.candles['15m'] || []],
            ['1h', value.candles['1h'] || []],
            ['4h', value.candles['4h'] || []],
            ['1d', value.candles['1d'] || []],
          ]),
          lastPrice: value.lastPrice,
          lastUpdate: value.lastUpdate,
        };
        this.history.set(key, history);
      });
    } catch (e) {
      console.error('[History] Failed to import data:', e);
    }
  }
}

// Singleton instance
let historyStore: HistoricalDataStore | null = null;

export function getHistoryStore(): HistoricalDataStore {
  if (!historyStore) {
    historyStore = new HistoricalDataStore();
  }
  return historyStore;
}

export default {
  HistoricalDataStore,
  getHistoryStore,
};
