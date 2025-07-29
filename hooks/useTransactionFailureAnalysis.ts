import { useState, useEffect, useCallback } from 'react';
import type { 
  TransactionFailureAnalysis, 
  FailureAnalyzerConfig 
} from '@/lib/transaction-failure-analyzer';

interface UseTransactionFailureAnalysisOptions {
  signature: string;
  config?: Partial<FailureAnalyzerConfig>;
  autoAnalyze?: boolean;
}

interface UseTransactionFailureAnalysisReturn {
  analysis: TransactionFailureAnalysis | null;
  isLoading: boolean;
  error: string | null;
  analyze: () => Promise<void>;
  retry: () => Promise<void>;
  updateConfig: (config: Partial<FailureAnalyzerConfig>) => void;
}

export function useTransactionFailureAnalysis({
  signature,
  config = {},
  autoAnalyze = true
}: UseTransactionFailureAnalysisOptions): UseTransactionFailureAnalysisReturn {
  const [analysis, setAnalysis] = useState<TransactionFailureAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<Partial<FailureAnalyzerConfig>>(config);

  const analyze = useCallback(async () => {
    if (!signature) {
      setError('No transaction signature provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/transaction/${signature}/failure-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: currentConfig
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to analyze transaction');
      }

      setAnalysis(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Transaction failure analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [signature, currentConfig]);

  const retry = useCallback(async () => {
    setAnalysis(null);
    await analyze();
  }, [analyze]);

  const updateConfig = useCallback((newConfig: Partial<FailureAnalyzerConfig>) => {
    setCurrentConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Auto-analyze on signature change if enabled
  useEffect(() => {
    if (autoAnalyze && signature) {
      analyze();
    }
  }, [signature, autoAnalyze, analyze]);

  return {
    analysis,
    isLoading,
    error,
    analyze,
    retry,
    updateConfig
  };
}

// Hook for getting cached analysis without triggering new analysis
export function useTransactionFailureAnalysisCache(signature: string) {
  const [analysis, setAnalysis] = useState<TransactionFailureAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCachedAnalysis = useCallback(async () => {
    if (!signature) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/transaction/${signature}/failure-analysis`);
      const result = await response.json();

      if (!result.success) {
        if (result.error?.code === 'TRANSACTION_NOT_FOUND') {
          setError('Transaction not found');
        } else {
          setError(result.error?.message || 'Failed to fetch analysis');
        }
        return;
      }

      setAnalysis(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Failed to fetch cached analysis:', err);
    } finally {
      setIsLoading(false);
    }
  }, [signature]);

  useEffect(() => {
    if (signature) {
      fetchCachedAnalysis();
    }
  }, [signature, fetchCachedAnalysis]);

  return {
    analysis,
    isLoading,
    error,
    refetch: fetchCachedAnalysis
  };
}

// Hook for batch analysis of multiple transactions
export function useBatchTransactionFailureAnalysis(signatures: string[]) {
  const [analyses, setAnalyses] = useState<Map<string, TransactionFailureAnalysis>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const analyzeBatch = useCallback(async () => {
    if (signatures.length === 0) return;

    setIsLoading(true);
    setError(null);
    setProgress(0);

    const results = new Map<string, TransactionFailureAnalysis>();
    let completed = 0;

    try {
      // Process signatures in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < signatures.length; i += batchSize) {
        const batch = signatures.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (signature) => {
          try {
            const response = await fetch(`/api/transaction/${signature}/failure-analysis`);
            const result = await response.json();
            
            if (result.success) {
              results.set(signature, result.data);
            }
            
            completed++;
            setProgress((completed / signatures.length) * 100);
          } catch (err) {
            console.error(`Failed to analyze transaction ${signature}:`, err);
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches to be respectful to the API
        if (i + batchSize < signatures.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      setAnalyses(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Batch analysis failed';
      setError(errorMessage);
      console.error('Batch analysis error:', err);
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  }, [signatures]);

  useEffect(() => {
    if (signatures.length > 0) {
      analyzeBatch();
    }
  }, [signatures, analyzeBatch]);

  return {
    analyses,
    isLoading,
    error,
    progress,
    retry: analyzeBatch
  };
}

// Utility hook for failure analysis statistics
export function useFailureAnalysisStats(analyses: TransactionFailureAnalysis[]) {
  const stats = useMemo(() => {
    if (analyses.length === 0) {
      return {
        totalFailures: 0,
        severityDistribution: {},
        recoverabilityDistribution: {},
        errorCategoryDistribution: {},
        averageConfidence: 0,
        totalFeesLost: 0,
        recoverableCount: 0
      };
    }

    const severityDistribution: Record<string, number> = {};
    const recoverabilityDistribution: Record<string, number> = {};
    const errorCategoryDistribution: Record<string, number> = {};
    
    let totalConfidence = 0;
    let totalFeesLost = 0;
    let recoverableCount = 0;

    analyses.forEach(analysis => {
      // Severity distribution
      severityDistribution[analysis.severity] = (severityDistribution[analysis.severity] || 0) + 1;
      
      // Recoverability distribution
      recoverabilityDistribution[analysis.recoverability] = (recoverabilityDistribution[analysis.recoverability] || 0) + 1;
      
      // Error category distribution
      const category = analysis.errorClassification.primaryCategory;
      errorCategoryDistribution[category] = (errorCategoryDistribution[category] || 0) + 1;
      
      // Aggregate stats
      totalConfidence += analysis.confidence;
      totalFeesLost += analysis.impact.feesLost;
      
      if (analysis.recovery.isRecoverable) {
        recoverableCount++;
      }
    });

    return {
      totalFailures: analyses.length,
      severityDistribution,
      recoverabilityDistribution,
      errorCategoryDistribution,
      averageConfidence: totalConfidence / analyses.length,
      totalFeesLost,
      recoverableCount,
      recoverabilityRate: (recoverableCount / analyses.length) * 100
    };
  }, [analyses]);

  return stats;
}

// Import useMemo for the stats hook
import { useMemo } from 'react';