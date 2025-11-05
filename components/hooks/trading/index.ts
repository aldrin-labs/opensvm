/**
 * Trading Hooks Index
 * 
 * Centralized export for all trading-related hooks.
 * 
 * @module hooks/trading
 */

// Main terminal state management
export {
  useTradingTerminal,
  type UseTradingTerminalReturn,
  type Section,
  type TileId,
  type TradeCommand,
} from './useTradingTerminal';

// Keyboard shortcuts
export {
  useKeyboardShortcuts,
  type KeyboardShortcutsConfig,
} from './useKeyboardShortcuts';

// Market data
export {
  useMarketData,
  type UseMarketDataReturn,
  type MarketData,
  type MarketStats,
  type OrderBook,
  type OrderBookEntry,
  type Trade,
} from './useMarketData';

// Wallet connection
export {
  useWalletConnection,
  type UseWalletConnectionReturn,
  type WalletInfo,
} from './useWalletConnection';

// Transaction visualization
export {
  useTransactionVisualization,
  useVolumeAnalysis,
  useSlippageAnalysis,
  useSuccessRateAnalysis,
  useActiveMarkets,
  type UseTransactionVisualizationReturn,
  type TradeAnalytics,
  type TradingPattern,
  type VolumeByHour,
} from './useTransactionVisualization';
