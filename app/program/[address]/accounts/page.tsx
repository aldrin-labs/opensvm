import React from 'react';
import { ProgramAccountSearch } from './components/ProgramAccountSearch';

interface ProgramAccountsPageProps {
  params: {
    address: string;
  };
}

export default function ProgramAccountsPage({ params }: ProgramAccountsPageProps) {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Program Account Discovery</h1>
          <p className="text-gray-400">
            Search for accounts owned by program {params.address}
          </p>
        </div>
        
        <ProgramAccountSearch programId={params.address} />
      </div>
    </div>
  );
}

export function generateMetadata({ params }: ProgramAccountsPageProps) {
  return {
    title: `Program Accounts - ${params.address}`,
    description: `Discover and search accounts owned by Solana program ${params.address}`,
  };
}
