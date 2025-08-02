'use client';

import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

// Register the dagre extension with error handling
let dagreRegistered = false;
if (typeof cytoscape !== 'undefined') {
  try {
    cytoscape.use(dagre);
    dagreRegistered = true;
    console.log('Dagre extension registered successfully');
  } catch (error) {
    console.error('Failed to register dagre extension:', error);
    dagreRegistered = false;
  }
}

// Define custom layout options for dagre with all properties
type DagreLayoutOptions = cytoscape.LayoutOptions & {
  rankDir?: string;
  ranker?: string;
  rankSep?: number;
  nodeSep?: number;
  edgeSep?: number;
  nodeDimensionsIncludeLabels?: boolean;
  spacingFactor?: number;
  animationEasing?: string;
  padding?: number;
  boundingBox?: { x1: number; y1: number; w: number; h: number };
  position?: (node: any) => any;
  rows?: number;
  cols?: number;
  animate?: boolean;
  animationDuration?: number;
  fit?: boolean;
  randomize?: boolean;
};

/**
 * Run incremental layout that preserves existing positions with improved spacing
 * @param cy Cytoscape instance
 * @param newElementIds Array of new element IDs to position
 */
export const runIncrementalLayout = (cy: cytoscape.Core, newElementIds: string[] = []): void => {
  // If there are specific new elements, run layout only on them and their neighborhood
  if (newElementIds.length > 0) {
    // Create a collection of the new elements
    const newElements = cy.collection();
    newElementIds.forEach(id => {
      const ele = cy.getElementById(id);
      if (ele.length > 0) {
        newElements.merge(ele);
      }
    });
    
    // Get connected elements as well
    const neighborhood = newElements.neighborhood();
    const subgraph = newElements.merge(neighborhood);
    
    // Run layout only on the subgraph but preserve existing positions
    subgraph.layout(<DagreLayoutOptions>{
      name: 'dagre',
      rankDir: 'TB', // Top to bottom layout
      ranker: 'tight-tree',
      rankSep: 120, // Increased for better visual separation
      nodeSep: 90, // Increased for better horizontal spacing
      edgeSep: 50,
      nodeDimensionsIncludeLabels: true,
      padding: 60,
      spacingFactor: 1.8, // Better balance of spacing
      animate: true,
      animationDuration: 500,
      animationEasing: 'ease-out-cubic',
      fit: false,
      randomize: false,
      // Only adjust positions of new nodes, preserve existing ones
      position: (node: any) => {
        const id = node.id();
        if (!newElementIds.includes(id) && node.position()) {
          return node.position();
        }
        return undefined; // Let the layout algorithm position new nodes
      }
    }).run();
  } else {
    // Default layout behavior for all elements with improved spacing
    cy.layout(<DagreLayoutOptions>{
      name: 'dagre',
      rankDir: 'TB', // Top to bottom layout
      ranker: 'network-simplex', // Better algorithm for cleaner layout
      rankSep: 180, // Increased for better vertical separation
      nodeSep: 140, // Increased for better horizontal separation
      edgeSep: 80,
      padding: 100,
      spacingFactor: 2.2, // Optimized spacing factor
      animate: true,
      animationDuration: 800,
      animationEasing: 'ease-out-cubic',
      fit: true,
      randomize: false,
      boundingBox: { x1: 0, y1: 0, w: cy.width(), h: cy.height() },
      nodeDimensionsIncludeLabels: true,
      // Only position nodes that don't have a position
      position: (node: any) => node.position()
    }).run();
  }
};

/**
 * Run full graph layout with optimized visual spacing
 * @param cy Cytoscape instance
 */
export const runLayout = (cy: cytoscape.Core): void => {
  const nodeCount = cy.nodes().length;
  
  // Adjust layout parameters based on graph size
  const layoutConfig: DagreLayoutOptions = {
    name: 'dagre',
    rankDir: 'TB', // Top to bottom layout
    ranker: 'network-simplex',
    rankSep: nodeCount > 20 ? 120 : 180, // Adaptive spacing based on size
    nodeSep: nodeCount > 20 ? 80 : 140, // Adaptive horizontal spacing
    edgeSep: nodeCount > 20 ? 40 : 80,
    padding: nodeCount > 20 ? 60 : 100,
    spacingFactor: nodeCount > 20 ? 1.5 : 2.2, // Tighter for large graphs
    animate: true,
    animationDuration: nodeCount > 50 ? 300 : 800, // Faster for large graphs
    animationEasing: 'ease-out-cubic',
    fit: true,
    randomize: false,
    boundingBox: { x1: 0, y1: 0, w: cy.width(), h: cy.height() },
    nodeDimensionsIncludeLabels: true
  };

  cy.layout(layoutConfig).run();
};

/**
 * Create the graph style with modern, polished appearance
 * @returns Array of Cytoscape style objects
 */
export const createGraphStyle = (): cytoscape.StylesheetCSS[] => [
  {
    selector: 'node',
    css: {
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '13px',
      'font-family': 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'color': '#ffffff',
      'text-outline-width': 1.5,
      'text-outline-color': 'rgba(0, 0, 0, 0.7)',
      'background-color': '#6366f1',
      'border-width': 2,
      'border-color': '#ffffff40',
      'border-opacity': 0.8
    }
  },
  {
    selector: 'node[status="pending"]',
    css: {
      'border-width': 2,
      'border-style': 'dashed',
      'border-color': '#e2e8f0',
      'background-color': '#f1f5f9',
      'color': '#64748b',
      'text-outline-color': '#ffffffcc',
      'opacity': 0.7
    }
  },
  {
    selector: 'node[status="loading"]',
    css: {
      'border-width': 2,
      'border-style': 'dotted',
      'border-color': '#3b82f6',
      'background-color': '#dbeafe',
      'color': '#1e40af',
      'text-outline-color': '#ffffffcc'
    }
  },
  {
    selector: 'node.account',
    css: {
      'shape': 'round-rectangle',
      'background-color': '#1e293b',
      'border-color': '#475569',
      'border-width': 2,
      'width': '180px',
      'height': '48px',
      'font-size': '12px',
      'color': '#e2e8f0',
      'text-outline-color': '#00000080'
    }
  },
  {
    selector: 'node.transaction',
    css: {
      'shape': 'ellipse',
      'background-color': '#3b82f6',
      'border-color': '#ffffff4d',
      'border-width': 2,
      'width': '56px',
      'height': '56px',
      'font-size': '11px'
    }
  },
  {
    selector: 'node.transaction.success',
    css: {
      'background-color': '#10b981',
      'border-color': '#ffffff66'
    }
  },
  {
    selector: 'node.transaction.error',
    css: {
      'background-color': '#ef4444',
      'border-color': '#ffffff66'
    }
  },
  {
    selector: 'node.new-transaction',
    css: {
      'background-color': '#8b5cf6',
      'border-width': 3,
      'border-color': '#a78bfa'
    }
  },
  {
    selector: 'node.tracked-address',
    css: {
      'background-color': '#f59e0b',
      'border-width': 3,
      'border-color': '#fbbf24'
    }
  },
  {
    selector: 'node.highlighted',
    css: {
      'border-width': 4,
      'border-color': '#fbbf24',
      'background-color': '#f59e0b',
      'text-outline-color': '#000000cc',
      'text-outline-width': 2,
      'z-index': 100
    }
  },
  {
    selector: 'node.active',
    css: {
      'border-width': 4,
      'border-color': '#06b6d4',
      'background-color': '#0891b2',
      'text-outline-color': '#000000cc',
      'text-outline-width': 2,
      'z-index': 999
    }
  },
  {
    selector: 'edge',
    css: {
      'width': 2.5,
      'line-color': '#64748b',
      'target-arrow-color': '#64748b',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'opacity': 0.8,
      'arrow-scale': 1.3,
      'line-cap': 'round'
    }
  },
  {
    selector: 'edge.hover',
    css: {
      'width': 4,
      'line-color': '#3b82f6',
      'target-arrow-color': '#3b82f6',
      'opacity': 1,
      'arrow-scale': 1.5,
      'z-index': 10
    }
  },
  {
    selector: 'edge[type="transfer"]',
    css: {
      'width': 3.5,
      'line-color': '#10b981',
      'target-arrow-color': '#10b981',
      'label': 'data(label)',
      'font-size': '11px',
      'font-family': 'Inter, sans-serif',
      'color': '#064e3b',
      'text-background-color': '#ecfdf5',
      'text-background-opacity': 0.95,
      'text-background-padding': '4px',
      'text-border-width': 1,
      'text-border-color': '#10b981',
      'text-border-opacity': 0.3,
      'line-cap': 'round',
      'curve-style': 'bezier'
    }
  },
  {
    selector: 'edge.realtime-edge',
    css: {
      'width': 3,
      'line-color': '#8b5cf6',
      'target-arrow-color': '#8b5cf6',
      'line-style': 'dashed',
      'opacity': 0.9,
      'arrow-scale': 1.4
    }
  },
  {
    selector: 'edge.highlighted',
    css: {
      'width': 5,
      'line-color': '#f59e0b',
      'target-arrow-color': '#f59e0b',
      'z-index': 999,
      'arrow-scale': 1.8,
      'opacity': 1,
      'line-cap': 'round'
    }
  },
  {
    selector: '.hover',
    css: {
      'border-width': 3,
      'line-color': '#06b6d4',
      'target-arrow-color': '#06b6d4',
      'z-index': 10
    }
  },
  {
    selector: '.fade-in',
    css: {
      'opacity': 0
    }
  },
  {
    selector: '.fade-in.visible',
    css: {
      'opacity': 1
    }
  }
];

/**
 * Initialize a Cytoscape instance with GPU acceleration
 * @param container HTML element to contain the graph
 * @returns Cytoscape instance
 */
export const initializeCytoscape = (container: HTMLElement): cytoscape.Core => {
  console.log('Starting cytoscape initialization...');
  
  // Add GPU acceleration hints to the container
  container.style.willChange = 'transform';
  container.style.transform = 'translateZ(0)'; // Force hardware acceleration
  
  // Choose layout based on dagre availability
  const layoutConfig = dagreRegistered ?
    <DagreLayoutOptions>{
      name: 'dagre',
      rankDir: 'TB', // Top to bottom layout
      ranker: 'network-simplex',
      rankSep: 150, // Reduced for better vertical spacing
      nodeSep: 100, // Reduced for better vertical spacing
      edgeSep: 80,
      padding: 60,
      spacingFactor: 1.8 // Reduced for tighter layout
    } :
    {
      name: 'grid',
      rows: 3,
      cols: 3,
      padding: 50,
      spacingFactor: 1.5
    };

  console.log('Using layout:', layoutConfig.name);

  const cy = cytoscape({
    container: container,
    style: createGraphStyle(),
    layout: layoutConfig,
    minZoom: 0.2,
    maxZoom: 3,
    // Use default wheelSensitivity (don't set custom value to avoid warnings)
    // Performance optimizations
    styleEnabled: true,
    hideEdgesOnViewport: false,
    hideLabelsOnViewport: false,
    textureOnViewport: false,
    motionBlur: false,
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    // Enable batching for better performance
    autoungrabify: false,
    autolock: false,
    autounselectify: false,
  });

  console.log('Cytoscape initialization completed');
  return cy;
};