'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Command,
  X,
  Search,
  Zap,
  Download,
  Filter,
  BarChart3,
  Network,
  ArrowRight,
  Sparkles,
  Clock,
  Route,
  Wifi,
  Users,
  AlertTriangle,
  FileJson,
  Image,
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Home,
  ArrowLeft,
  ArrowUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'navigation' | 'view' | 'analysis' | 'export' | 'investigation' | 'filter' | 'search';
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  // Navigation actions
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  onGoHome?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  // View actions
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitGraph: () => void;
  onResetView: () => void;
  onToggleFullscreen: () => void;
  // Analysis actions
  onCalculateMetrics: () => void;
  onDetectClusters: () => void;
  onColorByPageRank: () => void;
  onColorByCentrality: () => void;
  onSizeByVolume: () => void;
  // Export actions
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;
  onCopyAddresses: () => void;
  onGenerateShareURL: () => void;
  // Investigation actions
  onProfileCurrentWallet: () => void;
  onDetectWashTrading: () => void;
  onDetectMEV: () => void;
  onTraceFirstFunder: () => void;
  onEnrichGraph: () => void;
  // Filter actions
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onToggleTimeline: () => void;
  // Path finding
  onTogglePathFinding: () => void;
  // Real-time
  onToggleRealtime: () => void;
  isRealtimeConnected?: boolean;
  // Multi-account
  onToggleMultiView: () => void;
  isMultiViewActive?: boolean;
  // AI Search
  onOpenAISearch: () => void;
  className?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateBack,
  onNavigateForward,
  onGoHome,
  canGoBack = false,
  canGoForward = false,
  onZoomIn,
  onZoomOut,
  onFitGraph,
  onResetView,
  onToggleFullscreen,
  onCalculateMetrics,
  onDetectClusters,
  onColorByPageRank,
  onColorByCentrality,
  onSizeByVolume,
  onExportPNG,
  onExportSVG,
  onExportJSON,
  onCopyAddresses,
  onGenerateShareURL,
  onProfileCurrentWallet,
  onDetectWashTrading,
  onDetectMEV,
  onTraceFirstFunder,
  onEnrichGraph,
  onApplyFilters,
  onResetFilters,
  onToggleTimeline,
  onTogglePathFinding,
  onToggleRealtime,
  isRealtimeConnected = false,
  onToggleMultiView,
  isMultiViewActive = false,
  onOpenAISearch,
  className
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Define all available commands
  const allCommands: CommandAction[] = useMemo(() => [
    // Navigation
    {
      id: 'go-back',
      title: 'Go Back',
      description: 'Navigate to previous view',
      icon: <ArrowLeft className="w-4 h-4" />,
      category: 'navigation',
      shortcut: 'Ctrl+[',
      action: () => onNavigateBack?.()
    },
    {
      id: 'go-forward',
      title: 'Go Forward',
      description: 'Navigate to next view',
      icon: <ArrowRight className="w-4 h-4" />,
      category: 'navigation',
      shortcut: 'Ctrl+]',
      action: () => onNavigateForward?.()
    },
    {
      id: 'go-home',
      title: 'Go Home',
      description: 'Return to initial view',
      icon: <Home className="w-4 h-4" />,
      category: 'navigation',
      shortcut: 'Ctrl+H',
      action: () => onGoHome?.()
    },

    // View
    {
      id: 'zoom-in',
      title: 'Zoom In',
      description: 'Increase zoom level',
      icon: <ZoomIn className="w-4 h-4" />,
      category: 'view',
      shortcut: '+',
      action: onZoomIn
    },
    {
      id: 'zoom-out',
      title: 'Zoom Out',
      description: 'Decrease zoom level',
      icon: <ZoomOut className="w-4 h-4" />,
      category: 'view',
      shortcut: '-',
      action: onZoomOut
    },
    {
      id: 'fit-graph',
      title: 'Fit Graph',
      description: 'Fit all nodes in view',
      icon: <Maximize2 className="w-4 h-4" />,
      category: 'view',
      shortcut: 'F',
      action: onFitGraph
    },
    {
      id: 'reset-view',
      title: 'Reset View',
      description: 'Reset zoom and position',
      icon: <ArrowUp className="w-4 h-4" />,
      category: 'view',
      shortcut: 'R',
      action: onResetView
    },
    {
      id: 'toggle-fullscreen',
      title: 'Toggle Fullscreen',
      description: 'Enter or exit fullscreen mode',
      icon: <Maximize2 className="w-4 h-4" />,
      category: 'view',
      shortcut: 'Ctrl+F',
      action: onToggleFullscreen
    },

    // Analysis
    {
      id: 'calculate-metrics',
      title: 'Calculate Metrics',
      description: 'Compute PageRank, centrality, and other metrics',
      icon: <BarChart3 className="w-4 h-4" />,
      category: 'analysis',
      action: onCalculateMetrics
    },
    {
      id: 'detect-clusters',
      title: 'Detect Clusters',
      description: 'Find wallet groups using community detection',
      icon: <Users className="w-4 h-4" />,
      category: 'analysis',
      action: onDetectClusters
    },
    {
      id: 'color-by-pagerank',
      title: 'Color by PageRank',
      description: 'Visualize nodes by influence',
      icon: <Zap className="w-4 h-4" />,
      category: 'analysis',
      action: onColorByPageRank
    },
    {
      id: 'color-by-centrality',
      title: 'Color by Centrality',
      description: 'Visualize bridge nodes',
      icon: <Network className="w-4 h-4" />,
      category: 'analysis',
      action: onColorByCentrality
    },
    {
      id: 'size-by-volume',
      title: 'Size by Volume',
      description: 'Scale nodes by transaction volume',
      icon: <BarChart3 className="w-4 h-4" />,
      category: 'analysis',
      action: onSizeByVolume
    },

    // Export
    {
      id: 'export-png',
      title: 'Export as PNG',
      description: 'Download graph as image',
      icon: <Image className="w-4 h-4" />,
      category: 'export',
      action: onExportPNG
    },
    {
      id: 'export-svg',
      title: 'Export as SVG',
      description: 'Download graph as vector image',
      icon: <Image className="w-4 h-4" />,
      category: 'export',
      action: onExportSVG
    },
    {
      id: 'export-json',
      title: 'Export as JSON',
      description: 'Download graph data',
      icon: <FileJson className="w-4 h-4" />,
      category: 'export',
      action: onExportJSON
    },
    {
      id: 'copy-addresses',
      title: 'Copy Addresses',
      description: 'Copy all account addresses to clipboard',
      icon: <Download className="w-4 h-4" />,
      category: 'export',
      action: onCopyAddresses
    },
    {
      id: 'share-url',
      title: 'Generate Share URL',
      description: 'Create shareable link to current view',
      icon: <Share2 className="w-4 h-4" />,
      category: 'export',
      action: onGenerateShareURL
    },

    // Investigation
    {
      id: 'profile-wallet',
      title: 'Profile Current Wallet',
      description: 'Analyze wallet behavior and patterns',
      icon: <Search className="w-4 h-4" />,
      category: 'investigation',
      action: onProfileCurrentWallet
    },
    {
      id: 'detect-wash-trading',
      title: 'Detect Wash Trading',
      description: 'Find suspicious circular transactions',
      icon: <AlertTriangle className="w-4 h-4" />,
      category: 'investigation',
      action: onDetectWashTrading
    },
    {
      id: 'detect-mev',
      title: 'Detect MEV',
      description: 'Find frontrunning and sandwich attacks',
      icon: <Zap className="w-4 h-4" />,
      category: 'investigation',
      action: onDetectMEV
    },
    {
      id: 'trace-first-funder',
      title: 'Trace First Funder',
      description: 'Find original funding source',
      icon: <Route className="w-4 h-4" />,
      category: 'investigation',
      action: onTraceFirstFunder
    },
    {
      id: 'enrich-graph',
      title: 'Enrich Graph Data',
      description: 'Add labels and metadata to nodes',
      icon: <Sparkles className="w-4 h-4" />,
      category: 'investigation',
      action: onEnrichGraph
    },

    // Filters
    {
      id: 'apply-filters',
      title: 'Apply Filters',
      description: 'Apply current filter settings',
      icon: <Filter className="w-4 h-4" />,
      category: 'filter',
      action: onApplyFilters
    },
    {
      id: 'reset-filters',
      title: 'Reset Filters',
      description: 'Clear all filters',
      icon: <Filter className="w-4 h-4" />,
      category: 'filter',
      action: onResetFilters
    },
    {
      id: 'toggle-timeline',
      title: 'Toggle Timeline',
      description: 'Show/hide transaction timeline',
      icon: <Clock className="w-4 h-4" />,
      category: 'filter',
      action: onToggleTimeline
    },

    // Search
    {
      id: 'ai-search',
      title: 'AI Search',
      description: 'Search graph with natural language',
      icon: <Sparkles className="w-4 h-4" />,
      category: 'search',
      action: onOpenAISearch
    },
    {
      id: 'path-finding',
      title: 'Find Path',
      description: 'Find connection between two accounts',
      icon: <Route className="w-4 h-4" />,
      category: 'search',
      shortcut: 'P',
      action: onTogglePathFinding
    },
    {
      id: 'toggle-realtime',
      title: isRealtimeConnected ? 'Disconnect Real-time' : 'Connect Real-time',
      description: isRealtimeConnected ? 'Stop live updates' : 'Enable live transaction updates',
      icon: <Wifi className="w-4 h-4" />,
      category: 'search',
      action: onToggleRealtime
    },
    {
      id: 'toggle-multi-view',
      title: isMultiViewActive ? 'Exit Multi-Account View' : 'Multi-Account View',
      description: isMultiViewActive ? 'Return to single account view' : 'Compare multiple accounts',
      icon: <Users className="w-4 h-4" />,
      category: 'search',
      shortcut: 'M',
      action: onToggleMultiView
    }
  ], [
    onNavigateBack, onNavigateForward, onGoHome, onZoomIn, onZoomOut, onFitGraph,
    onResetView, onToggleFullscreen, onCalculateMetrics, onDetectClusters,
    onColorByPageRank, onColorByCentrality, onSizeByVolume, onExportPNG, onExportSVG,
    onExportJSON, onCopyAddresses, onGenerateShareURL, onProfileCurrentWallet,
    onDetectWashTrading, onDetectMEV, onTraceFirstFunder, onEnrichGraph,
    onApplyFilters, onResetFilters, onToggleTimeline, onOpenAISearch, onTogglePathFinding,
    onToggleRealtime, isRealtimeConnected, onToggleMultiView, isMultiViewActive
  ]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return allCommands;
    const lower = search.toLowerCase();
    return allCommands.filter(cmd =>
      cmd.title.toLowerCase().includes(lower) ||
      cmd.description.toLowerCase().includes(lower) ||
      cmd.category.toLowerCase().includes(lower)
    );
  }, [search, allCommands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Execute selected command
  const executeCommand = useCallback((cmd: CommandAction) => {
    cmd.action();
    onClose();
    setSearch('');
    setSelectedIndex(0);
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, executeCommand, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    view: 'View',
    analysis: 'Analysis',
    export: 'Export',
    investigation: 'Investigation',
    filter: 'Filters',
    search: 'Search & Tools'
  };

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Command palette */}
      <div className={cn(
        'relative w-full max-w-lg bg-background border border-border rounded-xl shadow-2xl overflow-hidden',
        className
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Command className="w-5 h-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex px-2 py-1 text-xs bg-muted rounded font-mono text-muted-foreground">
            ESC
          </kbd>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No commands found</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, commands]) => (
              <div key={category} className="mb-2">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {categoryLabels[category] || category}
                </div>
                {commands.map((cmd) => {
                  const itemIndex = flatIndex++;
                  const isSelected = selectedIndex === itemIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-selected={isSelected}
                      onClick={() => executeCommand(cmd)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      )}
                    >
                      <div className={cn(
                        'p-1.5 rounded',
                        isSelected ? 'bg-primary/20' : 'bg-muted'
                      )}>
                        {cmd.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{cmd.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
                      </div>
                      {cmd.shortcut && (
                        <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono text-muted-foreground">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded">Up</kbd>
              <kbd className="px-1 py-0.5 bg-muted rounded">Down</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd>
              <span>to select</span>
            </span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
