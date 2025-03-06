# End-to-End (E2E) Testing

This directory contains end-to-end tests for the OpenSVM application using Playwright.

## Available Tests

- `token-api.test.ts`: Tests the token API endpoints
- `transfers-table.test.ts`: Tests the transfers table component

## Running Tests

You can run the e2e tests using one of the following npm scripts:

### Basic Test Run

```bash
npm run test:e2e
```

This will run all e2e tests and generate an HTML report in the `playwright-report` directory.

### Interactive UI Mode

```bash
npm run test:e2e:ui
```

This will open the Playwright UI, allowing you to run tests interactively and debug them.

### Comprehensive Report

```bash
npm run test:e2e:report
```

This will run all e2e tests and generate:
- An HTML report in the `playwright-report` directory
- A summary markdown report at the root of the project (`e2e-test-summary.md`)

## Test Configuration

The tests are configured in `playwright.config.ts` at the root of the project. The configuration includes:

- Multiple browsers and devices (Chrome, Firefox, Safari, iPhone, Pixel, iPad, Galaxy Tab)
- Automatic web server startup
- HTML report generation

## Writing New Tests

To add a new test:

1. Create a new file in the `e2e` directory with the `.test.ts` extension
2. Import the necessary Playwright test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Write your test using the Playwright API
4. Run the tests to verify they work as expected

## Best Practices

- Keep tests independent of each other
- Use descriptive test names
- Handle async operations properly
- Test for both success and error cases
- Consider accessibility and responsive design in your tests

## Troubleshooting

If you encounter issues:

1. Check that the development server is running correctly
2. Verify that the test selectors match the current UI
3. Increase timeouts for slow operations
4. Use `test.only()` to run specific tests during debugging
5. Check the Playwright trace files for detailed execution information