/**
 * History Filter Controls Component
 * Extracted from UserHistoryDisplay for better maintainability
 */

'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

interface HistoryFilterControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedPageType: string;
  onPageTypeChange: (value: string) => void;
  sortBy: 'timestamp' | 'pageType';
  onSortChange: (value: 'timestamp' | 'pageType') => void;
}

export function HistoryFilterControls({
  searchTerm,
  onSearchChange,
  selectedPageType,
  onPageTypeChange,
  sortBy,
  onSortChange
}: HistoryFilterControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search history..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      
      <div className="flex gap-2">
        <Select value={selectedPageType} onValueChange={onPageTypeChange}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="transaction">Transactions</SelectItem>
            <SelectItem value="account">Accounts</SelectItem>
            <SelectItem value="block">Blocks</SelectItem>
            <SelectItem value="program">Programs</SelectItem>
            <SelectItem value="token">Tokens</SelectItem>
            <SelectItem value="validator">Validators</SelectItem>
            <SelectItem value="analytics">Analytics</SelectItem>
            <SelectItem value="search">Search</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => onSortChange(value as 'timestamp' | 'pageType')}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="timestamp">Date</SelectItem>
            <SelectItem value="pageType">Type</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}