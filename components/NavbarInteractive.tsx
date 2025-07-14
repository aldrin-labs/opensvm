'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SettingsMenu } from './SettingsMenu';
import { WalletButton } from './WalletButton';
import { X, User } from 'lucide-react';
import { AIChatSidebar } from './ai/AIChatSidebar';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useWallet } from '@solana/wallet-adapter-react';

interface NavbarInteractiveProps {}

export const NavbarInteractive: React.FC<NavbarInteractiveProps> = () => {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [contentPadding, setContentPadding] = useState<string>('0px');
  const [currentTime, setCurrentTime] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);
  const { connected, publicKey } = useWallet();
  
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

  // Adjust main content padding when AI sidebar is open
  useEffect(() => {
    if (isAIChatOpen) {
      setContentPadding(`${sidebarWidth}px`);
    } else {
      setContentPadding('0px');
    }
  }, [isAIChatOpen, sidebarWidth]);

  // Dropdown icon component - DRY pattern
  const DropdownIcon = () => (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      // Check if the query looks like a Solana address (simplistic check)
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query)) {
        router.push(`/account/${query}`);
      } else {
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }
    }
  };

  const handleWidthChange = (newWidth: number) => {
    setSidebarWidth(newWidth);
  };

  const handleResizeStart = () => {
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    document.body.style.cursor = 'default';
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
        className="flex w-full h-14 items-center justify-between py-0 bg-background shadow-sm fixed top-0 left-0 z-40 border-b border-border/10"
        onKeyDown={handleTabKey}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container mx-auto px-4 flex w-full items-center justify-between">
          {/* Logo and brand */}
          <div className="flex items-center gap-2 z-10">
            <Link href="/" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <span className="font-bold text-lg">OPENSVM</span>
              <span className="text-sm text-foreground/70">[AI]</span>
            </Link>
            <span className="hidden md:inline-block text-xs text-muted-foreground">{currentTime}</span>
          </div>
          
          {/* Interactive search form */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4 items-center">
            <div className="relative group flex w-full">
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 transform -translate-y-1/2 opacity-70 text-muted-foreground"
                aria-hidden="true"
              >
                <path d="M19 19l-4.35-4.35M11 5a6 6 0 100 12 6 6 0 000-12z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search"
                className="w-full bg-background/80 border border-r-0 border-border/50 hover:border-foreground/20 focus:border-foreground/30 focus:ring-1 focus:ring-primary/20 pl-10 h-9 transition-all rounded-l-md text-sm"
                placeholder="Search accounts, tokens, or programs..."
                role="searchbox"
                data-testid="navbar-search"
              />
              <button
                type="button"
                onClick={() => router.push('/search')}
                className="bg-background/80 border border-l-0 border-border/50 hover:border-foreground/20 px-2 h-9 rounded-r-md"
                aria-label="Search Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </form>
  
          {/* Interactive navigation */}
          <div className="hidden md:flex items-center gap-1.5">
            {/* Explore dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="gap-1 px-3 h-9 text-sm font-medium"
                  data-testid="nav-dropdown-explore"
                >
                  Explore
                  <DropdownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="duration-300 transition-all">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/networks'); }}>
                  Networks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/blocks'); }}>
                  Blocks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/programs'); }}>
                  Programs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
  
            {/* Tokens Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="gap-1 px-3 h-9 text-sm font-medium"
                  data-testid="nav-dropdown-tokens"
                >
                  Tokens
                  <DropdownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="duration-300 transition-all">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/tokens'); }}>
                  All Tokens
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/tokens/gainers'); }}>
                  Top Gainers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/tokens/new'); }}>
                  New Listings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
  
            {/* DeFi Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 px-3 h-9 text-sm font-medium"
                  data-testid="nav-dropdown-defi"
                >
                  DeFi
                  <DropdownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="duration-300 transition-all max-h-96 overflow-y-auto">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/overview'); }}>
                  Overview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/coins-screener'); }}>
                  Coins Screener
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/memecoins-screener'); }}>
                  Memecoins Screener
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/launchpads'); }}>
                  Launchpads
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/amms'); }}>
                  AMMs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/clobs'); }}>
                  CLOBs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/perpetuals'); }}>
                  Perpetuals
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/options'); }}>
                  Options
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/bots'); }}>
                  TG Bots & Other bots
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/defai'); }}>
                  DeFAI
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/aggregators'); }}>
                  Aggregators
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/yield-agg'); }}>
                  Yield Agg
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/staking'); }}>
                  Staking
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/stablecoins'); }}>
                  Stablecoins
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/oracles'); }}>
                  Data providers & Oracles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/defi/tools'); }}>
                  Tools
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Analytics Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="gap-1 px-3 h-9 text-sm font-medium"
                  data-testid="nav-dropdown-analytics"
                >
                  Analytics
                  <DropdownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="duration-300 transition-all">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/analytics'); }}>
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/analytics/trends'); }}>
                  Trends
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/monitoring'); }}>
                  Live Monitoring
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
  
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
            )}
            <WalletButton />
            <Button 
              size="sm" 
              className="bg-[#00DC82] text-black hover:bg-[#00DC82]/90 ml-1.5 font-medium h-9 px-3 text-sm"
              onClick={() => setIsAIChatOpen(true)}
              aria-label="Open AI Assistant"
            >
              AI Assistant
            </Button>
          </div>
  
          {/* Mobile navigation toggle */}
          <div className="md:hidden flex items-center gap-2">
            <Button
              variant="ghost" 
              size="sm" 
              aria-label="Toggle mobile menu" 
              className="relative z-20"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="mobile-menu-toggle"
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
          className={`fixed inset-0 bg-background/95 backdrop-blur-md md:hidden z-50 transition-all duration-300 ease-in-out w-full ${
            isMobileMenuOpen 
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
                    className="rounded-l-none h-10 px-4 font-medium" 
                    aria-label="Search"
                    data-testid="mobile-search-button"
                    variant="default"
                  >
                    Search
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
                  setIsAIChatOpen(true);
                  setIsMobileMenuOpen(false);
                }}
              >
                AI Assistant
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Sidebar */}
      <AIChatSidebar
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        onWidthChange={handleWidthChange}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
        initialWidth={sidebarWidth}
      />
    </>
  );
};