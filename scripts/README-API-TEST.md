# Comprehensive API Test Suite

A comprehensive testing script that validates all OpenSVM API endpoints with data validation, performance metrics, and detailed reporting.

## Features

✨ **Complete Coverage**: Tests all major API categories  
🔍 **Data Validation**: Validates response structure and correctness  
⚡ **Performance Metrics**: Measures latency and response sizes  
📊 **Sorted Results**: Results sorted by latency for easy performance analysis  
🎨 **Beautiful Output**: Color-coded terminal output with comprehensive reporting  
✅ **SVMAI Verification**: Special verification against CoinGecko API

## Test Coverage

The script tests **30+ API endpoints** across 7 categories:

1. **Transactions** (4 endpoints)
   - Get Transaction
   - Batch Transactions
   - AI Transaction Analysis
   - Filter Transactions

2. **Blockchain** (4 endpoints)
   - Recent Blocks
   - Specific Block
   - Block Statistics
   - Slot Information

3. **Account & Wallet** (4 endpoints)
   - Account Statistics
   - Account Transactions
   - Check Account Type
   - User History

4. **Tokens & NFTs** (4 endpoints)
   - Token Information
   - Token Metadata Batch
   - NFT Collections

5. **Analytics** (4 endpoints)
   - DeFi Overview
   - DEX Analytics
   - Validator Analytics
   - Trending Validators

6. **AI-Powered** (4 endpoints)
   - AI Question Answering
   - SVMAI Data Query
   - Similar Questions
   - Data Sources

7. **Search & Discovery** (2 endpoints)
   - Universal Search
   - Program Registry

## Installation

The script uses Node.js built-in fetch API (requires Node.js 18+):

```bash
# No additional dependencies needed!
# Just ensure you have Node.js 18 or higher
node --version
```

## Usage

### Basic Usage

Test against local development server (default: http://localhost:3000):

```bash
node scripts/comprehensive-api-test.js
```

Or use the executable:

```bash
./scripts/comprehensive-api-test.js
```

### Custom Base URL

Test against a different server:

```bash
BASE_URL=https://opensvm.com node scripts/comprehensive-api-test.js
```

### Production Testing

```bash
BASE_URL=https://opensvm.com ./scripts/comprehensive-api-test.js
```

### Staging Testing

```bash
BASE_URL=https://staging.opensvm.com ./scripts/comprehensive-api-test.js
```

## Output Format

The script provides comprehensive output in several sections:

### 1. Real-time Test Results

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Transactions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Get Transaction
   PASS | GET | Status: 200
   ⚡ Latency: 85ms | 📦 Size: 2.34 KB
   /api/transaction/5vYsYWPF...
```

### 2. Results Sorted by Latency

```
═══════════════════════════════════════════════════
📊 RESULTS SORTED BY LATENCY
═══════════════════════════════════════════════════

Rank   Latency    Size         Status   Endpoint
────────────────────────────────────────────────────
#001   42ms       1.23 KB      ✅       Slot Information
#002   85ms       2.34 KB      ✅       Get Transaction
#003   127ms      5.67 KB      ✅       Block Statistics
...
```

### 3. Performance Statistics

```
═══════════════════════════════════════════════════
⚡ PERFORMANCE STATISTICS
═══════════════════════════════════════════════════

📈 Latency Metrics:
   Average: 234ms | Min: 42ms | Max: 1523ms | P95: 890ms

📦 Response Size Metrics:
   Average: 3.45 KB | Min: 0.12 KB | Max: 25.67 KB | Total: 103.50 KB

⚡ Performance Distribution:
   Fast (<100ms): 12 (40.0%)
   Medium (100-500ms): 15 (50.0%)
   Slow (>500ms): 3 (10.0%)
```

### 4. Test Summary

```
═══════════════════════════════════════════════════
📋 TEST SUMMARY
═══════════════════════════════════════════════════

Total Tests: 30
✅ Passed: 28
❌ Failed: 2
📊 Success Rate: 93.3%

📁 Category Breakdown:
   Transactions: 4/4 (100%)
   Blockchain: 4/4 (100%)
   Account & Wallet: 3/4 (75%)
   Tokens & NFTs: 4/4 (100%)
   Analytics: 4/4 (100%)
   AI-Powered: 3/4 (75%)
   Search & Discovery: 2/2 (100%)
```

### 5. SVMAI Data Verification

```
═══════════════════════════════════════════════════
🔍 SVMAI DATA VERIFICATION
═══════════════════════════════════════════════════

Testing OpenSVM API...
Testing CoinGecko API...

✅ CoinGecko Data (Source of Truth):
   Price: $0.000234
   Market Cap: $233,456
   24h Volume: $4,052
   Latency: 342ms

📊 OpenSVM API Response:
   Latency: 1523ms
   Size: 12.34 KB

🔍 Validation Results:
   Price mentioned: ✅
   Market cap mentioned: ✅
   Volume mentioned: ✅

✅ SVMAI data verification PASSED
```

## Data Validation

Each endpoint test includes custom validation logic:

- **Transaction endpoints**: Validates signature presence
- **Block endpoints**: Validates slot/blockhash
- **Account endpoints**: Validates balance/lamports
- **Token endpoints**: Validates symbol/name/mint
- **Analytics endpoints**: Validates data structure
- **AI endpoints**: Validates answer/response presence

## Performance Ratings

Tests are categorized by latency:

- 🟢 **Fast**: < 100ms
- 🟡 **Medium**: 100-500ms
- 🔴 **Slow**: > 500ms

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed

## Interpreting Results

### Success Rate

- **90-100%**: Excellent - API is healthy
- **70-89%**: Good - Some endpoints may need attention
- **Below 70%**: Poor - Significant issues detected

### Latency Analysis

Use the sorted results to identify:
- Fastest endpoints (good for real-time features)
- Slowest endpoints (may need optimization)
- P95 latency for SLA monitoring

### Response Sizes

Monitor total data transfer:
- Helps identify bandwidth usage
- Indicates potential caching opportunities
- Reveals endpoints that may need pagination

## Troubleshooting

### Server Not Running

```
Error: fetch failed
└─ Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solution**: Start the development server first:
```bash
npm run dev
```

### Timeout Errors

```
Error: The operation was aborted due to timeout
```

**Causes**:
- AI endpoints may take longer (30s timeout)
- Network latency issues
- Server overload

**Solution**: Tests have appropriate timeouts; if persistent, check server logs.

### Validation Failures

```
❌ Get Transaction
   FAIL | GET | Status: 200
   └─ Warning: Data validation failed
```

**Causes**:
- Response structure changed
- Endpoint returning unexpected format
- Data missing expected fields

**Solution**: Check endpoint implementation and update validation logic if needed.

## Continuous Integration

### GitHub Actions

```yaml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run dev &
      - run: sleep 10
      - run: ./scripts/comprehensive-api-test.js
```

### Pre-deployment Check

```bash
#!/bin/bash
# Run before deploying
npm run build
npm start &
sleep 5
./scripts/comprehensive-api-test.js
if [ $? -eq 0 ]; then
  echo "✅ All tests passed! Safe to deploy."
else
  echo "❌ Tests failed! Do not deploy."
  exit 1
fi
```

## Extending the Tests

### Adding New Test Category

```javascript
{
  category: 'Your Category',
  tests: [
    {
      name: 'Test Name',
      method: 'GET',
      path: '/api/your-endpoint',
      validate: (data) => data && data.expectedField,
      timeout: 10000 // optional, defaults to 10s
    }
  ]
}
```

### Custom Validation

```javascript
validate: (data) => {
  // Check structure
  if (!data || !data.results) return false;
  
  // Check data types
  if (typeof data.total !== 'number') return false;
  
  // Check ranges
  if (data.total < 0) return false;
  
  return true;
}
```

## Best Practices

1. ✅ **Run before deployment**: Always run tests before deploying
2. ✅ **Monitor trends**: Track latency over time
3. ✅ **Set SLAs**: Use P95 latency for SLA monitoring
4. ✅ **Automate**: Integrate into CI/CD pipeline
5. ✅ **Regular testing**: Run daily or on every commit
6. ✅ **Alert on failures**: Set up notifications for test failures

## Related Scripts

- `verify-all-apis.js` - Legacy verification script
- `comprehensive-health-check.js` - Health monitoring
- `test-all-fixes.js` - Specific endpoint fixes verification

## Support

For issues or questions:
- Check server logs: `tail -f server.log`
- Review API docs: `/docs/api`
- File an issue: GitHub Issues

## License

MIT License - see LICENSE file for details
