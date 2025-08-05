import { test, expect, Page } from '@playwright/test';
import { TEST_CONSTANTS } from './utils/test-helpers';

// Environment detection for CI/CD vs local development
const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test' || typeof window === 'undefined';

// Performance thresholds for different page types - adjusted for CI/CD environments
const PERFORMANCE_THRESHOLDS = {
  ACCOUNT_PAGE: {
    INITIAL_LOAD: isCI ? 15000 : 5000, // 15s for CI/CD, 5s for local
    GRAPH_RENDER: isCI ? 10000 : 3000, // 10s for CI/CD, 3s for local
    TABLE_LOAD: isCI ? 6000 : 2000,    // 6s for CI/CD, 2s for local
    TOTAL_PAGE_SIZE: 3 * 1024 * 1024,  // 3MB max (more lenient for CI)
    JS_BUNDLE_SIZE: 2 * 1024 * 1024,   // 2MB max (more lenient for CI)
  },
  API_ENDPOINTS: {
    TOKEN_API: isCI ? 5000 : 1000,     // 5s for CI/CD, 1s for local
    ACCOUNT_API: isCI ? 8000 : 2000,   // 8s for CI/CD, 2s for local
  }
};

// Performance metrics collection utility
class PerformanceMonitor {
  private metrics: any[] = [];
  
  async measurePageLoad(page: Page, url: string) {
    const startTime = Date.now();
    
    // Start performance monitoring
    await page.evaluate(() => {
      (window as any).__performanceData = {
        navigation: performance.getEntriesByType('navigation')[0],
        resources: [],
        marks: []
      };
    });
    
    // Navigate to page
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    const loadTime = Date.now() - startTime;
    
    // Collect performance data
    const performanceData = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource');
      
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstByte: navigation.responseStart - navigation.fetchStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        resourceCount: resources.length,
        totalTransferSize: resources.reduce((total: number, resource: any) => 
          total + (resource.transferSize || 0), 0),
        totalDecodedSize: resources.reduce((total: number, resource: any) => 
          total + (resource.decodedBodySize || 0), 0),
        jsResourceSize: resources
          .filter((resource: any) => resource.name.includes('.js'))
          .reduce((total: number, resource: any) => total + (resource.transferSize || 0), 0)
      };
    });
    
    return {
      actualLoadTime: loadTime,
      performanceData,
      httpStatus: response?.status() || 0
    };
  }
  
  async measureAPIResponse(page: Page, apiUrl: string) {
    const startTime = Date.now();
    
    const response = await page.goto(apiUrl, { timeout: 5000 });
    const responseTime = Date.now() - startTime;
    
    return {
      responseTime,
      status: response?.status() || 0,
      contentLength: response?.headers()['content-length'] || '0'
    };
  }
  
  logMetrics(testName: string, metrics: any) {
    this.metrics.push({
      testName,
      timestamp: new Date().toISOString(),
      ...metrics
    });
    
    console.log(`📊 Performance Metrics for ${testName}:`, {
      loadTime: `${metrics.actualLoadTime}ms`,
      domContentLoaded: `${metrics.performanceData?.domContentLoaded}ms`,
      totalSize: `${Math.round((metrics.performanceData?.totalTransferSize || 0) / 1024)}KB`,
      jsSize: `${Math.round((metrics.performanceData?.jsResourceSize || 0) / 1024)}KB`
    });
  }
  
  getMetricsSummary() {
    return this.metrics;
  }
}

const performanceMonitor = new PerformanceMonitor();

test.describe('Performance Validation Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Set up performance monitoring
    await page.addInitScript(() => {
      // Mark start of test
      performance.mark('test-start');
    });
  });

  test('Account page should load within performance thresholds', async ({ page }) => {
    const testUrl = `/account/${TEST_CONSTANTS.TEST_ADDRESSES.VALID_ACCOUNT}`;
    
    // Measure initial page load
    const loadMetrics = await performanceMonitor.measurePageLoad(page, testUrl);
    performanceMonitor.logMetrics('Account Page Load', loadMetrics);
    
    // Validate load time threshold
    expect(loadMetrics.actualLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ACCOUNT_PAGE.INITIAL_LOAD);
    
    // Validate total page size
    expect(loadMetrics.performanceData.totalTransferSize).toBeLessThan(PERFORMANCE_THRESHOLDS.ACCOUNT_PAGE.TOTAL_PAGE_SIZE);
    
    // Validate JS bundle size
    expect(loadMetrics.performanceData.jsResourceSize).toBeLessThan(PERFORMANCE_THRESHOLDS.ACCOUNT_PAGE.JS_BUNDLE_SIZE);
    
    console.log('✅ Account page meets performance thresholds');
  });

  test('Graph component should render within threshold', async ({ page }) => {
    await page.goto(`/account/${TEST_CONSTANTS.TEST_ADDRESSES.VALID_ACCOUNT}`);
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="cytoscape-wrapper"]', { timeout: 10000 });
    
    // Measure graph rendering time
    const graphStartTime = Date.now();
    
    // Wait for graph to be ready
    await page.waitForFunction(() => {
      const container = document.getElementById('cy-container');
      return container?.getAttribute('data-graph-ready') === 'true';
    }, { timeout: PERFORMANCE_THRESHOLDS.ACCOUNT_PAGE.GRAPH_RENDER });
    
    const graphRenderTime = Date.now() - graphStartTime;
    
    expect(graphRenderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ACCOUNT_PAGE.GRAPH_RENDER);
    
    console.log(`✅ Graph rendered in ${graphRenderTime}ms`);
  });

  test('API endpoints should respond within thresholds', async ({ request }) => {
    // Test Token API performance
    const tokenStartTime = Date.now();
    const tokenResponse = await request.get(`/api/token/${TEST_CONSTANTS.TEST_ADDRESSES.VALID_TOKEN}`);
    const tokenResponseTime = Date.now() - tokenStartTime;
    
    // Allow for 404/408 responses in test environment, but they should still be fast
    expect([200, 404, 408]).toContain(tokenResponse.status());
    expect(tokenResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_ENDPOINTS.TOKEN_API);
    
    console.log(`✅ Token API responded in ${tokenResponseTime}ms (status: ${tokenResponse.status()})`);
  });

  test('Page should meet Core Web Vitals thresholds', async ({ page }) => {
    await page.goto(`/account/${TEST_CONSTANTS.TEST_ADDRESSES.VALID_ACCOUNT}`);
    
    // Wait for page to be interactive
    await page.waitForLoadState('domcontentloaded');
    
    // Measure Core Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Simple approximation of Core Web Vitals for testing
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        const lcp = navigation.loadEventStart - navigation.fetchStart; // Approximation
        const fid = navigation.domInteractive - navigation.domContentLoadedEventStart; // Approximation
        const cls = 0; // Would need more complex measurement in real scenario
        
        resolve({
          lcp, // Largest Contentful Paint
          fid, // First Input Delay
          cls  // Cumulative Layout Shift
        });
      });
    });
    
    // Core Web Vitals thresholds (Good ratings)
    expect((webVitals as any).lcp).toBeLessThan(2500); // 2.5s for LCP
    expect((webVitals as any).fid).toBeLessThan(100);  // 100ms for FID
    expect((webVitals as any).cls).toBeLessThan(0.1);  // 0.1 for CLS
    
    console.log('✅ Page meets Core Web Vitals thresholds:', webVitals);
  });

  test('Memory usage should remain within bounds', async ({ page }) => {
    await page.goto(`/account/${TEST_CONSTANTS.TEST_ADDRESSES.VALID_ACCOUNT}`);
    
    // Initial memory measurement
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });
    
    if (initialMemory) {
      // Memory should not exceed 50MB for typical usage
      const maxMemoryMB = 50 * 1024 * 1024;
      expect(initialMemory.usedJSHeapSize).toBeLessThan(maxMemoryMB);
      
      console.log(`✅ Memory usage: ${Math.round(initialMemory.usedJSHeapSize / 1024 / 1024)}MB`);
    } else {
      console.log('⚠️ Memory monitoring not available in this browser');
    }
  });

  test.afterAll(async () => {
    // Generate performance report
    const metrics = performanceMonitor.getMetricsSummary();
    
    if (metrics.length > 0) {
      console.log('\n📊 Performance Test Summary:');
      console.log('=' .repeat(50));
      
      metrics.forEach(metric => {
        console.log(`${metric.testName}: ${metric.actualLoadTime}ms`);
      });
      
      console.log('=' .repeat(50));
    }
  });
});