'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  FilterIcon,
  SlidersIcon,
  EyeIcon,
  EyeOffIcon,
  PaletteIcon,
  LayoutIcon,
  SearchIcon,
  XIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  UploadIcon,
  RotateCcwIcon,
  SaveIcon,
  ShareIcon,
  CopyIcon,
  CheckIcon
} from 'lucide-react';
// Note: Avoid importing types that may drift; define minimal local types used here
type NodeType = 'account' | 'program' | 'instruction' | 'transaction';
type EdgeType = 'transfer' | 'invoke' | 'dependency';
interface GraphNode { id: string; type: NodeType; data: Record<string, any>; }
interface GraphEdge { id: string; source: string; target: string; type: EdgeType; data: Record<string, any>; }

// Filter and customization interfaces
export interface GraphFilters {
  nodeTypes: Set<NodeType>;
  edgeTypes: Set<EdgeType>;
  minNodeSize: number;
  maxNodeSize: number;
  minEdgeWidth: number;
  maxEdgeWidth: number;
  minAmount: number;
  maxAmount: number;
  timeRange: {
    start: number | null;
    end: number | null;
  };
  searchQuery: string;
  showOnlyConnected: boolean;
  hideSystemAccounts: boolean;
  hideSmallTransfers: boolean;
  groupByProgram: boolean;
  groupByTokenType: boolean;
}

export interface GraphCustomization {
  layout: 'force' | 'hierarchical' | 'circular' | 'grid' | 'radial';
  nodeSize: 'uniform' | 'by_balance' | 'by_activity' | 'by_importance';
  edgeWidth: 'uniform' | 'by_amount' | 'by_frequency' | 'by_weight';
  colorScheme: 'default' | 'dark' | 'light' | 'colorblind' | 'high_contrast';
  showNodeLabels: boolean;
  showEdgeLabels: boolean;
  showGroupLabels: boolean;
  animateTransfers: boolean;
  highlightPaths: boolean;
  showMinimap: boolean;
  showStatistics: boolean;
  nodeOpacity: number;
  edgeOpacity: number;
  backgroundGrid: boolean;
  exportFormat: 'png' | 'svg' | 'json' | 'csv';
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: Partial<GraphFilters>;
  customization: Partial<GraphCustomization>;
  isDefault?: boolean;
}

interface TransactionGraphFiltersProps {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  filters: GraphFilters;
  customization: GraphCustomization;
  onFiltersChange: (filters: GraphFilters) => void;
  onCustomizationChange: (customization: GraphCustomization) => void;
  onExport: (format: string, options: any) => void;
  onImport: (data: any) => void;
  onReset: () => void;
  className?: string;
}

// Default filter and customization values
const DEFAULT_FILTERS: GraphFilters = {
  nodeTypes: new Set(),
  edgeTypes: new Set(),
  minNodeSize: 0,
  maxNodeSize: 100,
  minEdgeWidth: 0,
  maxEdgeWidth: 20,
  minAmount: 0,
  maxAmount: Number.MAX_SAFE_INTEGER,
  timeRange: { start: null, end: null },
  searchQuery: '',
  showOnlyConnected: false,
  hideSystemAccounts: false,
  hideSmallTransfers: false,
  groupByProgram: false,
  groupByTokenType: false
};

const DEFAULT_CUSTOMIZATION: GraphCustomization = {
  layout: 'force',
  nodeSize: 'by_balance',
  edgeWidth: 'by_amount',
  colorScheme: 'default',
  showNodeLabels: true,
  showEdgeLabels: false,
  showGroupLabels: true,
  animateTransfers: true,
  highlightPaths: false,
  showMinimap: false,
  showStatistics: true,
  nodeOpacity: 1.0,
  edgeOpacity: 0.8,
  backgroundGrid: false,
  exportFormat: 'png'
};

// Predefined filter presets
const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'default',
    name: 'Default View',
    description: 'Show all nodes and edges with standard layout',
    filters: {},
    customization: {},
    isDefault: true
  },
  {
    id: 'defi_focus',
    name: 'DeFi Focus',
    description: 'Highlight DeFi protocols and token transfers',
    filters: {
      hideSystemAccounts: true,
      minAmount: 100,
      groupByProgram: true
    },
    customization: {
      layout: 'hierarchical',
      animateTransfers: true,
      highlightPaths: true
    }
  },
  {
    id: 'high_value',
    name: 'High Value Transactions',
    description: 'Show only transactions above $1000',
    filters: {
      minAmount: 1000,
      hideSmallTransfers: true
    },
    customization: {
      nodeSize: 'by_balance',
      edgeWidth: 'by_amount',
      colorScheme: 'high_contrast'
    }
  },
  {
    id: 'program_analysis',
    name: 'Program Analysis',
    description: 'Focus on program interactions and instruction flow',
    filters: {
      nodeTypes: new Set(['program', 'transaction']),
      groupByProgram: true
    },
    customization: {
      layout: 'radial',
      showEdgeLabels: true,
      animateTransfers: false
    }
  },
  {
    id: 'token_flow',
    name: 'Token Flow',
    description: 'Visualize token transfers and balances',
    filters: {
      edgeTypes: new Set<EdgeType>(['transfer']),
      groupByTokenType: true
    },
    customization: {
      layout: 'circular',
      nodeSize: 'by_balance',
      edgeWidth: 'by_amount',
      animateTransfers: true
    }
  },
  {
    id: 'minimal',
    name: 'Minimal View',
    description: 'Clean view with essential information only',
    filters: {
      hideSystemAccounts: true,
      showOnlyConnected: true
    },
    customization: {
      showNodeLabels: false,
      showEdgeLabels: false,
      nodeOpacity: 0.8,
      edgeOpacity: 0.6,
      backgroundGrid: true
    }
  }
];

const TransactionGraphFilters: React.FC<TransactionGraphFiltersProps> = ({
  graph,
  filters,
  customization,
  onFiltersChange,
  onCustomizationChange,
  onExport,
  onImport,
  onReset,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'filters' | 'customization' | 'presets' | 'export'>('filters');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'display']));
  const [copiedPreset, setCopiedPreset] = useState<string | null>(null);
  const [customPresetName, setCustomPresetName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate filtered statistics
  const filteredStats = useMemo(() => {
    let filteredNodes: GraphNode[] = graph.nodes;
    let filteredEdges: GraphEdge[] = graph.edges;

    // Apply node type filter
    if (filters.nodeTypes.size > 0) {
      filteredNodes = filteredNodes.filter(node => !filters.nodeTypes.has(node.type));
    }

    // Apply edge type filter
    if (filters.edgeTypes.size > 0) {
      filteredEdges = filteredEdges.filter(edge => !filters.edgeTypes.has(edge.type));
    }

    // Apply search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filteredNodes = filteredNodes.filter(node => {
        const label = (node as any).label as string | undefined;
        return (
          (label && label.toLowerCase().includes(query)) ||
          (node.data.address && String(node.data.address).toLowerCase().includes(query)) ||
          node.id.toLowerCase().includes(query)
        );
      });
    }

    // Apply amount filter
    filteredEdges = filteredEdges.filter(edge => {
      const amount = edge.data.amount || 0;
      return amount >= filters.minAmount && amount <= filters.maxAmount;
    });

    // Apply size filters
    filteredNodes = filteredNodes.filter(node => {
      const size = (node as any).style?.size ?? 1;
      return size >= filters.minNodeSize && size <= filters.maxNodeSize;
    });

    filteredEdges = filteredEdges.filter(edge => {
      const width = (edge as any).style?.width ?? 1;
      return width >= filters.minEdgeWidth && width <= filters.maxEdgeWidth;
    });

    // Apply connection filter
    if (filters.showOnlyConnected) {
      const connectedNodeIds = new Set<string>();
      filteredEdges.forEach(edge => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });
      filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));
    }

    // Apply system account filter
    if (filters.hideSystemAccounts) {
      // No 'system_account' in local NodeType; keep accounts and programs only
      filteredNodes = filteredNodes.filter(node => node.type === 'account' || node.type === 'program');
    }

    // Apply small transfer filter
    if (filters.hideSmallTransfers) {
      filteredEdges = filteredEdges.filter(edge => (edge.data.amount || 0) >= 10);
    }

    // Filter edges to only include those with both source and target in filtered nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(edge =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return {
      totalNodes: graph.nodes.length,
      filteredNodes: filteredNodes.length,
      totalEdges: graph.edges.length,
      filteredEdges: filteredEdges.length,
      hiddenNodes: graph.nodes.length - filteredNodes.length,
      hiddenEdges: graph.edges.length - filteredEdges.length,
      nodeTypes: [...new Set(filteredNodes.map(n => n.type))],
      edgeTypes: [...new Set(filteredEdges.map(e => e.type))]
    };
  }, [graph, filters]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  const updateFilters = useCallback((updates: Partial<GraphFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  }, [filters, onFiltersChange]);

  const updateCustomization = useCallback((updates: Partial<GraphCustomization>) => {
    onCustomizationChange({ ...customization, ...updates });
  }, [customization, onCustomizationChange]);

  const applyPreset = useCallback((preset: FilterPreset) => {
    onFiltersChange({ ...DEFAULT_FILTERS, ...preset.filters });
    onCustomizationChange({ ...DEFAULT_CUSTOMIZATION, ...preset.customization });
  }, [onFiltersChange, onCustomizationChange]);

  const exportConfiguration = useCallback(async (format: 'json' | 'url') => {
    const config = {
      filters,
      customization,
      timestamp: Date.now(),
      graphSignature: (graph as any).metadata?.transactionSignature ?? ''
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sig = ((graph as any).metadata?.transactionSignature ?? 'graph').toString();
      link.download = `graph-config-${sig.substring(0, 8)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === 'url') {
      const encoded = btoa(JSON.stringify(config));
      const url = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?config=${encoded}` : '';
      await navigator.clipboard.writeText(url);
      setCopiedPreset('url');
      setTimeout(() => setCopiedPreset(null), 2000);
    }
  }, [filters, customization, graph]);

  const importConfiguration = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          if (config.filters && config.customization) {
            onFiltersChange({ ...DEFAULT_FILTERS, ...config.filters });
            onCustomizationChange({ ...DEFAULT_CUSTOMIZATION, ...config.customization });
            onImport(config); // Notify parent component of successful import
          }
        } catch (error) {
          console.error('Failed to import configuration:', error);
        }
      };
      reader.readAsText(file);
    }
  }, [onFiltersChange, onCustomizationChange, onImport]);

  const renderFilterSection = () => (
    <div className="space-y-4">
      {/* Basic Filters */}
      <div className="border border-border rounded-lg">
        <button
          onClick={() => toggleSection('basic')}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          type="button"
        >
          <span className="font-medium">Basic Filters</span>
          {expandedSections.has('basic') ?
            <ChevronDownIcon className="w-4 h-4" /> :
            <ChevronRightIcon className="w-4 h-4" />
          }
        </button>

        {expandedSections.has('basic') && (
          <div className="p-4 border-t border-border space-y-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search nodes by address, label..."
                  value={filters.searchQuery}
                  onChange={(e) => updateFilters({ searchQuery: e.target.value })}
                  className="w-full pl-10 pr-10 py-2 border border-border rounded-md text-sm"
                />
                {filters.searchQuery && (
                  <button
                    onClick={() => updateFilters({ searchQuery: '' })}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                    title="Clear search"
                    type="button"
                  >
                    <XIcon className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Node Types */}
            <div>
              <label className="block text-sm font-medium mb-2">Hide Node Types</label>
              <div className="grid grid-cols-2 gap-2">
                {Array.from(new Set(graph.nodes.map(n => n.type))).map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.nodeTypes.has(type)}
                      onChange={(e) => {
                        const newTypes = new Set(filters.nodeTypes);
                        if (e.target.checked) {
                          newTypes.add(type);
                        } else {
                          newTypes.delete(type);
                        }
                        updateFilters({ nodeTypes: newTypes });
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Edge Types */}
            <div>
              <label className="block text-sm font-medium mb-2">Hide Edge Types</label>
              <div className="grid grid-cols-2 gap-2">
                {Array.from(new Set(graph.edges.map(e => e.type))).map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.edgeTypes.has(type)}
                      onChange={(e) => {
                        const newTypes = new Set(filters.edgeTypes);
                        if (e.target.checked) {
                          newTypes.add(type);
                        } else {
                          newTypes.delete(type);
                        }
                        updateFilters({ edgeTypes: newTypes });
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Quick Filters */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.showOnlyConnected}
                  onChange={(e) => updateFilters({ showOnlyConnected: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Show only connected nodes</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.hideSystemAccounts}
                  onChange={(e) => updateFilters({ hideSystemAccounts: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Hide system accounts</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.hideSmallTransfers}
                  onChange={(e) => updateFilters({ hideSmallTransfers: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Hide small transfers (&lt; $10)</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      <div className="border border-border rounded-lg">
        <button
          onClick={() => toggleSection('advanced')}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          type="button"
        >
          <span className="font-medium">Advanced Filters</span>
          {expandedSections.has('advanced') ?
            <ChevronDownIcon className="w-4 h-4" /> :
            <ChevronRightIcon className="w-4 h-4" />
          }
        </button>

        {expandedSections.has('advanced') && (
          <div className="p-4 border-t border-border space-y-4">
            {/* Amount Range */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Amount Range: ${filters.minAmount.toLocaleString()} - ${filters.maxAmount === Number.MAX_SAFE_INTEGER ? '∞' : filters.maxAmount.toLocaleString()}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="10000"
                  value={Math.min(filters.minAmount, 10000)}
                  onChange={(e) => updateFilters({ minAmount: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minAmount}
                    onChange={(e) => updateFilters({ minAmount: parseInt(e.target.value) || 0 })}
                    className="flex-1 px-3 py-1 border border-border rounded text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxAmount === Number.MAX_SAFE_INTEGER ? '' : filters.maxAmount}
                    onChange={(e) => updateFilters({ maxAmount: parseInt(e.target.value) || Number.MAX_SAFE_INTEGER })}
                    className="flex-1 px-3 py-1 border border-border rounded text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Node Size Range */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Node Size Range: {filters.minNodeSize} - {filters.maxNodeSize}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={filters.minNodeSize}
                  onChange={(e) => updateFilters({ minNodeSize: parseInt(e.target.value) })}
                  className="w-full"
                />
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={filters.maxNodeSize}
                  onChange={(e) => updateFilters({ maxNodeSize: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Edge Width Range */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Edge Width Range: {filters.minEdgeWidth} - {filters.maxEdgeWidth}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={filters.minEdgeWidth}
                  onChange={(e) => updateFilters({ minEdgeWidth: parseInt(e.target.value) })}
                  className="w-full"
                />
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={filters.maxEdgeWidth}
                  onChange={(e) => updateFilters({ maxEdgeWidth: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>

            {/* Grouping Options */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.groupByProgram}
                  onChange={(e) => updateFilters({ groupByProgram: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Group by program</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.groupByTokenType}
                  onChange={(e) => updateFilters({ groupByTokenType: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Group by token type</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Filter Statistics */}
      <div className="bg-muted/10 rounded-lg p-4">
        <h4 className="font-medium mb-2">Filter Results</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Nodes:</span>
            <span className="ml-2 font-medium">
              {filteredStats.filteredNodes} / {filteredStats.totalNodes}
              {filteredStats.hiddenNodes > 0 && (
                <span className="text-red-500 ml-1">(-{filteredStats.hiddenNodes})</span>
              )}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Edges:</span>
            <span className="ml-2 font-medium">
              {filteredStats.filteredEdges} / {filteredStats.totalEdges}
              {filteredStats.hiddenEdges > 0 && (
                <span className="text-red-500 ml-1">(-{filteredStats.hiddenEdges})</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
  const renderCustomizationSection = () => (
    <div className="space-y-4">
      {/* Layout Options */}
      <div className="border border-border rounded-lg">
        <button
          onClick={() => toggleSection('layout')}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          type="button"
        >
          <span className="font-medium">Layout & Positioning</span>
          {expandedSections.has('layout') ?
            <ChevronDownIcon className="w-4 h-4" /> :
            <ChevronRightIcon className="w-4 h-4" />
          }
        </button>

        {expandedSections.has('layout') && (
          <div className="p-4 border-t border-border space-y-4">
            {/* Layout Algorithm */}
            <div>
              <label className="block text-sm font-medium mb-2">Layout Algorithm</label>
              <select
                value={customization.layout}
                onChange={(e) => updateCustomization({ layout: e.target.value as any })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              >
                <option value="force">Force-Directed</option>
                <option value="hierarchical">Hierarchical</option>
                <option value="circular">Circular</option>
                <option value="grid">Grid</option>
                <option value="radial">Radial</option>
              </select>
            </div>

            {/* Node Sizing */}
            <div>
              <label className="block text-sm font-medium mb-2">Node Sizing</label>
              <select
                value={customization.nodeSize}
                onChange={(e) => updateCustomization({ nodeSize: e.target.value as any })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              >
                <option value="uniform">Uniform Size</option>
                <option value="by_balance">By Balance</option>
                <option value="by_activity">By Activity</option>
                <option value="by_importance">By Importance</option>
              </select>
            </div>

            {/* Edge Width */}
            <div>
              <label className="block text-sm font-medium mb-2">Edge Width</label>
              <select
                value={customization.edgeWidth}
                onChange={(e) => updateCustomization({ edgeWidth: e.target.value as any })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              >
                <option value="uniform">Uniform Width</option>
                <option value="by_amount">By Amount</option>
                <option value="by_frequency">By Frequency</option>
                <option value="by_weight">By Weight</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Visual Appearance */}
      <div className="border border-border rounded-lg">
        <button
          onClick={() => toggleSection('appearance')}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          type="button"
        >
          <span className="font-medium">Visual Appearance</span>
          {expandedSections.has('appearance') ?
            <ChevronDownIcon className="w-4 h-4" /> :
            <ChevronRightIcon className="w-4 h-4" />
          }
        </button>

        {expandedSections.has('appearance') && (
          <div className="p-4 border-t border-border space-y-4">
            {/* Color Scheme */}
            <div>
              <label className="block text-sm font-medium mb-2">Color Scheme</label>
              <select
                value={customization.colorScheme}
                onChange={(e) => updateCustomization({ colorScheme: e.target.value as any })}
                className="w-full px-3 py-2 border border-border rounded-md text-sm"
              >
                <option value="default">Default</option>
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
                <option value="colorblind">Colorblind Friendly</option>
                <option value="high_contrast">High Contrast</option>
              </select>
            </div>

            {/* Opacity Controls */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Node Opacity: {(customization.nodeOpacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={customization.nodeOpacity}
                onChange={(e) => updateCustomization({ nodeOpacity: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Edge Opacity: {(customization.edgeOpacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={customization.edgeOpacity}
                onChange={(e) => updateCustomization({ edgeOpacity: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Background Options */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={customization.backgroundGrid}
                  onChange={(e) => updateCustomization({ backgroundGrid: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Show background grid</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Display Options */}
      <div className="border border-border rounded-lg">
        <button
          onClick={() => toggleSection('display')}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
          type="button"
        >
          <span className="font-medium">Display Options</span>
          {expandedSections.has('display') ?
            <ChevronDownIcon className="w-4 h-4" /> :
            <ChevronRightIcon className="w-4 h-4" />
          }
        </button>

        {expandedSections.has('display') && (
          <div className="p-4 border-t border-border space-y-4">
            {/* Label Options */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={customization.showNodeLabels}
                  onChange={(e) => updateCustomization({ showNodeLabels: e.target.checked })}
                  className="rounded border-border"
                />
                {customization.showNodeLabels ? (
                  <EyeIcon className="w-4 h-4 text-primary" />
                ) : (
                  <EyeOffIcon className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm">Show node labels</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={customization.showEdgeLabels}
                  onChange={(e) => updateCustomization({ showEdgeLabels: e.target.checked })}
                  className="rounded border-border"
                />
                {customization.showEdgeLabels ? (
                  <EyeIcon className="w-4 h-4 text-primary" />
                ) : (
                  <EyeOffIcon className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm">Show edge labels</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={customization.showGroupLabels}
                  onChange={(e) => updateCustomization({ showGroupLabels: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Show group labels</span>
              </label>
            </div>

            {/* Animation Options */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={customization.animateTransfers}
                  onChange={(e) => updateCustomization({ animateTransfers: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Animate token transfers</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={customization.highlightPaths}
                  onChange={(e) => updateCustomization({ highlightPaths: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Highlight transaction paths</span>
              </label>
            </div>

            {/* Additional UI Elements */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={customization.showMinimap}
                  onChange={(e) => updateCustomization({ showMinimap: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Show minimap</span>
              </label>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={customization.showStatistics}
                  onChange={(e) => updateCustomization({ showStatistics: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Show statistics panel</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderPresetsSection = () => (
    <div className="space-y-4">
      {/* Predefined Presets */}
      <div>
        <h4 className="font-medium mb-3">Predefined Presets</h4>
        <div className="space-y-2">
          {FILTER_PRESETS.map(preset => (
            <div key={preset.id} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium">{preset.name}</h5>
                <div className="flex space-x-1">
                  <button
                    onClick={() => applyPreset(preset)}
                    className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors"
                    type="button"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => {
                      const config = { filters: preset.filters, customization: preset.customization };
                      navigator.clipboard.writeText(JSON.stringify(config));
                      setCopiedPreset(preset.id);
                      setTimeout(() => setCopiedPreset(null), 2000);
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    title="Copy configuration"
                    type="button"
                  >
                    {copiedPreset === preset.id ?
                      <CheckIcon className="w-4 h-4 text-green-500" /> :
                      <CopyIcon className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{preset.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Preset Creation */}
      <div className="border border-border rounded-lg p-4">
        <h4 className="font-medium mb-3">Create Custom Preset</h4>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Preset name..."
            value={customPresetName}
            onChange={(e) => setCustomPresetName(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md text-sm"
          />
          <button
            onClick={() => {
              if (customPresetName.trim()) {
                const customPreset: FilterPreset = {
                  id: `custom_${Date.now()}`,
                  name: customPresetName,
                  description: 'Custom user-created preset',
                  filters,
                  customization
                };
                // Save to localStorage
                const savedPresets = JSON.parse(localStorage.getItem('graphFilterPresets') || '[]');
                savedPresets.push(customPreset);
                localStorage.setItem('graphFilterPresets', JSON.stringify(savedPresets));
                setCustomPresetName('');
              }
            }}
            disabled={!customPresetName.trim()}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="button"
          >
            <SaveIcon className="w-4 h-4 inline mr-2" />
            Save Current Settings as Preset
          </button>
        </div>
      </div>
    </div>
  );

  const renderExportSection = () => (
    <div className="space-y-4">
      {/* Export Format */}
      <div>
        <label className="block text-sm font-medium mb-2">Export Format</label>
        <select
          value={customization.exportFormat}
          onChange={(e) => updateCustomization({ exportFormat: e.target.value as any })}
          className="w-full px-3 py-2 border border-border rounded-md text-sm"
        >
          <option value="png">PNG Image</option>
          <option value="svg">SVG Vector</option>
          <option value="json">JSON Data</option>
          <option value="csv">CSV Data</option>
        </select>
      </div>

      {/* Export Options */}
      <div className="space-y-3">
        <button
          onClick={() => onExport(customization.exportFormat, {
            includeFilters: true,
            includeCustomization: true
          })}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          type="button"
        >
          <DownloadIcon className="w-4 h-4" />
          <span>Export Graph</span>
        </button>

        <button
          onClick={() => exportConfiguration('json')}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-border rounded hover:bg-muted transition-colors"
          type="button"
        >
          <DownloadIcon className="w-4 h-4" />
          <span>Export Configuration</span>
        </button>

        <button
          onClick={() => exportConfiguration('url')}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-border rounded hover:bg-muted transition-colors"
          type="button"
        >
          {copiedPreset === 'url' ? <CheckIcon className="w-4 h-4" /> : <ShareIcon className="w-4 h-4" />}
          <span>{copiedPreset === 'url' ? 'Copied!' : 'Share Configuration URL'}</span>
        </button>
      </div>

      {/* Import Configuration */}
      <div className="border-t border-border pt-4">
        <h4 className="font-medium mb-3">Import Configuration</h4>
        <div className="space-y-2">
          <label className="flex items-center justify-center space-x-2 px-4 py-2 border border-border border-dashed rounded hover:bg-muted transition-colors cursor-pointer">
            <UploadIcon className="w-4 h-4" />
            <span>Import from File</span>
            <input
              type="file"
              accept=".json"
              onChange={importConfiguration}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`bg-background border border-border rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-lg font-semibold">Graph Controls</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`p-2 hover:bg-muted rounded transition-colors ${showAdvanced ? 'bg-muted' : ''}`}
            title="Toggle advanced settings"
          >
            <SlidersIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onReset}
            className="p-2 hover:bg-muted rounded transition-colors"
            title="Reset to defaults"
          >
            <RotateCcwIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { id: 'filters', label: 'Filters', icon: FilterIcon },
          { id: 'customization', label: 'Style', icon: PaletteIcon },
          { id: 'presets', label: 'Presets', icon: LayoutIcon },
          { id: 'export', label: 'Export', icon: DownloadIcon }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {activeTab === 'filters' && renderFilterSection()}
        {activeTab === 'customization' && renderCustomizationSection()}
        {activeTab === 'presets' && renderPresetsSection()}
        {activeTab === 'export' && renderExportSection()}
      </div>
    </div>
  );
};

export default TransactionGraphFilters;

// Export utility functions
export function applyFiltersToGraph(graph: { nodes: GraphNode[]; edges: GraphEdge[]; metadata?: any }, filters: GraphFilters): { nodes: GraphNode[]; edges: GraphEdge[]; metadata?: any } {
  let filteredNodes: GraphNode[] = graph.nodes;
  let filteredEdges: GraphEdge[] = graph.edges;

  // Apply all filters
  if (filters.nodeTypes.size > 0) {
    filteredNodes = filteredNodes.filter(node => !filters.nodeTypes.has(node.type));
  }

  if (filters.edgeTypes.size > 0) {
    filteredEdges = filteredEdges.filter(edge => !filters.edgeTypes.has(edge.type));
  }

  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase();
    filteredNodes = filteredNodes.filter(node => {
      const label = (node as any).label as string | undefined;
      return (
        (label && label.toLowerCase().includes(query)) ||
        (node.data.address && String(node.data.address).toLowerCase().includes(query)) ||
        node.id.toLowerCase().includes(query)
      );
    });
  }

  filteredEdges = filteredEdges.filter(edge => {
    const amount = edge.data.amount || 0;
    return amount >= filters.minAmount && amount <= filters.maxAmount;
  });

  filteredNodes = filteredNodes.filter(node => {
    const size = (node as any).style?.size ?? 1;
    return size >= filters.minNodeSize && size <= filters.maxNodeSize;
  });

  filteredEdges = filteredEdges.filter(edge => {
    const width = (edge as any).style?.width ?? 1;
    return width >= filters.minEdgeWidth && width <= filters.maxEdgeWidth;
  });

  if (filters.showOnlyConnected) {
    const connectedNodeIds = new Set<string>();
    filteredEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
    filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));
  }

  if (filters.hideSystemAccounts) {
    filteredNodes = filteredNodes.filter(node => node.type === 'account' || node.type === 'program');
  }

  if (filters.hideSmallTransfers) {
    filteredEdges = filteredEdges.filter(edge => (edge.data.amount || 0) >= 10);
  }

  // Filter edges to only include those with both source and target in filtered nodes
  const nodeIds = new Set(filteredNodes.map(n => n.id));
  filteredEdges = filteredEdges.filter(edge =>
    nodeIds.has(edge.source) && nodeIds.has(edge.target)
  );

  return {
    ...graph,
    nodes: filteredNodes,
    edges: filteredEdges,
    metadata: {
      ...(graph as any).metadata,
      totalNodes: filteredNodes.length,
      totalEdges: filteredEdges.length
    }
  };
}

export function getDefaultFilters(): GraphFilters {
  return { ...DEFAULT_FILTERS };
}

export function getDefaultCustomization(): GraphCustomization {
  return { ...DEFAULT_CUSTOMIZATION };
}

export function getFilterPresets(): FilterPreset[] {
  return [...FILTER_PRESETS];
}