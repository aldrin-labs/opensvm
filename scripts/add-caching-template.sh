#!/bin/bash

# Template for adding caching to routes
# This shows the pattern to add to each route

cat << 'EOF'
// Add these constants at the top of the file (after imports)
const cache = new Map<string, { 
  data: any;
  timestamp: number;
}>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_REFRESH_THRESHOLD = 60 * 1000; // 1 minute
const ongoingUpdates = new Set<string>();

// Add background update function
async function updateCacheInBackground(key: string, fetchFn: () => Promise<any>) {
  if (ongoingUpdates.has(key)) {
    console.log(`Background update already in progress for ${key}`);
    return;
  }

  ongoingUpdates.add(key);
  console.log(`Starting background cache update for ${key}`);

  try {
    const freshData = await fetchFn();
    cache.set(key, {
      data: freshData,
      timestamp: Date.now()
    });
    console.log(`Background cache update completed for ${key}`);
  } catch (error) {
    console.error(`Background cache update failed for ${key}:`, error);
  } finally {
    ongoingUpdates.delete(key);
  }
}

// In your GET handler, add cache check:
const cacheKey = `your-route-${param}`;
const cached = cache.get(cacheKey);
const now = Date.now();

if (cached) {
  const cacheAge = now - cached.timestamp;
  
  if (cacheAge < CACHE_DURATION) {
    if (cacheAge > CACHE_REFRESH_THRESHOLD) {
      console.log(`Cache is ${Math.round(cacheAge / 1000)}s old, triggering background refresh`);
      updateCacheInBackground(cacheKey, async () => {
        // Your data fetching logic here
        return fetchData();
      }).catch(err => console.error('Background update error:', err));
    }
    
    console.log(`Returning cached data (age: ${Math.round(cacheAge / 1000)}s)`);
    return NextResponse.json({
      ...cached.data,
      cached: true,
      cacheAge: Math.round(cacheAge / 1000)
    });
  }
}

// Fetch fresh data if no cache or expired
const data = await fetchData();

// Cache the results
cache.set(cacheKey, {
  data,
  timestamp: now
});

return NextResponse.json(data);
EOF
