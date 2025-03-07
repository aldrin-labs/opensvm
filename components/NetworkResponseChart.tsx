'use client';

import { memo, useMemo, Suspense } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';

// Register Chart.js components only once
if (typeof window !== 'undefined') {
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
  );
}

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
  // Use useMemo to memoize chart data and options
  const chartData: ChartData<'line'> = useMemo(() => ({
    labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Success Rate',
        data: data.map(d => d.successRate),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        yAxisID: 'y',
        // Performance optimizations
        pointRadius: data.length > 20 ? 0 : 3,
        borderWidth: 2,
        tension: 0.4,
      },
      {
        label: 'Latency (ms)',
        data: data.map(d => d.latency),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        yAxisID: 'y1',
        // Performance optimizations
        pointRadius: data.length > 20 ? 0 : 3,
        borderWidth: 2,
        tension: 0.4,
      }
    ]
  }), [data]);

  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    animation: {
      duration: 0, // Disable animations for better performance
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Success Rate (%)'
        },
        min: 0,
        max: 100,
        ticks: {
          maxTicksLimit: 5, // Limit number of ticks for better performance
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Latency (ms)'
        },
        min: 0,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          maxTicksLimit: 5, // Limit number of ticks for better performance
        }
      },
      x: {
        ticks: {
          maxTicksLimit: 10, // Limit number of ticks for better performance
          maxRotation: 0, // Prevent label rotation for better performance
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
      }
    },
    elements: {
      line: {
        tension: 0.4, // Smooth lines for better visual
      },
      point: {
        radius: data.length > 20 ? 0 : 3, // Hide points when there are many data points
      }
    },
    // Disable animations for better performance
    transitions: {
      active: {
        animation: {
          duration: 0
        }
      }
    }
  }), [data.length]);

  // Use a lightweight loading state
  return (
    <div className="w-full h-full">
      <Line data={chartData} options={options} />
    </div>
  );
});

export default NetworkResponseChart;