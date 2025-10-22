/**
 * useWalletConnection Hook
 * 
 * Manages Solana wallet connection state for the trading terminal.
 * Handles Phantom wallet auto-connection and localStorage persistence.
 * 
 * @module hooks/trading/useWalletConnection
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface WalletInfo {
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balance: number | null; // SOL balance
  error: string | null;
}

export interface UseWalletConnectionReturn extends WalletInfo {
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
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
  });

  const mountedRef = useRef(true);

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
      setWalletInfo(prev => ({
        ...prev,
        error: 'Phantom wallet is not installed. Please install it from phantom.app',
      }));
      return;
    }

    setWalletInfo(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const solana = window.solana as PhantomWallet;
      const response = await solana.connect();
      const publicKey = response.publicKey.toString();
      const balance = await fetchBalance(publicKey);

      if (mountedRef.current) {
        setWalletInfo({
          publicKey,
          isConnected: true,
          isConnecting: false,
          balance,
          error: null,
        });

        // Persist connection preference
        localStorage.setItem(WALLET_STORAGE_KEY, 'true');
      }
    } catch (error) {
      if (mountedRef.current) {
        setWalletInfo({
          publicKey: null,
          isConnected: false,
          isConnecting: false,
          balance: null,
          error: error instanceof Error ? error.message : 'Failed to connect wallet',
        });
      }
    }
  }, [isPhantomInstalled, fetchBalance]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    const solana = window.solana as PhantomWallet | undefined;
    if (solana) {
      solana.disconnect();
    }

    setWalletInfo({
      publicKey: null,
      isConnected: false,
      isConnecting: false,
      balance: null,
      error: null,
    });

    // Clear connection preference
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, []);

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
            setWalletInfo({
              publicKey,
              isConnected: true,
              isConnecting: false,
              balance,
              error: null,
            });
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
            setWalletInfo({
              publicKey: key,
              isConnected: true,
              isConnecting: false,
              balance,
              error: null,
            });
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

  return {
    ...walletInfo,
    connect,
    disconnect,
    refreshBalance,
  };
};

export default useWalletConnection;
