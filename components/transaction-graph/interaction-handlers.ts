'use client';

import cytoscape from 'cytoscape';
import { debounce } from '@/lib/utils';
import { ViewportState } from '@/lib/graph-state-cache';
import { gpuThrottle, optimizeCytoscapeContainer } from './gpu-utils';

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
export async function focusOnTransaction(
  signature: string,
  cyRef: React.MutableRefObject<cytoscape.Core | null>,
  focusSignatureRef: React.MutableRefObject<string>,
  setCurrentSignature: (signature: string) => void,
  viewportState: ViewportState | null,
  _setViewportState: (state: ViewportState) => void,
  expandTransactionGraph: (signature: string, signal: AbortSignal) => Promise<boolean>,
  onTransactionSelect: (signature: string) => void,
  _router: any,
  clientSideNavigation = true,
  incrementalLoad = false,
  preserveViewport = true
): Promise<void> {
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
 * @param onAddressTrack Optional callback for address tracking
 */
export const setupGraphInteractions = (
  cy: cytoscape.Core,
  containerRef: React.RefObject<HTMLDivElement>,
  focusSignatureRef: React.MutableRefObject<string>,
  focusOnTransaction: (signature: string, incrementalLoad: boolean) => void,
  setViewportState: (state: ViewportState) => void,
  onAddressTrack?: (address: string) => void
): void => {
  // Add active state styling
  cy.style().selector(':active').style({ 'opacity': 0.7 }).update();
  
  // Remove any existing event listeners to prevent memory leaks
  cy.off('tap mouseover mouseout pan zoom');
  
  // Apply GPU acceleration to container
  if (containerRef.current) {
    optimizeCytoscapeContainer(containerRef.current);
  }
  
  // GPU-accelerated throttle hover effects for better performance
  const throttledHoverIn = gpuThrottle((event: any) => {
    const ele = event.target;
    
    if (ele.isNode() && ele.data('type') === 'transaction') {
      containerRef.current?.style.setProperty('cursor', 'pointer');
      ele.addClass('hover');
      ele.connectedEdges().addClass('hover').connectedNodes().addClass('hover');
    }
    
    if (ele.isNode() && ele.data('type') === 'account') {
      containerRef.current?.style.setProperty('cursor', 'pointer');
      ele.addClass('hover');
      ele.connectedEdges().addClass('hover');
    }
    
    if (ele.isEdge()) {
      ele.addClass('hover');
      ele.connectedNodes().addClass('hover');
    }
  }, 60); // 60fps for smooth GPU-accelerated interactions

  const throttledHoverOut = gpuThrottle(() => {
    cy.elements().removeClass('hover');
    containerRef.current?.style.removeProperty('cursor');
  }, 60); // 60fps for smooth GPU-accelerated interactions

  // Debounce viewport state updates for better performance
  const updateViewportState = debounce(() => {
    if (cy) {
      setViewportState({
        zoom: cy.zoom(),
        pan: cy.pan()
      });
    }
  }, 250); // 250ms delay to reduce overhead from frequent pan/zoom events
  
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
      // For account nodes, navigate to account page
      const address = signature; // In this case, the ID is the address
      
      // Highlight the account and its connections
      node.connectedEdges().addClass('highlighted').connectedNodes().addClass('highlighted');
      
      // Use callback if provided, otherwise fallback to default behavior
      if (onAddressTrack) {
        onAddressTrack(address);
      } else {
        // Fallback: Navigate to account page
        if (typeof window !== 'undefined') {
          window.open(`/account/${address}`, '_blank');
        }
      }
    }
  });
  
  // Add throttled hover effects for better performance
  cy.on('mouseover', 'node, edge', throttledHoverIn);
  cy.on('mouseout', 'node, edge', throttledHoverOut);

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
    
    // If one of the connected nodes is a transaction, navigate to it
    const connectedTxs = edge.connectedNodes().filter((node: any) => node.data('type') === 'transaction');
    if (connectedTxs.length > 0) {
      const txSignature = connectedTxs[0].id();
      
      // Navigate to transaction page
      if (typeof window !== 'undefined') {
        window.open(`/tx/${txSignature}`, '_blank');
      }
      
      // Also focus on it in the current graph for visual feedback
      if (txSignature !== focusSignatureRef.current) {
        focusOnTransaction(txSignature, true);
      }
    }
  });
  
  // Track viewport changes with debounced updates for performance
  cy.on('pan zoom', updateViewportState);
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
