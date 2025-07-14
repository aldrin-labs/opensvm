/**
 * Client-side DuckDB WASM Cache Manager for OpenSVM
 * 
 * Provides high-performance local caching for blockchain data using DuckDB WASM
 * with automatic cache-first data retrieval and intelligent eviction policies.
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import { generateSecureUUID } from '@/lib/crypto-utils';

// Type definitions for DuckDB result objects
interface DuckDBRow {
  data?: Uint8Array;
  compressed?: boolean;
  ttl?: number;
  timestamp?: number;
  entry_count?: number;
  total_size?: number;
  oldest_entry?: number;
  newest_entry?: number;
  total_entries?: number;
  [key: string]: any;
}

export interface CacheEntry {
  id: string;
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  size: number;
  accessed: number;
  hitCount: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheConfig {
  maxSizeBytes: number;
  defaultTtlMs: number;
  maxEntries: number;
  enableCompression: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
}

export class DuckDBCacheManager {
  private static instance: DuckDBCacheManager | null = null;
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initialized = false;
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSizeBytes: 100 * 1024 * 1024, // 100MB default
      defaultTtlMs: 30 * 60 * 1000, // 30 minutes default
      maxEntries: 10000,
      enableCompression: true,
      evictionPolicy: 'lru',
      ...config
    };
  }

  public static getInstance(config?: Partial<CacheConfig>): DuckDBCacheManager {
    if (!DuckDBCacheManager.instance) {
      DuckDBCacheManager.instance = new DuckDBCacheManager(config);
    }
    return DuckDBCacheManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize DuckDB WASM
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      const worker = await duckdb.createWorker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);

      // Create connection
      this.conn = await this.db.connect();

      // Set up cache tables
      await this.createCacheTables();
      
      // Set up periodic cleanup
      this.setupPeriodicCleanup();

      this.initialized = true;
      console.log('DuckDB Cache Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DuckDB Cache Manager:', error);
      throw error;
    }
  }

  private async createCacheTables(): Promise<void> {
    if (!this.conn) throw new Error('Database not initialized');

    // Main cache table
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        id VARCHAR PRIMARY KEY,
        cache_key VARCHAR NOT NULL,
        data BLOB NOT NULL,
        timestamp BIGINT NOT NULL,
        ttl BIGINT NOT NULL,
        size_bytes INTEGER NOT NULL,
        last_accessed BIGINT NOT NULL,
        hit_count INTEGER DEFAULT 0,
        compressed BOOLEAN DEFAULT false
      )
    `);

    // Index for fast lookups
    await this.conn.query(`
      CREATE INDEX IF NOT EXISTS idx_cache_key ON cache_entries(cache_key)
    `);

    await this.conn.query(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON cache_entries(timestamp)
    `);

    await this.conn.query(`
      CREATE INDEX IF NOT EXISTS idx_last_accessed ON cache_entries(last_accessed)
    `);

    // Blockchain-specific tables for structured caching
    await this.createBlockchainTables();
  }

  private async createBlockchainTables(): Promise<void> {
    if (!this.conn) throw new Error('Database not initialized');

    // Transactions cache
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS cached_transactions (
        signature VARCHAR PRIMARY KEY,
        slot BIGINT,
        block_time BIGINT,
        fee BIGINT,
        success BOOLEAN,
        logs TEXT[],
        accounts VARCHAR[],
        programs VARCHAR[],
        cached_at BIGINT NOT NULL,
        data BLOB NOT NULL
      )
    `);

    // Blocks cache
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS cached_blocks (
        slot BIGINT PRIMARY KEY,
        blockhash VARCHAR,
        parent_slot BIGINT,
        block_time BIGINT,
        transaction_count INTEGER,
        cached_at BIGINT NOT NULL,
        data BLOB NOT NULL
      )
    `);

    // Accounts cache
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS cached_accounts (
        address VARCHAR PRIMARY KEY,
        owner VARCHAR,
        lamports BIGINT,
        executable BOOLEAN,
        rent_epoch BIGINT,
        last_updated BIGINT NOT NULL,
        data BLOB NOT NULL
      )
    `);

    // Token data cache
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS cached_tokens (
        mint VARCHAR PRIMARY KEY,
        symbol VARCHAR,
        name VARCHAR,
        decimals INTEGER,
        supply BIGINT,
        cached_at BIGINT NOT NULL,
        data BLOB NOT NULL
      )
    `);

    console.log('Blockchain cache tables created successfully');
  }

  // Generic cache operations
  public async get<T>(key: string): Promise<T | null> {
    if (!this.conn) {
      await this.initialize();
    }

    try {
      const result = await this.conn!.query(`
        SELECT data, compressed, ttl, timestamp
        FROM cache_entries
        WHERE cache_key = '${key.replace(/'/g, "''")}' AND (timestamp + ttl) > ${Date.now()}
      `);

      if (result.numRows === 0) {
        this.stats.misses++;
        return null;
      }

      // Update access statistics
      await this.conn!.query(`
        UPDATE cache_entries
        SET last_accessed = ${Date.now()}, hit_count = hit_count + 1
        WHERE cache_key = '${key.replace(/'/g, "''")}'
      `);

      this.stats.hits++;

      const row = result.get(0) as DuckDBRow | null;
      if (!row) {
        this.stats.misses++;
        return null;
      }

      const dataBlob = row.data;
      const isCompressed = row.compressed;

      if (!dataBlob) {
        this.stats.misses++;
        return null;
      }

      // Decompress if needed and parse
      let data;
      if (isCompressed) {
        data = await this.decompress(dataBlob);
      } else {
        data = JSON.parse(new TextDecoder().decode(dataBlob));
      }

      return data as T;
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  public async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    if (!this.conn) {
      await this.initialize();
    }

    try {
      const ttl = ttlMs || this.config.defaultTtlMs;
      const serialized = JSON.stringify(data);
      const size = new TextEncoder().encode(serialized).length;

      // Check if we need to evict entries
      await this.enforceSize();

      let dataBlob: Uint8Array;
      let compressed = false;

      if (this.config.enableCompression && size > 1024) {
        dataBlob = await this.compress(serialized);
        compressed = true;
      } else {
        dataBlob = new TextEncoder().encode(serialized);
      }

      const id = generateSecureUUID();
      const now = Date.now();

      // Upsert cache entry
      await this.conn!.query(`
        INSERT OR REPLACE INTO cache_entries
        (id, cache_key, data, timestamp, ttl, size_bytes, last_accessed, hit_count, compressed)
        VALUES ('${id}', '${key.replace(/'/g, "''")}', '${Buffer.from(dataBlob).toString('base64')}', ${now}, ${ttl}, ${dataBlob.length}, ${now}, 0, ${compressed})
      `);

    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  public async delete(key: string): Promise<void> {
    if (!this.conn) return;

    try {
      await this.conn.query(`DELETE FROM cache_entries WHERE cache_key = '${key.replace(/'/g, "''")}'`);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  public async clear(): Promise<void> {
    if (!this.conn) return;

    try {
      await this.conn.query(`DELETE FROM cache_entries`);
      await this.conn.query(`DELETE FROM cached_transactions`);
      await this.conn.query(`DELETE FROM cached_blocks`);
      await this.conn.query(`DELETE FROM cached_accounts`);
      await this.conn.query(`DELETE FROM cached_tokens`);
      
      this.stats = { hits: 0, misses: 0, evictions: 0 };
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  // Blockchain-specific cache methods
  public async getTransaction(signature: string): Promise<any | null> {
    if (!this.conn) await this.initialize();

    try {
      const result = await this.conn!.query(`
        SELECT data FROM cached_transactions
        WHERE signature = '${signature.replace(/'/g, "''")}' AND cached_at > ${Date.now() - this.config.defaultTtlMs}
      `);

      if (result.numRows === 0) return null;

      const row = result.get(0) as DuckDBRow | null;
      if (!row || !row.data) return null;
      
      const dataBlob = row.data;
      return JSON.parse(new TextDecoder().decode(dataBlob));
    } catch (error) {
      console.error('Transaction cache error:', error);
      return null;
    }
  }

  public async setTransaction(signature: string, transaction: any): Promise<void> {
    if (!this.conn) await this.initialize();

    try {
      const data = new TextEncoder().encode(JSON.stringify(transaction));
      const now = Date.now();

      const logs = JSON.stringify(transaction.meta?.logMessages || []);
      const accounts = JSON.stringify(transaction.transaction?.message?.accountKeys || []);
      const programs = JSON.stringify([]);
      const dataBase64 = Buffer.from(data).toString('base64');
      
      await this.conn!.query(`
        INSERT OR REPLACE INTO cached_transactions
        (signature, slot, block_time, fee, success, logs, accounts, programs, cached_at, data)
        VALUES ('${signature.replace(/'/g, "''")}', ${transaction.slot || 0}, ${transaction.blockTime || 0}, ${transaction.meta?.fee || 0}, ${!transaction.meta?.err}, '${logs.replace(/'/g, "''")}', '${accounts.replace(/'/g, "''")}', '${programs}', ${now}, '${dataBase64}')
      `);
    } catch (error) {
      console.error('Set transaction cache error:', error);
    }
  }

  public async getBlock(slot: number): Promise<any | null> {
    if (!this.conn) await this.initialize();

    try {
      const result = await this.conn!.query(`
        SELECT data FROM cached_blocks
        WHERE slot = ${slot} AND cached_at > ${Date.now() - this.config.defaultTtlMs}
      `);

      if (result.numRows === 0) return null;

      const row = result.get(0) as DuckDBRow | null;
      if (!row || !row.data) return null;
      
      const dataBlob = row.data;
      return JSON.parse(new TextDecoder().decode(dataBlob));
    } catch (error) {
      console.error('Block cache error:', error);
      return null;
    }
  }

  public async setBlock(slot: number, block: any): Promise<void> {
    if (!this.conn) await this.initialize();

    try {
      const data = new TextEncoder().encode(JSON.stringify(block));
      const now = Date.now();

      const dataBase64 = Buffer.from(data).toString('base64');
      const blockhash = (block.blockhash || '').replace(/'/g, "''");
      
      await this.conn!.query(`
        INSERT OR REPLACE INTO cached_blocks
        (slot, blockhash, parent_slot, block_time, transaction_count, cached_at, data)
        VALUES (${slot}, '${blockhash}', ${block.parentSlot || 0}, ${block.blockTime || 0}, ${block.transactions?.length || 0}, ${now}, '${dataBase64}')
      `);
    } catch (error) {
      console.error('Set block cache error:', error);
    }
  }

  public async getAccount(address: string): Promise<any | null> {
    if (!this.conn) await this.initialize();

    try {
      const result = await this.conn!.query(`
        SELECT data FROM cached_accounts
        WHERE address = '${address.replace(/'/g, "''")}' AND last_updated > ${Date.now() - (5 * 60 * 1000)}
      `); // 5 minute TTL for accounts

      if (result.numRows === 0) return null;

      const row = result.get(0) as DuckDBRow | null;
      if (!row || !row.data) return null;
      
      const dataBlob = row.data;
      return JSON.parse(new TextDecoder().decode(dataBlob));
    } catch (error) {
      console.error('Account cache error:', error);
      return null;
    }
  }

  public async setAccount(address: string, account: any): Promise<void> {
    if (!this.conn) await this.initialize();

    try {
      const data = new TextEncoder().encode(JSON.stringify(account));
      const now = Date.now();

      const dataBase64 = Buffer.from(data).toString('base64');
      const owner = (account.owner || '').replace(/'/g, "''");
      
      await this.conn!.query(`
        INSERT OR REPLACE INTO cached_accounts
        (address, owner, lamports, executable, rent_epoch, last_updated, data)
        VALUES ('${address.replace(/'/g, "''")}', '${owner}', ${account.lamports || 0}, ${account.executable || false}, ${account.rentEpoch || 0}, ${now}, '${dataBase64}')
      `);
    } catch (error) {
      console.error('Set account cache error:', error);
    }
  }

  // Cache management
  private async enforceSize(): Promise<void> {
    if (!this.conn) return;

    try {
      // Check current size and entry count
      const sizeResult = await this.conn.query(`
        SELECT COUNT(*) as entry_count, SUM(size_bytes) as total_size 
        FROM cache_entries
      `);

      const row = sizeResult.get(0) as DuckDBRow | null;
      if (!row) return;
      
      const entry_count = row.entry_count || 0;
      const total_size = row.total_size || 0;

      if (total_size > this.config.maxSizeBytes || entry_count > this.config.maxEntries) {
        await this.evictEntries();
      }
    } catch (error) {
      console.error('Size enforcement error:', error);
    }
  }

  private async evictEntries(): Promise<void> {
    if (!this.conn) return;

    try {
      let evictionQuery = '';
      const entriesToEvict = Math.floor(this.config.maxEntries * 0.1); // Evict 10%

      switch (this.config.evictionPolicy) {
        case 'lru':
          evictionQuery = `
            DELETE FROM cache_entries 
            WHERE id IN (
              SELECT id FROM cache_entries 
              ORDER BY last_accessed ASC 
              LIMIT ${entriesToEvict}
            )
          `;
          break;
        case 'lfu':
          evictionQuery = `
            DELETE FROM cache_entries 
            WHERE id IN (
              SELECT id FROM cache_entries 
              ORDER BY hit_count ASC, last_accessed ASC 
              LIMIT ${entriesToEvict}
            )
          `;
          break;
        case 'ttl':
          evictionQuery = `
            DELETE FROM cache_entries 
            WHERE (timestamp + ttl) < ? OR id IN (
              SELECT id FROM cache_entries 
              ORDER BY timestamp ASC 
              LIMIT ${entriesToEvict}
            )
          `;
          break;
      }

      if (this.config.evictionPolicy === 'ttl') {
        evictionQuery = evictionQuery.replace('?', Date.now().toString());
      }
      await this.conn.query(evictionQuery);
      this.stats.evictions++;
    } catch (error) {
      console.error('Eviction error:', error);
    }
  }

  private setupPeriodicCleanup(): void {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private async cleanup(): Promise<void> {
    if (!this.conn) return;

    try {
      // Remove expired entries
      await this.conn.query(`
        DELETE FROM cache_entries
        WHERE (timestamp + ttl) < ${Date.now()}
      `);

      // Remove expired blockchain data
      const expiredTime = Date.now() - this.config.defaultTtlMs;
      
      await this.conn.query(`DELETE FROM cached_transactions WHERE cached_at < ${expiredTime}`);
      await this.conn.query(`DELETE FROM cached_blocks WHERE cached_at < ${expiredTime}`);
      await this.conn.query(`DELETE FROM cached_accounts WHERE last_updated < ${expiredTime}`);
      await this.conn.query(`DELETE FROM cached_tokens WHERE cached_at < ${expiredTime}`);

    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  public async getStats(): Promise<CacheStats> {
    if (!this.conn) {
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 0,
        evictionCount: this.stats.evictions,
        oldestEntry: 0,
        newestEntry: 0
      };
    }

    try {
      const result = await this.conn.query(`
        SELECT 
          COUNT(*) as total_entries,
          SUM(size_bytes) as total_size,
          MIN(timestamp) as oldest_entry,
          MAX(timestamp) as newest_entry
        FROM cache_entries
      `);

      const row = result.get(0) as DuckDBRow | null;
      if (!row) {
        return {
          totalEntries: 0,
          totalSize: 0,
          hitRate: 0,
          missRate: 1,
          evictionCount: this.stats.evictions,
          oldestEntry: 0,
          newestEntry: 0
        };
      }
      
      const total_entries = row.total_entries || 0;
      const total_size = row.total_size || 0;
      const oldest_entry = row.oldest_entry || 0;
      const newest_entry = row.newest_entry || 0;
      const totalRequests = this.stats.hits + this.stats.misses;

      return {
        totalEntries: total_entries || 0,
        totalSize: total_size || 0,
        hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
        missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
        evictionCount: this.stats.evictions,
        oldestEntry: oldest_entry || 0,
        newestEntry: newest_entry || 0
      };
    } catch (error) {
      console.error('Stats error:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 0,
        evictionCount: this.stats.evictions,
        oldestEntry: 0,
        newestEntry: 0
      };
    }
  }

  // Compression utilities
  private async compress(data: string): Promise<Uint8Array> {
    if ('CompressionStream' in window) {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(new TextEncoder().encode(data));
      writer.close();
      
      const chunks = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result;
    } else {
      // Fallback: no compression
      return new TextEncoder().encode(data);
    }
  }

  private async decompress(data: Uint8Array): Promise<any> {
    if ('DecompressionStream' in window) {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(data);
      writer.close();
      
      const chunks = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      const decompressed = new TextDecoder().decode(result);
      return JSON.parse(decompressed);
    } else {
      // Fallback: assume no compression
      const decompressed = new TextDecoder().decode(data);
      return JSON.parse(decompressed);
    }
  }

  public async destroy(): Promise<void> {
    if (this.conn) {
      await this.conn.close();
      this.conn = null;
    }
    if (this.db) {
      await this.db.terminate();
      this.db = null;
    }
    this.initialized = false;
    DuckDBCacheManager.instance = null;
  }
}

// Export singleton instance
export const cacheManager = DuckDBCacheManager.getInstance({
  maxSizeBytes: 150 * 1024 * 1024, // 150MB
  defaultTtlMs: 30 * 60 * 1000, // 30 minutes
  maxEntries: 15000,
  enableCompression: true,
  evictionPolicy: 'lru'
});