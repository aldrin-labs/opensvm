'use client'

export const dynamic = 'force-dynamic';

import { useEffect } from 'react'
import { useSettings } from '@/lib/settings';
import { useRouter } from 'next/navigation'
import { isValidSolanaAddress, isValidTransactionSignature } from '@/lib/utils'

export default function CatchAllRoute({ params }: { params: { slug?: string[] } }) {
  // Access settings to ensure any side-effects (e.g., network / feature flags) still initialize
  const settings = useSettings();
  const router = useRouter();

  useEffect(() => {
    // If no slug parts, do nothing (could be the root which should normally route elsewhere)
    const slugParts = params?.slug ?? [];
    if (!slugParts.length) return;

    const input = slugParts.join('/');

    try {
      // Numeric => block number
      if (/^\d+$/.test(input)) {
        router.push(`/block/${input}`);
        return;
      }

      // Transaction signature
      if (isValidTransactionSignature(input)) {
        router.push(`/tx/${input}`);
        return;
      }

      // Account address
      if (isValidSolanaAddress(input)) {
        router.push(`/account/${input}`);
        return;
      }

      // Fallback: search
      router.push(`/search?q=${encodeURIComponent(input)}`);
    } catch (error) {
      console.error('Error in catch-all route:', error);
      router.push(`/search`);
    }
  }, [params?.slug, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">
        <p className="text-lg">Analyzing input...</p>
      </div>
    </div>
  );
}
