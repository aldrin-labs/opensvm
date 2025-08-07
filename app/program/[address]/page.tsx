'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useSettings } from '@/app/providers/SettingsProvider';
import { useParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ProgramView from './components/program-view';

interface ProgramData {
  address: string;
  executable: boolean;
  owner: string;
  lamports: number;
  rentEpoch: number;
  data: number[];
  dataSize: number;
}

interface SerializedAccountInfo {
  executable: boolean;
  owner: string;
  lamports: string;
  rentEpoch: string;
  data: number[];
}

interface ProgramResponse {
  programData: ProgramData;
  serializedAccountInfo: SerializedAccountInfo;
}

export default function ProgramPage() {
  const settings = useSettings();
  const params = useParams();
  const address = params?.address as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programData, setProgramData] = useState<ProgramData | null>(null);
  const [serializedAccountInfo, setSerializedAccountInfo] = useState<SerializedAccountInfo | null>(null);

  useEffect(() => {
    const fetchProgramData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/program/${encodeURIComponent(address)}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch program data');
        }

        const data: ProgramResponse = await response.json();
        setProgramData(data.programData);
        setSerializedAccountInfo(data.serializedAccountInfo);
      } catch (err) {
        console.error('Error fetching program:', err);
        setError(err instanceof Error ? err.message : 'Failed to load program');
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      fetchProgramData();
    }
  }, [address]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-500 mb-2">Error Loading Program</h2>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!programData || !serializedAccountInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-yellow-500 mb-2">No Program Data</h2>
          <p className="text-yellow-400">Program data not found or not available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ProgramView 
        programData={programData}
        serializedAccountInfo={serializedAccountInfo}
      />
    </div>
  );
}
