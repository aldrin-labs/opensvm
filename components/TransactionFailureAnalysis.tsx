'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  Zap, 
  RefreshCw,
  TrendingUp,
  Shield,
  Info,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import type { 
  TransactionFailureAnalysis, 
  ErrorClassification,
  RootCauseAnalysis,
  FailureImpact,
  RecoveryAnalysis,
  PreventionStrategy,
  RetryRecommendation,
  SimilarFailure
} from '@/lib/transaction-failure-analyzer';

interface TransactionFailureAnalysisProps {
  signature: string;
  analysis?: TransactionFailureAnalysis;
  isLoading?: boolean;
  onRetryAnalysis?: () => void;
}

export default function TransactionFailureAnalysis({
  signature,
  analysis,
  isLoading = false,
  onRetryAnalysis
}: TransactionFailureAnalysisProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Analyzing Transaction Failure...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Transaction Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">No failure analysis available for this transaction.</p>
          {onRetryAnalysis && (
            <Button onClick={onRetryAnalysis} className="mt-4">
              Analyze Transaction
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!analysis.isFailure) {
    return (
      <Card className="w-full border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            Transaction Successful
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-green-600">This transaction completed successfully without any failures.</p>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getRecoverabilityColor = (recoverability: string) => {
    switch (recoverability) {
      case 'immediate': return 'text-green-600';
      case 'with_changes': return 'text-yellow-600';
      case 'difficult': return 'text-orange-600';
      case 'impossible': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Overview Card */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Transaction Failure Analysis
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getSeverityColor(analysis.severity)}>
                {analysis.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline">
                {analysis.confidence}% Confidence
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-600">Error Type</div>
              <div className="text-lg font-semibold">
                {analysis.errorClassification.primaryCategory.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div className="text-sm text-gray-600">
                {analysis.errorClassification.userFriendlyDescription}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-600">Recoverability</div>
              <div className={`text-lg font-semibold ${getRecoverabilityColor(analysis.recoverability)}`}>
                {analysis.recoverability.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div className="text-sm text-gray-600">
                Recovery complexity: {analysis.recovery.recoveryComplexity}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-600">Impact</div>
              <div className="text-lg font-semibold">
                {analysis.impact.feesLost.toLocaleString()} lamports
              </div>
              <div className="text-sm text-gray-600">
                {analysis.impact.feesLostUSD && `~$${analysis.impact.feesLostUSD.toFixed(4)}`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="error" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="error">Error Details</TabsTrigger>
          <TabsTrigger value="root-cause">Root Cause</TabsTrigger>
          <TabsTrigger value="impact">Impact</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="prevention">Prevention</TabsTrigger>
          <TabsTrigger value="similar">Similar Cases</TabsTrigger>
        </TabsList>

        <TabsContent value="error" className="space-y-4">
          <ErrorClassificationPanel classification={analysis.errorClassification} />
        </TabsContent>

        <TabsContent value="root-cause" className="space-y-4">
          <RootCausePanel rootCause={analysis.rootCause} />
        </TabsContent>

        <TabsContent value="impact" className="space-y-4">
          <ImpactPanel impact={analysis.impact} />
        </TabsContent>

        <TabsContent value="recovery" className="space-y-4">
          <RecoveryPanel 
            recovery={analysis.recovery} 
            retryRecommendations={analysis.retryRecommendations}
          />
        </TabsContent>

        <TabsContent value="prevention" className="space-y-4">
          <PreventionPanel strategies={analysis.prevention} />
        </TabsContent>

        <TabsContent value="similar" className="space-y-4">
          <SimilarFailuresPanel failures={analysis.similarFailures} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Error Classification Panel
function ErrorClassificationPanel({ classification }: { classification: ErrorClassification }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Classification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Error Details</h4>
            <div className="space-y-2 text-sm">
              <div><strong>Code:</strong> {classification.errorCode || 'N/A'}</div>
              <div><strong>Message:</strong> {classification.errorMessage}</div>
              <div><strong>Technical:</strong> {classification.technicalDescription}</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Error Characteristics</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={classification.isTransient ? "default" : "secondary"}>
                  {classification.isTransient ? "Transient" : "Persistent"}
                </Badge>
                <Badge variant={classification.isDeterministic ? "destructive" : "default"}>
                  {classification.isDeterministic ? "Deterministic" : "Non-deterministic"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {classification.isResourceRelated && <Badge variant="outline">Resource Related</Badge>}
                {classification.isDataRelated && <Badge variant="outline">Data Related</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {classification.isSystemError && <Badge variant="outline">System Error</Badge>}
                {classification.isProgramError && <Badge variant="outline">Program Error</Badge>}
                {classification.isUserError && <Badge variant="outline">User Error</Badge>}
                {classification.isNetworkError && <Badge variant="outline">Network Error</Badge>}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Root Cause Panel
function RootCausePanel({ rootCause }: { rootCause: RootCauseAnalysis }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Primary Cause</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg">{rootCause.primaryCause}</p>
        </CardContent>
      </Card>

      {rootCause.contributingFactors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contributing Factors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rootCause.contributingFactors.map((factor, index) => (
                <div key={index} className="border-l-4 border-blue-200 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{factor.factor}</span>
                    <Badge variant={
                      factor.impact === 'major' ? 'destructive' : 
                      factor.impact === 'moderate' ? 'default' : 'secondary'
                    }>
                      {factor.impact}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{factor.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {rootCause.failurePoint.instructionIndex !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Failure Point</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Instruction Index:</strong> {rootCause.failurePoint.instructionIndex}</div>
              {rootCause.failurePoint.programId && (
                <div><strong>Program ID:</strong> {rootCause.failurePoint.programId}</div>
              )}
              {rootCause.failurePoint.specificOperation && (
                <div><strong>Operation:</strong> {rootCause.failurePoint.specificOperation}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Impact Panel
function ImpactPanel({ impact }: { impact: FailureImpact }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold">{impact.feesLost.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Lamports Lost</div>
              {impact.feesLostUSD && (
                <div className="text-lg text-gray-800">${impact.feesLostUSD.toFixed(4)}</div>
              )}
            </div>
            <div>
              <div className="text-2xl font-bold">{impact.estimatedRecoveryCost.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Estimated Recovery Cost</div>
              <div className="text-sm text-gray-500">{impact.estimatedRecoveryTime}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impact Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">User Impact</div>
              <Badge variant={
                impact.userImpact === 'severe' ? 'destructive' :
                impact.userImpact === 'moderate' ? 'default' :
                impact.userImpact === 'minor' ? 'secondary' : 'outline'
              }>
                {impact.userImpact.toUpperCase()}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Business Impact</div>
              <Badge variant={
                impact.businessImpact === 'critical' || impact.businessImpact === 'high' ? 'destructive' :
                impact.businessImpact === 'medium' ? 'default' : 'secondary'
              }>
                {impact.businessImpact.toUpperCase()}
              </Badge>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-600 mb-2">Affected Accounts</div>
            <div className="text-sm">{impact.accountsAffected.length} accounts affected</div>
            {impact.partialExecution && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Transaction had partial execution - some state changes may have occurred.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Recovery Panel
function RecoveryPanel({ 
  recovery, 
  retryRecommendations 
}: { 
  recovery: RecoveryAnalysis;
  retryRecommendations: RetryRecommendation[];
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Recovery Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {recovery.isRecoverable ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  {recovery.isRecoverable ? 'Recoverable' : 'Not Recoverable'}
                </span>
              </div>
              <Badge variant="outline">
                {recovery.recoveryComplexity} complexity
              </Badge>
            </div>
            
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">Success Probability</div>
              <div className="flex items-center gap-2">
                <Progress value={recovery.successProbability} className="flex-1" />
                <span className="text-sm font-medium">{recovery.successProbability}%</span>
              </div>
            </div>

            {recovery.requiredResources.additionalFunds > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Additional Funds Required</div>
                <div className="text-lg font-semibold">
                  {recovery.requiredResources.additionalFunds.toLocaleString()} lamports
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {recovery.immediateActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Immediate Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recovery.immediateActions.map((action, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{action.action}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        action.priority === 'critical' ? 'destructive' :
                        action.priority === 'high' ? 'default' : 'secondary'
                      }>
                        {action.priority}
                      </Badge>
                      <Badge variant="outline">{action.successRate}% success</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{action.description}</p>
                  <div className="text-xs text-gray-500">
                    Cost: {action.estimatedCost.toLocaleString()} lamports • 
                    Time: {action.estimatedTime}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {retryRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Retry Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            {retryRecommendations.map((recommendation, index) => (
              <div key={index} className="space-y-3">
                <div className="flex items-center gap-2">
                  {recommendation.shouldRetry ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-medium">
                    {recommendation.shouldRetry ? 'Retry Recommended' : 'Retry Not Recommended'}
                  </span>
                  {recommendation.shouldRetry && (
                    <Badge variant="outline">
                      {recommendation.retrySuccessProbability}% success probability
                    </Badge>
                  )}
                </div>
                
                {recommendation.shouldRetry && (
                  <div 
                    id={`retry-details-${index}`} 
                    className="ml-7 space-y-2 text-sm"
                  >
                    <div>
                      <strong>Strategy:</strong> {recommendation.retryStrategy.replace(/_/g, ' ')}
                    </div>
                    <div>
                      <strong>Delay:</strong> {recommendation.recommendedDelay}ms
                    </div>
                    <div>
                      <strong>Max Retries:</strong> {recommendation.maxRetries}
                    </div>
                    {recommendation.requiredChanges.length > 0 && (
                      <div>
                        <strong>Required Changes:</strong>
                        <ul className="list-disc list-inside ml-2 mt-1">
                          {recommendation.requiredChanges.map((change, changeIndex) => (
                            <li key={changeIndex}>{change.description}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Prevention Panel
function PreventionPanel({ strategies }: { strategies: PreventionStrategy[] }) {
  return (
    <div className="space-y-4">
      {strategies.map((strategy, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {strategy.strategy}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{strategy.effectiveness}% effective</Badge>
                <Badge variant={
                  strategy.cost === 'free' ? 'default' :
                  strategy.cost === 'low' ? 'secondary' : 'destructive'
                }>
                  {strategy.cost} cost
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-3">{strategy.description}</p>
            <div className="space-y-2">
              <div>
                <strong className="text-sm">Implementation:</strong>
                <p className="text-sm text-gray-600 mt-1">{strategy.implementation}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span><strong>Difficulty:</strong> {strategy.difficulty}</span>
                <span><strong>Category:</strong> {strategy.category.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {strategies.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">No prevention strategies available for this error type.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Similar Failures Panel
function SimilarFailuresPanel({ failures }: { failures: SimilarFailure[] }) {
  return (
    <div className="space-y-4">
      {failures.map((failure, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Similar Failure
              </div>
              <Badge variant="outline">{failure.similarity}% similar</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-600">Transaction</div>
                <div className="font-mono text-sm">{failure.signature}</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-600">Error Category</div>
                  <div>{failure.errorCategory.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600">Resolution Time</div>
                  <div>{failure.timeToResolve || 'Unknown'}</div>
                </div>
              </div>
              
              {failure.resolution && (
                <div>
                  <div className="text-sm font-medium text-gray-600">Resolution</div>
                  <p className="text-sm">{failure.resolution}</p>
                </div>
              )}
              
              {failure.lessons.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-2">Lessons Learned</div>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {failure.lessons.map((lesson, lessonIndex) => (
                      <li key={lessonIndex}>{lesson}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      
      {failures.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">No similar failures found in the database.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}