import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import TransactionContent from './TransactionContent';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { isValidTransactionSignature } from '@/lib/validators';

interface Props {
  params: Promise<{ signature: string }>;
}

// Generate static params for common/recent transactions (optional optimization)
export async function generateStaticParams() {
  // This could be populated with recent popular transactions
  // For now, return empty array to use fallback rendering
  return [];
}

export default async function TransactionPage({ params }: Props) {
  // Await the params in the server component
  const { signature } = await params;

  // Validate transaction signature format before rendering
  if (!signature || !isValidTransactionSignature(signature)) {
    notFound();
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={<LoadingSpinner />}>
          <TransactionContent signature={signature} />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
