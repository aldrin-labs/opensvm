/**
 * useWalletConnection Hook
 * 
 * Manages Solana wallet connection state for the trading terminal.
 * Handles Phantom wallet auto-connection and localStorage persistence.
 * 
 * @module hooks/trading/useWalletConnection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNotifications } from '@/components/providers/NotificationProvider';

// Import shared types from useMarketData
import type { LoadingState, ErrorState } from './useMarketData';

export interface WalletInfo {
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: number | null; // SOL balance
  error: string | null;
  // Enhanced state management
  loadingState: LoadingState;
  errorState: ErrorState;
}

export interface UseWalletConnectionReturn extends WalletInfo {
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  retry: () => Promise<void>;
}

// Phantom wallet type for window.solana
// Note: Window.solana is already defined as `any` in global.d.ts
// so we can safely cast it to PhantomWallet when needed
interface PhantomWallet {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on: (event: string, handler: (args: unknown) => void) => void;
  off: (event: string, handler: (args: unknown) => void) => void;
}

const WALLET_STORAGE_KEY = 'opensvm-trading-wallet-connected';

/**
 * Hook for managing Solana wallet connection.
 * Supports Phantom wallet with auto-reconnect on page load.
 * 
 * @returns Wallet connection state and control functions
 * 
 * @example
 * ```tsx
 * const { isConnected, publicKey, connect, disconnect, balance } = useWalletConnection();
 * 
 * return (
 *   <div>
 *     {isConnected ? (
 *       <>
 *         <p>Connected: {publicKey}</p>
 *         <p>Balance: {balance} SOL</p>
 *         <button onClick={disconnect}>Disconnect</button>
 *       </>
 *     ) : (
 *       <button onClick={connect}>Connect Wallet</button>
 *     )}
 *   </div>
 * );
 * ```
 */
export const useWalletConnection = (): UseWalletConnectionReturn => {
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    publicKey: null,
    isConnected: false,
    isConnecting: false,
    balance: null,
    error: null,
    loadingState: {
      isLoading: false,
      isRefreshing: false,
    },
    errorState: {
      hasError: false,
      error: null,
    },
  });

  const mountedRef = useRef(true);
  const { addNotification } = useNotifications();

  /**
   * Check if Phantom wallet is installed
   */
  const isPhantomInstalled = useCallback((): boolean => {
    const solana = window.solana as PhantomWallet | undefined;
    return typeof window !== 'undefined' && solana?.isPhantom === true;
  }, []);

  /**
   * Fetch wallet balance
   */
  const fetchBalance = useCallback(async (_publicKey: string): Promise<number | null> => {
    try {
      // TODO: Replace with actual Solana RPC call
      // const connection = new Connection(clusterApiUrl('mainnet-beta'));
      // const balance = await connection.getBalance(new PublicKey(_publicKey));
      // return balance / LAMPORTS_PER_SOL;
      
      // Mock balance for development
      return Math.random() * 100;
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      return null;
    }
  }, []);

  /**
   * Connect to Phantom wallet
   */
  const connect = useCallback(async () => {
    if (!isPhantomInstalled()) {
      const errorMessage = 'Phantom wallet is not installed. Please install it from phantom.app';
      setWalletInfo(prev => ({
        ...prev,
        error: errorMessage,
      }));
      
      // Show error notification
      addNotification({
        type: 'error',
        title: 'Wallet Not Installed',
        message: errorMessage,
        action: {
          label: 'Install Phantom',
          onClick: () => window.open('https://phantom.app', '_blank'),
        },
        duration: 0, // Manual close
      });
      
      return;
    }

    setWalletInfo(prev => ({ ...prev, isConnecting: true, error: null }));

    // Show loading notification (optional - can be removed for simpler UX)
    void addNotification({
      type: 'loading',
      title: 'Connecting to Phantom...',
      dismissible: false,
      duration: 2000, // Auto-dismiss after 2s
    });

    try {
      const solana = window.solana as PhantomWallet;
      const response = await solana.connect();
      const publicKey = response.publicKey.toString();
      const balance = await fetchBalance(publicKey);

      if (mountedRef.current) {
        setWalletInfo(prev => ({
          ...prev,
          publicKey,
          isConnected: true,
          isConnecting: false,
          balance,
          error: null,
          loadingState: {
            isLoading: false,
            isRefreshing: false,
          },
          errorState: {
            hasError: false,
            error: null,
          },
        }));

        // Persist connection preference
        localStorage.setItem(WALLET_STORAGE_KEY, 'true');
        
        // Remove loading notification and show success
        addNotification({
          type: 'success',
          title: 'Wallet Connected',
          message: `Connected to ${publicKey.substring(0, 4)}...${publicKey.substring(publicKey.length - 4)}`,
          duration: 3000,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      if (mountedRef.current) {
        setWalletInfo(prev => ({
          ...prev,
          publicKey: null,
          isConnected: false,
          isConnecting: false,
          balance: null,
          error: errorMessage,
          loadingState: {
            isLoading: false,
            isRefreshing: false,
          },
          errorState: {
            hasError: true,
            error: {
              code: 'WALLET_CONNECTION_FAILED',
              message: errorMessage,
              recoverable: true,
              retryAction: () => connect(),
            },
          },
        }));
        
        // Show error notification
        addNotification({
          type: 'error',
          title: 'Connection Failed',
          message: errorMessage,
          action: {
            label: 'Retry',
            onClick: () => connect(),
          },
          duration: 0, // Manual close
        });
      }
    }
  }, [isPhantomInstalled, fetchBalance, addNotification]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    const solana = window.solana as PhantomWallet | undefined;
    if (solana) {
      solana.disconnect();
    }

    setWalletInfo(prev => ({
      ...prev,
      publicKey: null,
      isConnected: false,
      isConnecting: false,
      balance: null,
      error: null,
      loadingState: {
        isLoading: false,
        isRefreshing: false,
      },
      errorState: {
        hasError: false,
        error: null,
      },
    }));

    // Clear connection preference
    localStorage.removeItem(WALLET_STORAGE_KEY);
    
    // Show disconnect notification
    addNotification({
      type: 'info',
      title: 'Wallet Disconnected',
      duration: 2000,
    });
  }, [addNotification]);

  /**
   * Refresh wallet balance
   */
  const refreshBalance = useCallback(async () => {
    if (walletInfo.publicKey) {
      const balance = await fetchBalance(walletInfo.publicKey);
      if (mountedRef.current) {
        setWalletInfo(prev => ({ ...prev, balance }));
      }
    }
  }, [walletInfo.publicKey, fetchBalance]);

  /**
   * Auto-connect on mount if previously connected
   */
  useEffect(() => {
    mountedRef.current = true;

    const shouldAutoConnect = localStorage.getItem(WALLET_STORAGE_KEY) === 'true';
    const solana = window.solana as PhantomWallet | undefined;
    
    if (shouldAutoConnect && isPhantomInstalled()) {
      // Check if wallet is already connected
      if (solana?.publicKey) {
        const publicKey = solana.publicKey.toString();
        fetchBalance(publicKey).then(balance => {
          if (mountedRef.current) {
            setWalletInfo(prev => ({
              ...prev,
              publicKey,
              isConnected: true,
              isConnecting: false,
              balance,
              error: null,
              loadingState: {
                isLoading: false,
                isRefreshing: false,
              },
              errorState: {
                hasError: false,
                error: null,
              },
            }));
          }
        });
      } else {
        // Auto-connect
        connect();
      }
    }

    // Listen for wallet events
    const handleAccountChanged = (publicKey: unknown) => {
      if (publicKey && mountedRef.current) {
        const key = (publicKey as { toString: () => string }).toString();
        fetchBalance(key).then(balance => {
          if (mountedRef.current) {
            setWalletInfo(prev => ({
              ...prev,
              publicKey: key,
              isConnected: true,
              isConnecting: false,
              balance,
              error: null,
              loadingState: {
                isLoading: false,
                isRefreshing: false,
              },
              errorState: {
                hasError: false,
                error: null,
              },
            }));
          }
        });
      } else if (mountedRef.current) {
        disconnect();
      }
    };

    if (solana) {
      solana.on('accountChanged', handleAccountChanged);
    }

    return () => {
      mountedRef.current = false;
      const cleanupSolana = window.solana as PhantomWallet | undefined;
      if (cleanupSolana) {
        cleanupSolana.off('accountChanged', handleAccountChanged);
      }
    };
  }, [connect, disconnect, fetchBalance, isPhantomInstalled]);

  /**
   * Retry connection after error
   */
  const retry = useCallback(async () => {
    await connect();
  }, [connect]);

  return {
    ...walletInfo,
    connect,
    disconnect,
    refreshBalance,
    retry,
  };
};

export default useWalletConnection;
