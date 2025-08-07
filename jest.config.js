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
    "^@/(.*)$": "<rootDir>/$1"
  },
  // Explicitly exclude canvas from transformation and include ESM packages
  // Updated for better NPM dependency resolution
  transformIgnorePatterns: [
    "node_modules/(?!(uuid|@solana/web3.js|@qdrant/js-client-rest|react-markdown|remark-gfm|lucide-react|devlop|canvas|react-force-graph|react-force-graph-2d|react-force-graph-3d|hast-util-to-jsx-runtime|hast-util-whitespace|micromark|unist-util|mdast-util|remark-parse|unified|@anthropic-ai|@coral-xyz|@debridge-finance|@mlc-ai|@radix-ui|@solana|@swc|@tanstack|@vercel|@visactor|comma-separated-tokens|property-information|space-separated-tokens|web-namespaces|zwitch|bail|is-plain-obj|trough|vfile|vfile-message|extend|estree-walker|estree-util-is-identifier-name)/)"
  ],
  // Prevent Jest from loading canvas module during tests
  modulePathIgnorePatterns: [
    "<rootDir>/node_modules/canvas"
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