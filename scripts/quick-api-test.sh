#!/bin/bash
# Quick API Test - Validates DEX Aggregator endpoints are working

# Note: Removed "set -e" to continue showing all test results even if some fail

API_PORT="${API_PORT:-3004}"
API_URL="http://localhost:${API_PORT}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "================================================"
echo "  Quick DEX API Validation"
echo "  Port: ${API_PORT}"
echo "================================================"
echo ""

# Test tokens
BONK="DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local check="$3"
    
    echo -n "Testing: $name ... "
    
    response=$(curl -s "$url" 2>/dev/null || echo "{}")
    
    if echo "$response" | jq -e "$check" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Response: $(echo "$response" | jq -c '.' 2>/dev/null || echo "$response")"
        ((FAILED++))
        return 1
    fi
}

# Run tests
echo -e "${BLUE}1. OHLCV Endpoints${NC}"
test_endpoint "Get OHLCV 1H" \
    "${API_URL}/api/market-data?endpoint=ohlcv&mint=${BONK}&type=1H" \
    '.success == true and (.data.items | length) > 0'

test_endpoint "Get OHLCV 15m" \
    "${API_URL}/api/market-data?endpoint=ohlcv&mint=${BONK}&type=15m" \
    '.success == true and .data != null'

test_endpoint "Technical Indicators" \
    "${API_URL}/api/market-data?endpoint=ohlcv&mint=${BONK}&type=1H" \
    '.indicators.ma7 != null and .indicators.macd != null'

echo ""
echo -e "${BLUE}2. Markets/Pools Endpoints${NC}"
test_endpoint "Get Top Pools" \
    "${API_URL}/api/market-data?endpoint=markets&mint=${BONK}" \
    '.success == true and (.pools | length) > 0'

test_endpoint "Filter by Base (USDC)" \
    "${API_URL}/api/market-data?endpoint=markets&mint=${BONK}&baseMint=${USDC}" \
    '.success == true and .filters.baseMint != null'

test_endpoint "Pool Metadata" \
    "${API_URL}/api/market-data?endpoint=markets&mint=${BONK}" \
    '.pools[0] | has("dex") and has("liquidity") and has("volume24h")'

echo ""
echo -e "${BLUE}3. Token Info${NC}"
test_endpoint "Token Overview" \
    "${API_URL}/api/market-data?endpoint=ohlcv&mint=${BONK}&type=1H" \
    '.tokenInfo != null and .tokenInfo.symbol != null'

test_endpoint "Main Pair" \
    "${API_URL}/api/market-data?endpoint=ohlcv&mint=${BONK}&type=1H" \
    '.mainPair != null and .mainPair.pair != null'

echo ""
echo "================================================"
echo -e "Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC}"
echo "================================================"
echo ""

if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi
