'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface WalletButtonProps {
  variant?: 'default' | 'minimal';
  className?: string;
}

export const WalletButton: React.FC<WalletButtonProps> = ({ 
  variant = 'default',
  className = ''
}) => {
  const { connected, connecting, disconnecting, publicKey, disconnect } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle copy address to clipboard
  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Navigate to wallet page
  const goToWalletPage = () => {
    router.push('/wallet');
  };

  if (!mounted) {
    return (
      <Button 
        variant="outline" 
        className={`min-w-[180px] h-9 ${className}`}
      >
        Connect Wallet
      </Button>
    );
  }

  if (connecting) {
    return (
      <Button 
        variant="outline" 
        className={`min-w-[180px] h-9 ${className}`} 
        disabled
      >
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        Connecting...
      </Button>
    );
  }

  if (disconnecting) {
    return (
      <Button 
        variant="outline" 
        className={`min-w-[180px] h-9 ${className}`} 
        disabled
      >
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        Disconnecting...
      </Button>
    );
  }

  if (connected && publicKey) {
    // For minimal variant, just show the address
    if (variant === 'minimal') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                className={`h-9 ${className}`}
                onClick={goToWalletPage}
              >
                {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View wallet details</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // For default variant, show more options
    return (
      <div className="flex gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                className={`h-9 ${className}`}
                onClick={copyAddress}
              >
                {copied ? 'Copied!' : `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{copied ? 'Copied to clipboard!' : 'Copy address to clipboard'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                className="h-9 px-2"
                onClick={goToWalletPage}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
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
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View wallet details</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                className="h-9 px-2 text-destructive hover:text-destructive-foreground hover:bg-destructive"
                onClick={() => disconnect()}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Disconnect wallet</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <WalletMultiButton
      className={`min-w-[180px] h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${className}`}
    />
  );
};