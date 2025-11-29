# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Development
npm run dev              # Start dev server on localhost:3000
npm run build            # Production build (runs build-rpc-config.js first)
npm run build:fast       # Quick build without optimizations

# Testing
npm test                 # Jest unit tests (uses 4GB heap)
npm test -- path/to/test # Run specific test file
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Playwright interactive UI

# Quality
npm run lint             # ESLint
```

## Architecture Overview

OpenSVM is a Solana blockchain explorer with AI-powered analytics, built on Next.js 15 App Router.

### Directory Structure
- `/app/` - Next.js pages and API routes (60+ API endpoints)
- `/app/api/` - Backend APIs for blockchain data, AI services, analytics
- `/components/` - React components with feature-based organization
- `/components/transaction-graph/` - GPU-accelerated WebGL graph visualization
- `/lib/` - Core utilities: Solana integration, caching, AI services
- `/types/` - Shared TypeScript definitions

### Key Technical Stack
- **Blockchain**: @solana/web3.js with connection pooling, SPL Token, Anchor
- **Visualization**: D3.js, Cytoscape (dagre layout), Three.js, WebGL
- **AI**: Together AI (primary), Anthropic SDK (fallback), Qdrant vector DB
- **State**: XState for complex AI flows, Zustand for global state

### API Patterns
Routes in `/app/api/` follow REST conventions:
- `/api/transaction/[signature]` - Transaction data
- `/api/account/[address]` - Account info
- `/api/analytics/*` - DeFi analytics (AMMs, CLOBs, staking, etc.)
- `/api/analyze`, `/api/stream` - AI services

## Critical Conventions

### TypeScript
- Strict mode enabled, no `any` types allowed
- Use `@/*` path imports instead of relative paths
- **Never silence unused variable errors with underscores** - investigate purpose and implement proper functionality first

### Components
- Follow modular hook pattern (see `/components/transaction-graph/hooks/`)
- Hooks are separated by concern: `useAccountFetching`, `useGPUForceGraph`, etc.
- Use existing UI components from `/components/ui/`
- Implement error boundaries for fault tolerance

### Styling
- Use theme-aware semantic colors: `text-success`, `bg-info/10`, `text-destructive`
- Never use hardcoded Tailwind colors like `text-green-600` or `bg-blue-100`
- 5 themes available: high-contrast, paper, dos-blue, cyberpunk, solarized

### Netlify Deployment
- Never add CORS headers unless explicitly requested
- Never place serverless/edge functions in `public/` directory
- Node.js v22 required (configured in netlify.toml)
- Build uses `--legacy-peer-deps` with 4GB memory

## Token-Gated Features

The platform uses $SVMAI token for premium features:
- AI prompts: 1-200 tokens based on user tier
- Social features: 100,000 $SVMAI minimum
- Premium users: Unlimited threads (free: 10 limit)

## Performance Targets

- WebGL graphs: 60fps with 10K+ nodes
- API responses: <200ms standard, <1s complex analytics
- AI responses: <3s for natural language processing
- GPU memory: <512MB for visualization

## Troubleshooting

```bash
# Memory errors during build
export NODE_OPTIONS="--max_old_space_size=4096"

# Dependency conflicts
npm run install:force

# Qdrant connection issues
npm run fix-qdrant
```
