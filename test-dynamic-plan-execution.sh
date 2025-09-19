#!/bin/bash

echo "🎭 Testing Enhanced Dynamic Plan Execution with Narrative"
echo "=========================================="

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Simple wallet analysis
echo -e "\n${YELLOW}Test 1: Basic Wallet Analysis${NC}"
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question": "analyze wallet So11111111111111111111111111111111111111112"}' \
  --silent | head -n 20

# Test 2: Epic mode - everything about a wallet
echo -e "\n${YELLOW}Test 2: EPIC MODE - Give me EVERYTHING${NC}"
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question": "give me everything about wallet So11111111111111111111111111111111111111112 full detailed comprehensive analysis"}' \
  --silent | head -n 50

# Test 3: Validator analysis with narrative
echo -e "\n${YELLOW}Test 3: Top Validators with Story${NC}"
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question": "show me top 20 validators"}' \
  --silent | head -n 30

# Test 4: Network performance with drama
echo -e "\n${YELLOW}Test 4: Network Performance Epic${NC}"
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question": "current network performance and TPS"}' \
  --silent | head -n 25

# Test 5: DeFi activity with Moralis
echo -e "\n${YELLOW}Test 5: DeFi & Swap Analysis (Moralis)${NC}"
curl -X POST http://localhost:3000/api/getAnswer \
  -H "Content-Type: application/json" \
  -d '{"question": "show defi swap activity for wallet 7Vbmv1jt4vyuqBZcpYPpnVhrqVe5e6ZPX6JxGKsfffJr"}' \
  --silent | head -n 30

echo -e "\n${GREEN}✅ Test suite complete!${NC}"
echo "Check server logs for narrative execution details 🎬"
