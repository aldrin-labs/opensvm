'use client';

import { useRef, useCallback, useState } from 'react';
import cytoscape from 'cytoscape';
import { debounce } from '@/lib/utils';
import { debugLog, errorLog } from '../utils';

export function useLayoutManager() {
  // Layout control refs - prevent excessive layout runs with proper debouncing
  const lastLayoutTime = useRef<number>(0);
  const layoutCooldown = useRef<boolean>(false);
  const pendingLayoutRef = useRef<NodeJS.Timeout | null>(null);
  const layoutAbortControllerRef = useRef<AbortController | null>(null);
  
  const [isLayoutRunning, setIsLayoutRunning] = useState<boolean>(false);

  // Enhanced layout function with proper debouncing and cancellation
  const runLayout = useCallback((cy: cytoscape.Core | null, layoutType: string = 'dagre', forceRun: boolean = false) => {
    if (!cy || cy.nodes().length === 0) {
      debugLog('Skipping layout: no cytoscape instance or nodes');
      return Promise.resolve();
    }

    // Check cooldown period unless forcing
    const now = Date.now();
    if (!forceRun && layoutCooldown.current && (now - lastLayoutTime.current) < 1000) {
      debugLog('Layout on cooldown, skipping');
      return Promise.resolve();
    }

    // Cancel any pending layout
    if (pendingLayoutRef.current) {
      clearTimeout(pendingLayoutRef.current);
      pendingLayoutRef.current = null;
    }

    // Abort any running layout
    if (layoutAbortControllerRef.current) {
      layoutAbortControllerRef.current.abort();
    }

    return new Promise<void>((resolve, reject) => {
      // Create new abort controller for this layout
      layoutAbortControllerRef.current = new AbortController();
      const abortController = layoutAbortControllerRef.current;

      setIsLayoutRunning(true);
      lastLayoutTime.current = now;
      layoutCooldown.current = true;

      debugLog(`Running ${layoutType} layout with ${cy.nodes().length} nodes and ${cy.edges().length} edges`);

      try {
        const layoutConfig: any = {
          name: layoutType,
          nodeDimensionsIncludeLabels: true,
          animate: true,
          animationDuration: 500,
          animationEasing: 'ease-in-out',
          randomize: false,
          fit: true,
          padding: 50,
          stop: () => {
            if (!abortController.signal.aborted) {
              setIsLayoutRunning(false);
              debugLog(`${layoutType} layout completed`);
              resolve();
            }
          }
        };

        // Dagre-specific settings
        if (layoutType === 'dagre') {
          layoutConfig.rankDir = 'LR';
          layoutConfig.nodeSep = 100;
          layoutConfig.rankSep = 150;
          layoutConfig.edgeSep = 50;
        }

        const layout = cy.layout(layoutConfig);
        
        // Handle abort
        abortController.signal.addEventListener('abort', () => {
          try {
            layout.stop();
            setIsLayoutRunning(false);
            debugLog(`${layoutType} layout aborted`);
            reject(new Error('Layout aborted'));
          } catch (error) {
            debugLog('Error aborting layout:', error);
          }
        });

        layout.run();

        // Reset cooldown after a delay
        setTimeout(() => {
          layoutCooldown.current = false;
        }, 2000);

      } catch (error) {
        setIsLayoutRunning(false);
        errorLog('Layout error:', error);
        reject(error);
      }
    });
  }, []);

  // Debounced layout runner
  const debouncedLayout = useCallback(
    debounce((cy: cytoscape.Core | null, layoutType: string = 'dagre') => {
      runLayout(cy, layoutType, false);
    }, 500),
    [runLayout]
  );

  // Cleanup function
  const cleanupLayout = useCallback(() => {
    if (pendingLayoutRef.current) {
      clearTimeout(pendingLayoutRef.current);
      pendingLayoutRef.current = null;
    }
    if (layoutAbortControllerRef.current) {
      layoutAbortControllerRef.current.abort();
      layoutAbortControllerRef.current = null;
    }
    setIsLayoutRunning(false);
  }, []);

  return {
    isLayoutRunning,
    runLayout,
    debouncedLayout,
    cleanupLayout,
    lastLayoutTime,
    layoutCooldown,
    pendingLayoutRef,
    layoutAbortControllerRef
  };
}