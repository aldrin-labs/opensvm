// Service Worker Registration Script for OpenSVM
// Handles registration, updates, and communication with the service worker

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    SW_URL: '/sw.js',
    SW_SCOPE: '/',
    UPDATE_CHECK_INTERVAL: 60 * 60 * 1000, // 1 hour
    RETRY_DELAY: 5000, // 5 seconds
    MAX_RETRIES: 3
  };

  // State tracking
  let registration = null;
  let retryCount = 0;
  let updateCheckInterval = null;

  // Utility functions
  function log(message, ...args) {
    console.log('[SW Registration]', message, ...args);
  }

  function error(message, ...args) {
    console.error('[SW Registration]', message, ...args);
  }

  function dispatchEvent(eventName, detail = {}) {
    window.dispatchEvent(new CustomEvent(`sw:${eventName}`, { detail }));
  }

  // Check if service workers are supported
  function isServiceWorkerSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // Check if we should register the service worker
  function shouldRegisterServiceWorker() {
    // Don't register in development unless explicitly enabled
    if (window.location.hostname === 'localhost' && !window.SW_DEV_MODE) {
      return false;
    }
    
    // Don't register if explicitly disabled
    if (window.SW_DISABLED) {
      return false;
    }
    
    return isServiceWorkerSupported();
  }

  // Register the service worker
  async function registerServiceWorker() {
    try {
      log('Registering service worker...');
      
      registration = await navigator.serviceWorker.register(CONFIG.SW_URL, {
        scope: CONFIG.SW_SCOPE,
        updateViaCache: 'none' // Always check for updates
      });
      
      log('Service worker registered successfully:', registration.scope);
      
      // Handle different registration states
      if (registration.installing) {
        log('Service worker installing...');
        trackInstalling(registration.installing);
      } else if (registration.waiting) {
        log('Service worker waiting...');
        handleWaiting(registration.waiting);
      } else if (registration.active) {
        log('Service worker active');
        handleActive(registration.active);
      }
      
      // Listen for updates
      registration.addEventListener('updatefound', handleUpdateFound);
      
      // Set up periodic update checks
      setupUpdateChecks();
      
      // Dispatch registration success event
      dispatchEvent('registered', { registration });
      
      retryCount = 0; // Reset retry count on successful registration
      
    } catch (err) {
      error('Service worker registration failed:', err);
      
      // Retry registration
      if (retryCount < CONFIG.MAX_RETRIES) {
        retryCount++;
        log(`Retrying registration in ${CONFIG.RETRY_DELAY}ms (attempt ${retryCount}/${CONFIG.MAX_RETRIES})`);
        setTimeout(registerServiceWorker, CONFIG.RETRY_DELAY);
      } else {
        error('Max registration retries exceeded');
        dispatchEvent('registrationFailed', { error: err });
      }
    }
  }

  // Track service worker installation
  function trackInstalling(worker) {
    worker.addEventListener('statechange', () => {
      log('Service worker state changed:', worker.state);
      
      if (worker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // New service worker installed, update available
          log('New service worker installed, update available');
          dispatchEvent('updateAvailable', { worker });
        } else {
          // First time installation
          log('Service worker installed for the first time');
          dispatchEvent('installed', { worker });
        }
      }
    });
  }

  // Handle waiting service worker
  function handleWaiting(worker) {
    dispatchEvent('updateAvailable', { worker });
  }

  // Handle active service worker
  function handleActive(worker) {
    dispatchEvent('active', { worker });
    
    // Set up message channel
    setupMessageChannel();
  }

  // Handle service worker updates
  function handleUpdateFound() {
    const newWorker = registration.installing;
    log('New service worker found, installing...');
    
    trackInstalling(newWorker);
  }

  // Set up periodic update checks
  function setupUpdateChecks() {
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
    }
    
    updateCheckInterval = setInterval(async () => {
      try {
        log('Checking for service worker updates...');
        await registration.update();
      } catch (err) {
        error('Update check failed:', err);
      }
    }, CONFIG.UPDATE_CHECK_INTERVAL);
  }

  // Set up message channel with service worker
  function setupMessageChannel() {
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { data } = event;
      log('Message from service worker:', data);
      
      switch (data.type) {
        case 'SYNC_COMPLETE':
          dispatchEvent('syncComplete', data);
          break;
        case 'FORCE_RELOAD':
          log('Force reload requested by service worker');
          window.location.reload();
          break;
        case 'NOTIFICATION_CLICK':
          dispatchEvent('notificationClick', data);
          break;
        default:
          dispatchEvent('message', data);
      }
    });
    
    // Send initial message to establish connection
    sendMessageToSW({ type: 'CLIENT_READY' });
  }

  // Send message to service worker
  function sendMessageToSW(message) {
    return new Promise((resolve, reject) => {
      if (!registration || !registration.active) {
        reject(new Error('Service worker not active'));
        return;
      }
      
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      messageChannel.port1.onerror = (error) => {
        reject(error);
      };
      
      registration.active.postMessage(message, [messageChannel.port2]);
    });
  }

  // Skip waiting service worker
  async function skipWaiting() {
    try {
      if (registration && registration.waiting) {
        log('Skipping waiting service worker...');
        await sendMessageToSW({ type: 'SKIP_WAITING' });
        
        // Wait for the new service worker to take control
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        });
        
        dispatchEvent('updated');
      }
    } catch (err) {
      error('Skip waiting failed:', err);
    }
  }

  // Get cache information
  async function getCacheInfo() {
    try {
      const version = await sendMessageToSW({ type: 'GET_VERSION' });
      const size = await sendMessageToSW({ type: 'GET_CACHE_SIZE' });
      
      return {
        version: version.version,
        size: size.size
      };
    } catch (err) {
      error('Failed to get cache info:', err);
      return null;
    }
  }

  // Clear all caches
  async function clearCache() {
    try {
      log('Clearing service worker cache...');
      await sendMessageToSW({ type: 'CLEAR_CACHE' });
      dispatchEvent('cacheCleared');
    } catch (err) {
      error('Failed to clear cache:', err);
    }
  }

  // Force update application
  async function forceUpdate() {
    try {
      log('Forcing application update...');
      await sendMessageToSW({ type: 'FORCE_UPDATE' });
    } catch (err) {
      error('Failed to force update:', err);
    }
  }

  // Check online status
  function isOnline() {
    return navigator.onLine;
  }

  // Handle online/offline events
  function setupNetworkListeners() {
    window.addEventListener('online', () => {
      log('Network: online');
      dispatchEvent('online');
    });
    
    window.addEventListener('offline', () => {
      log('Network: offline');
      dispatchEvent('offline');
    });
    
    // Dispatch initial state
    dispatchEvent(isOnline() ? 'online' : 'offline');
  }

  // Unregister service worker
  async function unregisterServiceWorker() {
    try {
      if (registration) {
        log('Unregistering service worker...');
        const success = await registration.unregister();
        
        if (success) {
          log('Service worker unregistered successfully');
          dispatchEvent('unregistered');
          
          // Clear intervals
          if (updateCheckInterval) {
            clearInterval(updateCheckInterval);
            updateCheckInterval = null;
          }
          
          registration = null;
        } else {
          error('Failed to unregister service worker');
        }
        
        return success;
      }
    } catch (err) {
      error('Service worker unregistration failed:', err);
      return false;
    }
  }

  // Public API
  window.swController = {
    register: registerServiceWorker,
    unregister: unregisterServiceWorker,
    skipWaiting,
    getCacheInfo,
    clearCache,
    forceUpdate,
    isOnline,
    isSupported: isServiceWorkerSupported,
    getRegistration: () => registration,
    sendMessage: sendMessageToSW
  };

  // Initialize when DOM is ready
  function initialize() {
    log('Initializing service worker registration...');
    
    // Set up network listeners
    setupNetworkListeners();
    
    // Register service worker if supported and enabled
    if (shouldRegisterServiceWorker()) {
      // Small delay to avoid blocking initial page load
      setTimeout(registerServiceWorker, 100);
    } else {
      log('Service worker registration skipped');
      
      if (!isServiceWorkerSupported()) {
        dispatchEvent('notSupported');
      } else {
        dispatchEvent('disabled');
      }
    }
  }

  // Auto-initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Handle page visibility changes for update checks
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && registration) {
      // Check for updates when page becomes visible
      registration.update().catch(err => {
        error('Visibility update check failed:', err);
      });
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
    }
  });

})();