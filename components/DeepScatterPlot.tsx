'use client';

import { useEffect, useRef } from 'react';

interface DataPoint {
  [key: string]: number;
}

interface DeepScatterPlotProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  xField?: string;
  yField?: string;
  colorField?: string;
  onPointClick?: (record: DataPoint) => void;
}

export default function DeepScatterPlot({
  data,
  width = 800,
  height = 600,
  xField = 'x',
  yField = 'y',
  colorField,
  onPointClick
}: DeepScatterPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Get data ranges
    const xValues = data.map(d => d[xField]);
    const yValues = data.map(d => d[yField]);
    const colorValues = colorField ? data.map(d => d[colorField]) : null;

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    // Scale data to canvas
    const xScale = (x: number) => ((x - xMin) / (xMax - xMin)) * (width - 20) + 10;
    const yScale = (y: number) => ((y - yMin) / (yMax - yMin)) * (height - 20) + 10;

    // Draw points
    const pointRadius = 3;
    data.forEach((point, i) => {
      const x = point[xField];
      const y = point[yField];
      const scaledX = xScale(x);
      const scaledY = yScale(y);

      ctx.beginPath();
      ctx.arc(scaledX, scaledY, pointRadius, 0, Math.PI * 2);

      if (colorValues) {
        const colorValue = colorValues[i];
        const maxColorValue = Math.max(...colorValues);
        const hue = (colorValue / maxColorValue) * 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
      } else {
        ctx.fillStyle = '#00ffbd';
      }

      ctx.fill();
    });

    // Add click handler
    const handleClick = (event: MouseEvent) => {
      if (!onPointClick) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Find closest point
      let minDist = Infinity;
      let closestPoint: DataPoint | null = null;

      data.forEach(point => {
        const scaledX = xScale(point[xField]);
        const scaledY = yScale(point[yField]);
        const dist = Math.sqrt(Math.pow(x - scaledX, 2) + Math.pow(y - scaledY, 2));

        if (dist < minDist && dist < pointRadius * 2) {
          minDist = dist;
          closestPoint = point;
        }
      });

      if (closestPoint) {
        onPointClick(closestPoint);
      }
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [data, width, height, xField, yField, colorField, onPointClick]);

  return (
    <canvas 
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="rounded-lg"
    />
  );
}
