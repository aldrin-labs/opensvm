'use client';

import { useState, FormEvent, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SettingsMenu } from './SettingsMenu';
import { Input } from './ui/input';
import { MoreHorizontal, Search, Activity, Layers, Coins } from 'lucide-react';
import { NavDropdown } from './ui/dropdown-nav';
import { Button } from './ui/button';
import { AIChatSidebar } from './ai/AIChatSidebar';

interface NavbarProps {
  children: React.ReactNode;
}

export function Navbar({ children }: NavbarProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSolanaAddress = (query: string): boolean => {
    // Simple validation for base58 string of correct length
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(query);
  };

  const handleCloseAIChat = useCallback(() => {
    setIsAIChatOpen(false);
  }, []);

  const handleSidebarWidthChange = useCallback((width: number) => {
    setSidebarWidth(width);
  }, []);

  const handleResizeStart = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    if (isSolanaAddress(trimmedQuery)) {
      router.push(`/account/${trimmedQuery}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    }
  };

  return (
    <>
      <nav className="w-full border-b border-border bg-background fixed top-0 left-0 right-0 z-50">
        <div className="container flex h-14 items-center justify-between">
          {/* Left section */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-bold text-lg text-foreground">OPENSVM</span>
              <button
                onClick={() => setIsAIChatOpen(true)}
                className="text-muted-foreground text-sm hover:text-foreground cursor-pointer"
              >
                [AI]
              </button>
            </Link>
          </div>

          {/* Center section - Search */}
          <div className="flex-1 max-w-xl px-4">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  type="text"
                  placeholder="Search accounts, tokens, or programs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border border-border hover:border-foreground/20 focus:border-foreground/40 pl-10 h-9 transition-colors"
                />
              </div>
            </form>
          </div>

          {/* Right section */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-6">
              <NavDropdown
                trigger="Explore"
                items={[
                  {
                    label: "Networks",
                    href: "/networks",
                    description: "Explore SVM networks and their resources"
                  },
                  {
                    label: "Recent Blocks",
                    href: "/blocks",
                    description: "View latest blocks and transactions"
                  },
                  {
                    label: "Programs",
                    href: "/programs",
                    description: "Explore Solana programs and their activity"
                  },
                  {
                    label: "Slots",
                    href: "/slots",
                    description: "Browse slot details and validators"
                  }
                ]}
              />
              <NavDropdown
                trigger="Tokens"
                items={[
                  {
                    label: "All Tokens",
                    href: "/tokens",
                    description: "Browse all tokens and their metrics"
                  },
                  {
                    label: "Top Gainers",
                    href: "/tokens/gainers",
                    description: "Tokens with highest price increases"
                  },
                  {
                    label: "New Listings",
                    href: "/tokens/new",
                    description: "Recently listed tokens"
                  }
                ]}
              />
              <NavDropdown
                trigger="NFTs"
                items={[
                  {
                    label: "Collections",
                    href: "/nfts",
                    description: "Browse NFT collections"
                  },
                  {
                    label: "Trending",
                    href: "/nfts/trending",
                    description: "Most active NFT collections"
                  },
                  {
                    label: "New Mints",
                    href: "/nfts/new",
                    description: "Recently minted collections"
                  }
                ]}
              />
              <NavDropdown
                trigger="Analytics"
                items={[
                  {
                    label: "Network Stats",
                    href: "/analytics",
                    description: "Solana network performance metrics"
                  },
                  {
                    label: "DeFi Overview",
                    href: "/analytics/defi",
                    description: "DeFi protocol statistics"
                  },
                  {
                    label: "Token Analytics",
                    href: "/analytics/tokens",
                    description: "Token market analysis"
                  }
                ]}
              />
            </div>
            <SettingsMenu />
            <Button className="bg-gray-300 text-gray-800 hover:bg-gray-400">
              Connect Wallet
            </Button>
          </div>

          <div className="flex items-center gap-4 sm:hidden">
            <MoreHorizontal size={16} onClick={() => setIsMenuOpen(true)} />
          </div>

          <div
            ref={menuRef}
            className={`absolute right-2 top-[40px] w-48 bg-black border border-white/20 rounded-lg shadow-lg overflow-hidden transition-all duration-200 ${isMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
              }`}
          >
            <div className="p-4 flex flex-col items-center gap-6">
              <Link href="/" className="text-sm font-medium text-foreground hover:text-foreground/80">
                Home
              </Link>
              <Link href="/tokens" className="text-sm font-medium text-foreground hover:text-foreground/80">
                Tokens
              </Link>
              <Link href="/nfts" className="text-sm font-medium text-foreground hover:text-foreground/80">
                NFTs
              </Link>
              <Link href="/analytics" className="text-sm font-medium text-foreground hover:text-foreground/80">
                Analytics
              </Link>
              <SettingsMenu />
              <Button className="bg-gray-300 text-gray-800 hover:bg-gray-400">
                Connect Wallet
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <main className="pt-14 min-h-screen">
        {children}
      </main>

      {/* AI Chat Sidebar - Only render when open */}
      {isAIChatOpen && (
        <AIChatSidebar
          isOpen={isAIChatOpen}
          onClose={handleCloseAIChat}
          onWidthChange={handleSidebarWidthChange}
          onResizeStart={handleResizeStart}
          onResizeEnd={handleResizeEnd}
          initialWidth={sidebarWidth}
        />
      )}
    </>
  );
}