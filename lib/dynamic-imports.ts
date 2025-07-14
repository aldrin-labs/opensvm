/**
 * Dynamic import utilities for lazy loading heavy dependencies
 * This helps reduce initial bundle size and improves build performance
 */

// Lazy load Three.js and related 3D dependencies
export const loadThreeJS = async () => {
  try {
    const [THREE, OrbitControlsModule] = await Promise.all([
      import('three'),
      import('three/examples/jsm/controls/OrbitControls.js')
    ]);
    
    return {
      THREE,
      OrbitControls: (OrbitControlsModule as any).OrbitControls
    };
  } catch (error) {
    console.warn('Three.js not available:', error);
    return { THREE: null, OrbitControls: null };
  }
};

// Lazy load chart libraries
export const loadChartLibraries = async () => {
  const [
    { Chart, registerables },
    d3,
    cytoscape
  ] = await Promise.all([
    import('chart.js'),
    import('d3'),
    import('cytoscape')
  ]);
  
  return { Chart, registerables, d3, cytoscape };
};

// Lazy load DuckDB for analytics
export const loadDuckDB = async () => {
  if (typeof window === 'undefined') {
    // Server-side: return mock for SSR
    return {
      AsyncDuckDB: null,
      isAvailable: false
    };
  }
  
  try {
    const duckdb = await import('@duckdb/duckdb-wasm');
    return {
      AsyncDuckDB: (duckdb as any).AsyncDuckDB || duckdb.default?.AsyncDuckDB,
      isAvailable: true
    };
  } catch (error) {
    console.warn('DuckDB not available:', error);
    return {
      AsyncDuckDB: null,
      isAvailable: false
    };
  }
};

// Lazy load WebLLM for AI features
export const loadWebLLM = async () => {
  if (typeof window === 'undefined') {
    return { ChatModule: null, isAvailable: false };
  }
  
  try {
    const webllm = await import('@mlc-ai/web-llm');
    return {
      ChatModule: (webllm as any).ChatModule || (webllm as any).CreateMLCEngine,
      isAvailable: true
    };
  } catch (error) {
    console.warn('WebLLM not available:', error);
    return { ChatModule: null, isAvailable: false };
  }
};

// Lazy load Canvas for server-side rendering
export const loadCanvas = async () => {
  if (typeof window !== 'undefined') {
    // Client-side: use native canvas
    return { 
      createCanvas: null, 
      isNodeCanvas: false,
      isAvailable: true 
    };
  }
  
  try {
    const canvas = await import('canvas');
    return { 
      createCanvas: canvas.createCanvas,
      isNodeCanvas: true,
      isAvailable: true
    };
  } catch (error) {
    console.warn('Node Canvas not available:', error);
    return { 
      createCanvas: null,
      isNodeCanvas: false,
      isAvailable: false
    };
  }
};

// Lazy load Puppeteer for server-side operations
export const loadPuppeteer = async () => {
  if (typeof window !== 'undefined') {
    return { puppeteer: null, isAvailable: false };
  }
  
  try {
    const puppeteer = await import('puppeteer');
    return { 
      puppeteer: puppeteer.default || puppeteer,
      isAvailable: true 
    };
  } catch (error) {
    console.warn('Puppeteer not available:', error);
    return { puppeteer: null, isAvailable: false };
  }
};

// Lazy load Solana wallet adapters (only when needed)
export const loadSolanaWallets = async () => {
  const [
    walletAdapterWallets,
    walletAdapterReact,
    walletAdapterReactUI
  ] = await Promise.all([
    import('@solana/wallet-adapter-wallets'),
    import('@solana/wallet-adapter-react'),
    import('@solana/wallet-adapter-react-ui')
  ]);
  
  return {
    ...walletAdapterWallets,
    ...walletAdapterReact,
    ...walletAdapterReactUI
  };
};

// Cache for loaded modules to avoid re-imports
const moduleCache = new Map<string, any>();

export const getCachedModule = <T>(key: string, loader: () => Promise<T>): Promise<T> => {
  if (moduleCache.has(key)) {
    return Promise.resolve(moduleCache.get(key));
  }
  
  const promise = loader().then(module => {
    moduleCache.set(key, module);
    return module;
  });
  
  return promise;
};

// Helper to check if heavy features should be enabled
export const shouldLoadHeavyFeatures = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check for user preference or performance hints
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const isSlowConnection = connection && (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g');
  
  return !isSlowConnection;
};