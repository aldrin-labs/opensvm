"use client";

import { memo, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TokensTab from './TokensTab';
import TransfersTab from './TransfersTab';
import PlaceholderTab from './PlaceholderTab';
import SearchResultsTab from './SearchResultsTab';

export const tabs = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'nfts', label: 'NFTs' },
  { id: 'programs', label: 'Programs' },
  { id: 'search', label: 'Search Results' },
];

interface Props {
  address: string;
  activeTab: string;
  solBalance: number;
  tokenBalances: { mint: string; balance: number; }[];
}

function TabContainerComponent({ address, activeTab, solBalance, tokenBalances }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showSearchTab, setShowSearchTab] = useState(false);
  
  // Check if we should show the search tab based on fromSearch parameter
  useEffect(() => {
    const fromSearch = searchParams?.get('fromSearch');
    if (fromSearch === 'true') {
      setShowSearchTab(true);
      // If coming from search and no tab is selected, automatically select the search tab
      if (activeTab === 'tokens') {
        router.push(`/account/${address}?tab=search&fromSearch=true`);
      }
    }
  }, [searchParams, address, activeTab, router]);

  const handleTabChange = useCallback((tabId: string) => {
    // Preserve the fromSearch parameter if it exists
    const fromSearch = searchParams?.get('fromSearch');
    const queryParam = fromSearch ? `&fromSearch=${fromSearch}` : '';
    router.push(`/account/${address}?tab=${tabId}${queryParam}`);
  }, [address, router, searchParams]);

  const renderTabs = () => (
    <div className="flex space-x-4 mb-4 border-b border-gray-200 overflow-x-auto">
      {tabs.filter(tab => tab.id !== 'search' || showSearchTab).map(tab => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`px-4 py-2 -mb-px whitespace-nowrap ${
            activeTab === tab.id 
              ? 'text-blue-500 border-b-2 border-blue-500 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'tokens':
        return <TokensTab solBalance={solBalance} tokenBalances={tokenBalances} />;
      case 'transfers':
        return (
          <div className="w-full">
            <TransfersTab address={address} />
          </div>
        );
      case 'search':
        return <SearchResultsTab address={address} />;
      default:
        return <PlaceholderTab />;
    }
  };

  return (
    <div className="mt-6 w-full">
      {renderTabs()}
      {renderContent()}
    </div>
  );
}

export default memo(TabContainerComponent);
