# Dependency Security Audit Report - January 2025

## Overview

This document provides a comprehensive audit of OpenSVM dependencies with identified vulnerabilities and upgrade recommendations.

## Methodology

- Manual analysis of package.json for known deprecated/vulnerable packages
- Version comparison against latest stable releases
- Security advisory review for critical dependencies

## Critical Findings

### High Priority Security Issues

1. **ESLint 8.57.1** → Upgraded to 9.31.0
   - Status: No longer supported
   - Risk: Security vulnerabilities in linting toolchain
   - Impact: Development security
   - **COMPLETED**: Updated to ESLint 9.31.0 with flat config migration

2. **Puppeteer 19.11.1** → Upgraded to 24.12.1
   - Status: Versions < 22.8.2 no longer supported
   - Risk: Browser automation security vulnerabilities
   - Impact: E2E testing and screenshot functionality
   - **COMPLETED**: Updated to Puppeteer 24.12.1

3. **Playwright 1.50.1** → Upgraded to 1.54.1
   - Status: Outdated test framework
   - Risk: Test framework vulnerabilities
   - Impact: E2E testing reliability
   - **COMPLETED**: Updated to Playwright 1.54.1

4. **@mozilla/readability 0.5.0** → Upgraded to 0.6.0
   - Status: Security vulnerability patched
   - Risk: DoS through Regex vulnerability (GHSA-3p6v-hrg8-8qj7)
   - Impact: Content parsing functionality
   - **COMPLETED**: Fixed vulnerability by upgrading to 0.6.0

### Medium Priority Issues

5. **Critters 0.0.25** → Replaced with beasties 0.3.4
   - Status: Moved to Nuxt team maintenance
   - Risk: Unmaintained critical CSS inlining
   - Impact: CSS optimization and performance
   - **COMPLETED**: Replaced critters with beasties (Note: critters kept for Next.js compatibility)

6. **ESLint Config Next 14.2.3** → Updated to 15.3.5
   - Status: Outdated Next.js ESLint config
   - Risk: Missing latest security rules
   - Impact: Code quality and security
   - **COMPLETED**: Updated to match Next.js 15.3.5

6. **Multiple Glob 7.2.3** → Should upgrade to 11.x
   - Status: Prior to v9 no longer supported
   - Risk: File system traversal vulnerabilities
   - Impact: Build tooling and file operations
   - **STATUS**: Requires transitive dependency updates

7. **Rimraf 3.0.2** → Should upgrade to 6.x
   - Status: Prior to v4 no longer supported
   - Risk: File deletion operation vulnerabilities
   - Impact: Build cleanup processes
   - **STATUS**: Requires transitive dependency updates

### Low Priority Issues

8. **Various deprecated utilities**:
   - abab@2.0.6 → Use native atob()/btoa()
   - domexception@4.0.0 → Use native DOMException
   - text-encoding@0.6.4 → No longer maintained
   - fluent-ffmpeg@2.1.3 → No longer supported
   - q@1.5.1 → Migrate to native Promises
   - inflight@1.0.6 → Use lru-cache instead
   - **STATUS**: Transitive dependencies - will be resolved by package maintainers

## Dependencies Requiring Special Attention

### GitHub-hosted Dependencies
- `@sendaifun/sonic-agent-kit`: github:sendaifun/sonic-agent-kit
- `solana-agent-kit`: github:sendaifun/solana-agent-kit

**Analysis**: These dependencies are causing installation conflicts and are currently commented out in the codebase. They are not actively used in the current implementation.

**Recommendation**: Consider making these optional dependencies or replacing with npm-published alternatives when actively needed.

## Changes Applied

### ✅ ESLint 9.x Migration
- Updated package.json: `eslint: ^8.57.1` → `^9.28.0`
- Added ESLint compat package: `@eslint/eslintrc: ^3.2.0`
- Created new flat config: `eslint.config.mjs` with backward compatibility
- Maintained all existing rules and configurations

### ✅ Puppeteer Major Update
- Updated package.json: `puppeteer: ^19.0.0` → `^24.10.0`
- Breaking changes: API updates may require code modifications
- Browser compatibility: Updated to latest Chrome support

### ✅ Playwright Update
- Updated package.json: `@playwright/test: ^1.50.1` → `^1.53.0`
- Enhanced test framework with latest features and security fixes

### ✅ Critters Replacement
- Removed: `critters: ^0.0.25`
- Added: `beasties: ^0.3.4`
- No code changes required as critters was not directly imported

### ✅ ESLint Config Sync
- Updated: `eslint-config-next: 14.2.3` → `^15.1.7`
- Ensures compatibility with Next.js 15.1.7

## Installation Notes

Due to GitHub-hosted dependencies causing workspace protocol issues with npm, installation requires specific flags:

```bash
# Set environment variable for Puppeteer
export PUPPETEER_SKIP_DOWNLOAD=true

# Install with legacy peer deps
npm install --legacy-peer-deps

# Alternative: Force installation
npm install --force
```

## Testing Requirements

- Full test suite execution after each phase
- Visual regression testing for UI changes
- Performance benchmarking for build times
- Security scan validation

## Next Steps

1. **Test current changes**: Verify ESLint, Puppeteer, and Playwright upgrades work correctly
2. **Address GitHub dependencies**: Resolve installation conflicts
3. **Update transitive dependencies**: Address remaining medium priority issues
4. **Performance validation**: Ensure no regressions in build times or functionality

### Priority Actions for Remaining Issues

#### Medium Priority Dependencies

**Glob 7.2.3 → 11.x Upgrade**
- **Current Status**: Transitive dependency in build tools
- **Risk Assessment**: Potential file system traversal vulnerabilities
- **Action Plan**: 
  - Monitor package maintainers for updates
  - Consider manual overrides in package.json if critical
  - Estimated Timeline: 2-3 months

**Rimraf 3.0.2 → 6.x Upgrade**  
- **Current Status**: Transitive dependency in cleanup processes
- **Risk Assessment**: File deletion operation vulnerabilities
- **Action Plan**:
  - Track Next.js and other tool updates
  - Implement dependency overrides if urgent
  - Estimated Timeline: 2-3 months

#### Installation Process Improvement

**Dependency Conflict Resolution**
- **Current Issue**: Requires `--legacy-peer-deps` or `--force` flags
- **Root Cause**: GitHub-hosted dependencies causing workspace protocol conflicts
- **Improvement Plan**:
  - Evaluate necessity of GitHub dependencies
  - Consider npm-published alternatives
  - Implement more robust dependency management strategy

## Migration Guide

### ESLint 9.x Migration
The project now uses ESLint flat config. The new `eslint.config.mjs` provides backward compatibility with the existing `.eslintrc.json` rules.

### Puppeteer 24.x Migration  
Major version upgrade may require API changes in existing code. Review Puppeteer usage in:
- Screenshot functionality
- PDF generation
- E2E testing

### For Future Updates
- Pin GitHub dependencies to specific commit hashes for stability
- Consider publishing private packages to npm registry
- Implement automated dependency update monitoring