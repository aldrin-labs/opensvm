'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export function useCloudView() {
  const [isCloudView, setIsCloudView] = useState<boolean>(false);
  const cloudViewRef = useRef<HTMLDivElement>(null);

  // Cloud view functions
  const toggleCloudView = useCallback(() => {
    setIsCloudView(prev => !prev);
  }, []);

  const switchToGraphView = useCallback(() => {
    setIsCloudView(false);
  }, []);

  const switchToCloudView = useCallback(() => {
    setIsCloudView(true);
  }, []);

  // Handle cloud view resize
  useEffect(() => {
    if (isCloudView && cloudViewRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        // Handle cloud view resize if needed
      });
      
      resizeObserver.observe(cloudViewRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [isCloudView]);

  return {
    isCloudView,
    setIsCloudView,
    cloudViewRef,
    toggleCloudView,
    switchToGraphView,
    switchToCloudView
  };
}