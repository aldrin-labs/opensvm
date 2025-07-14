/**
 * Event Filter Controls Component
 * Provides filtering options for blockchain events
 * Optimized for performance with memoization
 */

'use client';

import React, { useCallback } from 'react';
import { Card } from '@/components/ui/card';

export interface EventFilters {
  showTransactions: boolean;
  showBlocks: boolean;
  showAccountChanges: boolean;
  showSuccessOnly: boolean;
  showFailedOnly: boolean;
  showSPLTransfers: boolean;
  showCustomPrograms: boolean;
  showSystemPrograms: boolean;
  showKnownPrograms: {
    raydium: boolean;
    meteora: boolean;
    aldrin: boolean;
    pumpswap: boolean;
    bonkfun: boolean;
  };
  minFee: number; // in lamports
  maxFee: number; // in lamports
  timeRange: 'all' | '1h' | '6h' | '24h';
}

interface EventFilterControlsProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  eventCounts: {
    transactions: number;
    blocks: number;
    accountChanges: number;
    total: number;
  };
}

export const EventFilterControls = React.memo(function EventFilterControls({ 
  filters, 
  onFiltersChange, 
  eventCounts 
}: EventFilterControlsProps) {
  const updateFilter = useCallback((key: keyof EventFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  const updateKnownProgram = useCallback((program: keyof EventFilters['showKnownPrograms'], value: boolean) => {
    onFiltersChange({
      ...filters,
      showKnownPrograms: {
        ...filters.showKnownPrograms,
        [program]: value
      }
    });
  }, [filters, onFiltersChange]);

  const resetFilters = useCallback(() => {
    onFiltersChange({
      showTransactions: true,
      showBlocks: true,
      showAccountChanges: true,
      showSuccessOnly: false,
      showFailedOnly: false,
      showSPLTransfers: true,
      showCustomPrograms: true,
      showSystemPrograms: false,
      showKnownPrograms: {
        raydium: true,
        meteora: true,
        aldrin: true,
        pumpswap: true,
        bonkfun: true
      },
      minFee: 0,
      maxFee: 1000000000, // 1 SOL in lamports
      timeRange: 'all'
    });
  }, [onFiltersChange]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Event Filters</h3>
        <button
          onClick={resetFilters}
          className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Reset
        </button>
      </div>

      {/* Event Type Filters */}
      <div>
        <h4 className="font-medium mb-2">Event Types</h4>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showTransactions}
              onChange={(e) => updateFilter('showTransactions', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              Transactions ({eventCounts.transactions})
            </span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showBlocks}
              onChange={(e) => updateFilter('showBlocks', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              Blocks ({eventCounts.blocks})
            </span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showAccountChanges}
              onChange={(e) => updateFilter('showAccountChanges', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              Account Changes ({eventCounts.accountChanges})
            </span>
          </label>
        </div>
      </div>

      {/* Transaction Status Filters */}
      <div>
        <h4 className="font-medium mb-2">Transaction Status</h4>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showSuccessOnly}
              onChange={(e) => updateFilter('showSuccessOnly', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Success Only</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showFailedOnly}
              onChange={(e) => updateFilter('showFailedOnly', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Failed Only</span>
          </label>
        </div>
      </div>

      {/* Program Type Filters */}
      <div>
        <h4 className="font-medium mb-2">Program Types</h4>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showSPLTransfers}
              onChange={(e) => updateFilter('showSPLTransfers', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">SPL Transfers</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showCustomPrograms}
              onChange={(e) => updateFilter('showCustomPrograms', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Custom Programs</span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showSystemPrograms}
              onChange={(e) => updateFilter('showSystemPrograms', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">System Programs</span>
          </label>
        </div>
      </div>

      {/* Known Programs */}
      <div>
        <h4 className="font-medium mb-2">Known Programs</h4>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showKnownPrograms.raydium}
              onChange={(e) => updateKnownProgram('raydium', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              <span className="inline-block w-2 h-2 bg-purple-500 rounded mr-1"></span>
              Raydium
            </span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showKnownPrograms.meteora}
              onChange={(e) => updateKnownProgram('meteora', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded mr-1"></span>
              Meteora
            </span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showKnownPrograms.aldrin}
              onChange={(e) => updateKnownProgram('aldrin', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              <span className="inline-block w-2 h-2 bg-orange-500 rounded mr-1"></span>
              Aldrin
            </span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showKnownPrograms.pumpswap}
              onChange={(e) => updateKnownProgram('pumpswap', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              <span className="inline-block w-2 h-2 bg-pink-500 rounded mr-1"></span>
              Pump.fun
            </span>
          </label>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={filters.showKnownPrograms.bonkfun}
              onChange={(e) => updateKnownProgram('bonkfun', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">
              <span className="inline-block w-2 h-2 bg-yellow-500 rounded mr-1"></span>
              Bonkfun
            </span>
          </label>
        </div>
      </div>

      {/* Fee Range Filter */}
      <div>
        <h4 className="font-medium mb-2">Fee Range (SOL)</h4>
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Min Fee</label>
            <input
              type="number"
              min="0"
              step="0.000001"
              value={filters.minFee / 1e9}
              onChange={(e) => updateFilter('minFee', parseFloat(e.target.value || '0') * 1e9)}
              className="w-full p-1 text-xs border rounded"
              placeholder="0.000000"
            />
          </div>
          
          <div>
            <label className="block text-xs text-gray-600 mb-1">Max Fee</label>
            <input
              type="number"
              min="0"
              step="0.000001"
              value={filters.maxFee / 1e9}
              onChange={(e) => updateFilter('maxFee', parseFloat(e.target.value || '1') * 1e9)}
              className="w-full p-1 text-xs border rounded"
              placeholder="1.000000"
            />
          </div>
        </div>
      </div>

      {/* Time Range Filter */}
      <div>
        <h4 className="font-medium mb-2">Time Range</h4>
        <select
          value={filters.timeRange}
          onChange={(e) => updateFilter('timeRange', e.target.value)}
          className="w-full p-2 text-sm border rounded"
        >
          <option value="all">All Time</option>
          <option value="1h">Last 1 Hour</option>
          <option value="6h">Last 6 Hours</option>
          <option value="24h">Last 24 Hours</option>
        </select>
      </div>

      {/* Active Filter Summary */}
      <div className="border-t pt-3">
        <div className="text-xs text-gray-600">
          Showing {eventCounts.total} events
        </div>
      </div>
    </Card>
  );
});