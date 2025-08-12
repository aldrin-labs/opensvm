import { ReactNode } from 'react';
import { notFound } from 'next/navigation';

interface Props {
  children: ReactNode;
  params: Promise<{ signature: string }>;
}

export default async function TransactionLayout({ children, params }: Props) {
  const { signature } = await params;

  // Basic signature validation
  if (!signature || signature.length < 32) {
    notFound();
  }

  return <>{children}</>;
}