import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trading Terminal | OpenSVM',
  description: 'Real-time trading terminal for Solana tokens with advanced charting and analytics',
};

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

// Dynamically import the responsive terminal wrapper to ensure client-side only rendering
const ResponsiveTradingTerminal = dynamic(
  () => import('./components/ResponsiveTradingTerminal'),
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
    <div className="ai-trading-terminal-page-wrapper h-screen w-screen overflow-hidden bg-background fixed inset-0">
      <Suspense fallback={
        <div className="flex items-center justify-center h-full w-full bg-background">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading Trading Terminal...</p>
          </div>
        </div>
      }>
        <ResponsiveTradingTerminal />
      </Suspense>
    </div>
  );
}
