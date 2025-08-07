// OpenSVM Service Worker - Offline-First Architecture
// Version 1.0.0

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `opensvm-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `opensvm-dynamic-${CACHE_VERSION}`;
const API_CACHE = `opensvm-api-${CACHE_VERSION}`;
const IMAGES_CACHE = `opensvm-images-${CACHE_VERSION}`;

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

// Resource patterns and their caching strategies
const CACHE_PATTERNS = [
  // Static assets - Cache First
  {
    pattern: /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/,
    strategy: CACHE_STRATEGIES.CACHE_FIRST,
    cache: STATIC_CACHE,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  
  // API data - Network First with fallback
  {
    pattern: /\/api\/(search|blocks|transactions|accounts)/,
    strategy: CACHE_STRATEGIES.NETWORK_FIRST,
    cache: API_CACHE,
    maxAge: 5 * 60 * 1000, // 5 minutes
  },
  
  // Real-time data - Network Only
  {
    pattern: /\/api\/(live|realtime|ws)/,
    strategy: CACHE_STRATEGIES.NETWORK_ONLY,
  },
  
  // Images - Stale While Revalidate
  {
    pattern: /\.(png|jpg|jpeg|gif|webp|svg)$/,
    strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    cache: IMAGES_CACHE,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  
  // HTML pages - Network First
  {
    pattern: /\.(html?)$/,
    strategy: CACHE_STRATEGIES.NETWORK_FIRST,
    cache: DYNAMIC_CACHE,
    maxAge: 60 * 60 * 1000, // 1 hour
  }
];

// Critical resources to precache
const PRECACHE_RESOURCES = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/_next/static/css/',
  '/_next/static/js/',
  '/offline.html'
];

// Background sync tags
const SYNC_TAGS = {
  SEARCH_HISTORY: 'search-history-sync',
  USER_PREFERENCES: 'user-preferences-sync',
  ANALYTICS_DATA: 'analytics-data-sync',
  FORM_SUBMISSIONS: 'form-submissions-sync'
};

// Offline data queue
let offlineQueue = [];

// Service Worker Installation
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching resources');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        console.log('[SW] Precaching completed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Precaching failed:', error);
      })
  );
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.includes('opensvm-') && !cacheName.includes(CACHE_VERSION)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all pages
      self.clients.claim()
    ])
  );
});

// Fetch event handler - Main request interception
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { url, method } = request;
  
  // Only handle GET requests
  if (method !== 'GET') {
    // For non-GET requests, queue them if offline
    if (!navigator.onLine) {
      queueOfflineRequest(request);
    }
    return;
  }
  
  // Skip cross-origin requests
  if (!url.startsWith(self.location.origin)) {
    return;
  }
  
  // Find matching cache pattern
  const pattern = findCachePattern(url);
  
  if (pattern) {
    event.respondWith(handleRequest(request, pattern));
  }
});

// Find the appropriate cache pattern for a URL
function findCachePattern(url) {
  return CACHE_PATTERNS.find(pattern => pattern.pattern.test(url));
}

// Handle request based on caching strategy
async function handleRequest(request, pattern) {
  const { strategy, cache: cacheName, maxAge } = pattern;
  
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      return cacheFirst(request, cacheName, maxAge);
      
    case CACHE_STRATEGIES.NETWORK_FIRST:
      return networkFirst(request, cacheName, maxAge);
      
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      return staleWhileRevalidate(request, cacheName, maxAge);
      
    case CACHE_STRATEGIES.NETWORK_ONLY:
      return networkOnly(request);
      
    case CACHE_STRATEGIES.CACHE_ONLY:
      return cacheOnly(request, cacheName);
      
    default:
      return fetch(request);
  }
}

// Cache First Strategy
async function cacheFirst(request, cacheName, maxAge) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, maxAge)) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache First failed:', error);
    
    // Fallback to cache even if expired
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for HTML requests
    if (request.destination === 'document') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Network First Strategy
async function networkFirst(request, cacheName, maxAge) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Network First failed, trying cache:', error);
    
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Add header to indicate this is from cache
      const response = cachedResponse.clone();
      response.headers.set('X-Served-From', 'cache');
      return response;
    }
    
    // Return offline page for HTML requests
    if (request.destination === 'document') {
      return caches.match('/offline.html');
    }
    
    // Return offline fallback response
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'This content is not available offline',
        timestamp: Date.now()
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Served-From': 'offline-fallback'
        }
      }
    );
  }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Start network request (don't await)
  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.error('[SW] Stale While Revalidate background fetch failed:', error);
    });
  
  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If no cached response, wait for network
  return networkPromise;
}

// Network Only Strategy
async function networkOnly(request) {
  return fetch(request);
}

// Cache Only Strategy
async function cacheOnly(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  throw new Error('Resource not found in cache');
}

// Check if cached response is expired
function isExpired(response, maxAge) {
  if (!maxAge) return false;
  
  const cachedTime = response.headers.get('sw-cached-time');
  if (!cachedTime) return true;
  
  const age = Date.now() - parseInt(cachedTime);
  return age > maxAge;
}

// Add timestamp to cached responses
async function addTimestamp(response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cached-time', Date.now().toString());
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}

// Queue offline requests for background sync
function queueOfflineRequest(request) {
  const requestData = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    timestamp: Date.now(),
    id: generateRequestId()
  };
  
  // Store body if it exists
  if (request.body) {
    request.clone().text().then(body => {
      requestData.body = body;
      offlineQueue.push(requestData);
      storeOfflineQueue();
    });
  } else {
    offlineQueue.push(requestData);
    storeOfflineQueue();
  }
  
  // Register for background sync
  self.registration.sync.register(SYNC_TAGS.FORM_SUBMISSIONS);
}

// Generate unique request ID
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Store offline queue in IndexedDB
async function storeOfflineQueue() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['offline_queue'], 'readwrite');
    const store = transaction.objectStore('offline_queue');
    
    await store.clear();
    
    for (const request of offlineQueue) {
      await store.add(request);
    }
  } catch (error) {
    console.error('[SW] Failed to store offline queue:', error);
  }
}

// Load offline queue from IndexedDB
async function loadOfflineQueue() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['offline_queue'], 'readonly');
    const store = transaction.objectStore('offline_queue');
    
    const requests = await store.getAll();
    offlineQueue = requests || [];
  } catch (error) {
    console.error('[SW] Failed to load offline queue:', error);
  }
}

// Open IndexedDB
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('opensvm-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create offline queue store
      if (!db.objectStoreNames.contains('offline_queue')) {
        const store = db.createObjectStore('offline_queue', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      }
      
      // Create cache metadata store
      if (!db.objectStoreNames.contains('cache_metadata')) {
        const store = db.createObjectStore('cache_metadata', { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  switch (event.tag) {
    case SYNC_TAGS.FORM_SUBMISSIONS:
      event.waitUntil(syncOfflineRequests());
      break;
    case SYNC_TAGS.SEARCH_HISTORY:
      event.waitUntil(syncSearchHistory());
      break;
    case SYNC_TAGS.USER_PREFERENCES:
      event.waitUntil(syncUserPreferences());
      break;
    case SYNC_TAGS.ANALYTICS_DATA:
      event.waitUntil(syncAnalyticsData());
      break;
  }
});

// Sync offline requests when back online
async function syncOfflineRequests() {
  try {
    await loadOfflineQueue();
    
    const syncPromises = offlineQueue.map(async (requestData) => {
      try {
        const { url, method, headers, body } = requestData;
        
        const response = await fetch(url, {
          method,
          headers,
          body: body ? body : undefined
        });
        
        if (response.ok) {
          // Remove successful request from queue
          offlineQueue = offlineQueue.filter(req => req.id !== requestData.id);
          return { success: true, id: requestData.id };
        } else {
          return { success: false, id: requestData.id, error: response.statusText };
        }
      } catch (error) {
        return { success: false, id: requestData.id, error: error.message };
      }
    });
    
    const results = await Promise.allSettled(syncPromises);
    
    // Update offline queue
    await storeOfflineQueue();
    
    // Notify clients about sync results
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        results: results.map(r => r.value)
      });
    });
    
    console.log('[SW] Offline requests sync completed');
  } catch (error) {
    console.error('[SW] Offline requests sync failed:', error);
  }
}

// Sync search history
async function syncSearchHistory() {
  // Implementation for syncing search history
  console.log('[SW] Syncing search history');
}

// Sync user preferences
async function syncUserPreferences() {
  // Implementation for syncing user preferences
  console.log('[SW] Syncing user preferences');
}

// Sync analytics data
async function syncAnalyticsData() {
  // Implementation for syncing analytics data
  console.log('[SW] Syncing analytics data');
}

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  const { data } = event;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ size });
      });
      break;
      
    case 'FORCE_UPDATE':
      forceUpdate();
      break;
  }
});

// Clear all caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames.map(cacheName => {
      if (cacheName.includes('opensvm-')) {
        return caches.delete(cacheName);
      }
    });
    
    await Promise.all(deletePromises);
    console.log('[SW] All caches cleared');
  } catch (error) {
    console.error('[SW] Failed to clear caches:', error);
  }
}

// Get total cache size
async function getCacheSize() {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage,
        available: estimate.quota,
        percentage: (estimate.usage / estimate.quota) * 100
      };
    }
    return { error: 'Storage API not supported' };
  } catch (error) {
    console.error('[SW] Failed to get cache size:', error);
    return { error: error.message };
  }
}

// Force update by clearing caches and reloading
async function forceUpdate() {
  try {
    await clearAllCaches();
    
    // Notify all clients to reload
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'FORCE_RELOAD' });
    });
  } catch (error) {
    console.error('[SW] Force update failed:', error);
  }
}

// Periodic cleanup of expired cache entries
setInterval(async () => {
  try {
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      if (cacheName.includes('opensvm-')) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
          const response = await cache.match(request);
          const pattern = findCachePattern(request.url);
          
          if (pattern && pattern.maxAge && isExpired(response, pattern.maxAge)) {
            await cache.delete(request);
            console.log('[SW] Deleted expired cache entry:', request.url);
          }
        }
      }
    }
  } catch (error) {
    console.error('[SW] Cache cleanup failed:', error);
  }
}, 60 * 60 * 1000); // Run every hour

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const { title, body, icon, badge, tag, actions } = data;
    
    const options = {
      body,
      icon: icon || '/favicon.svg',
      badge: badge || '/favicon.svg',
      tag: tag || 'opensvm-notification',
      actions: actions || [],
      requireInteraction: true,
      data: data
    };
    
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('[SW] Push notification failed:', error);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const { action, data } = event.notification;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              action,
              data
            });
            return;
          }
        }
        
        // Open new window
        return clients.openWindow(data?.url || '/');
      })
  );
});

console.log('[SW] Service Worker loaded successfully');