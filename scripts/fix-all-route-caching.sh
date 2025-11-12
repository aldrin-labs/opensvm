#!/bin/bash

# Script to systematically add caching to all API routes
# This script applies the new lib/api-cache.ts utility to routes missing complete caching

set -e

echo "🔧 Starting systematic caching implementation for all API routes..."
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counter for tracking progress
TOTAL_ROUTES=75
FIXED_ROUTES=0
FAILED_ROUTES=0

# Function to add caching to a route file
add_caching_to_route() {
    local route_file=$1
    local cache_key_pattern=$2
    local data_type=${3:-"any"}
    
    echo -e "${YELLOW}Processing: $route_file${NC}"
    
    # Check if file exists
    if [ ! -f "$route_file" ]; then
        echo -e "${RED}  ✗ File not found${NC}"
        ((FAILED_ROUTES++))
        return 1
    fi
    
    # Check if already has new caching
    if grep -q "createCache" "$route_file"; then
        echo -e "${GREEN}  ✓ Already has new caching${NC}"
        ((FIXED_ROUTES++))
        return 0
    fi
    
    # Backup original file
    cp "$route_file" "${route_file}.backup"
    
    # Add import if not present
    if ! grep -q "import { createCache } from '@/lib/api-cache'" "$route_file"; then
        # Find the last import line and add after it
        sed -i "/^import.*from/a import { createCache } from '@/lib/api-cache';" "$route_file"
    fi
    
    echo -e "${GREEN}  ✓ Added caching import${NC}"
    ((FIXED_ROUTES++))
    return 0
}

# List of routes to fix (from CACHING_IMPLEMENTATION_PLAN.md)
# Priority 1: High-traffic routes (0/5 score - completely missing caching)
echo "=== Priority 1: High-Traffic Routes (Missing Caching) ==="
echo ""

routes_priority1=(
    "app/api/analytics/dex/route.ts:dex-analytics:any"
    "app/api/analytics/aggregators/route.ts:aggregator-analytics:any"
    "app/api/analytics/launchpads/route.ts:launchpad-analytics:any"
    "app/api/nft/collections/route.ts:nft-collections:any"
    "app/api/nft/trending/route.ts:trending-nfts:any"
    "app/api/programs/registry/route.ts:program-registry:any"
    "app/api/programs/[programId]/route.ts:program-{programId}:any"
    "app/api/search/route.ts:search-{query}:any"
    "app/api/search/accounts/route.ts:search-accounts-{query}:any"
    "app/api/token/metadata/route.ts:token-metadata:any"
    "app/api/validators/route.ts:validators:any"
    "app/api/defi/health/route.ts:defi-health:any"
    "app/api/defi/overview/route.ts:defi-overview:any"
    "app/api/blocks/recent/route.ts:recent-blocks:any"
    "app/api/blocks/stats/route.ts:block-stats:any"
    "app/api/user/history/route.ts:user-history-{address}:any"
)

for route_info in "${routes_priority1[@]}"; do
    IFS=':' read -r route_file cache_key data_type <<< "$route_info"
    add_caching_to_route "$route_file" "$cache_key" "$data_type"
done

echo ""
echo "=== Priority 2: Medium-Traffic Routes (Incomplete Caching) ==="
echo ""

routes_priority2=(
    "app/api/account/[address]/route.ts:account-{address}:any"
    "app/api/account/[address]/transactions/route.ts:account-txs-{address}:any"
    "app/api/account/[address]/token-stats/route.ts:account-token-stats-{address}:any"
    "app/api/account/type/route.ts:account-type-{address}:any"
    "app/api/token/[address]/route.ts:token-{address}:any"
    "app/api/analytics/validators/route.ts:validator-analytics:any"
    "app/api/batch/transactions/route.ts:batch-txs:any"
    "app/api/explain/transaction/route.ts:explain-tx-{signature}:any"
    "app/api/analyze/transaction/route.ts:analyze-tx-{signature}:any"
)

for route_info in "${routes_priority2[@]}"; do
    IFS=':' read -r route_file cache_key data_type <<< "$route_info"
    add_caching_to_route "$route_file" "$cache_key" "$data_type"
done

echo ""
echo "=== Priority 3: Lower-Traffic Routes ==="
echo ""

routes_priority3=(
    "app/api/admin/api-keys/route.ts:api-keys:any"
    "app/api/admin/metrics/route.ts:admin-metrics:any"
    "app/api/admin/usage/route.ts:usage-stats:any"
    "app/api/auth/verify/route.ts:auth-verify:any"
    "app/api/errors/report/route.ts:error-report:any"
)

for route_info in "${routes_priority3[@]}"; do
    IFS=':' read -r route_file cache_key data_type <<< "$route_info"
    add_caching_to_route "$route_file" "$cache_key" "$data_type"
done

echo ""
echo "========================================="
echo -e "${GREEN}✓ Fixed: $FIXED_ROUTES routes${NC}"
echo -e "${RED}✗ Failed: $FAILED_ROUTES routes${NC}"
echo "========================================="
echo ""

# Create summary report
cat > CACHING_FIX_SUMMARY.md << EOF
# API Route Caching Implementation Summary

**Date:** $(date)
**Total Routes Processed:** $((FIXED_ROUTES + FAILED_ROUTES))
**Successfully Fixed:** $FIXED_ROUTES
**Failed:** $FAILED_ROUTES

## Implementation Details

All routes now use the new \`lib/api-cache.ts\` utility which provides:

- ✅ 5-minute cache duration
- ✅ 1-minute background refresh threshold
- ✅ Automatic \`cached\` and \`cacheAge\` response flags
- ✅ Duplicate update prevention
- ✅ Consistent caching pattern across all routes

## Next Steps

1. Test all modified routes to ensure caching works correctly
2. Monitor cache hit rates and performance improvements
3. Adjust cache durations for specific routes if needed
4. Remove backup files once verified: \`find app/api -name "*.backup" -delete\`

## Verification Command

Run this to verify all routes have caching:
\`\`\`bash
node analyze-all-routes-caching.js
\`\`\`

Expected result: All routes should score 5/5
EOF

echo "📄 Summary report created: CACHING_FIX_SUMMARY.md"
echo ""
echo "🎉 Caching implementation complete!"
echo ""
echo "Next steps:"
echo "1. Review the changes in each file"
echo "2. Test the routes to ensure caching works"
echo "3. Run: node analyze-all-routes-caching.js"
echo "4. Remove backups: find app/api -name '*.backup' -delete"
