'use client';

import { useState, useEffect, useCallback } from 'react';

export interface InvestigationRecord {
  address: string;
  timestamp: number;
  riskScore: number;
  transactionCount: number;
  findings: number;
  label?: string;
}

const STORAGE_KEY = 'opensvm_investigation_history';
const MAX_HISTORY = 20;

export function useInvestigationHistory() {
  const [history, setHistory] = useState<InvestigationRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(Array.isArray(parsed) ? parsed : []);
      }
    } catch (err) {
      console.error('Failed to load investigation history:', err);
    }
    setIsLoaded(true);
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      } catch (err) {
        console.error('Failed to save investigation history:', err);
      }
    }
  }, [history, isLoaded]);

  // Add a new investigation to history
  const addToHistory = useCallback((record: Omit<InvestigationRecord, 'timestamp'>) => {
    setHistory(prev => {
      // Remove existing record for this address
      const filtered = prev.filter(r => r.address !== record.address);
      // Add new record at the beginning
      const updated = [
        { ...record, timestamp: Date.now() },
        ...filtered
      ].slice(0, MAX_HISTORY);
      return updated;
    });
  }, []);

  // Remove an investigation from history
  const removeFromHistory = useCallback((address: string) => {
    setHistory(prev => prev.filter(r => r.address !== address));
  }, []);

  // Update label for an investigation
  const updateLabel = useCallback((address: string, label: string) => {
    setHistory(prev => prev.map(r =>
      r.address === address ? { ...r, label } : r
    ));
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // Get a specific record
  const getRecord = useCallback((address: string) => {
    return history.find(r => r.address === address);
  }, [history]);

  return {
    history,
    isLoaded,
    addToHistory,
    removeFromHistory,
    updateLabel,
    clearHistory,
    getRecord
  };
}
