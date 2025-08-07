'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSettings } from '@/app/providers/SettingsProvider';
import TransactionTabLayout from '../TransactionTabLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';

interface Props {
  params: Promise<{ [key: string]: string }>
}

export default function TransactionMetricsPage({ params }: Props) {
  const settings = useSettings();
  const { signature } = params;

  return (
    <ErrorBoundary
          {...({ settings } as any)}
        >
      <Suspense fallback={<LoadingSpinner />}>
        <TransactionTabLayout signature={signature} activeTab="metrics" />
      </Suspense>
    </ErrorBoundary>
  );
}