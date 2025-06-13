'use client';

import * as echarts from 'echarts';
import 'echarts-gl';
import { Transaction, AccountData } from './types';

// Define node and edge types for the graph
interface GraphNode {
  id: string;
  name: string;
  value: number;
  symbolSize: number;
  category: number;
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
    opacity?: number;
  };
  label?: {
    show?: boolean;
    formatter?: string;
  };
  tooltip?: {
    formatter?: string;
  };
  x?: number;
  y?: number;
  z?: number;
  data?: any;
}

interface GraphLink {
  source: string;
  target: string;
  value?: number;
  lineStyle?: {
    color?: string;
    width?: number;
    opacity?: number;
    curveness?: number;
  };
  tooltip?: {
    formatter?: string;
  };
  data?: any;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  categories: { name: string }[];
}

// Node categories
const CATEGORIES = [
  { name: 'Transaction' },
  { name: 'Account' },
  { name: 'Success' },
  { name: 'Error' }
];

// Color scheme
const COLORS = {
  transaction: '#4a5568',
  account: '#3182ce',
  success: '#38a169',
  error: '#e53e3e',
  highlight: '#f6ad55',
  edge: '#a0aec0',
  background: '#1a202c'
};

/**
 * Initialize ECharts instance with fallback to canvas renderer if WebGL fails
 * @param container DOM element to render chart in
 * @returns ECharts instance
 */
export const initializeECharts = (container: HTMLElement): echarts.ECharts => {
  let chart: echarts.ECharts;
  
  try {
    // Try to initialize with WebGL support
    chart = echarts.init(container, 'dark', {
      renderer: 'canvas', // Start with canvas renderer, WebGL will be used for 3D elements
      devicePixelRatio: window.devicePixelRatio,
      useDirtyRect: true, // Enable dirty rectangle optimization
    });
    
    // Configure WebGL
    try {
      chart.getZr().configLayer(0, {
        useWebGL: true,
        preferWebGL: true
      });
    } catch (error) {
      console.warn('Failed to configure WebGL, falling back to canvas renderer:', error);
    }
  } catch (error) {
    console.error('Failed to initialize ECharts with WebGL, falling back to basic canvas renderer:', error);
    // Fallback to basic canvas renderer
    chart = echarts.init(container, 'dark', {
      renderer: 'canvas',
      devicePixelRatio: 1, // Use lower resolution for better performance
      useDirtyRect: false
    });
  }

  // Set default options with safer configuration
  chart.setOption({
    backgroundColor: 'rgba(0,0,0,0.02)',
    title: {
      text: 'Transaction Graph',
      subtext: 'Powered by ECharts',
      left: 'center',
      top: 0,
      textStyle: {
        fontSize: 14,
        color: '#888'
      },
      subtextStyle: {
        fontSize: 10,
        color: '#aaa'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const node = params.data;
          if (node.data?.type === 'transaction') {
            return `<div style="font-weight: bold; margin-bottom: 4px;">Transaction</div>
                    <div style="word-break: break-all;">${node.data.fullSignature || node.id}</div>
                    ${node.data.timestamp ? `<div style="margin-top: 4px;">Time: ${node.data.formattedTime}</div>` : ''}
                    ${node.data.success !== undefined ? `<div style="margin-top: 4px;">Status: ${node.data.success ? 'Success' : 'Error'}</div>` : ''}`;
          } else if (node.data?.type === 'account') {
            return `<div style="font-weight: bold; margin-bottom: 4px;">Account</div>
                    <div style="word-break: break-all;">${node.data.fullAddress || node.id}</div>`;
          }
          return `ID: ${node.id}`;
        } else if (params.dataType === 'edge') {
          const edge = params.data;
          if (edge.data?.type === 'transfer') {
            return `<div style="font-weight: bold; margin-bottom: 4px;">Token Transfer</div>
                    <div>Amount: ${edge.data.label}</div>
                    <div style="margin-top: 4px;">From: ${edge.data.source}</div>
                    <div>To: ${edge.data.target}</div>`;
          }
          return `Connection: ${edge.source} → ${edge.target}`;
        }
        return '';
      }
    },
    legend: {
      data: CATEGORIES.map(c => c.name),
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: {
        color: '#ccc'
      }
    },
    animationDuration: 1000, // Reduced from 1500
    animationEasingUpdate: 'quinticInOut',
    series: [{
      name: 'Transaction Graph',
      // Use regular graph type instead of graphGL for better compatibility
      type: 'graph',
      layout: 'force',
      force: {
        repulsion: 100,
        gravity: 0.1,
        edgeLength: 50,
        friction: 0.6
      },
      roam: true,
      lineStyle: {
        color: 'source',
        opacity: 0.5,
        width: 1
      },
      itemStyle: {
        opacity: 0.8
      },
      emphasis: {
        itemStyle: {
          opacity: 1
        },
        lineStyle: {
          opacity: 1,
          width: 2
        }
      },
      label: {
        show: false,
        position: 'right',
        formatter: '{b}'
      },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 8,
      data: [],
      links: [],
      categories: CATEGORIES
    }]
  });

  return chart;
};

/**
 * Convert Cytoscape-style data to ECharts format
 * @param nodes Array of node data
 * @param edges Array of edge data
 * @returns Formatted data for ECharts
 */
export const formatGraphData = (
  nodes: Array<{ data: any }>,
  edges: Array<{ data: any }>
): GraphData => {
  const formattedNodes: GraphNode[] = nodes.map(node => {
    const data = node.data;
    const isTransaction = data.type === 'transaction';
    const isSuccess = data.success === true;
    const isError = data.success === false;
    
    // Determine category based on node type and status
    let category = isTransaction ? 0 : 1;
    if (isTransaction && isSuccess) category = 2;
    if (isTransaction && isError) category = 3;
    
    // Determine node size based on type
    const symbolSize = isTransaction ? 15 : 10;
    
    // Determine node color based on type and status
    let color = isTransaction ? COLORS.transaction : COLORS.account;
    if (isTransaction && isSuccess) color = COLORS.success;
    if (isTransaction && isError) color = COLORS.error;
    
    return {
      id: data.id,
      name: data.label || data.id.substring(0, 8) + '...',
      value: 1,
      symbolSize,
      category,
      itemStyle: {
        color,
        borderColor: '#fff',
        borderWidth: 1,
        opacity: 0.9
      },
      label: {
        show: true,
        formatter: '{b}'
      },
      data
    };
  });
  
  const formattedLinks: GraphLink[] = edges.map(edge => {
    const data = edge.data;
    return {
      source: data.source,
      target: data.target,
      value: 1,
      lineStyle: {
        color: COLORS.edge,
        width: 1,
        opacity: 0.7,
        curveness: 0.3
      },
      data
    };
  });
  
  return {
    nodes: formattedNodes,
    links: formattedLinks,
    categories: CATEGORIES
  };
};

/**
 * Update graph data
 * @param chart ECharts instance
 * @param nodes Array of node data
 * @param edges Array of edge data
 * @param animate Whether to animate the update
 */
export const updateGraphData = (
  chart: echarts.ECharts,
  nodes: Array<{ data: any }>,
  edges: Array<{ data: any }>,
  animate = true
): void => {
  const { nodes: formattedNodes, links: formattedLinks, categories } = formatGraphData(nodes, edges);
  
  chart.setOption({
    series: [{
      data: formattedNodes,
      links: formattedLinks,
      categories
    }]
  }, {
    notMerge: false,
    lazyUpdate: true,
    silent: !animate
  });
};

/**
 * Focus on a specific node
 * @param chart ECharts instance
 * @param nodeId ID of node to focus on
 */
export const focusOnNode = (chart: echarts.ECharts, nodeId: string): void => {
  // Get current data
  const option = chart.getOption();
  const seriesData = option.series[0].data as GraphNode[];
  
  // Find the node
  const nodeIndex = seriesData.findIndex(node => node.id === nodeId);
  if (nodeIndex === -1) return;
  
  // Highlight the node
  const updatedData = [...seriesData];
  updatedData[nodeIndex] = {
    ...updatedData[nodeIndex],
    itemStyle: {
      ...updatedData[nodeIndex].itemStyle,
      color: COLORS.highlight,
      borderWidth: 2,
      opacity: 1
    },
    symbolSize: updatedData[nodeIndex].symbolSize * 1.5
  };
  
  // Update the chart
  chart.setOption({
    series: [{
      data: updatedData
    }]
  });
  
  // Center on the node
  chart.dispatchAction({
    type: 'focusNodeAdjacency',
    seriesIndex: 0,
    dataIndex: nodeIndex
  });
};

/**
 * Apply layout to the graph
 * @param chart ECharts instance
 * @param layoutType Type of layout to apply
 */
export const applyLayout = (chart: echarts.ECharts, layoutType: string): void => {
  try {
    let layout: any;
    
    switch (layoutType) {
      case 'force':
        layout = {
          type: 'graphGL',
          layout: 'force',
          force: {
            repulsion: 100,
            gravity: 0.1,
            edgeLength: 50,
            friction: 0.6
          }
        };
        break;
      case 'circular':
        layout = {
          type: 'graphGL',
          layout: 'circular',
          circular: {
            rotateLabel: true
          }
        };
        break;
      case 'tree':
        // Use a safer force layout as fallback instead of forceAtlas2 which can have WebGL issues
        layout = {
          type: 'graphGL',
          layout: 'force',
          force: {
            repulsion: 200,
            gravity: 0.2,
            edgeLength: 80,
            friction: 0.8,
            layoutAnimation: true
          }
        };
        
        // Try to apply the layout with error handling
        try {
          chart.setOption({
            series: [layout]
          });
        } catch (error) {
          console.warn('Error applying tree layout, falling back to basic force layout:', error);
          // Fallback to even simpler force layout without WebGL
          chart.setOption({
            series: [{
              type: 'graph',
              layout: 'force',
              force: {
                repulsion: 100,
                gravity: 0.1,
                edgeLength: 50
              },
              roam: true,
              data: chart.getOption().series[0].data,
              links: chart.getOption().series[0].links,
              categories: chart.getOption().series[0].categories
            }]
          });
        }
        return; // Return early to skip the standard chart.setOption call
      default:
        layout = {
          type: 'graphGL',
          layout: 'force'
        };
    }
    
    // Only apply the layout if we didn't return early
    chart.setOption({
      series: [layout]
    });
  } catch (error) {
    console.error('Error applying layout:', error);
    // Fallback to basic layout
    try {
      chart.setOption({
        series: [{
          type: 'graph',
          layout: 'force',
          force: {
            repulsion: 50,
            edgeLength: 50
          }
        }]
      });
    } catch (e) {
      console.error('Failed to apply fallback layout:', e);
    }
  }
};

/**
 * Filter graph nodes
 * @param chart ECharts instance
 * @param filterType Type of filter to apply
 */
export const filterNodes = (chart: echarts.ECharts, filterType: string): void => {
  // Get current data
  const option = chart.getOption();
  const seriesData = option.series[0].data as GraphNode[];
  const seriesLinks = option.series[0].links as GraphLink[];
  
  // Apply filter
  let updatedData = [...seriesData];
  let updatedLinks = [...seriesLinks];
  
  if (filterType !== 'all') {
    // Filter nodes
    updatedData = seriesData.map(node => {
      const nodeType = node.data?.type;
      const nodeSuccess = node.data?.success;
      
      let opacity = 0.2;
      
      if (filterType === 'transaction' && nodeType === 'transaction') {
        opacity = 1;
      } else if (filterType === 'account' && nodeType === 'account') {
        opacity = 1;
      } else if (filterType === 'success' && nodeType === 'transaction' && nodeSuccess === true) {
        opacity = 1;
      } else if (filterType === 'error' && nodeType === 'transaction' && nodeSuccess === false) {
        opacity = 1;
      }
      
      return {
        ...node,
        itemStyle: {
          ...node.itemStyle,
          opacity
        }
      };
    });
    
    // Filter links based on connected nodes
    updatedLinks = seriesLinks.map(link => {
      const sourceNode = updatedData.find(node => node.id === link.source);
      const targetNode = updatedData.find(node => node.id === link.target);
      
      const sourceOpacity = sourceNode?.itemStyle?.opacity || 0.2;
      const targetOpacity = targetNode?.itemStyle?.opacity || 0.2;
      
      // Link is visible if either source or target is visible
      const opacity = (sourceOpacity > 0.5 || targetOpacity > 0.5) ? 0.7 : 0.1;
      
      return {
        ...link,
        lineStyle: {
          ...link.lineStyle,
          opacity
        }
      };
    });
  }
  
  // Update the chart
  chart.setOption({
    series: [{
      data: updatedData,
      links: updatedLinks
    }]
  });
};

/**
 * Enable performance mode
 * @param chart ECharts instance
 * @param enable Whether to enable performance mode
 */
export const setPerformanceMode = (chart: echarts.ECharts, enable: boolean): void => {
  if (enable) {
    // Reduce visual quality for better performance
    chart.setOption({
      series: [{
        progressive: 500, // Render in batches
        progressiveThreshold: 1000,
        blendMode: 'source-over',
        itemStyle: {
          opacity: 0.7
        },
        lineStyle: {
          opacity: 0.5,
          width: 1
        },
        label: {
          show: false
        },
        emphasis: {
          focus: 'none' // Disable emphasis for better performance
        }
      }]
    });
  } else {
    // Restore normal quality
    chart.setOption({
      series: [{
        progressive: 0, // Disable progressive rendering
        progressiveThreshold: 3000,
        blendMode: 'source-over',
        itemStyle: {
          opacity: 0.8
        },
        lineStyle: {
          opacity: 0.7,
          width: 1
        },
        label: {
          show: true
        },
        emphasis: {
          focus: 'adjacency'
        }
      }]
    });
  }
};

/**
 * Limit visible nodes
 * @param chart ECharts instance
 * @param limit Maximum number of nodes to show
 */
export const limitVisibleNodes = (chart: echarts.ECharts, limit: number): void => {
  // Get current data
  const option = chart.getOption();
  const seriesData = option.series[0].data as GraphNode[];
  const seriesLinks = option.series[0].links as GraphLink[];
  
  if (seriesData.length <= limit) return;
  
  // Sort nodes by importance (transactions first, then accounts)
  const sortedNodes = [...seriesData].sort((a, b) => {
    // Transactions are more important than accounts
    if (a.data?.type === 'transaction' && b.data?.type !== 'transaction') return -1;
    if (a.data?.type !== 'transaction' && b.data?.type === 'transaction') return 1;
    return 0;
  });
  
  // Keep only the top N nodes
  const visibleNodeIds = new Set(sortedNodes.slice(0, limit).map(node => node.id));
  
  // Update node visibility
  const updatedData = seriesData.map(node => {
    const isVisible = visibleNodeIds.has(node.id);
    return {
      ...node,
      itemStyle: {
        ...node.itemStyle,
        opacity: isVisible ? (node.itemStyle?.opacity || 0.8) : 0
      }
    };
  });
  
  // Update link visibility
  const updatedLinks = seriesLinks.map(link => {
    const isSourceVisible = visibleNodeIds.has(link.source as string);
    const isTargetVisible = visibleNodeIds.has(link.target as string);
    const isVisible = isSourceVisible && isTargetVisible;
    
    return {
      ...link,
      lineStyle: {
        ...link.lineStyle,
        opacity: isVisible ? (link.lineStyle?.opacity || 0.7) : 0
      }
    };
  });
  
  // Update the chart
  chart.setOption({
    series: [{
      data: updatedData,
      links: updatedLinks
    }]
  });
};

/**
 * Clean up ECharts instance
 * @param chart ECharts instance
 */
export const cleanupECharts = (chart: echarts.ECharts): void => {
  chart.dispose();
};