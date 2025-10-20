'use client';

/**
 * Settings management for the application
 * Handles theme, font, RPC endpoint, and other user preferences
 */

import { useEffect, useState } from 'react';

export type Theme = 'paper' | 'high-contrast' | 'dos-blue' | 'cyberpunk' | 'solarized';
export type FontFamily = 'berkeley' | 'inter' | 'jetbrains';
export type FontSize = 'small' | 'medium' | 'large';

export interface RpcEndpoint {
  name: string;
  url: string;
  network: 'mainnet' | 'devnet' | 'testnet';
}

export interface Settings {
  theme: Theme;
  fontFamily: FontFamily;
  fontSize: FontSize;
  rpcEndpoint: RpcEndpoint;
  customRpcEndpoint: string;
  availableRpcEndpoints: RpcEndpoint[];
}

const defaultSettings: Settings = {
  theme: 'paper',
  fontFamily: 'inter',
  fontSize: 'medium',
  rpcEndpoint: {
    name: 'osvm rpc',
    url: 'opensvm',
    network: 'mainnet'
  },
  customRpcEndpoint: '',
  availableRpcEndpoints: [
    {
      name: 'osvm rpc',
      url: 'opensvm',
      network: 'mainnet'
    },
    {
      name: 'Solana Mainnet',
      url: 'https://api.mainnet-beta.solana.com',
      network: 'mainnet'
    },
    {
      name: 'Solana Devnet',
      url: 'https://api.devnet.solana.com',
      network: 'devnet'
    },
    {
      name: 'Solana Testnet',
      url: 'https://api.testnet.solana.com',
      network: 'testnet'
    }
  ]
};

class SettingsManager {
  private settings: Settings;
  private listeners: Set<(settings: Settings) => void> = new Set();

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): Settings {
    if (typeof window === 'undefined') {
      return { ...defaultSettings };
    }

    try {
      const stored = localStorage.getItem('opensvm-settings');
      const parsed = stored ? JSON.parse(stored) : {};

      // Check for cluster cookie override
      const clusterCookie = this.getCookie('cluster');
      const override = this.resolveClusterToEndpoint(clusterCookie);

      const merged: Settings = {
        ...defaultSettings,
        ...parsed,
        availableRpcEndpoints: defaultSettings.availableRpcEndpoints
      };

      if (override) {
        merged.rpcEndpoint = override.endpoint;
        if (override.isCustom) {
          merged.customRpcEndpoint = override.endpoint.url;
        }
      }

      return merged;
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }

    return { ...defaultSettings };
  }

  private saveSettings() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('opensvm-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.settings));
  }

  public getSettings(): Settings {
    return { ...this.settings };
  }

  public setTheme(theme: Theme) {
    this.settings.theme = theme;
    this.saveSettings();
    this.notifyListeners();
    this.applyTheme(theme);
  }

  public setFontFamily(fontFamily: FontFamily) {
    this.settings.fontFamily = fontFamily;
    this.saveSettings();
    this.notifyListeners();
    this.applyFont(fontFamily);
  }

  public setFontSize(fontSize: FontSize) {
    this.settings.fontSize = fontSize;
    this.saveSettings();
    this.notifyListeners();
    this.applyFontSize(fontSize);
  }

  public setRpcEndpoint(endpoint: RpcEndpoint) {
    this.settings.rpcEndpoint = endpoint;
    this.saveSettings();
    this.notifyListeners();
  }

  public addCustomRpcEndpoint(name: string, url: string) {
    const endpoint: RpcEndpoint = {
      name,
      url,
      network: 'mainnet' // Default to mainnet for custom endpoints
    };

    // Add to available endpoints if not already present
    const exists = this.settings.availableRpcEndpoints.find(e => e.url === url);
    if (!exists) {
      this.settings.availableRpcEndpoints.push(endpoint);
    }

    this.settings.rpcEndpoint = endpoint;
    this.settings.customRpcEndpoint = url;
    this.saveSettings();
    this.notifyListeners();
  }

  public subscribe(listener: (settings: Settings) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()!.split(';').shift() || null;
    return null;
  }

  private normalizeUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    if (/^[\w.-]+(\:[0-9]+)?(\/|$)/.test(url)) return `https://${url}`;
    return url;
  }

  private resolveClusterToEndpoint(cluster: string | null | undefined): { endpoint: RpcEndpoint; isCustom: boolean } | null {
    if (!cluster) return null;
    const value = cluster.trim().toLowerCase();
    if (!value) return null;

    if (value === 'mainnet' || value === 'mainnet-beta' || value === 'opensvm' || value === 'osvm' || value === 'gsvm') {
      return { endpoint: { name: 'osvm rpc', url: 'opensvm', network: 'mainnet' }, isCustom: false };
    }
    if (value === 'devnet') {
      return { endpoint: { name: 'Solana Devnet', url: 'https://api.devnet.solana.com', network: 'devnet' }, isCustom: false };
    }
    if (value === 'testnet') {
      return { endpoint: { name: 'Solana Testnet', url: 'https://api.testnet.solana.com', network: 'testnet' }, isCustom: false };
    }
    // Treat as custom endpoint/host
    const normalized = this.normalizeUrl(cluster);
    return { endpoint: { name: 'Custom', url: normalized, network: 'mainnet' }, isCustom: true };
  }

  private applyTheme(theme: Theme) {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Remove all theme classes
    root.classList.remove('theme-paper', 'theme-high-contrast', 'theme-dos-blue', 'theme-cyberpunk', 'theme-solarized');

    // Apply new theme class
    root.classList.add(`theme-${theme}`);
  }

  private applyFont(fontFamily: FontFamily) {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Remove all font classes
    root.classList.remove('font-berkeley', 'font-inter', 'font-jetbrains');

    // Apply new font class
    root.classList.add(`font-${fontFamily}`);
  }

  private applyFontSize(fontSize: FontSize) {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Remove all font size classes
    root.classList.remove('text-small', 'text-medium', 'text-large');

    // Apply new font size class
    root.classList.add(`text-${fontSize}`);
  }

  public initializeSettings() {
    // Apply current settings on initialization
    this.applyTheme(this.settings.theme);
    this.applyFont(this.settings.fontFamily);
    this.applyFontSize(this.settings.fontSize);
  }
}

// Singleton instance
const settingsManager = new SettingsManager();

// Initialize settings when this module is loaded
if (typeof window !== 'undefined') {
  settingsManager.initializeSettings();
}

// React hook
export function useSettings() {
  const [settings, setSettings] = useState(() => settingsManager.getSettings());

  useEffect(() => {
    const unsubscribe = settingsManager.subscribe(setSettings);
    return unsubscribe;
  }, []);

  return {
    ...settings,
    setTheme: (theme: Theme) => settingsManager.setTheme(theme),
    setFontFamily: (fontFamily: FontFamily) => settingsManager.setFontFamily(fontFamily),
    setFontSize: (fontSize: FontSize) => settingsManager.setFontSize(fontSize),
    setRpcEndpoint: (endpoint: RpcEndpoint) => settingsManager.setRpcEndpoint(endpoint),
    addCustomRpcEndpoint: (name: string, url: string) => settingsManager.addCustomRpcEndpoint(name, url)
  };
}

// Export the settings manager for direct access if needed
export { settingsManager };