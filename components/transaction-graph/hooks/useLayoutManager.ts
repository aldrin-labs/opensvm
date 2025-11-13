'use client';

import { useRef, useCallback, useState, useMemo } from 'react';
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

  // Simplified layout function for faster initialization
  const runLayout = useCallback((cy: cytoscape.Core | null, layoutType: string = 'dagre', forceRun: boolean = false) => {
    if (!cy || cy.nodes().length === 0) {
      debugLog('Skipping layout: no cytoscape instance or nodes');
      return Promise.resolve();
    }

    // Simplified cooldown check
    const now = Date.now();
    if (!forceRun && (now - lastLayoutTime.current) < 500) {
      debugLog('Layout on cooldown, skipping');
      return Promise.resolve();
    }

    // Abort any running layout
    if (layoutAbortControllerRef.current) {
      layoutAbortControllerRef.current.abort();
    }

    return new Promise<void>((resolve, reject) => {
      layoutAbortControllerRef.current = new AbortController();
      const abortController = layoutAbortControllerRef.current;

      setIsLayoutRunning(true);
      lastLayoutTime.current = now;

      debugLog(`Running ${layoutType} layout with ${cy.nodes().length} nodes and ${cy.edges().length} edges`);

      try {
        const layoutConfig: any = {
          name: layoutType,
          nodeDimensionsIncludeLabels: true,
          animate: false, // Disable animation for faster rendering
          randomize: false,
          fit: true,
          padding: 30,
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
          layoutConfig.rankDir = 'TB'; // Top-to-bottom: inflows above, outflows below
          layoutConfig.nodeSep = 80;
          layoutConfig.rankSep = 120;
          layoutConfig.edgeSep = 40;
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

      } catch (error) {
        setIsLayoutRunning(false);
        errorLog('Layout error:', error);
        reject(error);
      }
    });
  }, []);

  // Debounced layout runner
  const debouncedLayout = useMemo(
    () => debounce((cy: cytoscape.Core | null, layoutType: string = 'dagre') => {
      runLayout(cy, layoutType, false);
    }, 500),
    [runLayout] // Include runLayout in dependencies
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
