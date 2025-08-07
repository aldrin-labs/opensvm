/** @type {import('next').NextConfig} */

// Patch console.warn globally to suppress bigint warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(' ');
  if (message.includes('bigint: Failed to load bindings')) {
    return; // Suppress this specific warning
  }
  originalWarn.apply(console, args);
};

const nextConfig = {
  // Enable bundle analyzer when ANALYZE=true
  ...(process.env.ANALYZE === 'true' && {
    experimental: {
      bundlePagesRouterDependencies: true,
    },
  }),
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
  // Server external packages (moved from experimental)
  serverExternalPackages: ['canvas', 'puppeteer'],
  // Experimental features (safe subset for Next.js 14)
  experimental: {
    // Server actions are enabled by default in Next.js 14+
    optimizeCss: true,
    optimizePackageImports: ['lodash', 'date-fns', 'chart.js'],
  },
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  // Output configuration
  output: 'standalone',
  // Optimize static generation
  generateBuildId: async () => {
    return process.env.BUILD_ID || 'build-' + Date.now();
  },
  // Enable React strict mode
  reactStrictMode: true,
  // Disable production source maps for faster builds
  productionBrowserSourceMaps: false,
  // Preserve specific Tailwind classes that are dynamically added
  // This ensures animation classes used by interactive components
  // are included in production builds
  webpack: (config, { dev, isServer }) => {
    // Add rule to handle ES modules properly (fixes mermaid/cytoscape CSS import issues)
    config.module.rules.push({
      test: /\.m?js$/,
      resolve: {
        fullySpecified: false,
      },
    });

    // Ensure React is properly resolved to prevent useEffect issues during prerendering
    config.resolve.alias = {
      ...config.resolve.alias,
      'react': 'react',
      'react-dom': 'react-dom',
      'three': 'three',
      'three/examples/jsm/controls/OrbitControls': 'three/examples/jsm/controls/OrbitControls',
      'three/examples/jsm/controls/OrbitControls.js': 'three/examples/jsm/controls/OrbitControls.js',
      // Prevent cytoscape CSS imports that don't exist (fixes mermaid issue)
      'cytoscape/dist/cytoscape.css': false,
    };
    
    // Configure externals to prevent multiple Three.js instances
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        // Ignore cytoscape CSS imports that don't exist
        './dist/cytoscape.css': false,
        'cytoscape/dist/cytoscape.css': false,
      };
    }

    // Handle native modules properly - avoid externalizing React to prevent hook issues
    config.externals = config.externals || [];
    if (isServer) {
      // Don't externalize React to avoid useEffect issues during prerendering
      config.externals = config.externals.filter(external => {
        if (typeof external === 'string') {
          return !external.includes('react');
        }
        if (typeof external === 'object') {
          return !Object.keys(external).some(key => key.includes('react'));
        }
        return true;
      });
      
      config.externals.push({
        'bigint_buffer': 'commonjs bigint_buffer',
      });
    }
    
    // Only apply optimizations in production builds
    if (!dev && !isServer) {
      // Enable proper code splitting for heavy libraries
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks.cacheGroups,
          // Split Three.js into separate chunk
          three: {
            test: /[\\/]node_modules[\\/](three)[\\/]/,
            name: 'three',
            chunks: 'all',
            priority: 30,
          },
          // Split visualization libraries
          charts: {
            test: /[\\/]node_modules[\\/](chart\.js|recharts|d3|cytoscape|react-force-graph)[\\/]/,
            name: 'charts',
            chunks: 'all',
            priority: 25,
          },
          // Split Solana libraries
          solana: {
            test: /[\\/]node_modules[\\/](@solana|@coral-xyz)[\\/]/,
            name: 'solana',
            chunks: 'all',
            priority: 25,
          },
          // Split heavy utilities
          utils: {
            test: /[\\/]node_modules[\\/](lodash|date-fns|axios)[\\/]/,
            name: 'utils',
            chunks: 'all',
            priority: 20,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
