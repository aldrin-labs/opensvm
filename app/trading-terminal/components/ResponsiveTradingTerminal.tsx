/**
 * ResponsiveTradingTerminal
 * 
 * Responsive wrapper that switches between desktop, tablet, and mobile layouts
 * based on screen size. Provides optimized UX for each device type.
 */

'use client';

import React from 'react';
import { useBreakpoint } from '@/components/hooks/useMediaQuery';
import TradingTerminalView from './TradingTerminalView';
import dynamic from 'next/dynamic';

// Dynamically import mobile/tablet views to reduce bundle size
const MobileTradingView = dynamic(() => import('./MobileTradingView'), { 
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Loading Mobile View...</p>
      </div>
    </div>
  )
});

const TabletTradingView = dynamic(() => import('./TabletTradingView'), { 
  ssr: false,
  loading: () => (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">Loading Tablet View...</p>
      </div>
    </div>
  )
});

export default function ResponsiveTradingTerminal() {
  const breakpoint = useBreakpoint();

  // Mobile layout (< 768px)
  if (breakpoint === 'mobile') {
    return <MobileTradingView />;
  }

  // Tablet layout (768px - 1023px)
  if (breakpoint === 'tablet') {
    return <TabletTradingView />;
  }

  // Desktop layout (>= 1024px)
  return <TradingTerminalView />;
}
