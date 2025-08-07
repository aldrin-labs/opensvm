'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSettings } from '@/app/providers/SettingsProvider';
import TransactionTabLayout from '../TransactionTabLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import TransactionRedirectHandler from '../TransactionRedirectHandler';

interface Props {
  params: Promise<{ [key: string]: string }>
}

export default function TransactionOverviewPage({ params }: Props) {
  const settings = useSettings();
  const { signature } = params;

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