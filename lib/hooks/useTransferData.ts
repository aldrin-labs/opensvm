import { useState, useEffect } from 'react';

interface Transfer {
  id: string;
  amount: number;
  status: 'success' | 'pending' | 'failed';
  timestamp: string;
}

export function useTransferData() {
  const [data, setData] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Use setError for error handling during data fetching
    const fetchTransferData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Simulated data for testing
        const mockData: Transfer[] = [
          { id: 'tx1', amount: 100, status: 'success', timestamp: new Date().toISOString() },
          { id: 'tx2', amount: -50, status: 'pending', timestamp: new Date().toISOString() },
          { id: 'tx3', amount: 75, status: 'failed', timestamp: new Date().toISOString() },
          // Add more mock data as needed
        ];

        // Simulate API call with potential failure
        setTimeout(() => {
          setData(mockData);
          setLoading(false);
        }, 1000);
      } catch (err) {
        // Use setError for proper error handling
        console.error('Error fetching transfer data:', err);
        setError(err instanceof Error ? err : new Error('Unknown error occurred'));
        setLoading(false);
      }
    };

    fetchTransferData();
  }, []);

  return { data, loading, error };
}