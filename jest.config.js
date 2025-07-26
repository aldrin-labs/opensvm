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
  // Explicitly exclude canvas from transformation
  transformIgnorePatterns: [
    "node_modules/(?!(uuid|@solana/web3.js|@qdrant/js-client-rest|canvas)/)"
  ],
  // Prevent Jest from loading canvas module during tests
  modulePathIgnorePatterns: [
    "<rootDir>/node_modules/canvas"
  ],
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/e2e/"
  ],
  // Handle peer dependency conflicts
  resolver: undefined,
  // Extend timeout for complex tests
  testTimeout: 30000
};