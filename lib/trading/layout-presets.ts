/**
 * Trading Terminal Layout Presets
 *
 * Defines pre-configured layouts optimized for different trading styles.
 * Each preset specifies which widgets are visible and their arrangement.
 */

import { TileId } from '@/components/hooks/trading/useTradingTerminal';

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  targetUser: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  widgets: {
    left: TileId[];
    center: TileId[];
    right: TileId[];
  };
  defaultExpanded: TileId[];
  gridConfig: {
    templateAreas: string;
    templateColumns: string;
    templateRows: string;
  };
}

export const LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  beginner: {
    id: 'beginner',
    name: 'Beginner',
    description: 'Simplified layout with just chart and trading controls. Perfect for getting started.',
    icon: '🎯',
    targetUser: 'beginner',
    widgets: {
      left: [],
      center: ['chart'],
      right: ['controls'],
    },
    defaultExpanded: ['chart'],
    gridConfig: {
      templateAreas: `
        "header header header"
        "chart chart controls"
        "chart chart controls"
      `,
      templateColumns: '1fr 1fr 400px',
      templateRows: '60px 1fr 1fr',
    },
  },

  intermediate: {
    id: 'intermediate',
    name: 'Intermediate',
    description: 'Balanced layout with chart, order book, positions, and screener. Recommended for most traders.',
    icon: '📊',
    targetUser: 'intermediate',
    widgets: {
      left: ['screener'],
      center: ['chart'],
      right: ['orderbook', 'positions'],
    },
    defaultExpanded: ['chart', 'orderbook', 'positions'],
    gridConfig: {
      templateAreas: `
        "header header header"
        "screener chart right"
        "screener positions right"
      `,
      templateColumns: '320px 1fr 400px',
      templateRows: '60px 1fr 300px',
    },
  },

  dayTrader: {
    id: 'dayTrader',
    name: 'Day Trader',
    description: 'Fast-paced layout with quick access to charts, order book, recent trades, and AI assistant.',
    icon: '⚡',
    targetUser: 'advanced',
    widgets: {
      left: ['screener'],
      center: ['chart'],
      right: ['orderbook', 'trades', 'aichat'],
    },
    defaultExpanded: ['chart', 'orderbook', 'trades', 'aichat'],
    gridConfig: {
      templateAreas: `
        "header header header header"
        "screener chart chart right"
        "screener trades aichat right"
      `,
      templateColumns: '300px 1fr 1fr 350px',
      templateRows: '60px 50% 50%',
    },
  },

  analyst: {
    id: 'analyst',
    name: 'Analyst',
    description: 'Comprehensive layout with depth charts, news, and performance metrics for deep analysis.',
    icon: '🔬',
    targetUser: 'expert',
    widgets: {
      left: ['screener', 'watchlist'],
      center: ['chart', 'positions'],
      right: ['depth', 'news', 'performance'],
    },
    defaultExpanded: ['chart', 'depth', 'news', 'positions', 'performance'],
    gridConfig: {
      templateAreas: `
        "header header header"
        "left chart right"
        "left chart right"
        "left positions right"
      `,
      templateColumns: '300px 1fr 400px',
      templateRows: '60px 40% 30% 30%',
    },
  },

  scalper: {
    id: 'scalper',
    name: 'Scalper',
    description: 'Ultra-minimal layout optimized for rapid execution. Chart + order book only.',
    icon: '🎰',
    targetUser: 'expert',
    widgets: {
      left: [],
      center: ['chart'],
      right: ['orderbook', 'trades'],
    },
    defaultExpanded: ['chart', 'orderbook', 'trades'],
    gridConfig: {
      templateAreas: `
        "header header"
        "chart right"
        "chart right"
      `,
      templateColumns: '1fr 400px',
      templateRows: '60px 1fr 1fr',
    },
  },

  maxChart: {
    id: 'maxChart',
    name: 'Max Chart',
    description: 'Chart-focused layout with minimal distractions. Best for technical analysis.',
    icon: '📈',
    targetUser: 'advanced',
    widgets: {
      left: [],
      center: ['chart', 'performance'],
      right: ['orderbook'],
    },
    defaultExpanded: ['chart', 'performance'],
    gridConfig: {
      templateAreas: `
        "header header"
        "chart right"
        "chart right"
        "performance right"
      `,
      templateColumns: '1fr 350px',
      templateRows: '60px 50% 30% 20%',
    },
  },
};

export const DEFAULT_PRESET_ID = 'intermediate';

/**
 * Get layout preset by ID
 */
export function getLayoutPreset(presetId: string): LayoutPreset {
  return LAYOUT_PRESETS[presetId] || LAYOUT_PRESETS[DEFAULT_PRESET_ID];
}

/**
 * Save layout preset preference to localStorage
 */
export function saveLayoutPreference(presetId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('trading_layout_preset', presetId);
  }
}

/**
 * Load layout preset preference from localStorage
 */
export function loadLayoutPreference(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('trading_layout_preset') || DEFAULT_PRESET_ID;
  }
  return DEFAULT_PRESET_ID;
}

/**
 * Get all available presets as an array
 */
export function getAllPresets(): LayoutPreset[] {
  return Object.values(LAYOUT_PRESETS);
}

/**
 * Get presets filtered by target user level
 */
export function getPresetsByUserLevel(level: 'beginner' | 'intermediate' | 'advanced' | 'expert'): LayoutPreset[] {
  return getAllPresets().filter((preset) => preset.targetUser === level);
}
