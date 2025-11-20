# Root Directory Reorganization Map

This document tracks the reorganization of the repository root directory performed on November 18, 2025.

## Documentation Moved to `docs/`

### `docs/ai/`
- AI-SERVICE-FIX-QUICKSTART.md
- AI-SERVICE-TIMEOUT-FIX.md
- SVMAI-BOOST-SYSTEM.md
- LLMS-TXT-INTEGRATION.md
- readme.llms.txt
- readme.llms.expanded.txt
- osvm.lmms.txt
- osvm.lmms.part*.txt
- osvm.lmms.partak

### `docs/api/`
- API_REFERENCE.md
- API-SCHEMA-REFERENCE.md
- OPENAPI-SCHEMA-ISSUE-EXPLANATION.md
- NEW-API-ENDPOINTS.md
- api.md

### `docs/auth/`
- API-KEY-ACTIVITY-LOGGING.md
- API-KEY-AUTH-SYSTEM.md
- API-KEY-SECURITY-IMPROVEMENTS.md
- HOW-TO-CREATE-API-KEY.md

### `docs/caching/`
- CACHING_ANALYSIS_REPORT.md
- CACHING_IMPLEMENTATION_PLAN.md
- COMPLETE_CACHING_IMPLEMENTATION.md
- TOKEN_CACHING_FIX_SUMMARY.md

### `docs/market-data/`
- MARKET-DATA-BATCH-ENHANCEMENT.md
- MARKET-DATA-INTERVAL-FIX.md
- MARKET-DATA-SWAGGER-UPDATE.md
- BIRDEYE-INTEGRATION-SUMMARY.md
- BIRDEYE-MARKET-DATA-MIGRATION.md
- BIRDEYE-PROMPT-UPDATES.md
- FLIPSIDE-TO-BIRDEYE-MIGRATION.md

### `docs/token-pages/`
- TOKEN_PAGE_ERROR_FIXES.md
- TOKEN_PAGE_FIXES_SUMMARY.md
- SVMAI-TOKEN-TRACE-REPORT.md

### `docs/bank/`
- SVM-BANK-FEATURES-V2.md
- SVM-BANK-IMPLEMENTATION.md

### `docs/ui-ux/`
- DOCS-PAGE-RENDERING-FIX.md
- HOLDER_TAB_IMPLEMENTATION.md
- FEED_TAB_FIX.md
- WEBKIT_BROWSER_CONFIG.md
- UX_AUDIT_REPORT.md

### `docs/misc/`
- ACCOUNT_TRANSACTIONS_ENHANCEMENT.md
- ACCOUNT_TRANSFERS_OPTIMIZATION_SUMMARY.md
- EXTERNAL_DATA_VERIFICATION.md
- LOGGING-IMPROVEMENTS.md
- DOCUMENTATION-REFINEMENT-ANALYSIS.md
- DOCUMENTATION-UPDATE-SUMMARY.md
- SSO-REMOVAL-SUMMARY.md
- TRANSACTION_GRAPH_FIX_SUMMARY.md
- twitter-announcement.md
- CLAUDE.md

## Data Files Moved to `data/`

### `data/snapshots/`
- account-txs-response.json
- actual_coingecko.json
- svmai-verify.json
- svmai-wallet-graph.json
- svmai-wallet-graph.cx2
- svmai-wallet-graph.jsonld
- direct-backend-results-*.json
- caching-analysis-report.json
- health-check-results.json
- jest-results.json
- ai-sidebar-*.json (test results)

### `data/` (root level)
- test-results.txt
- changes.txt

## Log Files Moved to `logs/`
- dev.log
- server.log
- build-output.log
- health-check-output.log
- response*.txt
- validator-response.txt

## Scripts Moved to `scripts/`

All test, debug, verification, and utility scripts:
- test-*.sh
- test-*.js
- verify-*.js
- verify-*.mjs
- debug-*.js
- analyze-*.js
- build-wallet-graph*.js
- trace-svmai-flow.js
- compare-svmai.js
- clear-transfer-cache.js
- demo-*.js
- direct-backend-test.js
- simple-validator-test.js
- headless-check*.js
- add-caching-template.sh
- advanced-analytics-demo-commands.sh
- consolidate-docs.sh
- create-api-key.sh
- fix-indexing.sh
- fix-package-manager-conflicts.sh
- install-vscode-with-zsh.sh
- update-types.sh
- verified-analytics-demo.sh

## Rust Tooling Moved to `trace-tools/`
- trace_flow.rs
- TRACE_FLOW_RUST_README.md
- libtrace_flow.rlib
- test_trace_flow (binary)

## Screenshots Moved to `screenshots/`
- sidebar-test-failure.png
- debug-loaded.png

## Files Remaining in Root

Essential configuration and documentation:
- README.md
- TESTING.md (if present)
- CHANGELOG.md
- package.json
- package-lock.json
- tsconfig.json
- next.config.mjs
- jest.config.js
- playwright.config.ts
- netlify.toml
- Dockerfile
- middleware.ts
- All dotfiles (.env, .gitignore, etc.)

Core application directories:
- app/
- components/
- lib/
- utils/
- hooks/
- types/
- styles/
- public/
- __tests__/
- tests/
- e2e/
- build/
- node_modules/

## Benefits of This Reorganization

1. **Reduced Root Clutter**: Root directory now contains only essential config files and core app directories
2. **Logical Grouping**: Related documentation is now organized by topic
3. **Easier Navigation**: Clear separation between docs, data, logs, scripts, and tools
4. **Maintainability**: Easier to find and update related files
5. **No Breaking Changes**: All core app functionality remains intact; only organizational changes

## Finding Old Files

If you need to find where a file was moved:
```bash
# Search by filename
find . -name "FILENAME.md"

# Search in specific categories
ls docs/ai/          # AI-related docs
ls docs/api/         # API documentation
ls data/snapshots/   # JSON data files
ls logs/             # Log files
ls scripts/          # Test and utility scripts
ls trace-tools/      # Rust tooling
```
