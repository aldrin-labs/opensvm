#!/bin/bash
# DEX Aggregator API Test Runner
# Runs comprehensive E2E tests for the market data API

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "  DEX Aggregator API - E2E Test Suite"
echo "================================================"
echo ""

# Check if dev server is running
API_PORT="${API_PORT:-3000}"
API_URL="http://localhost:${API_PORT}"

echo "Checking if API server is running on port ${API_PORT}..."
if ! curl -s "${API_URL}/api/market-data?endpoint=ohlcv&mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263&type=1H" > /dev/null 2>&1; then
    echo -e "${RED}❌ API server not responding on port ${API_PORT}${NC}"
    echo ""
    echo "Please start the dev server first:"
    echo "  npm run dev"
    echo ""
    echo "Or specify a different port:"
    echo "  API_PORT=3004 $0"
    exit 1
fi

echo -e "${GREEN}✓ API server is running${NC}"
echo ""

# Check environment
if [ -z "$BIRDEYE_API_KEY" ]; then
    echo -e "${YELLOW}⚠ Warning: BIRDEYE_API_KEY not set in environment${NC}"
    echo "  Tests may fail if API key is not configured in .env.local"
    echo ""
fi

# Run tests
echo "Running API tests..."
echo ""

export TEST_API_URL="$API_URL"

if npm run test:api; then
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}  ✓ All tests passed!${NC}"
    echo -e "${GREEN}================================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}================================================${NC}"
    echo -e "${RED}  ❌ Some tests failed${NC}"
    echo -e "${RED}================================================${NC}"
    exit 1
fi
