'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';

interface TradingChartProps {
  market: string;
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

export default function TradingChart({ market }: TradingChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('15m');
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'];

  // Generate mock candle data
  useEffect(() => {
    const generateMockData = () => {
      const data: CandleData[] = [];
      let currentPrice = 100 + Math.random() * 50;
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

    setCandleData(generateMockData());
  }, [market, timeframe]);

  // Draw chart on canvas
  useEffect(() => {
    if (!canvasRef.current || candleData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Calculate price range
    const prices = candleData.flatMap(d => [d.high, d.low]);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice;
    const padding = priceRange * 0.1;

    // Draw grid lines
    ctx.strokeStyle = '#3e3e42';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = (rect.height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();

      // Draw price labels
      const price = maxPrice + padding - ((priceRange + padding * 2) / 5) * i;
      ctx.fillStyle = '#858585';
      ctx.font = '10px monospace';
      ctx.fillText(price.toFixed(2), rect.width - 60, y + 12);
    }

    // Draw candles or line
    const candleWidth = rect.width / candleData.length;
    const priceToY = (price: number) => {
      return rect.height - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * rect.height;
    };

    if (chartType === 'candles') {
      candleData.forEach((candle, index) => {
        const x = index * candleWidth;
        const openY = priceToY(candle.open);
        const closeY = priceToY(candle.close);
        const highY = priceToY(candle.high);
        const lowY = priceToY(candle.low);

        const isGreen = candle.close >= candle.open;
        const color = isGreen ? '#4ec9b0' : '#f48771';

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
      ctx.strokeStyle = '#4ec9b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      candleData.forEach((candle, index) => {
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
        const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
        gradient.addColorStop(0, 'rgba(78, 201, 176, 0.2)');
        gradient.addColorStop(1, 'rgba(78, 201, 176, 0)');
        
        ctx.lineTo(rect.width, rect.height);
        ctx.lineTo(0, rect.height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }

    // Draw current price line
    const currentPrice = candleData[candleData.length - 1]?.close;
    if (currentPrice) {
      const y = priceToY(currentPrice);
      ctx.strokeStyle = '#4ec9b0';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price label
      ctx.fillStyle = '#4ec9b0';
      ctx.fillRect(rect.width - 70, y - 10, 65, 20);
      ctx.fillStyle = '#1e1e1e';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(currentPrice.toFixed(2), rect.width - 65, y + 3);
    }
  }, [candleData, chartType]);

  const currentCandle = candleData[candleData.length - 1];
  const previousCandle = candleData[candleData.length - 2];
  const priceChange = currentCandle && previousCandle 
    ? ((currentCandle.close - previousCandle.close) / previousCandle.close) * 100 
    : 0;
  const isPositive = priceChange >= 0;

  return (
    <div className="trading-chart h-full flex flex-col bg-[#1e1e1e]">
      {/* Chart Controls */}
      <div className="chart-controls flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-[#3e3e42]">
        <div className="flex items-center gap-4">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-[#1e1e1e] rounded p-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  timeframe === tf
                    ? 'bg-[#4ec9b0] text-[#1e1e1e]'
                    : 'text-[#cccccc] hover:bg-[#3e3e42]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center gap-1 bg-[#1e1e1e] rounded p-1">
            <button
              onClick={() => setChartType('candles')}
              className={`px-2 py-1 rounded transition-colors ${
                chartType === 'candles'
                  ? 'bg-[#4ec9b0] text-[#1e1e1e]'
                  : 'text-[#cccccc] hover:bg-[#3e3e42]'
              }`}
              title="Candlestick"
            >
              <BarChart3 size={16} />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2 py-1 rounded transition-colors ${
                chartType === 'line'
                  ? 'bg-[#4ec9b0] text-[#1e1e1e]'
                  : 'text-[#cccccc] hover:bg-[#3e3e42]'
              }`}
              title="Line"
            >
              <Activity size={16} />
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-2 py-1 rounded transition-colors ${
                chartType === 'area'
                  ? 'bg-[#4ec9b0] text-[#1e1e1e]'
                  : 'text-[#cccccc] hover:bg-[#3e3e42]'
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
              <span className="text-[#858585]">O:</span>
              <span className="text-[#cccccc] font-mono">{currentCandle.open.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#858585]">H:</span>
              <span className="text-[#4ec9b0] font-mono">{currentCandle.high.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#858585]">L:</span>
              <span className="text-[#f48771] font-mono">{currentCandle.low.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#858585]">C:</span>
              <span className={`font-mono ${isPositive ? 'text-[#4ec9b0]' : 'text-[#f48771]'}`}>
                {currentCandle.close.toFixed(2)}
              </span>
            </div>
            <div className={`flex items-center gap-1 ${isPositive ? 'text-[#4ec9b0]' : 'text-[#f48771]'}`}>
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
          className="w-full h-full"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
}
