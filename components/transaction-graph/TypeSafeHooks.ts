'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MemoryManager, TypeSafeEventEmitter } from './MemoryManager';
import cytoscape from 'cytoscape';

// Enhanced type-safe interfaces
export interface SafeAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  abort: () => void;
  retry: () => void;
}

export interface SafeTimeoutConfig {
  delay: number;
  immediate?: boolean;
  description?: string;
}

export interface SafeIntervalConfig {
  interval: number;
  immediate?: boolean;
  description?: string;
}

export interface CytoscapeConfig {
  container: HTMLElement;
  elements: cytoscape.ElementDefinition[];
  style: cytoscape.StylesheetCSS[];
  layout: cytoscape.LayoutOptions;
}

export interface GraphEventMap {
  nodeClick: { nodeId: string; data: any };
  edgeClick: { edgeId: string; data: any };
  graphReady: { cy: cytoscape.Core };
  layoutComplete: { layout: string };
  error: { error: Error; context: string };
}

// Type-safe async hook with automatic cleanup
export function useSafeAsync<T>(
  asyncFunction: (signal: AbortSignal) => Promise<T>,
  dependencies: React.DependencyList = []
): SafeAsyncState<T> {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: true,
    error: null
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const execute = useCallback(async () => {
    // Clean up previous request
    abort();

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await asyncFunction(signal);

      if (!signal.aborted) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (error) {
      if (!signal.aborted) {
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }
  }, [asyncFunction, abort]);

  const retry = useCallback(() => {
    execute();
  }, [execute]);

  useEffect(() => {
    execute();

    // Cleanup on unmount
    return () => {
      abort();
    };
  }, dependencies);

  return {
    ...state,
    abort,
    retry
  };
}

// Type-safe timeout hook with automatic cleanup
export function useSafeTimeout(
  callback: () => void,
  config: SafeTimeoutConfig
): {
  isActive: boolean;
  start: () => void;
  stop: () => void;
  restart: () => void;
} {
  const [isActive, setIsActive] = useState(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  const stop = useCallback(() => {
    if (timeoutIdRef.current) {
      timeoutIdRef.current = null;
      setIsActive(false);
    }
  }, []);

  const start = useCallback(() => {
    stop(); // Clear any existing timeout

    setIsActive(true);
    timeoutIdRef.current = setTimeout(() => {
      callback();
      setIsActive(false);
      timeoutIdRef.current = null;
    }, config.delay);
  }, [callback, config.delay, stop]);

  const restart = useCallback(() => {
    start();
  }, [start]);

  // Auto-start if immediate is true
  useEffect(() => {
    if (config.immediate) {
      start();
    }

    return () => {
      stop();
    };
  }, [config.immediate, start, stop]);

  return {
    isActive,
    start,
    stop,
    restart
  };
}

// Type-safe interval hook with automatic cleanup
export function useSafeInterval(
  callback: () => void,
  config: SafeIntervalConfig
): {
  isActive: boolean;
  start: () => void;
  stop: () => void;
  restart: () => void;
} {
  const [isActive, setIsActive] = useState(false);
  const intervalIdRef = useRef<string | null>(null);
  const memoryManager = MemoryManager.getInstance();

  const stop = useCallback(() => {
    if (intervalIdRef.current) {
      memoryManager.unregisterResource(intervalIdRef.current);
      intervalIdRef.current = null;
      setIsActive(false);
    }
  }, [memoryManager]);

  const start = useCallback(() => {
    stop(); // Clear any existing interval

    setIsActive(true);
    intervalIdRef.current = memoryManager.safeSetInterval(() => {
      callback();
    }, config.interval, config.description);
  }, [callback, config.interval, config.description, memoryManager, stop]);

  const restart = useCallback(() => {
    start();
  }, [start]);

  // Auto-start if immediate is true
  useEffect(() => {
    if (config.immediate) {
      start();
    }

    return () => {
      stop();
    };
  }, [config.immediate, start, stop]);

  return {
    isActive,
    start,
    stop,
    restart
  };
}

// Type-safe event listener hook
export function useSafeEventListener<
  T extends HTMLElement | Window | Document | cytoscape.Core,
  K extends keyof HTMLElementEventMap | keyof WindowEventMap | keyof DocumentEventMap | string
>(
  elementRef: React.RefObject<T> | T | null,
  eventName: K,
  handler: K extends keyof HTMLElementEventMap
    ? (event: HTMLElementEventMap[K]) => void
    : K extends keyof WindowEventMap
    ? (event: WindowEventMap[K]) => void
    : K extends keyof DocumentEventMap
    ? (event: DocumentEventMap[K]) => void
    : (event: any) => void,
  options?: AddEventListenerOptions,
  dependencies: React.DependencyList = []
): void {
  const memoryManager = MemoryManager.getInstance();
  const listenerIdRef = useRef<string | null>(null);

  useEffect(() => {
    const element = elementRef && typeof elementRef === 'object' && 'current' in elementRef
      ? elementRef.current
      : elementRef;

    if (!element) return;

    // Clean up previous listener
    if (listenerIdRef.current) {
      memoryManager.unregisterResource(listenerIdRef.current);
    }

    // Add new listener
    listenerIdRef.current = memoryManager.safeAddEventListener(
      element as any,
      eventName as string,
      handler as EventListener,
      options,
      `Event listener for ${String(eventName)}`
    );

    return () => {
      if (listenerIdRef.current) {
        memoryManager.unregisterResource(listenerIdRef.current);
        listenerIdRef.current = null;
      }
    };
  }, [elementRef, eventName, handler, options, memoryManager, ...dependencies]);
}

// Type-safe Cytoscape hook with comprehensive cleanup
export function useSafeCytoscape(
  config: CytoscapeConfig | null,
  onReady?: (cy: cytoscape.Core) => void
): {
  cy: cytoscape.Core | null;
  isReady: boolean;
  error: Error | null;
  recreate: () => void;
} {
  const [state, setState] = useState<{
    cy: cytoscape.Core | null;
    isReady: boolean;
    error: Error | null;
  }>({
    cy: null,
    isReady: false,
    error: null
  });

  const cyIdRef = useRef<string | null>(null);
  const memoryManager = MemoryManager.getInstance();

  const cleanup = useCallback(() => {
    if (cyIdRef.current) {
      memoryManager.unregisterResource(cyIdRef.current);
      cyIdRef.current = null;
    }
    setState(prev => ({ ...prev, cy: null, isReady: false }));
  }, [memoryManager]);

  const create = useCallback(() => {
    if (!config) return;

    cleanup();

    try {
      const cy = cytoscape(config);

      cyIdRef.current = memoryManager.registerCytoscape(
        cy,
        'Main graph Cytoscape instance'
      );

      // Wait for ready event
      cy.ready(() => {
        setState({
          cy,
          isReady: true,
          error: null
        });
        onReady?.(cy);
      });

    } catch (error) {
      setState({
        cy: null,
        isReady: false,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }, [config, cleanup, memoryManager, onReady]);

  const recreate = useCallback(() => {
    create();
  }, [create]);

  useEffect(() => {
    create();

    return () => {
      cleanup();
    };
  }, [create, cleanup]);

  return {
    ...state,
    recreate
  };
}

// Type-safe event emitter hook
export function useSafeEventEmitter<TEvents extends Record<string, any>>(
  description?: string
): TypeSafeEventEmitter<TEvents> {
  const emitterRef = useRef<TypeSafeEventEmitter<TEvents> | null>(null);

  if (!emitterRef.current) {
    emitterRef.current = new TypeSafeEventEmitter<TEvents>(description);
  }

  useEffect(() => {
    return () => {
      if (emitterRef.current) {
        emitterRef.current.destroy();
        emitterRef.current = null;
      }
    };
  }, []);

  return emitterRef.current;
}

// Type-safe observer hook (Intersection, Mutation, Resize)
export function useSafeObserver<T extends IntersectionObserver | MutationObserver | ResizeObserver>(
  observerFactory: () => T,
  target: Element | null,
  dependencies: React.DependencyList = []
): {
  observer: T | null;
  isObserving: boolean;
  start: () => void;
  stop: () => void;
} {
  const [isObserving, setIsObserving] = useState(false);
  const observerRef = useRef<T | null>(null);
  const observerIdRef = useRef<string | null>(null);
  const memoryManager = MemoryManager.getInstance();

  const stop = useCallback(() => {
    if (observerIdRef.current) {
      memoryManager.unregisterResource(observerIdRef.current);
      observerIdRef.current = null;
    }
    observerRef.current = null;
    setIsObserving(false);
  }, [memoryManager]);

  const start = useCallback(() => {
    if (!target) return;

    stop(); // Clean up previous observer

    try {
      const observer = observerFactory();
      observerRef.current = observer;

      observerIdRef.current = memoryManager.registerObserver(
        observer as any,
        'Safe observer hook'
      );

      // Start observing
      if ('observe' in observer) {
        (observer as any).observe(target);
        setIsObserving(true);
      }
    } catch (error) {
      console.error('Error creating observer:', error);
      stop();
    }
  }, [target, observerFactory, memoryManager, stop]);

  useEffect(() => {
    start();

    return () => {
      stop();
    };
  }, [start, stop, ...dependencies]);

  return {
    observer: observerRef.current,
    isObserving,
    start,
    stop
  };
}

// Type-safe Web Worker hook
export function useSafeWorker<TMessage = any, TResponse = any>(
  workerScript: string,
  onMessage?: (data: TResponse) => void,
  onError?: (error: ErrorEvent) => void
): {
  worker: Worker | null;
  isReady: boolean;
  postMessage: (message: TMessage) => void;
  terminate: () => void;
} {
  const [isReady, setIsReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const workerIdRef = useRef<string | null>(null);
  const memoryManager = MemoryManager.getInstance();

  const terminate = useCallback(() => {
    if (workerIdRef.current) {
      memoryManager.unregisterResource(workerIdRef.current);
      workerIdRef.current = null;
    }
    workerRef.current = null;
    setIsReady(false);
  }, [memoryManager]);

  const postMessage = useCallback((message: TMessage) => {
    if (workerRef.current && isReady) {
      workerRef.current.postMessage(message);
    }
  }, [isReady]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const worker = new Worker(workerScript);
      workerRef.current = worker;

      workerIdRef.current = memoryManager.registerWorker(
        worker,
        `Worker: ${workerScript}`
      );

      worker.onmessage = (event) => {
        onMessage?.(event.data);
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        onError?.(error);
      };

      worker.onmessageerror = (error) => {
        console.error('Worker message error:', error);
      };

      // Simple ready check
      worker.postMessage({ type: 'ping' });

      const readyHandler = (event: MessageEvent) => {
        if (event.data?.type === 'pong') {
          setIsReady(true);
          worker.removeEventListener('message', readyHandler);
        }
      };

      worker.addEventListener('message', readyHandler);

    } catch (error) {
      console.error('Error creating worker:', error);
      terminate();
    }

    return () => {
      terminate();
    };
  }, [workerScript, onMessage, onError, memoryManager, terminate]);

  return {
    worker: workerRef.current,
    isReady,
    postMessage,
    terminate
  };
}

// Type-safe local storage hook with error handling
export function useSafeLocalStorage<T>(
  key: string,
  defaultValue: T,
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  }
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const serialize = serializer?.serialize || JSON.stringify;
  const deserialize = serializer?.deserialize || JSON.parse;

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, serialize(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, serialize, storedValue]);

  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, defaultValue]);

  return [storedValue, setValue, removeValue];
}

// Type-safe debounced value hook
export function useSafeDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const memoryManager = MemoryManager.getInstance();

  useEffect(() => {
    const timeoutId = memoryManager.safeSetTimeout(() => {
      setDebouncedValue(value);
    }, delay, 'Debounce timeout');

    return () => {
      memoryManager.unregisterResource(timeoutId);
    };
  }, [value, delay, memoryManager]);

  return debouncedValue;
}

// Type-safe throttled callback hook
export function useSafeThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const throttledCallback = useRef<T | null>(null);
  const lastCall = useRef<number>(0);

  return useMemo(() => {
    const throttled = ((...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCall.current >= delay) {
        lastCall.current = now;
        return callback(...args);
      }
    }) as T;

    throttledCallback.current = throttled;
    return throttled;
  }, [callback, delay]) as T;
}

export {
  MemoryManager,
  TypeSafeEventEmitter
};