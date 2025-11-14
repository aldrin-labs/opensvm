'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    aiService: {
      available: boolean;
      responseTime?: number;
      error?: string;
    };
    dependencies: {
      openRouter: boolean;
      solanaRPC: boolean;
    };
  };
  metrics?: {
    uptime: number;
    requestCount: number;
    errorRate: string;
    averageResponseTime: number;
  };
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function AIServiceHealthDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = async () => {
    try {
      setError(null);
      const response = await fetch('/api/health/ai-service');
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchHealth, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status?: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status?: 'healthy' | 'degraded' | 'unhealthy') => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500">Degraded</Badge>;
      case 'unhealthy':
        return <Badge className="bg-red-500">Unhealthy</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Service Health</CardTitle>
          <CardDescription>Loading health status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Service Health</CardTitle>
          <CardDescription className="text-red-500">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchHealth} size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!health) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Service Health</CardTitle>
              <CardDescription>
                Last updated: {new Date(health.timestamp).toLocaleTimeString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(health.status)}
              <div className={`w-3 h-3 rounded-full ${getStatusColor(health.status)} animate-pulse`} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Button
              onClick={fetchHealth}
              size="sm"
              variant="outline"
            >
              Refresh Now
            </Button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh (10s)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Service Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Service Checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI Service */}
          <div className="flex items-start justify-between p-3 border rounded">
            <div className="flex-1">
              <div className="font-medium">AI Service</div>
              {health.checks.aiService.available ? (
                <div className="text-sm text-muted-foreground">
                  Response time: {health.checks.aiService.responseTime}ms
                </div>
              ) : (
                <div className="text-sm text-red-500">
                  {health.checks.aiService.error || 'Service unavailable'}
                </div>
              )}
            </div>
            {health.checks.aiService.available ? (
              <Badge className="bg-green-500">Available</Badge>
            ) : (
              <Badge className="bg-red-500">Unavailable</Badge>
            )}
          </div>

          {/* OpenRouter API */}
          <div className="flex items-start justify-between p-3 border rounded">
            <div className="flex-1">
              <div className="font-medium">OpenRouter API</div>
              <div className="text-sm text-muted-foreground">
                API key configuration
              </div>
            </div>
            {health.checks.dependencies.openRouter ? (
              <Badge className="bg-green-500">Configured</Badge>
            ) : (
              <Badge className="bg-red-500">Missing</Badge>
            )}
          </div>

          {/* Solana RPC */}
          <div className="flex items-start justify-between p-3 border rounded">
            <div className="flex-1">
              <div className="font-medium">Solana RPC</div>
              <div className="text-sm text-muted-foreground">
                Blockchain connection
              </div>
            </div>
            {health.checks.dependencies.solanaRPC ? (
              <Badge className="bg-green-500">Configured</Badge>
            ) : (
              <Badge className="bg-yellow-500">Not Configured</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      {health.metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded">
                <div className="text-sm text-muted-foreground">Uptime</div>
                <div className="text-2xl font-bold">
                  {formatUptime(health.metrics.uptime)}
                </div>
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm text-muted-foreground">Total Requests</div>
                <div className="text-2xl font-bold">
                  {health.metrics.requestCount.toLocaleString()}
                </div>
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm text-muted-foreground">Error Rate</div>
                <div className={`text-2xl font-bold ${parseFloat(health.metrics.errorRate) > 10 ? 'text-red-500' : 'text-green-500'}`}>
                  {health.metrics.errorRate}%
                </div>
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm text-muted-foreground">Avg Response Time</div>
                <div className={`text-2xl font-bold ${health.metrics.averageResponseTime > 3000 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {health.metrics.averageResponseTime}ms
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>Status Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Badge className="bg-green-500">Healthy</Badge>
            <span className="text-muted-foreground">
              Service available and responding quickly (&lt; 3s)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-yellow-500">Degraded</Badge>
            <span className="text-muted-foreground">
              Service available but responding slowly (≥ 3s)
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-red-500">Unhealthy</Badge>
            <span className="text-muted-foreground">
              Service unavailable or critical dependencies missing
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
