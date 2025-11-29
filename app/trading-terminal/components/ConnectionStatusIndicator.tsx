'use client';

import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface ConnectionStatusIndicatorProps {
  connected: boolean;
  reconnecting?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Reusable component for displaying WebSocket connection status
 * Uses theme-aware semantic colors
 */
export default function ConnectionStatusIndicator({
  connected,
  reconnecting = false,
  size = 'sm'
}: ConnectionStatusIndicatorProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const iconSize = size === 'sm' ? 12 : 14;

  const getLabel = () => {
    if (connected) return 'Live';
    if (reconnecting) return 'Reconnecting...';
    return 'Offline';
  };

  return (
    <div
      className={`flex items-center gap-1.5 ${padding} rounded ${textSize} border ${
        connected
          ? 'bg-success/10 border-success/30 text-success'
          : 'bg-destructive/10 border-destructive/30 text-destructive'
      }`}
      title={connected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
    >
      {connected ? <Wifi size={iconSize} /> : <WifiOff size={iconSize} />}
      <span className="font-medium">{getLabel()}</span>
    </div>
  );
}
