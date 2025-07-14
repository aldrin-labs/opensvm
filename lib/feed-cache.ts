/**
 * Feed Cache Utility
 * 
 * Provides browser-based caching for feed data using IndexedDB
 * to reduce network requests and improve performance.
 */

// Cache expiration time (24 hours)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

// Interface for event data
export interface FeedEvent {
  id: string;
  eventType: 'transaction' | 'visit' | 'like' | 'follow' | 'other';
  timestamp: number;
  userAddress: string;
  userName?: string;
  userAvatar?: string;
  content: string;
  targetAddress?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  likes: number;
  hasLiked: boolean;
}

// Interface for filters
export interface FeedFilters {
  eventTypes?: string[];
  dateRange?: 'today' | 'week' | 'month' | 'all';
  sortOrder?: 'newest' | 'popular';
  searchQuery?: string;
}

// Interface for cached items with expiration
interface CachedItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Database configuration
const DB_NAME = 'feed-cache-db';
const DB_VERSION = 1;
const EVENTS_STORE = 'feed-events';
const METADATA_STORE = 'cache-metadata';

/**
 * Open the IndexedDB database
 */
async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('Failed to open database:', event);
      reject(new Error('Failed to open IndexedDB database'));
    };
    
    request.onsuccess = (event) => {
      const db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Create event store with index on wallet address
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const eventStore = db.createObjectStore(EVENTS_STORE, { keyPath: 'id' });
        eventStore.createIndex('walletAddress', 'walletAddress', { unique: false });
        eventStore.createIndex('feedType', 'feedType', { unique: false });
        eventStore.createIndex('walletFeed', ['walletAddress', 'feedType'], { unique: false });
      }
      
      // Create metadata store
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Check if cache is valid for the given key
 */
export async function isCacheValid(key: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(METADATA_STORE, 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const metadata = request.result;
        const isValid = metadata && metadata.expiresAt > Date.now();
        resolve(!!isValid);
      };
      
      request.onerror = () => {
        console.error('Error checking cache validity');
        resolve(false);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
}

/**
 * Generate a cache key based on parameters
 */
function generateCacheKey(
  walletAddress: string,
  feedType: string,
  filters?: FeedFilters
): string {
  const filterStr = filters ? JSON.stringify(filters) : '';
  return `feed_${walletAddress}_${feedType}_${filterStr}`;
}

/**
 * Cache feed events for a specific wallet and feed type
 */
export async function cacheFeedEvents(
  walletAddress: string,
  feedType: string,
  events: FeedEvent[],
  filters?: FeedFilters
): Promise<void> {
  if (!events || events.length === 0) return;
  
  try {
    const db = await openDatabase();
    const transaction = db.transaction([EVENTS_STORE, METADATA_STORE], 'readwrite');
    const eventStore = transaction.objectStore(EVENTS_STORE);
    const metadataStore = transaction.objectStore(METADATA_STORE);
    
    // Delete existing events for this wallet/feed type
    const index = eventStore.index('walletFeed');
    const existingEvents = index.getAll([walletAddress, feedType]);
    
    existingEvents.onsuccess = () => {
      // Delete existing events
      existingEvents.result.forEach((event) => {
        eventStore.delete(event.id);
      });
      
      // Store new events
      events.forEach((event) => {
        // Add wallet and feed type info to each event
        const eventToStore = {
          ...event,
          walletAddress,
          feedType
        };
        eventStore.put(eventToStore);
      });
      
      // Update cache metadata
      const now = Date.now();
      const expiresAt = now + CACHE_EXPIRATION;
      const cacheKey = generateCacheKey(walletAddress, feedType, filters);
      
      metadataStore.put({
        key: cacheKey,
        lastUpdated: now,
        expiresAt
      });
    };
    
    transaction.oncomplete = () => {
      console.log(`Cached ${events.length} events for ${walletAddress}/${feedType}`);
      db.close();
    };
    
    transaction.onerror = (error) => {
      console.error('Error caching feed events:', error);
      db.close();
    };
  } catch (error) {
    console.error('Error caching feed events:', error);
  }
}

/**
 * Apply filters to events
 */
function applyFilters(events: FeedEvent[], filters?: FeedFilters): FeedEvent[] {
  if (!filters) return events;
  
  let filteredEvents = [...events];
  
  // Filter by event type
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    filteredEvents = filteredEvents.filter(event => 
      filters.eventTypes!.includes(event.eventType)
    );
  }
  
  // Filter by date range
  if (filters.dateRange && filters.dateRange !== 'all') {
    const now = Date.now();
    let timeThreshold = now;
    
    if (filters.dateRange === 'today') {
      timeThreshold = new Date().setHours(0, 0, 0, 0);
    } else if (filters.dateRange === 'week') {
      timeThreshold = now - 7 * 24 * 60 * 60 * 1000;
    } else if (filters.dateRange === 'month') {
      timeThreshold = now - 30 * 24 * 60 * 60 * 1000;
    }
    
    filteredEvents = filteredEvents.filter(event => event.timestamp >= timeThreshold);
  }
  
  // Sort by specified order
  if (filters.sortOrder === 'popular') {
    filteredEvents.sort((a, b) => b.likes - a.likes);
  } else {
    // Default to newest
    filteredEvents.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  // Apply search query if specified
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredEvents = filteredEvents.filter(event => 
      event.content.toLowerCase().includes(query) || 
      (event.userName && event.userName.toLowerCase().includes(query)) ||
      event.eventType.toLowerCase().includes(query) ||
      event.userAddress.toLowerCase().includes(query)
    );
  }
  
  return filteredEvents;
}

/**
 * Get cached feed events for a specific wallet and feed type
 */
export async function getCachedFeedEvents(
  walletAddress: string,
  feedType: string,
  filters?: FeedFilters
): Promise<FeedEvent[] | null> {
  try {
    const db = await openDatabase();
    const cacheKey = generateCacheKey(walletAddress, feedType, filters);
    
    // Check cache validity and get events in single transaction to avoid race condition
    return new Promise((resolve) => {
      const transaction = db.transaction([EVENTS_STORE, METADATA_STORE], 'readonly');
      const eventStore = transaction.objectStore(EVENTS_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);
      
      // First check if cache is valid
      const metadataRequest = metadataStore.get(cacheKey);
      
      metadataRequest.onsuccess = () => {
        const metadata = metadataRequest.result;
        const isValid = metadata && metadata.expiresAt > Date.now();
        
        if (!isValid) {
          resolve(null);
          return;
        }
        
        // Cache is valid, get events
        const index = eventStore.index('walletFeed');
        const eventsRequest = index.getAll([walletAddress, feedType]);
        
        eventsRequest.onsuccess = () => {
          const events = eventsRequest.result;
          const filteredEvents = applyFilters(events, filters);
          resolve(filteredEvents);
        };
        
        eventsRequest.onerror = () => {
          console.error('Error retrieving cached events');
          resolve(null);
        };
      };
      
      metadataRequest.onerror = () => {
        console.error('Error checking cache metadata');
        resolve(null);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error retrieving cached feed events:', error);
    return null;
  }
}

/**
 * Update a specific event in the cache
 */
export async function updateCachedEvent(
  eventId: string,
  updates: Partial<FeedEvent>
): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(EVENTS_STORE, 'readwrite');
    const store = transaction.objectStore(EVENTS_STORE);
    
    return new Promise((resolve) => {
      // Get current event
      const getRequest = store.get(eventId);
      
      getRequest.onsuccess = () => {
        const event = getRequest.result;
        if (!event) {
          resolve(false);
          return;
        }
        
        // Update event with new values
        const updatedEvent = {
          ...event,
          ...updates
        };
        
        // Save updated event
        const putRequest = store.put(updatedEvent);
        
        putRequest.onsuccess = () => {
          resolve(true);
        };
        
        putRequest.onerror = () => {
          console.error('Error updating cached event');
          resolve(false);
        };
      };
      
      getRequest.onerror = () => {
        console.error('Error retrieving event for update');
        resolve(false);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error updating cached event:', error);
    return false;
  }
}

/**
 * Add a new event to the cache
 */
export async function addEventToCache(
  walletAddress: string,
  feedType: string,
  event: FeedEvent
): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(EVENTS_STORE, 'readwrite');
    const store = transaction.objectStore(EVENTS_STORE);
    
    return new Promise((resolve) => {
      // Add wallet and feed type to event
      const eventToStore = {
        ...event,
        walletAddress,
        feedType
      };
      
      const request = store.put(eventToStore);
      
      request.onsuccess = () => {
        resolve(true);
      };
      
      request.onerror = () => {
        console.error('Error adding event to cache');
        resolve(false);
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error adding event to cache:', error);
    return false;
  }
}

/**
 * Clear all cached data or specific cache entries
 */
export async function clearCache(
  walletAddress?: string,
  feedType?: string
): Promise<boolean> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([EVENTS_STORE, METADATA_STORE], 'readwrite');
    const eventStore = transaction.objectStore(EVENTS_STORE);
    const metadataStore = transaction.objectStore(METADATA_STORE);
    
    return new Promise((resolve) => {
      if (walletAddress && feedType) {
        // Clear specific wallet/feed type
        const index = eventStore.index('walletFeed');
        const request = index.getAll([walletAddress, feedType]);
        
        request.onsuccess = () => {
          const events = request.result;
          
          // Delete each event
          events.forEach(event => {
            eventStore.delete(event.id);
          });
          
          // Delete related metadata
          const metadataRequest = metadataStore.openCursor();
          
          metadataRequest.onsuccess = (event) => {
            const cursor = metadataRequest.result;
            if (cursor) {
              const key = cursor.value.key;
              if (key.startsWith(`feed_${walletAddress}_${feedType}`)) {
                metadataStore.delete(key);
              }
              cursor.continue();
            }
          };
        };
      } else if (walletAddress) {
        // Clear all for wallet
        const index = eventStore.index('walletAddress');
        const request = index.getAll(walletAddress);
        
        request.onsuccess = () => {
          const events = request.result;
          
          // Delete each event
          events.forEach(event => {
            eventStore.delete(event.id);
          });
          
          // Delete related metadata
          const metadataRequest = metadataStore.openCursor();
          
          metadataRequest.onsuccess = (event) => {
            const cursor = metadataRequest.result;
            if (cursor) {
              const key = cursor.value.key;
              if (key.startsWith(`feed_${walletAddress}_`)) {
                metadataStore.delete(key);
              }
              cursor.continue();
            }
          };
        };
      } else {
        // Clear all
        eventStore.clear();
        metadataStore.clear();
      }
      
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };
      
      transaction.onerror = () => {
        console.error('Error clearing cache');
        db.close();
        resolve(false);
      };
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  eventCount: number;
  cacheEntries: number;
  oldestEntry: number;
  newestEntry: number;
}> {
  try {
    const db = await openDatabase();
    
    const eventsPromise = new Promise<number>((resolve) => {
      const transaction = db.transaction(EVENTS_STORE, 'readonly');
      const store = transaction.objectStore(EVENTS_STORE);
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        resolve(countRequest.result);
      };
      
      countRequest.onerror = () => {
        resolve(0);
      };
    });
    
    const metadataPromise = new Promise<{
      count: number;
      oldest: number;
      newest: number;
    }>((resolve) => {
      const transaction = db.transaction(METADATA_STORE, 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const metadata = request.result;
        const count = metadata.length;
        
        if (count === 0) {
          resolve({
            count: 0,
            oldest: Date.now(),
            newest: Date.now()
          });
          return;
        }
        
        const timestamps = metadata.map(entry => entry.lastUpdated);
        const oldest = Math.min(...timestamps);
        const newest = Math.max(...timestamps);
        
        resolve({
          count,
          oldest,
          newest
        });
      };
      
      request.onerror = () => {
        resolve({
          count: 0,
          oldest: Date.now(),
          newest: Date.now()
        });
      };
    });
    
    const [eventCount, metadataStats] = await Promise.all([eventsPromise, metadataPromise]);
    
    db.close();
    
    return {
      eventCount,
      cacheEntries: metadataStats.count,
      oldestEntry: metadataStats.oldest,
      newestEntry: metadataStats.newest
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      eventCount: 0,
      cacheEntries: 0,
      oldestEntry: Date.now(),
      newestEntry: Date.now()
    };
  }
}