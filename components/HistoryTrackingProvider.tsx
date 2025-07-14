/**
 * History Tracking Provider
 * Wraps the application to track user history
 */

'use client';

import { useHistoryTracking } from '@/hooks/useHistoryTracking';

interface HistoryTrackingProviderProps {
  children: React.ReactNode;
}

export function HistoryTrackingProvider({ children }: HistoryTrackingProviderProps) {
  // Initialize history tracking
  useHistoryTracking();

  return <>{children}</>;
}