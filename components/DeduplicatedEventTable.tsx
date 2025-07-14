/**
 * Deduplicated Even}: DeduplicatedEventTableProps) => {Table Component
 * 
 * Shows events with deduplication and count indicators
 */

'use client';

import React, { useCallback, useState } from 'react';
import { Copy, ExternalLink, Clock, Layers } from 'lucide-react';
import { DeduplicatedEvent } from '@/lib/utils/deduplication';

interface DeduplicatedEventTableProps {
  events: DeduplicatedEvent[];
  onEventClick?: (event: DeduplicatedEvent) => void;
  onAddressClick?: (address: string) => void;
  height?: number;
}

export const DeduplicatedEventTable = React.memo(function DeduplicatedEventTable({
  events,
  onEventClick,
  onAddressClick,
  height = 400
}: DeduplicatedEventTableProps) {
  const [_selectedEvent, _setSelectedEvent] = useState<DeduplicatedEvent | null>(null);

  const getEventTypeColor = useCallback((type: string) => {
    switch (type) {
      case 'transaction': return 'bg-blue-500 text-white';
      case 'block': return 'bg-green-500 text-white';
      case 'account_change': return 'bg-purple-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  }, []);

  const getEventTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'transaction': return '💳';
      case 'block': return '🧊';
      case 'account_change': return '👤';
      default: return '📄';
    }
  }, []);

  const formatAddress = useCallback((address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, []);

  const formatTimeAgo = useCallback((timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }, []);

  const handleEventClick = useCallback((event: DeduplicatedEvent) => {
    _setSelectedEvent(event);
    onEventClick?.(event);
    
    // Open in explorer based on type
    const baseUrl = 'https://opensvm.com';
    let url = '';
    
    if (event.type === 'transaction' && event.signature) {
      url = `${baseUrl}/tx/${event.signature}`;
    } else if (event.type === 'block' && event.data?.slot) {
      url = `${baseUrl}/block/${event.data.slot}`;
    } else if (event.type === 'account_change' && event.data?.account) {
      url = `${baseUrl}/account/${event.data.account}`;
    }
    
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [onEventClick]);

  const handleAddressClick = useCallback((address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onAddressClick?.(address);
    window.open(`https://opensvm.com/account/${address}`, '_blank', 'noopener,noreferrer');
  }, [onAddressClick]);

  const copyToClipboard = useCallback((text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
  }, []);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        <div className="text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No events available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-y-auto" style={{ height }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Details</th>
              <th className="text-left p-3 font-medium">Count</th>
              <th className="text-left p-3 font-medium">Time</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => handleEventClick(event)}
              >
                <td className="p-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getEventTypeIcon(event.type)}</span>
                    <div>
                      <div className={`px-2 py-1 text-xs rounded ${getEventTypeColor(event.type)}`}>
                        {event.type.toUpperCase()}
                      </div>
                      {event.count > 1 && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Layers className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {event.count}x
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                
                <td className="p-3">
                  <div className="space-y-1">
                    {event.type === 'transaction' && event.signature && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">Signature:</span>
                        <span className="font-mono text-xs">
                          {formatAddress(event.signature)}
                        </span>
                        <button
                          onClick={(e) => copyToClipboard(event.signature!, e)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    
                    {event.type === 'block' && event.data?.slot && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">Slot:</span>
                        <span className="font-mono text-xs">
                          {event.data.slot.toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    {event.type === 'account_change' && event.data?.account && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">Account:</span>
                        <button
                          onClick={(e) => handleAddressClick(event.data.account, e)}
                          className="font-mono text-xs hover:text-primary"
                        >
                          {formatAddress(event.data.account)}
                        </button>
                      </div>
                    )}
                    
                    {event.data?.fee && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">Fee:</span>
                        <span className="text-xs">
                          {(event.data.fee / 1e9).toFixed(6)} SOL
                        </span>
                      </div>
                    )}
                    
                    {event.data?.err && (
                      <div className="text-xs text-red-500">
                        Failed: {JSON.stringify(event.data.err)}
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-3">
                  <div className="text-center">
                    <div className="font-medium text-sm">{event.count}</div>
                    {event.count > 1 && (
                      <div className="text-xs text-muted-foreground">
                        duplicates
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-3">
                  <div className="text-xs">
                    <div className="font-medium">{formatTimeAgo(event.timestamp)}</div>
                    {event.count > 1 && (
                      <div className="text-muted-foreground">
                        First: {formatTimeAgo(event.firstSeen)}
                      </div>
                    )}
                  </div>
                </td>
                
                <td className="p-3">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEventClick(event);
                      }}
                      className="p-1 hover:bg-muted rounded"
                      title="Open in explorer"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    
                    {event.signature && (
                      <button
                        onClick={(e) => copyToClipboard(event.signature!, e)}
                        className="p-1 hover:bg-muted rounded"
                        title="Copy signature"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});