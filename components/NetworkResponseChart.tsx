'use client';

import { memo, useMemo } from 'react';
import LightweightChart from './LightweightChart';

interface NetworkData {
  timestamp: number;
  successRate: number;
  latency: number;
}

interface Props {
  data: NetworkData[];
}

// Use memo to prevent unnecessary re-renders
const NetworkResponseChart = memo(function NetworkResponseChart({ data }: Props) {
  // Transform data for the chart
  const chartSeries = useMemo(() => [
    {
      name: 'Success Rate',
      data: data.map(d => ({
        value: d.successRate,
        label: new Date(d.timestamp).toLocaleTimeString()
      })),
      color: 'rgb(75, 192, 192)',
      yAxisId: 'left' as const
    },
    {
      name: 'Latency (ms)',
      data: data.map(d => ({
        value: d.latency,
        label: new Date(d.timestamp).toLocaleTimeString()
      })),
      color: 'rgb(255, 99, 132)',
      yAxisId: 'right' as const
    }
  ], [data]);

  // Chart options
  const chartOptions = useMemo(() => ({
    height: 300,
    yAxis: {
      left: {
        min: 0,
        max: 100,
        title: 'Success Rate (%)'
      },
      right: {
        min: 0,
        title: 'Latency (ms)'
      }
    },
    xAxis: {
      showLabels: true,
      maxLabels: 10
    },
    grid: {
      show: true,
      color: 'rgba(200, 200, 200, 0.2)'
    }
  }), []);

  return (
    <div className="w-full h-full">
      <LightweightChart 
        series={chartSeries} 
        options={chartOptions} 
        className="w-full h-full"
      />
    </div>
  );
});

export default NetworkResponseChart;