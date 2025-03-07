import { useState, useEffect, useCallback, useRef } from 'react';

interface SWRLikeOptions<T> {
  refreshInterval?: number;
  dedupingInterval?: number;
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
}

interface SWRLikeResponse<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: (data?: T | Promise<T> | ((currentData: T) => T | Promise<T>)) => Promise<T | undefined>;
}

// Cache for storing fetched data
const cache = new Map<string, { data: any; timestamp: number }>();

export function useSWRLike<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: SWRLikeOptions<T> = {}
): SWRLikeResponse<T> {
  const {
    refreshInterval = 0,
    dedupingInterval = 2000,
    initialData,
    onSuccess,
    onError,
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const fetcherRef = useRef(fetcher);
  const keyRef = useRef(key);
  const lastFetchTimeRef = useRef<number>(0);
  const unmountedRef = useRef(false);

  // Update refs when dependencies change
  useEffect(() => {
    fetcherRef.current = fetcher;
    keyRef.current = key;
  }, [fetcher, key]);

  const fetchData = useCallback(async (): Promise<T | undefined> => {
    if (!keyRef.current) return undefined;

    const now = Date.now();
    const cacheKey = keyRef.current;
    const cached = cache.get(cacheKey);

    // Use cached data if within dedupingInterval
    if (cached && now - cached.timestamp < dedupingInterval) {
      return cached.data;
    }

    // Prevent multiple fetches within dedupingInterval
    if (now - lastFetchTimeRef.current < dedupingInterval) {
      return data;
    }

    lastFetchTimeRef.current = now;
    setIsValidating(true);

    try {
      const newData = await fetcherRef.current();
      
      if (unmountedRef.current) return undefined;
      
      // Update cache
      cache.set(cacheKey, { data: newData, timestamp: Date.now() });
      
      setData(newData);
      setIsLoading(false);
      setError(undefined);
      
      if (onSuccess) onSuccess(newData);
      
      return newData;
    } catch (err) {
      if (unmountedRef.current) return undefined;
      
      const fetchError = err instanceof Error ? err : new Error(String(err));
      setError(fetchError);
      setIsLoading(false);
      
      if (onError) onError(fetchError);
      
      return undefined;
    } finally {
      if (!unmountedRef.current) {
        setIsValidating(false);
      }
    }
  }, [data, dedupingInterval, onError, onSuccess]);

  // Initial fetch and refresh interval
  useEffect(() => {
    if (!keyRef.current) return;
    
    unmountedRef.current = false;
    
    fetchData();
    
    // Set up refresh interval if specified
    let intervalId: NodeJS.Timeout | undefined;
    if (refreshInterval > 0) {
      intervalId = setInterval(fetchData, refreshInterval);
    }
    
    // Set up focus and reconnect listeners
    const handleFocus = () => {
      if (revalidateOnFocus) fetchData();
    };
    
    const handleReconnect = () => {
      if (revalidateOnReconnect) fetchData();
    };
    
    if (revalidateOnFocus) {
      window.addEventListener('focus', handleFocus);
    }
    
    if (revalidateOnReconnect) {
      window.addEventListener('online', handleReconnect);
    }
    
    return () => {
      unmountedRef.current = true;
      if (intervalId) clearInterval(intervalId);
      if (revalidateOnFocus) window.removeEventListener('focus', handleFocus);
      if (revalidateOnReconnect) window.removeEventListener('online', handleReconnect);
    };
  }, [fetchData, refreshInterval, revalidateOnFocus, revalidateOnReconnect]);

  // Mutate function to update data manually
  const mutate = useCallback(
    async (
      dataOrUpdater?: T | Promise<T> | ((currentData: T) => T | Promise<T>)
    ): Promise<T | undefined> => {
      if (!keyRef.current) return undefined;

      try {
        setIsValidating(true);
        
        let newData: T | undefined;
        
        if (typeof dataOrUpdater === 'function' && data !== undefined) {
          // Call updater function with current data
          const updater = dataOrUpdater as (currentData: T) => T | Promise<T>;
          const updatedData = await updater(data);
          newData = updatedData;
        } else if (dataOrUpdater !== undefined) {
          // Use provided data directly
          const result = await dataOrUpdater;
          newData = result as T;
        } else {
          // Refetch data if no updater provided
          return fetchData();
        }
        
        if (unmountedRef.current) return undefined;
        
        // Update cache
        if (keyRef.current) {
          cache.set(keyRef.current, { data: newData, timestamp: Date.now() });
        }
        
        setData(newData);
        if (onSuccess && newData !== undefined) onSuccess(newData);
        
        return newData;
      } catch (err) {
        if (unmountedRef.current) return undefined;
        
        const mutateError = err instanceof Error ? err : new Error(String(err));
        setError(mutateError);
        
        if (onError) onError(mutateError);
        
        return undefined;
      } finally {
        if (!unmountedRef.current) {
          setIsValidating(false);
        }
      }
    },
    [data, fetchData, onError, onSuccess]
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}