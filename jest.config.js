/**
 * Custom Jest configuration to resolve dependency conflicts
 * between canvas and jest-environment-jsdom
 */
module.exports = {
  // Using the configuration from package.json and extending it
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          transform: {
            react: {
              runtime: "automatic"
            }
          }
        }
      }
    ]
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Map relative .js imports to .ts files in api/src (for ESM compatibility)
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // Mock problematic ESM modules
    "^react-markdown$": "<rootDir>/__mocks__/react-markdown.js",
    "^react-force-graph-3d$": "<rootDir>/__mocks__/react-force-graph-3d.js",
    "^react-force-graph-2d$": "<rootDir>/__mocks__/react-force-graph-2d.js",
    "^micromark(.*)$": "<rootDir>/__mocks__/micromark.js",
    "^remark-gfm$": "<rootDir>/__mocks__/remark-gfm.js"
  },
  // Explicitly exclude canvas from transformation and include ESM packages
  // Updated for better NPM dependency resolution
  transformIgnorePatterns: [
    "node_modules/(?!(uuid|@solana/web3.js|@solana-mobile|@solana/wallet-adapter-react|@qdrant/js-client-rest|react-markdown|remark-gfm|lucide-react|devlop|canvas|react-force-graph|react-force-graph-2d|react-force-graph-3d|hast-util-to-jsx-runtime|hast-util-whitespace|micromark|micromark-util-chunked|micromark-util-combine-extensions|micromark-util-character|micromark-util-decode-numeric-character-reference|micromark-util-decode-string|micromark-util-normalize-identifier|micromark-util-resolve-all|micromark-util-sanitize-uri|micromark-util-subtokenize|micromark-util-symbol|micromark-util-types|micromark-util-encode|micromark-util-html-tag-name|micromark-util-classify-character|micromark-extension-gfm|micromark-extension-gfm-autolink-literal|micromark-extension-gfm-footnote|micromark-extension-gfm-strikethrough|micromark-extension-gfm-table|micromark-extension-gfm-tagfilter|micromark-extension-gfm-task-list-item|unist-util|unist-util-position|unist-util-stringify-position|unist-util-visit|unist-util-is|mdast-util|mdast-util-from-markdown|mdast-util-to-string|mdast-util-gfm|mdast-util-gfm-autolink-literal|mdast-util-gfm-footnote|mdast-util-gfm-strikethrough|mdast-util-gfm-table|mdast-util-gfm-task-list-item|remark-parse|unified|@anthropic-ai|@coral-xyz|@debridge-finance|@mlc-ai|@radix-ui|@solana|@swc|@tanstack|@vercel|@visactor|comma-separated-tokens|property-information|space-separated-tokens|web-namespaces|zwitch|bail|is-plain-obj|trough|vfile|vfile-message|extend|estree-walker|estree-util-is-identifier-name|html-url-attributes|react-kapsule|decode-named-character-reference)/)"
  ],
  // Prevent Jest from loading canvas module during tests
  modulePathIgnorePatterns: [
    "<rootDir>/node_modules/canvas",
    "<rootDir>/.next"
  ],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/e2e/",
    "<rootDir>/__tests__/e2e/",
    ".*\\.spec\\.ts$"
  ],
  // Handle peer dependency conflicts
  resolver: undefined,
  // Remove duplicate testTimeout (handled below)
  // Global setup for better ESM handling
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  // Using @swc/jest instead of ts-jest, so removing ts-jest globals
  // Custom timeout for specific test patterns
  testTimeout: 45000, // Increased for AI tests
  // Better memory management
  maxWorkers: '50%',
  detectOpenHandles: true,
  detectLeaks: false, // Disable leak detection to prevent false positives
  forceExit: true, // Force exit to prevent hanging tests
  clearMocks: true, // Clear mocks between tests
  restoreMocks: true // Restore mocks between tests
};