'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/app/providers/SettingsProvider';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Props {
  params: Promise<{ signature: string; tab: string[] }>
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

export default function InvalidTabRedirect({ params }: Props) {
  const settings = useSettings();
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ signature: string; tab: string[] } | null>(null);

  useEffect(() => {
    async function resolveParams() {
      try {
        const resolved = await params;
        setResolvedParams(resolved);
      } catch (error) {
        console.error('Error resolving params:', error);
      }
    }
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!resolvedParams) return;

    const { signature, tab } = resolvedParams;
    
    // Handle base URL case (empty tab array)
    if (!tab || tab.length === 0) {
      // This is the base URL /tx/signature - redirect to overview
      router.push(`/tx/${signature}/overview`);
      return;
    }
    
    // Handle single tab case
    const tabName = tab[0];
    
    if (!tabName || !VALID_TABS.includes(tabName)) {
      // Invalid tab - redirect to overview
      router.push(`/tx/${signature}/overview`);
      return;
    }
    
    // Valid tabs should be handled by their specific page files
    // But if we reach here, redirect to the specific tab
    router.push(`/tx/${signature}/${tabName}`);
  }, [resolvedParams, router]);

  if (!resolvedParams) {
    return <LoadingSpinner />;
  }

  return null; // This component just redirects, so it doesn't render anything
}
