'use client';

import { useState, useCallback, useMemo } from 'react';
import cytoscape from 'cytoscape';

interface TimeRange {
  start: Date | null;
  end: Date | null;
}

interface FilterState {
  timeRange: TimeRange;
  tokens: string[];
  minAmount: number | null;
  maxAmount: number | null;
  transactionTypes: string[];
  hideSmallTransactions: boolean;
  showOnlyConnected: boolean;
}

interface TimelineFrame {
  timestamp: number;
  visibleNodes: string[];
  visibleEdges: string[];
}

const DEFAULT_FILTER_STATE: FilterState = {
  timeRange: { start: null, end: null },
  tokens: [],
  minAmount: null,
  maxAmount: null,
  transactionTypes: [],
  hideSmallTransactions: false,
  showOnlyConnected: false
};

/**
 * Hook for time-based and token-based graph filtering
 */
export function useGraphFiltering() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [timelineFrames, setTimelineFrames] = useState<TimelineFrame[]>([]);
  const [availableTokens, setAvailableTokens] = useState<string[]>([]);

  /**
   * Extract available tokens from graph
   */
  const extractTokens = useCallback((cy: cytoscape.Core) => {
    const tokens = new Set<string>();
    cy.edges().forEach(edge => {
      const symbol = edge.data('tokenSymbol');
      if (symbol) tokens.add(symbol);
    });
    setAvailableTokens(Array.from(tokens).sort());
    return Array.from(tokens);
  }, []);

  /**
   * Extract time range from graph
   */
  const extractTimeRange = useCallback((cy: cytoscape.Core): TimeRange => {
    let minTime = Infinity;
    let maxTime = -Infinity;

    cy.edges().forEach(edge => {
      const timestamp = edge.data('timestamp') || edge.data('blockTime');
      if (timestamp) {
        const time = typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime();
        minTime = Math.min(minTime, time);
        maxTime = Math.max(maxTime, time);
      }
    });

    return {
      start: minTime !== Infinity ? new Date(minTime) : null,
      end: maxTime !== -Infinity ? new Date(maxTime) : null
    };
  }, []);

  /**
   * Apply filters to graph
   */
  const applyFilters = useCallback((cy: cytoscape.Core) => {
    const { timeRange, tokens, minAmount, maxAmount, transactionTypes, hideSmallTransactions, showOnlyConnected } = filters;

    // Show all first
    cy.elements().removeClass('filtered-out');

    // Apply time filter
    if (timeRange.start || timeRange.end) {
      cy.edges().forEach(edge => {
        const timestamp = edge.data('timestamp') || edge.data('blockTime');
        if (timestamp) {
          const time = typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime();
          const afterStart = !timeRange.start || time >= timeRange.start.getTime();
          const beforeEnd = !timeRange.end || time <= timeRange.end.getTime();

          if (!afterStart || !beforeEnd) {
            edge.addClass('filtered-out');
          }
        }
      });
    }

    // Apply token filter
    if (tokens.length > 0) {
      cy.edges().forEach(edge => {
        const symbol = edge.data('tokenSymbol');
        if (symbol && !tokens.includes(symbol)) {
          edge.addClass('filtered-out');
        }
      });
    }

    // Apply amount filter
    if (minAmount !== null || maxAmount !== null) {
      cy.edges().forEach(edge => {
        const amount = edge.data('amount') || 0;
        const aboveMin = minAmount === null || amount >= minAmount;
        const belowMax = maxAmount === null || amount <= maxAmount;

        if (!aboveMin || !belowMax) {
          edge.addClass('filtered-out');
        }
      });
    }

    // Apply transaction type filter
    if (transactionTypes.length > 0) {
      cy.edges().forEach(edge => {
        const type = edge.data('txType') || edge.data('type');
        if (type && !transactionTypes.includes(type)) {
          edge.addClass('filtered-out');
        }
      });
    }

    // Hide small transactions (dust filter)
    if (hideSmallTransactions) {
      cy.edges().forEach(edge => {
        const amount = edge.data('amount') || 0;
        if (amount < 0.001) { // Less than 0.001 SOL
          edge.addClass('filtered-out');
        }
      });
    }

    // Hide nodes with no visible connections
    if (showOnlyConnected) {
      cy.nodes().forEach(node => {
        const visibleEdges = node.connectedEdges().filter(e => !e.hasClass('filtered-out'));
        if (visibleEdges.length === 0) {
          node.addClass('filtered-out');
        }
      });
    }

    // Apply CSS to hide filtered elements
    cy.style()
      .selector('.filtered-out')
      .style({
        'opacity': 0.1,
        'events': 'no'
      })
      .update();

  }, [filters]);

  /**
   * Generate timeline frames for playback
   */
  const generateTimelineFrames = useCallback((
    cy: cytoscape.Core,
    frameCount: number = 50
  ): TimelineFrame[] => {
    const timeRange = extractTimeRange(cy);
    if (!timeRange.start || !timeRange.end) return [];

    const startTime = timeRange.start.getTime();
    const endTime = timeRange.end.getTime();
    const duration = endTime - startTime;
    const frameInterval = duration / frameCount;

    const frames: TimelineFrame[] = [];

    for (let i = 0; i <= frameCount; i++) {
      const frameTime = startTime + (frameInterval * i);
      const visibleNodes = new Set<string>();
      const visibleEdges: string[] = [];

      cy.edges().forEach(edge => {
        const timestamp = edge.data('timestamp') || edge.data('blockTime');
        if (timestamp) {
          const time = typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime();
          if (time <= frameTime) {
            visibleEdges.push(edge.id());
            visibleNodes.add(edge.data('source'));
            visibleNodes.add(edge.data('target'));
          }
        }
      });

      frames.push({
        timestamp: frameTime,
        visibleNodes: Array.from(visibleNodes),
        visibleEdges
      });
    }

    setTimelineFrames(frames);
    return frames;
  }, [extractTimeRange]);

  /**
   * Apply a specific timeline frame
   */
  const applyTimelineFrame = useCallback((cy: cytoscape.Core, frameIndex: number) => {
    const frame = timelineFrames[frameIndex];
    if (!frame) return;

    setCurrentFrame(frameIndex);

    // Hide all elements first
    cy.elements().addClass('timeline-hidden');

    // Show elements for this frame
    frame.visibleNodes.forEach(nodeId => {
      cy.getElementById(nodeId).removeClass('timeline-hidden');
    });
    frame.visibleEdges.forEach(edgeId => {
      cy.getElementById(edgeId).removeClass('timeline-hidden');
    });

    // Apply CSS
    cy.style()
      .selector('.timeline-hidden')
      .style({
        'opacity': 0,
        'events': 'no'
      })
      .update();

  }, [timelineFrames]);

  /**
   * Start timeline playback
   */
  const startPlayback = useCallback((cy: cytoscape.Core) => {
    if (timelineFrames.length === 0) {
      generateTimelineFrames(cy);
    }
    setIsPlaying(true);
  }, [timelineFrames.length, generateTimelineFrames]);

  /**
   * Stop timeline playback
   */
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
  }, []);

  /**
   * Reset filters
   */
  const resetFilters = useCallback((cy: cytoscape.Core) => {
    setFilters(DEFAULT_FILTER_STATE);
    cy.elements().removeClass('filtered-out timeline-hidden');
    cy.style()
      .selector('.filtered-out, .timeline-hidden')
      .style({
        'opacity': 1,
        'events': 'yes'
      })
      .update();
  }, []);

  /**
   * Update specific filter
   */
  const updateFilter = useCallback(<K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Toggle token in filter
   */
  const toggleToken = useCallback((token: string) => {
    setFilters(prev => ({
      ...prev,
      tokens: prev.tokens.includes(token)
        ? prev.tokens.filter(t => t !== token)
        : [...prev.tokens, token]
    }));
  }, []);

  /**
   * Get filter statistics
   */
  const getFilterStats = useCallback((cy: cytoscape.Core) => {
    const total = cy.elements().length;
    const filtered = cy.elements('.filtered-out').length;
    const visible = total - filtered;

    return {
      total,
      filtered,
      visible,
      percentage: Math.round((visible / total) * 100)
    };
  }, []);

  return {
    // State
    filters,
    isPlaying,
    playbackSpeed,
    currentFrame,
    timelineFrames,
    availableTokens,

    // Actions
    setFilters,
    updateFilter,
    toggleToken,
    applyFilters,
    resetFilters,
    extractTokens,
    extractTimeRange,

    // Timeline
    generateTimelineFrames,
    applyTimelineFrame,
    startPlayback,
    stopPlayback,
    setPlaybackSpeed,
    setCurrentFrame,

    // Utils
    getFilterStats
  };
}

export default useGraphFiltering;
