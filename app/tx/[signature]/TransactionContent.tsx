'use client';

import type { DetailedTransactionInfo } from '@/lib/solana';
import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/LoadingSpinner';
import React, { Suspense, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Dynamically import components with no SSR and proper loading states
const TransactionNodeDetails = dynamic(
  () => import('@/components/TransactionNodeDetails').catch(err => {
    console.error('Failed to load TransactionNodeDetails:', err);
    return () => <div>Error loading transaction details</div>;
  }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false
  }
);

const TransactionAnalysis = dynamic(
  () => import('@/components/TransactionAnalysis').catch(err => {
    console.error('Failed to load TransactionAnalysis:', err);
    return () => <div>Error loading transaction analysis</div>;
  }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false
  }
);

// Skip EnhancedTransactionVisualizer for now since it requires d3
const TransactionOverview = ({ tx, signature }: { tx: DetailedTransactionInfo; signature: string }) => (
  <div className="bg-background rounded-lg p-6 shadow-lg border border-border">
    <h2 className="text-xl font-semibold mb-4 text-foreground">Transaction Overview</h2>
    <div className="text-sm space-y-4">
      <div className="break-all">
        <span className="text-muted-foreground block mb-1">Signature</span>
        <code className="bg-muted px-2 py-1 rounded text-foreground">{signature}</code>
      </div>
      <div>
        <span className="text-muted-foreground block mb-1">Status</span>
        <span className={tx?.success ? 'text-success font-medium' : 'text-destructive font-medium'}>
          {tx?.success ? 'Success' : 'Failed'}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground block mb-1">Type</span>
        <span className="capitalize text-foreground">{tx?.type || 'Unknown'}</span>
      </div>
      <div>
        <span className="text-muted-foreground block mb-1">Timestamp</span>
        <span className="text-foreground">
          {tx?.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Unknown'}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground block mb-1">Slot</span>
        <span className="text-foreground">{tx?.slot?.toLocaleString() || 'Unknown'}</span>
      </div>
    </div>
  </div>
);

async function getTransactionDetails(signature: string): Promise<DetailedTransactionInfo> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    // First try the test endpoint
    const testResponse = await fetch('/api/test-transaction', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    if (testResponse.ok) {
      const testData = await testResponse.json();
      clearTimeout(timeoutId);
      return testData;
    }

    // If test endpoint fails, try the main endpoint
    const response = await fetch(`/api/transaction/${signature}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch transaction';
      let errorDetails = '';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
        errorDetails = errorData.details ? JSON.stringify(errorData.details, null, 2) : '';
      } catch {
        errorMessage = errorText || errorMessage;
      }

      if (response.status === 404) {
        throw new Error('Transaction not found. Please check the signature and try again.');
      }
      if (response.status === 429) {
        throw new Error('Too many requests. Please try again in a few moments.');
      }
      if (response.status === 403) {
        throw new Error('Access denied. Please check your permissions.');
      }
      if (response.status === 500) {
        throw new Error(`Server error: ${errorMessage}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ''}`);
      }
      throw new Error(`${errorMessage}${errorDetails ? `\n\nDetails:\n${errorDetails}` : ''}`);
    }

    const tx = await response.json();
    if (!tx) {
      throw new Error('Transaction data is empty. Please try again.');
    }

    return tx;
  } catch (error) {
    console.error('Error fetching transaction:', error);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    }
    throw new Error('Failed to fetch transaction details');
  }
}

function ErrorDisplay({ error, signature }: { error: Error; signature: string }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      window.location.reload();
    } catch {
      setRetrying(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-background rounded-lg p-6 shadow-lg border border-destructive/20">
        <h2 className="text-xl font-semibold text-destructive mb-4">Error Loading Transaction</h2>
        <p className="text-foreground mb-4 whitespace-pre-wrap">{error.message}</p>
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">Transaction signature:</p>
          <code className="bg-muted px-2 py-1 rounded break-all">{signature}</code>
        </div>
        <div className="mt-6 text-sm text-muted-foreground">
          <p>Possible reasons:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-foreground">
            <li>The transaction signature is invalid</li>
            <li>The transaction has been pruned from the ledger</li>
            <li>Network connectivity issues</li>
            <li>RPC node rate limits</li>
            <li>Server-side processing errors</li>
          </ul>
        </div>
        <div className="mt-6">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retrying ? (
              <span className="flex items-center">
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Retrying...
              </span>
            ) : (
              'Try Again'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState({ signature }: { signature: string }) {
  const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSlowLoadingMessage(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-background rounded-lg p-6 shadow-lg border border-border">
        <div className="flex items-center justify-center mb-4">
          <LoadingSpinner />
        </div>
        <p className="text-center text-foreground mb-4">Loading transaction details...</p>
        {showSlowLoadingMessage && (
          <p className="text-center text-muted-foreground text-sm mb-4">
            This is taking longer than usual. Please wait...
          </p>
        )}
        <div className="text-sm text-muted-foreground text-center">
          <p className="mb-2">Transaction signature:</p>
          <code className="bg-muted px-2 py-1 rounded break-all">{signature}</code>
        </div>
      </div>
    </div>
  );
}

export default function TransactionContent({ signature }: { signature: string }) {
  const [tx, setTx] = useState<DetailedTransactionInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [gptAnalysis, setGptAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const data = await getTransactionDetails(signature);
        setTx(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [signature]);

  if (loading) {
    return <LoadingState signature={signature} />;
  }

  if (error || !tx) {
    return <ErrorDisplay error={error || new Error('Failed to load transaction')} signature={signature} />;
  }
  
  const handleAnalyzeWithGPT = async () => {
    if (!tx) return;
    
    setIsAnalyzing(true);
    try {
      // Extract relevant data from transaction
      const logs = tx.logs || [];
      const type = tx.type || 'Unknown';
      const status = tx.success ? 'Success' : 'Failed';
      const amount = tx.amount?.toString() || '0';
      const from = tx.from || 'Unknown';
      const to = tx.to || 'Unknown';
      
      const response = await fetch('/api/analyze-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs,
          type,
          status,
          amount,
          from,
          to
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze transaction');
      }
      
      const data = await response.json();
      setGptAnalysis(data.analysis);
    } catch (error) {
      console.error('Error analyzing transaction with GPT:', error);
      toast.error('Failed to analyze transaction');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Transaction Details */}
        <div className="lg:col-span-1 space-y-6">
          <TransactionOverview tx={tx} signature={signature} />
          <ErrorBoundary fallback={<div>Error loading transaction details</div>}>
            <Suspense fallback={<LoadingSpinner />}>
              <div className="bg-background rounded-lg p-6 shadow-lg border border-border">
                <TransactionNodeDetails tx={tx} />
              </div>
            </Suspense>
          </ErrorBoundary>
        </div>

        {/* Middle Panel: Analysis */}
        <div className="lg:col-span-2 space-y-6">
          <ErrorBoundary fallback={<div>Error loading transaction analysis</div>}>
            <Suspense fallback={<LoadingSpinner />}>
              <div className="bg-background rounded-lg p-6 shadow-lg border border-border">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-foreground">Transaction Analysis</h2>
                  <Button 
                    onClick={handleAnalyzeWithGPT} 
                    disabled={isAnalyzing}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center">
                        <LoadingSpinner className="w-4 h-4 mr-2" />
                        Analyzing...
                      </span>
                    ) : (
                      'Analyze with GPT'
                    )}
                  </Button>
                </div>
                
                {gptAnalysis && (
                  <div className="mb-6 p-4 bg-muted rounded-lg">
                    <h3 className="text-lg font-medium mb-2 text-foreground">GPT Analysis</h3>
                    <div className="prose prose-sm dark:prose-invert">
                      <p className="whitespace-pre-wrap text-foreground">{gptAnalysis}</p>
                    </div>
                  </div>
                )}
                
                <TransactionAnalysis tx={tx} />
              </div>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </ErrorBoundary>
  );
}