'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the terminal view to ensure client-side only rendering
const TradingTerminalView = dynamic(
  () => import('./components/TradingTerminalView'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading Trading Terminal...</p>
        </div>
      </div>
    )
  }
);

export default function TradingTerminalPage() {
  return (
    <div className="ai-trading-terminal-page-wrapper min-h-screen bg-background">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading Trading Terminal...</p>
          </div>
        </div>
      }>
        <TradingTerminalView />
      </Suspense>
    </div>
  );
}
