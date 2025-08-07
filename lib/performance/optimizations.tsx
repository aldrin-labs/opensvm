'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// Image optimization utilities
export interface ImageOptimizationOptions {
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  sizes?: string;
  lazy?: boolean;
  placeholder?: 'blur' | 'empty';
  priority?: boolean;
}

export function useImageOptimization() {
  const [supportsWebP, setSupportsWebP] = useState<boolean | null>(null);
  const [supportsAVIF, setSupportsAVIF] = useState<boolean | null>(null);

  useEffect(() => {
    // Check WebP support
    const webpImage = new Image();
    webpImage.onload = webpImage.onerror = () => {
      setSupportsWebP(webpImage.height === 2);
    };
    webpImage.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';

    // Check AVIF support
    const avifImage = new Image();
    avifImage.onload = avifImage.onerror = () => {
      setSupportsAVIF(avifImage.height === 2);
    };
    avifImage.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
  }, []);

  const getOptimalFormat = useCallback((options: ImageOptimizationOptions = {}) => {
    const { format } = options;
    
    if (format) return format;
    
    if (supportsAVIF) return 'avif';
    if (supportsWebP) return 'webp';
    return 'jpeg';
  }, [supportsWebP, supportsAVIF]);

  const generateSrcSet = useCallback((baseSrc: string, widths: number[], options: ImageOptimizationOptions = {}) => {
    const format = getOptimalFormat(options);
    const quality = options.quality || 85;
    
    return widths
      .map(width => `${baseSrc}?w=${width}&q=${quality}&f=${format} ${width}w`)
      .join(', ');
  }, [getOptimalFormat]);

  return {
    supportsWebP,
    supportsAVIF,
    getOptimalFormat,
    generateSrcSet,
  };
}

// Bundle splitting and lazy loading utilities
export function useLazyComponent<T>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  fallback?: React.ComponentType
) {
  const [Component, setComponent] = useState<React.ComponentType<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component || loading) return;

    setLoading(true);
    setError(null);

    try {
      const { default: LoadedComponent } = await importFn();
      setComponent(() => LoadedComponent);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load component'));
    } finally {
      setLoading(false);
    }
  }, [importFn, Component, loading]);

  return {
    Component: Component || fallback,
    loading,
    error,
    loadComponent,
  };
}

// Code splitting helper
export function createAsyncComponent<T extends Record<string, any>>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  fallback?: React.ComponentType
) {
  return (props: T) => {
    const { Component, loading, error, loadComponent } = useLazyComponent(importFn, fallback);

    useEffect(() => {
      loadComponent();
    }, [loadComponent]);

    if (error) {
      return fallback ? React.createElement(fallback) : <div>Error loading component</div>;
    }

    if (loading || !Component) {
      return fallback ? React.createElement(fallback) : <div>Loading...</div>;
    }

    return <Component {...props} />;
  };
}

// Resource preloading utilities
export function useResourcePreloader() {
  const preloadedResources = useRef(new Set<string>());

  const preload = useCallback((href: string, as: string, type?: string) => {
    if (preloadedResources.current.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (type) link.type = type;

    document.head.appendChild(link);
    preloadedResources.current.add(href);
  }, []);

  const prefetch = useCallback((href: string) => {
    if (preloadedResources.current.has(href)) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;

    document.head.appendChild(link);
    preloadedResources.current.add(href);
  }, []);

  const preloadScript = useCallback((src: string) => {
    preload(src, 'script', 'text/javascript');
  }, [preload]);

  const preloadStyle = useCallback((href: string) => {
    preload(href, 'style', 'text/css');
  }, [preload]);

  const preloadFont = useCallback((href: string, type = 'font/woff2') => {
    preload(href, 'font', type);
  }, [preload]);

  return {
    preload,
    prefetch,
    preloadScript,
    preloadStyle,
    preloadFont,
  };
}

// Memory optimization hooks
export function useMemoryOptimization() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  const checkMemory = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      setMemoryInfo({
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      });
    }
  }, []);

  const forceGC = useCallback(() => {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
      checkMemory();
    }
  }, [checkMemory]);

  useEffect(() => {
    checkMemory();
    const interval = setInterval(checkMemory, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [checkMemory]);

  return {
    memoryInfo,
    checkMemory,
    forceGC,
    memoryUsagePercentage: memoryInfo 
      ? (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100 
      : 0,
  };
}

// Network optimization utilities
export function useNetworkOptimization() {
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      setConnectionType(connection.effectiveType || 'unknown');
      setIsSlowConnection(['slow-2g', '2g', '3g'].includes(connection.effectiveType));

      const handleConnectionChange = () => {
        setConnectionType(connection.effectiveType || 'unknown');
        setIsSlowConnection(['slow-2g', '2g', '3g'].includes(connection.effectiveType));
      };

      connection.addEventListener('change', handleConnectionChange);
      return () => connection.removeEventListener('change', handleConnectionChange);
    }
  }, []);

  const shouldLoadLowQuality = useCallback(() => {
    return isSlowConnection;
  }, [isSlowConnection]);

  const shouldDeferNonCritical = useCallback(() => {
    return isSlowConnection;
  }, [isSlowConnection]);

  return {
    connectionType,
    isSlowConnection,
    shouldLoadLowQuality,
    shouldDeferNonCritical,
  };
}

// Performance measurement helpers
export function usePerformanceMeasurement() {
  const markStart = useCallback((name: string) => {
    performance.mark(`${name}-start`);
  }, []);

  const markEnd = useCallback((name: string) => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name, 'measure')[0];
    return measure?.duration || 0;
  }, []);

  const measureFunction = useCallback(<T extends any[], R>(
    fn: (...args: T) => R,
    name: string
  ) => {
    return (...args: T): R => {
      markStart(name);
      const result = fn(...args);
      markEnd(name);
      return result;
    };
  }, [markStart, markEnd]);

  const measureAsync = useCallback(async <T,>(promise: Promise<T>, name: string): Promise<T> => {
    markStart(name);
    try {
      const result = await promise;
      markEnd(name);
      return result;
    } catch (error) {
      markEnd(name);
      throw error;
    }
  }, [markStart, markEnd]);

  return {
    markStart,
    markEnd,
    measureFunction,
    measureAsync,
  };
}

// Intersection Observer optimization
export function useIntersectionOptimization(threshold = 0.1) {
  const [entries, setEntries] = useState<Map<Element, IntersectionObserverEntry>>(new Map());
  const observerRef = useRef<IntersectionObserver>();

  const observe = useCallback((element: Element) => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (observerEntries) => {
          setEntries(prev => {
            const next = new Map(prev);
            observerEntries.forEach(entry => {
              next.set(entry.target, entry);
            });
            return next;
          });
        },
        { threshold }
      );
    }

    observerRef.current.observe(element);
  }, [threshold]);

  const unobserve = useCallback((element: Element) => {
    if (observerRef.current) {
      observerRef.current.unobserve(element);
      setEntries(prev => {
        const next = new Map(prev);
        next.delete(element);
        return next;
      });
    }
  }, []);

  const isVisible = useCallback((element: Element) => {
    const entry = entries.get(element);
    return entry?.isIntersecting || false;
  }, [entries]);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return {
    observe,
    unobserve,
    isVisible,
    entries: Array.from(entries.values()),
  };
}

// Virtual scrolling optimization
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    handleScroll,
  };
}

// Critical CSS utilities
export function useCriticalCSS() {
  const [criticalCSS, setCriticalCSS] = useState<string>('');

  const extractCriticalCSS = useCallback(async () => {
    // This would typically be done at build time, but we can identify critical styles at runtime
    const stylesheets = Array.from(document.styleSheets);
    const criticalRules: string[] = [];

    try {
      stylesheets.forEach(stylesheet => {
        try {
          const rules = Array.from(stylesheet.cssRules || []);
          rules.forEach(rule => {
            if (rule instanceof CSSStyleRule) {
              // Check if any elements matching this selector are in the viewport
              const elements = document.querySelectorAll(rule.selectorText);
              const hasVisibleElements = Array.from(elements).some(el => {
                const rect = el.getBoundingClientRect();
                return rect.top < window.innerHeight && rect.bottom > 0;
              });

              if (hasVisibleElements) {
                criticalRules.push(rule.cssText);
              }
            }
          });
        } catch (e) {
          // Handle cross-origin stylesheets
          console.warn('Cannot access stylesheet rules:', e);
        }
      });

      setCriticalCSS(criticalRules.join('\n'));
    } catch (error) {
      console.error('Failed to extract critical CSS:', error);
    }
  }, []);

  const inlineCriticalCSS = useCallback(() => {
    if (criticalCSS) {
      const style = document.createElement('style');
      style.innerHTML = criticalCSS;
      document.head.appendChild(style);
    }
  }, [criticalCSS]);

  return {
    criticalCSS,
    extractCriticalCSS,
    inlineCriticalCSS,
  };
}

// Bundle analysis utilities
export function useBundleAnalysis() {
  const [chunkInfo, setChunkInfo] = useState<{
    loadedChunks: number;
    totalSize: number;
    gzippedSize?: number;
  }>({
    loadedChunks: 0,
    totalSize: 0,
  });

  const analyzeBundle = useCallback(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const totalSize = scripts.reduce((acc, script) => {
      // This is a simplified calculation - in practice, you'd need server-side data
      return acc + (script.textContent?.length || 0);
    }, 0);

    setChunkInfo({
      loadedChunks: scripts.length,
      totalSize,
    });
  }, []);

  useEffect(() => {
    analyzeBundle();
  }, [analyzeBundle]);

  return {
    chunkInfo,
    analyzeBundle,
  };
}
