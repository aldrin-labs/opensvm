'use client';

import { useMemo, useState, useEffect, type ReactNode, Component, type ErrorInfo } from 'react';
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

// Check if debugging is enabled
const isDebugMode = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

function debugLog(...args: any[]) {
  if (isDebugMode) {
    console.log('[WalletProvider]', ...args);
  }
}

function debugError(...args: any[]) {
  if (isDebugMode) {
    console.error('[WalletProvider]', ...args);
  }
}

// Proper React ErrorBoundary component
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WalletErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Only log wallet-related errors to avoid catching unrelated errors
    if (
      error.message?.includes('wallet') ||
      error.message?.includes('getBalance') ||
      error.message?.includes('connection') ||
      error.stack?.includes('wallet-adapter')
    ) {
      debugError('Wallet error caught by boundary:', error, errorInfo);
    } else {
      // Re-throw non-wallet errors so they bubble up properly
      throw error;
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          <p className="font-medium">Wallet connection error</p>
          <p className="text-sm">Please try refreshing the page or reconnecting your wallet.</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Safe wallet component that protects from undefined errors and adds abort cleanup
function SafeWalletProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected, connecting } = useWallet();

  useEffect(() => {
    debugLog('Wallet state:', { 
      connected, 
      connecting, 
      publicKey: publicKey?.toString() 
    });
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

  // Initialize connection with abort controller for cleanup
  useEffect(() => {
    let mounted = true;
    const abortController = new AbortController();

    const tryEndpoint = async (url: string): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        // Chain abort signals - abort if either parent or timeout triggers
        // Use custom signal combining since AbortSignal.any might not be available
        let combinedSignal = controller.signal;
        
        // Listen for parent abort signal
        if (!abortController.signal.aborted) {
          const parentAbortHandler = () => {
            if (!controller.signal.aborted) {
              controller.abort();
            }
          };
          abortController.signal.addEventListener('abort', parentAbortHandler, { once: true });
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getHealth'
          }),
          signal: combinedSignal
        });

        clearTimeout(timeoutId);
        return response.ok;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          debugLog('Endpoint check aborted for:', url);
        }
        return false;
      }
    };

    const tryNextEndpoint = async () => {
      if (!mounted || abortController.signal.aborted) return;

      try {
        // First try connection pool
        const connection = await connectionPool.getConnection();
        const poolEndpoint = getEndpoint(connection);
        
        // If pool endpoint is not the default, try it first
        if (poolEndpoint !== DEFAULT_ENDPOINT) {
          if (await tryEndpoint(poolEndpoint)) {
            if (mounted && !abortController.signal.aborted) {
              setEndpoint(poolEndpoint);
              setConnectionReady(true);
              return;
            }
          }
        }

        // Immediately try fallbacks if pool fails
        for (const fallback of FALLBACK_ENDPOINTS) {
          if (!mounted || abortController.signal.aborted) return;
          
          if (await tryEndpoint(fallback)) {
            if (mounted && !abortController.signal.aborted) {
              setEndpoint(fallback);
              setConnectionReady(true);
              return;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between attempts
        }

        // If all fails, use default
        if (mounted && !abortController.signal.aborted) {
          debugLog('All RPC endpoints failed, using default');
          setEndpoint(DEFAULT_ENDPOINT);
          setConnectionReady(true);
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          debugError('Connection error:', err);
          if (mounted) {
            debugLog('Connection error, using default endpoint');
            setEndpoint(DEFAULT_ENDPOINT);
            setConnectionReady(true);
          }
        }
      }
    };

    tryNextEndpoint();

    return () => {
      mounted = false;
      abortController.abort(); // Cancel any ongoing requests
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