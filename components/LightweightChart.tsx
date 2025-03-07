'use client';

import { useRef, useEffect, memo } from 'react';

interface DataPoint {
  value: number;
  label?: string;
}

interface ChartSeries {
  data: DataPoint[];
  color: string;
  name: string;
  yAxisId?: 'left' | 'right';
}

interface ChartOptions {
  height?: number;
  width?: number;
  yAxis?: {
    left?: {
      min?: number;
      max?: number;
      title?: string;
    };
    right?: {
      min?: number;
      max?: number;
      title?: string;
    };
  };
  xAxis?: {
    title?: string;
    showLabels?: boolean;
    maxLabels?: number;
  };
  grid?: {
    show?: boolean;
    color?: string;
  };
  animation?: boolean;
}

interface LightweightChartProps {
  series: ChartSeries[];
  options?: ChartOptions;
  className?: string;
}

// Helper function to get min/max values from data
const getMinMax = (series: ChartSeries[], axisId: 'left' | 'right') => {
  const filteredSeries = series.filter(s => (s.yAxisId || 'left') === axisId);
  if (filteredSeries.length === 0) return { min: 0, max: 0 };
  
  let min = Number.MAX_VALUE;
  let max = Number.MIN_VALUE;
  
  filteredSeries.forEach(s => {
    s.data.forEach(d => {
      min = Math.min(min, d.value);
      max = Math.max(max, d.value);
    });
  });
  
  // Add some padding
  const padding = (max - min) * 0.1;
  return { 
    min: Math.max(0, min - padding), 
    max: max + padding 
  };
};

const LightweightChart = memo(function LightweightChart({ 
  series, 
  options = {}, 
  className = '' 
}: LightweightChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Default options
  const defaultOptions: ChartOptions = {
    height: 300,
    width: undefined, // Will use container width
    yAxis: {
      left: {
        min: undefined,
        max: undefined,
        title: ''
      },
      right: {
        min: undefined,
        max: undefined,
        title: ''
      }
    },
    xAxis: {
      title: '',
      showLabels: true,
      maxLabels: 10
    },
    grid: {
      show: true,
      color: 'rgba(200, 200, 200, 0.2)'
    },
    animation: false
  };
  
  // Merge options
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    yAxis: {
      ...defaultOptions.yAxis,
      ...options.yAxis,
      left: {
        ...defaultOptions.yAxis?.left,
        ...options.yAxis?.left
      },
      right: {
        ...defaultOptions.yAxis?.right,
        ...options.yAxis?.right
      }
    },
    xAxis: {
      ...defaultOptions.xAxis,
      ...options.xAxis
    },
    grid: {
      ...defaultOptions.grid,
      ...options.grid
    }
  };
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || series.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get container width if not specified
    const container = canvas.parentElement;
    const width = mergedOptions.width || (container ? container.clientWidth : 800);
    const height = mergedOptions.height || 300;
    
    // Set canvas size with device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate chart area
    const padding = { top: 20, right: 60, bottom: 40, left: 60 };
    const chartArea = {
      x: padding.left,
      y: padding.top,
      width: width - padding.left - padding.right,
      height: height - padding.top - padding.bottom
    };
    
    // Get min/max values for both axes
    const leftMinMax = getMinMax(series, 'left');
    const rightMinMax = getMinMax(series, 'right');
    
    // Use provided min/max if available
    const leftMin = mergedOptions.yAxis?.left?.min !== undefined ? mergedOptions.yAxis.left.min : leftMinMax.min;
    const leftMax = mergedOptions.yAxis?.left?.max !== undefined ? mergedOptions.yAxis.left.max : leftMinMax.max;
    const rightMin = mergedOptions.yAxis?.right?.min !== undefined ? mergedOptions.yAxis.right.min : rightMinMax.min;
    const rightMax = mergedOptions.yAxis?.right?.max !== undefined ? mergedOptions.yAxis.right.max : rightMinMax.max;
    
    // Draw grid
    if (mergedOptions.grid?.show) {
      ctx.strokeStyle = mergedOptions.grid.color || 'rgba(200, 200, 200, 0.2)';
      ctx.lineWidth = 1;
      
      // Horizontal grid lines
      const yStep = chartArea.height / 5;
      for (let i = 0; i <= 5; i++) {
        const y = chartArea.y + i * yStep;
        ctx.beginPath();
        ctx.moveTo(chartArea.x, y);
        ctx.lineTo(chartArea.x + chartArea.width, y);
        ctx.stroke();
      }
      
      // Vertical grid lines
      const xStep = chartArea.width / 5;
      for (let i = 0; i <= 5; i++) {
        const x = chartArea.x + i * xStep;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.y);
        ctx.lineTo(x, chartArea.y + chartArea.height);
        ctx.stroke();
      }
    }
    
    // Draw axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // Y-axis (left)
    ctx.beginPath();
    ctx.moveTo(chartArea.x, chartArea.y);
    ctx.lineTo(chartArea.x, chartArea.y + chartArea.height);
    ctx.stroke();
    
    // Y-axis ticks and labels (left)
    ctx.textAlign = 'right';
    const leftYStep = chartArea.height / 5;
    for (let i = 0; i <= 5; i++) {
      const y = chartArea.y + i * leftYStep;
      const value = leftMax - (i / 5) * (leftMax - leftMin);
      
      ctx.beginPath();
      ctx.moveTo(chartArea.x - 5, y);
      ctx.lineTo(chartArea.x, y);
      ctx.stroke();
      
      ctx.fillText(value.toFixed(1), chartArea.x - 10, y + 4);
    }
    
    // Y-axis title (left)
    if (mergedOptions.yAxis?.left?.title) {
      ctx.save();
      ctx.translate(padding.left / 3, chartArea.y + chartArea.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(mergedOptions.yAxis.left.title, 0, 0);
      ctx.restore();
    }
    
    // Y-axis (right)
    ctx.beginPath();
    ctx.moveTo(chartArea.x + chartArea.width, chartArea.y);
    ctx.lineTo(chartArea.x + chartArea.width, chartArea.y + chartArea.height);
    ctx.stroke();
    
    // Y-axis ticks and labels (right)
    ctx.textAlign = 'left';
    const rightYStep = chartArea.height / 5;
    for (let i = 0; i <= 5; i++) {
      const y = chartArea.y + i * rightYStep;
      const value = rightMax - (i / 5) * (rightMax - rightMin);
      
      ctx.beginPath();
      ctx.moveTo(chartArea.x + chartArea.width, y);
      ctx.lineTo(chartArea.x + chartArea.width + 5, y);
      ctx.stroke();
      
      ctx.fillText(value.toFixed(1), chartArea.x + chartArea.width + 10, y + 4);
    }
    
    // Y-axis title (right)
    if (mergedOptions.yAxis?.right?.title) {
      ctx.save();
      ctx.translate(width - padding.right / 3, chartArea.y + chartArea.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(mergedOptions.yAxis.right.title, 0, 0);
      ctx.restore();
    }
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(chartArea.x, chartArea.y + chartArea.height);
    ctx.lineTo(chartArea.x + chartArea.width, chartArea.y + chartArea.height);
    ctx.stroke();
    
    // Draw series
    series.forEach(s => {
      const isLeftAxis = (s.yAxisId || 'left') === 'left';
      const min = isLeftAxis ? leftMin : rightMin;
      const max = isLeftAxis ? leftMax : rightMax;
      
      if (s.data.length === 0) return;
      
      // Draw line
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      s.data.forEach((point, i) => {
        const x = chartArea.x + (i / (s.data.length - 1)) * chartArea.width;
        const normalizedValue = (point.value - min) / (max - min);
        const y = chartArea.y + chartArea.height - normalizedValue * chartArea.height;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Draw points
      if (s.data.length < 20) {
        ctx.fillStyle = s.color;
        s.data.forEach((point, i) => {
          const x = chartArea.x + (i / (s.data.length - 1)) * chartArea.width;
          const normalizedValue = (point.value - min) / (max - min);
          const y = chartArea.y + chartArea.height - normalizedValue * chartArea.height;
          
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
    
    // Draw X-axis labels
    if (mergedOptions.xAxis?.showLabels && series.length > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#666';
      
      // Get first series for labels
      const firstSeries = series[0];
      const maxLabels = mergedOptions.xAxis.maxLabels || 10;
      const step = Math.max(1, Math.ceil(firstSeries.data.length / maxLabels));
      
      for (let i = 0; i < firstSeries.data.length; i += step) {
        const x = chartArea.x + (i / (firstSeries.data.length - 1)) * chartArea.width;
        const label = firstSeries.data[i].label || i.toString();
        
        ctx.fillText(label, x, chartArea.y + chartArea.height + 20);
      }
    }
    
    // Draw X-axis title
    if (mergedOptions.xAxis?.title) {
      ctx.textAlign = 'center';
      ctx.fillText(
        mergedOptions.xAxis.title,
        chartArea.x + chartArea.width / 2,
        height - 10
      );
    }
    
    // Draw legend
    const legendY = padding.top / 2;
    let legendX = chartArea.x;
    
    ctx.textAlign = 'left';
    series.forEach(s => {
      // Draw color box
      ctx.fillStyle = s.color;
      ctx.fillRect(legendX, legendY - 6, 12, 12);
      
      // Draw series name
      ctx.fillStyle = '#666';
      ctx.fillText(s.name, legendX + 16, legendY);
      
      // Move to next legend item
      legendX += ctx.measureText(s.name).width + 40;
    });
    
  }, [series, mergedOptions]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={className}
      style={{ width: '100%', height: mergedOptions.height }}
    />
  );
});

export default LightweightChart;