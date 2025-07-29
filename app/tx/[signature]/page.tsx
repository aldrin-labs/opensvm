import { Suspense } from 'react';
import TransactionContentWrapper from './TransactionContentWrapper';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Props {
  params: Promise<{ signature: string }>;
}

export default async function TransactionPage({ params }: Props) {
  // Await the params in the server component
  const { signature } = await params;

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={<LoadingSpinner />}>
          <TransactionContentWrapper signature={signature} />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
