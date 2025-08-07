export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import TransactionTabLayout from '../TransactionTabLayout';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';

interface Props {
  params: Promise<{ [key: string]: string }>
}

// Valid tab routes
const VALID_TABS = [
  'overview',
  'instructions', 
  'accounts',
  'graph',
  'ai',
  'metrics',
  'related',
  'failure'
];

export default async function TransactionTabPage({ params }: Props) {
  const resolvedParams = await params;
  const { signature, tab } = resolvedParams;
  
  // Basic signature validation
  if (!signature || signature.length < 32) {
    notFound();
  }

  // Validate tab route - redirect invalid tabs to overview
  if (!VALID_TABS.includes(tab)) {
    redirect(`/tx/${signature}/overview`);
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <TransactionTabLayout signature={signature} activeTab={tab as any} />
      </Suspense>
    </ErrorBoundary>
  );
}

// Generate static params for valid tabs
export function generateStaticParams() {
  return VALID_TABS.map((tab) => ({
    tab,
  }));
}
