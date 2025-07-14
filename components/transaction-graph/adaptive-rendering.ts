'use client';

import { createLogger } from '@/lib/debug-logger';

/**
 * VR and WebGPU capability detection and fallback utilities
 * Future-proofing for next-generation visualization technologies
 */

const logger = createLogger('ADAPTIVE_RENDERING');

interface VRCapabilities {
  hasVRSupport: boolean;
  hasWebXRSupport: boolean;
  supportedSessionModes: string[];
}

interface WebGPUCapabilities {
  hasWebGPUSupport: boolean;
  adapter: any | null; // Using any for now to avoid type conflicts
  device: any | null;
}

interface FallbackOptions {
  enableVRFallback: boolean;
  enableWebGPUFallback: boolean;
  preferVR: boolean;
  preferWebGPU: boolean;
}

/**
 * Detect VR capabilities in the current environment
 */
export async function detectVRCapabilities(): Promise<VRCapabilities> {
  const capabilities: VRCapabilities = {
    hasVRSupport: false,
    hasWebXRSupport: false,
    supportedSessionModes: []
  };

  if (typeof window === 'undefined') {
    return capabilities;
  }

  try {
    // Check for WebXR support
    if ('xr' in navigator && navigator.xr) {
      capabilities.hasWebXRSupport = true;
      
      // Check supported session modes
      const sessionModes = ['immersive-vr', 'immersive-ar', 'inline'];
      for (const mode of sessionModes) {
        try {
          const isSupported = await navigator.xr.isSessionSupported(mode as XRSessionMode);
          if (isSupported) {
            capabilities.supportedSessionModes.push(mode);
          }
        } catch (error) {
          console.warn(`Failed to check VR session mode ${mode}:`, error);
        }
      }
      
      capabilities.hasVRSupport = capabilities.supportedSessionModes.length > 0;
    }
  } catch (error) {
    console.warn('Error detecting VR capabilities:', error);
  }

  return capabilities;
}

/**
 * Detect WebGPU capabilities in the current environment
 */
export async function detectWebGPUCapabilities(): Promise<WebGPUCapabilities> {
  const capabilities: WebGPUCapabilities = {
    hasWebGPUSupport: false,
    adapter: null,
    device: null
  };

  if (typeof window === 'undefined') {
    return capabilities;
  }

  try {
    // Check for WebGPU support
    if ('gpu' in navigator && (navigator as any).gpu) {
      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (adapter) {
        capabilities.adapter = adapter;
        capabilities.hasWebGPUSupport = true;

        // Try to get a device for more advanced features
        try {
          const device = await adapter.requestDevice({
            requiredFeatures: [],
            requiredLimits: {}
          });
          capabilities.device = device;
        } catch (error) {
          console.warn('WebGPU adapter available but device creation failed:', error);
        }
      }
    }
  } catch (error) {
    console.warn('Error detecting WebGPU capabilities:', error);
  }

  return capabilities;
}

/**
 * Determine the best rendering approach based on capabilities and preferences
 */
export async function selectOptimalRenderingMode(options: FallbackOptions = {
  enableVRFallback: true,
  enableWebGPUFallback: true,
  preferVR: false,
  preferWebGPU: true
}): Promise<{
  mode: 'webgl' | 'webgpu' | 'vr' | 'canvas';
  capabilities: {
    vr: VRCapabilities;
    webgpu: WebGPUCapabilities;
  };
  recommended: string;
}> {
  const [vrCapabilities, webgpuCapabilities] = await Promise.all([
    detectVRCapabilities(),
    detectWebGPUCapabilities()
  ]);

  let mode: 'webgl' | 'webgpu' | 'vr' | 'canvas' = 'webgl';
  let recommended = 'Using WebGL as the primary rendering mode';

  // Determine optimal rendering mode based on capabilities and preferences
  if (options.preferVR && vrCapabilities.hasVRSupport && options.enableVRFallback) {
    mode = 'vr';
    recommended = 'VR mode available and preferred - enhanced immersive visualization';
  } else if (options.preferWebGPU && webgpuCapabilities.hasWebGPUSupport && options.enableWebGPUFallback) {
    mode = 'webgpu';
    recommended = 'WebGPU available - high-performance compute shaders for graph processing';
  } else if (webgpuCapabilities.hasWebGPUSupport && options.enableWebGPUFallback) {
    mode = 'webgpu';
    recommended = 'WebGPU fallback enabled - better performance than WebGL';
  } else if (vrCapabilities.hasVRSupport && options.enableVRFallback) {
    mode = 'vr';
    recommended = 'VR fallback available - option for immersive graph exploration';
  } else {
    // Check for WebGL support as final fallback
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        mode = 'canvas';
        recommended = 'WebGL not available - falling back to 2D canvas rendering';
      }
    } catch (error) {
      mode = 'canvas';
      recommended = 'WebGL error detected - using canvas fallback';
    }
  }

  return {
    mode,
    capabilities: {
      vr: vrCapabilities,
      webgpu: webgpuCapabilities
    },
    recommended
  };
}

/**
 * Create a future-proof rendering context that can adapt to new technologies
 */
export class AdaptiveRenderingContext {
  private currentMode: 'webgl' | 'webgpu' | 'vr' | 'canvas';
  private capabilities: {
    vr: VRCapabilities;
    webgpu: WebGPUCapabilities;
  };

  constructor(
    mode: 'webgl' | 'webgpu' | 'vr' | 'canvas',
    capabilities: { vr: VRCapabilities; webgpu: WebGPUCapabilities }
  ) {
    this.currentMode = mode;
    this.capabilities = capabilities;
  }

  getCurrentMode(): string {
    return this.currentMode;
  }

  canUpgrade(): boolean {
    if (this.currentMode === 'canvas' && this.capabilities.webgpu.hasWebGPUSupport) {
      return true;
    }
    if (this.currentMode === 'webgl' && this.capabilities.webgpu.hasWebGPUSupport) {
      return true;
    }
    if (this.currentMode !== 'vr' && this.capabilities.vr.hasVRSupport) {
      return true;
    }
    return false;
  }

  getUpgradeRecommendation(): string | null {
    if (this.currentMode === 'canvas' && this.capabilities.webgpu.hasWebGPUSupport) {
      return 'WebGPU available - significant performance improvement possible';
    }
    if (this.currentMode === 'webgl' && this.capabilities.webgpu.hasWebGPUSupport) {
      return 'WebGPU available - better compute performance for complex graphs';
    }
    if (this.currentMode !== 'vr' && this.capabilities.vr.hasVRSupport) {
      return 'VR/AR available - immersive graph exploration possible';
    }
    return null;
  }

  /**
   * Future extension point for new rendering technologies
   */
  async checkForNewCapabilities(): Promise<boolean> {
    // This method can be extended to check for new WebXR features,
    // WebGPU extensions, or other emerging technologies
    return false;
  }
}

/**
 * Initialize the adaptive rendering system
 */
export async function initializeAdaptiveRendering(
  options?: FallbackOptions
): Promise<AdaptiveRenderingContext> {
  const result = await selectOptimalRenderingMode(options);
  
  logger.info(`${result.recommended}`);
  
  if (result.capabilities.vr.hasVRSupport) {
    logger.debug(`VR support detected - ${result.capabilities.vr.supportedSessionModes.join(', ')} modes available`);
  }
  
  if (result.capabilities.webgpu.hasWebGPUSupport) {
    logger.debug(`WebGPU support detected - high-performance compute available`);
  }

  return new AdaptiveRenderingContext(result.mode, result.capabilities);
}