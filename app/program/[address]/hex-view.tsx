'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface HexViewProps {
  data: number[];
  selectedByte?: number | null;
  onByteSelect?: (offset: number | null) => void;
  selectionRange?: [number, number] | null;
}

const ROW_HEIGHT = 24;
const BUFFER_SIZE = 20;

export default function HexView({
  data,
  selectedByte,
  onByteSelect,
  selectionRange,
}: HexViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  // Format helpers
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toLowerCase();
  const toOffset = (n: number) => n.toString(16).padStart(8, '0').toLowerCase();
  const toAscii = (byte: number) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';

  // Handle scroll to update visible range
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE);
    const endRow = Math.min(
      Math.ceil(data.length / 16),
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_SIZE
    );

    setVisibleRange({ start: startRow, end: endRow });
  }, [data.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    handleScroll();
    container.addEventListener('scroll', handleScroll);
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleScroll);
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleScroll);
      }
    };
  }, [handleScroll]);

  useEffect(() => {
    if (selectedByte === null || selectedByte === undefined || !containerRef.current) return;

    const row = Math.floor(selectedByte / 16);
    const container = containerRef.current;
    const rowTop = row * ROW_HEIGHT;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;

    if (rowTop < scrollTop || rowTop + ROW_HEIGHT > scrollTop + viewportHeight) {
      container.scrollTo({
        top: rowTop - viewportHeight / 2,
        behavior: 'smooth'
      });
    }
  }, [selectedByte]);

  const visibleRows = [];
  for (let i = visibleRange.start; i < visibleRange.end; i++) {
    const baseOffset = i * 16;
    const bytes = data.slice(baseOffset, baseOffset + 16);
    if (bytes.length === 0) break;

    const hex = bytes.map((byte, idx) => {
      const offset = baseOffset + idx;
      const isSelected = offset === selectedByte;
      const isInRange = selectionRange &&
        offset >= selectionRange[0] &&
        offset <= selectionRange[1];

      return (
        <span
          key={offset}
          onClick={() => onByteSelect?.(offset)}
          className={`
            inline-block w-[2ch] text-center cursor-pointer select-none
            hover:text-blue-400 hover:bg-blue-500/10
            ${isSelected ? 'bg-blue-500 text-white' : ''}
            ${isInRange ? 'bg-blue-500/20' : ''}
            ${idx % 2 === 0 ? 'mr-[1ch]' : 'mr-[2ch]'}
          `}
        >
          {toHex(byte)}
        </span>
      );
    });

    const ascii = bytes.map((byte, idx) => {
      const offset = baseOffset + idx;
      const isSelected = offset === selectedByte;
      const isInRange = selectionRange &&
        offset >= selectionRange[0] &&
        offset <= selectionRange[1];

      return (
        <span
          key={offset}
          onClick={() => onByteSelect?.(offset)}
          className={`
            inline-block w-[1ch] cursor-pointer select-none
            hover:text-blue-400 hover:bg-blue-500/10
            ${isSelected ? 'bg-blue-500 text-white' : ''}
            ${isInRange ? 'bg-blue-500/20' : ''}
          `}
        >
          {toAscii(byte)}
        </span>
      );
    });

    visibleRows.push(
      <div
        key={i}
        className="flex items-center hover:bg-white/5"
        style={{
          position: 'absolute',
          top: i * ROW_HEIGHT,
          left: 0,
          right: 0,
          height: ROW_HEIGHT,
          padding: '0 1rem'
        }}
      >
        <div className="w-[10ch] font-mono text-gray-500">
          {toOffset(baseOffset)}
        </div>
        <div className="w-[52ch] font-mono">
          {hex}
        </div>
        <div className="w-[2ch] text-center font-mono text-gray-500">│</div>
        <div className="font-mono">
          {ascii}
        </div>
      </div>
    );
  }

  const totalHeight = Math.ceil(data.length / 16) * ROW_HEIGHT;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center text-sm text-gray-500 font-mono sticky top-0 bg-black z-10 pl-4">
        <div className="w-[10ch]">Offset</div>
        <div className="w-[52ch] flex">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className={`w-[2ch] text-center ${i % 2 === 0 ? 'mr-[1ch]' : 'mr-[2ch]'}`}
            >
              {toHex(i)}
            </div>
          ))}
        </div>
        <div className="w-[2ch] text-center">│</div>
        <div>ASCII</div>
      </div>

      {/* Virtualized content */}
      <div
        ref={containerRef}
        className="relative overflow-auto"
        style={{ height: 'calc(100vh - 32rem)' }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleRows}
        </div>
      </div>
    </div>
  );
}
