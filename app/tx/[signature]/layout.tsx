import { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';

interface Props {
  children: ReactNode;
  params: Promise<{ signature: string }>;
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

export default async function TransactionLayout({ children, params }: Props) {
  const { signature } = await params;
  
  // Basic signature validation
  if (!signature || signature.length < 32) {
    notFound();
  }

  return (
    <>
      {children}
    </>
  );
}

export { VALID_TABS };