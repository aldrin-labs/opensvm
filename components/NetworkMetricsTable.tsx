"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import rough from 'roughjs';
import { useTheme } from '../lib/design-system/theme-provider';
import { Connection } from '@solana/web3.js';

interface BlockMetrics {
  timestamp: number;
  tps: number;
  blockTime: number;
  successRate: number;
  fees: number;
  cuOverpaid: number;
}

interface NetworkMetricsTableProps {
  endpoint?: string;
}

const MAX_BLOCKS = 20;

interface FilterState {
  tps: { min: number; max: number };
  blockTime: { min: number; max: number };
  successRate: { min: number; max: number };
  fees: { min: number; max: number };
  cuOverpaid: { min: number; max: number };
}

export function NetworkMetricsTable({ endpoint = 'https://api.mainnet-beta.solana.com' }: NetworkMetricsTableProps) {
  const { config } = useTheme();
  const theme = config.variant; // Map to old theme API for compatibility
  const [filters, setFilters] = useState<FilterState>({
    tps: { min: 0, max: Infinity },
    blockTime: { min: 0, max: Infinity },
    successRate: { min: 0, max: 100 },
    fees: { min: 0, max: Infinity },
    cuOverpaid: { min: 0, max: Infinity }
  });

  const [metrics, setMetrics] = useState<BlockMetrics[]>([]);
  const connectionRef = useRef<Connection | null>(null);
  const lastBlockRef = useRef<{
    slot: number;
    timestamp: number;
    transactions: number;
    successfulTransactions: number;
    fees: number;
    cu: number;
  } | null>(null);

  const processBlock = useCallback(async (slot: number) => {
    if (!connectionRef.current) return;

    try {
      const block = await connectionRef.current.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      });
      if (!block) return;

      const timestamp = Date.now();
      const transactions = block.transactions?.length || 0;
      const successfulTransactions = block.transactions?.filter((tx: any) => !tx.meta?.err).length || 0;
      const fees = block.transactions?.reduce((acc: number, tx: any) => acc + (tx.meta?.fee || 0), 0) || 0;
      const cu = block.transactions?.reduce((acc: number, tx: any) => acc + (tx.meta?.computeUnitsConsumed || 0), 0) || 0;

      const currentBlock = {
        slot,
        timestamp,
        transactions,
        successfulTransactions,
        fees,
        cu
      };

      if (lastBlockRef.current) {
        const timeDiff = (timestamp - lastBlockRef.current.timestamp) / 1000;
        const tps = transactions / timeDiff;
        const blockTime = timeDiff;
        const successRate = (successfulTransactions / transactions) * 100;
        const feesInSol = fees / 1e9;
        const cuOverpaid = cu > 0 ? (cu - transactions * 200_000) / transactions : 0;

        setMetrics(prev => {
          const newMetrics = [...prev, {
            timestamp,
            tps,
            blockTime,
            successRate,
            fees: feesInSol,
            cuOverpaid
          }];
          return newMetrics.slice(-MAX_BLOCKS);
        });
      }

      lastBlockRef.current = currentBlock;
    } catch (error) {
      console.error('Error processing block:', error);
    }
  }, []);

  useEffect(() => {
    const conn = new Connection(endpoint, {
      commitment: 'confirmed',
      wsEndpoint: endpoint.replace('https://', 'wss://').replace('http://', 'ws://')
    });
    connectionRef.current = conn;

    const subscriptionId = conn.onSlotChange(slot => {
      processBlock(slot.slot).catch(console.error);
    });

    return () => {
      conn.removeSlotChangeListener(subscriptionId);
      connectionRef.current = null;
    };
  }, [endpoint, processBlock]);

  const cellRefs = useRef<{ [key: string]: HTMLCanvasElement }>({});

  const filteredMetrics = metrics.filter(item =>
    item.tps >= filters.tps.min && item.tps <= filters.tps.max &&
    item.blockTime >= filters.blockTime.min && item.blockTime <= filters.blockTime.max &&
    item.successRate >= filters.successRate.min && item.successRate <= filters.successRate.max &&
    item.fees >= filters.fees.min && item.fees <= filters.fees.max &&
    item.cuOverpaid >= filters.cuOverpaid.min && item.cuOverpaid <= filters.cuOverpaid.max
  );

  // Draw visualizations
  useEffect(() => {
    Object.keys(filters).forEach(field => {
      const canvas = cellRefs.current[`latest-${field}`];
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rc = rough.canvas(canvas);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const padding = { top: 20, right: 20, bottom: 30, left: 40 };
      const graphWidth = canvas.width - padding.left - padding.right;
      const graphHeight = canvas.height - padding.top - padding.bottom;

      // Get last 20 points or all if less
      const points = filteredMetrics.filter(p => p[field as keyof BlockMetrics] !== null);
      if (points.length === 0) return;

      const maxValue = Math.max(...points.map(d => d[field as keyof BlockMetrics]));
      const minValue = Math.min(...points.map(d => d[field as keyof BlockMetrics]));
      const range = maxValue - minValue;

      // Draw axis with grid
      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (graphHeight * i) / gridLines;
        rc.line(
          padding.left - 5,
          y,
          canvas.width - padding.right,
          y,
          { stroke: '#333', strokeWidth: 0.2, roughness: 0.5 }
        );

        const value = maxValue - (range * i) / gridLines;
        ctx.font = '10px monospace';
        ctx.fillStyle = theme === 'high-contrast' ? '#fff' : '#666';
        ctx.textAlign = 'right';
        ctx.fillText(value.toFixed(1), padding.left - 8, y + 4);
      }

      // Draw data visualization
      const pointWidth = graphWidth / (points.length - 1);
      const getY = (value: number) => {
        const normalizedValue = (value - minValue) / (range || 1);
        return canvas.height - padding.bottom - normalizedValue * graphHeight;
      };

      switch (field) {
        case 'tps':
        case 'fees':
        case 'cuOverpaid': {
          // Gradient bars with connecting line
          const gradient = ctx.createLinearGradient(0, padding.top, 0, canvas.height - padding.bottom);
          gradient.addColorStop(0, '#00DC8233');
          gradient.addColorStop(1, '#00DC8211');

          // Draw area
          ctx.beginPath();
          ctx.moveTo(padding.left, canvas.height - padding.bottom);
          points.forEach((point, i) => {
            const x = padding.left + i * pointWidth;
            const y = getY(point[field as keyof BlockMetrics]);
            ctx.lineTo(x, y);
          });
          ctx.lineTo(padding.left + (points.length - 1) * pointWidth, canvas.height - padding.bottom);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw bars
          points.forEach((point, i) => {
            const x = padding.left + i * pointWidth;
            const y = getY(point[field as keyof BlockMetrics]);
            rc.line(
              x,
              canvas.height - padding.bottom,
              x,
              y,
              {
                stroke: '#00DC82',
                strokeWidth: 1.5,
                roughness: 0.5
              }
            );
          });
          break;
        }
        case 'blockTime': {
          // Connected dots with area
          const gradient = ctx.createLinearGradient(0, padding.top, 0, canvas.height - padding.bottom);
          gradient.addColorStop(0, '#FF4B4B33');
          gradient.addColorStop(1, '#FF4B4B11');

          // Draw area
          ctx.beginPath();
          ctx.moveTo(padding.left, canvas.height - padding.bottom);
          points.forEach((point, i) => {
            const x = padding.left + i * pointWidth;
            const y = getY(point[field as keyof BlockMetrics]);
            if (i === 0) {
              ctx.moveTo(x, canvas.height - padding.bottom);
            }
            ctx.lineTo(x, y);
          });
          ctx.lineTo(padding.left + (points.length - 1) * pointWidth, canvas.height - padding.bottom);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw connecting lines and dots
          points.forEach((point, i) => {
            const x = padding.left + i * pointWidth;
            const y = getY(point[field as keyof BlockMetrics]);

            if (i > 0 && points[i - 1]) {
              const prevX = padding.left + (i - 1) * pointWidth;
              const prevY = getY(points[i - 1]![field as keyof BlockMetrics]);
              rc.line(prevX, prevY, x, y, {
                stroke: '#FF4B4B',
                strokeWidth: 1.5,
                roughness: 0.5
              });
            }

            rc.circle(x, y, 3, {
              fill: '#FF4B4B',
              fillStyle: 'solid',
              stroke: 'none'
            });
          });
          break;
        }
        case 'successRate': {
          // Area chart with gradient
          const gradient = ctx.createLinearGradient(0, padding.top, 0, canvas.height - padding.bottom);
          gradient.addColorStop(0, '#4B7BFF33');
          gradient.addColorStop(1, '#4B7BFF11');

          // Draw smooth area
          ctx.beginPath();
          ctx.moveTo(padding.left, canvas.height - padding.bottom);
          points.forEach((point, i) => {
            const x = padding.left + i * pointWidth;
            const y = getY(point[field as keyof BlockMetrics]);
            if (i === 0) {
              ctx.moveTo(x, canvas.height - padding.bottom);
            }
            ctx.lineTo(x, y);
          });
          ctx.lineTo(padding.left + (points.length - 1) * pointWidth, canvas.height - padding.bottom);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();

          // Draw top line
          points.forEach((point, i) => {
            const x = padding.left + i * pointWidth;
            const y = getY(point[field as keyof BlockMetrics]);

            if (i > 0 && points[i - 1]) {
              const prevX = padding.left + (i - 1) * pointWidth;
              const prevY = getY(points[i - 1]![field as keyof BlockMetrics]);
              rc.line(prevX, prevY, x, y, {
                stroke: '#4B7BFF',
                strokeWidth: 1.5,
                roughness: 0.5
              });
            }
          });
          break;
        }
      }
    });
  }, [filteredMetrics, theme, filters]);

  const handleFilterChange = (field: keyof FilterState, type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? (type === 'min' ? 0 : Infinity) : Number(value);
    setFilters(prev => ({
      ...prev,
      [field]: { ...prev[field], [type]: numValue }
    }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8 animate-in fade-in-50 duration-700">
      {Object.keys(filters).map((field, index) => (
        <div key={field} className="bg-card rounded-lg border border-border p-6 group hover:border-primary/50 transition-all duration-700 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01] animate-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 150}ms`, animationDuration: '1s' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold capitalize">{field.replace(/([A-Z])/g, ' $1').toLowerCase()}</h3>
              <p className="text-xs text-muted-foreground">
                {field === 'tps' && 'Transactions per second'}
                {field === 'blockTime' && 'Time between blocks'}
                {field === 'successRate' && 'Transaction success rate'}
                {field === 'fees' && 'Average transaction fees'}
                {field === 'cuOverpaid' && 'Compute units overpaid'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold group-hover:text-primary transition-colors">
                {filteredMetrics[filteredMetrics.length - 1]?.[field as keyof BlockMetrics]?.toFixed(2) || '0.00'}
                <span className="text-xs text-muted-foreground ml-1">
                  {field === 'tps' && 'tx/s'}
                  {field === 'blockTime' && 's'}
                  {field === 'successRate' && '%'}
                  {field === 'fees' && 'SOL'}
                  {field === 'cuOverpaid' && 'CU'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Current value
              </div>
            </div>
          </div>

          <div className="relative h-[240px] mb-6 bg-background/50 rounded-lg p-4 hover:bg-background/80 transition-all duration-700 group-hover:shadow-inner group-hover:translate-y-[-2px]">
            <canvas
              ref={(el: HTMLCanvasElement | null) => {
                if (el) cellRefs.current[`latest-${field}`] = el;
              }}
              width={480}
              height={240}
              className="absolute inset-0 w-full h-full"
              role="img"
              aria-label={`${field} metric sparkline over recent blocks`}
            />
          </div>

          <div className="flex gap-3 opacity-50 group-hover:opacity-100 transition-all duration-700 group-hover:translate-y-[-1px]">
            <input
              type="number"
              placeholder="Min"
              className="flex-1 py-2 px-3 bg-background border border-border rounded text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all hover:bg-background/80 hover:shadow-sm focus:shadow-md"
              onChange={e => handleFilterChange(field as keyof FilterState, 'min', e.target.value)}
            />
            <input
              type="number"
              placeholder="Max"
              className="flex-1 py-2 px-3 bg-background border border-border rounded text-sm focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all hover:bg-background/80 hover:shadow-sm focus:shadow-md"
              onChange={e => handleFilterChange(field as keyof FilterState, 'max', e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
