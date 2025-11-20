#!/bin/bash
# OpenSVM API Key Creation Script for osvm.ai
# Usage: ./create-api-key.sh "Key Name"

API_BASE_URL="https://osvm.ai/api"
API_KEY_NAME="${1:-OpenSVM API Key}"

# Create API key
RESPONSE=$(curl -s -X POST "${API_BASE_URL}/auth/api-keys/create" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${API_KEY_NAME}\",\"generateAuthLink\":true}")

# Check success
if ! echo "$RESPONSE" | grep -q '"success":true'; then
    echo "Error: API key creation failed"
    echo "$RESPONSE"
    exit 1
fi

# Extract key and auth link (works with or without jq)
if command -v jq &> /dev/null; then
    RAW_KEY=$(echo "$RESPONSE" | jq -r '.rawKey')
    AUTH_LINK=$(echo "$RESPONSE" | jq -r '.authLink')
else
    RAW_KEY=$(echo "$RESPONSE" | grep -o '"rawKey":"[^"]*"' | cut -d'"' -f4)
    AUTH_LINK=$(echo "$RESPONSE" | grep -o '"authLink":"[^"]*"' | sed 's/"authLink":"//;s/".*//')
fi

# Output
echo "API_KEY=${RAW_KEY}"
echo "AUTH_LINK=${AUTH_LINK}"
echo ""
echo "# Save key to .env or config of your client application:"
echo "echo \"OPENSVM_API_KEY=${RAW_KEY}\" >> .env"
echo ""
echo "# Use in requests:"
echo "curl -H \"Authorization: Bearer ${RAW_KEY}\" ${API_BASE_URL}/transaction/SIGNATURE"
