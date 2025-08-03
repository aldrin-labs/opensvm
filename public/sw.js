// Service Worker for Graph Navigation Performance Optimization
// Version: 1.0.0

const CACHE_NAME = 'graph-navigation-v1';
const RUNTIME_CACHE = 'graph-runtime-v1';
const GRAPH_DATA_CACHE = 'graph-data-v1';

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// URLs to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html'
];

// Graph API endpoints that should be cached
const GRAPH_API_PATTERNS = [
  /\/api\/graph\/chunk\/.*/,
  /\/api\/account\/.*/,
  /\/api\/analytics\/.*/
];

// Configuration from ScalabilityManager
let scalabilityConfig = {
  cacheStrategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  backgroundSyncEnabled: true,
  offlinePageEnabled: true
};

// Background sync queue
const syncQueue = [];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== RUNTIME_CACHE && 
                cacheName !== GRAPH_DATA_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('Service Worker activation failed:', error);
      })
  );
});

/**
 * Fetch event - handle network requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Skip WebSocket and EventSource requests
  if (request.headers.get('upgrade') === 'websocket' || 
      request.headers.get('accept') === 'text/event-stream') {
    return;
  }
  
  // Handle different types of requests
  if (isGraphDataRequest(url.pathname)) {
    event.respondWith(handleGraphDataRequest(request));
  } else if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAssetRequest(request));
  } else if (isApiRequest(url.pathname)) {
    event.respondWith(handleApiRequest(request));
  } else {
    event.respondWith(handleGenericRequest(request));
  }
});

/**
 * Message event - handle communication with main thread
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'CONFIGURE_SCALABILITY':
      scalabilityConfig = { ...scalabilityConfig, ...payload };
      console.log('Scalability config updated:', scalabilityConfig);
      break;
      
    case 'CACHE_GRAPH_DATA':
      handleCacheGraphData(payload);
      break;
      
    case 'CLEAR_CACHE':
      handleClearCache(payload);
      break;
      
    case 'GET_CACHE_STATUS':
      handleGetCacheStatus(event);
      break;
      
    case 'SYNC_DATA':
      if (scalabilityConfig.backgroundSyncEnabled) {
        handleBackgroundSync(payload);
      }
      break;
  }
});

/**
 * Background sync event
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'graph-data-sync') {
    event.waitUntil(processBackgroundSync());
  }
});

/**
 * Handle graph data requests with optimized caching
 */
async function handleGraphDataRequest(request) {
  const cacheName = GRAPH_DATA_CACHE;
  
  try {
    switch (scalabilityConfig.cacheStrategy) {
      case CACHE_STRATEGIES.CACHE_FIRST:
        return await cacheFirst(request, cacheName);
        
      case CACHE_STRATEGIES.NETWORK_FIRST:
        return await networkFirst(request, cacheName);
        
      case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      default:
        return await staleWhileRevalidate(request, cacheName);
    }
  } catch (error) {
    console.error('Graph data request failed:', error);
    return new Response(
      JSON.stringify({ error: 'Graph data unavailable' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Handle static asset requests
 */
async function handleStaticAssetRequest(request) {
  return await cacheFirst(request, CACHE_NAME);
}

/**
 * Handle API requests
 */
async function handleApiRequest(request) {
  return await networkFirst(request, RUNTIME_CACHE);
}

/**
 * Handle generic requests
 */
async function handleGenericRequest(request) {
  try {
    // Try network first for HTML pages
    if (request.headers.get('accept').includes('text/html')) {
      return await networkFirst(request, RUNTIME_CACHE);
    }
    
    // For other resources, use stale-while-revalidate
    return await staleWhileRevalidate(request, RUNTIME_CACHE);
  } catch (error) {
    // Fallback to offline page for navigation requests
    if (request.mode === 'navigate' && scalabilityConfig.offlinePageEnabled) {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match('/offline.html');
    }
    
    throw error;
  }
}

/**
 * Cache-first strategy
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    await cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

/**
 * Network-first strategy
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Stale-while-revalidate strategy
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Always fetch in background to update cache
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.warn('Background fetch failed:', error);
    });
  
  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If no cache, wait for network
  return await fetchPromise;
}

/**
 * Cache graph data manually
 */
async function handleCacheGraphData(payload) {
  const { url, data } = payload;
  
  try {
    const cache = await caches.open(GRAPH_DATA_CACHE);
    const response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300' // 5 minutes
      }
    });
    
    await cache.put(url, response);
    
    // Notify main thread
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'CACHE_UPDATE',
          payload: { url, cached: true }
        });
      });
    });
  } catch (error) {
    console.error('Failed to cache graph data:', error);
  }
}

/**
 * Clear cache
 */
async function handleClearCache(payload) {
  const { cacheNames } = payload;
  
  try {
    if (cacheNames && cacheNames.length > 0) {
      // Clear specific caches
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    } else {
      // Clear all caches
      const allCacheNames = await caches.keys();
      for (const cacheName of allCacheNames) {
        await caches.delete(cacheName);
      }
    }
    
    // Notify main thread
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'CACHE_CLEARED',
          payload: { cacheNames: cacheNames || 'all' }
        });
      });
    });
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Get cache status
 */
async function handleGetCacheStatus(event) {
  try {
    const cacheNames = await caches.keys();
    const cacheStatus = {};
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      cacheStatus[cacheName] = keys.length;
    }
    
    event.ports[0].postMessage({
      type: 'CACHE_STATUS',
      payload: cacheStatus
    });
  } catch (error) {
    console.error('Failed to get cache status:', error);
  }
}

/**
 * Handle background sync
 */
async function handleBackgroundSync(payload) {
  syncQueue.push(payload);
  
  try {
    await self.registration.sync.register('graph-data-sync');
  } catch (error) {
    console.error('Background sync registration failed:', error);
    // Fallback to immediate processing
    processBackgroundSync();
  }
}

/**
 * Process background sync queue
 */
async function processBackgroundSync() {
  while (syncQueue.length > 0) {
    const task = syncQueue.shift();
    
    try {
      switch (task.type) {
        case 'SYNC_GRAPH_DATA':
          await syncGraphData(task.payload);
          break;
          
        case 'SYNC_ANALYTICS':
          await syncAnalytics(task.payload);
          break;
          
        default:
          console.warn('Unknown sync task type:', task.type);
      }
    } catch (error) {
      console.error('Background sync task failed:', error);
      // Re-queue task for retry
      syncQueue.push(task);
    }
  }
  
  // Notify main thread
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        payload: { completed: true }
      });
    });
  });
}

/**
 * Sync graph data in background
 */
async function syncGraphData(payload) {
  const { endpoint, data } = payload;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Sync analytics data in background
 */
async function syncAnalytics(payload) {
  const { events } = payload;
  
  for (const event of events) {
    const response = await fetch('/api/analytics/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
    
    if (!response.ok) {
      console.warn('Analytics sync failed for event:', event);
    }
  }
}

/**
 * Cache size management
 */
async function manageCacheSize() {
  const maxSize = scalabilityConfig.maxCacheSize;
  
  for (const cacheName of [GRAPH_DATA_CACHE, RUNTIME_CACHE]) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length === 0) continue;
    
    // Estimate cache size (rough approximation)
    let estimatedSize = 0;
    const sampleSize = Math.min(keys.length, 10);
    
    for (let i = 0; i < sampleSize; i++) {
      const response = await cache.match(keys[i]);
      if (response) {
        const text = await response.clone().text();
        estimatedSize += text.length;
      }
    }
    
    const avgEntrySize = estimatedSize / sampleSize;
    const totalEstimatedSize = avgEntrySize * keys.length;
    
    if (totalEstimatedSize > maxSize) {
      // Remove oldest entries (FIFO)
      const entriesToRemove = Math.ceil((totalEstimatedSize - maxSize) / avgEntrySize);
      
      for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
        await cache.delete(keys[i]);
      }
      
      console.log(`Removed ${entriesToRemove} entries from ${cacheName} cache`);
    }
  }
}

/**
 * Utility functions
 */
function isGraphDataRequest(pathname) {
  return GRAPH_API_PATTERNS.some(pattern => pattern.test(pathname));
}

function isStaticAsset(pathname) {
  return pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/);
}

function isApiRequest(pathname) {
  return pathname.startsWith('/api/');
}

// Periodic cache management
setInterval(manageCacheSize, 5 * 60 * 1000); // Every 5 minutes

console.log('Service Worker loaded');