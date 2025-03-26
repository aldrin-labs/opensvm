#!/bin/bash

# ANSI color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== OpenSVM E2E Test Runner ===${NC}"

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo -e "${YELLOW}npx not found. Please ensure Node.js is installed.${NC}"
    exit 1
fi

# Check if TypeScript is installed
if ! command -v tsc &> /dev/null; then
    echo -e "${CYAN}Installing TypeScript...${NC}"
    npm install -g typescript
fi

# Run the TypeScript script
echo -e "${CYAN}Running E2E tests and generating report...${NC}"
npx ts-node "$(dirname "$0")/run-e2e-tests.ts"

# Check if the script executed successfully
if [ $? -eq 0 ]; then
    echo -e "${GREEN}E2E test execution completed.${NC}"
    echo -e "${CYAN}You can view the HTML report at:${NC} ./playwright-report/index.html"
    echo -e "${CYAN}Summary report available at:${NC} ./e2e-test-summary.md"
else
    echo -e "${YELLOW}E2E test execution completed with errors.${NC}"
    echo -e "${CYAN}Please check the logs above for details.${NC}"
fi