'use client';

import React, { useState } from 'react';
import {
  TrendingUpIcon,
  DollarSignIcon,
  CpuIcon,
  BarChart3Icon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  LightbulbIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshCwIcon
} from 'lucide-react';

interface TransactionMetricsDisplayProps {
  transaction: any;
  metrics?: any;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  className?: string;
}

const TransactionMetricsDisplay: React.FC<TransactionMetricsDisplayProps> = ({
  transaction,
  metrics,
  loading = false,
  error = null,
  onRefresh,
  className = ''
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'efficiency', 'recommendations'])
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const getGradeColor = (grade: string): string => {
    const colors = {
      A: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
      B: 'text-lime-600 bg-lime-100 dark:text-lime-400 dark:bg-lime-900/20',
      C: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/20',
      D: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20',
      F: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
    };
    return colors[grade as keyof typeof colors] || colors.C;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 80) return 'text-lime-600 dark:text-lime-400';
    if (score >= 70) return 'text-amber-600 dark:text-amber-400';
    if (score >= 60) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const formatLamports = (lamports: number): string => {
    if (lamports >= 1e9) {
      return `${(lamports / 1e9).toFixed(6)} SOL`;
    }
    return `${lamports.toLocaleString()} lamports`;
  };

  const formatComputeUnits = (units: number): string => {
    if (units >= 1e6) {
      return `${(units / 1e6).toFixed(2)}M CU`;
    }
    if (units >= 1e3) {
      return `${(units / 1e3).toFixed(1)}K CU`;
    }
    return `${units} CU`;
  };

  if (loading) {
    return (
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-6">
          <div className="animate-spin">
            <BarChart3Icon className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Transaction Metrics</h2>
        </div>
        <div className="space-y-4">
          <div className="animate-pulse bg-muted/20 h-20 rounded"></div>
          <div className="animate-pulse bg-muted/20 h-32 rounded"></div>
        </div>
        <p className="text-sm text-muted-foreground mt-4">Calculating transaction metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangleIcon className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-semibold text-foreground">Transaction Metrics</h2>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCwIcon className="w-4 h-4" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  if (!metrics) {
    // Show basic transaction info if we have transaction data but no detailed metrics
    if (transaction) {
      return (
        <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
          <div className="flex items-center space-x-3 mb-6">
            <BarChart3Icon className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Basic Transaction Info</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {transaction.signature && (
              <div className="bg-muted/10 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">Signature</h3>
                <p className="text-sm text-muted-foreground font-mono break-all">
                  {transaction.signature}
                </p>
              </div>
            )}
            
            {transaction.blockTime && (
              <div className="bg-muted/10 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">Block Time</h3>
                <p className="text-sm text-muted-foreground">
                  {new Date(transaction.blockTime * 1000).toLocaleString()}
                </p>
              </div>
            )}
            
            {transaction.slot && (
              <div className="bg-muted/10 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">Slot</h3>
                <p className="text-sm text-muted-foreground">
                  {transaction.slot.toLocaleString()}
                </p>
              </div>
            )}
            
            {transaction.meta?.fee && (
              <div className="bg-muted/10 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">Fee</h3>
                <p className="text-sm text-muted-foreground">
                  {formatLamports(transaction.meta.fee)}
                </p>
              </div>
            )}
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Detailed metrics are not available for this transaction
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-2 flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors mx-auto"
              >
                <RefreshCwIcon className="w-4 h-4" />
                <span>Load Metrics</span>
              </button>
            )}
          </div>
        </div>
      );
    }
    
    return (
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="text-center py-8">
          <BarChart3Icon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No metrics available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-background rounded-lg border border-border ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <BarChart3Icon className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Transaction Metrics</h2>
          </div>
          
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 hover:bg-muted rounded transition-colors"
                title="Refresh metrics"
              >
                <RefreshCwIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Overall Score Card */}
        <div className="bg-muted/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${getGradeColor(metrics.grade)}`}>
                  Grade {metrics.grade}
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(metrics.overallScore)}`}>
                  {metrics.overallScore.toFixed(1)}/100
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Overall Transaction Score</p>
            </div>
            
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Transaction</div>
              <div className="font-mono text-sm">{metrics.signature.substring(0, 16)}...</div>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Section */}
      <div className="border-b border-border">
        <button
          onClick={() => toggleSection('overview')}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <BarChart3Icon className="w-5 h-5 text-primary" />
            <span className="font-medium">Overview</span>
          </div>
          {expandedSections.has('overview') ? 
            <ChevronDownIcon className="w-5 h-5" /> : 
            <ChevronRightIcon className="w-5 h-5" />
          }
        </button>
        
        {expandedSections.has('overview') && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/10 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <DollarSignIcon className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Total Fee</span>
                </div>
                <div className="text-lg font-semibold">{formatLamports(metrics.feeAnalysis.totalFee)}</div>
                <div className="text-xs text-muted-foreground">${metrics.feeAnalysis.totalFeeUSD.toFixed(4)}</div>
              </div>
              
              <div className="bg-muted/10 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <CpuIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Compute Used</span>
                </div>
                <div className="text-lg font-semibold">{formatComputeUnits(metrics.computeAnalysis.computeUnitsUsed)}</div>
                <div className="text-xs text-muted-foreground">{metrics.computeAnalysis.computeUtilization.toFixed(1)}% utilized</div>
              </div>
              
              <div className="bg-muted/10 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <TrendingUpIcon className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Efficiency</span>
                </div>
                <div className={`text-lg font-semibold ${getScoreColor(metrics.efficiency.overall)}`}>
                  {metrics.efficiency.overall.toFixed(1)}/100
                </div>
                <div className="text-xs text-muted-foreground">Overall efficiency</div>
              </div>
              
              <div className="bg-muted/10 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-1">
                  <LightbulbIcon className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Recommendations</span>
                </div>
                <div className="text-lg font-semibold">{metrics.recommendations.length}</div>
                <div className="text-xs text-muted-foreground">Optimization tips</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fee Analysis Section */}
      <div className="border-b border-border">
        <button
          onClick={() => toggleSection('fee')}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <DollarSignIcon className="w-5 h-5 text-green-500" />
            <span className="font-medium">Fee Analysis</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              metrics.feeAnalysis.feeRank === 'very_low' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              metrics.feeAnalysis.feeRank === 'low' ? 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200' :
              metrics.feeAnalysis.feeRank === 'average' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
              metrics.feeAnalysis.feeRank === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {metrics.feeAnalysis.feeRank.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          {expandedSections.has('fee') ? 
            <ChevronDownIcon className="w-5 h-5" /> : 
            <ChevronRightIcon className="w-5 h-5" />
          }
        </button>
        
        {expandedSections.has('fee') && (
          <div className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Fee Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Fee:</span>
                    <span>{formatLamports(metrics.feeAnalysis.breakdown.baseFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Compute Fee:</span>
                    <span>{formatLamports(metrics.feeAnalysis.breakdown.computeFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Priority Fee:</span>
                    <span>{formatLamports(metrics.feeAnalysis.breakdown.priorityFee)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t border-border pt-2">
                    <span>Total:</span>
                    <span>{formatLamports(metrics.feeAnalysis.totalFee)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Fee Efficiency</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Is Optimal:</span>
                    <span className={metrics.feeAnalysis.isOptimal ? 'text-green-600' : 'text-red-600'}>
                      {metrics.feeAnalysis.isOptimal ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Potential Savings:</span>
                    <span className={metrics.feeAnalysis.potentialSavings > 0 ? 'text-orange-600' : 'text-green-600'}>
                      {formatLamports(metrics.feeAnalysis.potentialSavings)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee per Instruction:</span>
                    <span>{formatLamports(metrics.feeAnalysis.feePerInstruction)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compute Analysis Section */}
      <div className="border-b border-border">
        <button
          onClick={() => toggleSection('compute')}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <CpuIcon className="w-5 h-5 text-blue-500" />
            <span className="font-medium">Compute Analysis</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              metrics.computeAnalysis.limits.isNearLimit ? 
                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
              {metrics.computeAnalysis.computeUtilization.toFixed(1)}% USED
            </span>
          </div>
          {expandedSections.has('compute') ? 
            <ChevronDownIcon className="w-5 h-5" /> : 
            <ChevronRightIcon className="w-5 h-5" />
          }
        </button>
        
        {expandedSections.has('compute') && (
          <div className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Compute Usage</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Units Used:</span>
                    <span>{formatComputeUnits(metrics.computeAnalysis.computeUnitsUsed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Units Remaining:</span>
                    <span>{formatComputeUnits(metrics.computeAnalysis.computeUnitsRemaining)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Utilization:</span>
                    <span>{metrics.computeAnalysis.computeUtilization.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Efficiency Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Instruction:</span>
                    <span>{formatComputeUnits(metrics.computeAnalysis.efficiency.computePerInstruction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Optimization Potential:</span>
                    <span className={metrics.computeAnalysis.efficiency.optimizationPotential > 20 ? 'text-orange-600' : 'text-green-600'}>
                      {metrics.computeAnalysis.efficiency.optimizationPotential.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div> 
     {/* Efficiency Section */}
      <div className="border-b border-border">
        <button
          onClick={() => toggleSection('efficiency')}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <TrendingUpIcon className="w-5 h-5 text-purple-500" />
            <span className="font-medium">Efficiency Analysis</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              metrics.efficiency.overall >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              metrics.efficiency.overall >= 60 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {metrics.efficiency.overall.toFixed(1)}/100
            </span>
          </div>
          {expandedSections.has('efficiency') ? 
            <ChevronDownIcon className="w-5 h-5" /> : 
            <ChevronRightIcon className="w-5 h-5" />
          }
        </button>
        
        {expandedSections.has('efficiency') && (
          <div className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(metrics.efficiency.categories).map(([category, score]) => (
                <div key={category} className="bg-muted/10 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">
                      {category.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className={`text-sm font-semibold ${getScoreColor(score as number)}`}>
                      {(score as number).toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        (score as number) >= 80 ? 'bg-green-500' :
                        (score as number) >= 60 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, score as number)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            
            {metrics.efficiency.bottlenecks && metrics.efficiency.bottlenecks.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Performance Bottlenecks</h4>
                <div className="space-y-2">
                  {metrics.efficiency.bottlenecks.map((bottleneck: any, index: number) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-muted/10 rounded-lg">
                      <AlertTriangleIcon className={`w-4 h-4 mt-0.5 ${
                        bottleneck.severity === 'critical' ? 'text-red-500' :
                        bottleneck.severity === 'high' ? 'text-orange-500' :
                        bottleneck.severity === 'medium' ? 'text-amber-500' :
                        'text-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium capitalize">{bottleneck.type.replace('_', ' ')}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            bottleneck.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            bottleneck.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                            bottleneck.severity === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {bottleneck.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{bottleneck.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Impact: {bottleneck.impact.toFixed(1)}% • {bottleneck.suggestion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recommendations Section */}
      {metrics.recommendations && metrics.recommendations.length > 0 && (
        <div className="border-b border-border">
          <button
            onClick={() => toggleSection('recommendations')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <LightbulbIcon className="w-5 h-5 text-amber-500" />
              <span className="font-medium">Recommendations</span>
              <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
                {metrics.recommendations.length}
              </span>
            </div>
            {expandedSections.has('recommendations') ? 
              <ChevronDownIcon className="w-5 h-5" /> : 
              <ChevronRightIcon className="w-5 h-5" />
            }
          </button>
          
          {expandedSections.has('recommendations') && (
            <div className="px-4 pb-4">
              <div className="space-y-3">
                {metrics.recommendations.map((recommendation: any, index: number) => (
                  <div key={index} className="border border-border rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {recommendation.priority === 'critical' && <AlertTriangleIcon className="w-4 h-4 text-red-500" />}
                        {recommendation.priority === 'high' && <AlertTriangleIcon className="w-4 h-4 text-orange-500" />}
                        {recommendation.priority === 'medium' && <InfoIcon className="w-4 h-4 text-amber-500" />}
                        {recommendation.priority === 'low' && <CheckCircleIcon className="w-4 h-4 text-blue-500" />}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium">{recommendation.title}</h4>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            recommendation.priority === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            recommendation.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                            recommendation.priority === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}>
                            {recommendation.priority.toUpperCase()}
                          </span>
                          <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                            {recommendation.category.toUpperCase()}
                          </span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">{recommendation.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="font-medium text-foreground">Impact:</span>
                            <p className="text-muted-foreground">{recommendation.impact}</p>
                          </div>
                          <div>
                            <span className="font-medium text-foreground">Implementation:</span>
                            <p className="text-muted-foreground">{recommendation.implementation}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>Difficulty: <span className="font-medium">{recommendation.difficulty}</span></span>
                            {recommendation.estimatedSaving && (
                              <span>Potential Saving: <span className="font-medium text-green-600">
                                {formatLamports(recommendation.estimatedSaving)}
                              </span></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Footer */}
      <div className="p-4 bg-muted/5">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Analyzed {new Date(metrics.blockTime || Date.now()).toLocaleString()}
          </span>
          <span>
            {metrics.recommendations.length} optimization{metrics.recommendations.length !== 1 ? 's' : ''} available
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransactionMetricsDisplay;