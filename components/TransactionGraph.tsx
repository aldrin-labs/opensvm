'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  FocusManager, 
  ScreenReaderUtils, 
  HighContrastUtils, 
  useKeyboardNavigation, 
  useAccessibility,
  KEYBOARD_KEYS 
} from '@/lib/accessibility-utils';
import { 
  useMobileDetection, 
  useSwipeGestures,
  MobileGraphUtils,
  MobileModalUtils,
  MobileEventUtils 
} from '@/lib/mobile-utils';
import {
  ZoomInIcon,
  ZoomOutIcon,
  RotateCcwIcon,
  DownloadIcon,
  SettingsIcon,
  PlayIcon,
  PauseIcon,
  MaximizeIcon,
  MinimizeIcon,
  InfoIcon,
  FilterIcon,
  SearchIcon,
  EyeIcon,
  EyeOffIcon
} from 'lucide-react';
import type {
  TransactionGraph,
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeType
} from '@/lib/transaction-graph-builder';
import type { DetailedTransactionInfo } from '@/lib/solana';

interface TransactionGraphProps {
  transaction: DetailedTransactionInfo;
  graph?: TransactionGraph;
  width?: number;
  height?: number;
  className?: string;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  onEdgeHover?: (edge: GraphEdge | null) => void;
  interactive?: boolean;
  showControls?: boolean;
  showLegend?: boolean;
  showMinimap?: boolean;
  autoLayout?: boolean;
}

interface GraphControls {
  zoom: number;
  pan: { x: number; y: number };
  isPlaying: boolean;
  selectedNodes: Set<string>;
  selectedEdges: Set<string>;
  hoveredNode: string | null;
  hoveredEdge: string | null;
  showNodeLabels: boolean;
  showEdgeLabels: boolean;
  nodeFilter: Set<NodeType>;
  edgeFilter: Set<EdgeType>;
  searchQuery: string;
}

const TransactionGraph: React.FC<TransactionGraphProps> = ({
  transaction,
  graph,
  width = 800,
  height = 600,
  className = '',
  onNodeClick,
  onEdgeClick,
  onNodeHover,
  onEdgeHover,
  interactive = true,
  showControls = true,
  showLegend = true,
  showMinimap = false,
  autoLayout = true
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);

  const [controls, setControls] = useState<GraphControls>({
    zoom: 1,
    pan: { x: 0, y: 0 },
    isPlaying: autoLayout,
    selectedNodes: new Set(),
    selectedEdges: new Set(),
    hoveredNode: null,
    hoveredEdge: null,
    showNodeLabels: true,
    showEdgeLabels: false,
    nodeFilter: new Set(),
    edgeFilter: new Set(),
    searchQuery: ''
  });

  const [dimensions, setDimensions] = useState({ width, height });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Accessibility hooks
  const { highContrast, reducedMotion, announceToScreenReader, isTouchDevice } = useAccessibility();
  
  // Mobile detection and responsive dimensions
  const { isMobile, isTablet, viewportSize, orientation } = useMobileDetection();
  
  // Update dimensions based on mobile state
  useEffect(() => {
    if (isMobile || isTablet) {
      const optimalDimensions = MobileGraphUtils.getOptimalGraphDimensions(
        viewportSize.width, 
        viewportSize.height
      );
      setDimensions(optimalDimensions);
    }
  }, [isMobile, isTablet, viewportSize]);
  
  // Swipe gestures for mobile
  useSwipeGestures(containerRef, {
    onSwipeLeft: () => {
      if (isMobile && showSettings) {
        setShowSettings(false);
      }
    },
    onSwipeRight: () => {
      if (isMobile && !showSettings) {
        setShowSettings(true);
      }
    },
    onSwipeUp: () => {
      if (isMobile && !isFullscreen) {
        toggleFullscreen();
      }
    },
    onSwipeDown: () => {
      if (isMobile && isFullscreen) {
        toggleFullscreen();
      }
    }
  });
  
  // Keyboard navigation
  useKeyboardNavigation(containerRef, {
    onEscape: () => {
      if (isFullscreen) {
        toggleFullscreen();
      } else if (showSettings) {
        setShowSettings(false);
      }
    },
    trapFocus: isFullscreen || showSettings
  });

  // Filter nodes and edges based on current filters
  const filteredGraph = useMemo(() => {
    if (!graph) return null;

    let filteredNodes = graph.nodes;
    let filteredEdges = graph.edges;

    // Apply node type filter
    if (controls.nodeFilter.size > 0) {
      filteredNodes = filteredNodes.filter(node => controls.nodeFilter.has(node.type));
    }

    // Apply edge type filter
    if (controls.edgeFilter.size > 0) {
      filteredEdges = filteredEdges.filter(edge => controls.edgeFilter.has(edge.type));
    }

    // Apply search filter
    if (controls.searchQuery.trim()) {
      const query = controls.searchQuery.toLowerCase();
      filteredNodes = filteredNodes.filter(node =>
        node.label.toLowerCase().includes(query) ||
        node.data.address?.toLowerCase().includes(query) ||
        node.id.toLowerCase().includes(query)
      );
    }

    // Filter edges to only include those with both source and target in filtered nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(edge =>
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return {
      ...graph,
      nodes: filteredNodes,
      edges: filteredEdges
    };
  }, [graph, controls.nodeFilter, controls.edgeFilter, controls.searchQuery]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && !isFullscreen) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen]);

  // Initialize D3 simulation
  const initializeSimulation = useCallback(() => {
    if (!filteredGraph || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const { nodes, edges } = filteredGraph;

    // Clear previous content
    svg.selectAll('*').remove();

    // Create main group for zoom/pan
    const g = svg.append('g').attr('class', 'graph-container');

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setControls(prev => ({
          ...prev,
          zoom: event.transform.k,
          pan: { x: event.transform.x, y: event.transform.y }
        }));
      });

    svg.call(zoom);

    // Create arrow markers for directed edges
    const defs = svg.append('defs');

    // Create different arrow markers for different edge types
    const edgeTypes = [...new Set(edges.map(e => e.type))];
    edgeTypes.forEach(type => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', getEdgeColor(type));
    });

    // Create force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges)
        .id(d => d.id)
        .distance(d => 50 + (d.weight * 100))
        .strength(d => d.weight)
      )
      .force('charge', d3.forceManyBody()
        .strength(d => -300 - (d.importance * 200))
      )
      .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => d.style.size + 5)
      );

    simulationRef.current = simulation;

    // Create edges
    const link = g.append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('class', 'edge')
      .attr('stroke', d => d.style.color)
      .attr('stroke-width', d => d.style.width)
      .attr('stroke-opacity', d => d.style.opacity || 1)
      .attr('stroke-dasharray', d => d.style.dashed ? '5,5' : null)
      .attr('marker-end', d => `url(#arrow-${d.type})`)
      .style('cursor', interactive ? 'pointer' : 'default')
      .on('click', (event, d) => {
        if (interactive && onEdgeClick) {
          event.stopPropagation();
          onEdgeClick(d);
        }
      })
      .on('mouseenter', (event, d) => {
        if (interactive) {
          setControls(prev => ({ ...prev, hoveredEdge: d.id }));
          onEdgeHover?.(d);
        }
      })
      .on('mouseleave', () => {
        if (interactive) {
          setControls(prev => ({ ...prev, hoveredEdge: null }));
          onEdgeHover?.(null);
        }
      });

    // Create edge labels
    const edgeLabels = g.append('g')
      .attr('class', 'edge-labels')
      .selectAll('text')
      .data(edges.filter(e => e.label && controls.showEdgeLabels))
      .enter()
      .append('text')
      .attr('class', 'edge-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('pointer-events', 'none')
      .text(d => d.label);

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', interactive ? 'pointer' : 'default')
      .call(interactive ? d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) : () => { }
      )
      .on('click', (event, d) => {
        if (interactive && onNodeClick) {
          event.stopPropagation();
          onNodeClick(d);
        }
      })
      .on('mouseenter', (event, d) => {
        if (interactive) {
          setControls(prev => ({ ...prev, hoveredNode: d.id }));
          onNodeHover?.(d);
        }
      })
      .on('mouseleave', () => {
        if (interactive) {
          setControls(prev => ({ ...prev, hoveredNode: null }));
          onNodeHover?.(null);
        }
      });

    // Add node shapes
    node.each(function (d) {
      const nodeGroup = d3.select(this);

      switch (d.style.shape) {
        case 'circle':
          nodeGroup.append('circle')
            .attr('r', d.style.size)
            .attr('fill', d.style.color)
            .attr('stroke', d.style.borderColor || '#fff')
            .attr('stroke-width', d.style.borderWidth || 2);
          break;

        case 'square':
          nodeGroup.append('rect')
            .attr('width', d.style.size * 2)
            .attr('height', d.style.size * 2)
            .attr('x', -d.style.size)
            .attr('y', -d.style.size)
            .attr('fill', d.style.color)
            .attr('stroke', d.style.borderColor || '#fff')
            .attr('stroke-width', d.style.borderWidth || 2);
          break;

        case 'diamond':
          const diamondPath = `M 0,-${d.style.size} L ${d.style.size},0 L 0,${d.style.size} L -${d.style.size},0 Z`;
          nodeGroup.append('path')
            .attr('d', diamondPath)
            .attr('fill', d.style.color)
            .attr('stroke', d.style.borderColor || '#fff')
            .attr('stroke-width', d.style.borderWidth || 2);
          break;

        case 'triangle':
          const trianglePath = `M 0,-${d.style.size} L ${d.style.size * 0.866},${d.style.size * 0.5} L -${d.style.size * 0.866},${d.style.size * 0.5} Z`;
          nodeGroup.append('path')
            .attr('d', trianglePath)
            .attr('fill', d.style.color)
            .attr('stroke', d.style.borderColor || '#fff')
            .attr('stroke-width', d.style.borderWidth || 2);
          break;

        case 'hexagon':
          const hexPath = createHexagonPath(d.style.size);
          nodeGroup.append('path')
            .attr('d', hexPath)
            .attr('fill', d.style.color)
            .attr('stroke', d.style.borderColor || '#fff')
            .attr('stroke-width', d.style.borderWidth || 2);
          break;

        default:
          nodeGroup.append('circle')
            .attr('r', d.style.size)
            .attr('fill', d.style.color)
            .attr('stroke', d.style.borderColor || '#fff')
            .attr('stroke-width', d.style.borderWidth || 2);
      }
    });

    // Add node labels
    const nodeLabels = node.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.style.size + 15)
      .attr('font-size', '12px')
      .attr('fill', '#333')
      .attr('pointer-events', 'none')
      .style('display', controls.showNodeLabels ? 'block' : 'none')
      .text(d => d.label);

    // Animation and simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      edgeLabels
        .attr('x', d => ((d.source as GraphNode).x! + (d.target as GraphNode).x!) / 2)
        .attr('y', d => ((d.source as GraphNode).y! + (d.target as GraphNode).y!) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Handle play/pause
    if (!controls.isPlaying) {
      simulation.stop();
    }

    return () => {
      simulation.stop();
    };
  }, [filteredGraph, dimensions, controls.isPlaying, controls.showNodeLabels, controls.showEdgeLabels, interactive, onNodeClick, onEdgeClick, onNodeHover, onEdgeHover]);

  // Initialize simulation when graph changes
  useEffect(() => {
    initializeSimulation();
  }, [initializeSimulation]);

  // Control functions
  const handleZoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        1.5
      );
      announceToScreenReader(`Zoomed in to ${(controls.zoom * 1.5 * 100).toFixed(0)}%`);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
        1 / 1.5
      );
      announceToScreenReader(`Zoomed out to ${(controls.zoom / 1.5 * 100).toFixed(0)}%`);
    }
  };

  const handleReset = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().call(
        d3.zoom<SVGSVGElement, unknown>().transform as any,
        d3.zoomIdentity
      );
    }
    if (simulationRef.current) {
      simulationRef.current.alpha(1).restart();
    }
  };

  const handlePlayPause = () => {
    setControls(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    if (simulationRef.current) {
      if (controls.isPlaying) {
        simulationRef.current.stop();
      } else {
        simulationRef.current.alpha(0.3).restart();
      }
    }
  };

  const handleExport = () => {
    if (svgRef.current) {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      canvas.width = dimensions.width;
      canvas.height = dimensions.height;

      img.onload = () => {
        ctx?.drawImage(img, 0, 0);
        const link = document.createElement('a');
        link.download = `transaction-graph-${transaction.signature.substring(0, 8)}.png`;
        link.href = canvas.toDataURL();
        link.click();
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    } else {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    }
  };

  // Helper functions
  const createHexagonPath = (size: number): string => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = size * Math.cos(angle);
      const y = size * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return `M ${points.join(' L ')} Z`;
  };

  const getEdgeColor = (type: EdgeType): string => {
    const colors = {
      transfer: '#10B981',
      instruction: '#3B82F6',
      account_access: '#6B7280',
      program_invocation: '#8B5CF6',
      token_transfer: '#06B6D4',
      account_creation: '#F59E0B',
      account_closure: '#EF4444',
      delegation: '#EC4899',
      approval: '#84CC16'
    };
    return colors[type] || '#6B7280';
  };

  if (!graph) {
    return (
      <div className={`flex items-center justify-center bg-muted/10 rounded-lg ${className}`}
        style={{ width: dimensions.width, height: dimensions.height }}>
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading transaction graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`transaction-graph relative bg-background border border-border rounded-lg overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : ''} ${className} ${highContrast ? 'high-contrast-mode' : ''}`}
      style={{ width: isFullscreen ? '100vw' : dimensions.width, height: isFullscreen ? '100vh' : dimensions.height }}
      role="img"
      aria-label={`Transaction graph for ${transaction.signature.substring(0, 8)}... showing ${filteredGraph?.nodes.length || 0} nodes and ${filteredGraph?.edges.length || 0} connections`}
      aria-describedby="graph-description"
      tabIndex={0}
    >
      {/* Screen reader description */}
      <div id="graph-description" className="sr-only">
        Interactive transaction graph visualization. Use the following keyboard shortcuts:
        - Arrow keys: Navigate between nodes.
        - Enter: Select a node or edge.
        - Escape: Exit fullscreen mode or close settings.
        - Plus (+) or Minus (-): Zoom in and out.
        - Tab: Move focus between interactive elements like controls and the graph.
        - Spacebar: Toggle play/pause for animations (if applicable).
        {filteredGraph && (
          <>
            {' '}Graph contains {filteredGraph.nodes.length} nodes including accounts, programs, and tokens, 
            connected by {filteredGraph.edges.length} relationships such as transfers and instructions.
          </>
        )}
      </div>
      {/* Controls */}
      {showControls && (
        <div 
          className="absolute top-4 left-4 z-10 flex flex-col space-y-2"
          role="toolbar"
          aria-label="Graph controls"
        >
          <div className="flex space-x-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 border border-border">
            <button
              onClick={handleZoomIn}
              className={`${isTouchDevice ? 'min-h-[44px] min-w-[44px] p-3' : 'p-2'} hover:bg-muted rounded transition-colors focus-visible`}
              title="Zoom In"
              aria-label="Zoom in to graph"
              type="button"
            >
              <ZoomInIcon className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Zoom In</span>
            </button>
            <button
              onClick={handleZoomOut}
              className={`${isTouchDevice ? 'min-h-[44px] min-w-[44px] p-3' : 'p-2'} hover:bg-muted rounded transition-colors focus-visible`}
              title="Zoom Out"
              aria-label="Zoom out of graph"
              type="button"
            >
              <ZoomOutIcon className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Zoom Out</span>
            </button>
            <button
              onClick={handleReset}
              className={`${isTouchDevice ? 'min-h-[44px] min-w-[44px] p-3' : 'p-2'} hover:bg-muted rounded transition-colors focus-visible`}
              title="Reset View"
              aria-label="Reset graph view to default position and zoom"
              type="button"
            >
              <RotateCcwIcon className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Reset View</span>
            </button>
            <button
              onClick={handlePlayPause}
              className={`${isTouchDevice ? 'min-h-[44px] min-w-[44px] p-3' : 'p-2'} hover:bg-muted rounded transition-colors focus-visible`}
              title={controls.isPlaying ? "Pause Animation" : "Play Animation"}
              aria-label={controls.isPlaying ? "Pause graph animation" : "Play graph animation"}
              aria-pressed={controls.isPlaying}
              type="button"
            >
              {controls.isPlaying ? (
                <PauseIcon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <PlayIcon className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="sr-only">
                {controls.isPlaying ? "Pause Animation" : "Play Animation"}
              </span>
            </button>
          </div>

          <div className="flex space-x-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 border border-border">
            <button
              onClick={() => {
                const newState = !controls.showNodeLabels;
                setControls(prev => ({ ...prev, showNodeLabels: newState }));
                announceToScreenReader(`Node labels ${newState ? 'shown' : 'hidden'}`);
              }}
              className={`${isTouchDevice ? 'min-h-[44px] min-w-[44px] p-3' : 'p-2'} hover:bg-muted rounded transition-colors focus-visible`}
              title={controls.showNodeLabels ? "Hide Node Labels" : "Show Node Labels"}
              aria-label={controls.showNodeLabels ? "Hide node labels" : "Show node labels"}
              aria-pressed={controls.showNodeLabels}
              type="button"
            >
              {controls.showNodeLabels ? (
                <EyeOffIcon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <EyeIcon className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="sr-only">
                {controls.showNodeLabels ? "Hide Node Labels" : "Show Node Labels"}
              </span>
            </button>
            <button
              onClick={handleExport}
              className={`${isTouchDevice ? 'min-h-[44px] min-w-[44px] p-3' : 'p-2'} hover:bg-muted rounded transition-colors focus-visible`}
              title="Export Graph"
              aria-label="Export graph as PNG image"
              type="button"
            >
              <DownloadIcon className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Export Graph</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className={`${isTouchDevice ? 'min-h-[44px] min-w-[44px] p-3' : 'p-2'} hover:bg-muted rounded transition-colors focus-visible`}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"}
              aria-pressed={isFullscreen}
              type="button"
            >
              {isFullscreen ? (
                <MinimizeIcon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <MaximizeIcon className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="sr-only">
                {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              </span>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`${isTouchDevice ? 'min-h-[44px] min-w-[44px] p-3' : 'p-2'} hover:bg-muted rounded transition-colors focus-visible`}
              title="Settings"
              aria-label="Open graph settings"
              aria-expanded={showSettings}
              aria-controls="graph-settings-panel"
              type="button"
            >
              <SettingsIcon className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-4 right-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg p-4 border border-border w-80 max-h-96 overflow-y-auto">
          <h3 className="font-semibold mb-4">Graph Settings</h3>

          {/* Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Search Nodes</label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by address, label..."
                value={controls.searchQuery}
                onChange={(e) => setControls(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-md text-sm"
              />
            </div>
          </div>

          {/* Node Type Filters */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Node Types</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Array.from(new Set(graph.nodes.map(n => n.type))).map(type => (
                <label key={type} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={!controls.nodeFilter.has(type)}
                    onChange={(e) => {
                      const newFilter = new Set(controls.nodeFilter);
                      if (e.target.checked) {
                        newFilter.delete(type);
                      } else {
                        newFilter.add(type);
                      }
                      setControls(prev => ({ ...prev, nodeFilter: newFilter }));
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Edge Type Filters */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Edge Types</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Array.from(new Set(graph.edges.map(e => e.type))).map(type => (
                <label key={type} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={!controls.edgeFilter.has(type)}
                    onChange={(e) => {
                      const newFilter = new Set(controls.edgeFilter);
                      if (e.target.checked) {
                        newFilter.delete(type);
                      } else {
                        newFilter.add(type);
                      }
                      setControls(prev => ({ ...prev, edgeFilter: newFilter }));
                    }}
                    className="rounded border-border"
                  />
                  <span className="text-sm capitalize">{type.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Display Options */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={controls.showEdgeLabels}
                onChange={(e) => setControls(prev => ({ ...prev, showEdgeLabels: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-sm">Show Edge Labels</span>
            </label>
          </div>
        </div>
      )}

      {/* Graph Info */}
      <div className="absolute bottom-4 left-4 z-10 bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border">
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>Nodes: {filteredGraph?.nodes.length || 0}</span>
          <span>Edges: {filteredGraph?.edges.length || 0}</span>
          <span>Zoom: {(controls.zoom * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-4 right-4 z-10 bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border max-w-xs">
          <h4 className="font-medium mb-2 text-sm">Legend</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
              <span>Transaction</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Account</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
              <span>Program</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Token</span>
            </div>
          </div>
        </div>
      )}

      {/* Main SVG */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      />

      {/* Hover tooltip */}
      {(controls.hoveredNode || controls.hoveredEdge) && (
        <div className="absolute pointer-events-none z-20 bg-background border border-border rounded-lg p-2 shadow-lg text-sm max-w-xs">
          {controls.hoveredNode && (() => {
            const node = filteredGraph?.nodes.find(n => n.id === controls.hoveredNode);
            return node ? (
              <div>
                <div className="font-medium">{node.label}</div>
                <div className="text-muted-foreground">Type: {node.type}</div>
                {node.data.address && (
                  <div className="text-muted-foreground font-mono text-xs">
                    {node.data.address.substring(0, 16)}...
                  </div>
                )}
              </div>
            ) : null;
          })()}

          {controls.hoveredEdge && (() => {
            const edge = filteredGraph?.edges.find(e => e.id === controls.hoveredEdge);
            return edge ? (
              <div>
                <div className="font-medium">{edge.label || edge.type}</div>
                <div className="text-muted-foreground">Type: {edge.type}</div>
                {edge.data.amount && (
                  <div className="text-muted-foreground">
                    Amount: {edge.data.amount} {edge.data.symbol || ''}
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
};

export default TransactionGraph;