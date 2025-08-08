'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState } from 'react';
import { useSettings } from '@/app/providers/SettingsProvider';
import TransactionTabLayout from '../TransactionTabLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import TransactionRedirectHandler from '../TransactionRedirectHandler';

interface Props {
  params: Promise<{ signature: string }>
}

export default function TransactionOverviewPage({ params }: Props) {
  const settings = useSettings();
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    async function resolveParams() {
      try {
        const resolvedParams = await params;
        setSignature(resolvedParams.signature);
      } catch (error) {
        console.error('Error resolving params:', error);
      }
    }
    resolveParams();
  }, [params]);

  if (!signature) {
    return <LoadingSpinner />;
  }

  return (
    <ErrorBoundary
          {...({ settings } as any)}
        >
      <Suspense fallback={<LoadingSpinner />}>
        {/* Check for user preferences and redirect if needed */}
        <TransactionRedirectHandler signature={signature} />
        <TransactionTabLayout signature={signature} activeTab="overview" />
      </Suspense>
    </ErrorBoundary>
  );
}
