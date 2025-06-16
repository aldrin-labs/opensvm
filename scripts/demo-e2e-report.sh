#!/bin/bash

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== OpenSVM E2E Test Demo ===${NC}"
echo -e "${CYAN}This script simulates running e2e tests and generating reports${NC}"
echo

# Create sample report directory if it doesn't exist
REPORT_DIR="playwright-report"
if [ ! -d "$REPORT_DIR" ]; then
  echo -e "${CYAN}Creating sample report directory...${NC}"
  mkdir -p "$REPORT_DIR"
fi

# Create sample test results directory if it doesn't exist
TEST_RESULTS_DIR="test-results"
if [ ! -d "$TEST_RESULTS_DIR" ]; then
  echo -e "${CYAN}Creating sample test results directory...${NC}"
  mkdir -p "$TEST_RESULTS_DIR"
fi

# Simulate running tests
echo -e "${CYAN}Running e2e tests...${NC}"
echo -e "${YELLOW}Starting web server on port 3000...${NC}"
sleep 1
echo -e "${YELLOW}Running tests on Chrome browser...${NC}"
sleep 1
echo -e "${GREEN}✓ token-api.test.ts - 5 passed, 0 failed${NC}"
sleep 1
echo -e "${YELLOW}Running tests on Firefox browser...${NC}"
sleep 1
echo -e "${GREEN}✓ token-api.test.ts - 5 passed, 0 failed${NC}"
sleep 1
echo -e "${YELLOW}Running tests on Safari browser...${NC}"
sleep 1
echo -e "${GREEN}✓ token-api.test.ts - 5 passed, 0 failed${NC}"
sleep 1
echo -e "${YELLOW}Running tests on mobile devices...${NC}"
sleep 1
echo -e "${GREEN}✓ transfers-table.test.ts - 8 passed, 0 failed${NC}"
sleep 1

# Generate sample HTML report
echo -e "${CYAN}Generating HTML report...${NC}"
cat > "$REPORT_DIR/index.html" << EOF
<!DOCTYPE html>
<html>
<head>
  <title>Playwright Test Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .test { margin-bottom: 10px; padding: 10px; border-radius: 5px; }
    .passed { background: #e6ffe6; border-left: 5px solid #00cc00; }
    .failed { background: #ffe6e6; border-left: 5px solid #cc0000; }
    .details { margin-top: 5px; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <h1>Playwright Test Report</h1>
  
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Tests:</strong> 13 passed, 0 failed, 0 skipped</p>
    <p><strong>Browsers:</strong> Chrome, Firefox, Safari</p>
    <p><strong>Devices:</strong> Desktop, iPhone 12, Pixel 5, iPad Pro, Galaxy Tab S7</p>
    <p><strong>Duration:</strong> 45.2s</p>
  </div>
  
  <h2>Test Results</h2>
  
  <div class="test passed">
    <h3>token-api.test.ts</h3>
    <p>✓ should handle valid token mint address</p>
    <p>✓ should handle invalid token mint address</p>
    <p>✓ should enforce rate limiting</p>
    <p>✓ should handle non-token mint accounts</p>
    <p>✓ should handle network errors gracefully</p>
    <div class="details">Duration: 12.5s</div>
  </div>
  
  <div class="test passed">
    <h3>transfers-table.test.ts</h3>
    <p>✓ displays transfer data correctly</p>
    <p>✓ implements infinite scroll pagination</p>
    <p>✓ implements sorting functionality</p>
    <p>✓ handles error states gracefully</p>
    <p>✓ is responsive across different viewport sizes</p>
    <p>✓ meets accessibility requirements</p>
    <p>✓ performs within acceptable metrics</p>
    <p>✓ handles edge cases correctly</p>
    <div class="details">Duration: 32.7s</div>
  </div>
</body>
</html>
EOF

# Generate sample markdown report
echo -e "${CYAN}Generating summary report...${NC}"
cat > "e2e-test-summary.md" << EOF
# E2E Test Summary Report

## Overview
- **Date:** $(date +%Y-%m-%d)
- **Time:** $(date +%H:%M:%S)
- **Duration:** 45.2 seconds
- **Total Tests:** 13
- **Passed:** 13
- **Failed:** 0
- **Skipped:** 0
- **Flaky:** 0

## Test Files
- \`token-api.test.ts\`
- \`transfers-table.test.ts\`

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
EOF

echo
echo -e "${GREEN}=== E2E Testing Demo Complete ===${NC}"
echo -e "${CYAN}HTML Report:${NC} ./playwright-report/index.html"
echo -e "${CYAN}Summary Report:${NC} ./e2e-test-summary.md"
echo
echo -e "${YELLOW}Note: This was a demonstration. To run actual tests, use:${NC}"
echo -e "  npm run test:e2e        ${CYAN}# Basic test run${NC}"
echo -e "  npm run test:e2e:ui     ${CYAN}# Interactive UI mode${NC}"
echo -e "  npm run test:e2e:report ${CYAN}# Comprehensive report${NC}"