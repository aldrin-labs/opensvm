/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nextConfig = {
  typescript: {
    // Use an alternate config for type checking to ignore test-related files
    tsconfigPath: 'tsconfig.json',
    // Disable type checking in development for better performance
    // Still runs in build mode for CI/deployment safety
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
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
    minimumCacheTTL: 86400, // Increase cache TTL to 24 hours
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Disable image optimization in development for faster builds
    unoptimized: process.env.NODE_ENV === 'development',
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
      'clsx',
      'date-fns',
      'lodash',
      'zod',
      'react-chartjs-2',
      '@solana/web3.js',
      'bn.js',
      'bs58'
    ],
    // Enable server actions with increased limit
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  // Enable React strict mode
  reactStrictMode: false,
  // Disable production source maps for better performance
  productionBrowserSourceMaps: false,
  // Optimize page loading
  poweredByHeader: false,
  compress: true,
  // Enable SWC minify
  swcMinify: true,
  // Disable telemetry
  telemetry: { telemetryDisabled: true },
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
      
      // Add bundle analyzer in analyze mode
      if (process.env.ANALYZE === 'true') {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'server',
            analyzerPort: 8888,
            openAnalyzer: true,
          })
        );
      }
      
      // Optimize chunk size
      config.optimization.splitChunks.chunks = 'all';
      config.optimization.splitChunks.maxInitialRequests = 25;
      config.optimization.splitChunks.maxAsyncRequests = 25;
      config.optimization.splitChunks.minSize = 20000;
      config.optimization.splitChunks.maxSize = 244000; // 244KB chunks for better caching
      
      // Enable module concatenation
      config.optimization.concatenateModules = true;
      
      // Enable tree shaking
      config.optimization.usedExports = true;
      
      // Add minification options without TerserPlugin
      if (config.optimization.minimizer) {
        // Use existing minimizers but with optimized settings
        config.optimization.minimize = true;
      }
    }

    // Add module aliases for faster resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname,
    };

    return config;
  },
  // Add headers for better caching and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
};

export default nextConfig;