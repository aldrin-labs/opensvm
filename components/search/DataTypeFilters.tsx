'use client';

import React from 'react';
import { SearchSettings } from './types';

interface DataTypeFiltersProps {
  searchSettings: SearchSettings;
  toggleDataType: (dataType: 'transactions' | 'blocks' | 'programs' | 'tokens') => void;
}

export const DataTypeFilters: React.FC<DataTypeFiltersProps> = ({
  searchSettings,
  toggleDataType,
}) => {
  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-foreground">Filter by Data Type</h4>
      <div className="space-y-2">
        {['transactions', 'blocks', 'programs', 'tokens'].map((type) => (
          <div key={type} className="flex items-center">
            <input
              type="checkbox"
              id={`type-${type}`}
              checked={searchSettings.dataTypes.includes(type as any)}
              onChange={() => toggleDataType(type as any)}
              className="h-4 w-4 text-primary focus:ring-primary border-input rounded"
            />
            <label htmlFor={`type-${type}`} className="ml-2 text-sm text-foreground capitalize">
              {type}
            </label>
          </div>
        ))}
        {searchSettings.dataTypes.length === 1 && (
          <p className="text-xs text-muted-foreground mt-1">
            At least one data type must be selected
          </p>
        )}
      </div>
    </div>
  );
};