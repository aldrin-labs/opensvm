import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidMintAddress } from '@/lib/validators';
import TokenDetails from '@/components/TokenDetails';

interface PageProps {
  params: Promise<{ mint: string }>;
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
  const { mint } = resolvedParams;

  // Validate mint address format
  if (!mint || !isValidMintAddress(mint)) {
    notFound();
  }

  return <TokenDetails mint={mint} />;
}