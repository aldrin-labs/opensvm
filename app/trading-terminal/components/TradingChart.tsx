'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTradingWebSocket } from '@/hooks/useTradingWebSocket';
import ConnectionStatusIndicator from './ConnectionStatusIndicator';

interface TradingChartProps {
  market: string;
  isLoading?: boolean;
}

type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';
type ChartType = 'candles' | 'line' | 'area';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Map trading pairs to Solana token mint addresses
const MARKET_TOKEN_MAP: Record<string, string> = {
  'SOL/USDC': 'So11111111111111111111111111111111111111112',
  'BONK/USDC': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUP/USDC': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'PYTH/USDC': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  'ORCA/USDC': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  'RAY/USDC': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'MNGO/USDC': 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
  'SRM/USDC': 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
  'FIDA/USDC': 'EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp',
  'STEP/USDC': 'StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT'
};

// Map timeframe to API interval types
const TIMEFRAME_MAP: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
  '1w': '1W'
};

/**
 * Aggregate trades into OHLCV candles for a given timeframe
 */
function aggregateTradesToCandles(trades: any[], timeframe: Timeframe): CandleData[] {
  if (!trades || trades.length === 0) return [];

  // Get timeframe in milliseconds
  const timeframeMs = {
    '1m': 60000,
    '5m': 300000,
    '15m': 900000,
    '1h': 3600000,
    '4h': 14400000,
    '1d': 86400000,
    '1w': 604800000
  }[timeframe];

  const candles: Map<number, CandleData> = new Map();

  // Group trades by timeframe bucket
  trades.forEach((trade: any) => {
    const timestamp = trade.timestamp || trade.time || Date.now();
    const bucket = Math.floor(timestamp / timeframeMs) * timeframeMs;
    const price = trade.price || 0;
    const amount = trade.amount || trade.size || 0;

    if (!candles.has(bucket)) {
      candles.set(bucket, {
        time: bucket,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: amount,
      });
    } else {
      const candle = candles.get(bucket)!;
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
      candle.volume += amount;
    }
  });

  // Sort candles by time
  return Array.from(candles.values()).sort((a, b) => a.time - b.time);
}

export default function TradingChart({ market, isLoading = false }: TradingChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTimeout, setIsTimeout] = useState(false);
  const [isRealData, setIsRealData] = useState(false);
  const [dataSource, setDataSource] = useState('Loading...');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

  // Get token mint for the market
  const tokenMint = MARKET_TOKEN_MAP[market] || MARKET_TOKEN_MAP['SOL/USDC'];

  // Use WebSocket for real-time data
  const { trades: wsTrades, candles: wsCandles, status, connect: connectWS, disconnect: disconnectWS } = useTradingWebSocket({
    market,
    tokenMint,
    autoConnect: true,
    maxTrades: 200,
    onTrade: (trade) => {
      console.log('[TradingChart] Received trade:', trade);
    },
    onCandle: (candle) => {
      console.log('[TradingChart] Received candle:', candle);
    },
    onError: (error) => {
      console.error('[TradingChart] WebSocket error:', error);
      setLoadError(error.message);
    },
  });

  // Update candles from WebSocket
  useEffect(() => {
    if (wsCandles.length > 0) {
      setCandleData(wsCandles);
      setIsRealData(true);
      setDataSource('Live WebSocket');
      setLoadError(null);
    }
  }, [wsCandles]);

  // Aggregate WebSocket trades into candles (debounced to avoid expensive recalculations)
  useEffect(() => {
    if (wsTrades.length === 0) return;

    // Debounce aggregation to avoid recalculating on every trade
    const aggregationTimer = setTimeout(() => {
      const aggregatedCandles = aggregateTradesToCandles(wsTrades, timeframe);
      if (aggregatedCandles.length > 0) {
        // Merge with existing candles
        setCandleData((prev) => {
          const merged = [...prev];
          aggregatedCandles.forEach((newCandle) => {
            const existingIndex = merged.findIndex((c) => c.time === newCandle.time);
            if (existingIndex >= 0) {
              // Update existing candle
              merged[existingIndex] = newCandle;
            } else {
              // Add new candle
              merged.push(newCandle);
            }
          });
          return merged.sort((a, b) => a.time - b.time);
        });
        setIsRealData(true);
        setDataSource(`Live Trades (${wsTrades.length})`);
      }
    }, 100); // 100ms debounce

    return () => clearTimeout(aggregationTimer);
  }, [wsTrades, timeframe]);

  // Fetch initial historical candle data from API (one-time)
  useEffect(() => {
    const generateMockData = () => {
      const data: CandleData[] = [];
      // Use SOL price range for more realistic data
      let currentPrice = 140 + Math.random() * 20;
      const now = Date.now();
      const interval = timeframe === '1m' ? 60000 :
                      timeframe === '5m' ? 300000 :
                      timeframe === '15m' ? 900000 :
                      timeframe === '1h' ? 3600000 :
                      timeframe === '4h' ? 14400000 :
                      timeframe === '1d' ? 86400000 : 604800000;

      for (let i = 100; i >= 0; i--) {
        const open = currentPrice;
        const change = (Math.random() - 0.5) * 5;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;
        const volume = 1000 + Math.random() * 5000;

        data.push({
          time: now - (i * interval),
          open,
          high,
          low,
          close,
          volume,
        });

        currentPrice = close;
      }
      return data;
    };

    const fetchChartData = async () => {
      try {
        // Get token mint address from market pair
        const mint = MARKET_TOKEN_MAP[market] || MARKET_TOKEN_MAP['SOL/USDC'];
        const apiTimeframe = TIMEFRAME_MAP[timeframe];

        // Fetch both chart data and recent trades in parallel
        const [chartResponse, tradesResponse] = await Promise.all([
          fetch(`/api/chart?mint=${mint}&type=${apiTimeframe}`),
          fetch(`/api/trading/trades?mint=${mint}&limit=100`)
        ]);

        if (!chartResponse.ok && !tradesResponse.ok) {
          throw new Error('Both APIs failed');
        }

        let finalCandles: CandleData[] = [];
        let hasRealData = false;
        let source = 'Mock Data';

        // Process chart data if available
        if (chartResponse.ok) {
          const data = await chartResponse.json();

          if (data.success && data.data?.items && data.data.items.length > 0) {
            // Map API data format to our CandleData format
            finalCandles = data.data.items.map((item: any) => ({
              time: item.unixTime * 1000,
              open: item.o,
              high: item.h,
              low: item.l,
              close: item.c,
              volume: item.v || 0
            }));
            hasRealData = true;
            source = `Real-time data`;
          }
        }

        // Process trades data to update last candle in real-time
        if (tradesResponse.ok) {
          const tradesData = await tradesResponse.json();

          if (tradesData.trades && tradesData.trades.length > 0) {
            // Aggregate recent trades into candles
            const tradeCandles = aggregateTradesToCandles(tradesData.trades, timeframe);

            if (tradeCandles.length > 0) {
              // If we have chart data, merge trades to update the last candle
              if (finalCandles.length > 0) {
                // Get the latest candle bucket from API data
                const lastCandle = finalCandles[finalCandles.length - 1];
                const tradeCandle = tradeCandles[tradeCandles.length - 1];

                // If trades are from the same bucket as the last candle, update it
                if (tradeCandle.time === lastCandle.time) {
                  finalCandles[finalCandles.length - 1] = {
                    ...lastCandle,
                    high: Math.max(lastCandle.high, tradeCandle.high),
                    low: Math.min(lastCandle.low, tradeCandle.low),
                    close: tradeCandle.close,
                    volume: lastCandle.volume + tradeCandle.volume
                  };
                  source = `Real-time data`;
                } else if (tradeCandle.time > lastCandle.time) {
                  // If trades are from a newer candle, append it
                  finalCandles.push(tradeCandle);
                  source = `Real-time data`;
                }
              } else {
                // Use trade candles if no API data available
                finalCandles = tradeCandles;
                hasRealData = true;
                source = 'Live Trades Aggregated';
              }
            }
          }
        }

        if (finalCandles.length > 0) {
          setCandleData(finalCandles);
          setIsRealData(hasRealData);
          setDataSource(source);
          setLoadError(null);
          setIsTimeout(false);
        } else {
          // No data from either source, fallback to mock
          console.warn('No chart or trade data available, using mock data');
          const mockData = generateMockData();
          setCandleData(mockData);
          setIsRealData(false);
          setDataSource('Mock Data');
        }
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to fetch chart data');

        // Fallback to mock data
        try {
          const mockData = generateMockData();
          setCandleData(mockData);
          setIsRealData(false);
          setDataSource('Mock Data (Error)');
        } catch (mockError) {
          setLoadError(mockError instanceof Error ? mockError.message : 'Failed to generate chart data');
        }
      }
    };

    // Initial fetch only - WebSocket will provide real-time updates
    fetchChartData();

    // No polling interval needed - using WebSocket for real-time updates
  }, [market, timeframe]); // Only refetch on market/timeframe change

  // Draw chart on canvas
  useEffect(() => {
    if (!canvasRef.current || candleData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get actual dimensions
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    // Set canvas size with proper scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Get theme colors from CSS variables
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const bgColor = styles.getPropertyValue('--background') || '0 0% 12%';
    const borderColor = styles.getPropertyValue('--border') || '0 0% 24%';
    const mutedColor = styles.getPropertyValue('--muted-foreground') || '0 0% 53%';
    const primaryColor = styles.getPropertyValue('--primary') || '142 76% 36%';
    const destructiveColor = styles.getPropertyValue('--destructive') || '0 84% 60%';
    
    // Convert HSL to hex for canvas
    const hslToHex = (hsl: string) => {
      const [h, s, l] = hsl.trim().split(' ').map(v => parseFloat(v));
      const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = (l / 100) - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    };
    
    const bgHex = hslToHex(bgColor);
    const borderHex = hslToHex(borderColor);
    const mutedHex = hslToHex(mutedColor);
    const primaryHex = hslToHex(primaryColor);
    const destructiveHex = hslToHex(destructiveColor);

    // Clear canvas
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Define chart areas
    const volumeHeight = 80; // Fixed height for volume bars
    const timeAxisHeight = 20; // Height for time axis
    const priceChartHeight = rect.height - volumeHeight - timeAxisHeight - 10; // 10px spacing
    const rightPadding = 70; // Space for price labels

    // Calculate price range
    const prices = candleData.flatMap(d => [d.high, d.low]);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1;

    // Draw horizontal grid lines for price chart
    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = (priceChartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width - rightPadding, y);
      ctx.stroke();

      // Draw price labels
      const price = maxPrice + padding - ((priceRange + padding * 2) / 5) * i;
      ctx.fillStyle = mutedHex;
      ctx.font = '10px monospace';
      ctx.fillText(price.toFixed(2), rect.width - rightPadding + 5, y + 4);
    }

    // Draw vertical grid lines and time labels
    const visibleCandles = Math.min(candleData.length, 50); // Show up to 50 candles
    const candleWidth = (rect.width - rightPadding) / visibleCandles;
    const startIndex = Math.max(0, candleData.length - visibleCandles);
    
    for (let i = 0; i < 6; i++) {
      const x = ((rect.width - rightPadding) / 5) * i;
      ctx.strokeStyle = borderHex;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, priceChartHeight);
      ctx.stroke();

      // Time label
      const candleIndex = startIndex + Math.floor((visibleCandles / 5) * i);
      if (candleData[candleIndex]) {
        const time = new Date(candleData[candleIndex].time);
        const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        ctx.fillStyle = mutedHex;
        ctx.font = '10px monospace';
        ctx.fillText(timeStr, x - 20, rect.height - 5);
      }
    }

    // Price to Y coordinate function
    const priceToY = (price: number) => {
      return priceChartHeight - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * priceChartHeight;
    };

    // Draw candles or lines (only visible portion)
    const visibleData = candleData.slice(startIndex);
    
    if (chartType === 'candles') {
      visibleData.forEach((candle, index) => {
        const x = index * candleWidth;
        const openY = priceToY(candle.open);
        const closeY = priceToY(candle.close);
        const highY = priceToY(candle.high);
        const lowY = priceToY(candle.low);

        const isGreen = candle.close >= candle.open;
        const color = isGreen ? primaryHex : destructiveHex;

        // Draw wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.stroke();

        // Draw body
        ctx.fillStyle = color;
        const bodyHeight = Math.abs(closeY - openY);
        const bodyY = Math.min(openY, closeY);
        ctx.fillRect(x + candleWidth * 0.2, bodyY, candleWidth * 0.6, Math.max(bodyHeight, 1));
      });
    } else {
      // Draw line/area chart
      ctx.strokeStyle = primaryHex;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      visibleData.forEach((candle, index) => {
        const x = index * candleWidth + candleWidth / 2;
        const y = priceToY(candle.close);
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();

      // Fill area if area chart
      if (chartType === 'area') {
        // Parse primary color to get HSL values
        const [h, s, l] = primaryColor.trim().split(' ').map(v => parseFloat(v));
        const gradient = ctx.createLinearGradient(0, 0, 0, priceChartHeight);
        gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, 0.2)`);
        gradient.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);
        
        ctx.lineTo(rect.width - rightPadding, priceChartHeight);
        ctx.lineTo(0, priceChartHeight);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
    // Draw volume bars in dedicated area
    const volumeStartY = priceChartHeight + 10; // 10px spacing
    const maxVolume = Math.max(...visibleData.map(d => d.volume));
    
    visibleData.forEach((candle, index) => {
      const x = index * candleWidth;
      const volumeBarHeight = (candle.volume / maxVolume) * (volumeHeight - 5); // 5px padding
      const isGreen = candle.close >= candle.open;
      const color = isGreen ? primaryHex : destructiveHex;
      
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(
        x + candleWidth * 0.2, 
        volumeStartY + (volumeHeight - 5 - volumeBarHeight), 
        candleWidth * 0.6, 
        volumeBarHeight
      );
      ctx.globalAlpha = 1.0;
    });

    // Draw separator line between price chart and volume
    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, priceChartHeight + 5);
    ctx.lineTo(rect.width - rightPadding, priceChartHeight + 5);
    ctx.stroke();

    // Draw current price line
    const currentPrice = candleData[candleData.length - 1]?.close;
    if (currentPrice) {
      const y = priceToY(currentPrice);
      ctx.strokeStyle = primaryHex;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width - rightPadding, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price label
      ctx.fillStyle = primaryHex;
      ctx.fillRect(rect.width - rightPadding + 2, y - 10, rightPadding - 4, 20);
      ctx.fillStyle = bgHex;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(currentPrice.toFixed(2), rect.width - rightPadding + 7, y + 3);
    }

    // Draw crosshair if mouse is hovering
    if (mousePos && mousePos.x < rect.width - rightPadding && mousePos.y < priceChartHeight) {
      // Vertical line
      ctx.strokeStyle = primaryHex;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mousePos.x, 0);
      ctx.lineTo(mousePos.x, priceChartHeight);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, mousePos.y);
      ctx.lineTo(rect.width - rightPadding, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price label at crosshair
      const candleIndex = Math.floor(mousePos.x / candleWidth);
      if (visibleData[candleIndex]) {
        const hoverPrice = minPrice + padding + ((priceChartHeight - mousePos.y) / priceChartHeight) * (priceRange + padding * 2);
        // Get card background color for label
        const cardBgColor = styles.getPropertyValue('--card') || '0 0% 15%';
        const cardBgHex = hslToHex(cardBgColor);
        const foregroundColor = styles.getPropertyValue('--foreground') || '0 0% 80%';
        const foregroundHex = hslToHex(foregroundColor);
        
        ctx.fillStyle = cardBgHex;
        ctx.fillRect(rect.width - rightPadding + 2, mousePos.y - 10, rightPadding - 4, 20);
        ctx.fillStyle = foregroundHex;
        ctx.font = '10px monospace';
        ctx.fillText(hoverPrice.toFixed(2), rect.width - rightPadding + 7, mousePos.y + 3);
      }
    }
  }, [candleData, chartType, mousePos]);

  // Add resize observer to redraw on window resize
  useEffect(() => {
    if (!canvasRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // Trigger a redraw by updating state
      setCandleData(prev => [...prev]);
    });

    resizeObserver.observe(canvasRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Mouse handlers for crosshair and tooltips
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || candleData.length === 0) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x, y });
    
    // Find the candle at mouse position
    const visibleCandles = Math.min(candleData.length, 50);
    const startIndex = Math.max(0, candleData.length - visibleCandles);
    const rightPadding = 70;
    const candleWidth = (rect.width - rightPadding) / visibleCandles;
    const candleIndex = startIndex + Math.floor(x / candleWidth);
    
    if (candleIndex >= startIndex && candleIndex < candleData.length) {
      setHoveredCandle(candleData[candleIndex]);
    }
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    setHoveredCandle(null);
  };

  const currentCandle = candleData[candleData.length - 1];
  const previousCandle = candleData[candleData.length - 2];
  const priceChange = currentCandle && previousCandle 
    ? ((currentCandle.close - previousCandle.close) / previousCandle.close) * 100 
    : 0;
  const isPositive = priceChange >= 0;

  // Error state
  if (loadError || isTimeout) {
    return (
      <div className="trading-chart h-full flex flex-col bg-background">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="text-destructive text-lg mb-2">⚠️ Chart Error</div>
          <p className="text-muted-foreground text-sm mb-4 text-center max-w-md">
            {loadError || 'Chart data failed to load'}
          </p>
          <button
            onClick={() => {
              setLoadError(null);
              setIsTimeout(false);
              window.location.reload();
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (isLoading || candleData.length === 0) {
    return (
      <div className="trading-chart h-full flex flex-col bg-background">
        {/* Chart Controls Skeleton */}
        <div className="chart-controls flex items-center justify-between px-4 py-2 bg-card border-b border-border">
          <div className="flex items-center gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="w-12 h-7" />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-8 h-8" />
            ))}
          </div>
        </div>

        {/* Chart Area Skeleton */}
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="w-full h-full relative">
            <Skeleton className="w-full h-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-muted-foreground text-sm">
                Loading chart data...
                <div className="text-xs mt-2">This may take up to 10 seconds</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="trading-chart h-full flex flex-col bg-background">
      {/* Chart Controls */}
      <div className="chart-controls flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-background rounded p-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  timeframe === tf
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* WebSocket Connection Status */}
          <ConnectionStatusIndicator
            connected={status.connected}
            reconnecting={status.reconnecting}
            size="sm"
          />

          {/* Chart Type Selector */}
          <div className="flex items-center gap-1 bg-background rounded p-1">
            <button
              onClick={() => setChartType('candles')}
              className={`px-2 py-1 rounded transition-colors ${
                chartType === 'candles'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
              title="Candlestick"
            >
              <BarChart3 size={16} />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded transition-colors ${
                chartType === 'line'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
              title="Line"
            >
              <Activity size={16} />
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-1 rounded transition-colors ${
                chartType === 'area'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
              title="Area"
            >
              <TrendingUp size={16} />
            </button>
          </div>
        </div>

        {/* Price Info */}
        {currentCandle && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">O:</span>
              <span className="text-foreground font-mono">{currentCandle.open.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">H:</span>
              <span className="text-primary font-mono">{currentCandle.high.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">L:</span>
              <span className="text-destructive font-mono">{currentCandle.low.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">C:</span>
              <span className={`font-mono ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                {currentCandle.close.toFixed(2)}
              </span>
            </div>
            <div className={`flex items-center gap-1 ${isPositive ? 'text-primary' : 'text-destructive'}`}>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span className="font-mono text-sm">{isPositive ? '+' : ''}{priceChange.toFixed(2)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 relative min-h-0">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          style={{ display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {/* Tooltip */}
        {hoveredCandle && mousePos && (
          <div 
            className="absolute bg-card border border-primary rounded p-2 text-xs pointer-events-none z-10"
            style={{
              left: `${mousePos.x + 10}px`,
              top: `${mousePos.y + 10}px`,
            }}
          >
            <div className="flex flex-col gap-1">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">O:</span>
                <span className="text-foreground font-mono">{hoveredCandle.open.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">H:</span>
                <span className="text-primary font-mono">{hoveredCandle.high.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">L:</span>
                <span className="text-destructive font-mono">{hoveredCandle.low.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">C:</span>
                <span className={`font-mono ${hoveredCandle.close >= hoveredCandle.open ? 'text-primary' : 'text-destructive'}`}>
                  {hoveredCandle.close.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">V:</span>
                <span className="text-foreground font-mono">{hoveredCandle.volume.toFixed(0)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
