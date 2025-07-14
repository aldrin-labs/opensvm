'use client';

import { useState, useCallback } from 'react';
import { DetailedTransactionInfo } from '@/lib/solana';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAbortableFetch } from '@/lib/hooks/useAbortableFetch';
import { logError } from '@/lib/errorLogger';

interface TransactionGPTAnalysisProps {
  tx: DetailedTransactionInfo;
}

export default function TransactionGPTAnalysis({ tx }: TransactionGPTAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<number>(0);
  
  // Use centralized fetch hook with abort logic
  const { fetch: abortableFetch } = useAbortableFetch();

  // Cooldown period in milliseconds (prevent spam clicking)
  const COOLDOWN_PERIOD = 3000; // 3 seconds

  const analyzeWithGPT = useCallback(async () => {
    // Check cooldown period
    const now = Date.now();
    if (now - lastAnalyzedTime < COOLDOWN_PERIOD) {
      setError(`Please wait ${Math.ceil((COOLDOWN_PERIOD - (now - lastAnalyzedTime)) / 1000)} seconds before analyzing again`);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setLastAnalyzedTime(now);

    try {
      // Extract data needed for analysis
      const transactionData = {
        logs: tx.details?.logs || [],
        type: tx.type,
        status: tx.success ? 'success' : 'failed',
        amount: tx.details?.solChanges?.[0]?.change 
          ? Math.abs(tx.details.solChanges[0].change / 1e9) 
          : undefined,
        from: tx.details?.accounts?.[0]?.pubkey,
        to: tx.details?.accounts?.[1]?.pubkey
      };

      // Call the API endpoint using centralized fetch with abort logic
      const data = await abortableFetch<{ analysis: string }>('/api/analyze-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });
      
      setAnalysisResult(data.analysis);
    } catch (err) {
      // Don't set error if request was aborted (component unmounted or new request started)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      logError('Error analyzing transaction', err instanceof Error ? err : new Error(String(err)), {
        transactionType: tx.type,
        transactionSuccess: tx.success,
        endpoint: '/api/analyze-transaction'
      });
      setError('Failed to analyze transaction');
    } finally {
      setIsAnalyzing(false);
    }
  }, [tx, lastAnalyzedTime, abortableFetch]);

  const canAnalyze = !isAnalyzing && (Date.now() - lastAnalyzedTime >= COOLDOWN_PERIOD);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium mb-0">GPT Analysis</h2>
        <button
          onClick={analyzeWithGPT}
          disabled={!canAnalyze}
          className="bg-primary text-white px-4 py-2 rounded-md flex items-center space-x-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canAnalyze && !isAnalyzing ? `Please wait ${Math.ceil((COOLDOWN_PERIOD - (Date.now() - lastAnalyzedTime)) / 1000)} seconds` : undefined}
        >
          {isAnalyzing ? (
            <>
              <LoadingSpinner className="w-4 h-4" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>ANALYZE WITH GPT</span>
            </>
          )}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-700">
          <p>{error}</p>
        </div>
      )}
      
      {analysisResult ? (
        <div className="bg-neutral-900 rounded-md p-4">
          <p className="whitespace-pre-wrap">{analysisResult}</p>
        </div>
      ) : !error && !isAnalyzing && (
        <div className="bg-neutral-900/50 rounded-md p-4 text-neutral-400">
          <p>Click "Analyze with GPT" to get an AI-generated analysis of this transaction.</p>
        </div>
      )}
      
      {isAnalyzing && (
        <div className="bg-neutral-900/50 rounded-md p-4 flex justify-center">
          <LoadingSpinner className="w-6 h-6" />
        </div>
      )}
    </div>
  );
}