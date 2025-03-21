'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';

// Dynamically import the TransactionGraph component
const TransactionGraph = dynamic(
  () => import('@/components/TransactionGraph').catch(err => {
    console.error('Failed to load TransactionGraph:', err);
    return () => <div>Error loading transaction graph</div>;
  }),
  {
    loading: () => <LoadingSpinner />,
    ssr: false
  }
);

interface GraphContentProps {
  signature: string;
}

export default function GraphContent({ signature }: GraphContentProps) {
  const [loading, setLoading] = useState(true);
  const [initialAccount, setInitialAccount] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      try {
        // Fetch transaction details to get the main account
        const response = await fetch(`/api/transaction/${signature}`);
        if (response.ok) {
          const data = await response.json();
          if (data.details && data.details.accounts && data.details.accounts.length > 0) {
            // Use the first account as the initial account for the graph
            setInitialAccount(data.details.accounts[0].pubkey);
          }
        }
      } catch (error) {
        console.error('Error fetching transaction details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactionDetails();
  }, [signature]);

  // Handle transaction selection in the graph
  const handleTransactionSelect = (newSignature: string) => {
    if (newSignature !== signature) {
      router.push(`/tx/${newSignature}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Transaction Graph</h1>
        <Link 
          href={`/tx/${signature}`}
          className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          View Transaction Details
        </Link>
      </div>
      
      {/* Transaction signature display */}
      <div className="bg-muted p-4 rounded-md border border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-1">Transaction signature:</h2>
        <p className="font-mono text-xs sm:text-sm break-all">{signature}</p>
      </div>
      
      {/* Instructions - collapsible on mobile */}
      <div className="bg-muted/50 border border-border rounded-md shadow-sm">
        <div 
          className="flex justify-between items-center p-3 cursor-pointer"
          onClick={() => setShowInstructions(!showInstructions)}
        >
          <h2 className="text-sm font-medium">How to use the graph</h2>
          <span className="text-xs">{showInstructions ? '▼' : '▶'}</span>
        </div>
        
        {showInstructions && <div className="px-4 pb-4">
        <ul className="list-disc list-inside text-xs sm:text-sm space-y-2 text-muted-foreground">
          <li>Click on a transaction node (diamond shape) to navigate to its details</li>
          <li>Hover over nodes to see more information</li>
          <li>Use the controls in the bottom right to zoom and fit the view</li>
          <li>The graph shows transactions up to 3 levels deep from the original transaction</li>
          <li>ComputeBudget transactions, Raydium Pools, and Jupiter transactions are excluded</li>
          <li>This filtering improves performance and focuses on the most relevant transaction relationships</li>
          <li>Green lines indicate token transfers</li>
        </ul>
        </div>}
      </div>
      
      {/* Graph visualization */}
      <div className="bg-background rounded-lg p-2 sm:p-4 md:p-5 shadow-lg border border-border h-full flex flex-col transaction-graph-card" ref={graphContainerRef} style={{ minHeight: "calc(70vh - 200px)" }}>
        <div className="transaction-graph-container flex-1 relative overflow-hidden">
          {initialAccount ? (
            <TransactionGraph
              initialSignature={signature} 
              initialAccount={initialAccount}
              onTransactionSelect={handleTransactionSelect}
              height="100%"
              width="100%"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-center p-4">
                Unable to generate graph. No accounts found in transaction.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}