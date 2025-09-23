'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/lib/settings';
import ProgramActivityTable, { type ProgramActivity } from '@/components/ProgramActivityTable';
import { Button } from '@/components/ui/button';
import { 
  getProgramActivity, 
  getTopPrograms, 
  getProgramStats, 
  type ProgramListResponse 
} from '@/lib/program-data';
import { formatLargeNumber } from '@/utils/format';

type ViewMode = 'all' | 'calls' | 'transactions' | 'blocks';

export default function ProgramsPage() {
  const router = useRouter();
  const settings = useSettings();
  const [programs, setPrograms] = useState<ProgramActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [stats, setStats] = useState({
    totalActivePrograms: 0,
    totalCalls: 0,
    avgCallsPerProgram: 0,
    topProgramTypes: [] as { type: string; count: number }[]
  });

  // Auto-refresh data every 45 seconds for real-time updates
  useEffect(() => {
    const loadPrograms = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        let programsResponse: ProgramListResponse | undefined;
        let programsData: ProgramActivity[];
        
        // Load different data based on view mode
        if (viewMode === 'all') {
          programsResponse = await getProgramActivity(50);
          programsData = programsResponse.programs;
        } else {
          // For top programs views, get data sorted by specific metrics
          const metric = viewMode === 'calls' ? 'calls' : 
                        viewMode === 'transactions' ? 'transactions' : 'blocks';
          programsData = await getTopPrograms(metric, 50);
        }
        
        // Load stats in parallel
        const [programStats] = await Promise.all([
          getProgramStats()
        ]);
        
        setPrograms(programsData);
        setHasMore(programsResponse?.hasMore || false);
        setCursor(programsResponse?.cursor);
        setStats(programStats);
      } catch (err) {
        console.error('Error loading programs:', err);
        setError('Failed to load program data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPrograms();

    // Set up auto-refresh
    const interval = setInterval(loadPrograms, 45000); // Refresh every 45 seconds

    return () => clearInterval(interval);
  }, [viewMode]);

  const handleProgramClick = (address: string) => {
    router.push(`/program/${address}`);
  };

  const loadMore = async () => {
    if (!hasMore || isLoading || !cursor || viewMode !== 'all') return;

    try {
      setIsLoading(true);
      const response: ProgramListResponse = await getProgramActivity(50);
      setPrograms(prev => [...prev, ...response.programs]);
      setHasMore(response.hasMore);
      setCursor(response.cursor);
    } catch (err) {
      console.error('Error loading more programs:', err);
      setError('Failed to load more programs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getViewTitle = () => {
    switch (viewMode) {
      case 'calls': return 'Top Programs by Total Calls';
      case 'transactions': return 'Top Programs by Transaction Count';
      case 'blocks': return 'Top Programs by Block Activity';
      default: return 'All Program Activity';
    }
  };

  const getViewDescription = () => {
    switch (viewMode) {
      case 'calls': return 'Programs ranked by total number of calls across recent blocks.';
      case 'transactions': return 'Programs ranked by transaction volume and frequency.';
      case 'blocks': return 'Programs ranked by number of blocks they appear in.';
      default: return 'Comprehensive view of all program activity on the Solana network.';
    }
  };

  return (
    <div className="ai-programs-page-wrapper"> {/* Added ai-programs-page-wrapper */}
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{getViewTitle()}</h1>
          <p className="text-muted-foreground">
            {getViewDescription()} Data updates every 45 seconds.
          </p>
        </div>

        {/* View Mode Selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={viewMode === 'all' ? 'default' : 'outline'}
            onClick={() => setViewMode('all')}
            size="sm"
          >
            All Programs
          </Button>
          <Button
            variant={viewMode === 'calls' ? 'default' : 'outline'}
            onClick={() => setViewMode('calls')}
            size="sm"
          >
            Top by Calls
          </Button>
          <Button
            variant={viewMode === 'transactions' ? 'default' : 'outline'}
            onClick={() => setViewMode('transactions')}
            size="sm"
          >
            Top by Transactions
          </Button>
          <Button
            variant={viewMode === 'blocks' ? 'default' : 'outline'}
            onClick={() => setViewMode('blocks')}
            size="sm"
          >
            Top by Blocks
          </Button>
        </div>

        {/* Program Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-background border border-border rounded-lg p-6">
            <div className="text-sm text-muted-foreground">Active Programs</div>
            <div className="text-2xl font-bold text-foreground">
              {formatLargeNumber(stats.totalActivePrograms)}
            </div>
          </div>
          <div className="bg-background border border-border rounded-lg p-6">
            <div className="text-sm text-muted-foreground">Total Calls</div>
            <div className="text-2xl font-bold text-foreground">
              {formatLargeNumber(stats.totalCalls)}
            </div>
          </div>
          <div className="bg-background border border-border rounded-lg p-6">
            <div className="text-sm text-muted-foreground">Avg Calls/Program</div>
            <div className="text-2xl font-bold text-foreground">
              {formatLargeNumber(Math.round(stats.avgCallsPerProgram))}
            </div>
          </div>
          <div className="bg-background border border-border rounded-lg p-6">
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                Live Tracking
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600">Active</div>
          </div>
        </div>

        {/* Top Program Types */}
        {stats.topProgramTypes.length > 0 && (
          <div className="bg-background border border-border rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">Program Types Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {stats.topProgramTypes.map(({ type, count }) => (
                <div key={type} className="text-center">
                  <div className="text-lg font-bold text-foreground">{count}</div>
                  <div className="text-sm text-muted-foreground">{type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <ProgramActivityTable
            programs={programs}
            onProgramClick={handleProgramClick}
            isLoading={isLoading && programs.length === 0}
            {...({ settings } as any)}
          />

          {hasMore && !isLoading && viewMode === 'all' && (
            <div className="flex justify-center">
              <Button onClick={loadMore} variant="outline">
                Load More Programs
              </Button>
            </div>
          )}

          {isLoading && programs.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">Loading more programs...</span>
            </div>
          )}
        </div>

        <div className="mt-8 text-sm text-muted-foreground">
          <p>
            Program activity data is analyzed from recent blockchain activity and updated in real-time. 
            Click on any program to view detailed information and transaction history.
          </p>
        </div>
      </div>
    </div>
  );
}
