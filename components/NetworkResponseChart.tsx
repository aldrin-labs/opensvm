'use client';

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

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface NetworkData {
  timestamp: number;
  successRate: number;
  latency: number;
}

interface Props {
  data: NetworkData[];
}

export default function NetworkResponseChart({ data }: Props) {
  const chartData: ChartData<'line'> = {
    labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Success Rate',
        data: data.map(d => d.successRate),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        yAxisID: 'y',
      },
      {
        label: 'Latency (ms)',
        data: data.map(d => d.latency),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        yAxisID: 'y1',
      }
    ]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
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
        max: 100
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
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false
      }
    },
    // Add accessibility configuration for Chart.js canvas
    onResize: (chart) => {
      // Set accessibility attributes on the canvas element
      const canvas = chart.canvas;
      if (canvas) {
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `Network performance chart showing success rate and latency over ${data.length} data points`);
      }
    }
  };

  return (
    <div className="w-full h-full">
      <Line 
        data={chartData} 
        options={options}
        // Add accessibility props directly to the Line component
        aria-label={`Network performance chart showing success rate and latency over ${data.length} data points`}
        role="img"
      />
    </div>
  );
}
