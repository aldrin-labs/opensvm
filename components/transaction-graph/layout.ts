'use client';

import cytoscape from 'cytoscape';

// Define custom layout options for dagre
type DagreLayoutOptions = cytoscape.LayoutOptions & {
  rankDir?: string;
  ranker?: string;
  rankSep?: number;
  nodeDimensionsIncludeLabels?: boolean;
};

/**
 * Run incremental layout that preserves existing positions
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
      name: 'dagre' as any,
      rankDir: 'TB', // Top to bottom layout
      ranker: 'tight-tree',
      rankSep: 80, // Reduced for incremental layout
      nodeSep: 60, // Reduced for incremental layout
      edgeSep: 40,
      nodeDimensionsIncludeLabels: true,
      padding: 40,
      spacingFactor: 1.5, // Reduced for tighter layout
      animate: false,
      animationDuration: 300,
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
    // Default layout behavior for all elements
    cy.layout(<DagreLayoutOptions>{
      name: 'dagre' as any,
      rankDir: 'TB', // Top to bottom layout
      ranker: 'tight-tree',
      rankSep: 150, // Reduced for better vertical spacing
      nodeSep: 100, // Reduced for better vertical spacing
      edgeSep: 60,
      padding: 80,
      spacingFactor: 2.0, // Reduced for tighter layout
      animate: false,
      animationDuration: 300,
      fit: false,
      randomize: false,
      boundingBox: { x1: 0, y1: 0, w: cy.width(), h: cy.height() },
      nodeDimensionsIncludeLabels: true,
      // Only position nodes that don't have a position
      position: (node: any) => node.position()
    }).run();
  }
};

/**
 * Run full graph layout
 * @param cy Cytoscape instance
 */
export const runLayout = (cy: cytoscape.Core): void => {
  cy.layout(<DagreLayoutOptions>{
    name: 'dagre' as any,
    rankDir: 'TB', // Top to bottom layout
    ranker: 'network-simplex',
    rankSep: 150, // Reduced for better vertical spacing
    nodeSep: 100, // Reduced for better vertical spacing
    edgeSep: 60,
    padding: 80,
    spacingFactor: 1.2, // Reduced for tighter layout
    animate: false,
    animationDuration: 500,
    fit: true,
    boundingBox: { x1: 0, y1: 0, w: cy.width(), h: cy.height() }
  }).run();
};

/**
 * Create the graph style
 * @returns Array of Cytoscape style objects
 */
export const createGraphStyle = (): cytoscape.StylesheetCSS[] => [
  { 
    selector: 'node',
    css: {
      'label': 'data(label)', 
      'text-valign': 'center', 
      'text-halign': 'center',
      'font-size': '14px',
      'color': '#ffffff',
      'text-outline-width': 2,
      'text-outline-color': '#333',
      'background-color': '#4a5568',
      'border-width': 1,
      'border-color': '#555',
    }
  },
  {
    selector: 'node[status="pending"]',
    css: {
      'border-width': 2,
      'border-style': 'dashed',
      'border-color': '#cbd5e0',
      'background-color': 'rgba(160, 174, 192, 0.3)'
    }
  },
  {
    selector: 'node[status="loading"]',
    css: {
      'border-width': 2,
      'border-style': 'dotted',
      'border-color': '#cbd5e0',
      'background-color': 'rgba(160, 174, 192, 0.5)'
    }
  },
  {
    selector: 'node.account',
    css: {
      'shape': 'round-rectangle',
      'background-color': '#2c5282',
      'width': '160px',
      'height': '40px',
    }
  },
  {
    selector: 'node.transaction',
    css: {
      'shape': 'diamond',
      'background-color': '#4299e1',
      'width': '45px',
      'height': '45px',
    }
  },
  {
    selector: 'node.transaction.success',
    css: {
      'background-color': '#48bb78',
    }
  },
  {
    selector: 'node.transaction.error',
    css: {
      'background-color': '#f56565',
    }
  },
  {
    selector: 'node.new-transaction',
    css: {
      'background-color': '#10b981',
      'border-width': 3,
      'border-color': '#34d399',
      'box-shadow': '0 0 20px rgba(16, 185, 129, 0.6)',
    }
  },
  {
    selector: 'node.tracked-address',
    css: {
      'background-color': '#8b5cf6',
      'border-width': 3,
      'border-color': '#a78bfa',
      'box-shadow': '0 0 20px rgba(139, 92, 246, 0.6)',
    }
  },
  {
    selector: 'node.highlighted',
    css: {
      'border-width': 4,
      'border-color': '#f6ad55',
      'background-color': '#f6e05e',
      'text-outline-color': '#000',
      'text-outline-width': 2,
      'z-index': 100,
      'transition-duration': 300
    }
  },
  {
    selector: 'node.active',
    css: {
      'border-width': 4,
      'border-color': '#4fd1c5',
      'background-color': '#38b2ac', 
      'text-outline-color': '#000',
      'text-outline-width': 2,
      'z-index': 999
    }
  },
  {
    selector: 'edge',
    css: {
      'width': 2,
      'line-color': '#718096',
      'target-arrow-color': '#718096',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'opacity': 0.9,
      'arrow-scale': 1.5
    }
  },
  {
    selector: 'edge.hover',
    css: {
      'width': 2
    }
  },
  {
    selector: 'edge[type="transfer"]',
    css: {
      'width': 3,
      'line-color': '#68d391',
      'target-arrow-color': '#9ae6b4',
      'label': 'data(label)',
      'font-size': '10px',
      'color': '#333',
      'text-background-color': '#fff',
      'text-background-opacity': 0.8,
      'text-background-padding': '2px',
    }
  },
  {
    selector: 'edge.realtime-edge',
    css: {
      'width': 3,
      'line-color': '#10b981',
      'target-arrow-color': '#34d399',
      'line-style': 'dashed',
      'opacity': 0.8,
      'animation-name': 'pulse',
      'animation-duration': '2s',
      'animation-iteration-count': 'infinite',
    }
  },
  { 
    selector: 'edge.highlighted',
    css: {
      'width': 4,
      'line-color': '#f6ad55',
      'target-arrow-color': '#f6ad55', 
      'z-index': 999,
      'arrow-scale': 1.5,
      'transition-duration': 300
    }
  },
  {
    selector: '.hover',
    css: { 
      'border-width': 2,
      'line-color': '#90cdf4',
      'target-arrow-color': '#90cdf4',
      'z-index': 10
    }
  },
  {
    // Add style for newly added elements that will fade in
    selector: '.fade-in',
    css: {
      'opacity': 0,
      'transition-property': 'opacity',
      'transition-duration': 500
    }
  }
];

/**
 * Initialize a Cytoscape instance with GPU acceleration
 * @param container HTML element to contain the graph
 * @returns Cytoscape instance
 */
export const initializeCytoscape = (container: HTMLElement): cytoscape.Core => {
  // Add GPU acceleration hints to the container
  container.style.willChange = 'transform';
  container.style.transform = 'translateZ(0)'; // Force hardware acceleration
  
  return cytoscape({
    container: container,
    style: createGraphStyle(),
    layout: <DagreLayoutOptions>{
      name: 'dagre' as any,
      rankDir: 'TB', // Top to bottom layout
      ranker: 'network-simplex',
      rankSep: 150, // Reduced for better vertical spacing
      nodeSep: 100, // Reduced for better vertical spacing
      edgeSep: 80,
      padding: 60,
      spacingFactor: 1.8 // Reduced for tighter layout
    },
    minZoom: 0.2,
    maxZoom: 3,
    wheelSensitivity: 1.0, // Using default value for consistent zoom behavior across different mice
    // Enable GPU acceleration through renderer options
    renderer: {
      name: 'canvas', // Use canvas renderer with GPU acceleration
      showFps: false,
      textureOnViewport: false,
      hideEdgesOnViewport: false,
      hideLabelsOnViewport: false,
      // Enable hardware acceleration
      motionBlur: false,
      pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    } as any,
    // Performance optimizations
    styleEnabled: true,
    hideEdgesOnViewport: false,
    hideLabelsOnViewport: false,
    textureOnViewport: false,
    motionBlur: false,
    // Enable batching for better performance
    autoungrabify: false,
    autolock: false,
    autounselectify: false,
  });
};