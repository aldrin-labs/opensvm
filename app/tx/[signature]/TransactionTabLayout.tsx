'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import type { DetailedTransactionInfo } from '@/lib/solana';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  BarChart3,
  Brain,
  Bug,
  FileText,
  GitBranch,
  MessageSquare,
  Network,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import ErrorBoundaryWrapper from '@/components/ErrorBoundaryWrapper';

// Dynamically import heavy components
const AccountChangesDisplay = dynamic(
  () => import('@/components/AccountChangesDisplay'),
  { loading: () => <LoadingSpinner />, ssr: false }
);
const AITransactionExplanation = dynamic(
  () => import('@/components/AITransactionExplanation'),
  { loading: () => <LoadingSpinner />, ssr: false }
);
const TransactionFailureAnalysisWrapper = dynamic(
  () => import('@/components/TransactionFailureAnalysis').then(mod => {
    const TransactionFailureAnalysisComponent = mod.default;
    const Wrapper = ({ signature }: { signature: string }) => {
      const { analysis, isLoading, retry } = useTransactionFailureAnalysis({ signature, autoAnalyze: true });
      return (
        <TransactionFailureAnalysisComponent
          signature={signature}
          analysis={analysis || undefined}
          isLoading={isLoading}
          onRetryAnalysis={retry}
        />
      );
    };
    return { default: Wrapper };
  }),
  { loading: () => <LoadingSpinner />, ssr: false }
);
const RelatedTransactionsDisplay = dynamic(
  () => import('@/components/RelatedTransactionsDisplay'),
  { loading: () => <LoadingSpinner />, ssr: false }
);
const TransactionMetricsDisplay = dynamic(
  () => import('@/components/TransactionMetricsDisplay'),
  { loading: () => <LoadingSpinner />, ssr: false }
);
const TransactionGraph = dynamic(
  () => import('@/components/TransactionGraph'),
  { loading: () => <LoadingSpinner />, ssr: false }
);
const TransactionNodeDetails = dynamic(
  () => import('@/components/TransactionNodeDetails'),
  { loading: () => <LoadingSpinner />, ssr: false }
);
const TransactionAnalysis = dynamic(
  () => import('@/components/TransactionAnalysis'),
  { loading: () => <LoadingSpinner />, ssr: false }
);
const TransactionGPTAnalysis = dynamic(
  () => import('@/components/TransactionGPTAnalysis'),
  { loading: () => <LoadingSpinner />, ssr: false }
);

import InstructionBreakdown from '@/components/InstructionBreakdown';
import { useTransactionFailureAnalysis } from '@/hooks/useTransactionFailureAnalysis';

type TabType = 'overview' | 'instructions' | 'accounts' | 'graph' | 'ai' | 'metrics' | 'related' | 'failure';

interface TransactionTabLayoutProps {
  signature: string;
  activeTab: TabType;
}

// User preference management
const TAB_PREFERENCE_KEY = 'opensvm_preferred_tx_tab';

async function saveUserTabPreference(tab: TabType, walletAddress?: string) {
  // Save to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(TAB_PREFERENCE_KEY, tab);
  }

  // Save to user profile if authenticated
  if (walletAddress) {
    try {
      const response = await fetch(`/api/user-tab-preference/${walletAddress}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredTab: tab,
        }),
      });
      if (!response.ok) {
        console.warn('Failed to save tab preference to user profile');
      }
    } catch (error) {
      console.warn('Error saving tab preference:', error);
    }
  }
}

function getUserTabPreference(): TabType | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TAB_PREFERENCE_KEY) as TabType || null;
  }
  return null;
}

async function getUserTabPreferenceFromAPI(walletAddress: string): Promise<TabType | null> {
  try {
    const response = await fetch(`/api/user-tab-preference/${walletAddress}`);
    if (response.ok) {
      const data = await response.json();
      return data.preferredTab || null;
    }
  } catch (error) {
    console.warn('Error fetching user tab preference from API:', error);
  }
  return null;
}

async function getTransactionDetails(signature: string): Promise<DetailedTransactionInfo> {
  const response = await fetch(`/api/transaction/${signature}`);
  if (!response.ok) {
    throw new Error('Failed to fetch transaction details');
  }
  return response.json();
}

export default function TransactionTabLayout({ signature, activeTab }: TransactionTabLayoutProps) {
  const [tx, setTx] = useState<DetailedTransactionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [initialAccount, setInitialAccount] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthContext();

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load transaction data
  useEffect(() => {
    const loadTransaction = async () => {
      try {
        setLoading(true);
        const transactionData = await getTransactionDetails(signature);
        setTx(transactionData);
        
        if (transactionData?.details?.accounts && transactionData.details.accounts.length > 0) {
          setInitialAccount(transactionData.details.accounts[0].pubkey);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadTransaction();
  }, [signature]);

  // Handle tab navigation - save preference when this component mounts
  useEffect(() => {
    // Only save preference when user changes tabs, not on initial load
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isDirectNavigation = currentPath.endsWith(`/${activeTab}`);
    
    if (isDirectNavigation) {
      // Get wallet address if available (this would need to be implemented based on auth system)
      saveUserTabPreference(activeTab);
    }
  }, [activeTab]);

  // Handle transaction selection for graph
  const handleTransactionSelect = useCallback((newSignature: string) => {
    if (newSignature !== signature) {
      router.push(`/tx/${newSignature}/${activeTab}`);
    }
  }, [signature, activeTab, router]);

  if (loading) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="flex items-center justify-center h-32 sm:h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || !tx) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="bg-background rounded-lg p-4 sm:p-6 shadow-lg border border-destructive/20">
          <h2 className="text-lg sm:text-xl font-semibold text-destructive mb-4">Error Loading Transaction</h2>
          <p className="text-sm sm:text-base text-foreground mb-4">{error?.message || 'Failed to load transaction'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="space-y-6 w-full">
        {/* Transaction Status Header */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Transaction Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Badge variant={tx.success ? "default" : "destructive"} className="text-sm">
                {tx.success ? "Success" : "Failed"}
              </Badge>
              <Badge variant="outline">
                Slot: {tx.slot?.toLocaleString()}
              </Badge>
              <Badge variant="outline">
                Type: {tx.type}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Processed at: {tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Unknown'}</p>
              <p>Instructions: {tx.details?.instructions?.length || 0}</p>
              <p>Accounts: {tx.details?.accounts?.length || 0}</p>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Tabbed Interface */}
        <Card className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-4">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Transaction Analysis
              </CardTitle>
            </div>
            
            {/* Custom Tab Navigation - Test-compatible grid structure */}
            <div className="p-2 bg-muted rounded-lg overflow-visible">
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2 w-full">
                <Button
                  variant={activeTab === 'overview' ? 'default' : 'ghost'}
                  size="sm"
                  className={`inline-flex items-center gap-1 text-xs min-w-[80px] px-3 py-2 whitespace-nowrap ${
                    activeTab === 'overview' ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  style={{
                    visibility: 'visible',
                    opacity: 1,
                    display: 'inline-flex',
                    position: 'relative',
                    zIndex: 1
                  }}
                  data-value="overview"
                  data-testid="tab-overview"
                  data-state={activeTab === 'overview' ? 'active' : 'inactive'}
                  onClick={() => {
                    router.push(`/tx/${signature}/overview`);
                    saveUserTabPreference('overview');
                  }}
                >
                  <FileText className="h-3 w-3" />
                  <span>Overview</span>
                </Button>
                <Button
                  variant={activeTab === 'instructions' ? 'default' : 'ghost'}
                  size="sm"
                  className={`inline-flex items-center gap-1 text-xs min-w-[80px] px-3 py-2 whitespace-nowrap ${
                    activeTab === 'instructions' ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  style={{
                    visibility: 'visible',
                    opacity: 1,
                    display: 'inline-flex',
                    position: 'relative',
                    zIndex: 1
                  }}
                  data-value="instructions"
                  data-testid="tab-instructions"
                  data-state={activeTab === 'instructions' ? 'active' : 'inactive'}
                  onClick={() => {
                    router.push(`/tx/${signature}/instructions`);
                    saveUserTabPreference('instructions');
                  }}
                >
                  <Settings className="h-3 w-3" />
                  <span>Instructions</span>
                </Button>
                <Button
                  variant={activeTab === 'accounts' ? 'default' : 'ghost'}
                  size="sm"
                  className={`inline-flex items-center gap-1 text-xs min-w-[80px] px-3 py-2 whitespace-nowrap ${
                    activeTab === 'accounts' ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  style={{
                    visibility: 'visible',
                    opacity: 1,
                    display: 'inline-flex',
                    position: 'relative',
                    zIndex: 1
                  }}
                  data-value="accounts"
                  data-testid="tab-accounts"
                  data-state={activeTab === 'accounts' ? 'active' : 'inactive'}
                  onClick={() => {
                    router.push(`/tx/${signature}/accounts`);
                    saveUserTabPreference('accounts');
                  }}
                >
                  <Users className="h-3 w-3" />
                  <span>Accounts</span>
                </Button>
                <Button
                  variant={activeTab === 'graph' ? 'default' : 'ghost'}
                  size="sm"
                  className={`inline-flex items-center gap-1 text-xs min-w-[80px] px-3 py-2 whitespace-nowrap ${
                    activeTab === 'graph' ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  style={{
                    visibility: 'visible',
                    opacity: 1,
                    display: 'inline-flex',
                    position: 'relative',
                    zIndex: 1
                  }}
                  data-value="graph"
                  data-testid="tab-graph"
                  data-state={activeTab === 'graph' ? 'active' : 'inactive'}
                  onClick={() => {
                    router.push(`/tx/${signature}/graph`);
                    saveUserTabPreference('graph');
                  }}
                >
                  <Network className="h-3 w-3" />
                  <span>Graph</span>
                </Button>
                <Button
                  variant={activeTab === 'ai' ? 'default' : 'ghost'}
                  size="sm"
                  className={`inline-flex items-center gap-1 text-xs min-w-[80px] px-3 py-2 whitespace-nowrap ${
                    activeTab === 'ai' ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  style={{
                    visibility: 'visible',
                    opacity: 1,
                    display: 'inline-flex',
                    position: 'relative',
                    zIndex: 1
                  }}
                  data-value="ai"
                  data-testid="tab-ai"
                  data-state={activeTab === 'ai' ? 'active' : 'inactive'}
                  onClick={() => {
                    router.push(`/tx/${signature}/ai`);
                    saveUserTabPreference('ai');
                  }}
                >
                  <Brain className="h-3 w-3" />
                  <span>AI</span>
                </Button>
                <Button
                  variant={activeTab === 'metrics' ? 'default' : 'ghost'}
                  size="sm"
                  className={`inline-flex items-center gap-1 text-xs min-w-[80px] px-3 py-2 whitespace-nowrap ${
                    activeTab === 'metrics' ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  style={{
                    visibility: 'visible',
                    opacity: 1,
                    display: 'inline-flex',
                    position: 'relative',
                    zIndex: 1
                  }}
                  data-value="metrics"
                  data-testid="tab-metrics"
                  data-state={activeTab === 'metrics' ? 'active' : 'inactive'}
                  onClick={() => {
                    router.push(`/tx/${signature}/metrics`);
                    saveUserTabPreference('metrics');
                  }}
                >
                  <BarChart3 className="h-3 w-3" />
                  <span>Metrics</span>
                </Button>
                <Button
                  variant={activeTab === 'related' ? 'default' : 'ghost'}
                  size="sm"
                  className={`inline-flex items-center gap-1 text-xs min-w-[80px] px-3 py-2 whitespace-nowrap ${
                    activeTab === 'related' ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  style={{
                    visibility: 'visible',
                    opacity: 1,
                    display: 'inline-flex',
                    position: 'relative',
                    zIndex: 1
                  }}
                  data-value="related"
                  data-testid="tab-related"
                  data-state={activeTab === 'related' ? 'active' : 'inactive'}
                  onClick={() => {
                    router.push(`/tx/${signature}/related`);
                    saveUserTabPreference('related');
                  }}
                >
                  <GitBranch className="h-3 w-3" />
                  <span>Related</span>
                </Button>
                {!tx.success && (
                  <Button
                    variant={activeTab === 'failure' ? 'default' : 'ghost'}
                    size="sm"
                    className={`inline-flex items-center gap-1 text-xs min-w-[80px] px-3 py-2 whitespace-nowrap ${
                      activeTab === 'failure' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                    style={{
                      visibility: 'visible',
                      opacity: 1,
                      display: 'inline-flex',
                      position: 'relative',
                      zIndex: 1
                    }}
                    data-value="failure"
                    data-testid="tab-failure"
                    data-state={activeTab === 'failure' ? 'active' : 'inactive'}
                    onClick={() => {
                      router.push(`/tx/${signature}/failure`);
                      saveUserTabPreference('failure');
                    }}
                  >
                    <Bug className="h-3 w-3" />
                    <span>Failure</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mt-0" data-testid="transaction-tab-content">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ErrorBoundaryWrapper fallback={<div>Error loading transaction details</div>}>
                    <Suspense fallback={<div className="h-[300px] flex items-center justify-center"><LoadingSpinner /></div>}>
                      <Card>
                        <CardHeader>
                          <CardTitle>Transaction Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <TransactionNodeDetails tx={tx} />
                        </CardContent>
                      </Card>
                    </Suspense>
                  </ErrorBoundaryWrapper>

                  <ErrorBoundaryWrapper fallback={<div>Error loading transaction analysis</div>}>
                    <Suspense fallback={<div className="h-[300px] flex items-center justify-center"><LoadingSpinner /></div>}>
                      <Card>
                        <CardHeader>
                          <CardTitle>Analysis Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <TransactionAnalysis tx={tx} />
                        </CardContent>
                      </Card>
                    </Suspense>
                  </ErrorBoundaryWrapper>
                </div>
              )}

              {activeTab === 'instructions' && (
                <ErrorBoundaryWrapper fallback={<div>Error loading instruction breakdown</div>}>
                  <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><LoadingSpinner /></div>}>
                    <InstructionBreakdown
                      transaction={tx}
                      onInstructionClick={(instruction, index) => {
                        console.log('Instruction clicked:', instruction, index);
                      }}
                    />
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}

              {activeTab === 'accounts' && (
                <ErrorBoundaryWrapper fallback={<div>Error loading account changes</div>}>
                  <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><LoadingSpinner /></div>}>
                    <AccountChangesDisplay transaction={tx} />
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}

              {activeTab === 'graph' && (
                <ErrorBoundaryWrapper fallback={<div>Error loading transaction graph</div>}>
                  <Suspense fallback={<div className="h-[500px] flex items-center justify-center"><LoadingSpinner /></div>}>
                    <div className="h-[500px] relative border rounded-lg">
                      <TransactionGraph
                        initialSignature={signature}
                        initialAccount={initialAccount || ''}
                        onTransactionSelect={handleTransactionSelect}
                        clientSideNavigation={true}
                        height="100%"
                        width="100%"
                        maxDepth={3}
                      />
                    </div>
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}

              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <ErrorBoundaryWrapper fallback={<div>Error loading AI explanation</div>}>
                    <Suspense fallback={<div className="h-[300px] flex items-center justify-center"><LoadingSpinner /></div>}>
                      <AITransactionExplanation
                        transaction={tx}
                        detailLevel="detailed"
                        onFeedback={(feedback, explanation) => {
                          console.log('AI feedback received:', feedback, explanation.confidence);
                        }}
                      />
                    </Suspense>
                  </ErrorBoundaryWrapper>

                  <ErrorBoundaryWrapper fallback={<div>Error loading GPT analysis</div>}>
                    <Suspense fallback={<div className="h-[300px] flex items-center justify-center"><LoadingSpinner /></div>}>
                      <Card>
                        <CardHeader>
                          <CardTitle>Advanced AI Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <TransactionGPTAnalysis tx={tx} />
                        </CardContent>
                      </Card>
                    </Suspense>
                  </ErrorBoundaryWrapper>
                </div>
              )}

              {activeTab === 'metrics' && (
                <ErrorBoundaryWrapper fallback={<div>Error loading transaction metrics</div>}>
                  <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><LoadingSpinner /></div>}>
                    <TransactionMetricsDisplay transaction={tx} />
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}

              {activeTab === 'related' && (
                <ErrorBoundaryWrapper fallback={<div>Error loading related transactions</div>}>
                  <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><LoadingSpinner /></div>}>
                    <RelatedTransactionsDisplay
                      transaction={tx}
                    />
                  </Suspense>
                </ErrorBoundaryWrapper>
              )}

              {!tx.success && activeTab === 'failure' && (
                  <ErrorBoundaryWrapper fallback={<div>Error loading failure analysis</div>}>
                    <Suspense fallback={<div className="h-[400px] flex items-center justify-center"><LoadingSpinner /></div>}>
                      <TransactionFailureAnalysisWrapper signature={signature} />
                    </Suspense>
                  </ErrorBoundaryWrapper>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}