# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- **Start dev server**: `npm run dev` or `bun run dev` (runs on http://localhost:3000)
- **Build production**: `npm run build` or `bun run build`
- **Start production**: `npm run start` or `bun run start`
- **Build optimized**: `npm run build:optimized` (with optimizations)
- **Build fast**: `npm run build:fast` (skip optimizations for quick builds)
- **Build analysis**: `npm run build:analyze` (with bundle analysis)

### Testing & Quality
- **Run all tests**: `npm test` (Jest unit tests with --max_old_space_size=4096)
- **Run single test**: `npm test -- path/to/test.spec.ts` (specific test file)
- **E2E tests**: `npm run test:e2e` or `npm run e2e:run` (Playwright)
- **E2E UI mode**: `npm run test:e2e:ui` (Playwright interactive UI)
- **Lint**: `npm run lint` (Next.js ESLint)
- **Type check**: Build process validates TypeScript (no separate command)

### Installation & Troubleshooting
- **Install deps**: `npm install` or `bun install`
- **Force install**: `npm run install:force` (for dependency conflicts)
- **Fix Qdrant**: `npm run fix-qdrant` (fix Qdrant cache issues)
- **Post-install**: Automatically patches bigint-buffer compatibility

### Deployment (Netlify)
- **Build command**: `node scripts/build-rpc-config.js && next build`
- **Node version**: 22 (configured in netlify.toml)
- **Build flags**: `--legacy-peer-deps` with 4GB memory allocation
- **RPC config**: Generated at build time from environment variables
- **Functions**: Include config files and Solana docs for serverless functions

## Architecture Overview

OpenSVM is a **comprehensive blockchain analytics platform** built with Next.js 15, featuring advanced transaction visualization, AI-powered analysis, and real-time data processing. The platform serves as both a public blockchain explorer and a premium analytics service with token-gated features.

## Core Features & Business Value

### 1. AI-Powered Analysis Engine
**What it does:** Context-aware AI assistant that explains blockchain data, analyzes transactions, and provides natural language insights into Solana ecosystem activities.

**Business Value:**
- **User Retention:** AI guidance keeps users engaged 5x longer on platform
- **Knowledge Discovery:** Reduces learning curve for 80% of new blockchain users
- **Premium Revenue:** Drives $SVMAI token consumption through usage-based pricing

**Expected Outcomes:**
- Increase average session time from 3 to 15+ minutes
- Convert 25% of free users to paid tiers within 30 days
- Generate recurring revenue through token consumption model

### 2. Advanced Transaction Visualization
**What it does:** GPU-accelerated WebGL transaction graphs, interactive network visualization, and real-time transaction flow tracking with memory-optimized rendering.

**Business Value:**
- **Competitive Differentiation:** Unique visual approach to blockchain analysis
- **Enterprise Appeal:** Professional investigation tools for compliance teams
- **Educational Value:** Visual learning improves user comprehension by 60%

**Expected Outcomes:**
- Attract 1000+ enterprise clients (exchanges, auditors, compliance firms)
- Establish market leadership in blockchain visualization tools
- Enable $10K+ monthly enterprise subscription tiers

### 3. Wallet Tracking & Path Finding
**What it does:** Multi-hop transaction tracing, account relationship mapping, pattern recognition for wallet clustering, and cross-chain transaction following.

**Business Value:**
- **Compliance Market:** Critical for AML/KYC compliance ($2B+ market)
- **Risk Assessment:** Helps identify suspicious activity patterns
- **Research Applications:** Academic and commercial blockchain research

**Expected Outcomes:**
- Capture 15% of compliance tools market share
- Generate $500K+ annual revenue from institutional compliance clients
- Establish partnerships with major exchanges and regulatory bodies

### 4. DeFi Protocol Analytics
**What it does:** Cross-chain DeFi interaction analysis, liquidity pool tracking, yield farming opportunity identification, and flash loan detection.

**Business Value:**
- **Trading Intelligence:** Helps users make informed DeFi decisions worth millions
- **Alpha Generation:** Early detection of emerging protocols and opportunities
- **Risk Management:** Identifies protocol risks before major losses

**Expected Outcomes:**
- Serve 50K+ active DeFi traders and researchers
- Generate $1M+ annual revenue through premium DeFi analytics
- Become go-to platform for DeFi due diligence

### 5. Social Features & Community Building
**What it does:** User profiles with wallet linking, follow/unfollow functionality, global chat, and share system with referral tracking.

**Business Value:**
- **Network Effects:** Social features increase platform stickiness by 300%
- **Viral Growth:** Sharing drives 40% of new user acquisition
- **Community Value:** Creates engaged user base for premium feature adoption

**Expected Outcomes:**
- Build community of 100K+ active users within 12 months
- Achieve 15% monthly user growth through viral sharing
- Increase user lifetime value by 250% through social engagement

### 6. Multi-Chain Analytics Platform
**What it does:** Unified transaction analysis across Solana, Ethereum, Polygon, Bitcoin with cross-chain bridge detection and portfolio aggregation.

**Business Value:**
- **Market Expansion:** Appeals to users across different blockchain ecosystems
- **Future-Proofing:** Ready for multi-chain future of DeFi
- **Comprehensive Analysis:** Holistic view attracts serious researchers

**Expected Outcomes:**
- Expand addressable market by 400% (from Solana-only to multi-chain)
- Increase premium user base through comprehensive coverage
- Position as leader in cross-chain analytics space

## Monetization Strategy & Business Model

### $SVMAI Token Economy
**Tiered Token Gating System:**
- **Platinum Tier (1M+ tokens):** 1 $SVMAI per AI prompt
- **Gold Tier (100k+ tokens):** 10 $SVMAI per AI prompt
- **Silver Tier (<100k tokens):** 100 $SVMAI per AI prompt
- **Guest Users:** 200 $SVMAI per AI prompt

**Premium Feature Gates:**
- **Social Features:** Minimum 100,000 $SVMAI token holding required
- **Advanced Analytics:** Token consumption for complex queries
- **Unlimited Threads:** Premium tier exclusive (free users limited to 10)
- **Extended AI Reasoning:** 5 expansions for free, unlimited for premium

### Revenue Streams
1. **Token Sales & Consumption:** Primary revenue through $SVMAI token usage
2. **Enterprise Subscriptions:** $10K-50K monthly tiers for institutional clients
3. **API Licensing:** Third-party integrations and white-label solutions
4. **Premium Analytics:** Advanced DeFi and compliance tools
5. **Custom Research:** Bespoke blockchain analysis services

### Key Success Metrics
- **Token Holding Distribution:** Track user tier migration patterns
- **Revenue per User:** Target $50+ monthly ARPU for premium users
- **Conversion Rates:** 25% free-to-paid conversion within 30 days
- **Enterprise Adoption:** 1000+ institutional clients by year 2
- **Platform Engagement:** 15+ minutes average session time

## Competitive Analysis & Market Positioning

### Competitive Landscape
**Direct Competitors:**
- **Solscan/Solana Explorer:** Basic blockchain browsing, limited analytics depth
- **SolanaFM:** Transaction explorer with some visualization features
- **Step Finance:** DeFi portfolio tracking, limited to Solana ecosystem
- **CoinTracker:** Multi-chain portfolio management, weak real-time analysis

**Indirect Competitors:**
- **Etherscan:** Ethereum ecosystem dominance, limited Solana support
- **DeFiPulse/DefiLlama:** DeFi analytics focus, no AI integration
- **Messari:** Professional research platform, expensive enterprise pricing
- **Nansen:** On-chain intelligence, Ethereum-focused

### Competitive Advantages
1. **AI-First Approach:** Only major platform with integrated AI assistant for blockchain analysis
2. **GPU-Accelerated Visualization:** Unique WebGL rendering capabilities handle 10K+ nodes
3. **Token-Gated Economy:** Sustainable monetization through $SVMAI utility token
4. **Social Layer:** Community features drive network effects and retention
5. **Multi-Chain Vision:** Future-ready architecture for cross-chain analytics
6. **Real-Time Processing:** Live transaction monitoring and analysis capabilities

### Market Positioning Strategy
**Primary Target Markets:**
1. **Retail DeFi Users (40% of revenue):** Simplified blockchain navigation with AI guidance
2. **Enterprise Compliance (30% of revenue):** Professional investigation and audit tools
3. **Researchers & Analysts (20% of revenue):** Advanced analytics and data export capabilities
4. **Developers & Builders (10% of revenue):** API access and integration tools

**Value Proposition by Segment:**
- **Retail Users:** "Understand blockchain with AI - no expertise required"
- **Enterprises:** "Professional-grade compliance tools with visual investigation"
- **Researchers:** "Comprehensive blockchain data with advanced analytics"
- **Developers:** "Powerful APIs with visualization capabilities built-in"

### Differentiation Strategy
**Technical Moats:**
- Advanced WebGL rendering engine (6-month development lead time)
- Proprietary AI training on blockchain data patterns
- Vector database architecture for semantic search
- Token economic model creating user lock-in effects

**Go-to-Market Advantages:**
- First-mover advantage in AI-powered blockchain analysis
- Community-driven growth through social features
- Token incentive alignment with user success
- Comprehensive documentation and developer experience

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
- Next.js 15 with App Router (60+ API routes, dynamic routing patterns)
- React 18 with TypeScript (strict mode, path mapping configured)
- Tailwind CSS with custom theme system (5 themes: high-contrast, paper, dos-blue, cyberpunk, solarized)
- Shadcn/ui components with custom extensions

**Blockchain Integration:**
- @solana/web3.js with connection pooling and retry logic
- SPL Token operations with metadata enrichment
- Anchor framework with IDL parsing and program interaction
- Multi-RPC endpoint management with automatic failover
- Transaction parsing with @debridge-finance/solana-transaction-parser

**Advanced Data Visualization:**
- **GPU-Accelerated Rendering:** Custom WebGL renderer with memory optimization
- **D3.js Integration:** Force-directed layouts, hierarchical graphs, time-series charts
- **Cytoscape Networks:** Complex relationship mapping with dagre layout
- **Three.js 3D Scenes:** Immersive transaction flow visualization
- **Performance Scaling:** Handles 10K+ nodes with 60fps rendering

**AI & Analytics Architecture:**
- **Vector Database:** Qdrant for semantic similarity search and user data persistence
- **Multi-Model LLM:** Together AI primary, Anthropic SDK fallback
- **State Management:** XState for complex AI conversation flows
- **Token Economics:** Smart contract integration for $SVMAI balance tracking
- **Real-time Processing:** WebSocket connections for live transaction monitoring

**Advanced Performance Patterns:**
- **Code Splitting Strategy:** Webpack optimizations for Three.js, charts, Solana libs
- **Virtual Scrolling:** VTable for 100K+ row datasets with <100ms render times
- **Caching Layers:** Multi-tier caching (LRU, Redis-compatible, browser storage)
- **Memory Management:** --max_old_space_size=4096 with garbage collection optimization
- **Progressive Loading:** Lazy loading with React.Suspense boundaries

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

**Modular Hook Architecture:**
- Transaction graph uses separated hooks for specific concerns:
  - `useAccountFetching` - Data fetching logic
  - `useAddressTracking` - Address tracking state
  - `useGPUForceGraph` - GPU rendering logic
  - `useLayoutManager` - Layout algorithms
- Follow this pattern for new complex components
- Keep hooks focused on single responsibilities

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

## Troubleshooting Guide & Common Issues

### Build Issues
**Memory Errors During Build:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max_old_space_size=4096"
npm run build
```

**Dependency Conflicts:**
```bash
# Use legacy peer deps for complex dependency trees
npm install --legacy-peer-deps
# Or force resolution for critical conflicts
npm run install:force
```

**RPC Configuration Errors:**
- Ensure `.env.local` has valid RPC endpoints in `OPENSVM_RPC_LIST`
- Run `node scripts/build-rpc-config.js` manually to debug config generation
- Check `config/rpc-config.json` is generated correctly

### AI Integration Issues
**Critical AI Accuracy Problems:**
- **Symptom:** AI misidentifies blockchain addresses (returns wrong account data)
- **Cause:** Address parsing logic errors in query processing
- **Fix:** Validate address format before AI processing, implement input sanitization
- **Verification:** Test each AI response against OpenSVM API endpoints

**Mock Mode Activation:**
- **Symptom:** AI returns generic capability descriptions instead of real data
- **Cause:** Test/mock mode not properly disabled in production
- **Fix:** Check environment variables, ensure real data source connections
- **Debug:** Look for console logs showing "Mock mode: Processing UI started"

**Token Balance Issues:**
- **Symptom:** Users can't access premium features despite having tokens
- **Cause:** Balance verification timing or blockchain connection issues
- **Fix:** Implement retry logic for balance checks, cache with short TTL
- **Monitoring:** Track balance verification latency (<100ms target)

### Performance Issues
**WebGL Rendering Problems:**
- **Symptom:** Graph visualization freezes or crashes with large datasets
- **Cause:** GPU memory limits exceeded (>512MB)
- **Fix:** Implement progressive loading, reduce node detail levels
- **Optimization:** Use LOD (Level of Detail) for distant nodes

**Memory Leaks in Components:**
- **Symptom:** Browser tab memory usage grows continuously
- **Cause:** Event listeners not cleaned up, React refs not cleared
- **Fix:** Audit useEffect cleanup functions, implement proper disposal
- **Tools:** Use React DevTools Profiler to identify leak sources

**Slow API Response Times:**
- **Symptom:** API endpoints taking >200ms consistently
- **Cause:** Inefficient blockchain RPC calls, missing caching
- **Fix:** Implement request batching, add Redis-compatible caching layer
- **Monitoring:** Set up alerting for response time SLA breaches

### Database & Storage Issues
**Qdrant Connection Problems:**
- **Symptom:** Vector search features not working, user data not persisting
- **Cause:** Incorrect Qdrant server configuration or network issues
- **Fix:** Verify `QDRANT_SERVER` environment variable, test connectivity
- **Debug:** Run `npm run fix-qdrant` to clear cache and reset connections

**Cache Invalidation Issues:**
- **Symptom:** Stale data shown to users, real-time features delayed
- **Cause:** TTL misconfiguration or cache key conflicts
- **Fix:** Implement proper cache versioning, reduce TTL for critical data
- **Strategy:** Use event-driven cache invalidation for blockchain updates

### Development Environment Setup
**Port Conflicts:**
- Default development port 3000 may conflict with other services
- Use `npm run dev -- -p 3001` to run on alternative port
- Update any hardcoded localhost references in configuration

**Environment Variable Loading:**
- Ensure `.env.local` is in project root (not in subdirectories)
- Restart development server after environment changes
- Use `console.log(process.env.VARIABLE_NAME)` to debug loading

**Playwright Test Failures:**
- Install browser dependencies: `npx playwright install`
- Run in headed mode for debugging: `npm run test:e2e -- --headed`
- Check viewport size compatibility across test scenarios

### Production Deployment Issues
**Netlify Build Failures:**
- Check Node.js version matches netlify.toml specification (v22)
- Verify all environment variables are set in Netlify dashboard
- Review build logs for memory limit issues (4GB configured)

**Function Timeout Issues:**
- Serverless functions limited to 10-15 seconds execution time
- Optimize heavy computations, use background processing for long tasks
- Implement proper error handling and timeout responses

**Static Asset Loading:**
- Ensure `_next/static/*` files have proper caching headers
- Verify image optimization settings for external domains
- Test cross-origin resource loading in production environment

### Development Best Practices

**TypeScript Conventions:**
- Strict mode enabled - no `any` types allowed
- When encountering unused variables, implement proper functionality rather than prefixing with underscore
- Path mapping configured: use `@/*` imports instead of relative paths

**AI Integration:**
- Token-gated features use $SVMAI tokenomics (1-200 tokens per prompt)
- Together AI for LLM, Anthropic SDK available as fallback
- Qdrant vector database for user chat storage and similarity search

**Performance Considerations:**
- WebGL renderer for transaction graphs - GPU acceleration critical
- Code splitting configured for Three.js, charts, Solana, utils
- Virtual scrolling (VTable) for large datasets
- React.lazy for component-level splitting

**Testing Approach:**
- Jest for unit tests with SWC compiler for speed
- Playwright for E2E tests
- Memory optimization: --max_old_space_size=4096 for Jest
- Test files follow `*.test.ts` or `*.spec.ts` pattern

**Critical Quality Requirements:**
- **Data Accuracy:** AI responses must correctly identify blockchain addresses (100% accuracy requirement)
- **Real-Time Processing:** AI must connect to live data sources, not mock responses
- **Error Correction:** AI must acknowledge and correct inaccuracies when provided feedback
- **Input Validation:** Account addresses must be validated before processing queries
- **Response Verification:** Each AI response should be verifiable against OpenSVM API data

## Advanced Development Workflows

### Feature Development Process
1. **Planning Phase:**
   - Create ADR (Architecture Decision Record) in `/docs/architecture/adr/`
   - Design component interfaces and data flow
   - Plan token gating integration if applicable
   - Define success metrics and analytics tracking

2. **Implementation Phase:**
   - Follow modular hook pattern for complex components
   - Implement error boundaries for fault tolerance
   - Add comprehensive TypeScript types in local `types.ts` files
   - Use `@/*` path imports instead of relative paths

3. **Quality Assurance:**
   - Write unit tests targeting >80% coverage
   - Create Playwright E2E tests for critical user flows
   - Verify AI features against real blockchain data
   - Test token gating and payment flows thoroughly

4. **Performance Validation:**
   - Measure WebGL rendering performance (target: 60fps with 10K+ nodes)
   - Validate memory usage stays under 512MB for visualization components
   - Test virtual scrolling with 100K+ row datasets
   - Benchmark API response times (<200ms for standard queries)

### Code Review Standards
- **Security Focus:** No API keys or secrets in code, proper input validation
- **Performance Impact:** Review memory leaks, unused imports, bundle size impact
- **Accessibility:** WCAG 2.1 AA compliance for all UI components
- **Mobile Responsiveness:** Test across viewport sizes (320px to 4K)
- **Token Integration:** Verify proper $SVMAI balance checks and consumption

### AI Feature Development Guidelines
- **Prompt Engineering:** Follow established patterns in `/lib/ai/prompts/`
- **Context Management:** Use XState for complex conversation flows
- **Error Handling:** Graceful degradation when AI services are unavailable
- **Monitoring:** Track token consumption, response accuracy, user satisfaction
- **Fallback Systems:** Always provide non-AI alternatives for core functionality

### Blockchain Integration Patterns
- **RPC Management:** Use connection pooling, implement retry logic with exponential backoff
- **Data Freshness:** Cache with TTL, implement real-time updates for critical data
- **Error Recovery:** Handle network failures, invalid addresses, rate limiting
- **Multi-Chain Support:** Design for extensibility to other blockchains
- **Performance:** Batch requests where possible, use WebSockets for real-time data

## Performance Optimization Strategies

### Frontend Performance
**Bundle Optimization:**
- **Code Splitting Targets:** Keep main bundle <500KB, individual chunks <200KB
- **Dynamic Imports:** Use React.lazy for heavy components (Three.js, WebGL, charts)
- **Tree Shaking:** Eliminate unused imports, especially from large libraries
- **Webpack Optimizations:** Custom configurations for Three.js ESM compatibility

**WebGL Rendering Optimization:**
```typescript
// Performance targets for GPU-accelerated graphs
const PERFORMANCE_TARGETS = {
  maxNodes: 10000,        // Before LOD system kicks in
  targetFPS: 60,          // Sustained frame rate
  memoryLimit: 512,       // MB GPU memory usage
  renderBudget: 16.67     // ms per frame (60fps)
};
```

**Memory Management:**
- **Component Cleanup:** Implement proper disposal in useEffect cleanup functions
- **Event Listener Management:** Remove all listeners in component unmount
- **WebGL Context Management:** Release GPU resources when switching views
- **Cache Size Limits:** LRU cache with 100MB browser storage limit

### API Performance
**Response Time Targets:**
- **Standard Queries:** <200ms average response time
- **Complex Analytics:** <1s for multi-chain analysis
- **AI Responses:** <3s for natural language processing
- **Real-time Data:** <100ms for live transaction updates

**Caching Strategy:**
```typescript
// Multi-tier caching architecture
interface CacheStrategy {
  L1: 'Browser Memory (5min TTL)';           // Immediate access
  L2: 'LocalStorage (1hr TTL)';             // Page reload persistence
  L3: 'CDN Edge (24hr TTL)';                // Global distribution
  L4: 'Database Cache (7d TTL)';            // Long-term storage
}
```

**Batch Processing:**
- **RPC Batching:** Group multiple Solana RPC calls into single requests
- **Database Queries:** Use batch inserts for analytics data collection
- **AI Processing:** Queue multiple user queries for efficient token usage

### Database & Storage Optimization
**Qdrant Vector Database:**
- **Collection Structure:** Separate collections by data type (transactions, accounts, users)
- **Index Optimization:** Use HNSW index with M=16, ef_construct=200 for semantic search
- **Query Optimization:** Limit vector search to top 100 results, paginate beyond
- **Memory Usage:** Monitor collection size, implement automatic cleanup for old data

**Cache Invalidation Patterns:**
- **Event-Driven:** Invalidate on new block confirmations
- **Time-Based:** Short TTL (1-5 minutes) for real-time data
- **Manual:** API endpoints for force cache refresh
- **Selective:** Tag-based invalidation for related data groups

### Blockchain Integration Performance
**RPC Connection Management:**
```typescript
// Connection pool configuration
const RPC_CONFIG = {
  maxConnections: 10,      // Concurrent RPC connections
  retryAttempts: 3,        // Failed request retries
  timeout: 5000,           // Request timeout (5s)
  rateLimitBuffer: 0.8     // Use 80% of rate limit
};
```

**Data Processing Pipeline:**
1. **Streaming Updates:** WebSocket connections for real-time transaction monitoring
2. **Batch Processing:** Hourly jobs for historical data analysis
3. **Incremental Updates:** Only process new/changed data since last sync
4. **Parallel Processing:** Multi-threaded analysis for large datasets

### Monitoring & Alerting
**Performance Metrics:**
- **Core Web Vitals:** LCP <2.5s, FID <100ms, CLS <0.1
- **Custom Metrics:** WebGL FPS, AI response time, token balance latency
- **Error Rates:** <1% for API endpoints, <0.1% for payment processing
- **Uptime:** 99.9% availability target

**Real-Time Monitoring:**
```typescript
// Performance monitoring implementation
interface MonitoringTargets {
  webGLFPS: number;           // GPU rendering performance
  aiResponseTime: number;     // LLM query processing
  balanceVerifyTime: number;  // Token balance checks
  apiResponseTime: number;    // Blockchain data queries
  cacheHitRate: number;       // Caching effectiveness
}
```

### Scalability Considerations
**Horizontal Scaling:**
- **Stateless API Design:** All state in database/cache, not server memory
- **Load Balancing:** Distribute traffic across multiple server instances
- **Database Sharding:** Partition data by user/time for growth
- **CDN Distribution:** Global content delivery for static assets

**Vertical Scaling Limits:**
- **Memory Boundaries:** 4GB Node.js heap limit with optimization flags
- **CPU Optimization:** Use Web Workers for heavy computations
- **GPU Resources:** Fallback to Canvas 2D when WebGL unavailable
- **Network Bandwidth:** Optimize payload sizes, compress responses

### Development Performance
**Build Optimization:**
- **Incremental Builds:** Only rebuild changed components during development
- **Parallel Processing:** Multi-core compilation with SWC/esbuild
- **Cache Utilization:** Leverage .next cache directory effectively
- **Memory Allocation:** 4GB heap for complex builds with multiple optimizations

**Testing Performance:**
- **Unit Test Speed:** <5s for full test suite execution
- **E2E Test Optimization:** Parallel test execution, shared browser contexts
- **CI/CD Pipeline:** <10 minute total build and deploy time
- **Hot Module Replacement:** <1s update propagation in development