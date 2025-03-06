import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const REPORT_DIR = path.resolve(process.cwd(), 'playwright-report');
const SUMMARY_REPORT_PATH = path.resolve(process.cwd(), 'e2e-test-summary.md');
const TEST_RESULTS_DIR = path.resolve(process.cwd(), 'test-results');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Main function to run tests and generate reports
 */
async function runTestsAndGenerateReport() {
  console.log(`${colors.bright}${colors.blue}=== Running E2E Tests ====${colors.reset}`);
  
  try {
    // Ensure directories exist
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(TEST_RESULTS_DIR)) {
      fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
    }

    // Run Playwright tests
    console.log(`${colors.cyan}Running Playwright tests...${colors.reset}`);
    const startTime = Date.now();
    
    try {
      execSync('npx playwright test', { stdio: 'inherit' });
      console.log(`${colors.green}✓ Tests completed successfully${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}⚠ Some tests failed, but continuing with report generation${colors.reset}`);
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Generate summary report
    await generateSummaryReport(duration);
    
    console.log(`\n${colors.bright}${colors.green}=== E2E Testing Complete ====${colors.reset}`);
    console.log(`${colors.cyan}HTML Report:${colors.reset} ${REPORT_DIR}/index.html`);
    console.log(`${colors.cyan}Summary Report:${colors.reset} ${SUMMARY_REPORT_PATH}`);
    
  } catch (error) {
    console.error(`${colors.red}Error running tests:${colors.reset}`, error);
    process.exit(1);
  }
}

/**
 * Generate a summary report with test statistics
 */
async function generateSummaryReport(duration: string) {
  console.log(`${colors.cyan}Generating summary report...${colors.reset}`);
  
  try {
    // Parse test results if available
    const testStats = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      duration
    };
    
    // Try to find results.json files
    const resultsFiles = findResultsFiles(TEST_RESULTS_DIR);
    
    for (const file of resultsFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const result = JSON.parse(content);
        
        if (result.suites && Array.isArray(result.suites)) {
          processTestSuites(result.suites, testStats);
        }
      } catch (e) {
        console.log(`${colors.yellow}⚠ Could not parse results file: ${file}${colors.reset}`);
      }
    }
    
    // Generate markdown report
    const reportContent = `# E2E Test Summary Report

## Overview
- **Date:** ${new Date().toISOString().split('T')[0]}
- **Time:** ${new Date().toLocaleTimeString()}
- **Duration:** ${duration} seconds
- **Total Tests:** ${testStats.total}
- **Passed:** ${testStats.passed}
- **Failed:** ${testStats.failed}
- **Skipped:** ${testStats.skipped}
- **Flaky:** ${testStats.flaky}

## Test Files
${getTestFilesList()}

## Browsers & Devices Tested
- Desktop Chrome
- Desktop Firefox
- Desktop Safari
- iPhone 12
- Pixel 5
- iPad Pro
- Galaxy Tab S7

## HTML Report
A detailed HTML report is available at: \`./playwright-report/index.html\`

## Next Steps
- Review failed tests and fix issues
- Check performance metrics in the detailed report
- Verify visual regressions if any

`;

    fs.writeFileSync(SUMMARY_REPORT_PATH, reportContent);
    console.log(`${colors.green}✓ Summary report generated${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error generating summary report:${colors.reset}`, error);
  }
}

/**
 * Process test suites to extract statistics
 */
function processTestSuites(suites: any[], stats: any) {
  for (const suite of suites) {
    if (suite.suites && Array.isArray(suite.suites)) {
      processTestSuites(suite.suites, stats);
    }
    
    if (suite.specs && Array.isArray(suite.specs)) {
      for (const spec of suite.specs) {
        stats.total++;
        
        if (spec.tests && Array.isArray(spec.tests)) {
          for (const test of spec.tests) {
            if (test.status === 'passed') {
              stats.passed++;
            } else if (test.status === 'failed') {
              stats.failed++;
            } else if (test.status === 'skipped') {
              stats.skipped++;
            }
            
            if (test.status === 'flaky') {
              stats.flaky++;
            }
          }
        }
      }
    }
  }
}

/**
 * Find results.json files in the test results directory
 */
function findResultsFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...findResultsFiles(fullPath));
    } else if (entry.name === 'results.json') {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Get a list of test files
 */
function getTestFilesList(): string {
  try {
    const e2eDir = path.resolve(process.cwd(), 'e2e');
    const files = fs.readdirSync(e2eDir)
      .filter(file => file.endsWith('.test.ts'))
      .map(file => `- \`${file}\``)
      .join('\n');
    
    return files || 'No test files found';
  } catch (error) {
    return 'Could not read test files';
  }
}

// Run the main function
runTestsAndGenerateReport().catch(console.error);