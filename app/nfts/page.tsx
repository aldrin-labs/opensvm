import { Suspense } from 'react';
import NFTsClient from './NFTsClient';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default function NFTsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">NFT Collections</h1>
          <p className="text-muted-foreground">
            Browse NFT collections on the Solana network.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg border p-4 animate-pulse">
              <div className="w-full h-48 bg-muted mb-4" />
              <div className="h-4 bg-muted w-3/4 mb-2" />
              <div className="h-4 bg-muted w-1/2" />
            </div>
          ))}
        </div>
      </div>
    }>
      <NFTsClient />
    </Suspense>
  );
}
