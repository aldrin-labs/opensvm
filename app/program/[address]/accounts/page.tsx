import React from 'react';
import { ProgramAccountSearch } from './components/ProgramAccountSearch';

interface ProgramAccountsPageProps {
  params: Promise<{
    address: string;
  }>;
}

export default async function ProgramAccountsPage({ params }: ProgramAccountsPageProps) {
  const resolvedParams = await params;
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Program Account Discovery</h1>
          <p className="text-gray-400">
            Search for accounts owned by program {resolvedParams.address}
          </p>
        </div>
        
        <ProgramAccountSearch programId={resolvedParams.address} />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: ProgramAccountsPageProps) {
  const resolvedParams = await params;
  
  return {
    title: `Program Accounts - ${resolvedParams.address}`,
    description: `Discover and search accounts owned by Solana program ${resolvedParams.address}`,
  };
}
