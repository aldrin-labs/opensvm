'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { formatTimeAgo, formatLargeNumber } from '@/utils/format';
import { BlockDetails } from '@/lib/solana/solana';

interface BlockExploreTableProps {
  blocks: BlockDetails[];
  onBlockClick?: (slot: number) => void;
  isLoading?: boolean;
}

type SortField = 'slot' | 'timestamp' | 'transactionCount' | 'totalFees' | 'totalSolVolume';
type SortDirection = 'asc' | 'desc';

export default function BlockExploreTable({ blocks, onBlockClick, isLoading }: BlockExploreTableProps) {
  const [sortField, setSortField] = useState<SortField>('slot');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedBlocks = [...blocks].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4 inline ml-1" /> : 
      <ChevronDownIcon className="w-4 h-4 inline ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-6 py-4">
          <div className="animate-pulse h-6 bg-muted rounded w-32"></div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="grid grid-cols-7 gap-4">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!blocks || blocks.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No blocks available</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('slot')}
              >
                Slot <SortIcon field="slot" />
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('timestamp')}
              >
                Time <SortIcon field="timestamp" />
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('transactionCount')}
              >
                Transactions <SortIcon field="transactionCount" />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                Success Rate
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('totalFees')}
              >
                Total Fees <SortIcon field="totalFees" />
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('totalSolVolume')}
              >
                SOL Volume <SortIcon field="totalSolVolume" />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                Programs
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedBlocks.map((block, index) => {
              const successRate = block.transactionCount > 0 
                ? ((block.successCount / block.transactionCount) * 100) 
                : 0;
              
              return (
                <tr 
                  key={block.slot} 
                  className={`
                    border-b border-border hover:bg-muted/30 transition-colors cursor-pointer
                    ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                  `}
                  onClick={() => onBlockClick?.(block.slot)}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm font-medium text-foreground">
                      {formatLargeNumber(block.slot)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-muted-foreground">
                      {block.blockTime ? formatTimeAgo(new Date(block.blockTime * 1000)) : 'Unknown'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-foreground">
                      {formatLargeNumber(block.transactionCount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {block.successCount}✓ {block.failureCount}✗
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-sm font-medium ${
                      successRate >= 95 ? 'text-green-600' : 
                      successRate >= 90 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {successRate.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">
                      {block.totalFees.toFixed(6)} SOL
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">
                      {block.totalSolVolume.toFixed(3)} SOL
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-muted-foreground">
                      {block.programs.length} programs
                    </div>
                    {block.programs.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Top: {block.programs[0]?.count} calls
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}