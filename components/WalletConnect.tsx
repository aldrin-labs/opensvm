/**
 * Wallet Connect Component with "Sign Once" Authentication
 * Users sign once and get a persistent 7-day session
 */

'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  LogOut, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Shield,
  Clock
} from 'lucide-react';

export function WalletConnect() {
  const { publicKey, signMessage, connected } = useWallet();
  const { 
    isAuthenticated, 
    walletAddress, 
    loading, 
    error, 
    login, 
    logout 
  } = useAuthContext();
  
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!connected || !publicKey || !signMessage) {
      return;
    }

    try {
      setSigningIn(true);
      
      const userWalletAddress = publicKey.toBase58();
      
      // This is the ONLY signature the user needs to provide!
      // After this, all API calls will use the session cookie automatically
      await login(userWalletAddress, async (message: string) => {
        const messageBytes = new TextEncoder().encode(message);
        const signature = await signMessage(messageBytes);
        return Buffer.from(signature).toString('base64');
      });
      
    } catch (err) {
      console.error('Sign in failed:', err);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Wallet Authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet Connection */}
        <div>
          <WalletMultiButton className="w-full" />
        </div>

        {/* Authentication Status */}
        {connected && publicKey && (
          <div className="space-y-3">
            {isAuthenticated ? (
              // Authenticated State
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Authenticated
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Session active for 7 days
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    <Clock className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-mono">
                      {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : ''}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    className="gap-1"
                  >
                    <LogOut className="h-3 w-3" />
                    Sign Out
                  </Button>
                </div>

                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    You're signed in! All social actions (follow, like, etc.) will work without requiring additional signatures.
                  </p>
                </div>
              </div>
            ) : (
              // Not Authenticated State
              <div className="space-y-3">
                <Button
                  onClick={handleSignIn}
                  disabled={signingIn || loading}
                  className="w-full gap-2"
                >
                  {signingIn || loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Sign In (One Time)
                    </>
                  )}
                </Button>

                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Sign once to authenticate. Your session will last 7 days - no more signing for every action!
                  </p>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!connected && (
          <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <AlertCircle className="h-4 w-4 text-gray-600 mt-0.5" />
            <p className="text-sm text-gray-800 dark:text-gray-200">
              Connect your wallet first, then sign once to authenticate for a full week.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
