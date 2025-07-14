'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { formatLargeNumber, formatAddress } from '@/utils/format';

export interface ProgramActivity {
  address: string;
  name?: string;
  txCount: number;
  blockCount: number;
  avgCallsPerBlock: number;
  totalCalls: number;
  lastActive: Date;
  type?: string;
}

interface ProgramActivityTableProps {
  programs: ProgramActivity[];
  onProgramClick?: (address: string) => void;
  isLoading?: boolean;
}

type SortField = 'txCount' | 'blockCount' | 'avgCallsPerBlock' | 'totalCalls' | 'lastActive';
type SortDirection = 'asc' | 'desc';

export default function ProgramActivityTable({ programs, onProgramClick, isLoading }: ProgramActivityTableProps) {
  const [sortField, setSortField] = useState<SortField>('totalCalls');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedPrograms = [...programs].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    
    if (sortField === 'lastActive') {
      aValue = aValue instanceof Date ? aValue.getTime() : 0;
      bValue = bValue instanceof Date ? bValue.getTime() : 0;
    }
    
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

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getProgramTypeBadge = (address: string, type?: string) => {
    // Common Solana program identifiers
    const knownPrograms: Record<string, { name: string; type: string; color: string }> = {
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': { name: 'Token Program', type: 'System', color: 'bg-blue-500/20 text-blue-400' },
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': { name: 'Associated Token', type: 'System', color: 'bg-blue-500/20 text-blue-400' },
      '11111111111111111111111111111111': { name: 'System Program', type: 'System', color: 'bg-gray-500/20 text-gray-400' },
      'ComputeBudget111111111111111111111111111111': { name: 'Compute Budget', type: 'System', color: 'bg-gray-500/20 text-gray-400' },
      'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': { name: 'Jupiter', type: 'DEX', color: 'bg-green-500/20 text-green-400' },
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': { name: 'Whirlpool', type: 'DEX', color: 'bg-green-500/20 text-green-400' },
      'srmqPiKJxfFFv8VWKhMBCQa8K5B4KS4qUhaDZAmXcF': { name: 'Serum', type: 'DEX', color: 'bg-green-500/20 text-green-400' },
    };

    const known = knownPrograms[address];
    if (known) {
      return (
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${known.color}`}>
            {known.type}
          </span>
          <span className="text-sm font-medium text-foreground">{known.name}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
          {type || 'Custom'}
        </span>
        <span className="font-mono text-sm text-muted-foreground">
          {formatAddress(address)}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-6 py-4">
          <div className="animate-pulse h-6 bg-muted rounded w-40"></div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="grid grid-cols-6 gap-4">
                <div className="h-4 bg-muted rounded col-span-2"></div>
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

  if (!programs || programs.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No program activity available</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                Program
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('totalCalls')}
              >
                Total Calls <SortIcon field="totalCalls" />
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('txCount')}
              >
                Transactions <SortIcon field="txCount" />
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('blockCount')}
              >
                Active Blocks <SortIcon field="blockCount" />
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('avgCallsPerBlock')}
              >
                Avg Calls/Block <SortIcon field="avgCallsPerBlock" />
              </th>
              <th 
                className="px-4 py-3 text-left text-sm font-medium text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleSort('lastActive')}
              >
                Last Active <SortIcon field="lastActive" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPrograms.map((program, index) => (
              <tr 
                key={program.address} 
                className={`
                  border-b border-border hover:bg-muted/30 transition-colors cursor-pointer
                  ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}
                `}
                onClick={() => onProgramClick?.(program.address)}
              >
                <td className="px-4 py-3">
                  {getProgramTypeBadge(program.address, program.type)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm text-foreground">
                    {formatLargeNumber(program.totalCalls)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm text-foreground">
                    {formatLargeNumber(program.txCount)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-foreground">
                    {formatLargeNumber(program.blockCount)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-foreground">
                    {program.avgCallsPerBlock.toFixed(1)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-muted-foreground">
                    {formatTimeAgo(program.lastActive)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}