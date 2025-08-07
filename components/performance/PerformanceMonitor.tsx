'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePerformance, PerformanceReport } from '@/lib/performance';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Cpu, 
  Download,
  Eye,
  MemoryStick,
  Monitor,
  TrendingUp,
  Zap
} from 'lucide-react';

export function PerformanceMonitor() {
  const {
    metrics,
    isCollecting,
    budget,
    setBudget,
    alerts,
    clearAlerts,
    startCollection,
    stopCollection,
    generateReport,
    getOptimizationSuggestions,
    getMetricsHistory
  } = usePerformance();

  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [showOptimizations, setShowOptimizations] = useState(false);

  useEffect(() => {
    if (metrics) {
      try {
        const newReport = generateReport();
        setReport(newReport);
      } catch (error) {
        console.error('Failed to generate performance report:', error);
      }
    }
  }, [metrics, generateReport]);

  const handleGenerateReport = () => {
    if (metrics) {
      const newReport = generateReport();
      setReport(newReport);
      setShowOptimizations(true);
    }
  };

  const formatTime = (ms: number | null) => {
    if (ms === null) return 'N/A';
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800';
      case 'B': return 'bg-blue-100 text-blue-800';
      case 'C': return 'bg-yellow-100 text-yellow-800';
      case 'D': return 'bg-orange-100 text-orange-800';
      case 'F': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCWVStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Monitor</h1>
          <p className="text-muted-foreground">
            Monitor and optimize OpenSVM performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={isCollecting ? 'destructive' : 'default'}
            onClick={isCollecting ? stopCollection : startCollection}
            className={isCollecting ? 'animate-pulse' : ''}
          >
            {isCollecting ? (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Monitor className="h-4 w-4 mr-2" />
                Start Monitoring
              </>
            )}
          </Button>
          {metrics && (
            <Button variant="outline" onClick={handleGenerateReport}>
              <Download className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {alerts.length} performance {alerts.length === 1 ? 'alert' : 'alerts'} detected
            </span>
            <Button variant="outline" size="sm" onClick={clearAlerts}>
              Clear All
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Performance Overview */}
      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Performance Score</span>
              <Badge className={getGradeColor(report.summary.grade)}>
                Grade {report.summary.grade}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Score</span>
                  <span className={`text-2xl font-bold ${getScoreColor(report.summary.score)}`}>
                    {report.summary.score}/100
                  </span>
                </div>
                <Progress value={report.summary.score} className="w-full" />
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">
                  {report.summary.passedBudgets}/{report.summary.totalBudgets}
                </div>
                <div className="text-xs text-muted-foreground">Budget Passed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics">Core Metrics</TabsTrigger>
          <TabsTrigger value="vitals">Web Vitals</TabsTrigger>
          <TabsTrigger value="budget">Budget Status</TabsTrigger>
          <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Memory Usage */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center">
                  <MemoryStick className="h-4 w-4 mr-2" />
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics ? (
                  <div>
                    <div className="text-2xl font-bold">
                      {formatBytes(metrics.jsHeapSize)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      of {formatBytes(metrics.jsHeapLimit)} available
                    </div>
                    <Progress 
                      value={(metrics.jsHeapSize / metrics.jsHeapLimit) * 100} 
                      className="mt-2" 
                    />
                  </div>
                ) : (
                  <div className="text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>

            {/* DOM Nodes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center">
                  <Eye className="h-4 w-4 mr-2" />
                  DOM Nodes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics ? (
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.domNodes.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total elements
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>

            {/* Resource Timing */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center">
                  <Download className="h-4 w-4 mr-2" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metrics ? (
                  <div>
                    <div className="text-2xl font-bold">
                      {metrics.resourceTiming.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total resources loaded
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vitals" className="space-y-4">
          {report && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">First Contentful Paint</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getCWVStatusColor(report.coreWebVitals.fcp.status)}`}>
                    {formatTime(report.coreWebVitals.fcp.value)}
                  </div>
                  <Badge 
                    variant={report.coreWebVitals.fcp.status === 'good' ? 'default' : 'destructive'}
                    className="text-xs mt-1"
                  >
                    {report.coreWebVitals.fcp.status.replace('-', ' ')}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Largest Contentful Paint</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getCWVStatusColor(report.coreWebVitals.lcp.status)}`}>
                    {formatTime(report.coreWebVitals.lcp.value)}
                  </div>
                  <Badge 
                    variant={report.coreWebVitals.lcp.status === 'good' ? 'default' : 'destructive'}
                    className="text-xs mt-1"
                  >
                    {report.coreWebVitals.lcp.status.replace('-', ' ')}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">First Input Delay</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getCWVStatusColor(report.coreWebVitals.fid.status)}`}>
                    {formatTime(report.coreWebVitals.fid.value)}
                  </div>
                  <Badge 
                    variant={report.coreWebVitals.fid.status === 'good' ? 'default' : 'destructive'}
                    className="text-xs mt-1"
                  >
                    {report.coreWebVitals.fid.status.replace('-', ' ')}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cumulative Layout Shift</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getCWVStatusColor(report.coreWebVitals.cls.status)}`}>
                    {report.coreWebVitals.cls.value?.toFixed(3) ?? 'N/A'}
                  </div>
                  <Badge 
                    variant={report.coreWebVitals.cls.status === 'good' ? 'default' : 'destructive'}
                    className="text-xs mt-1"
                  >
                    {report.coreWebVitals.cls.status.replace('-', ' ')}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          {report && (
            <div className="space-y-4">
              {report.budgetStatus.map((budget, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {budget.status === 'pass' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : budget.status === 'fail' ? (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-medium">{budget.metric}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {budget.impact} impact
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${
                          budget.status === 'pass' ? 'text-green-600' : 
                          budget.status === 'fail' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {budget.value !== null ? formatTime(budget.value) : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Budget: {formatTime(budget.budget)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="optimizations" className="space-y-4">
          <div className="space-y-4">
            {getOptimizationSuggestions().map((suggestion, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4" />
                      <span>{suggestion.title}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Badge 
                        variant={suggestion.priority === 'critical' ? 'destructive' : 
                                suggestion.priority === 'high' ? 'default' : 'secondary'}
                      >
                        {suggestion.priority}
                      </Badge>
                      <Badge variant="outline">
                        {suggestion.effort} effort
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-3">{suggestion.description}</p>
                  <div className="mb-3">
                    <strong>Impact:</strong> {suggestion.impact}
                  </div>
                  <div>
                    <strong>Implementation:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {suggestion.implementation.map((step, stepIndex) => (
                        <li key={stepIndex} className="text-sm text-muted-foreground">
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PerformanceMonitor;