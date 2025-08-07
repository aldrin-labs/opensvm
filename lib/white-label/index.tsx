'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRBAC } from '@/lib/rbac';
import { useI18n } from '@/lib/i18n';

// White-label configuration types
export interface BrandingConfig {
  // Company Information
  companyName: string;
  companyLogo: string;
  companyLogoLight?: string; // Alternative logo for light themes
  companyLogoDark?: string;  // Alternative logo for dark themes
  favicon: string;

  // Colors and Theming
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;

  // Custom CSS Variables
  customCSS?: Record<string, string>;

  // Typography
  fontFamily: string;
  headingFontFamily?: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };

  // Layout
  borderRadius: string;
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };

  // Shadows
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

export interface CustomizationConfig {
  // Branding
  branding: BrandingConfig;

  // Feature Customization
  features: {
    showBranding: boolean;
    customFooter: boolean;
    customHeader: boolean;
    customSidebar: boolean;
    hideDefaultLogo: boolean;
    customLoginPage: boolean;
    customDashboard: boolean;
  };

  // Content Customization
  content: {
    welcomeMessage?: string;
    customTermsUrl?: string;
    customPrivacyUrl?: string;
    customSupportUrl?: string;
    customDocumentationUrl?: string;
    footerText?: string;
    copyrightText?: string;
  };

  // Domain and URLs
  domain?: string;
  customDomain?: string;
  baseUrl?: string;

  // Advanced Customization
  customComponents?: {
    header?: React.ComponentType;
    footer?: React.ComponentType;
    sidebar?: React.ComponentType;
    loginForm?: React.ComponentType;
    dashboard?: React.ComponentType;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: string;
  tenantId?: string;
}

// Default configuration
const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  companyName: 'OpenSVM',
  companyLogo: '/logo.svg',
  favicon: '/favicon.ico',
  primaryColor: 'hsl(222.2 84% 4.9%)',
  secondaryColor: 'hsl(210 40% 96%)',
  accentColor: 'hsl(222.2 84% 4.9%)',
  backgroundColor: 'hsl(0 0% 100%)',
  surfaceColor: 'hsl(0 0% 100%)',
  textColor: 'hsl(222.2 84% 4.9%)',
  mutedTextColor: 'hsl(215.4 16.3% 46.9%)',
  borderColor: 'hsl(214.3 31.8% 91.4%)',
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  borderRadius: '0.5rem',
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
};

const DEFAULT_CUSTOMIZATION_CONFIG: CustomizationConfig = {
  branding: DEFAULT_BRANDING_CONFIG,
  features: {
    showBranding: true,
    customFooter: false,
    customHeader: false,
    customSidebar: false,
    hideDefaultLogo: false,
    customLoginPage: false,
    customDashboard: false,
  },
  content: {
    welcomeMessage: 'Welcome to OpenSVM',
    footerText: 'Powered by OpenSVM',
    copyrightText: `© ${new Date().getFullYear()} OpenSVM. All rights reserved.`,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  version: '1.0.0',
};

// White-label context
interface WhiteLabelContextType {
  // Configuration
  config: CustomizationConfig;
  isLoading: boolean;
  error: Error | null;

  // Configuration management
  updateConfig: (updates: Partial<CustomizationConfig>) => Promise<void>;
  updateBranding: (branding: Partial<BrandingConfig>) => Promise<void>;
  resetToDefaults: () => Promise<void>;

  // Preview mode
  previewMode: boolean;
  previewConfig: CustomizationConfig | null;
  enablePreview: (config: CustomizationConfig) => void;
  disablePreview: () => void;

  // Theme application
  applyTheme: () => void;
  injectCustomCSS: (css: string) => void;

  // Utilities
  getComputedStyles: () => Record<string, string>;
  exportConfig: () => string;
  importConfig: (configJson: string) => Promise<void>;

  // Tenant-specific
  switchTenant: (tenantId: string) => Promise<void>;
  getTenantConfig: (tenantId: string) => Promise<CustomizationConfig | null>;
}

const WhiteLabelContext = createContext<WhiteLabelContextType | undefined>(undefined);

// Configuration persistence
class ConfigurationStore {
  private static readonly STORAGE_KEY = 'opensvm_white_label_config';
  private static readonly TENANT_CONFIG_PREFIX = 'opensvm_tenant_config_';

  static async saveConfig(config: CustomizationConfig, tenantId?: string): Promise<void> {
    const key = tenantId
      ? `${this.TENANT_CONFIG_PREFIX}${tenantId}`
      : this.STORAGE_KEY;

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify({
          ...config,
          updatedAt: new Date().toISOString(),
        }));
      }

      // Also save to server if tenant-specific
      if (tenantId) {
        await fetch('/api/white-label/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tenantId,
            config: {
              ...config,
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      }
    } catch (error) {
      console.error('Failed to save white-label configuration:', error);
      throw error;
    }
  }

  static async loadConfig(tenantId?: string): Promise<CustomizationConfig> {
    const key = tenantId
      ? `${this.TENANT_CONFIG_PREFIX}${tenantId}`
      : this.STORAGE_KEY;

    try {
      // Try server first for tenant configs
      if (tenantId) {
        try {
          const response = await fetch(`/api/white-label/config/${tenantId}`);
          if (response.ok) {
            const data = await response.json();
            return {
              ...DEFAULT_CUSTOMIZATION_CONFIG,
              ...data,
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.updatedAt),
            };
          }
        } catch (serverError) {
          console.warn('Failed to load config from server, falling back to local storage');
        }
      }

      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            ...DEFAULT_CUSTOMIZATION_CONFIG,
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            updatedAt: new Date(parsed.updatedAt),
          };
        }
      }

      return { ...DEFAULT_CUSTOMIZATION_CONFIG };
    } catch (error) {
      console.error('Failed to load white-label configuration:', error);
      return { ...DEFAULT_CUSTOMIZATION_CONFIG };
    }
  }

  static async deleteConfig(tenantId?: string): Promise<void> {
    const key = tenantId
      ? `${this.TENANT_CONFIG_PREFIX}${tenantId}`
      : this.STORAGE_KEY;

    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }

    if (tenantId) {
      try {
        await fetch(`/api/white-label/config/${tenantId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Failed to delete config from server:', error);
      }
    }
  }
}

// CSS injection utility
class StyleInjector {
  private static styleElement: HTMLStyleElement | null = null;
  private static customStyleElement: HTMLStyleElement | null = null;

  static injectThemeStyles(config: BrandingConfig) {
    if (typeof window === 'undefined') return;

    // Remove existing styles
    if (this.styleElement) {
      this.styleElement.remove();
    }

    // Create new style element
    this.styleElement = document.createElement('style');
    this.styleElement.setAttribute('data-white-label-theme', 'true');

    const cssVariables = this.generateCSSVariables(config);
    this.styleElement.textContent = cssVariables;

    document.head.appendChild(this.styleElement);
  }

  static injectCustomCSS(css: string) {
    if (typeof window === 'undefined') return;

    // Remove existing custom styles
    if (this.customStyleElement) {
      this.customStyleElement.remove();
    }

    // Create new custom style element
    this.customStyleElement = document.createElement('style');
    this.customStyleElement.setAttribute('data-white-label-custom', 'true');
    this.customStyleElement.textContent = css;

    document.head.appendChild(this.customStyleElement);
  }

  static generateCSSVariables(branding: BrandingConfig): string {
    const variables = {
      // Colors
      '--primary': branding.primaryColor,
      '--secondary': branding.secondaryColor,
      '--accent': branding.accentColor,
      '--background': branding.backgroundColor,
      '--surface': branding.surfaceColor,
      '--foreground': branding.textColor,
      '--muted-foreground': branding.mutedTextColor,
      '--border': branding.borderColor,

      // Typography
      '--font-family': branding.fontFamily,
      '--font-family-heading': branding.headingFontFamily || branding.fontFamily,

      // Font sizes
      '--text-xs': branding.fontSize.xs,
      '--text-sm': branding.fontSize.sm,
      '--text-base': branding.fontSize.base,
      '--text-lg': branding.fontSize.lg,
      '--text-xl': branding.fontSize.xl,
      '--text-2xl': branding.fontSize['2xl'],
      '--text-3xl': branding.fontSize['3xl'],
      '--text-4xl': branding.fontSize['4xl'],

      // Spacing
      '--spacing-xs': branding.spacing.xs,
      '--spacing-sm': branding.spacing.sm,
      '--spacing-md': branding.spacing.md,
      '--spacing-lg': branding.spacing.lg,
      '--spacing-xl': branding.spacing.xl,
      '--spacing-2xl': branding.spacing['2xl'],

      // Border radius
      '--radius': branding.borderRadius,

      // Shadows
      '--shadow-sm': branding.shadows.sm,
      '--shadow-md': branding.shadows.md,
      '--shadow-lg': branding.shadows.lg,
      '--shadow-xl': branding.shadows.xl,

      // Custom CSS Variables
      ...branding.customCSS,
    };

    return `:root {
      ${Object.entries(variables)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n')}
    }
    
    /* Apply font family to body */
    body {
      font-family: var(--font-family);
    }
    
    /* Apply heading font family */
    h1, h2, h3, h4, h5, h6 {
      font-family: var(--font-family-heading);
    }`;
  }

  static cleanup() {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
    if (this.customStyleElement) {
      this.customStyleElement.remove();
      this.customStyleElement = null;
    }
  }
}

// White-label provider component
export function WhiteLabelProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CustomizationConfig>(DEFAULT_CUSTOMIZATION_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<CustomizationConfig | null>(null);

  const { t } = useI18n();

  // Handle RBAC context safely - wrap in try-catch to handle SSR
  let currentTenant = null;
  try {
    const rbac = useRBAC();
    currentTenant = rbac.currentTenant;
  } catch (error) {
    // RBAC context not available during SSR, continue with null tenant
    currentTenant = null;
  }

  // Load configuration on mount and tenant change
  useEffect(() => {
    loadConfiguration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id]);

  // Apply theme when config changes
  useEffect(() => {
    applyTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, previewConfig, previewMode]);

  const loadConfiguration = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedConfig = await ConfigurationStore.loadConfig(currentTenant?.id);
      setConfig(loadedConfig);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load white-label configuration:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateConfig = useCallback(async (updates: Partial<CustomizationConfig>) => {
    try {
      const newConfig = {
        ...config,
        ...updates,
        updatedAt: new Date(),
      };

      await ConfigurationStore.saveConfig(newConfig, currentTenant?.id);
      setConfig(newConfig);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [config, currentTenant?.id]);

  const updateBranding = useCallback(async (branding: Partial<BrandingConfig>) => {
    const newConfig = {
      ...config,
      branding: {
        ...config.branding,
        ...branding,
      },
      updatedAt: new Date(),
    };

    try {
      await ConfigurationStore.saveConfig(newConfig, currentTenant?.id);
      setConfig(newConfig);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [config, currentTenant?.id]);

  const resetToDefaults = useCallback(async () => {
    const defaultConfig = {
      ...DEFAULT_CUSTOMIZATION_CONFIG,
      tenantId: currentTenant?.id,
    };

    await ConfigurationStore.saveConfig(defaultConfig, currentTenant?.id);
    setConfig(defaultConfig);
  }, [currentTenant?.id]);

  const enablePreview = useCallback((previewCfg: CustomizationConfig) => {
    setPreviewConfig(previewCfg);
    setPreviewMode(true);
  }, []);

  const disablePreview = useCallback(() => {
    setPreviewConfig(null);
    setPreviewMode(false);
  }, []);

  const applyTheme = useCallback(() => {
    const activeConfig = previewMode && previewConfig ? previewConfig : config;
    StyleInjector.injectThemeStyles(activeConfig.branding);

    // Update document title
    if (activeConfig.branding.companyName) {
      document.title = `${activeConfig.branding.companyName} - OpenSVM`;
    }

    // Update favicon
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon && activeConfig.branding.favicon) {
      favicon.href = activeConfig.branding.favicon;
    }
  }, [config, previewConfig, previewMode]);

  const injectCustomCSS = useCallback((css: string) => {
    StyleInjector.injectCustomCSS(css);
  }, []);

  const getComputedStyles = useCallback((): Record<string, string> => {
    if (typeof window === 'undefined') return {};

    const computedStyle = window.getComputedStyle(document.documentElement);
    const styles: Record<string, string> = {};

    // Get all CSS custom properties
    Array.from(document.styleSheets).forEach(styleSheet => {
      try {
        Array.from(styleSheet.cssRules).forEach(rule => {
          if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
            Array.from(rule.style).forEach(property => {
              if (property.startsWith('--')) {
                styles[property] = computedStyle.getPropertyValue(property).trim();
              }
            });
          }
        });
      } catch (e) {
        // Ignore cross-origin stylesheet errors
      }
    });

    return styles;
  }, []);

  const exportConfig = useCallback((): string => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  const importConfig = useCallback(async (configJson: string) => {
    try {
      const importedConfig = JSON.parse(configJson);

      // Validate imported config
      const validatedConfig = {
        ...DEFAULT_CUSTOMIZATION_CONFIG,
        ...importedConfig,
        tenantId: currentTenant?.id,
        updatedAt: new Date(),
      };

      await updateConfig(validatedConfig);
    } catch (err) {
      setError(new Error('Invalid configuration format'));
      throw err;
    }
  }, [currentTenant?.id, updateConfig]);

  const switchTenant = useCallback(async (tenantId: string) => {
    setIsLoading(true);
    try {
      const tenantConfig = await ConfigurationStore.loadConfig(tenantId);
      setConfig(tenantConfig);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTenantConfig = useCallback(async (tenantId: string): Promise<CustomizationConfig | null> => {
    try {
      return await ConfigurationStore.loadConfig(tenantId);
    } catch (err) {
      console.error('Failed to get tenant configuration:', err);
      return null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      StyleInjector.cleanup();
    };
  }, []);

  const contextValue: WhiteLabelContextType = {
    config,
    isLoading,
    error,
    updateConfig,
    updateBranding,
    resetToDefaults,
    previewMode,
    previewConfig,
    enablePreview,
    disablePreview,
    applyTheme,
    injectCustomCSS,
    getComputedStyles,
    exportConfig,
    importConfig,
    switchTenant,
    getTenantConfig,
  };

  return (
    <WhiteLabelContext.Provider value={contextValue}>
      {children}
    </WhiteLabelContext.Provider>
  );
}

export function useWhiteLabel() {
  const context = useContext(WhiteLabelContext);
  if (context === undefined) {
    throw new Error('useWhiteLabel must be used within a WhiteLabelProvider');
  }
  return context;
}

// Utility components
export const BrandedLogo: React.FC<{ className?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  className = '',
  size = 'md'
}) => {
  const { config } = useWhiteLabel();

  const sizeClasses = {
    sm: 'h-8 w-auto',
    md: 'h-12 w-auto',
    lg: 'h-16 w-auto',
  };

  return (
    <img
      src={config.branding.companyLogo}
      alt={config.branding.companyName}
      className={`${sizeClasses[size]} ${className}`}
    />
  );
};

export const BrandedText: React.FC<{
  children?: React.ReactNode;
  fallback?: string;
  className?: string;
}> = ({
  children,
  fallback = 'OpenSVM',
  className = ''
}) => {
    const { config } = useWhiteLabel();

    return (
      <span className={className}>
        {children || config.branding.companyName || fallback}
      </span>
    );
  };

export default WhiteLabelProvider;