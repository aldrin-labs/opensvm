/**
 * Jest configuration for AI/ML module testing
 */

module.exports = {
  displayName: 'AI/ML Engine Tests',
  testMatch: [
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/**/__tests__/**/*.test.ts'
  ],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  
  // TypeScript configuration
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../$1',
    '^@ai/(.*)$': '<rootDir>/$1'
  },
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js',
    '!jest.setup.ts'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    },
    './predictive-analytics.ts': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85
    },
    './sentiment-analysis.ts': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85
    },
    './portfolio-optimization.ts': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85
    },
    './automated-research.ts': {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },
  
  // Test timeouts
  testTimeout: 30000, // 30 seconds for complex ML operations
  
  // Performance and optimization
  maxWorkers: '50%',
  cache: true,
  
  // Test reporting
  verbose: true,
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './coverage/html-report',
      filename: 'report.html',
      expand: true
    }]
  ],
  
  // Mock configurations
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  
  // Global variables
  globals: {
    'ts-jest': {
      isolatedModules: true
    },
    AI_ML_TEST_MODE: true,
    AI_ML_MOCK_DATA: true
  }
};