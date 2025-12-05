#!/bin/bash
#
# OpenSVM MCP Streaming Server - curl Examples
#
# These examples show how to interact with the streaming MCP server
# using curl for testing and scripting.
#

API_URL="${MCP_API_URL:-http://localhost:3001}"

echo "OpenSVM MCP Streaming Server - curl Examples"
echo "============================================="
echo "API URL: $API_URL"
echo ""

# 1. Health Check
echo "[1] Health Check"
echo "----------------"
curl -s "$API_URL/health" | jq .
echo ""

# 2. List Tools (JSON-RPC)
echo "[2] List Tools"
echo "--------------"
curl -s -X POST "$API_URL/" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length'
echo " tools available"
echo ""

# 3. Get Network Status
echo "[3] Get Network Status"
echo "----------------------"
curl -s -X POST "$API_URL/" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_network_status",
      "arguments": {}
    }
  }' | jq '.result.content[0].text | fromjson | {slot, blockHeight, tps}'
echo ""

# 4. Search for a Token
echo "[4] Search for USDC"
echo "-------------------"
curl -s -X POST "$API_URL/" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search",
      "arguments": {"query": "USDC"}
    }
  }' | jq '.result.content[0].text | fromjson | .suggestions[:3]'
echo ""

# 5. Get Token Metadata
echo "[5] Get USDC Token Metadata"
echo "---------------------------"
curl -s -X POST "$API_URL/" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_token_metadata",
      "arguments": {"mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"}
    }
  }' | jq '.result.content[0].text | fromjson | {name, symbol, decimals}'
echo ""

# 6. Start SSE Streaming Investigation (with timeout)
echo "[6] Start SSE Streaming Investigation (5 second sample)"
echo "-------------------------------------------------------"
echo "Run this command to start a streaming investigation:"
echo ""
echo "  curl -N -X POST '$API_URL/investigate/stream' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"target\": \"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\", \"type\": \"wallet_forensics\"}'"
echo ""
echo "Or to see events for 5 seconds:"
timeout 5 curl -N -X POST "$API_URL/investigate/stream" \
  -H "Content-Type: application/json" \
  -d '{"target": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "type": "wallet_forensics"}' 2>/dev/null || true
echo ""
echo ""

# 7. WebSocket Connection Example
echo "[7] WebSocket Connection"
echo "------------------------"
echo "Install wscat: npm install -g wscat"
echo ""
echo "Connect: wscat -c ws://localhost:3001/ws"
echo ""
echo "Then send JSON-RPC messages:"
echo '  {"jsonrpc":"2.0","id":1,"method":"tools/list"}'
echo ""

# 8. Subscribe to Investigation via SSE
echo "[8] Subscribe to Existing Investigation"
echo "---------------------------------------"
echo "  curl -N '$API_URL/stream/inv_123456'"
echo ""

echo "Done!"
