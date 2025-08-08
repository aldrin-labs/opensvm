'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { updateRpcEndpoint } from './solana-connection-client';

export type Theme = 'paper' | 'high-contrast' | 'dos' | 'cyberpunk' | 'solarized';
export type FontFamily = 'berkeley' | 'inter' | 'jetbrains';
export type FontSize = 'small' | 'medium' | 'large';

// Accessibility settings
export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  focusVisible: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
  autoPlay: boolean;
}

export interface RpcEndpoint {
  name: string;
  url: string;
  network: 'mainnet' | 'devnet' | 'testnet' | 'custom';
}

// Define the OpenSVM endpoint as the primary endpoint
const OPENSVM_ENDPOINT: RpcEndpoint = {
  name: 'OpenSVM',
  url: 'https://opensvm.com/api/proxy/rpc',
  network: 'mainnet'
};

const DEFAULT_MAINNET_ENDPOINT: RpcEndpoint = { name: 'Mainnet', url: 'https://api.mainnet-beta.solana.com', network: 'mainnet' };

// Define the Serum endpoint as a fallback endpoint
const SERUM_ENDPOINT: RpcEndpoint = {
  name: 'Serum',
  url: 'https://solana-api.projectserum.com',
  network: 'mainnet'
};

// Client-safe RPC endpoints (no secrets exposed)
const getDefaultRpcEndpoints = (): RpcEndpoint[] => {
  // For client-side, we only use safe endpoints and the proxy
  return [
    OPENSVM_ENDPOINT,
    SERUM_ENDPOINT,
    { name: 'Ankr', url: 'https://rpc.ankr.com/solana', network: 'mainnet' },
    { name: 'ExtrNode', url: 'https://solana-mainnet.rpc.extrnode.com', network: 'mainnet' },
    DEFAULT_MAINNET_ENDPOINT,
    { name: 'Devnet', url: 'https://api.devnet.solana.com', network: 'devnet' },
    { name: 'Testnet', url: 'https://api.testnet.solana.com', network: 'testnet' },
  ];
};

const defaultRpcEndpoints: RpcEndpoint[] = getDefaultRpcEndpoints();

const initialRpcEndpoint = OPENSVM_ENDPOINT;

interface Settings {
  theme: Theme;
  fontFamily: FontFamily;
  fontSize: FontSize;
  rpcEndpoint: RpcEndpoint;
  availableRpcEndpoints: RpcEndpoint[];
  customRpcEndpoint: string;
}

interface SettingsContextType extends Settings {
  setTheme: (theme: Theme) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
  setFontSize: (fontSize: FontSize) => void;
  setRpcEndpoint: (endpoint: RpcEndpoint) => Promise<void>;
  setCustomRpcEndpoint: (url: string) => void;
  addCustomRpcEndpoint: (name: string, url: string) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultSettings: Settings = {
  theme: 'cyberpunk',
  fontFamily: 'berkeley',
  fontSize: 'medium',
  rpcEndpoint: initialRpcEndpoint,
  availableRpcEndpoints: defaultRpcEndpoints,
  customRpcEndpoint: '',
};

// Helper function to safely access localStorage
const getLocalStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [mounted, setMounted] = useState(false);

  // Initialize settings from localStorage
  useEffect(() => {
    const storage = getLocalStorage();
    if (storage) {
      try {
        const savedSettings = storage.getItem('settings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          // Ensure availableRpcEndpoints is always set to defaultRpcEndpoints
          parsed.availableRpcEndpoints = defaultRpcEndpoints;
          // Ensure rpcEndpoint is valid
          // Always use OpenSVM endpoint regardless of saved settings
          parsed.rpcEndpoint = OPENSVM_ENDPOINT;

          setSettings(parsed);
          // Update RPC endpoint in connection pool
          updateRpcEndpoint(parsed.rpcEndpoint.url);
        }
      } catch (error) {
        console.error('Error parsing settings:', error);
        setSettings(defaultSettings);
      }
    }
    setMounted(true);
  }, []);

  // Save settings to localStorage and apply them
  useEffect(() => {
    if (!mounted) return;

    const storage = getLocalStorage();
    if (storage) {
      // Save to localStorage
      try {
        storage.setItem('settings', JSON.stringify(settings));
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    }

    // Apply theme
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove(
        'theme-paper',
        'theme-high-contrast',
        'theme-dos',
        'theme-cyberpunk',
        'theme-solarized'
      );
      document.documentElement.classList.add(`theme-${settings.theme}`);

      // Apply font family
      document.documentElement.style.setProperty('--font-family', `var(--font-${settings.fontFamily})`);

      // Apply font size
      const fontSizes = { small: '14px', medium: '16px', large: '18px' };
      document.documentElement.style.setProperty('--base-font-size', fontSizes[settings.fontSize]);
    }

  }, [settings, mounted]);

  const contextValue: SettingsContextType = {
    ...settings,
    setTheme: (theme: Theme) => setSettings((s) => ({ ...s, theme })),
    setFontFamily: (fontFamily: FontFamily) => setSettings((s) => ({ ...s, fontFamily })),
    setFontSize: (fontSize: FontSize) => setSettings((s) => ({ ...s, fontSize })),
    // Always use OpenSVM endpoint and ignore any attempts to change it
    setRpcEndpoint: useCallback(async (endpoint: RpcEndpoint) => {
      console.log(`Attempt to change RPC endpoint to ${endpoint.name} ignored. Using OpenSVM endpoint.`);
      updateRpcEndpoint(OPENSVM_ENDPOINT.url);
      setSettings((s) => ({ ...s, rpcEndpoint: OPENSVM_ENDPOINT }));
      return Promise.resolve(); // Return resolved promise to maintain API compatibility
    }, []),
    setCustomRpcEndpoint: useCallback((url) => setSettings((s) => ({ ...s, customRpcEndpoint: url })), []),
    addCustomRpcEndpoint: async (name: string, url: string) => {
      const newEndpoint: RpcEndpoint = { name, url, network: 'custom' };
      try {
        updateRpcEndpoint(url);
        setSettings((s) => ({
          ...s,
          // Add to available endpoints but force using OpenSVM
          availableRpcEndpoints: [...s.availableRpcEndpoints, newEndpoint],
          // Override with OpenSVM endpoint to ensure it's always used
          rpcEndpoint: OPENSVM_ENDPOINT,
        }));
      } catch (error) {
        console.error('Failed to add custom RPC endpoint:', error);
        throw error;
      }
    },
  } as SettingsContextType;

  if (!mounted) {
    return null;
  }

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    // Return default settings when no context is available (during SSR/build)
    return {
      ...defaultSettings,
      setTheme: () => { },
      setFontFamily: () => { },
      setFontSize: () => { },
      setRpcEndpoint: async () => { },
      setCustomRpcEndpoint: () => { },
      addCustomRpcEndpoint: async () => { }
    };
  }
  return context;
}
