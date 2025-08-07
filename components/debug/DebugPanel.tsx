'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Bug, Settings, Activity, Database, Network, Clock,
  ChevronDown, ChevronRight, Copy, Download, Trash2,
  Eye, EyeOff, Filter, Search, RefreshCw, Terminal, TrendingDown
} from 'lucide-react';
import { usePerformance } from '@/contexts/PerformanceContext';
import { RegressionAlertPanel } from '@/components/performance/RegressionAlertPanel';
import logger from '@/lib/logging/logger';
import { LogEntry } from '@/lib/performance/types';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [componentFilter, setComponentFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateLogs = () => {
      const allLogs = logger.getLogs({ limit: 1000 });
      setLogs(allLogs);
    };

    // Initial load
    updateLogs();

    // Listen for new logs
    const handleNewLog = (event: CustomEvent) => {
      updateLogs();
    };

    window.addEventListener('structured-log', handleNewLog as EventListener);

    // Update every 2 seconds
    const interval = setInterval(updateLogs, 2000);

    return () => {
      window.removeEventListener('structured-log', handleNewLog as EventListener);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let filtered = [...logs];

    // Filter by search term
    if (logFilter.trim()) {
      const searchTerm = logFilter.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm) ||
        log.component?.toLowerCase().includes(searchTerm) ||
        JSON.stringify(log.metadata).toLowerCase().includes(searchTerm)
      );
    }

    // Filter by level
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }

    // Filter by component
    if (componentFilter !== 'all') {
      filtered = filtered.filter(log => log.component === componentFilter);
    }

    setFilteredLogs(filtered);
  }, [logs, logFilter, levelFilter, componentFilter]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const levelColors = {
    debug: 'text-gray-500 bg-gray-100',
    info: 'text-blue-600 bg-blue-100',
    warn: 'text-yellow-600 bg-yellow-100',
    error: 'text-red-600 bg-red-100',
  };

  const getUniqueComponents = () => {
    const components = new Set(logs.map(log => log.component).filter(Boolean));
    return Array.from(components).sort();
  };

  const exportLogs = () => {
    const logData = logger.exportLogs('json');
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opensvm-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyLog = (log: LogEntry) => {
    const logText = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(logText);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-2 flex-wrap">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search logs..."
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            className="w-48"
          />
        </div>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="px-3 py-1 border rounded text-sm"
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
        </select>

        <select
          value={componentFilter}
          onChange={(e) => setComponentFilter(e.target.value)}
          className="px-3 py-1 border rounded text-sm"
        >
          <option value="all">All Components</option>
          {getUniqueComponents().map(component => (
            <option key={component} value={component}>{component}</option>
          ))}
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setAutoScroll(!autoScroll)}
          className="flex items-center space-x-1"
        >
          {autoScroll ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span>Auto-scroll</span>
        </Button>

        <Button variant="outline" size="sm" onClick={exportLogs}>
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>

        <Button variant="outline" size="sm" onClick={() => logger.clearLogs()}>
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Log List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Application Logs ({filteredLogs.length})</span>
            <Badge variant="outline">{logs.length} total</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96" ref={scrollRef}>
            <div className="space-y-1">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No logs match the current filters
                </div>
              ) : (
                filteredLogs.map((log, index) => (
                  <Collapsible key={index}>
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex items-start space-x-2 p-2 hover:bg-gray-50 rounded text-sm">
                        <ChevronRight className="h-3 w-3 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <Badge className={`text-xs ${levelColors[log.level]}`}>
                              {log.level.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            {log.component && (
                              <Badge variant="outline" className="text-xs">
                                {log.component}
                              </Badge>
                            )}
                          </div>
                          <div className="font-mono text-xs mt-1 truncate">
                            {log.message}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLog(log);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-5 p-2 bg-gray-50 rounded text-xs font-mono">
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div className="mb-2">
                            <strong>Metadata:</strong>
                            <pre className="mt-1 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.performance && (
                          <div className="mb-2">
                            <strong>Performance:</strong>
                            <pre className="mt-1 overflow-x-auto">
                              {JSON.stringify(log.performance, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.trace && (
                          <div>
                            <strong>Stack Trace:</strong>
                            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">
                              {log.trace}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function PerformanceDebugger() {
  const { monitor, latestMetrics, alerts } = usePerformance();
  const [customMetrics, setCustomMetrics] = useState<any[]>([]);

  useEffect(() => {
    const handleCustomMetric = (event: CustomEvent) => {
      setCustomMetrics(prev => [...prev, event.detail].slice(-50)); // Keep last 50
    };

    window.addEventListener('performance-custom-metric', handleCustomMetric as EventListener);

    return () => {
      window.removeEventListener('performance-custom-metric', handleCustomMetric as EventListener);
    };
  }, []);

  const testCustomMetric = () => {
    monitor.trackCustomMetric('debug-test', Math.random() * 100, {
      testType: 'manual',
      timestamp: Date.now()
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Current Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {latestMetrics ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>FPS:</span>
                  <span className="font-mono">{latestMetrics.fps.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Memory Usage:</span>
                  <span className="font-mono">
                    {Math.round(latestMetrics.memoryUsage.used / 1024 / 1024)}MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>API Response:</span>
                  <span className="font-mono">{latestMetrics.apiResponseTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Network Latency:</span>
                  <span className="font-mono">{latestMetrics.networkLatency}ms</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No metrics available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Active Performance Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.filter(a => !a.resolved).length > 0 ? (
              <div className="space-y-2">
                {alerts.filter(a => !a.resolved).slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <Badge variant={alert.type === 'critical' ? 'destructive' : 'default'}>
                        {alert.type}
                      </Badge>
                      <span className="truncate">{alert.metric}</span>
                    </div>
                    <span className="font-mono text-xs">
                      {alert.currentValue}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                No active alerts
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custom Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Custom Metrics
            <Button size="sm" onClick={testCustomMetric}>
              Test Metric
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            {customMetrics.length > 0 ? (
              <div className="space-y-1">
                {customMetrics.map((metric, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{metric.name}</span>
                      <span className="text-gray-500">
                        {new Date(metric.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <span className="font-mono">{metric.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No custom metrics recorded
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function ApiDebugger() {
  const [apiCalls, setApiCalls] = useState<any[]>([]);

  useEffect(() => {
    // Mock API call tracking - in a real implementation, this would be integrated with your API layer
    const mockApiCalls = [
      {
        id: '1',
        method: 'GET',
        url: '/api/transaction/abcd1234',
        status: 200,
        duration: 245,
        timestamp: Date.now() - 30000,
        cached: false
      },
      {
        id: '2',
        method: 'POST',
        url: '/api/search/suggestions',
        status: 200,
        duration: 123,
        timestamp: Date.now() - 15000,
        cached: true
      }
    ];

    setApiCalls(mockApiCalls);
  }, []);

  const statusColors = {
    200: 'text-green-600 bg-green-100',
    400: 'text-yellow-600 bg-yellow-100',
    500: 'text-red-600 bg-red-100',
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Recent API Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {apiCalls.map((call) => (
              <Collapsible key={call.id}>
                <CollapsibleTrigger className="w-full text-left">
                  <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{call.method}</Badge>
                      <Badge className={statusColors[call.status as keyof typeof statusColors] || 'text-gray-600 bg-gray-100'}>
                        {call.status}
                      </Badge>
                      <span className="font-mono text-sm">{call.url}</span>
                      {call.cached && (
                        <Badge variant="secondary" className="text-xs">CACHED</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">{call.duration}ms</span>
                      <span className="text-xs text-gray-400">
                        {new Date(call.timestamp).toLocaleTimeString()}
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-3 p-3 bg-gray-50 rounded text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <strong>Request Details:</strong>
                        <div className="mt-1 space-y-1">
                          <div>Method: {call.method}</div>
                          <div>URL: {call.url}</div>
                          <div>Duration: {call.duration}ms</div>
                        </div>
                      </div>
                      <div>
                        <strong>Response:</strong>
                        <div className="mt-1 space-y-1">
                          <div>Status: {call.status}</div>
                          <div>Cached: {call.cached ? 'Yes' : 'No'}</div>
                          <div>Time: {new Date(call.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StateInspector() {
  const [selectedState, setSelectedState] = useState('performance');
  const { monitor, latestMetrics } = usePerformance();

  const stateData = {
    performance: latestMetrics,
    monitor: {
      config: monitor.getConfig(),
      alerts: monitor.getAlerts(true),
    },
    browser: {
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'N/A',
      language: typeof window !== 'undefined' ? navigator.language : 'N/A',
      cookieEnabled: typeof window !== 'undefined' ? navigator.cookieEnabled : false,
      onLine: typeof window !== 'undefined' ? navigator.onLine : false,
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="performance">Performance State</option>
          <option value="monitor">Monitor Config</option>
          <option value="browser">Browser Info</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>State Inspector: {selectedState}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded overflow-auto">
            <pre className="text-sm">
              {JSON.stringify(stateData[selectedState as keyof typeof stateData], null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DebugPanel({ isOpen, onClose }: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState('logs');

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex">
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div className="relative z-50 bg-white shadow-2xl ml-auto w-full max-w-4xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center space-x-2">
            <Bug className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Debug Panel</h2>
            <Badge variant="outline">Development</Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              ×
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-5 rounded-none border-b">
              <TabsTrigger value="logs" className="flex items-center space-x-2">
                <Terminal className="h-4 w-4" />
                <span>Logs</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>Performance</span>
              </TabsTrigger>
              <TabsTrigger value="regression" className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4" />
                <span>Regression</span>
              </TabsTrigger>
              <TabsTrigger value="api" className="flex items-center space-x-2">
                <Network className="h-4 w-4" />
                <span>API</span>
              </TabsTrigger>
              <TabsTrigger value="state" className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span>State</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto p-4">
              <TabsContent value="logs" className="mt-0">
                <LogViewer />
              </TabsContent>

              <TabsContent value="performance" className="mt-0">
                <PerformanceDebugger />
              </TabsContent>

              <TabsContent value="regression" className="mt-0">
                <RegressionAlertPanel />
              </TabsContent>

              <TabsContent value="api" className="mt-0">
                <ApiDebugger />
              </TabsContent>

              <TabsContent value="state" className="mt-0">
                <StateInspector />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default DebugPanel;