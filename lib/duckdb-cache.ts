/**
 * DuckDB Client-Side Cache Utility
 * 
 * Provides a DuckDB-powered caching layer for client-side data persistence
 * and efficient querying without requiring additional network requests.
 */

import { AsyncDuckDB, DuckDBConfig, selectBundle } from '@duckdb/duckdb-wasm';

// Cache expiration time (24 hours)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

// Interface for cached items with expiration
interface CachedItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Cache tables structure
interface CacheSchema {
  feed_events: {
    id: string;
    eventType: string;
    timestamp: number;
    userAddress: string;
    content: string;
    likes: number;
    hasLiked: boolean;
    walletAddress: string; // The profile owner's wallet address
    feedType: string; // 'for-you' or 'following'
    metadata: string; // JSON string
  };
  cache_metadata: {
    key: string;
    lastUpdated: number;
    expiresAt: number;
  };
}

// Singleton instance
let db: AsyncDuckDB | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the DuckDB instance and create necessary tables
 */
export async function initDuckDB(): Promise<AsyncDuckDB> {
  if (db) return db;
  
  if (isInitializing) {
    return initPromise!.then(() => db!);
  }
  
  isInitializing = true;
  
  initPromise = (async () => {
    try {
      // Select appropriate WebAssembly bundle
      const bundle = await selectBundle({
        mvp: {
          mainModule: '/duckdb-mvp.wasm',
          mainWorker: '/duckdb-browser-mvp.worker.js',
        },
        eh: {
          mainModule: '/duckdb-eh.wasm',
          mainWorker: '/duckdb-browser-eh.worker.js',
        },
      });
      
      // Create new database instance
      const logger = {
        log: (entry: any) => {
          console.log('[DuckDB]', entry);
        }
      };
      
      // Create worker from URL if available
      const worker = bundle.mainWorker ? new Worker(bundle.mainWorker) : null;
      
      db = new AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule);
      
      console.log('DuckDB initialized successfully');
      
      // Create tables for caching
      const conn = await db.connect();
      
      // Feed events table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS feed_events (
          id VARCHAR PRIMARY KEY,
          eventType VARCHAR,
          timestamp BIGINT,
          userAddress VARCHAR,
          content VARCHAR,
          likes INTEGER,
          hasLiked BOOLEAN,
          walletAddress VARCHAR,
          feedType VARCHAR,
          metadata VARCHAR
        )
      `);
      
      // Cache metadata table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS cache_metadata (
          key VARCHAR PRIMARY KEY,
          lastUpdated BIGINT,
          expiresAt BIGINT
        )
      `);
      
      // Create indexes for faster querying
      await conn.query(`CREATE INDEX IF NOT EXISTS idx_events_wallet ON feed_events(walletAddress)`);
      await conn.query(`CREATE INDEX IF NOT EXISTS idx_events_feedtype ON feed_events(feedType)`);
      
      await conn.close();
    } catch (error) {
      console.error('Failed to initialize DuckDB:', error);
      db = null;
      throw error;
    } finally {
      isInitializing = false;
    }
  })();
  
  await initPromise;
  return db!;
}

/**
 * Check if cache is valid for the given key
 */
export async function isCacheValid(key: string): Promise<boolean> {
  try {
    const db = await initDuckDB();
    const conn = await db.connect();
    
    const result = await conn.query(`
      SELECT * FROM cache_metadata 
      WHERE key = '${key}' AND expiresAt > ${Date.now()}
    `);
    
    await conn.close();
    return result.toArray().length > 0;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
}

/**
 * Cache feed events for a specific wallet and feed type
 */
export async function cacheFeedEvents(
  walletAddress: string, 
  feedType: string, 
  events: any[],
  filters?: Record<string, any>
): Promise<void> {
  if (!events || events.length === 0) return;
  
  try {
    const db = await initDuckDB();
    const conn = await db.connect();
    
    // Generate a unique cache key based on parameters
    const filterStr = filters ? JSON.stringify(filters) : '';
    const cacheKey = `feed_${walletAddress}_${feedType}_${filterStr}`;
    
    // Begin transaction
    await conn.query('BEGIN TRANSACTION');
    
    // Delete existing events for this wallet/feed type if they exist
    await conn.query(`
      DELETE FROM feed_events
      WHERE walletAddress = '${walletAddress}' AND feedType = '${feedType}'
    `);
    
    // Insert new events
    for (const event of events) {
      const metadata = event.metadata ? JSON.stringify(event.metadata) : '{}';
      
      await conn.query(`
        INSERT INTO feed_events
        (id, eventType, timestamp, userAddress, content, likes, hasLiked, walletAddress, feedType, metadata)
        VALUES
        ('${event.id}', 
         '${event.eventType}', 
         ${event.timestamp}, 
         '${event.userAddress}', 
         '${event.content.replace(/'/g, "''")}', 
         ${event.likes}, 
         ${event.hasLiked}, 
         '${walletAddress}', 
         '${feedType}', 
         '${metadata.replace(/'/g, "''")}')
      `);
    }
    
    // Update cache metadata
    const now = Date.now();
    const expiresAt = now + CACHE_EXPIRATION;
    
    await conn.query(`
      INSERT OR REPLACE INTO cache_metadata (key, lastUpdated, expiresAt)
      VALUES ('${cacheKey}', ${now}, ${expiresAt})
    `);
    
    // Commit transaction
    await conn.query('COMMIT');
    await conn.close();
    
    console.log(`Cached ${events.length} events for ${walletAddress}/${feedType}`);
  } catch (error) {
    console.error('Error caching feed events:', error);
    
    // Try to rollback transaction if error occurs
    try {
      const conn = await (await initDuckDB()).connect();
      await conn.query('ROLLBACK');
      await conn.close();
    } catch (e) {
      // Ignore rollback errors
    }
  }
}

/**
 * Get cached feed events for a specific wallet and feed type
 */
export async function getCachedFeedEvents(
  walletAddress: string, 
  feedType: string,
  filters?: Record<string, any>
): Promise<any[] | null> {
  try {
    const db = await initDuckDB();
    const conn = await db.connect();
    
    // Generate cache key for checking validity
    const filterStr = filters ? JSON.stringify(filters) : '';
    const cacheKey = `feed_${walletAddress}_${feedType}_${filterStr}`;
    
    // Check cache validity as part of the main query to avoid race condition
    let validityQuery = `
      SELECT COUNT(*) as valid_count FROM cache_metadata
      WHERE key = '${cacheKey}' AND expiresAt > ${Date.now()}
    `;
    
    const validityResult = await conn.query(validityQuery);
    const isValid = validityResult.toArray()[0].valid_count > 0;
    
    if (!isValid) {
      await conn.close();
      return null;
    }
    
    // Build query based on filters
    let query = `
      SELECT * FROM feed_events
      WHERE walletAddress = '${walletAddress}' AND feedType = '${feedType}'
    `;
    
    // Apply filters if provided
    if (filters) {
      if (filters.eventTypes && filters.eventTypes.length > 0) {
        const typeList = filters.eventTypes.map((t: string) => `'${t}'`).join(',');
        query += ` AND eventType IN (${typeList})`;
      }
      
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
        
        query += ` AND timestamp >= ${timeThreshold}`;
      }
      
      // Apply sort order
      if (filters.sortOrder === 'popular') {
        query += ` ORDER BY likes DESC`;
      } else { // default to newest
        query += ` ORDER BY timestamp DESC`;
      }
    } else {
      // Default sort by timestamp
      query += ` ORDER BY timestamp DESC`;
    }
    
    // Execute query
    const result = await conn.query(query);
    const events = result.toArray();
    
    // Parse metadata JSON for each event
    const parsedEvents = events.map(event => ({
      ...event,
      metadata: event.metadata ? JSON.parse(event.metadata) : {},
    }));
    
    await conn.close();
    
    console.log(`Retrieved ${parsedEvents.length} cached events for ${walletAddress}/${feedType}`);
    return parsedEvents;
  } catch (error) {
    console.error('Error retrieving cached feed events:', error);
    return null;
  }
}

/**
 * Update a specific event in the cache (e.g., likes count)
 */
export async function updateCachedEvent(
  eventId: string,
  updates: Partial<CacheSchema['feed_events']>
): Promise<boolean> {
  try {
    const db = await initDuckDB();
    const conn = await db.connect();
    
    // Check if event exists
    const checkResult = await conn.query(`
      SELECT id FROM feed_events WHERE id = '${eventId}'
    `);
    
    if (checkResult.toArray().length === 0) {
      await conn.close();
      return false;
    }
    
    // Build update query
    const updateFields = Object.entries(updates)
      .filter(([key]) => key !== 'id') // Don't update ID
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return `${key} = '${value.replace(/'/g, "''")}'`;
        } else if (value === null) {
          return `${key} = NULL`;
        } else if (typeof value === 'object') {
          return `${key} = '${JSON.stringify(value).replace(/'/g, "''")}'`;
        } else {
          return `${key} = ${value}`;
        }
      })
      .join(', ');
    
    if (!updateFields) {
      await conn.close();
      return false;
    }
    
    // Execute update
    await conn.query(`
      UPDATE feed_events
      SET ${updateFields}
      WHERE id = '${eventId}'
    `);
    
    await conn.close();
    return true;
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
  event: any
): Promise<boolean> {
  try {
    const db = await initDuckDB();
    const conn = await db.connect();
    
    const metadata = event.metadata ? JSON.stringify(event.metadata) : '{}';
    
    // Insert the new event
    await conn.query(`
      INSERT OR REPLACE INTO feed_events
      (id, eventType, timestamp, userAddress, content, likes, hasLiked, walletAddress, feedType, metadata)
      VALUES
      ('${event.id}', 
       '${event.eventType}', 
       ${event.timestamp}, 
       '${event.userAddress}', 
       '${event.content.replace(/'/g, "''")}', 
       ${event.likes}, 
       ${event.hasLiked}, 
       '${walletAddress}', 
       '${feedType}', 
       '${metadata.replace(/'/g, "''")}')
    `);
    
    await conn.close();
    return true;
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
    const db = await initDuckDB();
    const conn = await db.connect();
    
    // Begin transaction
    await conn.query('BEGIN TRANSACTION');
    
    if (walletAddress && feedType) {
      // Clear specific cache
      await conn.query(`
        DELETE FROM feed_events
        WHERE walletAddress = '${walletAddress}' AND feedType = '${feedType}'
      `);
      
      // Delete related cache metadata
      await conn.query(`
        DELETE FROM cache_metadata
        WHERE key LIKE 'feed_${walletAddress}_${feedType}%'
      `);
    } else if (walletAddress) {
      // Clear all caches for a specific wallet
      await conn.query(`
        DELETE FROM feed_events
        WHERE walletAddress = '${walletAddress}'
      `);
      
      // Delete related cache metadata
      await conn.query(`
        DELETE FROM cache_metadata
        WHERE key LIKE 'feed_${walletAddress}_%'
      `);
    } else {
      // Clear all caches
      await conn.query('DELETE FROM feed_events');
      await conn.query('DELETE FROM cache_metadata');
    }
    
    // Commit transaction
    await conn.query('COMMIT');
    await conn.close();
    
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    
    // Try to rollback transaction if error occurs
    try {
      const conn = await (await initDuckDB()).connect();
      await conn.query('ROLLBACK');
      await conn.close();
    } catch (e) {
      // Ignore rollback errors
    }
    
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
  memoryUsageEstimate: number;
}> {
  try {
    const db = await initDuckDB();
    const conn = await db.connect();
    
    const eventCountResult = await conn.query('SELECT COUNT(*) as count FROM feed_events');
    const cacheEntriesResult = await conn.query('SELECT COUNT(*) as count FROM cache_metadata');
    const oldestEntryResult = await conn.query('SELECT MIN(lastUpdated) as oldest FROM cache_metadata');
    const newestEntryResult = await conn.query('SELECT MAX(lastUpdated) as newest FROM cache_metadata');
    
    const eventCount = eventCountResult.toArray()[0].count;
    const cacheEntries = cacheEntriesResult.toArray()[0].count;
    const oldestEntry = oldestEntryResult.toArray()[0].oldest || Date.now();
    const newestEntry = newestEntryResult.toArray()[0].newest || Date.now();
    
    // Rough estimate of memory usage (in bytes)
    // Assuming average event size of approximately 1KB
    const memoryUsageEstimate = eventCount * 1024;
    
    await conn.close();
    
    return {
      eventCount,
      cacheEntries,
      oldestEntry,
      newestEntry,
      memoryUsageEstimate
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      eventCount: 0,
      cacheEntries: 0,
      oldestEntry: Date.now(),
      newestEntry: Date.now(),
      memoryUsageEstimate: 0
    };
  }
}