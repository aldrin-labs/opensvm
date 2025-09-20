"use client";

import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
  tokenAccounts?: any[]; // Add tokenAccounts prop
}

function TabContainerComponent({ address, activeTab, solBalance, tokenBalances, tokenAccounts }: Props) {
  const scrollPositions = useRef<Record<string, number>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  // Local state to ensure tab switches render immediately in client/e2e mode
  const [selectedTab, setSelectedTab] = useState<string>(activeTab);

  // Keep local state in sync if parent prop changes (e.g., on initial mount or external nav)
  useEffect(() => {
    const validIds = tabs.map(t => t.id);
    // Backwards compatibility / old links
    if (activeTab === 'transactions') {
      setSelectedTab('account-transfers');
      return;
    }
    // Fallback if an unknown tab id is provided
    if (!validIds.includes(activeTab)) {
      setSelectedTab('account-transfers');
      return;
    }
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

  // Restore scroll position for new tab (only if we have a saved value)
  const restoreScrollPosition = useCallback(() => {
    const map = scrollPositions.current;
    if (typeof window !== 'undefined' && Object.prototype.hasOwnProperty.call(map, selectedTab)) {
      const savedPosition = map[selectedTab] ?? 0;
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

  // Sync tab with browser back/forward navigation without full reload
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = () => {
      try {
        // Save current tab's scroll before switching
        saveScrollPosition();

        const url = new URL(window.location.href);
        const tabParam = url.searchParams.get('tab') || 'account-transfers';
        const validIds = tabs.map(t => t.id);
        const nextTab = validIds.includes(tabParam) ? tabParam : 'account-transfers';

        setSelectedTab(nextTab);
      } catch {
        // noop
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [saveScrollPosition]);

  const handleTabChange = useCallback((tabId: string) => {
    saveScrollPosition(); // Save current position before switching
    setSelectedTab(tabId);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabId);
      // Push a history entry without triggering Next.js navigation or scroll reset
      window.history.pushState(window.history.state, '', url.toString());
    }
    // Do NOT use router.push here to avoid route-level re-render/scroll reset
  }, [saveScrollPosition]);

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
        return <TokensTab solBalance={solBalance} tokenBalances={tokenBalances} tokenAccounts={tokenAccounts} walletAddress={address} />;
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
