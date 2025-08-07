'use client';

import React, { useState, useCallback } from 'react';
import {
  Plus,
  Settings,
  Shield,
  Key,
  Globe,
  Building,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit,
  Trash2,
  TestTube,
  Copy
} from 'lucide-react';
import { useSSO, SSOProvider, SSOProviderConfig } from '@/lib/sso';
import { useI18n } from '@/lib/i18n';
import { useRBAC } from '@/lib/rbac';
import { useAccessibility } from '@/lib/accessibility';

interface ProviderCardProps {
  provider: SSOProviderConfig;
  onEdit: (provider: SSOProviderConfig) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onTest: (id: string) => void;
  onSetPrimary: (id: string) => void;
}

function ProviderCard({ 
  provider, 
  onEdit, 
  onDelete, 
  onToggle, 
  onTest, 
  onSetPrimary 
}: ProviderCardProps) {
  const { t } = useI18n();
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const getProviderIcon = (type: SSOProvider) => {
    switch (type) {
      case 'saml':
        return <Shield className="w-6 h-6" />;
      case 'oauth':
        return <Key className="w-6 h-6" />;
      case 'openid':
        return <Globe className="w-6 h-6" />;
      case 'azure-ad':
        return <Building className="w-6 h-6 text-blue-600" />;
      case 'google':
        return <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">G</div>;
      case 'okta':
        return <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">O</div>;
      case 'auth0':
        return <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">0</div>;
      default:
        return <Settings className="w-6 h-6" />;
    }
  };

  const handleTest = async () => {
    setIsTestingConnection(true);
    try {
      await onTest(provider.id);
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className={`bg-card border rounded-lg p-6 transition-colors ${
      provider.enabled ? 'border-border' : 'border-border opacity-60'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getProviderIcon(provider.type)}
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center space-x-2">
              <span>{provider.name}</span>
              {provider.primary && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                  Primary
                </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground capitalize">
              {provider.type.replace('-', ' ')} Provider
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onToggle(provider.id, !provider.enabled)}
            className={`p-2 rounded-md transition-colors ${
              provider.enabled 
                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
                : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
            title={provider.enabled ? 'Disable Provider' : 'Enable Provider'}
          >
            {provider.enabled ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </button>

          <button
            onClick={() => onEdit(provider)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title="Edit Provider"
          >
            <Edit className="w-5 h-5" />
          </button>

          <button
            onClick={() => onDelete(provider.id)}
            className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            title="Delete Provider"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status:</span>
          <span className={`font-medium ${
            provider.enabled ? 'text-green-600' : 'text-gray-500'
          }`}>
            {provider.enabled ? 'Active' : 'Disabled'}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">User Provisioning:</span>
          <span className={`font-medium ${
            provider.userProvisioning.enabled ? 'text-green-600' : 'text-gray-500'
          }`}>
            {provider.userProvisioning.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Session Timeout:</span>
          <span className="font-medium text-foreground">
            {provider.sessionSettings.timeout} minutes
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={handleTest}
          disabled={!provider.enabled || isTestingConnection}
          className="flex-1 inline-flex items-center justify-center space-x-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <TestTube className="w-4 h-4" />
          <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
        </button>

        {!provider.primary && provider.enabled && (
          <button
            onClick={() => onSetPrimary(provider.id)}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
          >
            Set Primary
          </button>
        )}
      </div>
    </div>
  );
}

interface ProviderFormProps {
  provider?: SSOProviderConfig;
  onSave: (provider: Omit<SSOProviderConfig, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

function ProviderForm({ provider, onSave, onCancel }: ProviderFormProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState<Partial<SSOProviderConfig>>({
    name: provider?.name || '',
    type: provider?.type || 'saml',
    enabled: provider?.enabled ?? true,
    primary: provider?.primary ?? false,
    config: provider?.config || {},
    userProvisioning: provider?.userProvisioning || {
      enabled: true,
      createUsers: true,
      updateUsers: true,
      defaultRole: 'viewer',
    },
    sessionSettings: provider?.sessionSettings || {
      timeout: 480, // 8 hours
      extendOnActivity: true,
      multipleSessionsAllowed: false,
      requireReauth: false,
    },
  });
  
  const [showSecrets, setShowSecrets] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Omit<SSOProviderConfig, 'id' | 'createdAt' | 'updatedAt'>);
  }, [formData, onSave]);

  const updateConfig = useCallback((updates: Record<string, any>) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, ...updates }
    }));
  }, []);

  const renderConfigFields = () => {
    switch (formData.type) {
      case 'saml':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Entity ID
              </label>
              <input
                type="text"
                value={(formData.config as any)?.entityId || ''}
                onChange={(e) => updateConfig({ entityId: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://your-app.com/saml/metadata"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                SSO URL
              </label>
              <input
                type="url"
                value={(formData.config as any)?.ssoUrl || ''}
                onChange={(e) => updateConfig({ ssoUrl: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://idp.example.com/sso/saml"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                X.509 Certificate
              </label>
              <textarea
                value={(formData.config as any)?.certificate || ''}
                onChange={(e) => updateConfig({ certificate: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email Attribute
                </label>
                <input
                  type="text"
                  value={(formData.config as any)?.attributeMapping?.email || 'email'}
                  onChange={(e) => updateConfig({ 
                    attributeMapping: { 
                      ...(formData.config as any)?.attributeMapping,
                      email: e.target.value 
                    }
                  })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  First Name Attribute
                </label>
                <input
                  type="text"
                  value={(formData.config as any)?.attributeMapping?.firstName || 'firstName'}
                  onChange={(e) => updateConfig({ 
                    attributeMapping: { 
                      ...(formData.config as any)?.attributeMapping,
                      firstName: e.target.value 
                    }
                  })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>
        );

      case 'oauth':
      case 'google':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={(formData.config as any)?.clientId || ''}
                  onChange={(e) => updateConfig({ clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Client Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={(formData.config as any)?.clientSecret || ''}
                    onChange={(e) => updateConfig({ clientSecret: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Authorization URL
              </label>
              <input
                type="url"
                value={(formData.config as any)?.authorizationUrl || ''}
                onChange={(e) => updateConfig({ authorizationUrl: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://oauth.example.com/authorize"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Token URL
              </label>
              <input
                type="url"
                value={(formData.config as any)?.tokenUrl || ''}
                onChange={(e) => updateConfig({ tokenUrl: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="https://oauth.example.com/token"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Scopes (comma-separated)
              </label>
              <input
                type="text"
                value={(formData.config as any)?.scope?.join(', ') || ''}
                onChange={(e) => updateConfig({ scope: e.target.value.split(',').map(s => s.trim()) })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="openid, email, profile"
              />
            </div>
          </div>
        );

      case 'azure-ad':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tenant ID
                </label>
                <input
                  type="text"
                  value={(formData.config as any)?.tenantId || ''}
                  onChange={(e) => updateConfig({ tenantId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="common, organizations, or specific tenant ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={(formData.config as any)?.clientId || ''}
                  onChange={(e) => updateConfig({ clientId: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Client Secret
              </label>
              <div className="relative">
                <input
                  type={showSecrets ? "text" : "password"}
                  value={(formData.config as any)?.clientSecret || ''}
                  onChange={(e) => updateConfig({ clientSecret: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Redirect URI
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="url"
                  value={(formData.config as any)?.redirectUri || `${window.location.origin}/auth/callback`}
                  onChange={(e) => updateConfig({ redirectUri: e.target.value })}
                  className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText((formData.config as any)?.redirectUri || `${window.location.origin}/auth/callback`);
                  }}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-md"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Configuration fields will appear based on the selected provider type.
            </p>
          </div>
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Provider Name
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Company SSO"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Provider Type
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              type: e.target.value as SSOProvider,
              config: {} // Reset config when type changes
            }))}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="saml">SAML 2.0</option>
            <option value="oauth">OAuth 2.0</option>
            <option value="openid">OpenID Connect</option>
            <option value="azure-ad">Azure Active Directory</option>
            <option value="google">Google Workspace</option>
            <option value="okta">Okta</option>
            <option value="auth0">Auth0</option>
          </select>
        </div>
      </div>

      <div className="border border-border rounded-lg p-4">
        <h3 className="text-lg font-medium text-foreground mb-4">
          Provider Configuration
        </h3>
        {renderConfigFields()}
      </div>

      <div className="border border-border rounded-lg p-4">
        <h3 className="text-lg font-medium text-foreground mb-4">
          User Provisioning
        </h3>
        
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.userProvisioning?.enabled}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                userProvisioning: {
                  ...prev.userProvisioning!,
                  enabled: e.target.checked
                }
              }))}
              className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
            />
            <span className="text-sm text-foreground">Enable automatic user provisioning</span>
          </label>

          {formData.userProvisioning?.enabled && (
            <>
              <label className="flex items-center space-x-3 ml-7">
                <input
                  type="checkbox"
                  checked={formData.userProvisioning?.createUsers}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    userProvisioning: {
                      ...prev.userProvisioning!,
                      createUsers: e.target.checked
                    }
                  }))}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Create new users automatically</span>
              </label>

              <label className="flex items-center space-x-3 ml-7">
                <input
                  type="checkbox"
                  checked={formData.userProvisioning?.updateUsers}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    userProvisioning: {
                      ...prev.userProvisioning!,
                      updateUsers: e.target.checked
                    }
                  }))}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Update existing users</span>
              </label>

              <div className="ml-7">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Default Role for New Users
                </label>
                <select
                  value={formData.userProvisioning?.defaultRole}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    userProvisioning: {
                      ...prev.userProvisioning!,
                      defaultRole: e.target.value
                    }
                  }))}
                  className="w-48 px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="viewer">Viewer</option>
                  <option value="analyst">Analyst</option>
                  <option value="developer">Developer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-6 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
        >
          Cancel
        </button>
        
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          {provider ? 'Update Provider' : 'Add Provider'}
        </button>
      </div>
    </form>
  );
}

export function SSOConfiguration() {
  const { 
    providers, 
    addProvider, 
    updateProvider, 
    deleteProvider, 
    toggleProvider, 
    setPrimaryProvider,
    testConnection 
  } = useSSO();
  const { t } = useI18n();
  const { hasPermission } = useRBAC();
  const { announceToScreenReader } = useAccessibility();

  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<SSOProviderConfig | null>(null);

  // Check permissions
  const canManageSSO = hasPermission('sso', 'write') || hasPermission('admin', 'write');

  if (!canManageSSO) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t('rbac.accessDenied', 'Access Denied')}
          </h3>
          <p className="text-muted-foreground">
            {t('rbac.insufficientPermissions', "You don't have sufficient permissions to manage SSO configuration.")}
          </p>
        </div>
      </div>
    );
  }

  const handleAddProvider = () => {
    setEditingProvider(null);
    setShowForm(true);
  };

  const handleEditProvider = (provider: SSOProviderConfig) => {
    setEditingProvider(provider);
    setShowForm(true);
  };

  const handleSaveProvider = async (providerData: Omit<SSOProviderConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingProvider) {
        await updateProvider(editingProvider.id, providerData);
        announceToScreenReader('SSO provider updated successfully', 'polite');
      } else {
        await addProvider(providerData);
        announceToScreenReader('SSO provider added successfully', 'polite');
      }
      setShowForm(false);
      setEditingProvider(null);
    } catch (error) {
      console.error('Failed to save provider:', error);
      announceToScreenReader('Failed to save SSO provider', 'assertive');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (confirm('Are you sure you want to delete this SSO provider? This action cannot be undone.')) {
      try {
        await deleteProvider(id);
        announceToScreenReader('SSO provider deleted successfully', 'polite');
      } catch (error) {
        console.error('Failed to delete provider:', error);
        announceToScreenReader('Failed to delete SSO provider', 'assertive');
      }
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const success = await testConnection(id);
      announceToScreenReader(
        success ? 'Connection test successful' : 'Connection test failed',
        success ? 'polite' : 'assertive'
      );
    } catch (error) {
      console.error('Connection test failed:', error);
      announceToScreenReader('Connection test failed', 'assertive');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            SSO Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure enterprise single sign-on providers for secure authentication
          </p>
        </div>
        
        <button
          onClick={handleAddProvider}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Add Provider</span>
        </button>
      </div>

      {/* Provider Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {editingProvider ? 'Edit SSO Provider' : 'Add SSO Provider'}
          </h2>
          
          <ProviderForm
            provider={editingProvider || undefined}
            onSave={handleSaveProvider}
            onCancel={() => {
              setShowForm(false);
              setEditingProvider(null);
            }}
          />
        </div>
      )}

      {/* Providers List */}
      {providers.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-lg">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No SSO Providers Configured
          </h3>
          <p className="text-muted-foreground mb-4">
            Add your first SSO provider to enable enterprise authentication.
          </p>
          <button
            onClick={handleAddProvider}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Provider</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onEdit={handleEditProvider}
              onDelete={handleDeleteProvider}
              onToggle={toggleProvider}
              onTest={handleTestConnection}
              onSetPrimary={setPrimaryProvider}
            />
          ))}
        </div>
      )}

      {/* Integration Guide */}
      <div className="bg-muted/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Integration Guide
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-medium text-foreground mb-2">Callback URLs</h3>
            <code className="text-xs bg-background px-2 py-1 rounded border">
              {window.location.origin}/auth/callback
            </code>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-2">SAML Metadata</h3>
            <code className="text-xs bg-background px-2 py-1 rounded border">
              {window.location.origin}/auth/saml/metadata
            </code>
          </div>
          
          <div>
            <h3 className="font-medium text-foreground mb-2">Logout URLs</h3>
            <code className="text-xs bg-background px-2 py-1 rounded border">
              {window.location.origin}/auth/logout
            </code>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">Important Security Notes:</p>
              <ul className="space-y-1 text-xs">
                <li>• Always use HTTPS in production environments</li>
                <li>• Keep client secrets secure and rotate regularly</li>
                <li>• Test configurations in a staging environment first</li>
                <li>• Monitor authentication logs for suspicious activity</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SSOConfiguration;