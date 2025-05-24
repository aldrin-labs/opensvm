'use client';

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { useSettings } from '@/lib/settings';
import { connectionPool } from '@/lib/solana-connection';
import type { Connection } from '@solana/web3.js';
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

// ErrorBoundary component to catch wallet-related errors
function WalletErrorBoundary({ children }: { children: ReactNode }) {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Check if the error is related to wallet functionality
      if (
        event.error?.message?.includes('getBalance') ||
        event.error?.message?.includes('wallet')
      ) {
        console.error('Caught wallet-related error:', event.error);
        setHasError(true);
        event.preventDefault(); // Prevent the error from bubbling up
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
        <p className="font-medium">Wallet connection error</p>
        <p className="text-sm">Please try refreshing the page or reconnecting your wallet.</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Safe wallet component that protects from undefined errors
function SafeWalletProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, connecting } = useWallet();

  useEffect(() => {
    console.log('Wallet state:', { connected, connecting, publicKey: publicKey?.toString() });
  }, [connected, connecting, publicKey]);

  return <>{children}</>;
}

export function WalletProvider({ children }: WalletProviderProps): ReactNode {
  const { rpcEndpoint } = useSettings();
  const [endpoint, setEndpoint] = useState<string>(DEFAULT_ENDPOINT);
  const [connectionReady, setConnectionReady] = useState(false);
  
  // Initialize wallets
  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    []
  );

  // Initialize connection
  useEffect(() => {
    let mounted = true;

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
              setConnectionReady(true);
              return;
            }
          }
        }

        // Immediately try fallbacks if pool fails
        for (const fallback of FALLBACK_ENDPOINTS) {
          if (await tryEndpoint(fallback)) {
            if (mounted) {
              setEndpoint(fallback);
              setConnectionReady(true);
              return;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between attempts
        }

        // If all fails, use default
        if (mounted) {
          console.warn('All RPC endpoints failed, using default');
          setEndpoint(DEFAULT_ENDPOINT);
          setConnectionReady(true);
        }
      } catch (err) {
        console.error('Connection error:', err);
        if (mounted) {
          console.warn('Connection error, using default endpoint');
          setEndpoint(DEFAULT_ENDPOINT);
          setConnectionReady(true);
        }
      }
    };

    tryNextEndpoint();

    return () => {
      mounted = false;
    };
  }, [rpcEndpoint?.url]);

  if (!connectionReady) {
    return <div className="text-center py-4">Connecting to Solana network...</div>;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletErrorBoundary>
          <WalletModalProvider>
            <SafeWalletProvider>
              {children}
            </SafeWalletProvider>
          </WalletModalProvider>
        </WalletErrorBoundary>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}