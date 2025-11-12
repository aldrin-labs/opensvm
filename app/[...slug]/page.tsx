import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { isValidTransactionSignature } from '@/lib/utils'

export const dynamic = 'force-dynamic';

// Lenient validation - just check format, not blockchain validity
function looksLikeSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  
  // Solana addresses are 32-44 characters
  if (address.length < 32 || address.length > 44) return false;
  
  // Check if it contains only valid base58 characters
  // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(address);
}

export default async function CatchAllRoute({ params }: { params: { slug?: string[] } }) {
  // If no slug parts, return 404
  const resolvedParams = await params;
  const slugParts = resolvedParams?.slug ?? [];
  if (!slugParts.length) {
    notFound();
  }

  const input = slugParts.join('/');

  // Don't handle Next.js internal routes, dedicated app routes, or static assets - return 404
  // Check for Next.js internal routes and dedicated app routes first
  if (slugParts[0]?.startsWith('_next') || 
      slugParts[0] === '_next' ||
      input.startsWith('_next/') || 
      input.startsWith('api/') || 
      input.startsWith('static/') ||
      input.startsWith('favicon') ||
      // Exclude dedicated app routes that have their own page.tsx files
      slugParts[0] === 'chat' ||
      slugParts[0] === 'search' ||
      slugParts[0] === 'account' ||
      slugParts[0] === 'tx' ||
      slugParts[0] === 'block' ||
      slugParts[0] === 'token' ||
      slugParts[0] === 'program' ||
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

  // Numeric => block number
  if (/^\d+$/.test(input)) {
    redirect(`/block/${input}`);
  }

  // Transaction signature (88 chars, base58)
  if (isValidTransactionSignature(input)) {
    redirect(`/tx/${input}`);
  }

  // Account address - check format (lenient), redirect to account page for type detection
  if (looksLikeSolanaAddress(input)) {
    redirect(`/account/${input}`);
  }

  // Fallback: search
  redirect(`/search?q=${encodeURIComponent(input)}`);
}
