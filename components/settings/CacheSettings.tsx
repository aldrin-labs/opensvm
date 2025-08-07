'use client';

import React, { useState, useEffect } from 'react';
import { useCache } from '@/lib/caching';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  HardDrive, 
  Activity,
  Settings,
  Zap
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export function CacheSettings() {
  const { 
    config, 
    stats, 
    updateConfig, 
    getStats,
    resetStats,
    clear,
    cleanup,
    optimize 
  } = useCache();
  const { t } = useI18n();
  const [isClearing, setIsClearing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      // Stats are updated automatically by the cache provider
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async (location?: string) => {
    setIsClearing(true);
    try {
      await clear(location as any);
    } finally {
      setIsClearing(false);
    }
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      await optimize();
    } finally {
      setIsOptimizing(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num));
  };

  return (
    <div className="space-y-6">
      {/* Cache Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Cache Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatNumber(stats.hitRate)}%
              </div>
              <div className="text-sm text-muted-foreground">Hit Rate</div>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {formatNumber(stats.totalRequests)}
              </div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {formatNumber(stats.avgResponseTime)}ms
              </div>
              <div className="text-sm text-muted-foreground">Avg Response Time</div>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">
                {formatNumber(stats.itemCount)}
              </div>
              <div className="text-sm text-muted-foreground">Cached Items</div>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Memory Usage</Label>
              <span className="text-sm text-muted-foreground">
                {formatBytes(stats.memoryUsage)} / {formatBytes(config.maxMemorySize)}
              </span>
            </div>
            <Progress 
              value={(stats.memoryUsage / config.maxMemorySize) * 100} 
              className="w-full" 
            />
          </div>

          {/* Storage Usage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Storage Usage</Label>
              <span className="text-sm text-muted-foreground">
                {formatBytes(stats.storageUsage)} / {formatBytes(config.maxStorageSize)}
              </span>
            </div>
            <Progress 
              value={(stats.storageUsage / config.maxStorageSize) * 100} 
              className="w-full" 
            />
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetStats()}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Stats</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleOptimize}
              disabled={isOptimizing}
              className="flex items-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>{isOptimizing ? 'Optimizing...' : 'Optimize'}</span>
            </Button>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleClearCache()}
              disabled={isClearing}
              className="flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isClearing ? 'Clearing...' : 'Clear All'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cache Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Cache Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cache Strategy */}
          <div className="space-y-2">
            <Label>Cache Strategy</Label>
            <Select 
              value={config.strategy} 
              onValueChange={(value) => updateConfig({ strategy: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cache-first">Cache First</SelectItem>
                <SelectItem value="network-first">Network First</SelectItem>
                <SelectItem value="cache-only">Cache Only</SelectItem>
                <SelectItem value="network-only">Network Only</SelectItem>
                <SelectItem value="stale-while-revalidate">Stale While Revalidate</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose how the cache handles data fetching
            </p>
          </div>

          {/* Default TTL */}
          <div className="space-y-4">
            <Label>
              Default TTL: {Math.round(config.defaultTTL / 1000 / 60)} minutes
            </Label>
            <Slider
              value={[config.defaultTTL]}
              onValueChange={(values) => updateConfig({ defaultTTL: values[0] })}
              max={30 * 60 * 1000} // 30 minutes
              min={30 * 1000} // 30 seconds
              step={30 * 1000} // 30 second steps
              className="w-full"
            />
          </div>

          {/* Memory Limit */}
          <div className="space-y-4">
            <Label>
              Memory Limit: {formatBytes(config.maxMemorySize)}
            </Label>
            <Slider
              value={[config.maxMemorySize]}
              onValueChange={(values) => updateConfig({ maxMemorySize: values[0] })}
              max={200 * 1024 * 1024} // 200MB
              min={10 * 1024 * 1024} // 10MB
              step={10 * 1024 * 1024} // 10MB steps
              className="w-full"
            />
          </div>

          {/* Storage Limit */}
          <div className="space-y-4">
            <Label>
              Storage Limit: {formatBytes(config.maxStorageSize)}
            </Label>
            <Slider
              value={[config.maxStorageSize]}
              onValueChange={(values) => updateConfig({ maxStorageSize: values[0] })}
              max={500 * 1024 * 1024} // 500MB
              min={50 * 1024 * 1024} // 50MB
              step={25 * 1024 * 1024} // 25MB steps
              className="w-full"
            />
          </div>

          {/* Feature Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Compression</Label>
                <p className="text-sm text-muted-foreground">
                  Compress large cache entries to save space
                </p>
              </div>
              <Switch
                checked={config.enableCompression}
                onCheckedChange={(checked) => updateConfig({ enableCompression: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Prefetch</Label>
                <p className="text-sm text-muted-foreground">
                  Prefetch data in the background
                </p>
              </div>
              <Switch
                checked={config.enablePrefetch}
                onCheckedChange={(checked) => updateConfig({ enablePrefetch: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Background Sync</Label>
                <p className="text-sm text-muted-foreground">
                  Sync cache data in the background
                </p>
              </div>
              <Switch
                checked={config.enableBackgroundSync}
                onCheckedChange={(checked) => updateConfig({ enableBackgroundSync: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Analytics</Label>
                <p className="text-sm text-muted-foreground">
                  Collect cache performance metrics
                </p>
              </div>
              <Switch
                checked={config.enableAnalytics}
                onCheckedChange={(checked) => updateConfig({ enableAnalytics: checked })}
              />
            </div>
          </div>

          {/* Cache Locations */}
          <div className="space-y-2">
            <Label>Active Cache Locations</Label>
            <div className="flex flex-wrap gap-2">
              {config.locations.map((location) => (
                <Badge key={location} variant="secondary" className="capitalize">
                  <HardDrive className="w-3 h-3 mr-1" />
                  {location}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Data will be cached in all selected locations
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Cache Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={() => handleClearCache('memory')}
              disabled={isClearing}
              className="flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Memory Cache</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleClearCache('localStorage')}
              disabled={isClearing}
              className="flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Local Storage</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleClearCache('sessionStorage')}
              disabled={isClearing}
              className="flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Session Storage</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleClearCache('indexedDB')}
              disabled={isClearing}
              className="flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear IndexedDB</span>
            </Button>
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => cleanup()}
              className="w-full flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Run Cleanup (Remove Expired Items)</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CacheSettings;