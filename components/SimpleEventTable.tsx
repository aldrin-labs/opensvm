/**
 * Simple Event Table Component
 * High-performance table for displaying blockchain events without external dependencies
 * Integrated with OpenSVM theme system for consistent styling
 * Optimized for performance with virtual scrolling and minimal re-renders
 */

'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { BlockchainEvent } from './LiveEventMonitor';

// Simple helper function to convert lamports to SOL
const lamportsToSol = (lamports: number): number => lamports / 1000000000;

interface SimpleEventTableProps {
  events: BlockchainEvent[];
  onEventClick: (event: BlockchainEvent) => void;
  onAddressClick: (address: string) => void;
  height?: number;
}

export const SimpleEventTable = React.memo(function SimpleEventTable({ 
  events, 
  onEventClick, 
  onAddressClick,
  height = 400 
}: SimpleEventTableProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Trigger fade-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setFadeIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Table configuration
  const rowHeight = 32;
  const headerHeight = 40;
  const visibleRows = Math.ceil((height - headerHeight) / rowHeight) + 2; // Buffer rows
  const startIndex = Math.floor(scrollTop / rowHeight);
  const endIndex = Math.min(startIndex + visibleRows, events.length);

  // Process events for display with aggressive limits
  const tableData = useMemo(() => {
    const maxEventsToShow = 5000; // Reasonable limit for performance
    const eventsToProcess = events.length > maxEventsToShow 
      ? events.slice(-maxEventsToShow)
      : events;
    
    return eventsToProcess.map((event, index) => {
      const isTransaction = event.type === 'transaction';
      const data = event.data || {};
      
      return {
        id: index,
        type: event.type,
        timestamp: new Date(event.timestamp).toLocaleTimeString('en-US', { 
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        signature: isTransaction && data.signature 
          ? data.signature.substring(0, 8) + '...'
          : '-',
        fullSignature: data.signature || '',
        fee: isTransaction && data.fee 
          ? lamportsToSol(data.fee).toFixed(4) + ' SOL'
          : '-',
        status: isTransaction 
          ? (data.err ? '❌' : '✅')
          : event.type === 'block' ? '📦' : '🔄',
        program: data.knownProgram || (data.transactionType === 'spl-transfer' ? 'SPL' : 'Custom'),
        slot: data.slot?.toString() || '-',
        logs: data.logs?.length || 0,
        addresses: data.accountKeys && data.accountKeys.length > 0 
          ? data.accountKeys[0].substring(0, 8) + '...' 
          : '-',
        rawAddresses: data.accountKeys || [],
        rawEvent: event
      };
    });
  }, [events]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Get visible items for virtual scrolling
  const visibleItems = useMemo(() => {
    return tableData.slice(startIndex, endIndex);
  }, [tableData, startIndex, endIndex]);

  // Handle row clicks
  const handleRowClick = useCallback((item: any, columnIndex: number) => {
    if (columnIndex === 8) { // Address column
      if (item.rawAddresses?.length > 0) {
        onAddressClick(item.rawAddresses[0]);
      }
    } else if (columnIndex === 2 && item.fullSignature) { // Signature column
      onEventClick(item.rawEvent);
    } else {
      onEventClick(item.rawEvent);
    }
  }, [onEventClick, onAddressClick]);

  const columns = [
    { key: 'type', title: 'Type', width: '8%' },
    { key: 'timestamp', title: 'Time', width: '12%' },
    { key: 'signature', title: 'Signature', width: '15%' },
    { key: 'status', title: 'Status', width: '8%' },
    { key: 'fee', title: 'Fee', width: '12%' },
    { key: 'program', title: 'Program', width: '12%' },
    { key: 'slot', title: 'Slot', width: '10%' },
    { key: 'logs', title: 'Logs', width: '8%' },
    { key: 'addresses', title: 'Address', width: '15%' }
  ];

  return (
    <div className={`w-full transition-opacity duration-500 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      <div 
        className="border rounded-lg overflow-hidden bg-card"
        style={{ height: `${height}px` }}
      >
        {/* Header */}
        <div 
          className="flex bg-muted text-muted-foreground text-xs font-bold border-b sticky top-0 z-10"
          style={{ height: `${headerHeight}px` }}
        >
          {columns.map((column) => (
            <div
              key={column.key}
              className="px-3 py-2 border-r last:border-r-0 flex items-center font-mono"
              style={{ width: column.width }}
            >
              {column.title}
            </div>
          ))}
        </div>

        {/* Virtual scrollable content */}
        <div 
          ref={containerRef}
          className="overflow-auto"
          style={{ height: `${height - headerHeight}px` }}
          onScroll={handleScroll}
        >
          {/* Virtual spacer for items before visible range */}
          <div style={{ height: `${startIndex * rowHeight}px` }} />
          
          {/* Visible items */}
          {visibleItems.map((item, index) => {
            const globalIndex = startIndex + index;
            return (
              <div
                key={`${item.id}-${globalIndex}`}
                className="flex hover:bg-accent/50 cursor-pointer border-b text-xs transition-colors"
                style={{ height: `${rowHeight}px` }}
              >
                {columns.map((column, colIndex) => (
                  <div
                    key={`${column.key}-${colIndex}`}
                    className={`px-3 py-2 border-r last:border-r-0 flex items-center font-mono truncate ${
                      (column.key === 'addresses' && item.rawAddresses?.length > 0) || 
                      (column.key === 'signature' && item.fullSignature)
                        ? 'text-primary hover:underline' 
                        : ''
                    }`}
                    style={{ width: column.width }}
                    onClick={() => handleRowClick(item, colIndex)}
                    title={column.key === 'signature' && item.fullSignature 
                      ? `Click to view transaction: ${item.fullSignature}`
                      : column.key === 'addresses' && item.rawAddresses?.length > 0
                      ? `Click to view address: ${item.rawAddresses[0]}`
                      : undefined
                    }
                  >
                    {item[column.key as keyof typeof item] || '-'}
                  </div>
                ))}
              </div>
            );
          })}
          
          {/* Virtual spacer for items after visible range */}
          <div style={{ height: `${(tableData.length - endIndex) * rowHeight}px` }} />
        </div>
      </div>

      {/* Status bar */}
      <div className="text-xs text-muted-foreground mt-2 px-2 font-mono flex justify-between">
        <span>
          Showing {Math.min(visibleItems.length, events.length)} of {events.length} events
        </span>
        <span>
          Click signature/address • Virtual scrolling • High performance
        </span>
      </div>
    </div>
  );
});