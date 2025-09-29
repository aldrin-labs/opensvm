# Implementation Plan

## Overview
Fix critical AI sidebar failures including execution deadlock, query misrouting, tool timeouts, and account parameter issues to restore full functionality.

The AI sidebar is experiencing systematic failures affecting 83% of all queries. The primary issues are execution plans that never complete, query misinterpretation, and incorrect account analysis. This implementation will address these critical issues through targeted fixes to the query routing, execution pipeline, and parameter validation systems.

## Types
Enhanced type definitions for improved query handling and execution tracking.

### ExecutionState
```typescript
interface ExecutionState {
  planGenerated: boolean;
  planExecuting: boolean;
  planCompleted: boolean;
  executionStartTime: number;
  executionTimeout: number;
  retryCount: number;
  lastError?: string;
}
```

### QueryClassification  
```typescript
enum QueryType {
  DIRECT_RPC = 'direct_rpc',      // Network stats, TPS, epoch info
  KNOWLEDGE_BASED = 'knowledge',   // General questions
  COMPLEX_ANALYSIS = 'analysis',   // Account/transaction analysis
  PLAN_REQUIRED = 'plan'          // Multi-step operations
}

interface ClassifiedQuery {
  type: QueryType;
  confidence: number;
  suggestedTools: string[];
  requiresPlan: boolean;
}
```

### ToolExecutionResult
```typescript
interface ToolExecutionResult {
  handled: boolean;
  response?: any;
  partialData?: any;
  executionTime: number;
  toolsAttempted: string[];
  errors?: string[];
}
```

## Files
Detailed breakdown of file modifications required for the fix.

### New Files:
- `lib/ai/query-classifier.ts` - Query classification system
- `lib/ai/execution-monitor.ts` - Execution state tracking
- `lib/ai/parameter-validator.ts` - Parameter validation utilities
- `__tests__/ai-sidebar-fixes.test.ts` - Integration tests

### Existing Files to Modify:
- `components/ai/ChatUI.tsx` - Expand query detection, add execution tracking
- `components/ai/AIChatSidebar.tsx` - Fix plan-to-execution flow
- `app/api/getAnswer/route.ts` - Improve tool fallback logic
- `app/api/getAnswer/tools/registry.ts` - Fix timeout strategy
- `app/api/getAnswer/tools/accountAnalysis.ts` - Fix parameter parsing
- `app/api/getAnswer/tools/aiPlanExecution.ts` - Add execution monitoring

### Configuration Updates:
- `.env.example` - Add timeout configuration variables
- `next.config.mjs` - Add monitoring endpoints

## Functions
Key functions to be created or modified.

### New Functions:

**classifyQuery** (lib/ai/query-classifier.ts)
- Signature: `(query: string) => ClassifiedQuery`
- Purpose: Categorize queries to route them appropriately
- Returns: Classification with confidence score

**monitorExecution** (lib/ai/execution-monitor.ts)  
- Signature: `(planId: string, state: ExecutionState) => void`
- Purpose: Track execution progress and detect stuck states
- Side effects: Emits events for UI updates

**validateAccountAddress** (lib/ai/parameter-validator.ts)
- Signature: `(address: string) => { valid: boolean; normalized: string }`
- Purpose: Validate and normalize Solana addresses
- Returns: Validation result with corrected address

### Modified Functions:

**processTabMessage** (components/ai/AIChatSidebar.tsx)
- Current: Processes messages through agents
- Change: Add execution state tracking and automatic plan execution
- New behavior: After plan generation, trigger execution phase

**handleLLMFallback** (app/api/getAnswer/route.ts)
- Current: Falls back to LLM when tools fail
- Change: Use partial data from failed tools
- New behavior: Provide comprehensive response even with partial data

**executeTools** (app/api/getAnswer/tools/registry.ts)
- Current: 90-second timeout for primary tools
- Change: Progressive timeout strategy (15s → 30s → 60s)
- New behavior: Continue with partial results on timeout

## Classes
Class modifications required for the implementation.

### Modified Classes:

**ToolRegistry** (app/api/getAnswer/tools/registry.ts)
- Current: Sequential primary, parallel fallback execution
- Modifications:
  - Add progressive timeout strategy
  - Implement partial result collection
  - Add execution progress events
- New methods:
  - `executeWithTimeout(tool, timeout): Promise<ToolResult>`
  - `collectPartialResults(): any`

**StabilityMonitor** (app/api/getAnswer/route.ts)
- Current: Basic request/failure tracking
- Modifications:
  - Add execution state tracking
  - Track timeout patterns
  - Add query type metrics
- New methods:
  - `recordExecutionState(state: ExecutionState): void`
  - `getExecutionMetrics(): ExecutionMetrics`

## Dependencies
New packages and version updates required.

### New Dependencies:
- `@solana/addresses`: "^2.0.0" - Address validation utilities
- `p-timeout`: "^6.1.2" - Promise timeout utilities
- `eventemitter3`: "^5.0.1" - Event emission for monitoring

### Updates:
- `@solana/web3.js`: Update to latest for improved RPC handling
- `together-ai`: Ensure latest version for stability

## Testing
Comprehensive testing strategy for validation.

### Integration Tests:
- `__tests__/ai-sidebar-fixes.test.ts`
  - Test query classification accuracy
  - Test execution monitoring
  - Test parameter validation
  - Test timeout handling

### E2E Tests:
- Update existing E2E tests to verify:
  - Execution plans complete within 30 seconds
  - Direct queries bypass planning
  - Account addresses are correctly parsed
  - Partial results are returned on timeout

### Manual Testing Checklist:
1. Test TPS query - should return network data, not market data
2. Test account analysis - should analyze correct account
3. Test "What is Solana?" - should use knowledge base
4. Test complex multi-step query - should complete execution

## Implementation Order
Logical sequence to minimize conflicts and ensure successful integration.

1. **Create query classifier** - Foundation for routing improvements
2. **Add parameter validation** - Fix account parsing issues
3. **Implement execution monitoring** - Track plan execution
4. **Fix ChatUI query detection** - Expand direct query patterns
5. **Update ToolRegistry timeouts** - Progressive timeout strategy
6. **Modify processTabMessage** - Add plan-to-execution flow
7. **Update getAnswer route** - Improve fallback handling
8. **Add integration tests** - Validate fixes
9. **Update E2E tests** - Ensure no regressions
10. **Deploy and monitor** - Track improvements in production
