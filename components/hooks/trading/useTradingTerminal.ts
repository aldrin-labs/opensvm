/**
 * useTradingTerminal Hook
 * 
 * Main state management hook for the trading terminal.
 * Manages sections, tiles, maximization state, and market selection.
 * 
 * @module hooks/trading/useTradingTerminal
 */

import { useState, useCallback } from 'react';

export interface Section {
  id: string;
  name: string;
  isExpanded: boolean;
  isMaximized: boolean;
}

export type TileId = 
  | 'screener' 
  | 'chart' 
  | 'controls' 
  | 'orderbook' 
  | 'trades' 
  | 'positions' 
  | 'watchlist' 
  | 'performance' 
  | 'depth' 
  | 'news' 
  | 'aichat';

export interface TradeCommand {
  action: 'buy' | 'sell';
  amount: number;
  token: string;
  orderType: 'market' | 'limit';
  price?: number;
  estimatedValue?: number;
}

export interface UseTradingTerminalReturn {
  // State
  selectedMarket: string;
  sections: Section[];
  maximizedTile: TileId | null;
  focusedTile: TileId | null;
  screenerExpanded: boolean;
  showShortcuts: boolean;
  isLoading: boolean;
  aiChatMinimized: boolean;
  
  // Actions
  setSelectedMarket: (market: string) => void;
  toggleSection: (sectionId: string) => void;
  toggleMaximize: (tileId: TileId) => void;
  setFocusedTile: (tileId: TileId | null) => void;
  setScreenerExpanded: (expanded: boolean) => void;
  setShowShortcuts: (show: boolean) => void;
  setAIChatMinimized: (minimized: boolean) => void;
  isSectionExpanded: (sectionId: string) => boolean;
  handleTradeExecute: (command: TradeCommand) => void;
  navigateTiles: (direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown') => void;
}

const DEFAULT_SECTIONS: Section[] = [
  // ONLY 3 Essential sections expanded - everything else one-click away
  { id: 'chart', name: 'Chart', isExpanded: true, isMaximized: false },
  { id: 'orderbook', name: 'Order Book', isExpanded: true, isMaximized: false },
  { id: 'trades', name: 'Recent Trades', isExpanded: true, isMaximized: false },
  
  // Everything else collapsed - expand when needed
  { id: 'positions', name: 'Positions', isExpanded: false, isMaximized: false },
  { id: 'depth', name: 'Market Depth', isExpanded: false, isMaximized: false },
  { id: 'news', name: 'Market News', isExpanded: false, isMaximized: false },
  { id: 'performance', name: 'Performance', isExpanded: false, isMaximized: false },
  { id: 'watchlist', name: 'Watchlist', isExpanded: false, isMaximized: false },
];

/**
 * Main trading terminal state management hook.
 * 
 * @param initialMarket - Initial selected market (default: 'SOL/USDC')
 * @returns Trading terminal state and actions
 * 
 * @example
 * ```tsx
 * const {
 *   selectedMarket,
 *   maximizedTile,
 *   toggleMaximize,
 *   handleTradeExecute
 * } = useTradingTerminal('SOL/USDC');
 * ```
 */
export const useTradingTerminal = (
  initialMarket: string = 'SOL/USDC'
): UseTradingTerminalReturn => {
  const [selectedMarket, setSelectedMarket] = useState(initialMarket);
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);
  const [maximizedTile, setMaximizedTile] = useState<TileId | null>(null);
  const [focusedTile, setFocusedTile] = useState<TileId | null>(null);
  const [screenerExpanded, setScreenerExpanded] = useState(false); // Collapsed by default
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [aiChatMinimized, setAIChatMinimized] = useState(false); // Expanded by default

  // Simulate initial data loading
  useState(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  });

  /**
   * Toggle expansion state of a section
   */
  const toggleSection = useCallback((sectionId: string) => {
    setSections(prev => 
      prev.map(s => 
        s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s
      )
    );
  }, []);

  /**
   * Toggle maximization state of a tile
   */
  const toggleMaximize = useCallback((tileId: TileId) => {
    setMaximizedTile(prev => {
      if (prev === tileId) {
        return null;
      }
      setFocusedTile(tileId);
      return tileId;
    });
  }, []);

  /**
   * Check if a section is expanded
   */
  const isSectionExpanded = useCallback((sectionId: string) => {
    return sections.find(s => s.id === sectionId)?.isExpanded ?? true;
  }, [sections]);

  /**
   * Handle trade execution from AI chat
   * TODO: Integrate with actual Solana wallet and DEX
   */
  const handleTradeExecute = useCallback((command: TradeCommand) => {
    console.log('AI Trade Execution:', command);
    
    // Placeholder for actual trade execution logic
    // Would involve:
    // 1. Wallet signature request
    // 2. DEX smart contract interaction
    // 3. Transaction confirmation
    // 4. Update positions and trade history
    
    alert(
      `Trade executed: ${command.action.toUpperCase()} ${command.amount} ${command.token} at ${command.orderType} price`
    );
  }, []);

  /**
   * Navigate between tiles using arrow keys
   */
  const navigateTiles = useCallback((
    direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'
  ) => {
    const tiles: TileId[] = [
      'screener', 
      'chart', 
      'orderbook', 
      'trades', 
      'positions', 
      'controls'
    ];
    const currentIndex = focusedTile ? tiles.indexOf(focusedTile) : 0;
    
    let newIndex = currentIndex;
    switch (direction) {
      case 'ArrowRight':
        newIndex = (currentIndex + 1) % tiles.length;
        break;
      case 'ArrowLeft':
        newIndex = (currentIndex - 1 + tiles.length) % tiles.length;
        break;
      case 'ArrowDown':
        newIndex = Math.min(currentIndex + 2, tiles.length - 1);
        break;
      case 'ArrowUp':
        newIndex = Math.max(currentIndex - 2, 0);
        break;
    }
    
    setFocusedTile(tiles[newIndex]);
    
    // Scroll focused tile into view
    const element = document.querySelector(`[data-tile-id="${tiles[newIndex]}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedTile]);

  return {
    // State
    selectedMarket,
    sections,
    maximizedTile,
    focusedTile,
    screenerExpanded,
    showShortcuts,
    isLoading,
    aiChatMinimized,
    
    // Actions
    setSelectedMarket,
    toggleSection,
    toggleMaximize,
    setFocusedTile,
    setScreenerExpanded,
    setShowShortcuts,
    setAIChatMinimized,
    isSectionExpanded,
    handleTradeExecute,
    navigateTiles,
  };
};

export default useTradingTerminal;
