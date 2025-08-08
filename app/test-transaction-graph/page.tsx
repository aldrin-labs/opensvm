'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/lib/settings';
import NextDynamic from 'next/dynamic';
import LoadingSpinner from '@/components/LoadingSpinner';

// Dynamically import TransactionGraph to avoid SSR window references
const TransactionGraph = NextDynamic(
  () => import('@/components/transaction-graph/TransactionGraph'),
  { loading: () => <LoadingSpinner />, ssr: false }
);

export default function TestTransactionGraphPage() {
  const settings = useSettings();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <LoadingSpinner />;
  }
  const testSignature = '5JbxvGuxz64CgFidRvBEV6TGEpwtbBSvaxVJiXGJrMnqHKGmKk5wXJMhM1VujQ7WGjE3VDJp1oucukwW6LEuLWFo';

  const handleTransactionSelect = (signature: string) => {
    console.log('Transaction selected:', signature);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Transaction Graph Test</h1>
      <div className="h-[600px] border rounded-lg">
        <TransactionGraph
          initialSignature={testSignature}
          onTransactionSelect={handleTransactionSelect}
          clientSideNavigation={true}
          height="100%"
          width="100%"
          maxDepth={3}
        />
      </div>
    </div>
  );
}
