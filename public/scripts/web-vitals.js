// Optimized Web Vitals monitoring script - minimal implementation
(function() {
  // Only run in production and if the browser supports the necessary APIs
  if (!('PerformanceObserver' in window)) return;
  
  // Minimal metrics storage
  const metrics = {};
  
  // Simplified analytics sender
  function sendMetric(name, value, attribution) {
    metrics[name] = value;
    
    // Only log in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log(`Web Vitals: ${name} = ${value}`);
    }
    
    // Send to analytics if available
    if (window.gtag) {
      window.gtag('event', 'web_vitals', {
        event_category: 'Web Vitals',
        event_label: name,
        value: Math.round(name === 'CLS' ? value * 1000 : value),
        non_interaction: true,
      });
    }
  }
  
  // Minimal CLS implementation
  let clsValue = 0;
  let clsEntries = [];
  
  // Create a CLS observer
  try {
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        // Only count layout shifts without recent user input
        if (!entry.hadRecentInput) {
          clsEntries.push(entry);
          // Only keep the 5 most recent entries
          if (clsEntries.length > 5) {
            clsEntries.shift();
          }
          // Update CLS value
          clsValue = clsEntries.reduce((sum, entry) => sum + entry.value, 0);
          sendMetric('CLS', clsValue);
        }
      }
    }).observe({type: 'layout-shift', buffered: true});
  } catch (e) {
    // Silently fail if observer throws
  }
  
  // Minimal LCP implementation
  try {
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      sendMetric('LCP', lastEntry.startTime + lastEntry.duration);
    }).observe({type: 'largest-contentful-paint', buffered: true});
  } catch (e) {
    // Silently fail if observer throws
  }
  
  // Minimal FID implementation
  try {
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        sendMetric('FID', entry.processingStart - entry.startTime);
      }
    }).observe({type: 'first-input', buffered: true});
  } catch (e) {
    // Silently fail if observer throws
  }
  
  // Send metrics on page unload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && Object.keys(metrics).length > 0) {
      // Use the beacon API to send the data
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/vitals',
          JSON.stringify({
            url: window.location.href,
            metrics,
            timestamp: Date.now(),
          })
        );
      }
    }
  }, {passive: true});
  
  // Mark page load time
  if ('mark' in performance) {
    performance.mark('app-start');
    window.addEventListener('load', () => {
      performance.mark('app-loaded');
      performance.measure('load-time', 'app-start', 'app-loaded');
      const loadTime = performance.getEntriesByName('load-time')[0];
      sendMetric('LoadTime', loadTime.duration);
    }, {passive: true, once: true});
  }
})();