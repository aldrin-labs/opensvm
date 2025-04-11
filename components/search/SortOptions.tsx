'use client';

import React from 'react';
import { SearchSettings } from './types';

interface SortOptionsProps {
  searchSettings: SearchSettings;
  setSearchSettings: React.Dispatch<React.SetStateAction<SearchSettings>>;
}

export const SortOptions: React.FC<SortOptionsProps> = ({
  searchSettings,
  setSearchSettings,
}) => {
  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-foreground">Sort Results</h4>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="sort-by" className="block text-xs text-muted-foreground mb-1">Sort By</label>
          <select
            id="sort-by"
            value={searchSettings.sortBy}
            onChange={(e) => setSearchSettings({
              ...searchSettings,
              sortBy: e.target.value as any
            })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="relevance">Relevance</option>
            <option value="date">Date</option>
            <option value="amount">Amount</option>
          </select>
        </div>
        <div>
          <label htmlFor="sort-order" className="block text-xs text-muted-foreground mb-1">Order</label>
          <select
            id="sort-order"
            value={searchSettings.sortOrder}
            onChange={(e) => setSearchSettings({
              ...searchSettings,
              sortOrder: e.target.value as any
            })}
            className="w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>
    </div>
  );
};