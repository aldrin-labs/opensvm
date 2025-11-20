#!/bin/bash
# Script to organize 119 loose files in lib/ into logical subdirectories
# Phase 1: lib/ Organization

set -e  # Exit on error

ROOT="/home/larp/aldrin/opensvm"
cd "$ROOT"

echo "🚀 Starting lib/ organization..."
echo ""

# Create directory structure
echo "📁 Creating subdirectories..."
mkdir -p lib/solana/rpc
mkdir -p lib/blockchain
mkdir -p lib/ui
mkdir -p lib/maintenance
mkdir -p lib/search
mkdir -p lib/external-apis

echo "✓ Subdirectories created"
echo ""

# ===== SOLANA FILES =====
echo "📦 Moving Solana-specific files..."

mv lib/solana-connection-old.ts lib/solana/ 2>/dev/null || true
mv lib/solana-connection-client.ts lib/solana/ 2>/dev/null || true
mv lib/solana-connection-server.ts lib/solana/ 2>/dev/null || true
mv lib/solana-connection.ts lib/solana/ 2>/dev/null || true
mv lib/solana.ts lib/solana/ 2>/dev/null || true

# RPC files
mv lib/opensvm-rpc.ts lib/solana/rpc/ 2>/dev/null || true
mv lib/opensvm-rpc-broken.ts lib/solana/rpc/ 2>/dev/null || true
mv lib/opensvm-rpc-fixed.ts lib/solana/rpc/ 2>/dev/null || true
mv lib/rpc-retry.ts lib/solana/rpc/ 2>/dev/null || true
mv lib/rpc-config.ts lib/solana/rpc/ 2>/dev/null || true
mv lib/rpc-pool.ts lib/solana/rpc/ 2>/dev/null || true

# Program-related
mv lib/program-registry.ts lib/solana/ 2>/dev/null || true
mv lib/program-data.ts lib/solana/ 2>/dev/null || true
mv lib/program-activity.ts lib/solana/ 2>/dev/null || true
mv lib/program-discovery-service.ts lib/solana/ 2>/dev/null || true
mv lib/program-metadata-cache.ts lib/solana/ 2>/dev/null || true

# BPF/RISCV (Solana VM internals)
mv lib/bpf.ts lib/solana/ 2>/dev/null || true
mv lib/bpf.test.ts lib/solana/ 2>/dev/null || true
mv lib/riscv.ts lib/solana/ 2>/dev/null || true

echo "  ✓ Solana files moved"

# ===== BLOCKCHAIN/TRANSACTION FILES =====
echo "📦 Moving blockchain transaction files..."

mv lib/transaction-metadata-enricher.ts lib/blockchain/ 2>/dev/null || true
mv lib/transaction-parser.ts lib/blockchain/ 2>/dev/null || true
mv lib/transaction-classifier.ts lib/blockchain/ 2>/dev/null || true
mv lib/transaction-constants.ts lib/blockchain/ 2>/dev/null || true
mv lib/transaction-failure-analyzer.ts lib/blockchain/ 2>/dev/null || true
mv lib/transaction-failure-analyzer-clean.ts lib/blockchain/ 2>/dev/null || true
mv lib/transaction-graph-builder.ts lib/blockchain/ 2>/dev/null || true
mv lib/transaction-metrics-calculator.ts lib/blockchain/ 2>/dev/null || true
mv lib/transaction-optimization.ts lib/blockchain/ 2>/dev/null || true
mv lib/enhanced-transaction-fetcher.ts lib/blockchain/ 2>/dev/null || true

# Account files
mv lib/account-changes-analyzer.ts lib/blockchain/ 2>/dev/null || true
mv lib/account-changes-analyzer-client.ts lib/blockchain/ 2>/dev/null || true

# Program transaction files
mv lib/program-transaction-fetcher.ts lib/blockchain/ 2>/dev/null || true
mv lib/program-transaction-cache.ts lib/blockchain/ 2>/dev/null || true

# Block files
mv lib/block-data.ts lib/blockchain/ 2>/dev/null || true
mv lib/block-data-optimized.ts lib/blockchain/ 2>/dev/null || true

# Instruction parsing
mv lib/instruction-parser-service.ts lib/blockchain/ 2>/dev/null || true

# Relationship/wallet analysis
mv lib/related-transaction-finder.ts lib/blockchain/ 2>/dev/null || true
mv lib/related-transaction-finder-client.ts lib/blockchain/ 2>/dev/null || true
mv lib/relationship-strength-scorer.ts lib/blockchain/ 2>/dev/null || true

echo "  ✓ Blockchain files moved"

# ===== CACHING FILES =====
echo "📦 Moving caching files..."

mv lib/token-metadata-cache.ts lib/caching/ 2>/dev/null || true
mv lib/wallet-path-cache.ts lib/caching/ 2>/dev/null || true
mv lib/graph-state-cache.ts lib/caching/ 2>/dev/null || true
mv lib/transaction-cache-server.ts lib/caching/ 2>/dev/null || true
mv lib/transaction-cache.ts lib/caching/ 2>/dev/null || true
mv lib/transaction-analysis-cache.ts lib/caching/ 2>/dev/null || true
mv lib/api-cache.ts lib/caching/ 2>/dev/null || true
mv lib/feed-cache.ts lib/caching/ 2>/dev/null || true
mv lib/cache.ts lib/caching/ 2>/dev/null || true
mv lib/duckdb-cache.ts lib/caching/ 2>/dev/null || true

echo "  ✓ Caching files moved"

# ===== AI FILES =====
echo "📦 Moving AI files..."

mv lib/ai-transaction-analyzer.ts lib/ai/ 2>/dev/null || true
mv lib/ai-transaction-analyzer-client.ts lib/ai/ 2>/dev/null || true
mv lib/ai-service-client.ts lib/ai/ 2>/dev/null || true
mv lib/ai-retry.ts lib/ai/ 2>/dev/null || true
mv lib/ai-utils.ts lib/ai/ 2>/dev/null || true
mv lib/anthropic.ts lib/ai/ 2>/dev/null || true
mv lib/openrouter-api.ts lib/ai/ 2>/dev/null || true
mv lib/defi-transaction-analyzer.ts lib/ai/ 2>/dev/null || true

echo "  ✓ AI files moved"

# ===== SEARCH FILES =====
echo "📦 Moving search files..."

mv lib/qdrant.ts lib/search/ 2>/dev/null || true
mv lib/qdrant-search-suggestions.ts lib/search/ 2>/dev/null || true
mv lib/unified-search.ts lib/search/ 2>/dev/null || true
mv lib/search-optimization.ts lib/search/ 2>/dev/null || true
mv lib/duckduckgo-search.ts lib/search/ 2>/dev/null || true
mv lib/telegram-search.ts lib/search/ 2>/dev/null || true
mv lib/xcom-search.ts lib/search/ 2>/dev/null || true

echo "  ✓ Search files moved"

# ===== EXTERNAL API CLIENTS =====
echo "📦 Moving external API files..."

mv lib/birdeye-api.ts lib/external-apis/ 2>/dev/null || true
mv lib/moralis-api.ts lib/external-apis/ 2>/dev/null || true

echo "  ✓ External API files moved"

# ===== UI UTILITIES =====
echo "📦 Moving UI utility files..."

mv lib/viewport-tracker.ts lib/ui/ 2>/dev/null || true
mv lib/safe-storage.ts lib/ui/ 2>/dev/null || true
mv lib/keyboard-navigation.ts lib/ui/ 2>/dev/null || true
mv lib/keyboard-shortcuts-config.ts lib/ui/ 2>/dev/null || true
mv lib/enhanced-mobile-gestures.ts lib/ui/ 2>/dev/null || true
mv lib/mobile-utils.ts lib/ui/ 2>/dev/null || true
mv lib/suppress-scroll-warnings.ts lib/ui/ 2>/dev/null || true
mv lib/accessibility-messaging.ts lib/ui/ 2>/dev/null || true
mv lib/accessibility-utils.ts lib/ui/ 2>/dev/null || true

echo "  ✓ UI files moved"

# ===== ANOMALY DETECTION =====
echo "📦 Moving anomaly detection files to analytics/..."

mv lib/anomaly-patterns.ts lib/analytics/ 2>/dev/null || true
mv lib/configurable-anomaly-patterns.ts lib/analytics/ 2>/dev/null || true
mv lib/streaming-anomaly-detector.ts lib/analytics/ 2>/dev/null || true
mv lib/serverless-anomaly-processor.ts lib/analytics/ 2>/dev/null || true

echo "  ✓ Anomaly files moved"

# ===== SECURITY/AUTH =====
echo "📦 Moving security files to existing lib/api-auth/..."

mv lib/auth.ts lib/api-auth/ 2>/dev/null || true
mv lib/auth-server.ts lib/api-auth/ 2>/dev/null || true
mv lib/security-utils.ts lib/api-auth/ 2>/dev/null || true
mv lib/crypto-utils.ts lib/api-auth/ 2>/dev/null || true
mv lib/token-gating.ts lib/api-auth/ 2>/dev/null || true

echo "  ✓ Security files moved"

# ===== API/NETWORKING =====
echo "📦 Moving API/networking files to lib/api/..."

mv lib/api-presets.ts lib/api/ 2>/dev/null || true
mv lib/api-presets-complete.ts lib/api/ 2>/dev/null || true
mv lib/api-response.ts lib/api/ 2>/dev/null || true
mv lib/api-response-schemas.ts lib/api/ 2>/dev/null || true
mv lib/rate-limiter.ts lib/api/ 2>/dev/null || true
mv lib/rate-limiter-tiers.ts lib/api/ 2>/dev/null || true
mv lib/rate-limit.ts lib/api/ 2>/dev/null || true
mv lib/sse-handler.ts lib/api/ 2>/dev/null || true
mv lib/sse-manager.ts lib/api/ 2>/dev/null || true
mv lib/streaming.ts lib/api/ 2>/dev/null || true
mv lib/compression.ts lib/api/ 2>/dev/null || true

echo "  ✓ API files moved"

# ===== UTILITIES (move to existing lib/utils/) =====
echo "📦 Moving utilities to lib/utils/..."

mv lib/format-supply.ts lib/utils/ 2>/dev/null || true
mv lib/format-time.ts lib/utils/ 2>/dev/null || true
mv lib/data-formatter.ts lib/utils/ 2>/dev/null || true
mv lib/share-utils.ts lib/utils/ 2>/dev/null || true
mv lib/dynamic-imports.ts lib/utils/ 2>/dev/null || true
mv lib/mutex.ts lib/utils/ 2>/dev/null || true
mv lib/perlin.ts lib/utils/ 2>/dev/null || true
mv lib/mock-token-data.ts lib/utils/ 2>/dev/null || true

echo "  ✓ Utility files moved"

# ===== LOGGING/MONITORING =====
echo "📦 Moving logging files to lib/logging/..."

mv lib/logger.ts lib/logging/ 2>/dev/null || true
mv lib/debug-logger.ts lib/logging/ 2>/dev/null || true
mv lib/structured-logger.ts lib/logging/ 2>/dev/null || true
mv lib/errorLogger.ts lib/logging/ 2>/dev/null || true
mv lib/error-handler.ts lib/logging/ 2>/dev/null || true
mv lib/performance-monitor.ts lib/logging/ 2>/dev/null || true

echo "  ✓ Logging files moved"

# ===== USER HISTORY/FEED =====
echo "📦 Moving user/feed files to lib/user/..."

mv lib/user-history.ts lib/user/ 2>/dev/null || true
mv lib/user-history-utils.ts lib/user/ 2>/dev/null || true
mv lib/feed-events.ts lib/user/ 2>/dev/null || true

echo "  ✓ User/feed files moved"

# ===== MAINTENANCE SCRIPTS =====
echo "📦 Moving maintenance scripts..."

mv lib/user-history-repair.ts lib/maintenance/ 2>/dev/null || true
mv lib/user-stats-sync.ts lib/maintenance/ 2>/dev/null || true
mv lib/dynamic-program-discovery.ts lib/maintenance/ 2>/dev/null || true

echo "  ✓ Maintenance files moved"

# ===== TOKEN/TRADING (move to lib/trading/) =====
echo "📦 Moving token/trading files to lib/trading/..."

mv lib/token-registry.ts lib/trading/ 2>/dev/null || true
mv lib/trading-terminal-tutorial.ts lib/trading/ 2>/dev/null || true

echo "  ✓ Trading files moved"

# ===== SETTINGS (keep general utils) =====
echo "📦 Moving settings files to lib/config/..."

mv lib/settings.ts lib/config/ 2>/dev/null || true

echo "  ✓ Config files moved"

# ===== CHECK WHAT'S LEFT =====
echo ""
echo "📊 Checking remaining loose files..."
REMAINING=$(ls -1 lib/*.ts 2>/dev/null | wc -l)

if [ "$REMAINING" -gt 0 ]; then
    echo "⚠️  $REMAINING files still in lib/ root:"
    ls -1 lib/*.ts 2>/dev/null
    echo ""
    echo "These may need manual review for proper placement."
else
    echo "✅ All loose .ts files have been organized!"
fi

echo ""
echo "✨ lib/ organization complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Review file placements above"
echo "  2. Run: npm run build 2>&1 | grep -E 'Cannot find|error TS'"
echo "  3. Fix import paths (TSC will show all needed changes)"
echo "  4. Add barrel exports (index.ts files)"
echo ""
