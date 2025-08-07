import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Clock, Settings, Trash2, Plus } from 'lucide-react';
import { 
  PerformanceBaseline, 
  RegressionDetection, 
  RegressionRule,
  regressionDetector 
} from '@/lib/performance/regression-detector';
import { logger } from '@/lib/logging/logger';

interface RegressionAlertPanelProps {
  className?: string;
}

export function RegressionAlertPanel({ className = '' }: RegressionAlertPanelProps) {
  const [baselines, setBaselines] = useState<PerformanceBaseline[]>([]);
  const [regressions, setRegressions] = useState<RegressionDetection[]>([]);
  const [rules, setRules] = useState<RegressionRule[]>([]);
  const [activeTab, setActiveTab] = useState<'alerts' | 'baselines' | 'rules'>('alerts');
  const [isCreatingBaseline, setIsCreatingBaseline] = useState(false);

  useEffect(() => {
    // Load initial data
    setBaselines(regressionDetector.getBaselines());
    
    // Subscribe to regression detections
    const unsubscribe = regressionDetector.onRegressionDetected((detection) => {
      setRegressions(prev => [detection, ...prev.slice(0, 49)]); // Keep last 50
      
      // Show browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Performance Regression Detected', {
          body: `${detection.metric} degraded by ${detection.degradationPercent.toFixed(1)}%`,
          icon: '/favicon.ico'
        });
      }
    });

    return unsubscribe;
  }, []);

  const handleCreateBaseline = async (environment: 'development' | 'staging' | 'production') => {
    setIsCreatingBaseline(true);
    try {
      const baseline = regressionDetector.createBaseline(environment);
      if (baseline) {
        setBaselines(regressionDetector.getBaselines());
        logger.info('Baseline created successfully', { baselineId: baseline.id });
      }
    } catch (error) {
      logger.error('Failed to create baseline', error);
    } finally {
      setIsCreatingBaseline(false);
    }
  };

  const handleDeleteBaseline = (baselineId: string) => {
    if (regressionDetector.removeBaseline(baselineId)) {
      setBaselines(regressionDetector.getBaselines());
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatMetricValue = (metric: string, value: number) => {
    switch (metric) {
      case 'fps': return `${value.toFixed(1)} FPS`;
      case 'memory': return `${(value / 1024 / 1024).toFixed(1)} MB`;
      case 'apiResponseTime':
      case 'renderTime':
      case 'lcp':
      case 'fid': return `${value.toFixed(1)}ms`;
      case 'cls': return value.toFixed(3);
      default: return value.toFixed(2);
    }
  };

  const renderAlertsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Performance Regression Alerts</h3>
        <span className="text-sm text-gray-500">
          {regressions.length} alerts
        </span>
      </div>

      {regressions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <TrendingDown className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2">No performance regressions detected</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {regressions.map((regression) => (
            <div
              key={regression.id}
              className={`p-4 rounded-lg border-l-4 ${
                regression.severity === 'critical' ? 'border-red-500 bg-red-50' :
                regression.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                regression.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="font-semibold capitalize">{regression.metric} Regression</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(regression.severity)}`}>
                      {regression.severity.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="mt-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Current Value:</span>
                      <span className="font-mono">{formatMetricValue(regression.metric, regression.currentValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Baseline Value:</span>
                      <span className="font-mono">{formatMetricValue(regression.metric, regression.baselineValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Degradation:</span>
                      <span className="font-mono text-red-600">+{regression.degradationPercent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500">
                  {new Date(regression.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderBaselinesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Performance Baselines</h3>
        <div className="flex gap-2">
          <select 
            onChange={(e) => handleCreateBaseline(e.target.value as any)}
            disabled={isCreatingBaseline}
            className="text-sm border rounded px-2 py-1"
            defaultValue=""
          >
            <option value="" disabled>Create Baseline</option>
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
        </div>
      </div>

      {baselines.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2">No performance baselines created</p>
          <p className="text-sm">Create a baseline to start regression detection</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {baselines.map((baseline) => (
            <div key={baseline.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">Baseline {baseline.id.split('_')[1]}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      baseline.environment === 'production' ? 'bg-green-100 text-green-800' :
                      baseline.environment === 'staging' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {baseline.environment}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Performance Metrics</div>
                      <div className="space-y-1 text-xs mt-1">
                        <div>FPS: {baseline.metrics.fps.mean.toFixed(1)}</div>
                        <div>Memory: {(baseline.metrics.memory.mean / 1024 / 1024).toFixed(1)} MB</div>
                        <div>API Response: {baseline.metrics.apiResponseTime.mean.toFixed(1)}ms</div>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Web Vitals</div>
                      <div className="space-y-1 text-xs mt-1">
                        <div>LCP: {baseline.metrics.webVitals.lcp.mean.toFixed(1)}ms</div>
                        <div>FID: {baseline.metrics.webVitals.fid.mean.toFixed(1)}ms</div>
                        <div>CLS: {baseline.metrics.webVitals.cls.mean.toFixed(3)}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    Created: {new Date(baseline.timestamp).toLocaleString()} • 
                    Sample Size: {baseline.sampleSize}
                    {baseline.version && ` • Version: ${baseline.version}`}
                  </div>
                </div>
                
                <button
                  onClick={() => handleDeleteBaseline(baseline.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRulesTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Detection Rules</h3>
        <button className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      <div className="space-y-3">
        {rules.map((rule, index) => (
          <div key={`${rule.metric}_${index}`} className="bg-white border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold capitalize">{rule.metric}</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(rule.severity)}`}>
                    {rule.severity}
                  </span>
                  {!rule.enabled && (
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                      DISABLED
                    </span>
                  )}
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Threshold: {rule.threshold}% degradation</div>
                  <div>Consecutive failures: {rule.consecutiveFailures}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="text-blue-500 hover:text-blue-700 p-1">
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="border-b">
        <nav className="flex space-x-8 px-6 py-3">
          {[
            { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
            { key: 'baselines', label: 'Baselines', icon: Clock },
            { key: 'rules', label: 'Rules', icon: Settings }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 text-sm font-medium ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === 'alerts' && regressions.length > 0 && (
                <span className="ml-1 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                  {regressions.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'alerts' && renderAlertsTab()}
        {activeTab === 'baselines' && renderBaselinesTab()}
        {activeTab === 'rules' && renderRulesTab()}
      </div>
    </div>
  );
}