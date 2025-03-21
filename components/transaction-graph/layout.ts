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
 * Animate new elements with smooth transitions
 * @param cy Cytoscape instance
 * @param elementIds Array of element IDs to animate
 * @param duration Animation duration in milliseconds
 */
export const animateNewElements = (
  cy: cytoscape.Core, 
  elementIds: string[] = [], 
  duration = 500
): void => {
  if (!elementIds.length) return;
  
  // Get elements by IDs
  const elements = cy.collection();
  elementIds.forEach(id => {
    const ele = cy.getElementById(id);
    if (ele.length > 0) {
      elements.merge(ele);
    }
  });
  
  if (elements.length === 0) return;
  
  // Set initial state for animation
  elements.style({
    'opacity': 0,
    'scale': 0.5
  });
  
  // Animate elements with staggered timing for a more natural flow
  elements.forEach((ele, i) => {
    // Stagger animations slightly for a cascade effect
    const delay = Math.min(i * 50, 500);
    
    setTimeout(() => {
      ele.animate({
        style: { 
          'opacity': 1,
          'scale': 1
        }
      }, {
        duration: duration,
        easing: 'ease-in-out-cubic'
      });
    }, delay);
  });
};

/**
 * Run incremental layout that preserves existing positions
 * @param cy Cytoscape instance
 * @param newElementIds Array of new element IDs to position
 * @param animate Whether to animate the layout changes
 */
export const runIncrementalLayout = (
  cy: cytoscape.Core, 
  newElementIds: string[] = [],
  animate = true
): void => {
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
    const layout = subgraph.layout(<DagreLayoutOptions>{
      name: 'dagre' as any,
      rankDir: 'LR',
      ranker: 'tight-tree',
      rankSep: 100,
      nodeSep: 80,
      edgeSep: 50,
      nodeDimensionsIncludeLabels: true,
      padding: 50,
      spacingFactor: 2.0,
      animate: animate,
      animationDuration: 500,
      animationEasing: 'ease-in-out-cubic',
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
    });
    
    layout.run();
    
    // Animate new elements after layout is complete
    if (animate) {
      layout.on('layoutstop', () => {
        animateNewElements(cy, newElementIds);
      });
    }
  } else {
    // Default layout behavior for all elements
    const layout = cy.layout(<DagreLayoutOptions>{
      name: 'dagre' as any,
      rankDir: 'TB', // Top to bottom layout
      ranker: 'tight-tree',
      rankSep: 200,
      nodeSep: 200,
      edgeSep: 80,
      padding: 100,
      spacingFactor: 3.0,
      animate: animate,
      animationDuration: 500,
      animationEasing: 'ease-in-out-cubic',
      fit: false,
      randomize: false,
      boundingBox: { x1: 0, y1: 0, w: cy.width(), h: cy.height() },
      nodeDimensionsIncludeLabels: true,
      // Only position nodes that don't have a position
      position: (node: any) => node.position()
    });
    
    layout.run();
  }
};

/**
 * Run full graph layout
 * @param cy Cytoscape instance
 * @param animate Whether to animate the layout changes
 */
export const runLayout = (
  cy: cytoscape.Core,
  animate = true
): void => {
  cy.layout(<DagreLayoutOptions>{
    name: 'dagre' as any,
    rankDir: 'LR', // Left to right layout
    ranker: 'network-simplex',
    rankSep: 200,
    nodeSep: 200,
    edgeSep: 80,
    padding: 100,
    spacingFactor: 1.5,
    animate: animate,
    animationDuration: 500,
    animationEasing: 'ease-in-out-cubic',
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
      'transition-property': 'background-color, border-color, border-width, opacity, scale',
      'transition-duration': '300ms'
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
      'arrow-scale': 1.5,
      'transition-property': 'line-color, target-arrow-color, opacity, width',
      'transition-duration': '300ms'
    }
  },
  {
    selector: 'edge.hover',
    css: {
      'width': 3,
      'line-color': '#90cdf4',
      'target-arrow-color': '#90cdf4',
      'opacity': 1
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
      'transition-property': 'opacity, scale',
      'transition-duration': 500
    }
  },
  {
    // Add style for elements that will pulse to draw attention
    selector: '.pulse',
    css: {
      'animation': 'pulse 1.5s ease-in-out infinite alternate'
    }
  }
];

/**
 * Initialize a Cytoscape instance with optimized settings
 * @param container HTML element to contain the graph
 * @returns Cytoscape instance
 */
export const initializeCytoscape = (container: HTMLElement): cytoscape.Core => {
  return cytoscape({
    container: container,
    style: createGraphStyle(),
    layout: getAdaptiveLayoutOptions(null as any, false), // Pass null for initial layout
    minZoom: 0.2,
    maxZoom: 3,
    wheelSensitivity: 0.2, // Reduced for smoother zooming
    motionBlur: false, // Disable motion blur for better performance
    pixelRatio: 1, // Use fixed pixel ratio instead of 'auto' for better performance
    textureOnViewport: true, // Add texture on viewport for better performance with large graphs
    hideEdgesOnViewport: true, // Hide edges during viewport changes for better performance
    hideLabelsOnViewport: true, // Hide labels during viewport changes for better performance
    styleEnabled: true, // Keep styles enabled
    autoungrabify: false, // Allow nodes to be moved
    userZoomingEnabled: true,
    userPanningEnabled: true,
    boxSelectionEnabled: false, // Disable box selection for better performance
    selectionType: 'single', // Only allow selecting one element at a time
    touchTapThreshold: 8, // Increase touch tap threshold for better mobile performance
    desktopTapThreshold: 4, // Increase desktop tap threshold for better performance
    autolock: false, // Don't lock the graph
    autopan: true, // Enable auto pan
    autounselectify: false, // Don't auto unselectify
    maxSimulationTime: 2000, // Limit simulation time for force-directed layouts
    panningEnabled: true,
    zoomingEnabled: true,
    fitPadding: 30 // Reduced from default
  });
};

/**
 * Clear layout cache
 */
export const clearLayoutCache = (): void => {
  layoutCache.clear();
};