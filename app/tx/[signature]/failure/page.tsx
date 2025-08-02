import { Suspense } from 'react';
import TransactionTabLayout from '../TransactionTabLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Props {
  params: Promise<{ signature: string }>;
}

export default async function TransactionFailurePage({ params }: Props) {
  const { signature } = await params;

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <TransactionTabLayout signature={signature} activeTab="failure" />
      </Suspense>
    </ErrorBoundary>
  );
}