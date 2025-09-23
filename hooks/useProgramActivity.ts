import { useState, useEffect, useCallback, useRef } from 'react';
import { programActivityService, type ProgramActivity, type ParsedTransaction } from '@/lib/program-activity';

export interface UseProgramActivityReturn {
  activity: ProgramActivity | null;
  loading: boolean;
  error: string | null;
  refreshActivity: () => Promise<void>;
  isLive: boolean;
  toggleLiveUpdates: () => void;
  getTransactionDetails: (signature: string) => Promise<ParsedTransaction | null>;
}

export function useProgramActivity(programId: string | null): UseProgramActivityReturn {
  const [activity, setActivity] = useState<ProgramActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!programId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await programActivityService.getProgramActivity(programId);
      setActivity(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch program activity';
      setError(errorMsg);
      console.error('Error fetching program activity:', err);
    } finally {
      setLoading(false);
    }
  }, [programId]);

  const refreshActivity = useCallback(async () => {
    await fetchActivity();
  }, [fetchActivity]);

  const getTransactionDetails = useCallback(async (signature: string): Promise<ParsedTransaction | null> => {
    try {
      return await programActivityService.getTransactionDetails(signature);
    } catch (err) {
      console.error('Error fetching transaction details:', err);
      return null;
    }
  }, []);

  const toggleLiveUpdates = useCallback(() => {
    if (!programId) return;

    if (isLive) {
      // Disable live updates
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setIsLive(false);
    } else {
      // Enable live updates
      try {
        const unsubscribe = programActivityService.subscribeToProgramUpdates(
          programId,
          (update) => {
            console.log('Live program update:', update);
            // Refresh activity data when we get updates
            refreshActivity();
          }
        );
        unsubscribeRef.current = unsubscribe;
        setIsLive(true);
      } catch (err) {
        console.error('Error setting up live updates:', err);
        setError('Failed to enable live updates');
      }
    }
  }, [programId, isLive, refreshActivity]);

  // Initial fetch when programId changes
  useEffect(() => {
    if (programId) {
      fetchActivity();
    } else {
      setActivity(null);
      setError(null);
    }
  }, [programId, fetchActivity]);

  // Auto-refresh every 30 seconds when not live
  useEffect(() => {
    if (!programId || isLive) return;

    const interval = setInterval(() => {
      refreshActivity();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [programId, isLive, refreshActivity]);

  // Cleanup WebSocket subscription on unmount or programId change
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [programId]);

  // Retry logic for failed requests
  useEffect(() => {
    if (error && programId && !loading) {
      // Retry after 5 seconds
      retryTimeoutRef.current = setTimeout(() => {
        console.log('Retrying program activity fetch...');
        fetchActivity();
      }, 5000);
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [error, programId, loading, fetchActivity]);

  return {
    activity,
    loading,
    error,
    refreshActivity,
    isLive,
    toggleLiveUpdates,
    getTransactionDetails
  };
}
