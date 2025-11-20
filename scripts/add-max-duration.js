#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const routeFiles = [
  'app/api/account-portfolio/[address]/route.ts',
  'app/api/account-stats/[address]/route.ts',
  'app/api/account-token-stats/[address]/[mint]/route.ts',
  'app/api/account-transactions/[address]/route.ts',
  'app/api/ai-analyze-transaction/route.ts',
  'app/api/ai-response/route.ts',
  'app/api/alerts/route.ts',
  'app/api/analytics/aggregators/route.ts',
  'app/api/analytics/bots/route.ts',
  'app/api/analytics/cross-chain/route.ts',
  'app/api/analytics/defai/route.ts',
  'app/api/analytics/defi-health/route.ts',
  'app/api/analytics/dex/route.ts',
  'app/api/analytics/infofi/route.ts',
  'app/api/analytics/launchpads/route.ts',
  'app/api/analytics/marketplaces/route.ts',
  'app/api/analytics/overview/route.ts',
  'app/api/analytics/socialfi/route.ts',
  'app/api/analytics/trending-validators/route.ts',
  'app/api/analytics/user-interactions/route.ts',
  'app/api/analytics/validators/route.ts',
  'app/api/analyze-account-changes/route.ts',
  'app/api/analyze/route.ts',
  'app/api/analyze-transaction/route.ts',
  'app/api/anomaly/related/route.ts',
  'app/api/anomaly/route.ts',
  'app/api/anomaly/similar/route.ts',
  'app/api/api-keys/route.ts',
  'app/api/auth/api-keys/activity/route.ts',
  'app/api/auth/api-keys/create/route.ts',
  'app/api/auth/api-keys/list/route.ts',
  'app/api/auth/api-keys/metrics/route.ts',
  'app/api/auth/auth-link/create/route.ts',
  'app/api/auth/bind-wallet/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/auth/session/route.ts',
  'app/api/auth/verify/route.ts',
  'app/api/bank/wallets/create/route.ts',
  'app/api/bank/wallets/refresh/route.ts',
  'app/api/bank/wallets/route.ts',
  'app/api/bank/wallets/simulate/route.ts',
  'app/api/block/route.ts',
  'app/api/blocks/route.ts',
  'app/api/blocks/[slot]/route.ts',
  'app/api/blocks/stats/route.ts',
  'app/api/chart/route.ts',
  'app/api/chat/global/route.ts',
  'app/api/chat/route.ts',
  'app/api/check-account-type/route.ts',
  'app/api/check-token/route.ts',
  'app/api/config/route.ts',
  'app/api/crash-reporting/route.ts',
  'app/api/dex/[name]/route.ts',
  'app/api/docs/openapi/route.ts',
  'app/api/docs/page/route.ts',
  'app/api/error-report/route.ts',
  'app/api/error-tracking/route.ts',
  'app/api/favicon/route.ts',
  'app/api/feed/latest/route.ts',
  'app/api/filter-transactions/route.ts',
  'app/api/find-related-transactions/route.ts',
  'app/api/getAnswer/route.ts',
  'app/api/getSimilarQuestions/route.ts',
  'app/api/getSources/route.ts',
  'app/api/health/ai-service/route.ts',
  'app/api/health/anthropic/route.ts',
  'app/api/health/route.ts',
  'app/api/health/rpc-endpoints/route.ts',
  'app/api/holdersByInteraction/route.ts',
  'app/api/install/route.ts',
  'app/api/instruction-lookup/route.ts',
  'app/api/launchpad/admin/referrers/[id]/approve/route.ts',
  'app/api/launchpad/admin/referrers/[id]/reject/route.ts',
  'app/api/launchpad/admin/referrers/route.ts',
  'app/api/launchpad/contributions/[contribId]/route.ts',
  'app/api/launchpad/kol/apply/route.ts',
  'app/api/launchpad/kol/[kolId]/claim/route.ts',
  'app/api/launchpad/kol/[kolId]/route.ts',
  'app/api/launchpad/referral-links/[code]/route.ts',
  'app/api/launchpad/reports/daily/route.ts',
  'app/api/launchpad/sales/route.ts',
  'app/api/launchpad/sales/[saleId]/contribute/route.ts',
  'app/api/launchpad/sales/[saleId]/distribute_volume/route.ts',
  'app/api/launchpad/sales/[saleId]/referral-links/route.ts',
  'app/api/launchpad/sales/[saleId]/route.ts',
  'app/api/live-stats/route.ts',
  'app/api/logging/route.ts',
  'app/api/market-data/route.ts',
  'app/api/mempool/route.ts',
  'app/api/metrics/route.ts',
  'app/api/monetization/balance/route.ts',
  'app/api/monetization/consume/route.ts',
  'app/api/monetization/earn/route.ts',
  'app/api/monitoring/api/route.ts',
  'app/api/monitoring/requests/route.ts',
  'app/api/nft-collections/new/route.ts',
  'app/api/nft-collections/route.ts',
  'app/api/nft-collections/trending/route.ts',
  'app/api/nfts/collections/route.ts',
  'app/api/notifications/route.ts',
  'app/api/og/[entityType]/[entityId]/route.tsx',
  'app/api/og/route.tsx',
  'app/api/opensvm/anthropic-keys/[keyId]/route.ts',
  'app/api/opensvm/anthropic-keys/route.ts',
  'app/api/opensvm/anthropic-keys/stats/route.ts',
  'app/api/opensvm/balance/route.ts',
  'app/api/opensvm/usage/route.ts',
  'app/api/program-accounts/route.ts',
  'app/api/program/[address]/route.ts',
  'app/api/program-discovery/route.ts',
  'app/api/program-metadata/route.ts',
  'app/api/program-registry/[programId]/route.ts',
  'app/api/program-registry/route.ts',
  'app/api/proxy/rpc/[id]/route.ts',
  'app/api/proxy/rpc/route.ts',
  'app/api/qdrant/init/route.ts',
  'app/api/referrals/balance/route.ts',
  'app/api/referrals/claim/route.ts',
  'app/api/scan/route.ts',
  'app/api/search/accounts/route.ts',
  'app/api/search/filtered/route.ts',
  'app/api/search/route.ts',
  'app/api/search/suggestions/empty-state/route.ts',
  'app/api/search-suggestions/route.ts',
  'app/api/search/suggestions/route.ts',
  'app/api/share/click/[shareCode]/route.ts',
  'app/api/share/conversion/route.ts',
  'app/api/share/generate/route.ts',
  'app/api/share/[shareCode]/route.ts',
  'app/api/share/stats/[walletAddress]/route.ts',
  'app/api/slots/route.ts',
  'app/api/solana-proxy/route.ts',
  'app/api/solana-proxy/[transaction]/route.ts',
  'app/api/solana-rpc/route.ts',
  'app/api/sse-alerts/route.ts',
  'app/api/sse-events/feed/route.ts',
  'app/api/sse-feed/route.ts',
  'app/api/status/route.ts',
  'app/api/stream/blocks/route.ts',
  'app/api/stream/route.ts',
  'app/api/stream/transactions/route.ts',
  'app/api/test-qdrant/route.ts',
  'app/api/test-token-balance/route.ts',
  'app/api/test-transaction/route.ts',
  'app/api/token/[address]/holdersByVolume/route.ts',
  'app/api/token/[address]/holders/route.ts',
  'app/api/token/[address]/route.ts',
  'app/api/token/[address]/traders/route.ts',
  'app/api/token-gating/check/route.ts',
  'app/api/token-metadata/route.ts',
  'app/api/token-stats/[account]/[mint]/route.ts',
  'app/api/trades/route.ts',
  'app/api/trading/chat/route.ts',
  'app/api/trading/execute/route.ts',
  'app/api/trading/market-data/route.ts',
  'app/api/trading/markets/route.ts',
  'app/api/trading/pools/route.ts',
  'app/api/trading/positions/route.ts',
  'app/api/trading/stream/route.ts',
  'app/api/trading/trades/route.ts',
  'app/api/transaction/batch/route.ts',
  'app/api/transaction-metrics/route.ts',
  'app/api/transaction-metrics/[signature]/route.ts',
  'app/api/transaction/mock/[signature]/route.ts',
  'app/api/transaction/route.ts',
  'app/api/transaction/[signature]/analysis/route.ts',
  'app/api/transaction/[signature]/explain/route.ts',
  'app/api/transaction/[signature]/failure-analysis/route.ts',
  'app/api/transaction/[signature]/metrics/route.ts',
  'app/api/transaction/[signature]/related/route.ts',
  'app/api/transaction/[signature]/route.ts',
  'app/api/transfers/cache/route.ts',
  'app/api/usage-stats/route.ts',
  'app/api/user-feed/[walletAddress]/route.ts',
  'app/api/user-history/repair/route.ts',
  'app/api/user-history/sync/route.ts',
  'app/api/user-history/[walletAddress]/route.ts',
  'app/api/user-profile/sync/route.ts',
  'app/api/user-profile/[walletAddress]/route.ts',
  'app/api/user-social/follow/route.ts',
  'app/api/user-social/follow/[targetAddress]/route.ts',
  'app/api/user-social/like-event/route.ts',
  'app/api/user-social/like/route.ts',
  'app/api/user-social/like/[targetAddress]/route.ts',
  'app/api/user-social/unfollow/route.ts',
  'app/api/user-social/unlike-event/route.ts',
  'app/api/user-social/unlike/route.ts',
  'app/api/user-social/view/route.ts',
  'app/api/user-tab-preference/[walletAddress]/route.ts',
  'app/api/v1/messages/route.ts',
  'app/api/v1/models/route.ts',
  'app/api/validator/[address]/route.ts',
  'app/api/version/route.ts',
  'app/api/wallet-path-finding/route.ts',
  'app/api/websocket-info/route.ts',
];

const MAX_DURATION_EXPORT = '\n// Route segment config: Set timeout to 120 seconds\nexport const maxDuration = 120;\n';

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

function processFile(filePath) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      errorCount++;
      return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');

    // Check if maxDuration already exists
    if (content.includes('export const maxDuration')) {
      console.log(`⏭️  Already has maxDuration: ${filePath}`);
      skipCount++;
      return;
    }

    // Find the end of imports
    const lines = content.split('\n');
    let lastImportIndex = -1;
    let inMultilineComment = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Track multiline comments
      if (line.includes('/*')) inMultilineComment = true;
      if (line.includes('*/')) inMultilineComment = false;
      
      // Skip comments and empty lines
      if (inMultilineComment || line.startsWith('//') || line === '') {
        continue;
      }

      // Check if this is an import line
      if (line.startsWith('import ') || line.startsWith('import{') || line.startsWith('import{')) {
        lastImportIndex = i;
      } else if (lastImportIndex !== -1 && line !== '') {
        // Found first non-import, non-empty line after imports
        break;
      }
    }

    if (lastImportIndex === -1) {
      // No imports found, add at the beginning
      content = MAX_DURATION_EXPORT + content;
    } else {
      // Insert after the last import
      lines.splice(lastImportIndex + 1, 0, MAX_DURATION_EXPORT);
      content = lines.join('\n');
    }

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
    successCount++;

  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    errorCount++;
  }
}

console.log('Starting to add maxDuration to route files...\n');

routeFiles.forEach(processFile);

console.log('\n' + '='.repeat(60));
console.log(`✅ Successfully updated: ${successCount} files`);
console.log(`⏭️  Skipped (already had maxDuration): ${skipCount} files`);
console.log(`❌ Errors: ${errorCount} files`);
console.log(`📊 Total processed: ${routeFiles.length} files`);
console.log('='.repeat(60));
