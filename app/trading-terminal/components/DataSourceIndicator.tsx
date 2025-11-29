'use client';

import React from 'react';

interface DataSourceIndicatorProps {
  isRealData: boolean;
  dataSource?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

/**
 * Reusable component for displaying data source status (Live vs Demo)
 * Uses theme-aware semantic colors
 */
export default function DataSourceIndicator({
  isRealData,
  dataSource,
  size = 'sm',
  showLabel = true
}: DataSourceIndicatorProps) {
  const dotSize = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5';

  return (
    <div
      className={`flex items-center gap-1 ${padding} rounded ${textSize} border ${
        isRealData
          ? 'bg-success/10 border-success/30 text-success'
          : 'bg-warning/10 border-warning/30 text-warning'
      }`}
      title={dataSource}
    >
      <span className={`${dotSize} rounded-full ${isRealData ? 'bg-success' : 'bg-warning'}`} />
      {showLabel && (
        <span className="font-medium">
          {isRealData ? 'Live' : 'Demo'}
        </span>
      )}
    </div>
  );
}
