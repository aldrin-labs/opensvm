'use client';

import cytoscape from 'cytoscape';
import { debounce } from '@/lib/utils';
import { ViewportState } from '@/lib/graph-state-cache';
import { runLayout } from './layout';

/**
 * Focus on a specific transaction in the graph
 * @param signature Transaction signature to focus on
 * @param cyRef Reference to cytoscape instance
 * @param focusSignatureRef Reference to currently focused signature
 * @param setCurrentSignature Function to update current signature state
 * @param viewportState Current viewport state
 * @param setViewportState Function to update viewport state
 * @param expandTransactionGraph Function to expand the transaction graph
 * @param onTransactionSelect Callback for transaction selection
 * @param router Next.js router
 * @param clientSideNavigation Whether to use client-side navigation
 * @param incrementalLoad Whether to incrementally load connected nodes
 * @param preserveViewport Whether to preserve viewport position
 */
export const focusOnTransaction = async (
  signature: string,
  cyRef: React.MutableRefObject<cytoscape.Core | null>,
  focusSignatureRef: React.MutableRefObject<string>,
  setCurrentSignature: (signature: string) => void,
  viewportState: ViewportState | null,
  setViewportState: (state: ViewportState) => void,
  expandTransactionGraph: (signature: string, signal: AbortSignal) => Promise<boolean>,
  onTransactionSelect: (signature: string) => void,
  router: any,
  clientSideNavigation = true,
  incrementalLoad = false,
  preserveViewport = true
): Promise<void> => {
  const cy = cyRef.current;
  if (!cy) return;
  
  // Create abort controller for this request
  const controller = new AbortController();
  
  // Store the signature we're focusing on for this specific request lifecycle
  const targetSignature = signature;
  
  try {
    // Clear previous highlights
    cy.elements().removeClass('highlighted');
    
    // Always update focus signature and current signature state
    focusSignatureRef.current = signature;
    setCurrentSignature(signature);
    
    // Create or update transaction node immediately
    let transactionNode = cy.getElementById(signature);
    if (transactionNode.length === 0) {
      transactionNode = cy.add({ 
        data: { 
          id: signature, 
          label: signature.slice(0, 8) + '...', 
          type: 'transaction' 
        }, 
        classes: 'transaction highlight-transaction' 
      });
    }
    
    // Handle state updates and callbacks without navigation
    if (clientSideNavigation) {
      const isProgrammaticNavigation = typeof window !== 'undefined' && 
        window.sessionStorage && window.sessionStorage.getItem('programmatic_nav') === 'true';
      
      if (!isProgrammaticNavigation) {
        // Always call the transaction select handler if provided
        if (typeof onTransactionSelect === 'function') {
          onTransactionSelect(signature);
        }
        
        // No longer use router.replace to avoid page reload
        // This allows state-only updates
      }
    }
    
    // Always expand the graph if requested
    if (incrementalLoad) {
      // Let the abort signal propagate to fetch operations
      const signal = controller.signal;
      const expanded = await expandTransactionGraph(signature, signal);
      
      // Check if this request is still relevant after expansion
      if (focusSignatureRef.current !== targetSignature) {
        controller.abort();
        return;
      }
      
      // Update node classes after expansion
      transactionNode = cy.getElementById(signature);
      if (transactionNode.length > 0) {
        transactionNode.addClass('highlighted');
      }
      
      // Update viewport if expansion added new elements and we're not preserving viewport
      if (expanded && !preserveViewport) {
        const neighborhood = transactionNode.neighborhood().add(transactionNode);
        cy.animate({
          center: {
            eles: neighborhood
          },
          zoom: 1.2
        }, {
          duration: 300
        });
      }
    } else {
      // For non-incremental loads, just highlight and center
      transactionNode.addClass('highlighted');
      
      if (!preserveViewport) {
        const neighborhood = transactionNode.neighborhood().add(transactionNode);
        cy.animate({
          center: {
            eles: neighborhood
          },
          zoom: 1.2
        }, {
          duration: 300
        });
      }
    }
    
    // Restore viewport state if needed
    if (preserveViewport && viewportState) {
      cy.viewport(viewportState);
    }
  } catch (error) {
    // Only log errors if they're not from an aborted request
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error('Error focusing on transaction:', error);
    }
  } finally {
    controller.abort(); // Clean up any pending operations
  }
};

/**
 * Set up graph interaction handlers
 * @param cy Cytoscape instance
 * @param containerRef Reference to container element
 * @param focusSignatureRef Reference to currently focused signature
 * @param focusOnTransaction Function to focus on a transaction
 * @param setViewportState Function to update viewport state
 */
export const setupGraphInteractions = (
  cy: cytoscape.Core,
  containerRef: React.RefObject<HTMLDivElement>,
  focusSignatureRef: React.MutableRefObject<string>,
  focusOnTransaction: (signature: string, incrementalLoad: boolean) => void,
  setViewportState: (state: ViewportState) => void
): void => {
  // Add active state styling
  cy.style().selector(':active').style({ 'opacity': 0.7 }).update();
  
  // Remove any existing event listeners
  cy.off('tap');
  
  // Add click handler for all nodes (transactions and accounts)
  cy.on('tap', 'node', (event) => {
    // Always prevent default browser behavior to avoid page reload
    if (event.originalEvent) {
      event.originalEvent.preventDefault();
      event.originalEvent.stopPropagation();
    }
    
    const node = event.target;
    const signature = node.id();
    const nodeType = node.data('type');
    
    // Highlight the clicked node
    cy.elements().removeClass('active');
    node.addClass('active');
    
    if (nodeType === 'transaction' && signature !== focusSignatureRef.current) { 
      node.flashClass('active', 300);
      // Pass false as second parameter to avoid unnecessary reload in some cases
      focusOnTransaction(signature, true);
    }
    else if (nodeType === 'account') {
      // For account nodes, just highlight them and their connections
      node.connectedEdges().addClass('highlighted').connectedNodes().addClass('highlighted');
    }
  });
  
  // Add hover effects for nodes and edges with tooltips
  cy.on('mouseover', 'node, edge', (event) => {
    const ele = event.target;
    const originalEvent = event.originalEvent as MouseEvent;
    
    if (ele.isNode() && ele.data('type') === 'transaction') {
      containerRef.current?.style.setProperty('cursor', 'pointer');
    }
    
    if (ele.isNode() && ele.data('type') === 'transaction') {
      ele.addClass('hover');
      ele.connectedEdges().addClass('hover').connectedNodes().addClass('hover');
    }
    
    if (ele.isNode() && ele.data('type') === 'account') {
      containerRef.current?.style.setProperty('cursor', 'pointer');
      ele.addClass('hover');
      ele.connectedEdges().addClass('hover');
    }
    
    // Show tooltip with element details
    if (originalEvent) {
      showTooltip(originalEvent, ele, containerRef);
    }
  });
  
  // Remove hover effects when mouse leaves
  cy.on('mouseout', 'node, edge', () => {
    cy.elements().removeClass('hover');
    containerRef.current?.style.removeProperty('cursor');
    hideTooltip();
  });

  // Add click handler for edges
  cy.on('tap', 'edge', (event) => {
    // Always prevent default browser behavior to avoid page reload
    if (event.originalEvent) {
      event.originalEvent.preventDefault();
      event.originalEvent.stopPropagation();
    }
    
    const edge = event.target;
    
    // Highlight the edge and its connected nodes
    cy.elements().removeClass('highlighted active');
    edge.addClass('highlighted');
    edge.connectedNodes().addClass('highlighted');
    
    // If one of the connected nodes is a transaction, focus on it
    const connectedTxs = edge.connectedNodes().filter(node => node.data('type') === 'transaction');
    if (connectedTxs.length > 0) {
      const txSignature = connectedTxs[0].id();
      if (txSignature !== focusSignatureRef.current) {
        focusOnTransaction(txSignature, true);
      }
    }
  });
  
  // Enable node dragging for manual repositioning
  cy.on('drag', 'node', (event) => {
    const node = event.target;
    
    // Highlight connected edges during drag
    node.connectedEdges().addClass('highlighted');
  });
  
  // Handle end of drag
  cy.on('dragfree', 'node', (event) => {
    const node = event.target;
    
    // Remove highlights after drag
    setTimeout(() => {
      node.connectedEdges().removeClass('highlighted');
    }, 300);
  });
  
  // Track viewport changes
  cy.on('viewport', debounce(() => {
    setViewportState({
      zoom: cy.zoom(),
      pan: cy.pan()
    });
  }, 100));
  
  // Add double-click handler for zooming in
  cy.on('dblclick', (event) => {
    if (event.target === cy) {
      // Double click on background - zoom in to that point
      const pos = event.position;
      cy.animate({
        zoom: cy.zoom() * 1.5,
        center: { x: pos.x, y: pos.y },
        easing: 'ease-in-out-cubic'
      }, {
        duration: 300
      });
    }
  });
  
  // Add mouse wheel handler for smoother zooming
  const wheelHandler = (event: WheelEvent) => {
    if (!containerRef.current?.contains(event.target as Node)) return;
    
    // Get mouse position relative to the container
    const containerRect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - containerRect.left;
    const y = event.clientY - containerRect.top;
    
    // Convert to graph coordinates
    const pos = cy.renderer().projectIntoViewport(x, y);
    
    // Calculate zoom factor based on wheel delta
    const delta = event.deltaY;
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    
    // Animate zoom centered on mouse position
    cy.animate({
      zoom: cy.zoom() * zoomFactor,
      center: { x: pos[0], y: pos[1] },
      easing: 'ease-out-cubic'
    }, {
      duration: 100
    });
    
    // Prevent default browser behavior
    event.preventDefault();
  };
  
  // Add wheel event listener to container
  containerRef.current?.addEventListener('wheel', wheelHandler, { passive: false });
  
  // Return cleanup function
  return () => {
    containerRef.current?.removeEventListener('wheel', wheelHandler);
  };
};

/**
 * Handle graph resizing
 * @param cyRef Reference to cytoscape instance 
 * @param preserveViewport Whether to preserve the current viewport (default: true)
 */
export const resizeGraph = (
  cyRef: React.MutableRefObject<cytoscape.Core | null>,
  preserveViewport = true
): void => {
  if (cyRef.current) {
    const cy = cyRef.current;
    
    // Save current viewport state if preserving
    const currentZoom = preserveViewport ? cy.zoom() : undefined;
    const currentPan = preserveViewport ? cy.pan() : undefined;
    
    // First resize to adjust the container dimensions
    cy.resize();
    
    // Restore viewport if preserving, otherwise center
    if (preserveViewport && currentZoom && currentPan) {
      cy.viewport({ zoom: currentZoom, pan: currentPan });
    } else {
      // Just center the graph
      setTimeout(() => cy.center(), 50);
    }
  }
};