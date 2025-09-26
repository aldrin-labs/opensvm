# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- **Start dev server**: `npm run dev` or `bun run dev` (runs on http://localhost:3000)
- **Build production**: `npm run build` or `bun run build`
- **Start production**: `npm run start` or `bun run start`
- **Build optimized**: `npm run build:optimized` (with optimizations)
- **Build analysis**: `npm run build:analyze` (with bundle analysis)

### Testing & Quality
- **Run tests**: `npm test` (Jest unit tests with --max_old_space_size=4096)
- **E2E tests**: `npm run test:e2e` or `npm run e2e:run` (Playwright)
- **E2E UI**: `npm run test:e2e:ui` (Playwright UI mode)
- **Lint**: `npm run lint` (Next.js ESLint)
- **Type check**: Build process includes TypeScript validation

### Installation
- **Install deps**: `npm install` or `bun install`
- **Force install**: `npm run install:force` (for dependency conflicts)
- **Fix Qdrant**: `npm run fix-qdrant` (fix Qdrant cache issues)

## Architecture Overview

OpenSVM is a **Solana blockchain explorer** built with Next.js 15, featuring advanced transaction visualization, AI-powered analysis, and real-time data processing.

### Directory Structure
- `/app/` - Next.js 15 app router pages and API routes
  - `/api/` - Backend API endpoints for blockchain data, AI, analytics
  - Page routes organized by feature (tx, account, block, token, etc.)
- `/components/` - React components
  - `/ai/` - AI assistant and analysis components
  - `/transaction-graph/` - WebGL/GPU-accelerated graph visualization
  - UI components organized by feature
- `/lib/` - Core business logic and utilities
  - Solana integration, data processing, state management
- `/contexts/` - React contexts for global state
- `/hooks/` - Custom React hooks
- `/types/` - TypeScript type definitions
- `/public/` - Static assets
- `/styles/` - Global styles and Tailwind config

### Key Technologies & Patterns

**Frontend Stack:**
- Next.js 15 with App Router
- React 18 with TypeScript
- Tailwind CSS for styling
- Shadcn/ui components (in `/components/ui/`)

**Blockchain Integration:**
- @solana/web3.js for Solana RPC
- SPL Token for token operations
- Anchor framework support

**Data Visualization:**
- D3.js for charts and graphs
- Cytoscape for network graphs
- Three.js for 3D visualizations
- Custom WebGL renderer in transaction-graph

**AI & Analytics:**
- Together AI for LLM integration
- Qdrant vector database for similarity search
- XState for complex state machines

**Performance Optimizations:**
- React.lazy for code splitting
- Virtual scrolling with VTable
- WebGL GPU acceleration for graphs
- Incremental static regeneration

### API Patterns

API routes follow RESTful conventions in `/app/api/`:
- Transaction data: `/api/transaction/[signature]`
- Account data: `/api/account/[address]`
- Analytics: `/api/analytics/*`
- AI services: `/api/analyze`, `/api/stream`

Most APIs return JSON with error handling middleware.

### Component Conventions

- Use existing UI components from `/components/ui/`
- Follow modular hook pattern (see `/components/transaction-graph/hooks/`)
- Implement error boundaries for fault tolerance
- Use TypeScript strictly - no `any` types
- Prefer composition over inheritance

### Environment Variables

Required in `.env.local`:
- Solana RPC endpoints
- API keys for external services
- Database connections
See `.example.env` for template.

### Important Notes

- **Never add CORS headers** unless explicitly requested
- **No serverless functions** in public/ or publish/ directories
- Follow existing code style - check neighboring files
- Update architecture docs in `/docs/architecture/` for major changes
- Comprehensive test coverage expected for new features