/**
 * Authentication hook for Solana wallet-based sessions
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { validateWalletAddress } from '@/lib/user-history-utils';

export interface AuthSession {
  walletAddress: string;
  sessionKey: string;
  expiresAt: number;
  isAuthenticated: boolean;
}

export function useAuth() {
  const { publicKey, signMessage, connected } = useWallet();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
  }, [connected, publicKey]);

  const checkExistingSession = useCallback(async () => {
    if (!connected || !publicKey) {
      setSession(null);
      return;
    }

    const walletAddress = publicKey.toBase58();
    const validatedAddress = validateWalletAddress(walletAddress);
    
    if (!validatedAddress) {
      setSession(null);
      return;
    }

    // Check for existing session in localStorage
    try {
      const storedSession = localStorage.getItem(`opensvm_auth_session_${validatedAddress}`);
      if (storedSession) {
        const sessionData = JSON.parse(storedSession) as AuthSession;
        
        // Check if session is still valid
        if (Date.now() < sessionData.expiresAt) {
          setSession(sessionData);
          return;
        } else {
          // Remove expired session
          localStorage.removeItem(`opensvm_auth_session_${validatedAddress}`);
        }
      }
    } catch (error) {
      console.error('Error checking existing session:', error);
    }

    setSession(null);
  }, [connected, publicKey]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!connected || !publicKey || !signMessage) {
      setError('Wallet not connected or does not support message signing');
      return false;
    }

    const walletAddress = publicKey.toBase58();
    const validatedAddress = validateWalletAddress(walletAddress);
    
    if (!validatedAddress) {
      setError('Invalid wallet address');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Get session key from server
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress: validatedAddress }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create session');
      }

      const { sessionKey, message } = await sessionResponse.json();

      // Step 2: Sign the message with wallet
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      
      // Convert signature to base58
      const signatureBase58 = Buffer.from(signature).toString('base64');

      // Step 3: Verify signature with server
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionKey,
          signature: signatureBase58,
          walletAddress: validatedAddress,
          message
        }),
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error('Verification failed:', verifyResponse.status, errorText);
        throw new Error(`Signature verification failed: ${verifyResponse.status} ${errorText}`);
      }

      const { expiresAt } = await verifyResponse.json();

      // Create session object
      const newSession: AuthSession = {
        walletAddress: validatedAddress,
        sessionKey,
        expiresAt,
        isAuthenticated: true
      };

      // Store session locally
      localStorage.setItem(`opensvm_auth_session_${validatedAddress}`, JSON.stringify(newSession));
      setSession(newSession);

      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, signMessage]);

  const logout = useCallback(async () => {
    if (!session) return;

    try {
      // Call logout endpoint
      await fetch('/api/auth/logout', {
        method: 'POST',
      });

      // Clear local session
      localStorage.removeItem(`opensvm_auth_session_${session.walletAddress}`);
      setSession(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local session even if server call fails
      localStorage.removeItem(`opensvm_auth_session_${session.walletAddress}`);
      setSession(null);
    }
  }, [session]);

  const isSessionValid = useCallback(() => {
    if (!session) return false;
    return Date.now() < session.expiresAt;
  }, [session]);

  return {
    session,
    isAuthenticated: session?.isAuthenticated && isSessionValid(),
    isLoading,
    error,
    authenticate,
    logout,
    checkExistingSession
  };
}