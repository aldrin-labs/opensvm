'use client';

import React, { useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface MarketSelectorProps {
  selectedMarket: string;
  onMarketChange: (market: string) => void;
}

interface Market {
  symbol: string;
  name: string;
  protocol: string;
  type: 'spot' | 'perpetual' | 'option';
}

const MARKETS: Market[] = [
  // Spot Markets
  { symbol: 'SOL/USDC', name: 'Solana / USD Coin', protocol: 'Jupiter', type: 'spot' },
  { symbol: 'SOL/USDT', name: 'Solana / Tether', protocol: 'Raydium', type: 'spot' },
  { symbol: 'JUP/SOL', name: 'Jupiter / Solana', protocol: 'Jupiter', type: 'spot' },
  { symbol: 'JTO/SOL', name: 'Jito / Solana', protocol: 'Orca', type: 'spot' },
  { symbol: 'BONK/SOL', name: 'Bonk / Solana', protocol: 'Raydium', type: 'spot' },
  { symbol: 'WIF/SOL', name: 'Dogwifhat / Solana', protocol: 'Raydium', type: 'spot' },
  { symbol: 'RAY/SOL', name: 'Raydium / Solana', protocol: 'Raydium', type: 'spot' },
  { symbol: 'ORCA/SOL', name: 'Orca / Solana', protocol: 'Orca', type: 'spot' },
  
  // Perpetuals
  { symbol: 'SOL-PERP', name: 'SOL Perpetual', protocol: 'Drift', type: 'perpetual' },
  { symbol: 'BTC-PERP', name: 'BTC Perpetual', protocol: 'Drift', type: 'perpetual' },
  { symbol: 'ETH-PERP', name: 'ETH Perpetual', protocol: 'Drift', type: 'perpetual' },
  { symbol: 'SOL-PERP', name: 'SOL Perpetual', protocol: 'Mango', type: 'perpetual' },
  { symbol: 'BTC-PERP', name: 'BTC Perpetual', protocol: 'Mango', type: 'perpetual' },
];

export default function MarketSelector({ selectedMarket, onMarketChange }: MarketSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMarkets = MARKETS.filter(market =>
    market.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    market.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    market.protocol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedMarketData = MARKETS.find(m => m.symbol === selectedMarket);

  return (
    <div className="market-selector relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded hover:border-[#4ec9b0] transition-colors"
      >
        <div className="flex flex-col items-start">
          <span className="text-sm font-bold text-[#4ec9b0]">{selectedMarket}</span>
          {selectedMarketData && (
            <span className="text-xs text-[#858585]">{selectedMarketData.protocol}</span>
          )}
        </div>
        <ChevronDown size={16} className={`text-[#cccccc] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-80 bg-[#252526] border border-[#3e3e42] rounded shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
            {/* Search Bar */}
            <div className="p-3 border-b border-[#3e3e42]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#858585]" />
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#1e1e1e] border border-[#3e3e42] rounded text-sm text-[#cccccc] placeholder-[#858585] focus:outline-none focus:border-[#4ec9b0]"
                  autoFocus
                />
              </div>
            </div>

            {/* Markets List */}
            <div className="overflow-y-auto flex-1">
              {filteredMarkets.length > 0 ? (
                <>
                  {/* Spot Markets */}
                  {filteredMarkets.some(m => m.type === 'spot') && (
                    <div>
                      <div className="px-4 py-2 bg-[#1e1e1e] text-xs font-semibold text-[#858585] uppercase">
                        Spot Markets
                      </div>
                      {filteredMarkets.filter(m => m.type === 'spot').map((market) => (
                        <button
                          key={`${market.symbol}-${market.protocol}`}
                          onClick={() => {
                            onMarketChange(market.symbol);
                            setIsOpen(false);
                            setSearchQuery('');
                          }}
                          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-[#2a2d2e] transition-colors ${
                            selectedMarket === market.symbol ? 'bg-[#2a2d2e]' : ''
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium text-[#cccccc]">{market.symbol}</span>
                            <span className="text-xs text-[#858585]">{market.name}</span>
                          </div>
                          <span className="text-xs text-[#4ec9b0]">{market.protocol}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Perpetual Markets */}
                  {filteredMarkets.some(m => m.type === 'perpetual') && (
                    <div>
                      <div className="px-4 py-2 bg-[#1e1e1e] text-xs font-semibold text-[#858585] uppercase">
                        Perpetual Futures
                      </div>
                      {filteredMarkets.filter(m => m.type === 'perpetual').map((market) => (
                        <button
                          key={`${market.symbol}-${market.protocol}`}
                          onClick={() => {
                            onMarketChange(market.symbol);
                            setIsOpen(false);
                            setSearchQuery('');
                          }}
                          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-[#2a2d2e] transition-colors ${
                            selectedMarket === market.symbol ? 'bg-[#2a2d2e]' : ''
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium text-[#cccccc]">{market.symbol}</span>
                            <span className="text-xs text-[#858585]">{market.name}</span>
                          </div>
                          <span className="text-xs text-[#ce9178]">{market.protocol}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="px-4 py-8 text-center text-[#858585] text-sm">
                  No markets found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
