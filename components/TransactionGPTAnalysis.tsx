'use client';

import { useState, useCallback } from 'react';
import { DetailedTransactionInfo } from '@/lib/solana';
import LoadingSpinner from '@/components/LoadingSpinner';

interface TransactionGPTAnalysisProps {
  tx: DetailedTransactionInfo;
}

export default function TransactionGPTAnalysis({ tx }: TransactionGPTAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeWithGPT = useCallback(async () => {
    setIsAnalyzing(true);
    setError(null);

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

      // Call the API endpoint
      const response = await fetch('/api/analyze-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze transaction');
      }

      const data = await response.json();
      setAnalysisResult(data.analysis);
    } catch (err) {
      console.error('Error analyzing transaction:', err);
      setError('Failed to analyze transaction');
    } finally {
      setIsAnalyzing(false);
    }
  }, [tx]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium mb-0">GPT Analysis</h2>
        <button
          onClick={analyzeWithGPT}
          disabled={isAnalyzing}
          className="bg-primary text-white px-4 py-2 rounded-md flex items-center space-x-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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