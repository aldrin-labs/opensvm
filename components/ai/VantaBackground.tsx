'use client';

import { useEffect, useRef } from 'react';

export function VantaBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<any>(null);
  const scriptsLoadedRef = useRef<{ three: boolean, vanta: boolean }>({
    three: false,
    vanta: false
  });

  // Safely attempt to initialize Vanta effect
  const tryInitVantaEffect = () => {
    // Only initialize if both scripts are loaded
    if (!scriptsLoadedRef.current.three || !scriptsLoadedRef.current.vanta) {
      return;
    }

    // Wait a little longer to ensure scripts are fully initialized
    setTimeout(() => {
      if (backgroundRef.current && window.VANTA && !effectRef.current) {
        try {
          console.log("Initializing VANTA.GLOBE");

          // Make sure THREE is available and properly loaded
          if (!window.THREE) {
            console.error('THREE is not available - aborting Vanta initialization');
            return;
          }

          effectRef.current = window.VANTA.GLOBE({
            el: backgroundRef.current,
            THREE: window.THREE, // Explicitly pass THREE to ensure it's used
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            scale: 1.00,
            scaleMobile: 1.00,
            color: 0xe8e8e8,
            size: 1.60,
            backgroundColor: 0x0
          });

          console.log("Vanta effect initialized successfully");
        } catch (error) {
          console.error("Vanta initialization error:", error);
        }
      }
    }, 300);
  };

  // Handle script loading and effect initialization
  useEffect(() => {
    // Only run on client side
    if (typeof document === 'undefined') return;

    // Load Three.js first
    const threeScript = document.createElement('script');
    threeScript.src = '/three.r134.min.js';
    threeScript.async = false; // Load synchronously to ensure order
    threeScript.onload = () => {
      console.log("Three.js loaded");
      scriptsLoadedRef.current.three = true;

      // Only load Vanta after Three.js is loaded
      const vantaScript = document.createElement('script');
      vantaScript.src = '/vanta.globe.min.js';
      vantaScript.async = false;
      vantaScript.onload = () => {
        console.log("Vanta.js loaded");
        scriptsLoadedRef.current.vanta = true;
        tryInitVantaEffect();
      };
      document.body.appendChild(vantaScript);
    };
    document.body.appendChild(threeScript);

    // Cleanup function
    return () => {
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={backgroundRef}
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.7 }}
      id="vanta-globe-background"
    />
  );
}

declare global {
  interface Window {
    THREE: any;
    VANTA: {
      GLOBE: (options: {
        el: HTMLElement;
        THREE?: any;
        mouseControls: boolean;
        touchControls: boolean;
        gyroControls: boolean;
        minHeight: number;
        minWidth: number;
        scale: number;
        scaleMobile: number;
        color: number;
        size: number;
        backgroundColor: number;
      }) => {
        destroy: () => void;
      };
    };
  }
}
