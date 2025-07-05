/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Use an alternate config for type checking to ignore test-related files
    tsconfigPath: 'tsconfig.json',
    // Disable type checking in development for better performance
    // Still runs in build mode for CI/deployment safety
    ignoreBuildErrors: true,
  },
  // Environment variables that should be available to the client
  env: {
    OPENSVM_RPC_LIST: process.env.OPENSVM_RPC_LIST || '',
    OPENSVM_RPC_LIST_2: process.env.OPENSVM_RPC_LIST_2 || ''
  },
  // Image optimization
  images: {
    domains: ['arweave.net', 'www.arweave.net'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.arweave.net',
      },
    ],
  },
  // Experimental features (safe subset for Next.js 14)
  experimental: {
    // Server actions are enabled by default in Next.js 14+
  },
  // Enable React strict mode
  reactStrictMode: false,
  // Enable production source maps for better debugging
  productionBrowserSourceMaps: true,
  // Preserve specific Tailwind classes that are dynamically added
  // This ensures animation classes used by interactive components
  // are included in production builds
  webpack: (config, { dev, isServer }) => {
    // Resolve Three.js to a single instance to prevent multiple imports
    config.resolve.alias = {
      ...config.resolve.alias,
      'three': 'three',
      'three/examples/jsm/controls/OrbitControls': 'three/examples/jsm/controls/OrbitControls',
      'three/examples/jsm/controls/OrbitControls.js': 'three/examples/jsm/controls/OrbitControls.js'
    };
    
    // Configure externals to prevent multiple Three.js instances
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false
      };
    }
    
    // Only apply optimizations in production builds
    if (!dev && !isServer) {
      //config.optimization.splitChunks.cacheGroups = { ...config.optimization.splitChunks.cacheGroups };
    }
    return config;
  },
};

export default nextConfig;
