/**
 * Trading Terminal Tutorial Configuration
 * Defines the onboarding steps for new users
 */

import type { TutorialStep } from '@/components/TutorialTour';

export const TRADING_TERMINAL_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to the Trading Terminal',
    content: 'This guided tour will help you understand the key features of our professional trading interface. You can skip this tutorial at any time or restart it from the help menu.',
    position: 'center',
  },
  {
    id: 'market-screener',
    title: 'Market Screener',
    content: 'Browse and select from multiple trading pairs. Use the search bar to quickly find specific markets. Click on any market to switch your active trading pair.',
    target: '[data-tile-id="screener"]',
    position: 'right',
  },
  {
    id: 'chart',
    title: 'Trading Chart',
    content: 'View real-time price action and technical indicators. The chart updates automatically as new data arrives. You can maximize any panel by pressing M or clicking the expand icon.',
    target: '[data-tile-id="chart"]',
    position: 'bottom',
  },
  {
    id: 'order-book',
    title: 'Order Book',
    content: 'See live buy and sell orders at different price levels. Green represents buy orders (bids), red represents sell orders (asks). The spread is the difference between the best bid and ask.',
    target: '[data-tile-id="orderbook"]',
    position: 'left',
  },
  {
    id: 'recent-trades',
    title: 'Recent Trades',
    content: 'Monitor the latest executed trades in real-time. Each trade shows the price, amount, and timestamp. This helps you gauge market activity and momentum.',
    target: '[data-tile-id="trades"]',
    position: 'left',
  },
  {
    id: 'positions',
    title: 'Your Positions',
    content: 'Track your open positions, including entry price, current P&L, and position size. Click on any position to view detailed information or close it.',
    target: '[data-tile-id="positions"]',
    position: 'left',
  },
  {
    id: 'ai-assistant',
    title: 'AI Trading Assistant',
    content: 'Get intelligent market insights and trading suggestions powered by AI. Ask questions about market conditions, request analysis, or get help with trading strategies.',
    target: '[data-tile-id="aichat"]',
    position: 'left',
  },
  {
    id: 'trading-controls',
    title: 'Trading Controls',
    content: 'Place buy and sell orders here. Choose your order type (market or limit), set your amount, and execute trades. Always review your order details before confirming.',
    target: '[data-tile-id="controls"]',
    position: 'top',
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    content: 'Press ? to view all available keyboard shortcuts. You can customize these shortcuts by clicking the keyboard icon and selecting "Customize". Power users can navigate the entire terminal without a mouse!',
    position: 'center',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    content: 'You now know the basics of the Trading Terminal. Explore the interface, try different features, and don\'t hesitate to use the AI Assistant if you need help. Happy trading!',
    position: 'center',
  },
];

export const TUTORIAL_STORAGE_KEY = 'trading-terminal-tutorial-completed';

/**
 * Check if user has completed the tutorial
 */
export function hasTutorialBeenCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  const status = localStorage.getItem(TUTORIAL_STORAGE_KEY);
  return status === 'true' || status === 'skipped';
}

/**
 * Reset tutorial completion status
 */
export function resetTutorial(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TUTORIAL_STORAGE_KEY);
}

/**
 * Mark tutorial as completed
 */
export function completeTutorial(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
}
