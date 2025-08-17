'use client';

import { useEffect, useRef } from 'react';

interface BinaryVisualizerProps {
  data: number[];
  selectedInstruction?: number | null;
  onInstructionSelect?: (offset: number | null) => void;
}

export default function BinaryVisualizer({
  data,
  selectedInstruction,
  onInstructionSelect
}: BinaryVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;

    // Calculate grid dimensions
    const bytesPerRow = 32;
    const cellSize = Math.min(
      width / bytesPerRow,
      height / Math.ceil(data.length / bytesPerRow)
    );

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Draw bytes
    data.forEach((byte, index) => {
      const x = (index % bytesPerRow) * cellSize;
      const y = Math.floor(index / bytesPerRow) * cellSize;

      // Calculate color based on byte value
      const intensity = Math.floor((byte / 255) * 255);
      ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity})`;

      // Draw cell
      ctx.fillRect(x, y, cellSize - 1, cellSize - 1);

      // Highlight selected instruction
      if (index === selectedInstruction) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, cellSize - 1, cellSize - 1);
      }
    });

    // Add click handler
    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const col = Math.floor(x / cellSize);
      const row = Math.floor(y / cellSize);
      const offset = row * bytesPerRow + col;

      if (offset < data.length && onInstructionSelect) {
        onInstructionSelect(offset);
      }
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [data, selectedInstruction, onInstructionSelect]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%' }}
      className="rounded-lg"
      role="img"
      aria-label="Binary instruction heatmap"
    />
  );
}
