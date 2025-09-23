'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/settings';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Props {
  params: Promise<{ signature: string }>
}

export default function TransactionPage({ params }: Props) {
  const settings = useSettings();
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    async function resolveParams() {
      try {
        const resolvedParams = await params;
        setSignature(resolvedParams.signature);
      } catch (error) {
        console.error('Error resolving params:', error);
      }
    }
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (signature) {
      // Always redirect to overview tab - client-side preference handling happens there
      router.push(`/tx/${signature}/overview`);
    }
  }, [signature, router]);

  if (!signature) {
    return <LoadingSpinner />;
  }

  return null; // This component just redirects, so it doesn't render anything
// Added ai-redirect-page class to mark this as a redirect page layout element
<div className="ai-redirect-page"></div>
}
