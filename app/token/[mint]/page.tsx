export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import TokenDetails from '@/components/TokenDetails';
import { useSettings } from '@/app/providers/SettingsProvider';

interface PageProps {
  params: Promise<{
    mint: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `Token ${resolvedParams.mint} | OPENSVM`,
    description: `View details of Solana token ${resolvedParams.mint} on OPENSVM`,
  };
}

export default async function TokenPage({
  params,
}: PageProps) {
  const resolvedParams = await params;
  return <TokenDetails mint={resolvedParams.mint} />;
}
