'use client';

import React from 'react';
import { Card } from '../ui/card';
import { NetworkSelection } from './NetworkSelection';
import { DataTypeFilters } from './DataTypeFilters';
import { SortOptions } from './SortOptions';
import { AdvancedFilters } from './AdvancedFilters';
import { SearchSettings as SearchSettingsType } from './types';

interface SearchSettingsProps {
  showSettings: boolean;
  settingsRef: React.RefObject<HTMLDivElement>;
  searchSettings: SearchSettingsType;
  setSearchSettings: React.Dispatch<React.SetStateAction<SearchSettingsType>>;
  setShowSettings: (show: boolean) => void;
  toggleNetwork: (networkId: string) => void;
  toggleDataType: (dataType: 'transactions' | 'blocks' | 'programs' | 'tokens') => void;
}

export const SearchSettings: React.FC<SearchSettingsProps> = ({
  showSettings,
  settingsRef,
  searchSettings,
  setSearchSettings,
  setShowSettings,
  toggleNetwork,
  toggleDataType,
}) => {
  if (!showSettings) {
    return null;
  }

  return (
    <div 
      ref={settingsRef} 
      className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-lg shadow-lg z-50 overflow-hidden
                animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
      data-state={showSettings ? 'open' : 'closed'}
    >
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground animate-in slide-in-from-left-2">Search Settings</h3>
          <button 
            type="button" 
            onClick={() => setShowSettings(false)}
            className="text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 hover:rotate-90 transition-transform duration-300" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Network Selection */}
          <NetworkSelection 
            searchSettings={searchSettings} 
            toggleNetwork={toggleNetwork} 
          />
          
          {/* Data Type Filters */}
          <DataTypeFilters 
            searchSettings={searchSettings} 
            toggleDataType={toggleDataType} 
          />
          
          {/* Sort and Order */}
          <SortOptions 
            searchSettings={searchSettings} 
            setSearchSettings={setSearchSettings} 
          />
          
          {/* Advanced Filters */}
          <AdvancedFilters 
            searchSettings={searchSettings} 
            setSearchSettings={setSearchSettings} 
          />
        </div>
      </Card>
    </div>
  );
};
