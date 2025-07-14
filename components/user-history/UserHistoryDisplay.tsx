/**
 * User History Display Component - Refactored
 * Shows browsing history with fancy UI/UX - broken down for better maintainability
 */

'use client';

import { useState, useMemo } from 'react';
import { UserHistoryEntry } from '@/types/user-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HistoryFilterControls } from './HistoryFilterControls';
import { HistoryEntryItem } from './HistoryEntryItem';
import { 
  Activity, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';

interface UserHistoryDisplayProps {
  history: UserHistoryEntry[];
}

export function UserHistoryDisplay({ history }: UserHistoryDisplayProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPageType, setSelectedPageType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'timestamp' | 'pageType'>('timestamp');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const filteredHistory = useMemo(() => {
    let filtered = history;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(entry =>
        entry.pageTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.metadata?.transactionId?.includes(searchTerm) ||
        entry.metadata?.accountAddress?.includes(searchTerm) ||
        entry.metadata?.searchQuery?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by page type
    if (selectedPageType !== 'all') {
      filtered = filtered.filter(entry => entry.pageType === selectedPageType);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'timestamp') {
        return b.timestamp - a.timestamp;
      } else {
        return a.pageType.localeCompare(b.pageType);
      }
    });

    return filtered;
  }, [history, searchTerm, selectedPageType, sortBy]);

  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredHistory, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No browsing history
            </h3>
            <p className="text-muted-foreground">
              Start exploring the blockchain to see your activity here!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Browsing History</span>
          <span className="text-sm font-normal text-gray-500">
            ({filteredHistory.length} {filteredHistory.length === 1 ? 'entry' : 'entries'})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <HistoryFilterControls
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedPageType={selectedPageType}
          onPageTypeChange={setSelectedPageType}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        <div className="space-y-3">
          {paginatedHistory.map((entry) => (
            <HistoryEntryItem key={entry.id} entry={entry} />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredHistory.length)} of {filteredHistory.length} entries
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  );
                })}
                
                {totalPages > 5 && (
                  <>
                    {totalPages > 6 && <span className="text-gray-400">...</span>}
                    <Button
                      variant={currentPage === totalPages ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      className="w-8 h-8 p-0"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}