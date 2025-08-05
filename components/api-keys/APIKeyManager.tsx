'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/contexts/AuthContext';
import {
  Plus,
  Trash2,
  Calendar,
  Activity,
  Shield,
  CheckCircle,
  Copy,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface APIKey {
  keyId: string;
  name: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
  isActive: boolean;
  usageStats?: {
    totalRequests: number;
    totalTokensConsumed: number;
    totalSVMAISpent: number;
  };
}

interface APIKeyManagerProps {
  walletAddress: string;
  isMyProfile: boolean;
}

export const APIKeyManager: React.FC<APIKeyManagerProps> = ({
  walletAddress,
  isMyProfile
}) => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const { walletAddress: currentWallet } = useCurrentUser();

  // Only allow viewing if it's the user's own profile
  const canManageKeys = isMyProfile && currentWallet === walletAddress;

  const fetchAPIKeys = useCallback(async () => {
    if (!canManageKeys) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/opensvm/anthropic-keys/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`Failed to fetch API keys: ${response.status}`);
      }

      const data = await response.json();
      setApiKeys(data.keys || []);
    } catch (err) {
      console.error('Error fetching API keys:', err);
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, [canManageKeys]);

  const createAPIKey = async () => {
    if (!newKeyName.trim() || !canManageKeys) return;

    try {
      setCreating(true);
      setError(null);

      const response = await fetch('/api/opensvm/anthropic-keys/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`Failed to create API key: ${response.status}`);
      }

      const data = await response.json();
      setNewlyCreatedKey(data.key);
      setNewKeyName('');
      setShowCreateForm(false);

      // Refresh the list
      await fetchAPIKeys();
    } catch (err) {
      console.error('Error creating API key:', err);
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const deleteAPIKey = async (keyId: string) => {
    if (!canManageKeys) return;

    try {
      setError(null);

      const response = await fetch(`/api/opensvm/anthropic-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete API key: ${response.status}`);
      }

      // Refresh the list
      await fetchAPIKeys();
    } catch (err) {
      console.error('Error deleting API key:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
    }
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    fetchAPIKeys();
  }, [fetchAPIKeys]);

  if (!canManageKeys) {
    return (
      <Card className="border-muted bg-muted/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <Shield className="h-5 w-5" />
            API Key Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              API key management is only available on your own profile.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                API Key Management
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your OpenSVM API keys for accessing the Anthropic proxy service
              </p>
            </div>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="gap-2"
              disabled={loading}
            >
              <Plus className="h-4 w-4" />
              Create New Key
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Create New Key Form */}
      {showCreateForm && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Create New API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., My App Integration"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="mt-1"
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Choose a descriptive name to help you identify this key
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={createAPIKey}
                disabled={!newKeyName.trim() || creating}
                className="gap-2"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {creating ? 'Creating...' : 'Create Key'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName('');
                }}
                disabled={creating}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Newly Created Key Display */}
      {newlyCreatedKey && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              API Key Created Successfully
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-background rounded-md p-3 border">
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono break-all">{newlyCreatedKey}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(newlyCreatedKey, 'new-key')}
                  className="ml-2 gap-1"
                >
                  {copiedKeyId === 'new-key' ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedKeyId === 'new-key' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 dark:bg-yellow-950 dark:border-yellow-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  <p className="font-medium">Important: Save this key now!</p>
                  <p>This is the only time you'll be able to see the full key. Store it securely.</p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setNewlyCreatedKey(null)}
              className="w-full"
            >
              I've saved the key securely
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${apiKeys.length} key${apiKeys.length !== 1 ? 's' : ''} total`}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading API keys...</span>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No API keys yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first API key to start using the OpenSVM API
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.keyId}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{key.name}</h3>
                        <Badge variant={key.isActive ? "default" : "secondary"}>
                          {key.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-mono">{key.keyPreview}</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created {formatDate(key.createdAt)}
                        </div>
                        {key.lastUsedAt && (
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            Last used {formatDate(key.lastUsedAt)}
                          </div>
                        )}
                      </div>
                      {key.usageStats && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span>{key.usageStats.totalRequests} requests</span>
                          <span>{key.usageStats.totalTokensConsumed.toLocaleString()} tokens</span>
                          <span>{key.usageStats.totalSVMAISpent.toFixed(2)} SVMAI</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(key.keyPreview, key.keyId)}
                        className="gap-1"
                      >
                        {copiedKeyId === key.keyId ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {copiedKeyId === key.keyId ? 'Copied' : 'Copy'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteAPIKey(key.keyId)}
                        className="gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Information */}
      <Card>
        <CardHeader>
          <CardTitle>API Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Base URL</h4>
              <code className="bg-muted px-2 py-1 rounded text-xs">
                https://osvm.ai/api/opensvm/
              </code>
            </div>
            <div>
              <h4 className="font-medium mb-2">Authentication</h4>
              <p className="text-muted-foreground">
                Include your API key in the Authorization header:
              </p>
              <code className="bg-muted px-2 py-1 rounded text-xs block mt-1">
                Authorization: Bearer your_api_key_here
              </code>
            </div>
          </div>
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Rate Limits</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 1000 requests per hour per API key</li>
              <li>• Token consumption is charged in SVMAI</li>
              <li>• Unused quota does not roll over</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};