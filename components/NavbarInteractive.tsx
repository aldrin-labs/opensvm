'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { RpcStatusBadge } from './RpcStatusBadge';
import { Button } from '@/components/ui/button';
import {
  SimpleDropdown,
  SimpleDropdownItem,
} from '@/components/ui/simple-dropdown';
import { SettingsMenu } from './SettingsMenu';
import { WalletButton } from './WalletButton';
import { ChangelogNotification } from './ChangelogNotification';
import { X, User, Loader2 } from 'lucide-react';
import { useAIChatSidebar } from '@/contexts/AIChatSidebarContext';
import { useWallet } from '@solana/wallet-adapter-react';
import EnhancedSearchBar from './search';

interface NavbarInteractiveProps {
  children: React.ReactNode;
}

export const NavbarInteractive: React.FC<NavbarInteractiveProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileSearchLoading, setIsMobileSearchLoading] = useState(false);
  const { isOpen: isAIChatOpen, open: openAIChat, sidebarWidth, setSidebarWidth, isResizing } = useAIChatSidebar();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const { connected, publicKey } = useWallet();

  // Check if we should hide the search bar (on home page and search page)
  const shouldHideSearchBar = pathname === '/' || pathname.startsWith('/search');

  // Update the clock every minute
  useEffect(() => {
    // Set initial time
    setCurrentTime(new Date().toLocaleTimeString());

    // Update time every 60 seconds
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 60000);

    // Cleanup on unmount
    return () => clearInterval(timer);
  }, []);

  // Auto-open AI sidebar when ?ai=1 is present (stabilize E2E and deep links)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ai = params.get('ai');
      if (ai === '1' || ai === 'true') {
        openAIChat();
      }
    } catch { /* noop */ }
  }, [openAIChat]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close mobile menu when escape key is pressed
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  // Apply floating-button style content shift to the root content wrapper
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const contentElement = (document.getElementById('layout-content') || document.getElementById('main-content') || document.querySelector('main')) as HTMLElement | null;
    if (!contentElement) return;

    if (isAIChatOpen) {
      const viewport = window.innerWidth || 1920;
      // If width is within 100px of viewport treat as expanded full width for layout shift
      const w = sidebarWidth >= viewport - 100 ? viewport : Math.min(Math.max(0, sidebarWidth), viewport);
      contentElement.style.width = `calc(100% - ${w}px)`;
      contentElement.style.marginRight = `${w}px`;
    } else {
      contentElement.style.width = '100%';
      contentElement.style.marginRight = '0px';
    }
    contentElement.style.transition = !isResizing ? 'all 300ms ease-in-out' : 'none';

    return () => {
      contentElement.style.width = '';
      contentElement.style.marginRight = '';
      contentElement.style.transition = '';
    };
  }, [isAIChatOpen, sidebarWidth, isResizing]);

  // Remove SSR placeholder once hydrated and real sidebar present
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const ph = document.getElementById('ai-sidebar-ssr-placeholder');
    if (!ph) return;

    const tryRemove = () => {
      try {
        const real = document.querySelector('[data-ai-sidebar-root]:not(#ai-sidebar-ssr-placeholder)');
        if (real && ph.parentElement) {
          ph.parentElement.removeChild(ph);
          try {
            window.dispatchEvent(new CustomEvent('svmai-ssr-placeholder-removed', { detail: { ts: Date.now() } }));
          } catch (e) { /* noop */ }
        }
      } catch (e) { /* noop */ }
    };

    // Attempt multiple times to tolerate hydration timing variability
    tryRemove();
    const t1 = setTimeout(tryRemove, 60);
    const t2 = setTimeout(tryRemove, 180);
    const t3 = setTimeout(tryRemove, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Dropdown icon component - DRY pattern
  const DropdownIcon = () => (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );


  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query && !isMobileSearchLoading) {
      setIsMobileSearchLoading(true);
      try {
        // Check if the query looks like a Solana address (simplistic check)
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query)) {
          router.push(`/account/${query}`);
        } else {
          router.push(`/search?q=${encodeURIComponent(query)}`);
        }
      } finally {
        // Reset loading state immediately
        setIsMobileSearchLoading(false);
      }
    }
  };


  // Focus trap for keyboard navigation in mobile menu
  const handleTabKey = (e: React.KeyboardEvent) => {
    if (isMobileMenuOpen && e.key === 'Tab') {
      const focusableElements = menuRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusableElements && e.shiftKey && document.activeElement === focusableElements[0]) {
        (focusableElements[focusableElements.length - 1] as HTMLElement).focus();
        e.preventDefault();
      }
    }
  };

  return (
    <>
      <div
        className="flex w-full h-14 items-center justify-between py-0 bg-background shadow-sm fixed top-0 left-0 z-40 border-b border-border/10 ai-navbar"
        onKeyDown={handleTabKey}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className={`container mx-auto px-4 flex w-full items-center ${
          isSearchFocused ? 'justify-start' : 'justify-between'
        }`}>
          {/* Logo and brand */}
          <div className="flex items-center gap-2 z-10">
            <RpcStatusBadge />
            <Link 
              href="/" 
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              aria-label="OpenSVM Home - AI-powered blockchain explorer"
            >
              <span className="font-bold text-lg">OpenSVM</span>
              <span className="text-sm text-foreground/70" aria-label="AI-enhanced">[ai]</span>
            </Link>
            <ChangelogNotification />
            <span className="hidden md:inline-block text-xs text-muted-foreground">{currentTime}</span>
          </div>

          {/* Search Container - Hidden on home page and search page */}
          {!shouldHideSearchBar && (
            <div 
              ref={searchRef}
              className={`hidden md:flex items-center transition-all duration-300 ease-out ${
                isSearchFocused 
                  ? 'flex-1 mr-4' 
                  : 'max-w-md mx-4'
              }`}
            >
              <div className="w-full">
                <EnhancedSearchBar onFocusChange={(focused) => {
                  setIsSearchFocused(focused);
                }} />
              </div>
            </div>
          )}

          {/* Navigation Dropdowns - Hide when search is focused or on pages where search is hidden */}
          <div className={`hidden md:flex items-center gap-1.5 transition-all duration-300 ease-out ${
            isSearchFocused 
              ? 'opacity-0 pointer-events-none transform scale-95 -translate-x-4' 
              : 'opacity-100 pointer-events-auto transform scale-100 translate-x-0'
          }`} style={{
            display: isSearchFocused ? 'none' : 'flex'
          }}>
            {/* Explore dropdown */}
            <SimpleDropdown
              align="end"
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 px-3 h-9 text-sm font-medium"
                  data-testid="nav-dropdown-explore"
                >
                  Explore
                  <DropdownIcon />
                </Button>
              }
            >
              <SimpleDropdownItem asChild>
                <Link href="/trading-terminal">Trading Terminal</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/networks">Networks</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/blocks">Blocks</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/programs">Programs</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/validators">Validators</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/chat">Chat</Link>
              </SimpleDropdownItem>
            </SimpleDropdown>

            {/* Tokens Dropdown */}
            <SimpleDropdown
              align="end"
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 px-3 h-9 text-sm font-medium"
                  data-testid="nav-dropdown-tokens"
                >
                  Tokens
                  <DropdownIcon />
                </Button>
              }
            >
              <SimpleDropdownItem asChild>
                <Link href="/tokens">All Tokens</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/tokens/gainers">Top Gainers</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/tokens/new">New Listings</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/scan">Scan (Memecoins)</Link>
              </SimpleDropdownItem>
            </SimpleDropdown>

            {/* DeFi Dropdown */}
            <SimpleDropdown
              align="end"
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 px-3 h-9 text-sm font-medium"
                  data-testid="nav-dropdown-defi"
                >
                  DeFi
                  <DropdownIcon />
                </Button>
              }
              className="max-h-96 overflow-y-auto"
            >
              <SimpleDropdownItem asChild>
                <Link href="/defi/overview">Overview</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/coins-screener">Coins Screener</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/memecoins-screener">Memecoins Screener</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/launchpads">Launchpads</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/amms">AMMs</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/clobs">CLOBs</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/perpetuals">Perpetuals</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/options">Options</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/bots">TG Bots & Other bots</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/defai">DeFAI</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/aggregators">Aggregators</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/yield-agg">Yield Agg</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/staking">Staking</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/stablecoins">Stablecoins</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/oracles">Data providers & Oracles</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/defi/tools">Tools</Link>
              </SimpleDropdownItem>
            </SimpleDropdown>

            {/* Analytics Dropdown */}
            <SimpleDropdown
              align="end"
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 px-3 h-9 text-sm font-medium"
                  data-testid="nav-dropdown-analytics"
                >
                  Analytics
                  <DropdownIcon />
                </Button>
              }
            >
              <SimpleDropdownItem asChild>
                <Link href="/analytics">Dashboard</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/analytics/trends">Trends</Link>
              </SimpleDropdownItem>
              <SimpleDropdownItem asChild>
                <Link href="/monitoring">Live Monitoring</Link>
              </SimpleDropdownItem>
            </SimpleDropdown>
          </div>

          {/* Action Buttons - Always visible */}
          <div className="hidden md:flex items-center gap-1.5">
            <SettingsMenu />
            {connected && publicKey && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/user/${publicKey.toString()}`)}
                className="gap-1 px-3 h-9 text-sm font-medium"
                aria-label="View Profile"
              >
                <User className="h-4 w-4" />
                Profile
              </Button>
            ) || (<WalletButton />)}
            <Button
              size="sm"
              className="bg-[#00DC82] text-black hover:bg-[#00DC82]/90 ml-1.5 font-medium h-9 px-3 text-sm"
              onClick={openAIChat}
              aria-label="Open SVMAI - AI-powered blockchain assistant"
              title="Open AI Assistant (provides blockchain analysis and insights)"
            >
              SVMAI
            </Button>
          </div>

          {/* Mobile navigation toggle */}
          <div className="md:hidden flex items-center gap-2">
            <ChangelogNotification />
            <Button
              variant="ghost"
              size="sm"
              aria-label={isMobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
              aria-expanded={isMobileMenuOpen}
              className="relative z-20"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="mobile-menu-toggle"
              title={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                role="img"
              >
                {isMobileMenuOpen ?
                  <path d="M18 6L6 18M6 6l12 12" /> :
                  <path d="M3 12h18M3 6h18M3 18h18" />
                }
              </svg>
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          ref={menuRef}
          className={`fixed inset-0 bg-background/95 backdrop-blur-md md:hidden z-50 transition-all duration-300 ease-in-out w-full ${isMobileMenuOpen
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-full pointer-events-none'
            }`}
          id="mobile-menu"
          data-testid="mobile-menu"
          aria-hidden={!isMobileMenuOpen}
          aria-label="Mobile navigation menu"
        >
          <div className="container mx-auto pt-20 px-4 pb-6 h-full overflow-y-auto">
            <div className="absolute top-4 right-4 md:right-8">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            <form onSubmit={handleSearch} className="w-full mb-4">
              <div className="relative">
                <div className="flex items-center w-full shadow-sm">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 opacity-70 text-muted-foreground">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 19l-4.35-4.35M11 5a6 6 0 100 12 6 6 0 000-12z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-background border border-border hover:border-foreground/20 focus:border-foreground/40 focus:ring-1 focus:ring-primary/20 pl-10 h-10 transition-all rounded-l-md"
                    placeholder="Search accounts, tokens, or programs..."
                    aria-label="Search"
                    data-testid="mobile-search"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => router.push('/search')}
                    className="bg-background border border-l-0 border-r-0 border-border hover:border-foreground/20 px-3 h-10"
                    aria-label="Search Settings"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <Button
                    type="submit"
                    disabled={isMobileSearchLoading}
                    className="rounded-l-none h-10 px-4 font-medium"
                    aria-label={isMobileSearchLoading ? "Searching..." : "Search"}
                    data-testid="mobile-search-button"
                    variant="default"
                  >
                    {isMobileSearchLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      "Search"
                    )}
                  </Button>
                </div>
              </div>
            </form>

            <div className="font-medium border-b pb-1 mb-3 text-sm uppercase tracking-wider text-primary">Explore</div>
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/solana'); }}
              >
                Overview
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/blocks'); }}
              >
                Blocks
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/programs'); }}
              >
                Programs
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/chat'); }}
              >
                Chat
              </Button>
            </div>

            <div className="font-medium border-b pb-1 mt-5 mb-3 text-sm uppercase tracking-wider text-primary">Tokens</div>
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/tokens'); }}
              >
                All Tokens
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/tokens?tab=trending'); }}
              >
                Trending
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/tokens?tab=new'); }}
              >
                New Listings
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/scan'); }}
              >
                Scan (Memecoins)
              </Button>
            </div>

            <div className="font-medium border-b pb-1 mt-5 mb-3 text-sm uppercase tracking-wider text-primary">DeFi</div>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/overview'); }}
              >
                Overview
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/coins-screener'); }}
              >
                Coins Screener
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/memecoins-screener'); }}
              >
                Memecoins Screener
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/launchpads'); }}
              >
                Launchpads
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/amms'); }}
              >
                AMMs
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/clobs'); }}
              >
                CLOBs
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/perpetuals'); }}
              >
                Perpetuals
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/options'); }}
              >
                Options
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/bots'); }}
              >
                TG Bots & Other bots
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/defai'); }}
              >
                DeFAI
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/aggregators'); }}
              >
                Aggregators
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/yield-agg'); }}
              >
                Yield Agg
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/staking'); }}
              >
                Staking
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/stablecoins'); }}
              >
                Stablecoins
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/oracles'); }}
              >
                Data providers & Oracles
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/defi/tools'); }}
              >
                Tools
              </Button>
            </div>

            <div className="font-medium border-b pb-1 mt-5 mb-3 text-sm uppercase tracking-wider text-primary">Analytics</div>
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/analytics'); }}
              >
                Dashboard
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground"
                onClick={() => { setIsMobileMenuOpen(false); router.push('/analytics/trends'); }}
              >
                Trends
              </Button>
            </div>

            <div className="flex gap-2 mt-4 border-t pt-4 border-border/40">
              {connected && publicKey && (
                <Button
                  variant="outline"
                  className="gap-1"
                  onClick={() => {
                    router.push(`/user/${publicKey.toString()}`);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <User className="h-4 w-4" />
                  Profile
                </Button>
              )}
              <WalletButton />
              <SettingsMenu />
              <Button
                className="bg-[#00DC82] text-black hover:bg-[#00DC82]/90 flex-1"
                onClick={() => {
                  openAIChat();
                  setIsMobileMenuOpen(false);
                }}
              >
                AI Assistant
              </Button>
            </div>
          </div>
        </div>
      </div>


      {/* Main content */}
      <div id="layout-content" className="pt-14">
        {children}
      </div>
    </>
  );
};
