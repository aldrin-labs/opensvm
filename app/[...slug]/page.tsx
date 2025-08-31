import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { isValidSolanaAddress, isValidTransactionSignature } from '@/lib/utils'

export const dynamic = 'force-dynamic';

export default async function CatchAllRoute({ params }: { params: { slug?: string[] } }) {
  // If no slug parts, return 404
  const resolvedParams = await params;
  const slugParts = resolvedParams?.slug ?? [];
  if (!slugParts.length) {
    notFound();
  }

  const input = slugParts.join('/');

  // Don't handle Next.js internal routes or static assets - return 404
  if (input.startsWith('_next/') || 
      input.startsWith('api/') || 
      input.startsWith('static/') ||
      input.startsWith('favicon') ||
      input.includes('.js') ||
      input.includes('.jsx') ||
      input.includes('.ts') ||
      input.includes('.tsx') ||
      input.includes('.css') ||
      input.includes('.scss') ||
      input.includes('.sass') ||
      input.includes('.less') ||
      input.includes('.woff') ||
      input.includes('.woff2') ||
      input.includes('.ttf') ||
      input.includes('.eot') ||
      input.includes('.otf') ||
      input.includes('.svg') ||
      input.includes('.png') ||
      input.includes('.jpg') ||
      input.includes('.jpeg') ||
      input.includes('.gif') ||
      input.includes('.webp') ||
      input.includes('.ico') ||
      input.includes('.json') ||
      input.includes('.xml') ||
      input.includes('.txt') ||
      input.includes('.md') ||
      input.includes('.map') ||
      input.includes('.gz') ||
      input.includes('.br') ||
      input.match(/\.[a-zA-Z0-9]+$/)) {
    notFound();
  }

  try {
    // Numeric => block number
    if (/^\d+$/.test(input)) {
      redirect(`/block/${input}`);
      return;
    }

    // Transaction signature
    if (isValidTransactionSignature(input)) {
      redirect(`/tx/${input}`);
      return;
    }

    // Account address
    if (isValidSolanaAddress(input)) {
      redirect(`/account/${input}`);
      return;
    }

    // Fallback: search
    redirect(`/search?q=${encodeURIComponent(input)}`);
  } catch (error) {
    console.error('Error in catch-all route:', error);
    redirect(`/search`);
  }

  // This should never be reached due to redirects above
  return null;
}
