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
import { X } from 'lucide-react';
import { AIChatSidebar } from './ai/AIChatSidebar';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';

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
  const menuRef = useRef<HTMLDivElement>(null);

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
            <span className="hidden md:inline-block text-xs text-muted-foreground">{new Date().toLocaleTimeString()}</span>
          </div>
          
          {/* Interactive search form */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4 items-center">
            <div className="relative group">
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
                className="w-full bg-background/80 border border-border/50 hover:border-foreground/20 focus:border-foreground/30 focus:ring-1 focus:ring-primary/20 pl-10 h-9 transition-all rounded-md text-sm"
                placeholder="Search accounts, tokens, or programs..."
                role="searchbox"
                data-testid="navbar-search"
              />
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
  
            {/* NFTs Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="gap-1 px-3 h-9 text-sm font-medium"
                  data-testid="nav-dropdown-nfts"
                >
                  NFTs
                  <DropdownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="duration-300 transition-all">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/nfts'); }}>
                  Collections
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/nfts/trending'); }}>
                  Trending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push('/nfts/new'); }}>
                  New Mints
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
              </DropdownMenuContent>
            </DropdownMenu>
  
            <SettingsMenu />
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
            
            <div className="font-medium border-b pb-1 mt-5 mb-3 text-sm uppercase tracking-wider text-primary">NFTs</div>
            <div className="flex flex-col gap-1">
              <Button 
                variant="ghost" 
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground" 
                onClick={() => { setIsMobileMenuOpen(false); router.push('/nfts'); }}
              >
                Collections
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground" 
                onClick={() => { setIsMobileMenuOpen(false); router.push('/nfts?tab=trending'); }}
              >
                Trending
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground" 
                onClick={() => { setIsMobileMenuOpen(false); router.push('/nfts?tab=new'); }}
              >
                New Mints
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
            
            <div className="font-medium border-b pb-1 mt-5 mb-3 text-sm uppercase tracking-wider text-primary">Solana Ecosystem</div>
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
                onClick={() => { setIsMobileMenuOpen(false); router.push('/tokens?filter=solana'); }}
              >
                Solana Tokens
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground" 
                onClick={() => { setIsMobileMenuOpen(false); router.push('/nfts?filter=solana'); }}
              >
                Solana NFTs
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start font-normal text-foreground/90 hover:text-foreground" 
                onClick={() => { setIsMobileMenuOpen(false); router.push('/analytics?tab=defi'); }}
              >
                DeFi Metrics
              </Button>
            </div>
            
            <div className="flex gap-2 mt-4 border-t pt-4 border-border/40">
              <div className="flex-1">
                <WalletButton />
              </div>
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