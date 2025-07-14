# ADR-003: Testing Strategy

## Status
Accepted

## Context
OpenSVM is a complex application with multiple layers (frontend, API, blockchain integration) that requires comprehensive testing to ensure reliability and maintainability. The testing strategy must cover:
- Unit testing for individual components and functions
- Integration testing for component interactions
- End-to-end testing for user workflows
- Performance testing for large datasets
- Visual regression testing for UI components

## Decision
We will use Jest + Playwright as the primary testing framework combination for OpenSVM.

## Consequences

### Positive
- **Comprehensive Coverage**: Jest for unit/integration tests, Playwright for E2E tests
- **Modern Testing**: Both frameworks are actively maintained with modern features
- **TypeScript Support**: Excellent TypeScript integration and type safety
- **Cross-Browser Testing**: Playwright supports all major browsers
- **Parallel Execution**: Both frameworks support parallel test execution
- **Rich Ecosystem**: Extensive ecosystem and community support
- **CI/CD Integration**: Excellent integration with continuous integration systems

### Negative
- **Learning Curve**: Team needs to learn both testing frameworks
- **Complexity**: Managing two different testing frameworks and configurations
- **Maintenance Overhead**: Keeping both frameworks updated and configured
- **Resource Usage**: E2E tests can be resource-intensive

## Alternatives Considered

### Cypress
- **Pros**: Excellent developer experience, time-travel debugging, real browser testing
- **Cons**: Limited to Chromium-based browsers, slower execution, more complex CI setup
- **Rejection Reason**: Playwright provides better browser coverage and performance

### Vitest + Cypress
- **Pros**: Fast unit testing with Vitest, comprehensive E2E with Cypress
- **Cons**: Managing two different testing philosophies, limited browser support
- **Rejection Reason**: Jest provides better ecosystem integration

### Testing Library + Puppeteer
- **Pros**: Lightweight, flexible, good React integration
- **Cons**: More manual setup, less comprehensive E2E features
- **Rejection Reason**: Playwright provides better modern testing capabilities

## Implementation Details

### Test Structure
```
__tests__/
├── unit/
│   ├── components/
│   ├── lib/
│   └── utils/
├── integration/
│   ├── api/
│   └── pages/
└── setup/
    ├── jest.setup.ts
    └── test-utils.tsx

e2e/
├── specs/
│   ├── transaction-flow.spec.ts
│   ├── account-management.spec.ts
│   └── search-functionality.spec.ts
├── fixtures/
└── support/
    ├── page-objects/
    └── helpers/
```

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc/jest', {
      jsc: {
        transform: {
          react: {
            runtime: 'automatic'
          }
        }
      }
    }]
  },
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

### Testing Patterns

#### Unit Testing
```typescript
// Component testing
describe('TransactionTable', () => {
  it('renders transaction data correctly', () => {
    const mockTransactions = [
      { signature: '123...', status: 'confirmed', timestamp: Date.now() }
    ];
    
    render(<TransactionTable transactions={mockTransactions} />);
    
    expect(screen.getByText('123...')).toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
  });
  
  it('handles sorting correctly', () => {
    const onSort = jest.fn();
    render(<TransactionTable onSort={onSort} />);
    
    fireEvent.click(screen.getByText('Timestamp'));
    expect(onSort).toHaveBeenCalledWith('timestamp', 'desc');
  });
});

// API testing
describe('Solana API', () => {
  it('fetches account data successfully', async () => {
    const mockAccount = { lamports: 1000000, owner: 'System...' };
    jest.spyOn(connection, 'getAccountInfo').mockResolvedValue(mockAccount);
    
    const result = await getAccountData('address123');
    
    expect(result).toEqual(mockAccount);
    expect(connection.getAccountInfo).toHaveBeenCalledWith('address123');
  });
});
```

#### Integration Testing
```typescript
// Page integration testing
describe('Account Page', () => {
  it('displays account information with token balances', async () => {
    const mockAccount = createMockAccount();
    const mockTokens = createMockTokens();
    
    render(<AccountPage address="test-address" />);
    
    await waitFor(() => {
      expect(screen.getByText('Account Balance')).toBeInTheDocument();
      expect(screen.getByText('Token Holdings')).toBeInTheDocument();
    });
  });
});
```

#### E2E Testing
```typescript
// E2E testing
test('user can search for transactions', async ({ page }) => {
  await page.goto('/');
  
  await page.fill('[data-testid="search-input"]', 'test-signature');
  await page.click('[data-testid="search-button"]');
  
  await expect(page).toHaveURL(/\/tx\/test-signature/);
  await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible();
});

test('transaction visualization loads correctly', async ({ page }) => {
  await page.goto('/tx/test-signature');
  
  await expect(page.locator('[data-testid="transaction-graph"]')).toBeVisible();
  await expect(page.locator('[data-testid="transaction-nodes"]')).toHaveCount(5);
});
```

### Performance Testing
```typescript
// Performance testing
test('large dataset performance', async ({ page }) => {
  await page.goto('/tokens');
  
  // Measure initial load time
  const startTime = Date.now();
  await page.waitForLoadState('networkidle');
  const loadTime = Date.now() - startTime;
  
  expect(loadTime).toBeLessThan(3000); // 3 second max load time
  
  // Test virtual scrolling performance
  await page.evaluate(() => {
    const table = document.querySelector('[data-testid="token-table"]');
    table?.scrollTo(0, 10000);
  });
  
  await expect(page.locator('[data-testid="table-row"]')).toHaveCount(50);
});
```

## Test Categories

### 1. Unit Tests
- **Components**: Individual React component testing
- **Utilities**: Pure function testing
- **Hooks**: Custom hook testing
- **Services**: Business logic testing

### 2. Integration Tests
- **API Routes**: End-to-end API testing
- **Page Components**: Full page rendering tests
- **Component Integration**: Multi-component interaction tests

### 3. End-to-End Tests
- **User Workflows**: Complete user journey testing
- **Cross-Browser**: Browser compatibility testing
- **Performance**: Load time and responsiveness testing
- **Visual Regression**: UI consistency testing

### 4. Performance Tests
- **Load Testing**: Large dataset handling
- **Memory Usage**: Memory leak detection
- **Rendering Performance**: Frame rate and smoothness
- **Network Performance**: API response times

## CI/CD Integration

### GitHub Actions
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run unit tests
        run: npm run test
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## References
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)
- [React Testing Patterns](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

*Last Updated: 2024-01-XX*
*Next Review: 2024-06-XX*