'use client';

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { useSettings } from '@/lib/settings';
import { connectionPool } from '@/lib/solana-connection';
import type { Connection } from '@solana/web3.js';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

// Default mainnet endpoint that will always be available
const DEFAULT_ENDPOINT = 'https://api.mainnet-beta.solana.com';

// Fallback endpoints in case OpenSVM is not available
const FALLBACK_ENDPOINTS = [
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
  DEFAULT_ENDPOINT
] as const;

function getEndpoint(connection: Connection): string {
  return 'rpcEndpoint' in connection ? connection.rpcEndpoint : DEFAULT_ENDPOINT;
}

export function WalletProvider({ children }: WalletProviderProps): ReactNode {
  const { rpcEndpoint } = useSettings();
  const [endpoint, setEndpoint] = useState<string>(DEFAULT_ENDPOINT);
  
  // Initialize wallets
  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    []
  );

  // Initialize connection
  useEffect(() => {
    let mounted = true;
    let currentEndpointIndex = 0;

    const tryEndpoint = async (url: string): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getHealth'
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return response.ok;
      } catch {
        return false;
      }
    };

    const tryNextEndpoint = async () => {
      if (!mounted) return;

      try {
        // First try connection pool
        const connection = await connectionPool.getConnection();
        const poolEndpoint = getEndpoint(connection);
        
        // If pool endpoint is not the default, try it first
        if (poolEndpoint !== DEFAULT_ENDPOINT) {
          if (await tryEndpoint(poolEndpoint)) {
            if (mounted) {
              setEndpoint(poolEndpoint);
              return;
            }
          }
        }

        // Immediately try fallbacks if pool fails
        for (const fallback of FALLBACK_ENDPOINTS) {
          if (await tryEndpoint(fallback)) {
            if (mounted) {
              setEndpoint(fallback);
              return;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between attempts
        }

        // If all fails, use default
        if (mounted) {
          console.warn('All RPC endpoints failed, using default');
          setEndpoint(DEFAULT_ENDPOINT);
        }
      } catch (err) {
        console.error('Connection error:', err);
        if (mounted) {
          console.warn('Connection error, using default endpoint');
          setEndpoint(DEFAULT_ENDPOINT);
        }
      }
    };

    tryNextEndpoint();

    return () => {
      mounted = false;
    };
  }, [rpcEndpoint?.url]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}