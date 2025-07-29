"use client";

import { memo, useCallback, useEffect, useRef } from 'react';
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
  const scrollPositions = useRef<Record<string, number>>({});
  const contentRef = useRef<HTMLDivElement>(null);

  // Save scroll position when tab changes
  const saveScrollPosition = useCallback(() => {
    if (contentRef.current) {
      if (typeof window !== 'undefined') {
        scrollPositions.current[activeTab] = window.scrollY;
      }
    }
  }, [activeTab]);

  // Restore scroll position for new tab
  const restoreScrollPosition = useCallback(() => {
    const savedPosition = scrollPositions.current[activeTab] || 0;
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: savedPosition,
        behavior: 'instant' // Prevent smooth scrolling during tab switch
      });
    }
  }, [activeTab]);

  // Save scroll position before tab change
  useEffect(() => {
    return () => saveScrollPosition();
  }, [saveScrollPosition]);

  // Restore scroll position after tab content loads
  useEffect(() => {
    const timer = setTimeout(restoreScrollPosition, 50);
    return () => clearTimeout(timer);
  }, [activeTab, restoreScrollPosition]);

  const handleTabChange = useCallback((tabId: string) => {
    saveScrollPosition(); // Save current position before switching
    router.push(`/account/${address}?tab=${tabId}`, { scroll: false }); // Prevent automatic scroll to top
  }, [address, router, saveScrollPosition]);

  const renderTabs = () => (
    <div className="flex space-x-4 mb-4 border-b border-border">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`px-4 py-2 -mb-px ${activeTab === tab.id
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
      <div ref={contentRef} className="tab-content">
        {renderContent()}
      </div>
    </div>
  );
}

export default memo(TabContainerComponent);
