/**
 * Authentication Context Provider
 * Provides session-based authentication state across the app
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  loading: boolean;
  error: string | null;
  userCancelled: boolean;
  login: (walletAddress: string, signMessage: (message: string) => Promise<string>) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearCancellation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCancelled, setUserCancelled] = useState(false);

  // Check session status
  const refreshSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.walletAddress) {
          setIsAuthenticated(true);
          setWalletAddress(data.walletAddress);
        } else {
          setIsAuthenticated(false);
          setWalletAddress(null);
        }
      } else {
        setIsAuthenticated(false);
        setWalletAddress(null);
      }
    } catch (err) {
      console.error('Session check failed:', err);
      setError('Failed to check authentication status');
      setIsAuthenticated(false);
      setWalletAddress(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear cancellation state (called when user explicitly clicks connect)
  const clearCancellation = useCallback(() => {
    setUserCancelled(false);
    setError(null);
  }, []);

  // Sign-once login function
  const login = useCallback(async (
    userWalletAddress: string, 
    signMessage: (message: string) => Promise<string>
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      // Step 1: Request session key and message
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ walletAddress: userWalletAddress })
      });
      
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to create session');
      }
      
      const { sessionKey, message } = await sessionResponse.json();
      
      // Step 2: Sign the message (this is the ONLY signature required!)
      const signature = await signMessage(message);
      
      // Step 3: Verify signature and establish persistent session
      const verifyResponse = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          walletAddress: userWalletAddress,
          signature,
          message,
          sessionKey
        })
      });
      
      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        throw new Error(errorData.error || 'Authentication failed');
      }
      
      // Session is now established with HTTP-only cookie
      setIsAuthenticated(true);
      setWalletAddress(userWalletAddress);
      
    } catch (err) {
      console.error('Login failed:', err);
      
      // Check if this was a user cancellation (common cancellation patterns)
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isCancellation = errorMessage.toLowerCase().includes('user rejected') ||
                            errorMessage.toLowerCase().includes('user denied') ||
                            errorMessage.toLowerCase().includes('user cancelled') ||
                            errorMessage.toLowerCase().includes('user canceled') ||
                            errorMessage.toLowerCase().includes('rejected by user') ||
                            errorMessage.toLowerCase().includes('transaction rejected');
      
      if (isCancellation) {
        setUserCancelled(true);
        setError(null); // Don't show error for user cancellation
      } else {
        setError(errorMessage || 'Login failed');
      }
      
      setIsAuthenticated(false);
      setWalletAddress(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      setIsAuthenticated(false);
      setWalletAddress(null);
      setError(null);
      setUserCancelled(false);
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Logout failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const value: AuthContextType = {
    isAuthenticated,
    walletAddress,
    loading,
    error,
    userCancelled,
    login,
    logout,
    refreshSession,
    clearCancellation
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

// Simple hook for getting current user info (no auth required)
export function useCurrentUser() {
  const { isAuthenticated, walletAddress, loading, userCancelled } = useAuthContext();
  return { isAuthenticated, walletAddress, loading, userCancelled };
}
