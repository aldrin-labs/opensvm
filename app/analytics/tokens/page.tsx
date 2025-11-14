import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

function TokenAnalyticsContent() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Token Analytics</h1>
        <p className="text-muted-foreground">
          In-depth market analysis and metrics for tokens on Solana.
        </p>
      </div>
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Token analytics coming soon...</p>
      </div>
    </div>
  );
}

export default function TokenAnalyticsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8"><div className="rounded-md border p-8 text-center"><p className="text-muted-foreground">Loading...</p></div></div>}>
      <TokenAnalyticsContent />
    </Suspense>
  );
}
