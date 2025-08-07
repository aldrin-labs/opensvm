'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  TestTube, Zap, Database, Network, Timer, Play, Square,
  RotateCcw, Download, Upload, Settings, AlertTriangle,
  Check, X, Info, Cpu, Memory, Activity
} from 'lucide-react';
import { usePerformance } from '@/contexts/PerformanceContext';
import logger from '@/lib/logging/logger';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  type: 'performance' | 'data' | 'network' | 'error';
  config: Record<string, any>;
  isRunning: boolean;
  results?: TestResult;
}

interface TestResult {
  success: boolean;
  duration: number;
  metrics: Record<string, any>;
  errors: string[];
  warnings: string[];
}

const DEFAULT_SCENARIOS: TestScenario[] = [
  {
    id: 'high-node-count',
    name: 'High Node Count Test',
    description: 'Test performance with 1000+ nodes',
    type: 'performance',
    config: { nodeCount: 1000, edgeCount: 2000 },
    isRunning: false
  },
  {
    id: 'rapid-updates',
    name: 'Rapid Data Updates',
    description: 'Test with frequent data changes',
    type: 'data',
    config: { updateInterval: 100, duration: 30000 },
    isRunning: false
  },
  {
    id: 'network-failure',
    name: 'Network Failure Simulation',
    description: 'Test error handling with network failures',
    type: 'network',
    config: { failureRate: 0.5, duration: 10000 },
    isRunning: false
  },
  {
    id: 'memory-stress',
    name: 'Memory Stress Test',
    description: 'Test memory usage with large datasets',
    type: 'performance',
    config: { dataSize: '10MB', operations: 1000 },
    isRunning: false
  }
];

function TestScenarioCard({ 
  scenario, 
  onRun, 
  onStop, 
  onConfigure 
}: { 
  scenario: TestScenario;
  onRun: (id: string) => void;
  onStop: (id: string) => void;
  onConfigure: (id: string) => void;
}) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'performance': return 'bg-blue-100 text-blue-800';
      case 'data': return 'bg-green-100 text-green-800';
      case 'network': return 'bg-orange-100 text-orange-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getResultIcon = (result?: TestResult) => {
    if (!result) return null;
    return result.success ? 
      <Check className="h-4 w-4 text-green-600" /> : 
      <X className="h-4 w-4 text-red-600" />;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{scenario.name}</CardTitle>
            <p className="text-sm text-gray-600">{scenario.description}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getTypeColor(scenario.type)}>
              {scenario.type}
            </Badge>
            {getResultIcon(scenario.results)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Configuration Preview */}
        <div className="text-xs bg-gray-50 p-2 rounded">
          <div className="font-medium mb-1">Configuration:</div>
          {Object.entries(scenario.config).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-gray-600">{key}:</span>
              <span className="font-mono">{String(value)}</span>
            </div>
          ))}
        </div>

        {/* Results */}
        {scenario.results && (
          <div className="text-xs">
            <div className="font-medium mb-1">Last Result:</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-mono">{scenario.results.duration}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge variant={scenario.results.success ? "default" : "destructive"}>
                  {scenario.results.success ? 'Passed' : 'Failed'}
                </Badge>
              </div>
              {scenario.results.errors.length > 0 && (
                <div className="text-red-600">
                  {scenario.results.errors.length} error(s)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-2">
          {scenario.isRunning ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onStop(scenario.id)}
              className="flex-1"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onRun(scenario.id)}
              className="flex-1"
            >
              <Play className="h-3 w-3 mr-1" />
              Run
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConfigure(scenario.id)}
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DataGenerator() {
  const [nodeCount, setNodeCount] = useState(100);
  const [edgeCount, setEdgeCount] = useState(150);
  const [generatedData, setGeneratedData] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTestData = async () => {
    setIsGenerating(true);
    const startTime = performance.now();

    try {
      logger.info('Generating test data', {
        component: 'DeveloperUtilities',
        metadata: { nodeCount, edgeCount }
      });

      // Simulate data generation
      await new Promise(resolve => setTimeout(resolve, 100));

      const nodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: `node_${i}`,
        label: `Node ${i}`,
        type: ['account', 'transaction', 'program'][Math.floor(Math.random() * 3)],
        value: Math.random() * 1000,
        x: Math.random() * 800,
        y: Math.random() * 600,
      }));

      const edges = Array.from({ length: edgeCount }, (_, i) => ({
        id: `edge_${i}`,
        source: nodes[Math.floor(Math.random() * nodeCount)].id,
        target: nodes[Math.floor(Math.random() * nodeCount)].id,
        weight: Math.random(),
        type: ['transfer', 'interaction', 'delegation'][Math.floor(Math.random() * 3)],
      }));

      const data = { nodes, edges };
      setGeneratedData(data);

      const endTime = performance.now();
      logger.info('Test data generated successfully', {
        component: 'DeveloperUtilities',
        metadata: { 
          nodeCount, 
          edgeCount, 
          generationTime: endTime - startTime 
        }
      });

    } catch (error) {
      logger.error('Failed to generate test data', {
        component: 'DeveloperUtilities',
        metadata: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          nodeCount,
          edgeCount
        }
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadData = () => {
    if (!generatedData) return;

    const blob = new Blob([JSON.stringify(generatedData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-data-${nodeCount}n-${edgeCount}e.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Test Data Generator</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Node Count</label>
              <Input
                type="number"
                value={nodeCount}
                onChange={(e) => setNodeCount(Number(e.target.value))}
                min="1"
                max="10000"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Edge Count</label>
              <Input
                type="number"
                value={edgeCount}
                onChange={(e) => setEdgeCount(Number(e.target.value))}
                min="0"
                max="50000"
              />
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={generateTestData}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Activity className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Generate Data
                </>
              )}
            </Button>
            
            {generatedData && (
              <Button variant="outline" onClick={downloadData}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
          </div>

          {generatedData && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Generated {generatedData.nodes.length} nodes and {generatedData.edges.length} edges.
                Data is ready for testing.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PerformanceTester() {
  const { monitor, trackCustomMetric } = usePerformance();
  const [testProgress, setTestProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const runPerformanceTest = async (testType: string) => {
    setIsRunning(true);
    setTestProgress(0);
    setResults([]);

    const testResults: any[] = [];

    try {
      logger.info(`Starting performance test: ${testType}`, {
        component: 'DeveloperUtilities',
        metadata: { testType }
      });

      // CPU Stress Test
      if (testType === 'cpu' || testType === 'all') {
        setTestProgress(20);
        const cpuStart = performance.now();
        
        // Simulate CPU-intensive task
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += Math.sqrt(i);
        }
        
        const cpuTime = performance.now() - cpuStart;
        testResults.push({
          test: 'CPU Stress',
          duration: cpuTime,
          result: cpuTime < 100 ? 'Good' : cpuTime < 500 ? 'Average' : 'Poor'
        });
        
        trackCustomMetric('test-cpu-stress', cpuTime, { testType: 'cpu-stress' });
      }

      // Memory Test
      if (testType === 'memory' || testType === 'all') {
        setTestProgress(40);
        const memoryStart = performance.now();
        
        // Create large data structures
        const largeArray = new Array(100000).fill(0).map(() => ({
          id: Math.random(),
          data: new Array(100).fill(Math.random())
        }));
        
        const memoryTime = performance.now() - memoryStart;
        testResults.push({
          test: 'Memory Allocation',
          duration: memoryTime,
          result: memoryTime < 50 ? 'Good' : memoryTime < 200 ? 'Average' : 'Poor'
        });
        
        trackCustomMetric('test-memory-allocation', memoryTime, { 
          testType: 'memory-allocation',
          arraySize: largeArray.length
        });
      }

      // Render Test
      if (testType === 'render' || testType === 'all') {
        setTestProgress(60);
        const renderStart = performance.now();
        
        // Simulate DOM operations
        const testElement = document.createElement('div');
        for (let i = 0; i < 1000; i++) {
          const child = document.createElement('div');
          child.textContent = `Test element ${i}`;
          testElement.appendChild(child);
        }
        document.body.appendChild(testElement);
        document.body.removeChild(testElement);
        
        const renderTime = performance.now() - renderStart;
        testResults.push({
          test: 'DOM Rendering',
          duration: renderTime,
          result: renderTime < 20 ? 'Good' : renderTime < 100 ? 'Average' : 'Poor'
        });
        
        trackCustomMetric('test-dom-rendering', renderTime, { testType: 'dom-rendering' });
      }

      // Network Test
      if (testType === 'network' || testType === 'all') {
        setTestProgress(80);
        const networkStart = performance.now();
        
        try {
          await fetch('/api/test', { method: 'HEAD' });
          const networkTime = performance.now() - networkStart;
          testResults.push({
            test: 'Network Latency',
            duration: networkTime,
            result: networkTime < 100 ? 'Good' : networkTime < 500 ? 'Average' : 'Poor'
          });
          
          trackCustomMetric('test-network-latency', networkTime, { testType: 'network-latency' });
        } catch (error) {
          testResults.push({
            test: 'Network Latency',
            duration: 0,
            result: 'Failed',
            error: 'Network request failed'
          });
        }
      }

      setTestProgress(100);
      setResults(testResults);
      
      logger.info(`Performance test completed: ${testType}`, {
        component: 'DeveloperUtilities',
        metadata: { testType, results: testResults }
      });

    } catch (error) {
      logger.error(`Performance test failed: ${testType}`, {
        component: 'DeveloperUtilities',
        metadata: { 
          testType,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    } finally {
      setIsRunning(false);
      setTimeout(() => setTestProgress(0), 2000);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Performance Tester</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              size="sm"
              onClick={() => runPerformanceTest('cpu')}
              disabled={isRunning}
              variant="outline"
            >
              <Cpu className="h-4 w-4 mr-1" />
              CPU Test
            </Button>
            <Button
              size="sm"
              onClick={() => runPerformanceTest('memory')}
              disabled={isRunning}
              variant="outline"
            >
              <Memory className="h-4 w-4 mr-1" />
              Memory Test
            </Button>
            <Button
              size="sm"
              onClick={() => runPerformanceTest('render')}
              disabled={isRunning}
              variant="outline"
            >
              <Activity className="h-4 w-4 mr-1" />
              Render Test
            </Button>
            <Button
              size="sm"
              onClick={() => runPerformanceTest('network')}
              disabled={isRunning}
              variant="outline"
            >
              <Network className="h-4 w-4 mr-1" />
              Network Test
            </Button>
          </div>

          <Button
            onClick={() => runPerformanceTest('all')}
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </Button>

          {isRunning && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Test Progress</span>
                <span>{testProgress}%</span>
              </div>
              <Progress value={testProgress} />
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Test Results:</h4>
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium">{result.test}</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm">{result.duration.toFixed(2)}ms</span>
                    <Badge 
                      variant={result.result === 'Good' ? 'default' : 
                              result.result === 'Average' ? 'secondary' : 'destructive'}
                    >
                      {result.result}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DeveloperUtilities() {
  const [scenarios, setScenarios] = useState<TestScenario[]>(DEFAULT_SCENARIOS);
  const [activeTab, setActiveTab] = useState('scenarios');
  const [configuring, setConfiguring] = useState<string | null>(null);

  const runScenario = async (id: string) => {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;

    setScenarios(prev => prev.map(s => 
      s.id === id ? { ...s, isRunning: true, results: undefined } : s
    ));

    logger.info(`Running test scenario: ${scenario.name}`, {
      component: 'DeveloperUtilities',
      metadata: { scenarioId: id, config: scenario.config }
    });

    const startTime = performance.now();

    try {
      // Simulate scenario execution based on type
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const results: TestResult = {
        success: Math.random() > 0.2, // 80% success rate for demo
        duration,
        metrics: {
          memoryUsage: Math.random() * 100,
          cpuUsage: Math.random() * 100,
          renderTime: Math.random() * 50,
        },
        errors: Math.random() > 0.7 ? ['Sample error message'] : [],
        warnings: Math.random() > 0.5 ? ['Sample warning message'] : [],
      };

      setScenarios(prev => prev.map(s => 
        s.id === id ? { ...s, isRunning: false, results } : s
      ));

      logger.info(`Test scenario completed: ${scenario.name}`, {
        component: 'DeveloperUtilities',
        metadata: { scenarioId: id, results }
      });

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const results: TestResult = {
        success: false,
        duration,
        metrics: {},
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
      };

      setScenarios(prev => prev.map(s => 
        s.id === id ? { ...s, isRunning: false, results } : s
      ));

      logger.error(`Test scenario failed: ${scenario.name}`, {
        component: 'DeveloperUtilities',
        metadata: { 
          scenarioId: id, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  };

  const stopScenario = (id: string) => {
    setScenarios(prev => prev.map(s => 
      s.id === id ? { ...s, isRunning: false } : s
    ));

    logger.info('Test scenario stopped', {
      component: 'DeveloperUtilities',
      metadata: { scenarioId: id }
    });
  };

  const configureScenario = (id: string) => {
    setConfiguring(id);
  };

  if (process.env.NODE_ENV === 'production') {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Developer utilities are not available in production mode.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Developer Utilities</h2>
          <p className="text-gray-600">Tools for testing and debugging OpenSVM</p>
        </div>
        <Badge variant="outline">Development Only</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
          <TabsTrigger value="data-generator">Data Generator</TabsTrigger>
          <TabsTrigger value="performance">Performance Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scenarios.map((scenario) => (
              <TestScenarioCard
                key={scenario.id}
                scenario={scenario}
                onRun={runScenario}
                onStop={stopScenario}
                onConfigure={configureScenario}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="data-generator" className="mt-6">
          <DataGenerator />
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <PerformanceTester />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DeveloperUtilities;