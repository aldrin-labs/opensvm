import { Suspense } from 'react';
import TransactionTabLayout from '../TransactionTabLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import TransactionRedirectHandler from '../TransactionRedirectHandler';

interface Props {
  params: Promise<{ signature: string }>;
}

export default async function TransactionOverviewPage({ params }: Props) {
  const { signature } = await params;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        {/* Check for user preferences and redirect if needed */}
        <TransactionRedirectHandler signature={signature} />
        <TransactionTabLayout signature={signature} activeTab="overview" />
      </Suspense>
    </ErrorBoundary>
  );
}