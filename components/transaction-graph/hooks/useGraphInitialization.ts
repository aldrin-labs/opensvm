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
    onTransactionSelect?: (signature: string) => void
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

      const cy = initializeCytoscape(container);
      
      if (!cy) {
        throw new Error('Failed to initialize cytoscape');
      }

      // Check if aborted after initialization
      if (abortController.signal.aborted) {
        cy.destroy();
        throw new Error('Initialization aborted after cytoscape creation');
      }

      cyRef.current = cy;

      // Setup interactions with dummy refs - this may need proper implementation
      const dummyContainerRef = { current: null };
      const dummyFocusSignatureRef = { current: '' };
      const dummySetViewportState = () => {};
      const wrappedOnTransactionSelect = (signature: string, _incrementalLoad: boolean) => {
        if (onTransactionSelect) {
          onTransactionSelect(signature);
        }
      };
      setupGraphInteractions(cy, dummyContainerRef, dummyFocusSignatureRef, wrappedOnTransactionSelect, dummySetViewportState);

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

  // Cleanup function
  const cleanupGraph = useCallback(() => {
    // Abort initialization if in progress
    if (initializationAbortControllerRef.current) {
      initializationAbortControllerRef.current.abort();
      initializationAbortControllerRef.current = null;
    }

    // Destroy cytoscape instance
    if (cyRef.current) {
      try {
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