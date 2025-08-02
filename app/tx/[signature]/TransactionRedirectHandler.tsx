'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';

type TabType = 'overview' | 'instructions' | 'accounts' | 'graph' | 'ai' | 'metrics' | 'related' | 'failure';

interface TransactionRedirectHandlerProps {
  signature: string;
}

const TAB_PREFERENCE_KEY = 'opensvm_preferred_tx_tab';

function getUserTabPreference(): TabType | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TAB_PREFERENCE_KEY) as TabType || null;
  }
  return null;
}

export default function TransactionRedirectHandler({ signature }: TransactionRedirectHandlerProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();

  useEffect(() => {
    const checkPreferencesAndRedirect = async () => {
      // Only run on client side
      if (typeof window === 'undefined') return;

      // Check if we're already on a specific tab to avoid redirect loops
      const currentPath = window.location.pathname;
      const basePath = `/tx/${signature}`;
      
      // Only redirect if we're on the exact base URL or overview tab
      const shouldCheckRedirect = currentPath === basePath || currentPath.endsWith('/overview');
      
      if (!shouldCheckRedirect) {
        return; // Don't redirect if user is already on a specific tab
      }

      // Get preferred tab from localStorage
      const preferredTab = getUserTabPreference();
      
      // Valid tab types for validation
      const validTabs = ['overview', 'instructions', 'accounts', 'graph', 'ai', 'metrics', 'related', 'failure'];
      
      // If user has a valid preferred tab and it's not overview, redirect
      if (preferredTab && validTabs.includes(preferredTab) && preferredTab !== 'overview') {
        console.log(`Redirecting to preferred tab: ${preferredTab}`);
        router.replace(`/tx/${signature}/${preferredTab}`);
        return;
      }

      // If no preference, ensure we're on overview
      if (currentPath === basePath) {
        console.log('No preferred tab, redirecting to overview');
        router.replace(`/tx/${signature}/overview`);
        return;
      }
      
      console.log('No valid preferred tab found or already on preferred tab, staying on overview');
    };

    // Small delay to ensure navigation is complete
    const timer = setTimeout(checkPreferencesAndRedirect, 100);
    return () => clearTimeout(timer);
  }, [signature, router, isAuthenticated]);

  // This component doesn't render anything visible
  return null;
}