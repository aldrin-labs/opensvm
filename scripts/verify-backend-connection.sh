#!/bin/bash

echo "=========================================="
echo "Anthropic API Mirror - Backend Connection Test"
echo "=========================================="
echo ""

# Check if OpenRouter API key is set
if [ -z "$OPENROUTER_API_KEY" ] && [ -z "$OPENROUTER_API_KEYS" ]; then
    echo "⚠️  WARNING: OPENROUTER_API_KEY or OPENROUTER_API_KEYS not set in environment"
    echo "   Please set one of these environment variables to test backend connectivity"
    echo ""
fi

# Test health check endpoint
echo "Testing health check endpoint..."
echo "GET http://localhost:3000/api/health/anthropic"
echo ""

response=$(curl -s -w "\n%{http_code}" http://localhost:3000/api/health/anthropic)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo "✅ Health check endpoint is working"
    echo ""
    echo "Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo "❌ Health check failed with status code: $http_code"
    echo "$body"
fi

echo ""
echo "=========================================="
echo "Testing OpenRouter backend specifically..."
echo "=========================================="
echo ""

response=$(curl -s -w "\n%{http_code}" "http://localhost:3000/api/health/anthropic?backend=openrouter&cache=false")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo "✅ OpenRouter backend check completed"
    echo ""
    echo "Response:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
    
    # Check if backend is healthy
    is_healthy=$(echo "$body" | jq -r '.isHealthy' 2>/dev/null)
    if [ "$is_healthy" = "true" ]; then
        echo ""
        echo "✅ OpenRouter backend is HEALTHY"
    else
        echo ""
        echo "⚠️  OpenRouter backend is UNHEALTHY"
        error_msg=$(echo "$body" | jq -r '.error' 2>/dev/null)
        if [ "$error_msg" != "null" ]; then
            echo "   Error: $error_msg"
        fi
    fi
else
    echo "❌ OpenRouter backend check failed with status code: $http_code"
    echo "$body"
fi

echo ""
echo "=========================================="
echo "Test complete"
echo "=========================================="
