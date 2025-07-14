"use client";

import { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TokensTab from './TokensTab';
import TransfersTab from './TransfersTab';
import PlaceholderTab from './PlaceholderTab';

export const tabs = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'sol-transfers', label: 'SOL Transfers' },
  { id: 'token-transfers', label: 'Token Transfers' },
  { id: 'all-transfers', label: 'All Transfers' },
];

interface Props {
  address: string;
  activeTab: string;
  solBalance: number;
  tokenBalances: { mint: string; balance: number; }[];
}

function TabContainerComponent({ address, activeTab, solBalance, tokenBalances }: Props) {
  const router = useRouter();

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/account/${address}?tab=${tabId}`);
  }, [address, router]);

  const renderTabs = () => (
    <div className="flex space-x-4 mb-4 border-b border-gray-200">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`px-4 py-2 -mb-px ${
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
      case 'sol-transfers':
        return (
          <div className="w-full">
            <TransfersTab address={address} transferType="SOL" />
          </div>
        );
      case 'token-transfers':
        return (
          <div className="w-full">
            <TransfersTab address={address} transferType="TOKEN" />
          </div>
        );
      case 'all-transfers':
        return (
          <div className="w-full">
            <TransfersTab address={address} transferType="ALL" />
          </div>
        );
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
