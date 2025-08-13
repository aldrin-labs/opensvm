"use client";

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import TokensTab from './TokensTab';
import TransfersTab from './TransfersTab';
import PlaceholderTab from './PlaceholderTab';

export const tabs = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'account-transfers', label: 'Account Transfers' },
  { id: 'all-txs', label: 'All Txs' },
  { id: 'trading-txs', label: 'Trading Txs' },
  { id: 'defi-txs', label: 'DeFi Txs' },
  { id: 'nft-txs', label: 'NFT Txs' },
  { id: 'staking-txs', label: 'Staking Txs' },
  { id: 'utility-txs', label: 'Utility Txs' },
  { id: 'suspicious-txs', label: 'Suspicious Txs' },
  { id: 'custom-program-txs', label: 'Custom Program Txs' },
];

interface Props {
  address: string;
  activeTab: string;
  solBalance: number;
  tokenBalances: { mint: string; balance: number; }[];
}

function TabContainerComponent({ address, activeTab, solBalance, tokenBalances }: Props) {
  const router = useRouter();
  const scrollPositions = useRef<Record<string, number>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  // Local state to ensure tab switches render immediately in client/e2e mode
  const [selectedTab, setSelectedTab] = useState<string>(activeTab);

  // Keep local state in sync if parent prop changes (e.g., on initial mount or external nav)
  useEffect(() => {
    setSelectedTab(activeTab);
  }, [activeTab]);

  // Save scroll position when tab changes
  const saveScrollPosition = useCallback(() => {
    if (contentRef.current) {
      if (typeof window !== 'undefined') {
        scrollPositions.current[selectedTab] = window.scrollY;
      }
    }
  }, [selectedTab]);

  // Restore scroll position for new tab
  const restoreScrollPosition = useCallback(() => {
    const savedPosition = scrollPositions.current[selectedTab] || 0;
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: savedPosition,
        behavior: 'instant' // Prevent smooth scrolling during tab switch
      });
    }
  }, [selectedTab]);

  // Save scroll position before tab change
  useEffect(() => {
    return () => saveScrollPosition();
  }, [saveScrollPosition]);

  // Restore scroll position after tab content loads
  useEffect(() => {
    const timer = setTimeout(restoreScrollPosition, 50);
    return () => clearTimeout(timer);
  }, [selectedTab, restoreScrollPosition]);

  const handleTabChange = useCallback((tabId: string) => {
    saveScrollPosition(); // Save current position before switching
    setSelectedTab(tabId);
    router.push(`/account/${address}?tab=${tabId}`, { scroll: false }); // Prevent automatic scroll to top
  }, [address, router, saveScrollPosition]);

  const renderTabs = () => (
    <div className="flex space-x-4 mb-4 border-b border-border" data-test="account-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          data-test={`tab-${tab.id}`}
          onClick={() => handleTabChange(tab.id)}
          className={`px-4 py-2 -mb-px ${selectedTab === tab.id
            ? 'text-primary border-b-2 border-primary font-medium'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderContent = () => {
    switch (selectedTab) {
      case 'tokens':
        return <TokensTab solBalance={solBalance} tokenBalances={tokenBalances} />;
      case 'account-transfers':
        return (
          <div className="w-full">
            <TransfersTab address={address} transactionCategory="account-transfers" />
          </div>
        );
      case 'all-txs':
        return (
          <div className="w-full">
            <TransfersTab address={address} transactionCategory="all-txs" />
          </div>
        );
      case 'trading-txs':
        return (
          <div className="w-full">
            <TransfersTab address={address} transactionCategory="trading-txs" />
          </div>
        );
      case 'defi-txs':
        return (
          <div className="w-full">
            <TransfersTab address={address} transactionCategory="defi-txs" />
          </div>
        );
      case 'nft-txs':
        return (
          <div className="w-full">
            <TransfersTab address={address} transactionCategory="nft-txs" />
          </div>
        );
      case 'staking-txs':
        return (
          <div className="w-full">
            <TransfersTab address={address} transactionCategory="staking-txs" />
          </div>
        );
      case 'utility-txs':
        return (
          <div className="w-full">
            <TransfersTab address={address} transactionCategory="utility-txs" />
          </div>
        );
      case 'suspicious-txs':
        return (
          <div className="w-full">
            <TransfersTab address={address} transactionCategory="suspicious-txs" />
          </div>
        );
      case 'custom-program-txs':
        return (
          <div className="w-full">
            <TransfersTab address={address} transactionCategory="custom-program-txs" />
          </div>
        );
      default:
        return <PlaceholderTab />;
    }
  };

  return (
    <div className="h-full flex flex-col w-full">
      {renderTabs()}
      <div ref={contentRef} className="flex-1 tab-content min-h-0">
        {renderContent()}
      </div>
    </div>
  );
}

export default memo(TabContainerComponent);
