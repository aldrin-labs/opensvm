'use client';
import { SettingsProvider } from '@/lib/settings';
import { ThemeProvider } from '@/lib/theme';
import { SolanaProvider } from '@/app/providers/SolanaProvider';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SearchPopup } from '@/components/SearchPopup';
import { useMemo } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  
  return (
    <ThemeProvider>
      <SettingsProvider>
        <SolanaProvider>
          <WalletProvider wallets={wallets} autoConnect>
            {children}
            <SearchPopup />
          </WalletProvider>
        </SolanaProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
