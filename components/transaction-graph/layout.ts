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
// Use 'any' to avoid strict property typing issues for numeric vs string values
export const createGraphStyle = (): any[] => [
  {
    selector: 'node',
    css: {
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-size': '11px',
      'min-zoomed-font-size': 8,
      'font-family': 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      'color': 'hsl(var(--foreground))',
      'text-outline-width': 2,
      'text-outline-color': 'hsl(var(--background) / 0.9)',
      'background-color': 'hsl(var(--card))',
      'border-width': 1,
      'border-color': 'hsl(var(--border))',
      'border-opacity': 1
    }
  },
  {
    selector: 'node[status="pending"]',
    css: {
      'border-width': 2,
      'border-style': 'dashed',
      'border-color': 'hsl(var(--border))',
      'background-color': 'hsl(var(--muted))',
      'color': 'hsl(var(--muted-foreground))',
      'text-outline-color': 'hsl(var(--background) / 0.8)',
      'opacity': 0.7
    }
  },
  {
    selector: 'node[status="loading"]',
    css: {
      'border-width': 2,
      'border-style': 'dotted',
      'border-color': 'hsl(var(--primary))',
      'background-color': 'hsl(var(--primary) / 0.15)',
      'color': 'hsl(var(--primary-foreground))',
      'text-outline-color': 'hsl(var(--background) / 0.8)'
    }
  },
  {
    selector: 'node.account',
    css: {
      'shape': 'round-rectangle',
      'background-color': 'hsl(var(--card))',
      'border-color': 'hsl(var(--border))',
      'border-width': 1,
      'width': '120px',
      'height': '32px',
      'font-size': '11px',
      'color': 'hsl(var(--card-foreground))',
      'text-outline-color': 'hsl(var(--background) / 0.8)'
    }
  },
  {
    selector: 'node.transaction',
    css: {
      'shape': 'ellipse',
      'background-color': 'hsl(var(--primary))',
      'border-color': 'hsl(var(--border))',
      'border-width': 2,
      'width': '48px',
      'height': '48px',
      'font-size': '11px'
    }
  },
  // Transaction type coloring
  {
    selector: 'node[txType = "spl_transfer"]',
    css: {
      'background-color': 'hsl(var(--primary))'
    }
  },
  {
    selector: 'node[txType = "sol_transfer"]',
    css: {
      'background-color': 'hsl(var(--success))'
    }
  },
  {
    selector: 'node[txType = "defi"]',
    css: {
      'background-color': 'hsl(var(--warning))'
    }
  },
  {
    selector: 'node[txType = "nft"]',
    css: {
      'background-color': 'hsl(var(--primary))'
    }
  },
  {
    selector: 'node[isFunding = "true"]',
    css: {
      'border-width': 3,
      'border-color': 'hsl(var(--warning))'
    }
  },
  {
    selector: 'node.transaction.success',
    css: {
      'background-color': 'hsl(var(--success))',
      'border-color': 'hsl(var(--border))'
    }
  },
  {
    selector: 'node.transaction.error',
    css: {
      'background-color': 'hsl(var(--destructive))',
      'border-color': 'hsl(var(--border))'
    }
  },
  {
    selector: 'node.new-transaction',
    css: {
      'background-color': 'hsl(var(--primary))',
      'border-width': 3,
      'border-color': 'hsl(var(--primary))'
    }
  },
  {
    selector: 'node.tracked-address',
    css: {
      'background-color': 'hsl(var(--warning))',
      'border-width': 3,
      'border-color': 'hsl(var(--warning))'
    }
  },
  {
    selector: 'node.highlighted',
    css: {
      'border-width': 4,
      'border-color': 'hsl(var(--warning))',
      'background-color': 'hsl(var(--warning))',
      'text-outline-color': 'hsl(var(--background) / 0.8)',
      'text-outline-width': 2,
      'z-index': 100
    }
  },
  {
    selector: 'node.active',
    css: {
      'border-width': 4,
      'border-color': 'hsl(var(--primary))',
      'background-color': 'hsl(var(--primary))',
      'text-outline-color': 'hsl(var(--background) / 0.8)',
      'text-outline-width': 2,
      'z-index': 999
    }
  },
  {
    selector: 'edge',
    css: {
      'width': 2,
      'line-color': 'hsl(var(--muted-foreground))',
      'target-arrow-color': 'hsl(var(--muted-foreground))',
      'target-arrow-shape': 'triangle',
      'curve-style': 'straight',
      'opacity': 0.7,
      'arrow-scale': 1.1,
      'line-cap': 'round'
    }
  },
  // Edge color by transaction type attached on edge data.txType
  {
    selector: 'edge[txType = "spl_transfer"]',
    css: {
      'line-color': 'hsl(var(--primary))',
      'target-arrow-color': 'hsl(var(--primary))'
    }
  },
  {
    selector: 'edge[txType = "sol_transfer"]',
    css: {
      'line-color': 'hsl(var(--success))',
      'target-arrow-color': 'hsl(var(--success))'
    }
  },
  {
    selector: 'edge[txType = "defi"]',
    css: {
      'line-color': 'hsl(var(--warning))',
      'target-arrow-color': 'hsl(var(--warning))'
    }
  },
  {
    selector: 'edge[txType = "nft"]',
    css: {
      'line-color': 'hsl(var(--primary))',
      'target-arrow-color': 'hsl(var(--primary))'
    }
  },
  {
    selector: 'edge[isFunding = "true"]',
    css: {
      'line-style': 'solid',
      'width': 3.5,
      'line-color': 'hsl(var(--warning))',
      'target-arrow-color': 'hsl(var(--warning))'
    }
  },
  {
    selector: 'edge.hover',
    css: {
      'width': 4,
      'line-color': 'hsl(var(--primary))',
      'target-arrow-color': 'hsl(var(--primary))',
      'opacity': 1,
      'arrow-scale': 1.5,
      'z-index': 10
    }
  },
  {
    selector: 'edge[type="transfer"]',
    css: {
      'width': 3.5,
      'line-color': 'hsl(var(--success))',
      'target-arrow-color': 'hsl(var(--success))',
      'label': 'data(label)',
      'font-size': '11px',
      'font-family': 'Inter, sans-serif',
      'color': 'hsl(var(--success-foreground, var(--foreground)))',
      'text-background-color': 'hsl(var(--background))',
      'text-background-opacity': 0.95,
      'text-background-padding': '4px',
      'text-border-width': 1,
      'text-border-color': 'hsl(var(--success))',
      'text-border-opacity': 0.3,
      'line-cap': 'round',
      'curve-style': 'bezier'
    }
  },
  {
    selector: 'edge.realtime-edge',
    css: {
      'width': 3,
      'line-color': 'hsl(var(--primary))',
      'target-arrow-color': 'hsl(var(--primary))',
      'line-style': 'dashed',
      'opacity': 0.9,
      'arrow-scale': 1.4
    }
  },
  {
    selector: 'edge.highlighted',
    css: {
      'width': 5,
      'line-color': 'hsl(var(--warning))',
      'target-arrow-color': 'hsl(var(--warning))',
      'z-index': 999,
      'arrow-scale': 1.8,
      'opacity': 1,
      'line-cap': 'round'
    }
  },
  // Enhanced edge styling with amount-based thickness and labels
  {
    selector: 'edge[amount]',
    css: {
      'label': 'data(label)',
      'font-size': '9px',
      'min-zoomed-font-size': 6,
      'font-family': 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      'color': 'hsl(var(--muted-foreground))',
      'text-background-color': 'hsl(var(--card))',
      'text-background-opacity': 0.95,
      'text-background-padding': 2,
      'text-border-width': 1,
      'text-border-color': 'hsl(var(--border))',
      'text-border-opacity': 0.5,
      'text-rotation': 'autorotate',
      'text-margin-y': 6,
      'text-wrap': 'wrap',
      'text-max-width': 120
    }
  },
  // Edge thickness based on transaction amount
  {
    selector: 'edge[amount >= 1000]',
    css: { 'width': 4.5 }
  },
  {
    selector: 'edge[amount >= 100]',
    css: { 'width': 3.5 }
  },
  {
    selector: 'edge[amount >= 10]',
    css: { 'width': 3 }
  },
  {
    selector: 'edge[amount >= 1]',
    css: { 'width': 2.5 }
  },
  {
    selector: 'edge[amount < 1]',
    css: { 'width': 2 }
  },
  // Direction indicators for bidirectional transactions
  {
    selector: 'edge[direction="in"]',
    css: {
      'line-style': 'solid',
      'source-arrow-shape': 'none',
      'target-arrow-shape': 'triangle'
    }
  },
  {
    selector: 'edge[direction="out"]',
    css: {
      'line-style': 'solid',
      'source-arrow-shape': 'triangle',
      'target-arrow-shape': 'none'
    }
  },
  {
    selector: 'edge[direction="bidirectional"]',
    css: {
      'line-style': 'dashed',
      'source-arrow-shape': 'triangle',
      'target-arrow-shape': 'triangle'
    }
  },
  {
    selector: '.hover',
    css: {
      'border-width': 3,
      'line-color': 'hsl(var(--primary))',
      'target-arrow-color': 'hsl(var(--primary))',
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

  // Validate container first
  if (!container || !container.parentElement) {
    throw new Error('Invalid container provided for cytoscape initialization');
  }

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

  try {
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

    // Store cytoscape instance on container for test access
    (container as any)._cytoscape = cy;
    (container as any)._cytoscapeInitialized = true;

    console.log('Cytoscape initialization completed successfully');
    return cy;
  } catch (error) {
    console.error('Cytoscape initialization failed:', error);
    (container as any)._cytoscapeError = error;
    (container as any)._cytoscapeInitialized = false;
    throw error;
  }
};