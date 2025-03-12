# Mobile Performance Implementation Details

This document provides detailed technical specifications for implementing performance optimizations for mobile responsiveness in the OpenSVM explorer.

## Analysis and Benchmarking

### Performance Metrics to Track
- **Lighthouse Performance Score**: Target 80+ on mobile
- **First Contentful Paint (FCP)**: Target < 1.8s
- **Largest Contentful Paint (LCP)**: Target < 2.5s
- **Time to Interactive (TTI)**: Target < 3.5s
- **Total Blocking Time (TBT)**: Target < 200ms
- **Cumulative Layout Shift (CLS)**: Target < 0.1

### Benchmarking Tools
- **Lighthouse**: For overall performance scoring
- **WebPageTest**: For detailed performance analysis
- **Chrome DevTools Performance Panel**: For runtime performance analysis
- **Bundle Analyzer**: For JavaScript bundle analysis

## Bundle Size Optimization

### Code Splitting Implementation

Update Next.js configuration in `next.config.mjs`:

```js
// Implement code splitting
const nextConfig = {
  // Existing config...
  
  // Enable granular chunks
  webpack: (config, { isServer }) => {
    // Only apply to client-side builds
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          default: false,
          vendors: false,
          // Create a bundle for each major library
          react: {
            name: 'react',
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            priority: 40,
            enforce: true,
          },
          // Add other major libraries here
          d3: {
            name: 'd3',
            test: /[\\/]node_modules[\\/]d3[\\/]/,
            priority: 30,
            enforce: true,
          },
          // Common utilities
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20,
          },
        },
      };
    }
    return config;
  },
};
```

### Dynamic Imports for Heavy Components

Implement dynamic imports for heavy components:

```tsx
// Before
import TransactionGraph from '@/components/transaction-graph/TransactionGraph';

// After
import dynamic from 'next/dynamic';

const TransactionGraph = dynamic(
  () => import('@/components/transaction-graph/TransactionGraph'),
  {
    loading: () => <TransactionGraphSkeleton />,
    ssr: false, // Disable server-side rendering for complex visualizations
  }
);
```

Create a list of components to convert to dynamic imports:
- `TransactionGraph.tsx`
- `EnhancedTransactionVisualizer.tsx`
- `NetworkCharts.tsx`
- `DeepScatterPlot.tsx`
- `TransactionFlowChart.tsx`

### Image Optimization

Implement next/image for all images:

```tsx
// Before
<img src="/logo.png" alt="OpenSVM Logo" />

// After
import Image from 'next/image';

<Image 
  src="/logo.png" 
  alt="OpenSVM Logo" 
  width={200} 
  height={50} 
  priority={isAboveTheFold}
  loading={isAboveTheFold ? 'eager' : 'lazy'}
/>
```

## Rendering Performance Improvements

### React.memo Implementation

Apply React.memo to pure components:

```tsx
// Before
export function TokenTable({ tokens }: TokenTableProps) {
  // Component implementation
}

// After
export const TokenTable = React.memo(function TokenTable({ tokens }: TokenTableProps) {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison function (optional)
  return prevProps.tokens === nextProps.tokens;
});
```

Components to optimize with React.memo:
- `TokenTable.tsx`
- `TransactionsTable.tsx`
- `RecentTransactions.tsx`
- `RecentBlocks.tsx`
- `NetworkMetricsTable.tsx`

### Virtualization for Long Lists

Implement virtualization for long lists using `react-window`:

```tsx
// Before
<div className="transactions-list">
  {transactions.map(tx => (
    <TransactionItem key={tx.id} transaction={tx} />
  ))}
</div>

// After
import { FixedSizeList as List } from 'react-window';

const TransactionRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
  const tx = transactions[index];
  return (
    <div style={style}>
      <TransactionItem transaction={tx} />
    </div>
  );
};

<List
  height={500}
  width="100%"
  itemCount={transactions.length}
  itemSize={80}
  className="transactions-list"
>
  {TransactionRow}
</List>
```

Components to implement virtualization:
- `TransactionsTable.tsx`
- `TokenTable.tsx`
- `TransfersTable.tsx`

### useMemo and useCallback Optimization

Apply useMemo and useCallback to prevent unnecessary re-renders:

```tsx
// Before
const filteredTransactions = transactions.filter(tx => tx.type === selectedType);

const handleTransactionClick = (tx) => {
  setSelectedTransaction(tx);
};

// After
const filteredTransactions = useMemo(() => {
  return transactions.filter(tx => tx.type === selectedType);
}, [transactions, selectedType]);

const handleTransactionClick = useCallback((tx) => {
  setSelectedTransaction(tx);
}, []);
```

## Mobile-Specific Enhancements

### Responsive UI Implementation

Create mobile-specific styles in `/styles/mobile.css`:

```css
/* Mobile-specific styles */
@media (max-width: 768px) {
  .transaction-graph {
    height: 300px; /* Reduced height for mobile */
  }
  
  .data-table {
    font-size: 0.85rem; /* Smaller font for tables */
  }
  
  .card-grid {
    grid-template-columns: 1fr; /* Single column layout */
  }
}
```

### Mobile-Specific Components

Create simplified versions of complex components for mobile:

```tsx
// /components/mobile/SimplifiedTransactionGraph.tsx
import React from 'react';

export function SimplifiedTransactionGraph({ data }: { data: TransactionData }) {
  // Simplified implementation with fewer nodes and animations
  return (
    <div className="simplified-transaction-graph">
      {/* Simplified graph implementation */}
    </div>
  );
}

// Usage with conditional rendering
const isMobile = useMediaQuery('(max-width: 768px)');

{isMobile ? (
  <SimplifiedTransactionGraph data={transactionData} />
) : (
  <TransactionGraph data={transactionData} />
)}
```

Create a `useMediaQuery` hook:

```tsx
// /hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  
  return matches;
}
```

### Touch-Friendly Interactions

Implement touch-friendly interactions for interactive elements:

```tsx
// Add touch event handlers to interactive elements
<div 
  className="interactive-element"
  onClick={handleClick}
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
  style={{ 
    touchAction: 'manipulation', // Prevent browser handling of gestures
  }}
>
  {/* Element content */}
</div>
```

## Network Optimizations

### Data Prefetching Implementation

Implement data prefetching for common operations:

```tsx
// Prefetch transaction data when hovering over a link
const prefetchTransaction = async (signature: string) => {
  try {
    await fetch(`/api/transaction/${signature}`);
  } catch (error) {
    console.error('Error prefetching transaction:', error);
  }
};

<a 
  href={`/tx/${tx.signature}`}
  onMouseEnter={() => prefetchTransaction(tx.signature)}
>
  View Transaction
</a>
```

### Request Batching and Caching

Implement request batching for multiple API calls:

```tsx
// Before: Multiple separate API calls
const fetchAccountData = async () => {
  const accountInfo = await fetch(`/api/account-stats/${address}`).then(res => res.json());
  const tokenInfo = await fetch(`/api/account-token-stats/${address}`).then(res => res.json());
  const transactions = await fetch(`/api/account-transactions/${address}`).then(res => res.json());
  
  setAccountData({ accountInfo, tokenInfo, transactions });
};

// After: Batched API call
const fetchAccountData = async () => {
  const data = await fetch(`/api/account/${address}/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      include: ['stats', 'tokens', 'transactions']
    })
  }).then(res => res.json());
  
  setAccountData(data);
};
```

Create a new batched API endpoint:

```tsx
// /app/api/account/[address]/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params;
  const { include } = await request.json();
  
  const results: Record<string, any> = {};
  
  const fetchPromises = [];
  
  if (include.includes('stats')) {
    fetchPromises.push(
      fetch(`${process.env.API_URL}/account-stats/${address}`)
        .then(res => res.json())
        .then(data => { results.stats = data; })
    );
  }
  
  // Add other data fetching promises
  
  await Promise.all(fetchPromises);
  
  return NextResponse.json(results);
}
```

### Offline Capabilities

Implement service worker for offline capabilities:

```js
// /public/service-worker.js
const CACHE_NAME = 'opensvm-cache-v1';
const urlsToCache = [
  '/',
  '/styles/globals.css',
  '/scripts/main.js',
  '/images/logo.png',
  // Add other static assets
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
```

Register the service worker:

```tsx
// /app/layout.tsx
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }
}, []);
```

## Performance Monitoring

### Real User Monitoring Implementation

Implement real user monitoring:

```tsx
// /lib/performance-monitoring.ts
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return;
  
  // Track core web vitals
  const reportWebVitals = ({ name, delta, id }) => {
    // Send to analytics
    sendToAnalytics({
      metric: name,
      value: delta,
      id
    });
  };
  
  // Track navigation timing
  const trackNavigationTiming = () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      const metrics = {
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpConnection: navigation.connectEnd - navigation.connectStart,
        requestStart: navigation.requestStart,
        responseStart: navigation.responseStart,
        responseEnd: navigation.responseEnd,
        domInteractive: navigation.domInteractive,
        domComplete: navigation.domComplete,
        loadEvent: navigation.loadEventEnd - navigation.loadEventStart,
        totalPageLoad: navigation.loadEventEnd - navigation.startTime
      };
      
      // Send to analytics
      sendToAnalytics({
        metric: 'navigationTiming',
        value: metrics
      });
    }
  };
  
  // Track long tasks
  const trackLongTasks = () => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        // Send long tasks (>50ms) to analytics
        if (entry.duration > 50) {
          sendToAnalytics({
            metric: 'longTask',
            value: entry.duration,
            attribution: entry.attribution
          });
        }
      });
    });
    
    observer.observe({ entryTypes: ['longtask'] });
  };
  
  // Initialize all tracking
  window.addEventListener('load', () => {
    trackNavigationTiming();
    trackLongTasks();
  });
  
  return reportWebVitals;
}

// Helper function to send data to analytics
function sendToAnalytics({ metric, value, id = null, attribution = null }) {
  // Replace with actual analytics implementation
  console.log('Analytics:', { metric, value, id, attribution });
  
  // Example: Send to backend API
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metric, value, id, attribution }),
    // Use beacon API for better reliability when page is unloading
    keepalive: true
  }).catch(console.error);
}
```

## Testing and Validation

### Mobile Device Testing Plan

Create a testing matrix for mobile devices:

| Device | OS | Browser | Screen Size | Tests |
|--------|----|---------| ------------|-------|
| iPhone 12 | iOS 15 | Safari | 390x844 | Core functionality, Performance |
| iPhone SE | iOS 14 | Safari | 375x667 | Core functionality |
| Pixel 5 | Android 12 | Chrome | 393x851 | Core functionality, Performance |
| Galaxy S8 | Android 9 | Chrome | 360x740 | Core functionality |
| iPad | iOS 15 | Safari | 768x1024 | Tablet layout |

### Performance Testing Script

Create a performance testing script:

```js
// /scripts/performance-test.js
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

async function runLighthouseTest(url, options = {}, config = null) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
  });
  
  options.port = chrome.port;
  
  const result = await lighthouse(url, options, config);
  await chrome.kill();
  
  return result;
}

async function testPages() {
  const pages = [
    '/',
    '/tx/some-transaction-id',
    '/address/some-address',
    '/block/123456'
  ];
  
  const results = {};
  
  for (const page of pages) {
    const url = `http://localhost:3000${page}`;
    console.log(`Testing ${url}...`);
    
    // Test mobile performance
    const mobileResult = await runLighthouseTest(url, {
      formFactor: 'mobile',
      throttling: {
        cpuSlowdownMultiplier: 4,
        downloadThroughputKbps: 1600,
        uploadThroughputKbps: 750,
        rttMs: 150
      }
    });
    
    // Test desktop performance
    const desktopResult = await runLighthouseTest(url, {
      formFactor: 'desktop',
      throttling: false
    });
    
    results[page] = {
      mobile: {
        performance: mobileResult.lhr.categories.performance.score * 100,
        fcp: mobileResult.lhr.audits['first-contentful-paint'].numericValue,
        lcp: mobileResult.lhr.audits['largest-contentful-paint'].numericValue,
        tbt: mobileResult.lhr.audits['total-blocking-time'].numericValue,
        cls: mobileResult.lhr.audits['cumulative-layout-shift'].numericValue
      },
      desktop: {
        performance: desktopResult.lhr.categories.performance.score * 100,
        fcp: desktopResult.lhr.audits['first-contentful-paint'].numericValue,
        lcp: desktopResult.lhr.audits['largest-contentful-paint'].numericValue,
        tbt: desktopResult.lhr.audits['total-blocking-time'].numericValue,
        cls: desktopResult.lhr.audits['cumulative-layout-shift'].numericValue
      }
    };
  }
  
  // Save results to file
  fs.writeFileSync(
    path.join(__dirname, '../performance-results.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log('Performance testing complete. Results saved to performance-results.json');
}

testPages().catch(console.error);
```

## Implementation Checklist

- [ ] Conduct performance analysis and benchmarking
- [ ] Implement code splitting in Next.js configuration
- [ ] Convert heavy components to use dynamic imports
- [ ] Optimize images with next/image
- [ ] Apply React.memo to pure components
- [ ] Implement virtualization for long lists
- [ ] Optimize with useMemo and useCallback
- [ ] Create mobile-specific styles
- [ ] Implement simplified mobile components
- [ ] Add touch-friendly interactions
- [ ] Implement data prefetching
- [ ] Create batched API endpoints
- [ ] Add service worker for offline capabilities
- [ ] Implement performance monitoring
- [ ] Conduct mobile device testing
- [ ] Validate performance improvements