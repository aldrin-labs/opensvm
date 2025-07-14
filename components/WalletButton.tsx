'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useCallback } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';

interface WalletButtonProps {}

export const WalletButton: React.FC<WalletButtonProps> = () => {
  const { connected, connecting, disconnect, select, wallets, publicKey, signMessage } = useWallet();
  const { isAuthenticated, login, logout, loading: authLoading } = useAuthContext();
  const [mounted, setMounted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-authenticate when wallet connects
  useEffect(() => {
    const authenticate = async () => {
      if (connected && publicKey && !isAuthenticated && !authLoading && signMessage) {
        try {
          const walletAddress = publicKey.toBase58();
          // Create a sign message function that returns base64 string
          const signMessageWrapper = async (message: string) => {
            const messageBytes = new TextEncoder().encode(message);
            const signature = await signMessage(messageBytes);
            // Convert Uint8Array to base64 without using Buffer (browser-compatible)
            let binary = '';
            const bytes = new Uint8Array(signature);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
          };
          
          await login(walletAddress, signMessageWrapper);
        } catch (error) {
          console.error('Auto-authentication failed:', error);
        }
      }
    };

    authenticate();
  }, [connected, publicKey, isAuthenticated, authLoading, signMessage, login]);

  const handleConnect = async () => {
    // Find Phantom wallet from available wallets
    const phantomWallet = wallets.find(wallet => wallet.adapter.name === 'Phantom');
    
    if (phantomWallet) {
      try {
        setIsConnecting(true);
        // Select and connect to Phantom wallet
        select(phantomWallet.adapter.name);
        await phantomWallet.adapter.connect();
        // Authentication will happen automatically via the useEffect above
      } catch (error) {
        console.error('Failed to connect to Phantom wallet:', error);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleDisconnect = useCallback(async () => {
    try {
      // Logout from auth session first
      if (isAuthenticated) {
        await logout();
      }
      // Then disconnect wallet
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, [disconnect, logout, isAuthenticated]);

  if (!mounted) {
    return (
      <Button variant="outline" className="min-w-[180px] h-9">
        Connect Wallet
      </Button>
    );
  }

  if (connecting || isConnecting || (connected && authLoading)) {
    return (
      <Button variant="outline" className="min-w-[180px] h-9" disabled>
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        {connected && authLoading ? 'Authenticating...' : 'Connecting...'}
      </Button>
    );
  }

  if (connected && publicKey) {
    return (
      <Button 
        variant="outline" 
        className="min-w-[180px] h-9 text-destructive hover:text-destructive-foreground hover:bg-destructive"
        onClick={handleDisconnect}
      >
        Disconnect
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      className="min-w-[180px] h-9 bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={handleConnect}
    >
      Connect Wallet
    </Button>
  );
};
