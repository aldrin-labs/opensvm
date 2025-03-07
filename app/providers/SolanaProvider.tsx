'use client';

import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { Connection } from '@solana/web3.js';
import { useEffect, useState, useMemo } from 'react';
import { connectionPool } from '@/lib/solana-connection';

// Use a default endpoint to allow rendering while the real connection initializes
const DEFAULT_ENDPOINT = 'https://api.mainnet-beta.solana.com';

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  
  useEffect(() => {
    // Initialize connection pool
    const init = async () => {
      try {
        const conn = await connectionPool.getConnection();
        setConnection(conn);
      } catch (error) {
        console.error('Failed to initialize connection:', error);
      }
    };
    init();
  }, []); // Only initialize once

  // Memoize endpoint to avoid unnecessary re-renders
  const endpoint = useMemo(() => connection?.rpcEndpoint || DEFAULT_ENDPOINT, [connection]);

  // Memoize config so it doesn't change on every render
  const config = useMemo(() => ({ commitment: 'confirmed' as const }), []);

  // Always render children, use default or actual connection when available
  return (
    <ConnectionProvider 
      endpoint={endpoint} 
      config={config}
    >
      {children}
    </ConnectionProvider>
  );
}
