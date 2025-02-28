'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

interface WalletButtonProps {}

export const WalletButton: React.FC<WalletButtonProps> = () => {
  const { connected, connecting, disconnect } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" className="min-w-[180px] h-9">
        Connect Wallet
      </Button>
    );
  }

  if (connecting) {
    return (
      <Button variant="outline" className="min-w-[180px] h-9" disabled>
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        Connecting...
      </Button>
    );
  }

  if (connected) {
    return (
      <Button 
        variant="outline" 
        className="min-w-[180px] h-9 text-destructive hover:text-destructive-foreground hover:bg-destructive"
        onClick={() => disconnect()}
      >
        Disconnect
      </Button>
    );
  }

  // Use the WalletMultiButton with additional styling to ensure it's visible
  return (
    <WalletMultiButton
      className="min-w-[180px] h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
    />
  );
};