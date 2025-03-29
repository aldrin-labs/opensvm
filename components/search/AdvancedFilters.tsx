'use client';

import React from 'react';
import { SearchSettings } from './types';

interface AdvancedFiltersProps {
  searchSettings: SearchSettings;
  setSearchSettings: React.Dispatch<React.SetStateAction<SearchSettings>>;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  searchSettings,
  setSearchSettings,
}) => {
  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-gray-700">Advanced Filters</h4>
      <div className="space-y-2">
        <div>
          <label htmlFor="status-filter" className="block text-xs text-gray-500 mb-1">Status</label>
          <select
            id="status-filter"
            value={searchSettings.status || ''}
            onChange={(e) => setSearchSettings({
              ...searchSettings,
              status: e.target.value as any || undefined
            })}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date Range</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={searchSettings.dateRange?.start || ''}
              onChange={(e) => setSearchSettings({
                ...searchSettings,
                dateRange: {
                  start: e.target.value,
                  end: searchSettings.dateRange?.end || ''
                }
              })}
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
            />
            <input
              type="date"
              value={searchSettings.dateRange?.end || ''}
              onChange={(e) => setSearchSettings({
                ...searchSettings,
                dateRange: {
                  start: searchSettings.dateRange?.start || '',
                  end: e.target.value
                }
              })}
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount Range</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min"
              value={searchSettings.minAmount || ''}
              onChange={(e) => setSearchSettings({
                ...searchSettings,
                minAmount: e.target.value ? parseFloat(e.target.value) : undefined
              })}
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
            />
            <input
              type="number"
              placeholder="Max"
              value={searchSettings.maxAmount || ''}
              onChange={(e) => setSearchSettings({
                ...searchSettings,
                maxAmount: e.target.value ? parseFloat(e.target.value) : undefined
              })}
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};