import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AnalyticsClient from './AnalyticsClient';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Solana Ecosystem Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics for DEXes, cross-chain flows, DeFi protocols, and validator performance.
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <AnalyticsClient />
    </Suspense>
  );
}
