'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BrainIcon,
  RefreshCwIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  CopyIcon,
  CheckIcon,
  ShareIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  InfoIcon,
  SparklesIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  DollarSignIcon,
  ClockIcon,
  UsersIcon,
  SettingsIcon,
  HelpCircleIcon
} from 'lucide-react';
import type { DetailedTransactionInfo } from '@/lib/solana';
import { 
  aiTransactionAnalyzer, 
  formatConfidenceLevel, 
  getActionTypeIcon, 
  getRiskLevelColor,
  type TransactionExplanation 
} from '@/lib/ai-transaction-analyzer';
import { 
  formatDeFiAmount, 
  getDeFiActionIcon, 
  formatPercentage, 
  formatUsdValue 
} from '@/lib/defi-transaction-analyzer';

interface AITransactionExplanationProps {
  transaction: DetailedTransactionInfo;
  className?: string;
  detailLevel?: 'basic' | 'detailed' | 'technical';
  onFeedback?: (feedback: 'positive' | 'negative', explanation: TransactionExplanation) => void;
}

const AITransactionExplanation: React.FC<AITransactionExplanationProps> = ({
  transaction,
  className = '',
  detailLevel = 'detailed',
  onFeedback
}) => {
  const [explanation, setExplanation] = useState<TransactionExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'mainAction']));
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const loadExplanation = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check for cached explanation first
      const cached = await aiTransactionAnalyzer.getCachedExplanation(transaction.signature);
      if (cached) {
        setExplanation(cached);
        setLoading(false);
        return;
      }

      // Generate new explanation
      const result = await aiTransactionAnalyzer.analyzeTransaction(transaction, {
        detailLevel,
        focusAreas: []
      });
      
      setExplanation(result);
      
      // Cache the result
      await aiTransactionAnalyzer.cacheExplanation(transaction.signature, result);
      
    } catch (err) {
      console.error('Failed to load AI explanation:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate explanation');
    } finally {
      setLoading(false);
    }
  }, [transaction, detailLevel]);

  // Load explanation on mount
  useEffect(() => {
    loadExplanation();
  }, [transaction.signature, detailLevel, loadExplanation]);

  const regenerateExplanation = async () => {
    setRegenerating(true);
    setFeedbackGiven(null);
    await loadExplanation();
    setRegenerating(false);
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const shareExplanation = async () => {
    if (!explanation) return;

    const shareText = `AI Analysis of Solana Transaction:\n\n${explanation.summary}\n\nMain Action: ${explanation.mainAction.description}\n\nRisk Level: ${explanation.riskAssessment.level.toUpperCase()}\n\nTransaction: ${transaction.signature}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Transaction Analysis',
          text: shareText,
          url: `${window.location.origin}/tx/${transaction.signature}`
        });
      } catch (err) {
        // Fallback to copying
        copyToClipboard(shareText, 'share');
      }
    } else {
      copyToClipboard(shareText, 'share');
    }
  };

  const handleFeedback = (feedback: 'positive' | 'negative') => {
    if (!explanation) return;
    
    setFeedbackGiven(feedback);
    onFeedback?.(feedback, explanation);
  };

  const getRiskIcon = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low':
        return <ShieldCheckIcon className="w-5 h-5 text-green-500" />;
      case 'medium':
        return <InfoIcon className="w-5 h-5 text-yellow-500" />;
      case 'high':
        return <AlertTriangleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <InfoIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <BrainIcon className="w-6 h-6 text-primary animate-pulse" />
          <h2 className="text-xl font-semibold text-foreground">AI Transaction Analysis</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="w-5 h-5 text-primary animate-spin" />
            <span className="text-muted-foreground">Analyzing transaction with AI...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-background rounded-lg border border-border p-6 ${className}`}>
        <div className="flex items-center space-x-3 mb-4">
          <BrainIcon className="w-6 h-6 text-destructive" />
          <h2 className="text-xl font-semibold text-foreground">AI Transaction Analysis</h2>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangleIcon className="w-5 h-5 text-destructive" />
            <span className="font-medium text-destructive">Analysis Failed</span>
          </div>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={loadExplanation}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCwIcon className="w-4 h-4" />
            <span>Retry Analysis</span>
          </button>
        </div>
      </div>
    );
  }

  if (!explanation) {
    return null;
  }

  return (
    <div className={`bg-background rounded-lg border border-border ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <BrainIcon className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">AI Transaction Analysis</h2>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(explanation.confidence)} bg-muted`}>
              {formatConfidenceLevel(explanation.confidence)} Confidence
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={shareExplanation}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title="Share analysis"
            >
              {copiedField === 'share' ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ShareIcon className="w-4 h-4" />
              )}
            </button>
            
            <button
              onClick={regenerateExplanation}
              disabled={regenerating}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Regenerate analysis"
            >
              <RefreshCwIcon className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Risk Assessment Badge */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {getRiskIcon(explanation.riskAssessment.level)}
            <span className={`font-medium ${getRiskLevelColor(explanation.riskAssessment.level)}`}>
              {explanation.riskAssessment.level.toUpperCase()} RISK
            </span>
            <span className="text-muted-foreground">
              (Score: {explanation.riskAssessment.score}/10)
            </span>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <ClockIcon className="w-4 h-4" />
            <span>Generated {new Date(explanation.generatedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="p-6 border-b border-border">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('summary')}
        >
          <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
            <span>Summary</span>
            {expandedSections.has('summary') ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(explanation.summary, 'summary');
            }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy summary"
          >
            {copiedField === 'summary' ? (
              <CheckIcon className="w-3 h-3 text-green-500" />
            ) : (
              <CopyIcon className="w-3 h-3" />
            )}
          </button>
        </div>
        
        {expandedSections.has('summary') && (
          <div className="mt-3">
            <p className="text-foreground leading-relaxed">{explanation.summary}</p>
          </div>
        )}
      </div>

      {/* Main Action Section */}
      <div className="p-6 border-b border-border">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('mainAction')}
        >
          <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
            <span>Main Action</span>
            <span className="text-lg">{getActionTypeIcon(explanation.mainAction.type)}</span>
            {expandedSections.has('mainAction') ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </h3>
        </div>
        
        {expandedSections.has('mainAction') && (
          <div className="mt-4 space-y-4">
            <div className="bg-muted/20 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <span className="font-medium text-foreground capitalize">{explanation.mainAction.type}</span>
                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                  Primary Action
                </span>
              </div>
              <p className="text-muted-foreground">{explanation.mainAction.description}</p>
            </div>

            {/* Participants */}
            {explanation.mainAction.participants.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <UsersIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">Participants</span>
                </div>
                <div className="space-y-2">
                  {explanation.mainAction.participants.map((participant, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                        {participant.substring(0, 8)}...{participant.substring(-4)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(participant, `participant-${index}`)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy address"
                      >
                        {copiedField === `participant-${index}` ? (
                          <CheckIcon className="w-3 h-3 text-green-500" />
                        ) : (
                          <CopyIcon className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Amounts */}
            {explanation.mainAction.amounts.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSignIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">Amounts</span>
                </div>
                <div className="space-y-2">
                  {explanation.mainAction.amounts.map((amount, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted/10 p-3 rounded">
                      <div>
                        <span className="font-medium text-foreground">{amount.amount} {amount.token}</span>
                        {amount.usdValue && (
                          <span className="text-muted-foreground ml-2">
                            (~${amount.usdValue.toLocaleString()})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Secondary Effects Section */}
      {explanation.secondaryEffects.length > 0 && (
        <div className="p-6 border-b border-border">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('secondaryEffects')}
          >
            <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
              <span>Secondary Effects ({explanation.secondaryEffects.length})</span>
              {expandedSections.has('secondaryEffects') ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </h3>
          </div>
          
          {expandedSections.has('secondaryEffects') && (
            <div className="mt-4 space-y-3">
              {explanation.secondaryEffects.map((effect, index) => (
                <div key={index} className="bg-muted/10 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground capitalize">
                      {effect.type.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      effect.significance === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      effect.significance === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {effect.significance}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{effect.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Risk Assessment Section */}
      <div className="p-6 border-b border-border">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection('riskAssessment')}
        >
          <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
            <span>Risk Assessment</span>
            {getRiskIcon(explanation.riskAssessment.level)}
            {expandedSections.has('riskAssessment') ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </h3>
        </div>
        
        {expandedSections.has('riskAssessment') && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/20 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Risk Level</div>
                <div className={`text-lg font-semibold ${getRiskLevelColor(explanation.riskAssessment.level)}`}>
                  {explanation.riskAssessment.level.toUpperCase()}
                </div>
              </div>
              <div className="bg-muted/20 p-3 rounded-lg">
                <div className="text-sm text-muted-foreground">Risk Score</div>
                <div className="text-lg font-semibold text-foreground">
                  {explanation.riskAssessment.score}/10
                </div>
              </div>
            </div>

            {explanation.riskAssessment.factors.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-2">Risk Factors</h4>
                <ul className="space-y-1">
                  {explanation.riskAssessment.factors.map((factor, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <span className="text-destructive mt-1">•</span>
                      <span className="text-muted-foreground">{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {explanation.riskAssessment.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-2">Recommendations</h4>
                <ul className="space-y-1">
                  {explanation.riskAssessment.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-muted-foreground">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Technical Details Section */}
      {detailLevel === 'technical' && (
        <div className="p-6 border-b border-border">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('technicalDetails')}
          >
            <h3 className="text-lg font-medium text-foreground flex items-center space-x-2">
              <span>Technical Details</span>
              <SettingsIcon className="w-4 h-4" />
              {expandedSections.has('technicalDetails') ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRightIcon className="w-4 h-4" />
              )}
            </h3>
          </div>
          
          {expandedSections.has('technicalDetails') && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/20 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Instructions</div>
                  <div className="text-lg font-semibold text-foreground">
                    {explanation.technicalDetails.instructionCount}
                  </div>
                </div>
                <div className="bg-muted/20 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Accounts</div>
                  <div className="text-lg font-semibold text-foreground">
                    {explanation.technicalDetails.accountsAffected}
                  </div>
                </div>
                <div className="bg-muted/20 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Programs</div>
                  <div className="text-lg font-semibold text-foreground">
                    {explanation.technicalDetails.programsUsed.length}
                  </div>
                </div>
                <div className="bg-muted/20 p-3 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total Fees</div>
                  <div className="text-lg font-semibold text-foreground">
                    {(explanation.technicalDetails.fees.total / 1e9).toFixed(6)} SOL
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-2">Programs Used</h4>
                <div className="flex flex-wrap gap-2">
                  {explanation.technicalDetails.programsUsed.map((program, index) => (
                    <span key={index} className="bg-muted px-3 py-1 rounded text-sm">
                      {program}
                    </span>
                  ))}
                </div>
              </div>

              {explanation.technicalDetails.computeUnitsUsed && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">Compute Units</h4>
                  <div className="bg-muted/20 p-3 rounded-lg">
                    <span className="text-foreground">
                      {explanation.technicalDetails.computeUnitsUsed.toLocaleString()} CU
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Feedback Section */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <HelpCircleIcon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Was this analysis helpful?</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleFeedback('positive')}
              className={`p-2 rounded transition-colors ${
                feedbackGiven === 'positive' 
                  ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' 
                  : 'text-muted-foreground hover:text-green-600'
              }`}
              title="Helpful"
            >
              <ThumbsUpIcon className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => handleFeedback('negative')}
              className={`p-2 rounded transition-colors ${
                feedbackGiven === 'negative' 
                  ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' 
                  : 'text-muted-foreground hover:text-red-600'
              }`}
              title="Not helpful"
            >
              <ThumbsDownIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {feedbackGiven && (
          <div className="mt-3 text-sm text-muted-foreground">
            Thank you for your feedback! This helps improve our AI analysis.
          </div>
        )}
      </div>
    </div>
  );
};

export default AITransactionExplanation;