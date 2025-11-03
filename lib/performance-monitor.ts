/**
 * Performance Monitoring Utility
 * Tracks and optimizes Core Web Vitals (CLS, FID, LCP)
 */

export interface PerformanceMetrics {
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
  lcp: number; // Largest Contentful Paint
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
}

export interface PerformanceThresholds {
  cls: { good: number; needsImprovement: number };
  fid: { good: number; needsImprovement: number };
  lcp: { good: number; needsImprovement: number };
}

// Web Vitals thresholds (Google's recommendations)
export const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  cls: { good: 0.1, needsImprovement: 0.25 },
  fid: { good: 100, needsImprovement: 300 },
  lcp: { good: 2500, needsImprovement: 4000 },
};

/**
 * Monitor Cumulative Layout Shift
 */
export function monitorCLS(callback: (cls: number) => void): () => void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return () => {};
  }

  let clsValue = 0;
  let clsEntries: PerformanceEntry[] = [];

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Only count layout shifts without recent user input
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          clsEntries.push(entry);
          callback(clsValue);
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });

    return () => observer.disconnect();
  } catch (error) {
    console.warn('CLS monitoring not supported:', error);
    return () => {};
  }
}

/**
 * Monitor First Input Delay
 */
export function monitorFID(callback: (fid: number) => void): () => void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return () => {};
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fid = (entry as any).processingStart - entry.startTime;
        callback(fid);
      }
    });

    observer.observe({ type: 'first-input', buffered: true });

    return () => observer.disconnect();
  } catch (error) {
    console.warn('FID monitoring not supported:', error);
    return () => {};
  }
}

/**
 * Monitor Largest Contentful Paint
 */
export function monitorLCP(callback: (lcp: number) => void): () => void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return () => {};
  }

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      callback(lastEntry.startTime);
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });

    return () => observer.disconnect();
  } catch (error) {
    console.warn('LCP monitoring not supported:', error);
    return () => {};
  }
}

/**
 * Get performance rating
 */
export function getPerformanceRating(
  metric: keyof PerformanceThresholds,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = PERFORMANCE_THRESHOLDS[metric];
  
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Reserve space for dynamic content to prevent CLS
 */
export function reserveSpace(element: HTMLElement, height: number, width?: number) {
  element.style.minHeight = `${height}px`;
  if (width) {
    element.style.minWidth = `${width}px`;
  }
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources(resources: Array<{ href: string; as: string; type?: string }>) {
  if (typeof document === 'undefined') return;

  resources.forEach(({ href, as, type }) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (type) link.type = type;
    document.head.appendChild(link);
  });
}

/**
 * Lazy load images with intersection observer
 */
export function setupLazyImages() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return;
  }

  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      }
    });
  });

  document.querySelectorAll('img[data-src]').forEach((img) => {
    imageObserver.observe(img);
  });
}

/**
 * Report Core Web Vitals to analytics
 */
export function reportWebVitals(metrics: Partial<PerformanceMetrics>) {
  // In production, send to analytics service
  if (process.env.NODE_ENV === 'development') {
    console.log('Web Vitals:', metrics);
  }
  
  // Send to analytics endpoint
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const vitalsData = JSON.stringify({
      ...metrics,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    });
    
    navigator.sendBeacon('/api/analytics/vitals', vitalsData);
  }
}

/**
 * Hook to monitor all Core Web Vitals
 */
export function useWebVitals(onMetricsUpdate?: (metrics: Partial<PerformanceMetrics>) => void) {
  if (typeof window === 'undefined') return;

  const metrics: Partial<PerformanceMetrics> = {};

  const updateMetrics = (key: keyof PerformanceMetrics, value: number) => {
    metrics[key] = value;
    onMetricsUpdate?.(metrics);
    reportWebVitals(metrics);
  };

  monitorCLS((cls) => updateMetrics('cls', cls));
  monitorFID((fid) => updateMetrics('fid', fid));
  monitorLCP((lcp) => updateMetrics('lcp', lcp));
}
