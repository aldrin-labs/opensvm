'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function WalletPage() {
  const { connected, publicKey, disconnect } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="container mx-auto py-12">
        <div className="flex flex-col items-center justify-center">
          <div className="w-full max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>Connect Wallet</CardTitle>
                <CardDescription>Loading wallet connection...</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12">
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Connection</CardTitle>
              <CardDescription>
                Connect your Solana wallet to access personalized features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 py-4">
                {connected ? (
                  <>
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="m9 12 2 2 4-4" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-medium">Wallet Connected</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your wallet is connected to OpenSVM
                      </p>
                    </div>
                    <div className="w-full p-3 bg-muted rounded-md font-mono text-sm break-all">
                      {publicKey?.toBase58()}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-medium">Connect Your Wallet</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Connect your wallet to access personalized features
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-center">
              {connected ? (
                <Button 
                  variant="destructive" 
                  onClick={() => disconnect()}
                  className="w-full"
                >
                  Disconnect Wallet
                </Button>
              ) : (
                <WalletMultiButton className="w-full justify-center bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md" />
              )}
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}