// Web Vitals monitoring script
(function() {
  // Check if the web-vitals API is supported
  if ('performance' in window && 'PerformanceObserver' in window) {
    // Create a variable to store the metrics
    let metrics = {};
    
    // Function to send metrics to analytics
    function sendToAnalytics(metric) {
      // Store the metric
      metrics[metric.name] = metric.value;
      
      // Log the metric to console in development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`Web Vitals: ${metric.name} = ${metric.value}`);
      }
      
      // Send the metric to your analytics service
      // This is a placeholder - replace with your actual analytics code
      if (window.gtag) {
        window.gtag('event', 'web_vitals', {
          event_category: 'Web Vitals',
          event_label: metric.name,
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          non_interaction: true,
        });
      }
    }
    
    // Load the web-vitals library
    import('https://unpkg.com/web-vitals@3/dist/web-vitals.attribution.iife.js')
      .then(({ onCLS, onFID, onLCP, onTTFB, onINP }) => {
        // Core Web Vitals
        onCLS(sendToAnalytics);
        onFID(sendToAnalytics);
        onLCP(sendToAnalytics);
        
        // Additional metrics
        onTTFB(sendToAnalytics);
        onINP(sendToAnalytics);
      })
      .catch(err => console.error('Error loading web-vitals', err));
    
    // Report metrics when the page is being unloaded
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Use the beacon API to send the data
        if (navigator.sendBeacon && Object.keys(metrics).length > 0) {
          navigator.sendBeacon(
            '/api/vitals',
            JSON.stringify({
              url: window.location.href,
              metrics,
              userAgent: navigator.userAgent,
              timestamp: Date.now(),
            })
          );
        }
      }
    });
    
    // Custom performance mark for time to interactive
    if ('mark' in performance) {
      // Mark when the page starts loading
      performance.mark('app-start');
      
      // Mark when the page is interactive
      window.addEventListener('load', () => {
        setTimeout(() => {
          performance.mark('app-interactive');
          performance.measure('time-to-interactive', 'app-start', 'app-interactive');
          
          const tti = performance.getEntriesByName('time-to-interactive')[0];
          sendToAnalytics({
            name: 'TTI',
            value: tti.duration,
          });
        }, 0);
      });
    }
  }
})();