# GIGAPLAN: Agentic AI Sidebar Evolution

## Overview
Transform the AI sidebar from a simple chat interface into a powerful agentic system that can plan, execute tools, observe results, and provide structured responses. All work must preserve the NO RPC CHANGES guardrail.

- Monetization first: ship an SVMAI token-gated MVP with balance UI and consumption tracking early.
- Integrate the Agentic Navigation UI concepts incrementally (context panel, active investigation, progress visualization, templates, findings, history, mobile).

## Phase 0: Monetization MVP + Stabilization (1-3 days)

### Task 0.0: Monetization MVP (SVMAI Token Gating + Balance UI)
**Status:** Ready
**Priority:** Critical (first to ship)
**Effort:** 4-6 hours

**What:** Ship a minimal SVMAI token system to gate advanced agent features and track consumption. Start with a local/session-backed balance and stubbed earn/deposit flows; no on-chain changes.

**Details:**
1. Domain types and gate logic
   - Create `lib/monetization/svmai.ts`:
     - `SVMAITokenPricing` constants (from design)
     - `TokenConsumptionTracker`, `ConsumptionItem`
     - `SVMAITokenGate` with: `getUserTokenBalance(userId)`, `calculateEstimatedCost(investigationType)`, `validateInvestigationAccess(...)`, `consumeTokens(...)`
   - Idempotent consumption via `requestId` dedupe; safety caps per action

2. API endpoints (temporary in-memory)
   - `app/api/monetization/balance/route.ts` (GET): `{ balance, tier, usageThisMonth }`
   - `app/api/monetization/consume/route.ts` (POST): `{ sessionId, action, cost }` → update balance and log
   - `app/api/monetization/earn/route.ts` (POST): `{ action }` → award small bonuses
   - Storage: user-scoped in-memory map with signed cookie fallback (MVP)

3. UI integration (AI Sidebar)
   - `components/ai/monetization/TokenGateBanner.tsx`
   - `components/ai/monetization/TokenManagementPanel.tsx` (balance, cost estimator, packages stub, earning actions)
   - Add `[💰 Tokens]` trigger in `AIChatSidebar.tsx` header; `data-ai-token-panel` for tests
   - Gate “Start Investigation/Complex templates” by calling `validateInvestigationAccess`; on shortfall, open token panel instead of running

4. Cost model (initial)
   - `basic=10`, `complex=25`, `deep=50`, `navigationStep=2`, `dataExtraction=1`, `patternAnalysis=5`
   - MVP: consume estimated cost up-front; settle delta on completion

5. Tests
   - Unit: allow/deny + consumption reduces balance; shortfall returns `{ investigationPaused: true }`
   - E2E: low balance → token panel opens; adding test credit (earn) unlocks run

**Acceptance:** Advanced investigations require sufficient SVMAI. Sidebar shows balance and cost estimate; insufficient balance triggers token panel with guidance. No RPC or on-chain changes.

### Task 0.1: Stabilize E2E Test Selectors
**Status:** Ready
**Priority:** Critical
**Effort:** 30min

**What:** Add stable data attributes to AI sidebar components for reliable E2E testing.

**Details:**
1. Edit `components/ai/layouts/ChatLayout.tsx` sidebar case:
   - Add `data-ai-sidebar` to the main sidebar div (line ~212)
   - Add `data-ai-actions-feed` to the agent actions section container
   - Add `data-ai-action-item` to each action item div

2. Edit `components/ai/ChatUI.tsx`:
   - Verify `data-ai-chat-input` exists on textarea (line ~744)
   - Verify `data-ai-slash-list` exists on slash suggestions (line ~751)
   - Add `data-ai-processing-status` to the Processing status div

3. Edit `e2e/ai-sidebar-slash-and-toasts.spec.ts`:
   - Change selector from `getByRole('complementary', { name: 'AI Chat Sidebar' })` to `locator('[data-ai-sidebar]')`
   - Remove the try/catch fallback to window.SVMAI
   - Change test.describe.skip back to test.describe

4. Run test to verify it passes:
   ```bash
   npm run test:e2e -- e2e/ai-sidebar-slash-and-toasts.spec.ts
   ```

**Acceptance:** E2E test passes consistently without flaky selectors.

### Task 0.2: Wire AbortController for True Cancellation
**Status:** Ready
**Priority:** High
**Effort:** 1-2 hours

**What:** Replace the current best-effort cancel with true AbortSignal propagation through the agent execution pipeline.

**Details:**
1. Edit `components/ai/hooks/useAIChatTabs.ts`:
   - Add `abortController: AbortController | null` to state
   - In `cancel()`, call `abortController?.abort()` before setting cancelRequested
   - Pass AbortSignal to agent methods

2. Edit `components/ai/core/SolanaAgent.ts`:
   - Add `signal?: AbortSignal` parameter to `executeAction` and `streamResponse`
   - In tool execution loops, check `signal.aborted` before each step
   - Wrap fetch calls with `signal` parameter
   - Throw `new Error('Operation aborted')` when signal is aborted

3. Edit streaming response handlers:
   - Pass AbortSignal to streaming fetch calls
   - Handle AbortError specifically (don't log as regular errors)

4. Update unit tests:
   - Add test for `useAIChatTabs.cancel.test.tsx` covering AbortController behavior
   - Mock AbortController and verify abort() is called

**Acceptance:** Clicking Cancel during tool execution immediately stops all network requests and clears processing state.

### Task 0.3: Add Action Feed Progress Indicators
**Status:** Ready
**Priority:** Medium
**Effort:** 1 hour

**What:** Show real-time step progress in the Agent Actions list with better visual feedback.

**Details:**
1. Edit `components/ai/ChatUI.tsx` agent actions section:
   - Add step duration display: calculate `Date.now() - action.startTime` for in_progress actions
   - Add pulsing animation to in_progress status dots
   - Add "Retry" button for failed actions (calls `onRetryAction`)
   - Add step index/total when available: "Step 2 of 4"

2. Update `components/ai/types.ts`:
   - Add `startTime?: number` to AgentAction interface
   - Add `stepIndex?: number` and `totalSteps?: number` fields
   - Add `retryCount?: number` field

3. Edit the agent executor to populate timing data:
   - Set `startTime: Date.now()` when action starts
   - Update with step progress when available

4. Style improvements:
   - Make failed actions more prominent (red border)
   - Add hover states for retry buttons
   - Ensure progress animations are smooth

**Acceptance:** User sees live progress for multi-step actions, can retry failed steps, and timing info is accurate.

### Task 0.4: AI Sidebar UI Skeleton (Agentic Layout)
**Status:** Ready
**Priority:** High
**Effort:** 3-4 hours

**What:** Build the structural sections of the enhanced AI sidebar per the ASCII design: context awareness, active investigation with progress bar, chat CTAs, quick templates, recent findings, investigation history, and settings.

**Details:**
1. Components (placeholders, typed props):
   - `components/ai/agentic/InvestigationControlPanel.tsx`
   - `components/ai/agentic/TemplateSelector.tsx`
   - `components/ai/agentic/FindingsDisplay.tsx`
   - `components/ai/agentic/InvestigationHistory.tsx`
   - `components/ai/agentic/ProgressVisualization.tsx`
   - Mobile stubs under `components/ai/agentic/mobile/`
2. Integrate into `AIChatSidebar.tsx` with responsive layout and stable selectors (`data-ai-context`, `data-ai-active-investigation`, etc.)
3. Defer complex visuals/graphs to Phase 4.4

**Acceptance:** Sidebar renders the planned sections without breaking existing chat; feature-flag ready; selectors stable for tests.

## Phase 1: Agent Core Architecture (1 week)

### Task 1.1: Design Planning Contract
**Status:** Ready
**Priority:** Critical
**Effort:** 2-3 hours

**What:** Define the data structures and interfaces for agent planning, execution, and results.

**Details:**
1. Create `components/ai/core/types.ts`:
   ```typescript
   export interface AgentPlan {
     id: string;
     steps: AgentStep[];
     estimatedCost: number;
     estimatedTime: number;
     summaryFields: string[];
   }

   export interface AgentStep {
     id: string;
     tool: string;
     input: Record<string, any>;
     dependencies?: string[];
     timeout: number;
     retryPolicy: 'none' | 'exponential' | 'linear';
     maxRetries: number;
   }

   export interface StepResult {
     stepId: string;
     status: 'success' | 'error' | 'timeout' | 'cancelled';
     output?: any;
     error?: string;
     duration: number;
     retryCount: number;
   }

   export interface ToolDefinition {
     name: string;
     description: string;
     inputSchema: ZodSchema;
     outputSchema: ZodSchema;
     timeout: number;
     costEstimate: number;
     concurrencyTag?: string;
     execute: (context: ToolContext, input: any, signal?: AbortSignal) => Promise<any>;
   }
   ```

2. Create planning context interface:
   ```typescript
   export interface PlanningContext {
     prompt: string;
     pageContext?: { kind: 'tx' | 'account'; value: string };
     sessionHistory?: string;
     budget: { tokens: number; timeMs: number; steps: number };
     userPreferences?: Record<string, any>;
   }
   ```

3. Create step event types for streaming:
   ```typescript
   export type StepEvent = 
     | { type: 'plan-start'; planId: string }
     | { type: 'plan-complete'; plan: AgentPlan }
     | { type: 'step-start'; stepId: string; tool: string; input: any }
     | { type: 'step-progress'; stepId: string; message: string }
     | { type: 'step-complete'; stepId: string; result: StepResult }
     | { type: 'execution-complete'; results: StepResult[]; summary: string };
   ```

**Acceptance:** All interfaces are well-typed, documented, and ready for implementation.

### Task 1.2: Implement Central Tool Registry
**Status:** Blocked by Task 1.1
**Priority:** Critical
**Effort:** 3-4 hours

**What:** Create a centralized registry for all agent tools with validation, metadata, and execution framework.

**Details:**
1. Create `components/ai/core/ToolRegistry.ts`:
   - Implement `ToolRegistry` class with `register()`, `get()`, `list()`, `validate()` methods
   - Add tool discovery from directory scanning
   - Implement input/output validation using Zod schemas
   - Add tool categorization (blockchain, analysis, utility, etc.)

2. Create base tool directory structure:
   ```
   components/ai/tools/
   ├── blockchain/
   │   ├── fetchTransaction.ts
   │   ├── fetchAccount.ts
   │   └── getNetworkStats.ts
   ├── analysis/
   │   ├── parseTransaction.ts
   │   ├── walletSummary.ts
   │   └── riskAnalysis.ts
   └── utility/
       ├── search.ts
       └── format.ts
   ```

3. Implement safety mechanisms:
   - Per-tool timeout enforcement
   - Input size limits (prevent DoS)
   - Output truncation for large responses
   - Concurrency limiting by tag
   - Error classification (retryable vs fatal)

4. Add tool execution context:
   ```typescript
   interface ToolContext {
     connection: Connection; // Existing Solana connection
     signal?: AbortSignal;
     userId?: string;
     requestId: string;
     logger: Logger;
   }
   ```

**Acceptance:** Registry can discover, validate, and execute tools safely with proper error handling.

### Task 1.3: Build Core Planning Engine
**Status:** Blocked by Task 1.1, 1.2
**Priority:** Critical
**Effort:** 4-5 hours

**What:** Implement the agent planner that converts user prompts into executable tool sequences.

**Details:**
1. Create `components/ai/core/Planner.ts`:
   - Implement `createPlan(context: PlanningContext): Promise<AgentPlan>`
   - Use LLM to analyze prompt and generate tool sequence
   - Include fallback rule-based planning for common patterns
   - Validate plan against budget constraints
   - Optimize for common multi-step patterns

2. Add prompt templates for planning:
   ```
   You are an expert Solana blockchain analyst. Create a plan to answer: "{prompt}"
   
   Available tools: {toolDescriptions}
   Context: {pageContext}
   Budget: {budget}
   
   Respond with a JSON plan following this schema: {planSchema}
   Prefer 1-3 steps. Be specific with tool inputs.
   ```

3. Implement intelligent step ordering:
   - Resolve dependencies automatically
   - Parallelize independent steps where possible
   - Optimize for user experience (show progress quickly)

4. Add plan validation:
   - Check tool availability
   - Validate input schemas
   - Estimate costs and timeouts
   - Ensure step dependencies are resolvable

5. Create fallback planning for common cases:
   - Transaction lookup: fetchTx → parseTx → relatedTxs
   - Wallet analysis: fetchAccount → walletSummary → riskAnalysis
   - Network status: getNetworkStats only
   - Slash commands: direct tool mapping

**Acceptance:** Planner generates valid, efficient plans for diverse prompts with appropriate fallbacks.

### Task 1.4: Implement Step Executor
**Status:** Blocked by Task 1.2, 1.3
**Priority:** Critical
**Effort:** 3-4 hours

**What:** Build the execution engine that runs agent plans step-by-step with proper error handling and streaming.

**Details:**
1. Create `components/ai/core/Executor.ts`:
   - Implement `executePlan(plan: AgentPlan, eventCallback: (event: StepEvent) => void): Promise<StepResult[]>`
   - Handle step dependencies and ordering
   - Execute steps with timeout and retry logic
   - Stream progress events to UI
   - Support cancellation via AbortSignal

2. Add step execution logic:
   - Validate step inputs before execution
   - Measure execution time
   - Handle tool errors gracefully
   - Implement retry policies (exponential backoff, linear, none)
   - Log execution details for debugging

3. Implement streaming progress:
   - Emit step-start events with tool info
   - Send progress updates during long operations
   - Stream step completion with results
   - Handle partial results on cancellation

4. Add result aggregation:
   - Collect outputs from all steps
   - Handle interdependent step data
   - Generate execution summary
   - Format results for UI consumption

5. Error handling strategies:
   - Classify errors (network, validation, tool-specific)
   - Implement graceful degradation
   - Provide actionable error messages
   - Support partial completion scenarios

**Acceptance:** Executor runs plans reliably, streams progress, handles errors gracefully, and supports cancellation.

### Task 1.5: Build Initial Tool Set
**Status:** Blocked by Task 1.2
**Priority:** High
**Effort:** 6-8 hours

**What:** Implement the core tools needed for basic agent functionality.

**Details:**

#### Tool 1: fetchTransaction
File: `components/ai/tools/blockchain/fetchTransaction.ts`
```typescript
export const fetchTransaction: ToolDefinition = {
  name: 'fetchTransaction',
  description: 'Fetch detailed transaction data by signature',
  inputSchema: z.object({
    signature: z.string().min(87).max(88),
    commitment: z.enum(['confirmed', 'finalized']).default('confirmed')
  }),
  outputSchema: z.object({
    signature: z.string(),
    slot: z.number(),
    blockTime: z.number().nullable(),
    confirmationStatus: z.string(),
    fee: z.number(),
    success: z.boolean(),
    logs: z.array(z.string()).optional()
  }),
  timeout: 10000,
  costEstimate: 1,
  execute: async (context, input, signal) => {
    // Implementation using existing connection
  }
};
```

#### Tool 2: parseTransaction  
File: `components/ai/tools/analysis/parseTransaction.ts`
- Parse instruction data using existing parsers
- Extract token transfers, program interactions
- Identify transaction type and purpose
- Format human-readable summary

#### Tool 3: walletSummary
File: `components/ai/tools/analysis/walletSummary.ts`
- Fetch account balance and tokens
- Get recent transaction history (last 10-20)
- Calculate activity metrics
- Identify top interacted programs

#### Tool 4: getNetworkStats
File: `components/ai/tools/blockchain/getNetworkStats.ts`
- Current TPS, epoch info, validator count
- Recent performance samples
- Network health indicators

#### Tool 5: relatedTransactions
File: `components/ai/tools/analysis/relatedTransactions.ts`
- Find transactions involving same accounts
- Limit depth to prevent infinite expansion
- Return formatted relationship graph

**Acceptance:** All tools work independently, have proper schemas, handle errors, and integrate with the registry.

### Task 1.6: Virtual Navigation Driver + Progress Stream
**Status:** Ready
**Priority:** High
**Effort:** 4-6 hours

**What:** Implement virtual navigation (no page change) that fetches via APIs and streams progress.

**Details:**
1. Core: `components/ai/core/VirtualNavigation.ts` with `VirtualNavigationStep` and `NavigationController`
2. SSE (MVP): `app/api/agentic/websocket/progress/route.ts` using server-sent events helpers; per-session streams with `emitProgressEvent/emitCompletionEvent`
3. UI: Wire `ProgressVisualization` to stream; show path steps with statuses and current virtual page
4. Safety: concurrency limits; never mutate window.location; all data via fetch

**Acceptance:** Users stay on the current page while a live virtual path and step updates stream into the sidebar.

## Phase 2: Enhanced Tooling & Intelligence (1-2 weeks)

### Task 2.1: Add Transaction Simulation Tool
**Status:** Blocked by Phase 1
**Priority:** High
**Effort:** 4-5 hours

**What:** Implement transaction simulation for risk analysis and preview.

**Details:**
1. Create `components/ai/tools/blockchain/simulateTransaction.ts`:
   - Use Solana's `simulateTransaction` RPC method
   - Parse simulation results and errors
   - Extract account changes and log messages
   - Format success/failure predictions

2. Add comprehensive error handling:
   - Parse simulation errors meaningfully
   - Identify common failure reasons
   - Suggest fixes where possible
   - Handle timeout scenarios gracefully

3. Integrate with transaction analysis:
   - Auto-simulate when analyzing transactions
   - Show "would succeed/fail" indicators
   - Highlight potential issues

**Acceptance:** Simulation tool provides accurate predictions with helpful error explanations.

### Task 2.2: Implement Address Clustering
**Status:** Blocked by Phase 1
**Priority:** Medium
**Effort:** 5-6 hours

**What:** Build naive address clustering based on transaction patterns.

**Details:**
1. Create `components/ai/tools/analysis/clusterAddresses.ts`:
   - Analyze co-spending patterns (accounts that frequently transact together)
   - Identify co-signing relationships
   - Find common program interactions
   - Limit cluster size to prevent performance issues

2. Add clustering algorithms:
   - Connected components for direct relationships
   - Weighted scoring for relationship strength
   - Time-based clustering (recent vs historical)
   - Confidence scoring for each cluster

3. Implement safety limits:
   - Max cluster size (e.g., 50 addresses)
   - Depth limits for graph traversal
   - Timeout protection for large clusters
   - Rate limiting for RPC calls

**Acceptance:** Clustering finds meaningful address relationships without performance issues.

### Task 2.3: Build DeFi Protocol Analyzers
**Status:** Blocked by Phase 1
**Priority:** Medium
**Effort:** 8-10 hours

**What:** Create specialized parsers for major DeFi protocols.

**Details:**
1. Create protocol-specific tools:
   - `tools/defi/jupiterAnalyzer.ts` - Jupiter swap analysis
   - `tools/defi/raydiumAnalyzer.ts` - Raydium LP operations
   - `tools/defi/serumAnalyzer.ts` - Serum market trades
   - `tools/defi/lendingAnalyzer.ts` - Solend/Mango positions

2. Standardize DeFi output format:
   ```typescript
   interface DeFiOperation {
     protocol: string;
     type: 'swap' | 'lp_add' | 'lp_remove' | 'lend' | 'borrow' | 'trade';
     tokens: TokenAmount[];
     value: number; // USD estimate
     fees: TokenAmount[];
     impact: number; // price impact %
   }
   ```

3. Add value estimation:
   - Token price lookups (cached)
   - USD value calculations
   - Fee analysis
   - Price impact estimation

**Acceptance:** DeFi tools accurately parse major protocol operations with value estimates.

### Task 2.4: Implement Risk Scoring
**Status:** Blocked by Phase 1
**Priority:** Medium
**Effort:** 4-5 hours

**What:** Build heuristic risk analysis for addresses and transactions.

**Details:**
1. Create `components/ai/tools/analysis/riskAnalysis.ts`:
   - Account age and activity patterns
   - Interaction with known risky programs
   - Unusual transaction patterns
   - Large value movements

2. Risk factors to analyze:
   - New account activity (< 7 days old)
   - High-frequency transactions
   - Mixer/tumbler interactions
   - Failed transaction ratios
   - Large value concentrations

3. Generate risk scores:
   - 0-100 scale with clear thresholds
   - Categorized risk types (fraud, technical, market)
   - Confidence intervals
   - Explanation of risk factors

**Acceptance:** Risk scoring provides meaningful insights without false positives.

## Phase 3: Memory & Context (1 week)

### Task 3.1: Implement Session Memory
**Status:** Blocked by Phase 1
**Priority:** Medium
**Effort:** 3-4 hours

**What:** Add session-level memory to maintain context across multiple interactions.

**Details:**
1. Create `components/ai/core/SessionMemory.ts`:
   - Store conversation history summaries
   - Track previously analyzed entities (tx/accounts)
   - Maintain user preferences and patterns
   - Implement memory compression for long sessions

2. Add memory integration to planner:
   - Include relevant memory in planning context
   - Avoid re-analyzing recently covered entities
   - Reference previous findings when relevant
   - Maintain continuity in multi-turn conversations

3. Implement memory persistence:
   - Store in localStorage for session persistence
   - Add memory export/import functionality
   - Clean up old or irrelevant memories
   - Respect privacy preferences

**Acceptance:** Agent maintains useful context across conversation without degrading performance.

### Task 3.2: Build Knowledge Base Integration
**Status:** Blocked by Phase 1
**Priority:** Medium
**Effort:** 5-6 hours

**What:** Integrate Qdrant vector search for documentation and knowledge retrieval.

**Details:**
1. Create `components/ai/tools/utility/knowledgeSearch.ts`:
   - Query existing Qdrant instance for relevant docs
   - Search conversation history for similar patterns
   - Retrieve program documentation
   - Find related help articles

2. Add knowledge integration:
   - Include relevant docs in planning context
   - Provide citation links in responses
   - Suggest related topics
   - Learn from user feedback

3. Implement search optimization:
   - Semantic query enhancement
   - Result relevance scoring
   - Context-aware filtering
   - Response caching

**Acceptance:** Agent provides accurate information with proper citations and context.

### Task 3.3: Add Deterministic Replay
**Status:** Blocked by Phase 1
**Priority:** Low
**Effort:** 2-3 hours

**What:** Enable reproducible agent runs for debugging and sharing.

**Details:**
1. Record execution parameters:
   - Input prompt and context
   - Tool versions and configurations
   - RPC responses (for replay)
   - Random seeds and timestamps

2. Implement replay functionality:
   - Recreate identical execution environment
   - Replay with cached responses
   - Compare results for debugging
   - Share reproducible runs

3. Add replay UI:
   - "Re-run" button on completed analyses
   - Replay with different parameters
   - Side-by-side result comparison
   - Export replay data

**Acceptance:** Agent runs can be perfectly reproduced for debugging and sharing.

## Phase 4: UX & Shareability (Parallel to Phase 2-3)

### Task 4.1: Build Structured Result Rendering
**Status:** Blocked by Phase 1
**Priority:** High
**Effort:** 4-5 hours

**What:** Create rich UI components for displaying structured agent results.

**Details:**
1. Create result components:
   - `components/ai/results/TransactionBreakdown.tsx` - Detailed tx analysis
   - `components/ai/results/WalletSummary.tsx` - Account overview
   - `components/ai/results/RiskReport.tsx` - Risk analysis display
   - `components/ai/results/NetworkStats.tsx` - Network metrics

2. Add interactive elements:
   - Expandable sections for detailed data
   - Click-through links to explorers
   - Copy-to-clipboard for addresses/signatures
   - Export individual result sections

3. Implement responsive design:
   - Mobile-optimized layouts
   - Collapsible detailed sections
   - Touch-friendly interactions
   - Proper loading states

**Acceptance:** Agent results are beautifully formatted with intuitive interactions.

### Task 4.2: Enhanced Export Functionality
**Status:** Ready (extends existing)
**Priority:** Medium
**Effort:** 2-3 hours

**What:** Extend existing export to include agent action logs and structured results.

**Details:**
1. Extend existing export in `components/ai/AIChatSidebar.tsx`:
   - Include agent plan and execution log
   - Add structured result data (JSON format)
   - Include timing and performance data
   - Add metadata (timestamp, version, settings)

2. Add export format options:
   - Markdown (current + enhanced)
   - JSON (structured data)
   - CSV (for tabular results)
   - PDF (formatted report)

3. Implement export templates:
   - Investigation report template
   - Audit trail format
   - Analysis summary template
   - Technical deep-dive format

**Acceptance:** Exports contain comprehensive information in multiple useful formats.

### Task 4.3: Implement Deep Link Sharing
**Status:** Ready (extends existing)
**Priority:** Medium
**Effort:** 3-4 hours

**What:** Enable sharing of agent analyses via URLs with reproducible results.

**Details:**
1. Extend existing share functionality in `components/ai/AIChatSidebar.tsx`:
   - Encode agent plan hash in URL parameters
   - Include execution parameters
   - Add result caching for shared links
   - Generate shareable analysis URLs

2. Add sharing options:
   - Direct link sharing (current + enhanced)
   - Embed code for external sites
   - Social media optimized links
   - QR codes for mobile sharing

3. Implement link handling:
   - Parse shared URLs on page load
   - Recreate agent analysis from URL
   - Handle expired or invalid shares
   - Show preview metadata for shared links

**Acceptance:** Agent analyses can be easily shared and reproduced via URLs.

### Task 4.4: Full Investigation Visualization (Expanded View)
**Status:** Ready
**Priority:** Medium
**Effort:** 5-7 hours

**What:** Deliver expanded Investigation Progress Visualization: navigation map, minimal relationship graph, live findings stream with insights, and controls (zoom/layout/style/export).

**Details:**
1. Enhance `ProgressVisualization.tsx` with a compact graph region; integrate Cytoscape/D3 (read-only) for relationship nodes
2. Add `components/ai/agentic/NavigationMapView.tsx` (initial minimal interactivity)
3. Live findings: append structured events with timestamps; render a Key Insights block
4. Export: integrate with Enhanced Export to include PNG/SVG snapshots

**Acceptance:** Users can open an expanded view to see a small live relationship map and findings stream updating during execution.

## Phase 5: Observability & Testing (Parallel to all phases)

### Task 5.1: Add Comprehensive Telemetry
**Status:** Ready
**Priority:** Medium
**Effort:** 3-4 hours

**What:** Implement detailed logging and metrics for agent performance monitoring.

**Details:**
1. Create `components/ai/core/Telemetry.ts`:
   - Track plan generation performance
   - Monitor tool execution times
   - Log error rates and types
   - Measure user satisfaction metrics

2. Add performance monitoring:
   - Step execution duration
   - Memory usage patterns
   - Network request efficiency
   - Cache hit/miss rates

3. Implement error tracking:
   - Categorize error types
   - Track error frequency by tool
   - Monitor timeout patterns
   - Log user cancellation rates

4. Add usage analytics:
   - Most popular tool combinations
   - Common failure patterns
   - User workflow analysis
   - Feature adoption metrics

**Acceptance:** Comprehensive metrics provide insights for optimization and debugging.

### Task 5.2: Build Test Infrastructure
**Status:** Ready
**Priority:** Critical
**Effort:** 5-6 hours

**What:** Create comprehensive test coverage for all agent components.

**Details:**
1. Unit tests for core components:
   - `__tests__/Planner.test.ts` - Plan generation logic
   - `__tests__/Executor.test.ts` - Execution engine
   - `__tests__/ToolRegistry.test.ts` - Tool registration and validation
   - Individual tool tests with mocked dependencies

2. Integration tests:
   - `__tests__/integration/AgentFlow.test.ts` - End-to-end agent workflows
   - `__tests__/integration/ToolChaining.test.ts` - Multi-step tool execution
   - `__tests__/integration/ErrorHandling.test.ts` - Error scenarios

3. E2E test extensions:
   - Add agent execution to existing E2E suite
   - Test cancellation during multi-step operations
   - Verify structured result rendering
   - Test export and sharing functionality

4. Performance tests:
   - Load testing for concurrent agent runs
   - Memory leak detection
   - Tool execution benchmarks
   - UI responsiveness under load

**Acceptance:** 90%+ test coverage with reliable CI/CD integration.

### Task 5.3: Implement Safety & Rate Limiting
**Status:** Ready
**Priority:** High
**Effort:** 2-3 hours

**What:** Add comprehensive safety mechanisms to prevent abuse and ensure stability.

**Details:**
1. Add execution limits:
   - Max concurrent agent runs per user
   - Token budget enforcement per session
   - Wall time limits for long operations
   - Step count limits to prevent infinite loops

2. Implement rate limiting:
   - Tool execution frequency limits
   - RPC call rate limiting per tool
   - User-level request throttling
   - Graceful degradation under load

3. Add resource monitoring:
   - Memory usage tracking
   - CPU utilization monitoring
   - Network bandwidth limits
   - Storage quota enforcement

4. Create safety alerts:
   - Unusual usage pattern detection
   - Resource exhaustion warnings
   - Error spike notifications
   - Performance degradation alerts

**Acceptance:** System remains stable and responsive under various load conditions.

## Implementation Priority & Timeline

### Week 1: Foundation (Phase 0 + Phase 1 Start)
- [ ] Task 0.0: Monetization MVP (SVMAI gate + UI)
- [ ] Task 0.1: Stabilize E2E Test Selectors
- [ ] Task 0.2: Wire AbortController
- [ ] Task 0.3: Action Feed Progress
- [ ] Task 0.4: AI Sidebar UI Skeleton
- [ ] Task 1.1: Planning Contract
- [ ] Task 1.2: Tool Registry

### Week 2: Core Engine (Phase 1 Complete)
- [ ] Task 1.3: Planning Engine
- [ ] Task 1.4: Step Executor  
- [ ] Task 1.5: Initial Tool Set
- [ ] Task 1.6: Virtual Navigation Driver + Progress Stream
- [ ] Task 5.2: Basic Test Infrastructure

### Week 3: Enhanced Tools (Phase 2 Start)
- [ ] Task 2.1: Transaction Simulation
- [ ] Task 2.2: Address Clustering
- [ ] Task 4.1: Structured Results
- [ ] Task 5.1: Telemetry

### Week 4: Intelligence & UX (Phase 2-4)
- [ ] Task 2.3: DeFi Analyzers
- [ ] Task 2.4: Risk Scoring
- [ ] Task 3.1: Session Memory
- [ ] Task 4.2: Enhanced Export
- [ ] Task 4.4: Full Investigation Visualization

### Week 5: Polish & Optimization (Phase 3-5)
- [ ] Task 3.2: Knowledge Integration
- [ ] Task 4.3: Deep Link Sharing
- [ ] Task 5.3: Safety & Rate Limiting
- [ ] Task 3.3: Deterministic Replay

## Success Metrics

### Technical Metrics
- **Plan Success Rate:** >90% of plans execute without critical errors
- **Response Time:** <3s for simple queries, <10s for complex multi-step
- **Accuracy:** >95% correct information in structured outputs
- **Availability:** <2% error rate across all tool executions

### User Experience Metrics  
- **Completion Rate:** >80% of started analyses completed
- **Satisfaction:** >4.5/5 average rating for agent responses
- **Adoption:** >50% of sidebar usage includes agent features
- **Retention:** >70% of users return to use agent within 7 days

### Quality Metrics
- **Test Coverage:** >90% code coverage across all components
- **Performance:** No memory leaks, <100ms UI response time
- **Security:** Zero successful abuse attempts, all inputs validated
- **Documentation:** 100% of public APIs documented with examples

## Risk Mitigation

### Technical Risks
- **RPC Rate Limits:** Implement caching and request batching
- **Large Response Handling:** Add response truncation and pagination
- **Tool Failures:** Graceful degradation and fallback strategies
- **Memory Leaks:** Regular monitoring and automated testing

### User Experience Risks
- **Slow Responses:** Show progress indicators and partial results
- **Complex Results:** Provide layered detail levels and summaries
- **Error Messages:** Clear, actionable error explanations
- **Learning Curve:** Progressive disclosure and contextual help

### Business Risks
- **Resource Costs:** Monitor and cap expensive operations
- **Abuse Prevention:** Rate limiting and usage monitoring
- **Data Privacy:** Clear data handling and retention policies
- **Scalability:** Horizontal scaling preparation for growth

## Dependencies & Constraints

### Hard Constraints
- **NO RPC CHANGES:** Must use existing connection infrastructure
- **Browser Compatibility:** Support modern browsers (Chrome 90+, Firefox 88+)
- **Performance:** UI must remain responsive during agent operations
- **Security:** All user inputs must be validated and sanitized

### External Dependencies
- **Solana RPC:** Reliable access to blockchain data
- **Qdrant:** Vector search functionality for knowledge base
- **LLM API:** Planning and response generation capabilities
- **UI Components:** Existing design system and component library

### Resource Requirements
- **Development:** 1 senior developer, 5 weeks full-time
- **Testing:** Access to testnet and mainnet for validation
- **Infrastructure:** No additional backend services required
- **Monitoring:** Integration with existing logging and metrics systems

---

**Last Updated:** August 13, 2025
**Status:** Ready for implementation
**Next Review:** Weekly progress check-ins, milestone-based reviews
