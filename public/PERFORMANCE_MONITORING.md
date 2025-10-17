# Performance Monitoring & Developer Experience System

## Overview

The OpenSVM Performance Monitoring & Developer Experience System provides comprehensive visibility into application performance, automated regression detection, crash reporting, user analytics, and developer debugging tools. This system is designed to help maintain high performance standards and provide excellent debugging capabilities for developers.

## Architecture

### Core Components

1. **Performance Monitor** (`lib/performance/monitor.ts`)
   - Real-time metrics collection using browser Performance API
   - FPS monitoring, memory tracking, API response time measurement
   - Web Vitals collection (LCP, FID, CLS)
   - Configurable alerting system

2. **Regression Detector** (`lib/performance/regression-detector.ts`)
   - Automated performance regression detection
   - Baseline management with statistical analysis
   - Configurable detection rules with severity levels
   - Historical data retention and cleanup

3. **Structured Logging** (`lib/logging/logger.ts`)
   - Multi-level logging with component tracking
   - Performance metadata integration
   - Export capabilities (JSON, CSV)
   - Real-time log streaming

4. **Error Handling** (`lib/error/error-boundary-service.ts`)
   - React error boundaries with automatic retry
   - Error categorization and severity assessment
   - Crash reporting with breadcrumb tracking

5. **User Analytics** (`lib/analytics/user-interaction-tracker.ts`)
   - Privacy-compliant user interaction tracking
   - Session management and user flow analysis
   - Heatmap data collection

6. **API Enhancement** (`lib/api/`)
   - OpenAPI specification generation
   - Request/response logging middleware
   - Performance monitoring integration

## Getting Started

### 1. Basic Setup

Wrap your application with the `PerformanceProvider`:

```tsx
import { PerformanceProvider } from '@/contexts/PerformanceContext';

function App() {
  return (
    <PerformanceProvider autoStart={true}>
      <YourApplication />
    </PerformanceProvider>
  );
}
```

### 2. Component Performance Tracking

Use the `useComponentPerformance` hook to track component-level metrics:

```tsx
import { useComponentPerformance } from '@/contexts/PerformanceContext';

function MyComponent() {
  const { mountTime, trackEvent, trackCustomMetric } = useComponentPerformance('MyComponent');
  
  const handleClick = () => {
    trackEvent('button-click', { buttonId: 'primary-action' });
    // Your click handler logic
  };
  
  useEffect(() => {
    // Track custom metric
    trackCustomMetric('data-load-time', loadTime);
  }, [loadTime]);
  
  return <div>Component content</div>;
}
```

### 3. API Performance Monitoring

Track API call performance:

```tsx
import { useApiPerformance } from '@/contexts/PerformanceContext';

function useUserData() {
  const { trackApiCall } = useApiPerformance();
  
  const fetchUser = async (id: string) => {
    return trackApiCall(
      () => fetch(`/api/users/${id}`).then(r => r.json()),
      'fetch-user',
      { userId: id }
    );
  };
  
  return { fetchUser };
}
```

### 4. Regression Detection

Monitor for performance regressions:

```tsx
import { useRegressionDetection } from '@/hooks/useRegressionDetection';

function PerformanceDashboard() {
  const { 
    detections, 
    baselines, 
    createBaseline, 
    startDetection,
    getDetectionStats 
  } = useRegressionDetection();
  
  const stats = getDetectionStats();
  
  return (
    <div>
      <h2>Performance Status</h2>
      <p>Total Detections: {stats.totalDetections}</p>
      <p>Critical Issues: {stats.criticalDetections}</p>
      
      <button onClick={() => createBaseline('production', 'v1.2.0')}>
        Create Baseline
      </button>
      <button onClick={startDetection}>
        Start Monitoring
      </button>
    </div>
  );
}
```

## Configuration

### Performance Monitor Configuration

```tsx
const performanceConfig = {
  collectionInterval: 1000,     // Metrics collection interval (ms)
  maxDataPoints: 1000,         // Maximum stored data points
  enableWebVitals: true,       // Enable Web Vitals collection
  enableMemoryMonitoring: true, // Enable memory monitoring
  alertThresholds: {
    fps: { min: 30, critical: 15 },
    memory: { max: 500000000, critical: 1000000000 }, // bytes
    apiResponseTime: { max: 2000, critical: 5000 }   // ms
  }
};

<PerformanceProvider config={performanceConfig}>
  <App />
</PerformanceProvider>
```

### Regression Detection Configuration

```tsx
import { regressionDetector } from '@/lib/performance/regression-detector';

regressionDetector.updateConfig({
  baselineRetentionDays: 30,
  minSampleSizeForBaseline: 100,
  detectionIntervalMs: 60000,
  rules: [
    {
      metric: 'fps',
      threshold: 10,              // 10% FPS drop triggers alert
      consecutiveFailures: 3,     // Must fail 3 times consecutively
      severity: 'medium',
      enabled: true
    }
    // Add more rules as needed
  ]
});
```

### Logging Configuration

```tsx
import { logger } from '@/lib/logging/logger';

// Configure logging levels and retention
logger.setLevel('info');
logger.setMaxEntries(5000);

// Enable/disable specific log types
logger.setConfig({
  enablePerformanceLogs: true,
  enableApiLogs: true,
  enableErrorLogs: true,
  enableUserInteractionLogs: false // Set to false in production for privacy
});
```

## Developer Tools

### Debug Panel

Access the debug panel in development mode:

```tsx
import { DebugPanel } from '@/components/debug/DebugPanel';
import { useState } from 'react';

function DevTools() {
  const [debugOpen, setDebugOpen] = useState(false);
  
  // Show only in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <>
      <button onClick={() => setDebugOpen(true)}>
        Open Debug Panel
      </button>
      <DebugPanel isOpen={debugOpen} onClose={() => setDebugOpen(false)} />
    </>
  );
}
```

The debug panel includes:
- **Logs Tab**: Real-time application logs with filtering
- **Performance Tab**: Current metrics and alerts
- **Regression Tab**: Regression detection status and baselines
- **API Tab**: API call monitoring and caching status
- **State Tab**: Application state inspection

### Performance Overlays

Add performance overlays to components during development:

```tsx
import { GraphPerformanceOverlay } from '@/components/debug/GraphPerformanceOverlay';

function GraphComponent() {
  const [showOverlay, setShowOverlay] = useState(process.env.NODE_ENV === 'development');
  
  return (
    <div>
      {showOverlay && (
        <GraphPerformanceOverlay 
          componentName="GraphComponent"
          trackRenderTime={true}
          trackMemoryUsage={true}
        />
      )}
      <YourGraphContent />
    </div>
  );
}
```

## API Integration

### OpenAPI Documentation

The system automatically generates OpenAPI specifications:

```tsx
import { generateOpenAPISpec } from '@/lib/api/openapi-generator';

// Generate API documentation
const spec = generateOpenAPISpec({
  title: 'OpenSVM API',
  version: '1.0.0',
  baseUrl: 'https://api.opensvm.com'
});

// Serve at /api/docs
export default function handler(req, res) {
  res.json(spec);
}
```

### Request/Response Logging

Add middleware to log API requests:

```tsx
import { createRequestLogger } from '@/lib/api/request-logger';

// Next.js middleware
export const middleware = createRequestLogger({
  enableRequestLogging: true,
  enableResponseLogging: true,
  sanitizeHeaders: ['authorization', 'cookie'],
  maxBodySize: 1024 * 10 // 10KB
});
```

## Error Handling & Crash Reporting

### Error Boundaries

Wrap components with error boundaries:

```tsx
import { EnhancedErrorBoundary } from '@/components/error/EnhancedErrorBoundary';

function App() {
  return (
    <EnhancedErrorBoundary
      fallback={<ErrorFallback />}
      enableRetry={true}
      maxRetries={3}
      onError={(error, errorInfo) => {
        // Custom error handling
        console.error('Application error:', error);
      }}
    >
      <YourApplication />
    </EnhancedErrorBoundary>
  );
}
```

### Crash Reporting

The system automatically reports crashes, but you can also manually report:

```tsx
import { crashReporter } from '@/lib/crash/crash-reporter';

try {
  riskyOperation();
} catch (error) {
  crashReporter.reportError(error, {
    context: 'manual-report',
    userId: 'user123',
    additionalData: { operation: 'riskyOperation' }
  });
  throw error; // Re-throw if needed
}
```

## User Analytics

### Interaction Tracking

Track user interactions while respecting privacy:

```tsx
import { useInteractionTracking } from '@/contexts/PerformanceContext';

function InteractiveComponent() {
  const { trackClick, trackInput, trackNavigation } = useInteractionTracking();
  
  const handleButtonClick = () => {
    trackClick('primary-button', { 
      section: 'header',
      campaign: 'signup' 
    });
    // Button logic
  };
  
  const handleInputChange = (value: string) => {
    trackInput('search-field', { 
      query_length: value.length,
      has_filters: hasActiveFilters 
    });
    // Input logic
  };
  
  return (
    <div>
      <button onClick={handleButtonClick}>Sign Up</button>
      <input onChange={(e) => handleInputChange(e.target.value)} />
    </div>
  );
}
```

## Best Practices

### Performance

1. **Sampling**: Use sampling in production to reduce overhead:
   ```tsx
   const config = {
     samplingRate: 0.1, // Sample 10% of users
     enableInProduction: process.env.NODE_ENV === 'production'
   };
   ```

2. **Lazy Loading**: Load monitoring components only when needed:
   ```tsx
   const DebugPanel = lazy(() => import('@/components/debug/DebugPanel'));
   ```

3. **Memory Management**: Clean up monitoring when components unmount:
   ```tsx
   useEffect(() => {
     return () => {
       // Cleanup is handled automatically by hooks
     };
   }, []);
   ```

### Security

1. **Data Sanitization**: Always sanitize sensitive data in logs:
   ```tsx
   logger.info('User action', {
     userId: user.id, // OK
     email: '[REDACTED]', // Don't log PII
     action: 'login'
   });
   ```

2. **Environment Checks**: Disable detailed logging in production:
   ```tsx
   const enableDetailedLogs = process.env.NODE_ENV === 'development';
   ```

### Privacy

1. **User Consent**: Only track interactions with user consent:
   ```tsx
   const { hasAnalyticsConsent } = usePrivacyConsent();
   
   if (hasAnalyticsConsent) {
     trackUserInteraction(interaction);
   }
   ```

2. **Data Retention**: Configure appropriate data retention periods:
   ```tsx
   const config = {
     logRetentionDays: 7,     // Keep logs for 7 days
     metricsRetentionDays: 30, // Keep metrics for 30 days
     crashRetentionDays: 90   // Keep crash data for 90 days
   };
   ```

## Monitoring in Production

### Key Metrics to Watch

1. **Performance Metrics**:
   - Average FPS > 30
   - 95th percentile API response time < 2s
   - Memory usage growth over time
   - Core Web Vitals scores

2. **Error Metrics**:
   - Error rate < 1%
   - Crash frequency
   - Error types and patterns

3. **User Experience**:
   - User interaction patterns
   - Session duration
   - Feature adoption rates

### Alerting

Set up alerts for critical thresholds:

```tsx
const alertConfig = {
  criticalFpsThreshold: 15,    // Alert if FPS drops below 15
  criticalMemoryThreshold: 1000000000, // Alert if memory > 1GB
  errorRateThreshold: 0.05,    // Alert if error rate > 5%
  regressionThreshold: 20      // Alert if performance degrades > 20%
};
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Check for memory leaks in performance monitoring
2. **Excessive Logging**: Reduce log levels or increase cleanup intervals  
3. **Performance Impact**: Increase collection intervals or enable sampling
4. **Missing Metrics**: Verify PerformanceProvider is properly configured

### Debug Commands

Use the browser console for debugging:

```javascript
// Access global performance monitor
window.__OPENSVM_MONITOR__.getMetrics();
window.__OPENSVM_MONITOR__.getAlerts();

// Access regression detector
window.__OPENSVM_REGRESSION__.getBaselines();
window.__OPENSVM_REGRESSION__.getDetections();

// Access logger
window.__OPENSVM_LOGGER__.getLogs();
window.__OPENSVM_LOGGER__.exportLogs('json');
```

## Migration Guide

### From Basic Monitoring

If you're migrating from a basic monitoring setup:

1. Replace basic performance calls with the comprehensive system
2. Update error handling to use error boundaries
3. Migrate logging to the structured logging system
4. Set up regression detection baselines

### Version Updates

When updating the monitoring system:

1. Check configuration compatibility
2. Update baseline data if needed
3. Review alert thresholds
4. Test in staging environment first

---

For more detailed information, see the API documentation and individual component docs in the `/docs` directory.