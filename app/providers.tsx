'use client';

import { SettingsProvider } from '@/lib/settings';
import { WalletProvider } from './providers/WalletProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <WalletProvider>
        {children}
      </WalletProvider>
    </SettingsProvider>
  );
}
