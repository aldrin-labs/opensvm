import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import TokenGainersClient from './TokenGainersClient';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default function TokenGainersPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <TokenGainersClient />
    </Suspense>
  );
}
