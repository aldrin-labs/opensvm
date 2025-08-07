'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  usePerformanceTesting,
  getAllTestSuites,
  TestSuiteResults,
  PerformanceTestSuite
} from '@/lib/performance/testing';
import {
  Play,
  Square,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Download,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

export function PerformanceTestRunner() {
  const {
    isRunning,
    currentTest,
    results,
    progress,
    runTestSuite,
    runAllSuites,
  } = usePerformanceTesting();

  const [selectedSuites, setSelectedSuites] = useState<string[]>([]);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const testSuites = getAllTestSuites();

  const handleRunSuite = async (suite: PerformanceTestSuite) => {
    await runTestSuite(suite);
  };

  const handleRunAll = async () => {
    const suitesToRun = selectedSuites.length > 0 
      ? testSuites.filter(suite => selectedSuites.includes(suite.id))
      : testSuites;
    
    await runAllSuites(suitesToRun);
  };

  const toggleSuiteSelection = (suiteId: string) => {
    setSelectedSuites(prev => 
      prev.includes(suiteId)
        ? prev.filter(id => id !== suiteId)
        : [...prev, suiteId]
    );
  };

  const toggleResultExpansion = (suiteId: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(suiteId)) {
        next.delete(suiteId);
      } else {
        next.add(suiteId);
      }
      return next;
    });
  };

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case 'ms':
        return `${Math.round(value)}ms`;
      case 'bytes':
        if (value >= 1024 * 1024) {
          return `${(value / 1024 / 1024).toFixed(1)}MB`;
        } else if (value >= 1024) {
          return `${(value / 1024).toFixed(1)}KB`;
        }
        return `${value}B`;
      case 'score':
        return value.toString();
      default:
        return `${value} ${unit}`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
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

  const exportResults = () => {
    const allResults = Array.from(results.values());
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: allResults.length,
        passedSuites: allResults.filter(r => r.summary.status === 'passed').length,
        overallScore: allResults.length > 0 
          ? Math.round(allResults.reduce((sum, r) => sum + r.summary.score, 0) / allResults.length)
          : 0,
      },
      results: allResults.map(result => ({
        suite: result.suiteName,
        score: result.summary.score,
        grade: result.summary.grade,
        status: result.summary.status,
        duration: result.duration,
        tests: Array.from(result.results.entries()).map(([testId, testResult]) => ({
          id: testId,
          passed: testResult.passed,
          value: testResult.value,
          unit: testResult.unit,
          message: testResult.message,
          duration: testResult.duration,
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-test-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Test Runner</h1>
          <p className="text-muted-foreground">
            Run automated performance tests and benchmarks
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={exportResults}
            disabled={results.size === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Results
          </Button>
          <Button
            onClick={handleRunAll}
            disabled={isRunning}
            className={isRunning ? 'animate-pulse' : ''}
          >
            {isRunning ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Running Tests...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run {selectedSuites.length > 0 ? 'Selected' : 'All'} Tests
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Current Progress */}
      {isRunning && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {currentTest ? `Running: ${currentTest}` : 'Initializing tests...'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <Progress 
                value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} 
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="suites" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="suites">Test Suites</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="suites" className="space-y-4">
          {/* Suite Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Test Suite Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {testSuites.map(suite => (
                  <div key={suite.id} className="space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSuites.includes(suite.id)}
                        onChange={() => toggleSuiteSelection(suite.id)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">{suite.name}</span>
                    </label>
                    <p className="text-xs text-muted-foreground">{suite.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {suite.tests.filter(t => !t.skip).length} tests
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRunSuite(suite)}
                        disabled={isRunning}
                        className="h-6 px-2"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Run
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Individual Test Suites */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testSuites.map(suite => (
              <Card key={suite.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    {suite.name}
                    {results.has(suite.id) && (
                      <Badge className={getGradeColor(results.get(suite.id)!.summary.grade)}>
                        {results.get(suite.id)!.summary.grade}
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{suite.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Tests: {suite.tests.filter(t => !t.skip).length}</span>
                      <span>Skipped: {suite.tests.filter(t => t.skip).length}</span>
                    </div>
                    
                    {results.has(suite.id) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Score:</span>
                          <span className={`font-bold ${getStatusColor(results.get(suite.id)!.summary.status)}`}>
                            {results.get(suite.id)!.summary.score}/100
                          </span>
                        </div>
                        <Progress value={results.get(suite.id)!.summary.score} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                          Duration: {Math.round(results.get(suite.id)!.duration)}ms
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      {suite.tests.slice(0, 3).map(test => (
                        <div key={test.id} className="flex items-center justify-between text-xs">
                          <span className="truncate">{test.name}</span>
                          {results.has(suite.id) && results.get(suite.id)!.results.has(test.id) && (
                            <div className="flex items-center space-x-1">
                              {results.get(suite.id)!.results.get(test.id)!.passed ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {suite.tests.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{suite.tests.length - 3} more tests
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {results.size === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No test results yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Run some performance tests to see detailed results here
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Overall Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Test Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {Array.from(results.values()).length}
                      </div>
                      <div className="text-xs text-muted-foreground">Test Suites</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {Array.from(results.values()).filter(r => r.summary.status === 'passed').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Passed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {Array.from(results.values()).filter(r => r.summary.status === 'warning').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Warnings</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {Array.from(results.values()).filter(r => r.summary.status === 'failed').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Individual Results */}
              {Array.from(results.values()).map(result => (
                <Card key={result.suiteId}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{result.suiteName}</span>
                      <div className="flex items-center space-x-2">
                        <Badge className={getGradeColor(result.summary.grade)}>
                          Grade {result.summary.grade}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleResultExpansion(result.suiteId)}
                          className="h-6 w-6 p-0"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Overall Score</span>
                        <span className={`text-lg font-bold ${getStatusColor(result.summary.status)}`}>
                          {result.summary.score}/100
                        </span>
                      </div>
                      <Progress value={result.summary.score} className="w-full" />
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="font-medium text-green-600">{result.passedTests}</div>
                          <div className="text-muted-foreground">Passed</div>
                        </div>
                        <div>
                          <div className="font-medium text-red-600">{result.failedTests}</div>
                          <div className="text-muted-foreground">Failed</div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-600">{result.skippedTests}</div>
                          <div className="text-muted-foreground">Skipped</div>
                        </div>
                      </div>

                      {expandedResults.has(result.suiteId) && (
                        <div className="space-y-2 pt-4 border-t">
                          {Array.from(result.results.entries()).map(([testId, testResult]) => (
                            <div key={testId} className="flex items-center justify-between p-2 bg-accent/50 rounded">
                              <div className="flex items-center space-x-2">
                                {testResult.passed ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className="text-sm font-medium">{testId}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">
                                  {formatValue(testResult.value, testResult.unit)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {Math.round(testResult.duration)}ms
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PerformanceTestRunner;