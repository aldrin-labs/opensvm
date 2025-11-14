import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

function DeFiAnalyticsContent() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">DeFi Overview</h1>
        <p className="text-muted-foreground">
          Comprehensive statistics and analytics for DeFi protocols on Solana.
        </p>
      </div>
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">DeFi analytics coming soon...</p>
      </div>
    </div>
  );
}

export default function DeFiAnalyticsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8"><div className="rounded-md border p-8 text-center"><p className="text-muted-foreground">Loading...</p></div></div>}>
      <DeFiAnalyticsContent />
    </Suspense>
  );
}
