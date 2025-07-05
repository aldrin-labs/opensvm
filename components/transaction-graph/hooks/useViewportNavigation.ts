'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import cytoscape from 'cytoscape';
import { ViewportState, GraphStateCache } from '@/lib/graph-state-cache';
import { debounce } from '@/lib/utils';
import { debugLog } from '../';

interface UseViewportNavigationProps {
  cyRef: React.MutableRefObject<cytoscape.Core | null>;
  viewportState: ViewportState | null;
  setViewportState: (state: ViewportState) => void;
  currentSignature: string;
  clientSideNavigation: boolean;
  onTransactionSelect: (signature: string) => void;
}

interface UseViewportNavigationReturn {
  handleNodeClick: (address: string, loadingKey: string) => void;
  updateViewportState: () => void;
  focusSignatureRef: React.MutableRefObject<string>;
}

/**
 * Custom hook for managing viewport state and navigation
 * Handles graph viewport changes, node interactions, and navigation history
 */
export function useViewportNavigation({
  cyRef,
  viewportState,
  setViewportState,
  currentSignature,
  clientSideNavigation,
  onTransactionSelect
}: UseViewportNavigationProps): UseViewportNavigationReturn {
  const router = useRouter();
  const focusSignatureRef = useRef<string>('');

  // Update viewport state with debouncing for performance
  const updateViewportState = useCallback(debounce(() => {
    const cy = cyRef.current;
    if (!cy) return;

    try {
      const newViewportState: ViewportState = {
        zoom: cy.zoom(),
        pan: cy.pan(),
        extent: cy.extent(),
        center: {
          x: cy.width() / 2,
          y: cy.height() / 2
        }
      };

      setViewportState(newViewportState);
      
      // Cache the viewport state
      if (currentSignature) {
        GraphStateCache.saveViewportState(currentSignature, newViewportState);
      }
      
      debugLog('🔄 [VIEWPORT] Viewport state updated', newViewportState);
    } catch (error) {
      console.error('Error updating viewport state:', error);
    }
  }, 250), [cyRef, setViewportState, currentSignature]); // 250ms delay to reduce overhead from frequent pan/zoom events

  // Handle node click with proper navigation
  const handleNodeClick = useCallback((address: string, loadingKey: string) => {
    debugLog(`🔍 [CLICK] Node clicked: ${address}`);
    
    try {
      const cy = cyRef.current;
      if (!cy) return;

      // Check if it's a transaction node
      const clickedNode = cy.getElementById(address);
      if (!clickedNode.length) return;

      const nodeType = clickedNode.data('type');
      
      if (nodeType === 'transaction') {
        debugLog(`🔄 [NAV] Navigating to transaction: ${address}`);
        
        // Update the signature and trigger callback
        focusSignatureRef.current = address;
        onTransactionSelect(address);
        
        // Navigate if using client-side navigation
        if (clientSideNavigation) {
          // Mark as programmatic navigation to avoid loops
          sessionStorage.setItem('programmatic_nav', 'true');
          router.push(`/tx/${address}`);
          
          // Clear the flag after navigation
          setTimeout(() => {
            sessionStorage.removeItem('programmatic_nav');
          }, 100);
        }
        
        // Save the current state before navigation
        if (currentSignature) {
          const currentViewportState: ViewportState = {
            zoom: cy.zoom(),
            pan: cy.pan(),
            extent: cy.extent(),
            center: {
              x: cy.width() / 2,
              y: cy.height() / 2
            }
          };
          GraphStateCache.saveViewportState(currentSignature, currentViewportState);
        }
      } else if (nodeType === 'account') {
        debugLog(`🔍 [ACCOUNT] Account node clicked: ${address}`);
        
        // For account nodes, we could expand to show more transactions
        // This could trigger account expansion logic if needed
        const accountElement = cy.getElementById(address);
        if (accountElement.length) {
          // Highlight the account
          cy.elements().removeClass('highlighted');
          accountElement.addClass('highlighted');
          
          // Center on the account
          cy.center(accountElement);
        }
      }
    } catch (error) {
      console.error(`Error handling node click for ${address}:`, error);
    }
  }, [cyRef, router, clientSideNavigation, onTransactionSelect, currentSignature]);

  // Set up viewport change tracking
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    // Track viewport changes with debounced updates for performance
    cy.on('pan zoom', updateViewportState);
    
    return () => {
      if (cy) {
        cy.removeListener('pan zoom', updateViewportState);
      }
    };
  }, [cyRef, updateViewportState]);

  return {
    handleNodeClick,
    updateViewportState,
    focusSignatureRef
  };
}