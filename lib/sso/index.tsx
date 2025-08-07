'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRBAC } from '@/lib/rbac';
import { useI18n } from '@/lib/i18n';
import { useErrorHandling } from '@/lib/error-handling';

// SSO Provider Types
export type SSOProvider = 'saml' | 'oauth' | 'openid' | 'azure-ad' | 'google' | 'okta' | 'auth0';

export type SSOStatus = 'idle' | 'authenticating' | 'authenticated' | 'error' | 'expired';

// SSO Configuration interfaces
export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  attributeMapping: {
    email: string;
    firstName: string;
    lastName: string;
    groups?: string;
    roles?: string;
  };
  signRequests?: boolean;
  encryptAssertions?: boolean;
  nameIdFormat?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
  redirectUri: string;
  responseType: 'code' | 'token';
  grantType: 'authorization_code' | 'implicit';
  pkce?: boolean;
  additionalParams?: Record<string, string>;
}

export interface OpenIDConfig {
  clientId: string;
  clientSecret: string;
  issuer: string;
  discoveryUrl: string;
  redirectUri: string;
  scope: string[];
  responseType: string[];
  responseMode?: 'query' | 'fragment' | 'form_post';
  pkce?: boolean;
  maxAge?: number;
}

export interface AzureADConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  loginHint?: string;
  domainHint?: string;
}

export type SSOConfig = {
  saml: SAMLConfig;
  oauth: OAuthConfig;
  openid: OpenIDConfig;
  'azure-ad': AzureADConfig;
  google: OAuthConfig;
  okta: OpenIDConfig;
  auth0: OpenIDConfig;
};

export interface SSOProviderConfig<T extends SSOProvider = SSOProvider> {
  id: string;
  name: string;
  type: T;
  enabled: boolean;
  primary?: boolean;
  config: SSOConfig[T];
  userProvisioning: {
    enabled: boolean;
    createUsers: boolean;
    updateUsers: boolean;
    defaultRole: string;
    roleMapping?: Record<string, string>;
    groupMapping?: Record<string, string[]>;
  };
  sessionSettings: {
    timeout: number; // minutes
    extendOnActivity: boolean;
    multipleSessionsAllowed: boolean;
    requireReauth: boolean;
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// User info from SSO providers
export interface SSOUserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  groups: string[];
  roles: string[];
  attributes: Record<string, any>;
  provider: SSOProvider;
  providerId: string;
  lastLogin: Date;
}

// Authentication result
export interface SSOAuthResult {
  success: boolean;
  user?: SSOUserInfo;
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresIn: number;
    tokenType: string;
  };
  error?: string;
  provider: SSOProvider;
  providerId: string;
}

// SSO Context
interface SSOContextType {
  // State
  isInitialized: boolean;
  providers: SSOProviderConfig[];
  activeProvider: SSOProviderConfig | null;
  status: SSOStatus;
  user: SSOUserInfo | null;
  error: Error | null;
  
  // Configuration management
  addProvider: (provider: Omit<SSOProviderConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProvider: (id: string, updates: Partial<SSOProviderConfig>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  toggleProvider: (id: string, enabled: boolean) => Promise<void>;
  setPrimaryProvider: (id: string) => Promise<void>;
  
  // Authentication
  initiateSSO: (providerId: string, redirectTo?: string) => Promise<void>;
  handleCallback: (provider: SSOProvider, code: string, state?: string) => Promise<SSOAuthResult>;
  logout: (providerId?: string) => Promise<void>;
  refreshToken: (providerId: string) => Promise<boolean>;
  
  // Session management
  validateSession: () => Promise<boolean>;
  extendSession: (providerId: string) => Promise<void>;
  terminateAllSessions: () => Promise<void>;
  
  // Utilities
  getProviderLoginUrl: (providerId: string, redirectTo?: string) => string;
  getProviderMetadata: (providerId: string) => Promise<Record<string, any>>;
  testConnection: (providerId: string) => Promise<boolean>;
}

const SSOContext = createContext<SSOContextType | undefined>(undefined);

// SSO Service class
class SSOService {
  private static providers = new Map<string, SSOProviderConfig>();
  private static listeners = new Set<(providers: SSOProviderConfig[]) => void>();

  // Provider management
  static addProvider(provider: Omit<SSOProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `sso-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullProvider: SSOProviderConfig = {
      ...provider,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.providers.set(id, fullProvider);
    this.notifyListeners();
    this.persistProviders();
    
    return id;
  }

  static updateProvider(id: string, updates: Partial<SSOProviderConfig>): void {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Provider ${id} not found`);
    
    const updatedProvider = {
      ...provider,
      ...updates,
      id, // Ensure ID doesn't change
      createdAt: provider.createdAt, // Preserve creation date
      updatedAt: new Date(),
    };
    
    this.providers.set(id, updatedProvider);
    this.notifyListeners();
    this.persistProviders();
  }

  static deleteProvider(id: string): void {
    if (!this.providers.has(id)) throw new Error(`Provider ${id} not found`);
    
    this.providers.delete(id);
    this.notifyListeners();
    this.persistProviders();
  }

  static getProvider(id: string): SSOProviderConfig | undefined {
    return this.providers.get(id);
  }

  static getAllProviders(): SSOProviderConfig[] {
    return Array.from(this.providers.values());
  }

  static getEnabledProviders(): SSOProviderConfig[] {
    return this.getAllProviders().filter(p => p.enabled);
  }

  static getPrimaryProvider(): SSOProviderConfig | undefined {
    return this.getAllProviders().find(p => p.primary && p.enabled);
  }

  static setPrimaryProvider(id: string): void {
    // Clear existing primary
    this.providers.forEach(provider => {
      if (provider.primary) {
        this.updateProvider(provider.id, { primary: false });
      }
    });
    
    // Set new primary
    this.updateProvider(id, { primary: true });
  }

  // Persistence
  private static async persistProviders(): Promise<void> {
    try {
      const providersData = Array.from(this.providers.values()).map(provider => ({
        ...provider,
        createdAt: provider.createdAt.toISOString(),
        updatedAt: provider.updatedAt.toISOString(),
      }));
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('opensvm_sso_providers', JSON.stringify(providersData));
      }
      
      // Also save to server
      await fetch('/api/sso/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(providersData),
      }).catch(err => console.warn('Failed to sync SSO providers to server:', err));
    } catch (error) {
      console.error('Failed to persist SSO providers:', error);
    }
  }

  private static async loadProviders(): Promise<void> {
    try {
      // Try server first
      try {
        const response = await fetch('/api/sso/providers');
        if (response.ok) {
          const providersData = await response.json();
          this.providers.clear();
          providersData.forEach((data: any) => {
            this.providers.set(data.id, {
              ...data,
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.updatedAt),
            });
          });
          return;
        }
      } catch (serverError) {
        console.warn('Failed to load SSO providers from server, using local storage');
      }
      
      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('opensvm_sso_providers');
        if (stored) {
          const providersData = JSON.parse(stored);
          this.providers.clear();
          providersData.forEach((data: any) => {
            this.providers.set(data.id, {
              ...data,
              createdAt: new Date(data.createdAt),
              updatedAt: new Date(data.updatedAt),
            });
          });
        }
      }
    } catch (error) {
      console.error('Failed to load SSO providers:', error);
    }
  }

  private static notifyListeners(): void {
    const providers = this.getAllProviders();
    this.listeners.forEach(listener => {
      try {
        listener(providers);
      } catch (error) {
        console.error('SSO listener error:', error);
      }
    });
  }

  static subscribe(listener: (providers: SSOProviderConfig[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  static async initialize(): Promise<void> {
    await this.loadProviders();
    this.notifyListeners();
  }
}

// Authentication handlers for different providers
class SSOAuthHandlers {
  // SAML Authentication
  static async initiateSAML(provider: SSOProviderConfig<'saml'>, redirectTo?: string): Promise<void> {
    const config = provider.config as SAMLConfig;
    const state = redirectTo ? btoa(JSON.stringify({ redirectTo, provider: provider.id })) : '';
    
    // Build SAML AuthnRequest
    const authnRequest = this.buildSAMLAuthnRequest(config, state);
    const encodedRequest = btoa(authnRequest);
    
    // Redirect to SAML SSO URL
    const ssoUrl = new URL(config.ssoUrl);
    ssoUrl.searchParams.set('SAMLRequest', encodedRequest);
    if (state) ssoUrl.searchParams.set('RelayState', state);
    
    window.location.href = ssoUrl.toString();
  }

  private static buildSAMLAuthnRequest(config: SAMLConfig, relayState?: string): string {
    const requestId = `_${Date.now()}-${Math.random().toString(36).substr(2)}`;
    const issueInstant = new Date().toISOString();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${config.ssoUrl}"
  AssertionConsumerServiceURL="${window.location.origin}/auth/saml/callback"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${config.entityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="${config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'}" AllowCreate="true"/>
</samlp:AuthnRequest>`;
  }

  // OAuth 2.0 Authentication
  static async initiateOAuth(provider: SSOProviderConfig<'oauth'>, redirectTo?: string): Promise<void> {
    const config = provider.config as OAuthConfig;
    const state = JSON.stringify({ redirectTo, provider: provider.id, nonce: Math.random().toString(36) });
    
    const authUrl = new URL(config.authorizationUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('response_type', config.responseType);
    authUrl.searchParams.set('scope', config.scope.join(' '));
    authUrl.searchParams.set('state', btoa(state));
    
    // Add PKCE if enabled
    if (config.pkce) {
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      
      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }
    
    // Add additional parameters
    if (config.additionalParams) {
      Object.entries(config.additionalParams).forEach(([key, value]) => {
        authUrl.searchParams.set(key, value);
      });
    }
    
    window.location.href = authUrl.toString();
  }

  // OpenID Connect Authentication
  static async initiateOpenID(provider: SSOProviderConfig<'openid'>, redirectTo?: string): Promise<void> {
    const config = provider.config as OpenIDConfig;
    
    // Discover OpenID configuration if needed
    let authUrl: string;
    let tokenUrl: string;
    
    if (config.discoveryUrl) {
      try {
        const discovery = await fetch(config.discoveryUrl).then(r => r.json());
        authUrl = discovery.authorization_endpoint;
        tokenUrl = discovery.token_endpoint;
      } catch (error) {
        throw new Error('Failed to discover OpenID endpoints');
      }
    } else {
      authUrl = `${config.issuer}/oauth/authorize`;
      tokenUrl = `${config.issuer}/oauth/token`;
    }
    
    const state = JSON.stringify({ redirectTo, provider: provider.id, nonce: Math.random().toString(36) });
    const nonce = Math.random().toString(36).substr(2);
    
    const url = new URL(authUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', config.responseType.join(' '));
    url.searchParams.set('scope', config.scope.join(' '));
    url.searchParams.set('state', btoa(state));
    url.searchParams.set('nonce', nonce);
    
    if (config.responseMode) {
      url.searchParams.set('response_mode', config.responseMode);
    }
    
    if (config.maxAge) {
      url.searchParams.set('max_age', config.maxAge.toString());
    }
    
    // Store nonce for validation
    sessionStorage.setItem('oidc_nonce', nonce);
    
    window.location.href = url.toString();
  }

  // Azure AD Authentication
  static async initiateAzureAD(provider: SSOProviderConfig<'azure-ad'>, redirectTo?: string): Promise<void> {
    const config = provider.config as AzureADConfig;
    const state = JSON.stringify({ redirectTo, provider: provider.id, nonce: Math.random().toString(36) });
    
    const authUrl = new URL(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('scope', config.scope.join(' '));
    authUrl.searchParams.set('state', btoa(state));
    
    if (config.prompt) {
      authUrl.searchParams.set('prompt', config.prompt);
    }
    
    if (config.loginHint) {
      authUrl.searchParams.set('login_hint', config.loginHint);
    }
    
    if (config.domainHint) {
      authUrl.searchParams.set('domain_hint', config.domainHint);
    }
    
    window.location.href = authUrl.toString();
  }

  // PKCE helpers
  private static generateCodeVerifier(): string {
    const array = new Uint32Array(56/2);
    crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
  }

  private static async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

// SSO Provider component
export function SSOProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [providers, setProviders] = useState<SSOProviderConfig[]>([]);
  const [activeProvider, setActiveProvider] = useState<SSOProviderConfig | null>(null);
  const [status, setStatus] = useState<SSOStatus>('idle');
  const [user, setUser] = useState<SSOUserInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { reportError } = useErrorHandling();
  const { t } = useI18n();

  // Initialize SSO service
  useEffect(() => {
    const initialize = async () => {
      try {
        await SSOService.initialize();
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize SSO service:', err);
        reportError(err as Error, { component: 'SSOProvider' });
      }
    };

    initialize();
  }, [reportError]);

  // Subscribe to provider changes
  useEffect(() => {
    const unsubscribe = SSOService.subscribe(setProviders);
    return unsubscribe;
  }, []);

  // Provider management methods
  const addProvider = useCallback(async (provider: Omit<SSOProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    try {
      return SSOService.addProvider(provider);
    } catch (err) {
      reportError(err as Error, { action: 'addProvider' });
      throw err;
    }
  }, [reportError]);

  const updateProvider = useCallback(async (id: string, updates: Partial<SSOProviderConfig>): Promise<void> => {
    try {
      SSOService.updateProvider(id, updates);
    } catch (err) {
      reportError(err as Error, { action: 'updateProvider', providerId: id });
      throw err;
    }
  }, [reportError]);

  const deleteProvider = useCallback(async (id: string): Promise<void> => {
    try {
      SSOService.deleteProvider(id);
    } catch (err) {
      reportError(err as Error, { action: 'deleteProvider', providerId: id });
      throw err;
    }
  }, [reportError]);

  const toggleProvider = useCallback(async (id: string, enabled: boolean): Promise<void> => {
    try {
      await updateProvider(id, { enabled });
    } catch (err) {
      reportError(err as Error, { action: 'toggleProvider', providerId: id });
      throw err;
    }
  }, [updateProvider, reportError]);

  const setPrimaryProvider = useCallback(async (id: string): Promise<void> => {
    try {
      SSOService.setPrimaryProvider(id);
    } catch (err) {
      reportError(err as Error, { action: 'setPrimaryProvider', providerId: id });
      throw err;
    }
  }, [reportError]);

  // Authentication methods
  const initiateSSO = useCallback(async (providerId: string, redirectTo?: string): Promise<void> => {
    try {
      setStatus('authenticating');
      setError(null);
      
      const provider = SSOService.getProvider(providerId);
      if (!provider || !provider.enabled) {
        throw new Error(`Provider ${providerId} not found or disabled`);
      }
      
      setActiveProvider(provider);
      
      switch (provider.type) {
        case 'saml':
          await SSOAuthHandlers.initiateSAML(provider as SSOProviderConfig<'saml'>, redirectTo);
          break;
        case 'oauth':
        case 'google':
          await SSOAuthHandlers.initiateOAuth(provider as SSOProviderConfig<'oauth'>, redirectTo);
          break;
        case 'openid':
        case 'okta':
        case 'auth0':
          await SSOAuthHandlers.initiateOpenID(provider as SSOProviderConfig<'openid'>, redirectTo);
          break;
        case 'azure-ad':
          await SSOAuthHandlers.initiateAzureAD(provider as SSOProviderConfig<'azure-ad'>, redirectTo);
          break;
        default:
          throw new Error(`Unsupported provider type: ${provider.type}`);
      }
    } catch (err) {
      setStatus('error');
      setError(err as Error);
      reportError(err as Error, { action: 'initiateSSO', providerId });
      throw err;
    }
  }, [reportError]);

  // Placeholder implementations for other methods
  const handleCallback = useCallback(async (provider: SSOProvider, code: string, state?: string): Promise<SSOAuthResult> => {
    // Implementation would handle callback processing
    throw new Error('Not implemented');
  }, []);

  const logout = useCallback(async (providerId?: string): Promise<void> => {
    setUser(null);
    setActiveProvider(null);
    setStatus('idle');
  }, []);

  const refreshToken = useCallback(async (providerId: string): Promise<boolean> => {
    return false; // Placeholder
  }, []);

  const validateSession = useCallback(async (): Promise<boolean> => {
    return false; // Placeholder
  }, []);

  const extendSession = useCallback(async (providerId: string): Promise<void> => {
    // Placeholder
  }, []);

  const terminateAllSessions = useCallback(async (): Promise<void> => {
    // Placeholder
  }, []);

  const getProviderLoginUrl = useCallback((providerId: string, redirectTo?: string): string => {
    return `/auth/sso/${providerId}${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`;
  }, []);

  const getProviderMetadata = useCallback(async (providerId: string): Promise<Record<string, any>> => {
    return {}; // Placeholder
  }, []);

  const testConnection = useCallback(async (providerId: string): Promise<boolean> => {
    return false; // Placeholder
  }, []);

  const contextValue: SSOContextType = {
    isInitialized,
    providers,
    activeProvider,
    status,
    user,
    error,
    addProvider,
    updateProvider,
    deleteProvider,
    toggleProvider,
    setPrimaryProvider,
    initiateSSO,
    handleCallback,
    logout,
    refreshToken,
    validateSession,
    extendSession,
    terminateAllSessions,
    getProviderLoginUrl,
    getProviderMetadata,
    testConnection,
  };

  return (
    <SSOContext.Provider value={contextValue}>
      {children}
    </SSOContext.Provider>
  );
}

export function useSSO() {
  const context = useContext(SSOContext);
  if (context === undefined) {
    throw new Error('useSSO must be used within an SSOProvider');
  }
  return context;
}

export { SSOService, SSOAuthHandlers };
export default SSOProvider;