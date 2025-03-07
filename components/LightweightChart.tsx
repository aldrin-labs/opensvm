'use client';

import { useRef, useEffect, memo, useMemo } from 'react';

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

// Helper function to get min/max values from data - moved outside component for better performance
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

// Default options - moved outside component to avoid recreation on each render
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

// Memoized chart component
const LightweightChart = memo(function LightweightChart({ 
  series, 
  options = {}, 
  className = '' 
}: LightweightChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTimeoutRef = useRef<number | null>(null);
  const previousDimensionsRef = useRef({ width: 0, height: 0 });
  
  // Memoize merged options to prevent unnecessary recalculations
  const mergedOptions = useMemo(() => ({
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
  }), [options]);
  
  // Separate the rendering logic into a function for better organization
  const renderChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || series.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get container width if not specified
    const container = canvas.parentElement;
    const width = mergedOptions.width || (container ? container.clientWidth : 800);
    const height = mergedOptions.height || 300;
    
    // Skip rendering if dimensions haven't changed
    const currentDimensions = { width, height };
    if (
      previousDimensionsRef.current.width === width && 
      previousDimensionsRef.current.height === height &&
      series.length === 0
    ) {
      return;
    }
    previousDimensionsRef.current = currentDimensions;
    
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
      
      // Horizontal grid lines - draw in a single path for better performance
      ctx.beginPath();
      const yStep = chartArea.height / 5;
      for (let i = 0; i <= 5; i++) {
        const y = Math.floor(chartArea.y + i * yStep) + 0.5; // Align to pixel for sharp lines
        ctx.moveTo(chartArea.x, y);
        ctx.lineTo(chartArea.x + chartArea.width, y);
      }
      ctx.stroke();
      
      // Vertical grid lines - draw in a single path for better performance
      ctx.beginPath();
      const xStep = chartArea.width / 5;
      for (let i = 0; i <= 5; i++) {
        const x = Math.floor(chartArea.x + i * xStep) + 0.5; // Align to pixel for sharp lines
        ctx.moveTo(x, chartArea.y);
        ctx.lineTo(x, chartArea.y + chartArea.height);
      }
      ctx.stroke();
    }
    
    // Draw axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.font = '12px Arial';
    
    // Y-axis (left)
    ctx.beginPath();
    ctx.moveTo(Math.floor(chartArea.x) + 0.5, chartArea.y);
    ctx.lineTo(Math.floor(chartArea.x) + 0.5, chartArea.y + chartArea.height);
    ctx.stroke();
    
    // Y-axis ticks and labels (left)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const leftYStep = chartArea.height / 5;
    for (let i = 0; i <= 5; i++) {
      const y = chartArea.y + i * leftYStep;
      const value = leftMax - (i / 5) * (leftMax - leftMin);
      
      ctx.beginPath();
      ctx.moveTo(chartArea.x - 5, y);
      ctx.lineTo(chartArea.x, y);
      ctx.stroke();
      
      // Only render text if there's enough space
      if (i % 2 === 0 || chartArea.height > 200) {
        ctx.fillText(value.toFixed(1), chartArea.x - 10, y);
      }
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
    ctx.moveTo(Math.floor(chartArea.x + chartArea.width) + 0.5, chartArea.y);
    ctx.lineTo(Math.floor(chartArea.x + chartArea.width) + 0.5, chartArea.y + chartArea.height);
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
      
      // Only render text if there's enough space
      if (i % 2 === 0 || chartArea.height > 200) {
        ctx.fillText(value.toFixed(1), chartArea.x + chartArea.width + 10, y);
      }
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
    ctx.moveTo(chartArea.x, Math.floor(chartArea.y + chartArea.height) + 0.5);
    ctx.lineTo(chartArea.x + chartArea.width, Math.floor(chartArea.y + chartArea.height) + 0.5);
    ctx.stroke();
    
    // Draw series - optimize by reducing unnecessary operations
    series.forEach(s => {
      const isLeftAxis = (s.yAxisId || 'left') === 'left';
      const min = isLeftAxis ? leftMin : rightMin;
      const max = isLeftAxis ? leftMax : rightMax;
      
      if (s.data.length === 0) return;
      
      // Draw line
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      // Optimize by pre-calculating points and only drawing visible ones
      const dataLength = s.data.length;
      const skipPoints = dataLength > 100 ? Math.floor(dataLength / 100) : 1;
      
      for (let i = 0; i < dataLength; i += skipPoints) {
        const point = s.data[i];
        const x = chartArea.x + (i / (dataLength - 1)) * chartArea.width;
        const normalizedValue = (point.value - min) / (max - min || 1); // Avoid division by zero
        const y = chartArea.y + chartArea.height - normalizedValue * chartArea.height;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      // Make sure to include the last point if we're skipping
      if (skipPoints > 1 && dataLength > 0) {
        const lastPoint = s.data[dataLength - 1];
        const x = chartArea.x + chartArea.width;
        const normalizedValue = (lastPoint.value - min) / (max - min || 1);
        const y = chartArea.y + chartArea.height - normalizedValue * chartArea.height;
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();
      
      // Draw points - only if we have few enough data points
      if (s.data.length < 20) {
        ctx.fillStyle = s.color;
        s.data.forEach((point, i) => {
          const x = chartArea.x + (i / (s.data.length - 1)) * chartArea.width;
          const normalizedValue = (point.value - min) / (max - min || 1);
          const y = chartArea.y + chartArea.height - normalizedValue * chartArea.height;
          
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
    
    // Draw X-axis labels - optimize by reducing label density
    if (mergedOptions.xAxis?.showLabels && series.length > 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#666';
      
      // Get first series for labels
      const firstSeries = series[0];
      const maxLabels = Math.min(mergedOptions.xAxis.maxLabels || 10, 10); // Cap at 10 labels max
      const step = Math.max(1, Math.ceil(firstSeries.data.length / maxLabels));
      
      for (let i = 0; i < firstSeries.data.length; i += step) {
        const x = chartArea.x + (i / (firstSeries.data.length - 1)) * chartArea.width;
        const label = firstSeries.data[i].label || i.toString();
        
        ctx.fillText(label, x, chartArea.y + chartArea.height + 10);
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
    
    // Draw legend - optimize by pre-calculating text widths
    const legendY = padding.top / 2;
    let legendX = chartArea.x;
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // Draw all legend items in a single pass
    series.forEach(s => {
      // Draw color box
      ctx.fillStyle = s.color;
      ctx.fillRect(legendX, legendY - 6, 12, 12);
      
      // Draw series name
      ctx.fillStyle = '#666';
      ctx.fillText(s.name, legendX + 16, legendY);
      
      // Move to next legend item - pre-calculate width
      const textWidth = ctx.measureText(s.name).width;
      legendX += textWidth + 40; // Fixed spacing
    });
  };
  
  // Use requestAnimationFrame for smoother rendering
  useEffect(() => {
    if (renderTimeoutRef.current) {
      cancelAnimationFrame(renderTimeoutRef.current);
    }
    
    renderTimeoutRef.current = requestAnimationFrame(renderChart);
    
    return () => {
      if (renderTimeoutRef.current) {
        cancelAnimationFrame(renderTimeoutRef.current);
      }
    };
  }, [series, mergedOptions]);
  
  // Add resize observer to handle container size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    const handleResize = () => {
      if (renderTimeoutRef.current) {
        cancelAnimationFrame(renderTimeoutRef.current);
      }
      renderTimeoutRef.current = requestAnimationFrame(renderChart);
    };
    
    // Use ResizeObserver if available
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
      
      return () => {
        resizeObserver.disconnect();
      };
    } else {
      // Fallback to window resize event
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className={className}
      style={{ width: '100%', height: mergedOptions.height }}
    />
  );
});

export default LightweightChart;