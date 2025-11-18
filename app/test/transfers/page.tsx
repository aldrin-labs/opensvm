import { Suspense } from 'react';
import TestTransfersClient from './TestTransfersClient';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

export default function TransfersTestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black p-4 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
      <TestTransfersClient />
    </Suspense>
  );
}