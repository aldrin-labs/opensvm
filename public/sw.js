// Service Worker for OpenSVM PWA
const CACHE_NAME = 'opensvm-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/index.html',
  '/offline.html',
  '/fonts/BerkeleyMono-Regular.woff2',
  '/fonts/BerkeleyMono-Bold.woff2'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request because it's a one-time use stream
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response because it's a one-time use stream
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                // Don't cache API calls
                if (!event.request.url.includes('/api/')) {
                  cache.put(event.request, responseToCache);
                }
              });
              
            return response;
          }
        ).catch(() => {
          // If fetch fails (e.g., offline), try to serve the offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'referralClaimSync') {
    event.waitUntil(syncReferralClaims());
  }
});

// Function to sync stored referral claims when online
async function syncReferralClaims() {
  try {
    // We need to access client to get/set localStorage since it's not available directly in SW
    const clients = await self.clients.matchAll();
    if (clients.length === 0) return;
    
    // Get the first available client
    const client = clients[0];
    
    // Use a message to request pendingClaims from the client
    const pendingClaimsPromise = new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      // Listen for the response
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      // Send the request to the client
      client.postMessage({
        type: 'GET_PENDING_CLAIMS'
      }, [messageChannel.port2]);
    });
    
    // Wait for the response from the client
    const pendingClaims = await pendingClaimsPromise;
    
    if (!Array.isArray(pendingClaims) || pendingClaims.length === 0) return;
    
    for (const claim of pendingClaims) {
      try {
        const response = await fetch('/api/referrals/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(claim)
        });
        
        if (response.ok) {
          // Send a message to update the pending claims in localStorage
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'UPDATE_PENDING_CLAIMS',
                claim: claim,
                success: true
              });
            });
          });
          
          // Send a message to the client to update the UI if possible
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'CLAIM_SYNCED',
                success: true,
                timestamp: Date.now()
              });
            });
          });
        }
      } catch (error) {
        console.error('Failed to sync claim:', error);
      }
    }
  } catch (error) {
    console.error('Error during claim sync:', error);
  }
}