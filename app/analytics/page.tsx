'use client';

export const dynamic = 'force-dynamic'

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Network Stats</h1>
        <p className="text-muted-foreground">
          Solana network performance metrics and analytics.
        </p>
      </div>
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">Network analytics coming soon...</p>
      </div>
    </div>
  );
}
