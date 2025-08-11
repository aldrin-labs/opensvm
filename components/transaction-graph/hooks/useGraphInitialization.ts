'use client';

import { useRef, useCallback, useState } from 'react';
import cytoscape from 'cytoscape';
import { initializeCytoscape } from '../layout';
import { setupGraphInteractions } from '../interaction-handlers';
import { debugLog, errorLog } from '../utils';

export function useGraphInitialization() {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const isInitialized = useRef<boolean>(false);
  const isInitializingRef = useRef<boolean>(false);
  const initializationAbortControllerRef = useRef<AbortController | null>(null);

  const [isInitializing, setIsInitializing] = useState<boolean>(false);

  // Initialize graph once with enhanced race condition protection
  const initializeGraph = useCallback(async (
    container: HTMLElement,
    onTransactionSelect?: (signature: string) => void,
    onAccountSelect?: (accountAddress: string) => void,
    showAccountTooltip?: (address: string, position: { x: number; y: number }) => void,
    hideAccountTooltip?: () => void,
    showEdgeTooltip?: (signature: string, position: { x: number; y: number }) => void,
    hideEdgeTooltip?: () => void
  ) => {
    // Prevent multiple initializations
    if (isInitialized.current || isInitializingRef.current) {
      debugLog('Graph already initialized or initializing, skipping');
      return cyRef.current;
    }

    // Abort any existing initialization
    if (initializationAbortControllerRef.current) {
      initializationAbortControllerRef.current.abort();
    }

    // Create new abort controller
    initializationAbortControllerRef.current = new AbortController();
    const abortController = initializationAbortControllerRef.current;

    isInitializingRef.current = true;
    setIsInitializing(true);

    try {
      debugLog('Initializing cytoscape graph...');

      // Check if aborted before proceeding
      if (abortController.signal.aborted) {
        throw new Error('Initialization aborted');
      }

      // Add timeout protection to cytoscape initialization
      const initPromise = new Promise<cytoscape.Core>((resolve, reject) => {
        try {
          const cy = initializeCytoscape(container);
          if (!cy) {
            reject(new Error('Failed to initialize cytoscape'));
          } else {
            resolve(cy);
          }
        } catch (error) {
          reject(error);
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Cytoscape initialization timeout')), 5000);
      });

      const cy = await Promise.race([initPromise, timeoutPromise]);

      // Check if aborted after initialization
      if (abortController.signal.aborted) {
        cy.destroy();
        throw new Error('Initialization aborted after cytoscape creation');
      }

      cyRef.current = cy;

      // Setup interactions with proper refs
      const containerRef = { current: container as HTMLDivElement };
      const focusSignatureRef = { current: '' };
      const setViewportState = () => { };
      const wrappedOnTransactionSelect = (signature: string, _incrementalLoad: boolean) => {
        if (onTransactionSelect) {
          onTransactionSelect(signature);
        }
      };
      // Debug callback availability
      console.log('Setting up graph interactions with callbacks:', {
        hasTransactionCallback: !!wrappedOnTransactionSelect,
        hasAccountCallback: !!onAccountSelect
      });

      setupGraphInteractions(
        cy,
        containerRef,
        focusSignatureRef,
        wrappedOnTransactionSelect,
        setViewportState,
        onAccountSelect,
        onTransactionSelect,
        showAccountTooltip,
        hideAccountTooltip,
        showEdgeTooltip,
        hideEdgeTooltip
      );

      // Mark as initialized
      isInitialized.current = true;
      isInitializingRef.current = false;
      setIsInitializing(false);

      debugLog('Graph initialization completed successfully');
      return cy;

    } catch (error) {
      isInitializingRef.current = false;
      setIsInitializing(false);

      if (error instanceof Error && error.message.includes('aborted')) {
        debugLog('Graph initialization aborted');
        return null;
      }

      errorLog('Graph initialization failed:', error);
      throw error;
    }
  }, []);

  // Cleanup function with better DOM handling
  const cleanupGraph = useCallback(() => {
    // Abort initialization if in progress
    if (initializationAbortControllerRef.current) {
      initializationAbortControllerRef.current.abort();
      initializationAbortControllerRef.current = null;
    }

    // Destroy cytoscape instance safely
    if (cyRef.current) {
      try {
        // Clear all elements before destroying to prevent DOM conflicts
        cyRef.current.elements().remove();
        // Destroy the instance
        cyRef.current.destroy();
      } catch (error) {
        debugLog('Error destroying cytoscape:', error);
      }
      cyRef.current = null;
    }

    // Reset state
    isInitialized.current = false;
    isInitializingRef.current = false;
    setIsInitializing(false);
  }, []);

  // Reset initialization state
  const resetInitialization = useCallback(() => {
    isInitialized.current = false;
    isInitializingRef.current = false;
    setIsInitializing(false);
  }, []);

  // Check if graph is ready
  const isGraphReady = useCallback(() => {
    return isInitialized.current && cyRef.current && !isInitializingRef.current;
  }, []);

  return {
    cyRef,
    isInitialized: isInitialized.current,
    isInitializing,
    initializeGraph,
    cleanupGraph,
    resetInitialization,
    isGraphReady
  };
}