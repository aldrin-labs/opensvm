import { Connection } from '@solana/web3.js';

// Connection pool configuration
const POOL_SIZE = 5;
const CONNECTION_TIMEOUT = 5000;

class RpcConnectionPool {
  private connections: Connection[] = [];
  private currentIndex = 0;
  private rpcUrl: string;
  
  constructor() {
    // Use multiple RPC endpoints for load balancing
    const rpcEndpoints = [
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://api.mainnet-beta.solana.com',
      'https://rpc.ankr.com/solana',
      'https://solana-mainnet.g.alchemy.com/v2/demo'
    ];
    
    this.rpcUrl = rpcEndpoints[0];
    
    // Initialize connection pool
    for (let i = 0; i < POOL_SIZE; i++) {
      const endpoint = rpcEndpoints[i % rpcEndpoints.length];
      this.connections.push(new Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: CONNECTION_TIMEOUT,
        httpHeaders: {
          'Content-Type': 'application/json',
        }
      }));
    }
    
    console.log(`✅ RPC Connection pool initialized with ${POOL_SIZE} connections`);
  }
  
  // Get next connection in round-robin fashion
  getConnection(): Connection {
    const connection = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.connections.length;
    return connection;
  }
  
  // Get all connections for parallel operations
  getAllConnections(): Connection[] {
    return this.connections;
  }
  
  // Execute request with automatic failover
  async executeWithFailover<T>(
    operation: (conn: Connection) => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;
    
    // Try each connection until one succeeds
    for (const connection of this.connections) {
      try {
        return await Promise.race([
          operation(connection),
          new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), CONNECTION_TIMEOUT)
          )
        ]);
      } catch (error) {
        lastError = error as Error;
        console.warn('RPC request failed, trying next connection:', error);
      }
    }
    
    throw lastError || new Error('All RPC connections failed');
  }
  
  // Batch RPC calls across multiple connections
  async batchExecute<T>(
    operations: Array<(conn: Connection) => Promise<T>>
  ): Promise<T[]> {
    const chunks: Array<Promise<T>[]> = [];
    const chunkSize = Math.ceil(operations.length / this.connections.length);
    
    // Distribute operations across connections
    for (let i = 0; i < this.connections.length; i++) {
      const connection = this.connections[i];
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, operations.length);
      
      if (start < operations.length) {
        const chunk = operations.slice(start, end).map(op => op(connection));
        chunks.push(chunk);
      }
    }
    
    // Execute all chunks in parallel
    const results = await Promise.all(chunks.map(chunk => Promise.all(chunk)));
    return results.flat();
  }
}

// Singleton instance
let poolInstance: RpcConnectionPool | null = null;

export function getRpcPool(): RpcConnectionPool {
  if (!poolInstance) {
    poolInstance = new RpcConnectionPool();
  }
  return poolInstance;
}

// Helper function to get a pooled connection
export function getPooledConnection(): Connection {
  return getRpcPool().getConnection();
}
