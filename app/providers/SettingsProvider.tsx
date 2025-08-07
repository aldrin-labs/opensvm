'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSettings as useSettingsHook, Settings } from '@/lib/settings';

const SettingsContext = createContext<ReturnType<typeof useSettingsHook> | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSettingsHook();
  
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    // Return default settings whether on server or client
    return {
      theme: 'paper' as const,
      fontFamily: 'inter' as const,
      fontSize: 'medium' as const,
      rpcEndpoint: {
        name: 'OpenSVM',
        url: 'opensvm',
        network: 'mainnet' as const
      },
      customRpcEndpoint: '',
      availableRpcEndpoints: [
        {
          name: 'OpenSVM',
          url: 'opensvm',
          network: 'mainnet' as const
        }
      ],
      setTheme: () => {},
      setFontFamily: () => {},
      setFontSize: () => {},
      setRpcEndpoint: () => {},
      addCustomRpcEndpoint: () => {}
    };
  }
  return context;
}
