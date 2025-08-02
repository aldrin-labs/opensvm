'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Trash2, Copy, Eye, EyeOff, Plus, Key, TrendingUp, Calendar, Zap, Code, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/lib/settings';

interface APIKey {
    keyId: string;
    name: string;
    keyPrefix: string;
    createdAt: string;
    lastUsedAt?: string;
    isActive: boolean;
    usageStats: {
        totalRequests: number;
        totalTokensConsumed: number;
        totalSVMAISpent: number;
        lastRequestAt?: string;
        averageTokensPerRequest: number;
    };
}

interface NewAPIKey {
    keyId: string;
    apiKey: string;
    keyPrefix: string;
    name: string;
    createdAt: string;
    isActive: boolean;
    usageStats: {
        totalRequests: number;
        totalTokensConsumed: number;
        totalSVMAISpent: number;
        averageTokensPerRequest: number;
    };
}

export default function APIKeyManager() {
    const [keys, setKeys] = useState<APIKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [showNewKey, setShowNewKey] = useState<NewAPIKey | null>(null);
    const [showFullKey, setShowFullKey] = useState<string | null>(null);

    // Get user settings for theme and font
    const settings = useSettings();

    // Theme-aware CSS classes
    const themeClasses = {
        container: "min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8",
        header: "mb-6 sm:mb-8",
        title: "text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 flex-wrap",
        subtitle: "text-muted-foreground mt-2",
        successCard: "border-success/20 bg-success/5",
        successTitle: "text-success flex items-center gap-2",
        keyDisplay: "bg-card border rounded-lg p-3 sm:p-4",
        keyLabel: "text-sm font-medium text-muted-foreground",
        keyCode: "flex-1 px-2 sm:px-3 py-2 bg-muted border rounded text-sm break-all",
        emptyState: "text-center py-8 text-muted-foreground",
        emptyIcon: "h-12 w-12 mx-auto mb-4 text-muted-foreground/50",
        keyCard: "border rounded-lg p-4 hover:bg-muted/50 transition-colors",
        keyName: "font-semibold text-base sm:text-lg",
        keyMeta: "text-sm text-muted-foreground",
        statsGrid: "grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4",
        statCard: "text-center p-2 sm:p-3 bg-muted/30 rounded-lg",
        statIcon: "h-4 w-4",
        statLabel: "text-xs font-medium",
        statValue: "text-sm sm:text-lg font-bold",
        loadingSkeleton: "animate-pulse bg-muted rounded"
    };

    // Apply font family from settings
    const fontClass = settings.fontFamily === 'berkeley' ? 'font-mono' :
        settings.fontFamily === 'jetbrains' ? 'font-mono' :
            'font-sans';

    // Apply font size from settings
    const fontSizeClass = settings.fontSize === 'small' ? 'text-sm' :
        settings.fontSize === 'large' ? 'text-lg' :
            'text-base';

    // Load API keys on component mount
    useEffect(() => {
        loadAPIKeys();
    }, []);

    const loadAPIKeys = async () => {
        try {
            const response = await fetch('/api/opensvm/anthropic-keys', {
                headers: {
                    'x-user-id': 'current-user', // TODO: Get from auth context
                },
            });

            if (response.ok) {
                const data = await response.json();
                setKeys(data.data.keys);
            } else {
                toast.error('Failed to load API keys');
            }
        } catch (error) {
            toast.error('Error loading API keys');
        } finally {
            setLoading(false);
        }
    };

    const createAPIKey = async () => {
        if (!newKeyName.trim()) {
            toast.error('Please enter a key name');
            return;
        }

        setCreating(true);
        try {
            const response = await fetch('/api/opensvm/anthropic-keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': 'current-user', // TODO: Get from auth context
                },
                body: JSON.stringify({ name: newKeyName.trim() }),
            });

            if (response.ok) {
                const data = await response.json();
                setShowNewKey(data.data);
                setNewKeyName('');
                await loadAPIKeys(); // Refresh the list
                toast.success('API key created successfully!');
            } else {
                const error = await response.json();
                toast.error(error.error || 'Failed to create API key');
            }
        } catch (error) {
            toast.error('Error creating API key');
        } finally {
            setCreating(false);
        }
    };

    const deleteAPIKey = async (keyId: string) => {
        if (!confirm(`Are you sure you want to delete the API key? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/opensvm/anthropic-keys/${keyId}`, {
                method: 'DELETE',
                headers: {
                    'x-user-id': 'current-user', // TODO: Get from auth context
                },
            });

            if (response.ok) {
                await loadAPIKeys(); // Refresh the list
                toast.success('API key deleted successfully');
            } else {
                toast.error('Failed to delete API key');
            }
        } catch (error) {
            toast.error('Error deleting API key');
        }
    };

    const copyToClipboard = (text: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        toast.success('Key prefix copied to clipboard!');
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // const formatNumber = (num: number) => {
    //     if (num >= 1000000) {
    //         return (num / 1000000).toFixed(1) + 'M';
    //     } else if (num >= 1000) {
    //         return (num / 1000).toFixed(1) + 'K';
    //     }
    //     return num.toString();
    // };

    const toggleKeyVisibility = (keyId: string) => {
        setShowFullKey(showFullKey === keyId ? null : keyId);
    };

    const viewKeyUsage = (_keyId: string) => {
        // This function is not fully implemented in the new_code,
        // so it will just show a toast for now.
        toast.info('Key usage details not yet available.');
    };

    if (loading) {
        return (
            <div className={`${themeClasses.container} ${fontClass} ${fontSizeClass}`}>
                <div className={themeClasses.header}>
                    <div className={`${themeClasses.loadingSkeleton} h-8 w-1/4`}></div>
                    <div className={`${themeClasses.loadingSkeleton} h-32 mt-4`}></div>
                    <div className={`${themeClasses.loadingSkeleton} h-24 mt-4`}></div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${themeClasses.container} ${fontClass} ${fontSizeClass}`}>
            <div className={themeClasses.header}>
                <h1 className={themeClasses.title}>
                    <Key className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                    Anthropic API Keys
                </h1>
                <p className={themeClasses.subtitle}>
                    Generate and manage API keys for accessing Claude models with SVMAI billing
                </p>
            </div>

            {showNewKey && (
                <Card className={`${themeClasses.successCard} mb-6`}>
                    <CardHeader>
                        <CardTitle className={themeClasses.successTitle}>
                            <Key className="h-5 w-5" />
                            API Key Created Successfully
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={themeClasses.keyDisplay}>
                            <Label className={themeClasses.keyLabel}>Your API Key (save this now - it won't be shown again)</Label>
                            <div className="flex gap-2 mt-2">
                                <code className={`${themeClasses.keyCode} font-mono`}>
                                    {showNewKey.apiKey}
                                </code>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(showNewKey.apiKey)}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Create New Key */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Create New API Key</span>
                        <Button
                            onClick={createAPIKey}
                            disabled={creating || !newKeyName.trim()}
                            size="sm"
                        >
                            {creating ? (
                                <>Creating...</>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Key
                                </>
                            )}
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="keyName" className="text-sm font-medium">
                                Key Name
                            </Label>
                            <Input
                                id="keyName"
                                placeholder="e.g., My App Integration"
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                className="mt-1"
                                disabled={creating}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Existing Keys */}
            <Card>
                <CardHeader>
                    <CardTitle>Your API Keys</CardTitle>
                </CardHeader>
                <CardContent>
                    {keys.length === 0 ? (
                        <div className={themeClasses.emptyState}>
                            <Key className={themeClasses.emptyIcon} />
                            <p className="text-base mb-2">No API keys yet</p>
                            <p className="text-sm">Create your first key to start using the Anthropic API</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {keys.map((key) => (
                                <div key={key.keyId} className={themeClasses.keyCard}>
                                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <h3 className={themeClasses.keyName}>{key.name}</h3>
                                            <Badge
                                                variant={key.isActive ? "default" : "secondary"}
                                                className="mt-2"
                                            >
                                                {key.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <Label className={themeClasses.keyLabel}>API Key</Label>
                                                <div className="flex gap-2 mt-1">
                                                    <code className={`${themeClasses.keyCode} font-mono`}>
                                                        {showFullKey === key.keyId ?
                                                            `sk-ant-api03-${key.keyPrefix}...` :
                                                            `sk-ant-api03-${'•'.repeat(20)}...`
                                                        }
                                                    </code>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => toggleKeyVisibility(key.keyId)}
                                                    >
                                                        {showFullKey === key.keyId ?
                                                            <EyeOff className="h-4 w-4" /> :
                                                            <Eye className="h-4 w-4" />
                                                        }
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => copyToClipboard(`sk-ant-api03-${key.keyPrefix}`)}
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div>
                                                <Label className={themeClasses.keyLabel}>Created</Label>
                                                <div className={`flex items-center gap-1 mt-1 ${themeClasses.keyMeta}`}>
                                                    <Calendar className="h-4 w-4" />
                                                    <span>{formatDate(key.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={themeClasses.statsGrid}>
                                        <div className={themeClasses.statCard}>
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <TrendingUp className={`${themeClasses.statIcon} text-primary`} />
                                                <span className={`${themeClasses.statLabel} text-primary`}>Requests</span>
                                            </div>
                                            <div className={`${themeClasses.statValue} text-primary`}>
                                                {key.usageStats.totalRequests.toLocaleString()}
                                            </div>
                                        </div>

                                        <div className={themeClasses.statCard}>
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <Zap className={`${themeClasses.statIcon} text-secondary`} />
                                                <span className={`${themeClasses.statLabel} text-secondary`}>Tokens</span>
                                            </div>
                                            <div className={`${themeClasses.statValue} text-secondary`}>
                                                {key.usageStats.totalTokensConsumed.toLocaleString()}
                                            </div>
                                        </div>

                                        <div className={themeClasses.statCard}>
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <span className={`${themeClasses.statLabel} text-accent`}>SVMAI</span>
                                            </div>
                                            <div className={`${themeClasses.statValue} text-accent`}>
                                                {key.usageStats.totalSVMAISpent.toFixed(1)}
                                            </div>
                                        </div>

                                        <div className={themeClasses.statCard}>
                                            <div className="flex items-center justify-center gap-1 mb-1">
                                                <span className={`${themeClasses.statLabel} text-muted-foreground`}>Avg/Req</span>
                                            </div>
                                            <div className={`${themeClasses.statValue} text-muted-foreground`}>
                                                {key.usageStats.averageTokensPerRequest.toFixed(0)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-4 border-t">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => viewKeyUsage(key.keyId)}
                                        >
                                            View Usage
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => deleteAPIKey(key.keyId)}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Integration Guide */}
            <Card>
                <CardHeader>
                    <CardTitle>Integration Guide</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <Code className="h-5 w-5 text-primary" />
                                Python (anthropic library)
                            </h3>
                            <pre className={`${themeClasses.keyCode} font-mono`}>
                                {`import anthropic

client = anthropic.Anthropic(
    api_key="sk-ant-api03-your-key-here",
    base_url="https://opensvm.com/v1"
)

message = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello Claude!"}
    ]
)

print(message.content)`}
                            </pre>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <Code className="h-5 w-5 text-secondary" />
                                JavaScript/TypeScript
                            </h3>
                            <pre className={`${themeClasses.keyCode} font-mono`}>
                                {`import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: 'sk-ant-api03-your-key-here',
  baseURL: 'https://opensvm.com/v1'
});

const message = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello Claude!' }
  ]
});

console.log(message.content);`}
                            </pre>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <Terminal className="h-5 w-5 text-accent" />
                                cURL
                            </h3>
                            <pre className={`${themeClasses.keyCode} font-mono`}>
                                {`curl -X POST https://opensvm.com/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-ant-api03-your-key-here" \\
  -d '{
    "model": "claude-3-sonnet-20240229",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello Claude!"}
    ]
  }'`}
                            </pre>
                        </div>

                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="p-4">
                                <h4 className="font-semibold text-primary mb-2">💡 Pro Tips</h4>
                                <ul className="text-sm text-primary/80 space-y-1">
                                    <li>• Store your API key securely in environment variables</li>
                                    <li>• Monitor your usage in the dashboard above</li>
                                    <li>• Use different keys for development and production</li>
                                    <li>• Set up alerts when your balance gets low</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
} 