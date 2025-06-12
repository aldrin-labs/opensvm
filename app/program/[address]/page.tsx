import { notFound } from 'next/navigation';
import { isValidSolanaAddress } from '@/lib/utils';
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

interface Props {
  params: Promise<{ address: string }>;
}

async function fetchProgramData(address: string): Promise<ProgramResponse> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/program/${encodeURIComponent(address)}`, {
    cache: 'no-store'
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch program data' }));
    throw new Error(errorData.error || 'Failed to fetch program data');
  }

  return response.json();
}

export default async function ProgramPage({ params }: Props) {
  const { address } = await params;

  // Validate address format
  if (!address || !isValidSolanaAddress(address)) {
    notFound();
  }

  try {
    const data = await fetchProgramData(address);
    
    return (
      <div className="container mx-auto px-4 py-8">
        <ProgramView 
          programData={data.programData}
          serializedAccountInfo={data.serializedAccountInfo}
        />
      </div>
    );
  } catch (error) {
    console.error('Error fetching program:', error);
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-500 mb-2">Error Loading Program</h2>
          <p className="text-red-400">{error instanceof Error ? error.message : 'Failed to load program'}</p>
        </div>
      </div>
    );
  }
}
