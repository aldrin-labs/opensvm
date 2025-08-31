'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface CyberpunkPerlinProps {
  className?: string;
  quality?: 'low' | 'medium' | 'high';
}

export const CyberpunkPerlin = ({
  className = '',
  quality = 'high'
}: CyberpunkPerlinProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [scale, setScale] = useState(50);
  const [density, setDensity] = useState(1);

  // Performance-based quality settings
  const qualitySettings = useMemo(() => ({
    low: { charSize: 16, frameSkip: 2 },
    medium: { charSize: 12, frameSkip: 1 },
    high: { charSize: 8, frameSkip: 0 }
  }), []);

  // Memoize characters array
  const characters = useMemo(() =>
    ['@', '%', '#', '*', '+', '=', '-', ':', '.', ' '] as const,
    []);

  // Optimized noise function
  const noise = useCallback((nx: number, ny: number, nz: number) => {
    const freq = 1.5;
    return (
      Math.sin(nx * freq + nz) *
      Math.cos(ny * freq + nz * 2) *
      Math.sin((nx + ny) * freq * 0.5 + nz) * 0.5 + 0.5
    );
  }, []);

  // Optimized resize handler
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Get device pixel ratio for better rendering on high DPI displays
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const rect = canvas.getBoundingClientRect();

    // Set actual size in memory
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Scale canvas back to desired size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    // Scale context to account for pixel ratio
    ctx.scale(dpr, dpr);
    ctx.font = '12px Berkeley Mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    contextRef.current = ctx;
  }, []);

  // Optimized draw function
  const draw = useCallback((timestamp: number) => {
    if (!isPlaying || !contextRef.current || !canvasRef.current) return;

    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    const currentQuality = qualitySettings[quality];

    lastTimeRef.current = timestamp;

    // Skip frames based on quality setting
    if (Math.floor(timeRef.current) % (currentQuality.frameSkip + 1) !== 0) {
      timeRef.current++;
      animationFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    // Clear canvas with solid color (faster than clearRect)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const charSize = currentQuality.charSize * density;
    const cols = Math.floor(canvas.width / charSize);
    const rows = Math.floor(canvas.height / charSize);

    // Batch similar operations
    ctx.beginPath();

    // Pre-calculate common values
    const time = timeRef.current * 0.002 * speed;
    const scaleInv = 1 / scale;

    // Draw characters in batches
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * charSize;
        const y = j * charSize;
        const nx = i * scaleInv;
        const ny = j * scaleInv;
        const value = noise(nx, ny, time);
        // Ensure characterIndex is within bounds and get character
        const index = Math.min(Math.floor(value * characters.length), characters.length - 1);
        const char = characters[index] as string;

        // Optimize color calculation
        const brightness = 255 - (value * 200) | 0;
        ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
        ctx.fillText(char, x + charSize / 2, y + charSize / 2);

        // Draw connection lines only when necessary
        if (value > 0.7 && i < cols - 1 && j < rows - 1) {
          ctx.strokeStyle = `rgba(100,100,100,${0.2 - value * 0.1})`;
          ctx.moveTo(x + charSize / 2, y + charSize / 2);
          ctx.lineTo(x + charSize * 1.5, y + charSize * 1.5);
        }
      }
    }

    ctx.stroke();
    timeRef.current++;
    animationFrameRef.current = requestAnimationFrame(draw);
  }, [isPlaying, speed, scale, density, quality, noise, characters, qualitySettings]);

  // Setup and cleanup
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    // Start animation loop
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleResize, draw]);

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        role="img"
        aria-label="Cyberpunk perlin noise animation visualization"
      />
      <div className="absolute bottom-32 left-4 flex gap-4 bg-white/90 p-6 rounded-lg backdrop-blur-sm border border-gray-200 shadow-sm">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="h-fit px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors border border-gray-300 font-medium"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="flex flex-col gap-4 min-w-[200px]">
          <label className="text-gray-700 text-sm font-medium">
            Speed: {speed}x
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-gray-500"
            />
          </label>
          <label className="text-gray-700 text-sm font-medium">
            Scale: {scale}
            <input
              type="range"
              min="20"
              max="100"
              step="1"
              value={scale}
              onChange={(e) => setScale(parseInt(e.target.value))}
              className="w-full accent-gray-500"
            />
          </label>
          <label className="text-gray-700 text-sm font-medium">
            Density: {density.toFixed(1)}
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={density}
              onChange={(e) => setDensity(parseFloat(e.target.value))}
              className="w-full accent-gray-500"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
