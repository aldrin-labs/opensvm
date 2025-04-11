// Common types for search components

export interface SearchSuggestion {
  type: 'address' | 'transaction' | 'token' | 'program';
  value: string;
  label?: string;
}

export interface SearchSettings {
  networks: string[];
  dataTypes: ('transactions' | 'blocks' | 'programs' | 'tokens')[];
  sortBy: 'relevance' | 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
  dateRange?: {
    start: string;
    end: string;
  };
  status?: 'success' | 'failed';
  minAmount?: number;
  maxAmount?: number;
}