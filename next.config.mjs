/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Use an alternate config for type checking to ignore test-related files
    tsconfigPath: 'tsconfig.json',
    // Disable type checking in development for better performance
    // Still runs in build mode for CI/deployment safety
    ignoreBuildErrors: false,
  },
  // Environment variables that should be available to the client
  env: {
    OPENSVM_RPC_LIST: process.env.OPENSVM_RPC_LIST,
    OPENSVM_RPC_LIST_2: process.env.OPENSVM_RPC_LIST_2
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
    // Enhanced image optimization settings
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Experimental features
  experimental: {
    // Enable modern optimizations
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'chart.js',
      'framer-motion',
      'react-markdown',
      'tailwind-merge',
      'clsx'
    ],
    // Enable server actions with increased limit
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  // Enable React strict mode
  reactStrictMode: false,
  // Enable production source maps for better debugging
  productionBrowserSourceMaps: true,
  // Optimize page loading
  poweredByHeader: false,
  compress: true,
  // Enable SWC minify
  swcMinify: true,
  // Add custom webpack configuration for better performance
  webpack: (config, { dev, isServer }) => {
    // Optimize CSS
    if (!dev && !isServer) {
      // Enable CSS optimization in production
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        styles: {
          name: 'styles',
          test: /\.(css|scss)$/,
          chunks: 'all',
          enforce: true,
        },
      };
    }

    return config;
  },
};

export default nextConfig;