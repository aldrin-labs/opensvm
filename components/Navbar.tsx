'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeSwitcher } from './ui/theme-switcher';
import { Input } from './ui/input';
import { Search } from 'lucide-react';
import { Button } from './ui/button';
import { PublicKey } from '@solana/web3.js';
import { AIChatSidebar } from './ai/AIChatSidebar';

interface NavbarProps {
  children: React.ReactNode;
}

export function Navbar({ children }: NavbarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const isSolanaAddress = (query: string): boolean => {
    try {
      new PublicKey(query);
      return true;
    } catch {
      return false;
    }
  };

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
                  className="w-full bg-muted/50 border-0 pl-10 h-9"
                />
              </div>
            </form>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-6">
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
            </div>
            <ThemeSwitcher />
            <Button className="bg-[#00DC82] text-black hover:bg-[#00DC82]/90">
              Connect Wallet
            </Button>
          </div>
        </div>
      </nav>
      <main className="pt-14 min-h-screen">
        {children}
      </main>

      {/* AI Chat Sidebar */}
      <AIChatSidebar 
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        onWidthChange={setSidebarWidth}
        onResizeStart={() => setIsResizing(true)}
        onResizeEnd={() => setIsResizing(false)}
        initialWidth={sidebarWidth}
      />
    </>
  );
} 