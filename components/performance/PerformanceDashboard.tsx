'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar 
} from 'recharts';
import { 
  Activity, AlertTriangle, CheckCircle, Clock, Memory, 
  Zap, TrendingUp, TrendingDown, Monitor, Cpu, Wifi 
} from 'lucide-react';
import { usePerformance } from '@/contexts/PerformanceContext';
import { PerformanceMetrics, PerformanceAlert } from '@/lib/performance/types';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  status?: 'good' | 'warning' | 'critical';
  description?: string;
}

function MetricCard({ title, value, unit, icon, trend, status = 'good', description }: MetricCardProps) {
  const statusColors = {
    good: 'text-green-600 border-green-200 bg-green-50',
    warning: 'text-yellow-600 border-yellow-200 bg-yellow-50',
    critical: 'text-red-600 border-red-200 bg-red-50',
  };

  const trendIcons = {
    up: <TrendingUp className="h-4 w-4 text-green-500" />,
    down: <TrendingDown className="h-4 w-4 text-red-500" />,
    stable: <Activity className="h-4 w-4 text-gray-500" />,
  };

  return (
    <Card className={`${statusColors[status]} transition-all duration-200`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-bold">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                  {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
                </p>
                {trend && trendIcons[trend]}
              </div>
              {description && (
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AlertsListProps {
  alerts: PerformanceAlert[];
  onResolve: (alertId: string) => void;
  onClear: () => void;
}

function AlertsList({ alerts, onResolve, onClear }: AlertsListProps) {
  const unresolvedAlerts = alerts.filter(alert => !alert.resolved);
  const criticalAlerts = unresolvedAlerts.filter(alert => alert.type === 'critical');
  const warningAlerts = unresolvedAlerts.filter(alert => alert.type === 'warning');

  if (unresolvedAlerts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">All systems operational</p>
          <p className="text-sm text-gray-500">No performance alerts at this time</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Performance Alerts</h3>
        <div className="flex items-center space-x-2">
          <Badge variant="destructive">{criticalAlerts.length} Critical</Badge>
          <Badge variant="outline">{warningAlerts.length} Warning</Badge>
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear All
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {unresolvedAlerts.map((alert) => (
          <Alert key={alert.id} className={
            alert.type === 'critical' ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
          }>
            <AlertTriangle className={`h-4 w-4 ${
              alert.type === 'critical' ? 'text-red-500' : 'text-yellow-500'
            }`} />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <div className="font-medium">{alert.message}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {alert.metric} exceeded threshold of {alert.threshold}
                  <span className="ml-2">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResolve(alert.id)}
                className="ml-4"
              >
                Resolve
              </Button>
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </div>
  );
}

interface MetricsChartProps {
  data: PerformanceMetrics[];
  metric: keyof PerformanceMetrics;
  title: string;
  color: string;
  unit?: string;
}

function MetricsChart({ data, metric, title, color, unit }: MetricsChartProps) {
  const chartData = data.map((item, index) => ({
    index,
    value: typeof item[metric] === 'number' ? item[metric] : 0,
    timestamp: new Date(item.timestamp).toLocaleTimeString(),
  })).slice(-30); // Show last 30 data points

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip 
                labelFormatter={(label) => `Time: ${label}`}
                formatter={(value) => [`${value}${unit || ''}`, title]}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color} 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function PerformanceDashboard() {
  const { monitor, latestMetrics, alerts, isMonitoring, startMonitoring, stopMonitoring, clearAlerts } = usePerformance();
  const [historicalMetrics, setHistoricalMetrics] = useState<PerformanceMetrics[]>([]);

  useEffect(() => {
    const updateMetrics = () => {
      const metrics = monitor.getMetrics(100); // Get last 100 metrics
      setHistoricalMetrics(metrics);
    };

    // Update metrics every 5 seconds
    const interval = setInterval(updateMetrics, 5000);
    updateMetrics(); // Initial update

    return () => clearInterval(interval);
  }, [monitor]);

  const getMetricStatus = (value: number, thresholds: { warning: number; critical: number }): 'good' | 'warning' | 'critical' => {
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return 'good';
  };

  const getFPSStatus = (fps: number): 'good' | 'warning' | 'critical' => {
    if (fps < 15) return 'critical';
    if (fps < 30) return 'warning';
    return 'good';
  };

  const getMemoryUsagePercent = (metrics: PerformanceMetrics): number => {
    const { used, limit } = metrics.memoryUsage;
    return limit > 0 ? (used / limit) * 100 : 0;
  };

  if (!latestMetrics) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">No performance data available</p>
          <p className="text-sm text-gray-500 mb-4">
            {isMonitoring ? 'Collecting initial metrics...' : 'Performance monitoring is not active'}
          </p>
          {!isMonitoring && (
            <Button onClick={startMonitoring}>
              Start Monitoring
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const memoryUsagePercent = getMemoryUsagePercent(latestMetrics);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Dashboard</h2>
          <p className="text-sm text-gray-500">
            Real-time performance metrics and system health
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isMonitoring ? "default" : "secondary"}>
            {isMonitoring ? 'Monitoring Active' : 'Monitoring Inactive'}
          </Badge>
          <Button 
            variant="outline" 
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
          >
            {isMonitoring ? 'Stop' : 'Start'} Monitoring
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Frame Rate"
          value={Math.round(latestMetrics.fps)}
          unit="FPS"
          icon={<Monitor className="h-5 w-5" />}
          status={getFPSStatus(latestMetrics.fps)}
          description="Rendering performance"
        />
        
        <MetricCard
          title="Memory Usage"
          value={Math.round(memoryUsagePercent)}
          unit="%"
          icon={<Memory className="h-5 w-5" />}
          status={getMetricStatus(memoryUsagePercent / 100, { warning: 0.7, critical: 0.9 })}
          description={`${Math.round(latestMetrics.memoryUsage.used / 1024 / 1024)}MB used`}
        />
        
        <MetricCard
          title="API Response"
          value={Math.round(latestMetrics.apiResponseTime)}
          unit="ms"
          icon={<Wifi className="h-5 w-5" />}
          status={getMetricStatus(latestMetrics.apiResponseTime, { warning: 1000, critical: 3000 })}
          description="Average response time"
        />
        
        <MetricCard
          title="Load Time"
          value={Math.round(latestMetrics.loadTime || 0)}
          unit="ms"
          icon={<Clock className="h-5 w-5" />}
          status={getMetricStatus(latestMetrics.loadTime || 0, { warning: 3000, critical: 5000 })}
          description="Initial page load"
        />
      </div>

      {/* Alerts Section */}
      <AlertsList 
        alerts={alerts} 
        onResolve={(alertId) => monitor.resolveAlert(alertId)}
        onClear={clearAlerts}
      />

      {/* Detailed Metrics */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="vitals">Web Vitals</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetricsChart
              data={historicalMetrics}
              metric="fps"
              title="Frame Rate (FPS)"
              color="#3b82f6"
              unit=" FPS"
            />
            <MetricsChart
              data={historicalMetrics}
              metric="apiResponseTime"
              title="API Response Time"
              color="#ef4444"
              unit="ms"
            />
          </div>
        </TabsContent>

        <TabsContent value="network" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetricsChart
              data={historicalMetrics}
              metric="networkLatency"
              title="Network Latency"
              color="#f59e0b"
              unit="ms"
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Network Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Connection Type</span>
                    <Badge variant="outline">
                      {(navigator as any).connection?.effectiveType || 'unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Online Status</span>
                    <Badge variant={navigator.onLine ? "default" : "destructive"}>
                      {navigator.onLine ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Latest Latency</span>
                    <span className="text-sm font-medium">
                      {Math.round(latestMetrics.networkLatency)}ms
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="memory" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Memory Usage Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Used Memory</span>
                      <span className="text-sm font-medium">
                        {Math.round(latestMetrics.memoryUsage.used / 1024 / 1024)}MB
                      </span>
                    </div>
                    <Progress value={memoryUsagePercent} className="h-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Allocated</span>
                      <p className="font-medium">
                        {Math.round(latestMetrics.memoryUsage.total / 1024 / 1024)}MB
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Heap Limit</span>
                      <p className="font-medium">
                        {Math.round(latestMetrics.memoryUsage.limit / 1024 / 1024)}MB
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Memory Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historicalMetrics.slice(-20)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `${Math.round(value / 1024 / 1024)}MB`}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        formatter={(value) => [`${Math.round(Number(value) / 1024 / 1024)}MB`, 'Memory Used']}
                        labelFormatter={(label) => new Date(Number(label)).toLocaleTimeString()}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="memoryUsage.used" 
                        stackId="1"
                        stroke="#8884d8" 
                        fill="#8884d8"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vitals" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">First Contentful Paint</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {Math.round(latestMetrics.firstContentfulPaint || 0)}ms
                </div>
                <Progress 
                  value={Math.min(100, (latestMetrics.firstContentfulPaint || 0) / 40)} 
                  className="h-2"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Good: &lt;1.8s, Needs improvement: 1.8-3s
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Largest Contentful Paint</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {Math.round(latestMetrics.largestContentfulPaint || 0)}ms
                </div>
                <Progress 
                  value={Math.min(100, (latestMetrics.largestContentfulPaint || 0) / 40)} 
                  className="h-2"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Good: &lt;2.5s, Needs improvement: 2.5-4s
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Cumulative Layout Shift</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {(latestMetrics.cumulativeLayoutShift || 0).toFixed(3)}
                </div>
                <Progress 
                  value={Math.min(100, (latestMetrics.cumulativeLayoutShift || 0) * 400)} 
                  className="h-2"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Good: &lt;0.1, Needs improvement: 0.1-0.25
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PerformanceDashboard;