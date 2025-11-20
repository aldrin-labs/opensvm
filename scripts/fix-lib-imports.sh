#!/bin/bash
# Script to fix imports after lib/ reorganization

set -e

ROOT="/home/larp/aldrin/opensvm"
cd "$ROOT"

echo "🔧 Fixing imports after lib/ reorganization..."
echo ""

# Function to replace imports
fix_import() {
    local old_import="$1"
    local new_import="$2"
    local file_count
    
    echo "  Updating: $old_import → $new_import"
    
    # Use find + sed for safer replacements
    find app components lib hooks contexts utils types -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
        sed -i "s|from '$old_import'|from '$new_import'|g" {} + 2>/dev/null || true
    
    find app components lib hooks contexts utils types -type f \( -name "*.ts" -o -name "*.tsx" \) -exec \
        sed -i "s|from \"$old_import\"|from \"$new_import\"|g" {} + 2>/dev/null || true
    
    file_count=$(grep -r "from ['\"]$new_import['\"]" app components lib hooks contexts utils types 2>/dev/null | wc -l || echo "0")
    echo "    ✓ Updated $file_count imports"
}

echo "📝 Fixing Solana imports..."
fix_import "@/lib/solana-connection" "@/lib/solana/solana-connection"
fix_import "@/lib/solana" "@/lib/solana/solana"

echo ""
echo "📝 Fixing token/trading imports..."
fix_import "@/lib/token-registry" "@/lib/trading/token-registry"

echo ""
echo "📝 Fixing utils imports..."
fix_import "@/lib/utils" "@/lib/utils"  # This one is already correct with barrel export

echo ""
echo "📝 Fixing transaction imports..."
fix_import "@/lib/transaction-parser" "@/lib/blockchain/transaction-parser"
fix_import "@/lib/transaction-classifier" "@/lib/blockchain/transaction-classifier"
fix_import "@/lib/transaction-metadata-enricher" "@/lib/blockchain/transaction-metadata-enricher"

echo ""
echo "📝 Fixing cache imports..."
fix_import "@/lib/token-metadata-cache" "@/lib/caching/token-metadata-cache"
fix_import "@/lib/wallet-path-cache" "@/lib/caching/wallet-path-cache"
fix_import "@/lib/transaction-cache" "@/lib/caching/transaction-cache"

echo ""
echo "📝 Fixing AI imports..."
fix_import "@/lib/ai-transaction-analyzer" "@/lib/ai/ai-transaction-analyzer"
fix_import "@/lib/anthropic" "@/lib/ai/anthropic"

echo ""
echo "📝 Fixing RPC imports..."
fix_import "@/lib/rpc-retry" "@/lib/solana/rpc/rpc-retry"
fix_import "@/lib/opensvm-rpc" "@/lib/solana/rpc/opensvm-rpc"

echo ""
echo "📝 Fixing search imports..."
fix_import "@/lib/qdrant" "@/lib/search/qdrant"
fix_import "@/lib/unified-search" "@/lib/search/unified-search"

echo ""
echo "📝 Fixing UI imports..."
fix_import "@/lib/viewport-tracker" "@/lib/ui/viewport-tracker"
fix_import "@/lib/safe-storage" "@/lib/ui/safe-storage"

echo ""
echo "📝 Fixing API imports..."
fix_import "@/lib/rate-limiter" "@/lib/api/rate-limiter"
fix_import "@/lib/api-cache" "@/lib/caching/api-cache"

echo ""
echo "✨ Import fixes complete!"
echo ""
echo "📊 Running build to check for remaining errors..."
npm run build 2>&1 | tee /tmp/build-after-imports.log | tail -20

echo ""
echo "✅ Check /tmp/build-after-imports.log for any remaining issues"
