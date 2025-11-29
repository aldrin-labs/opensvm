# Vibe Trading (Agentic Trading) - Integration Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACES                       │
├──────────────────────┬──────────────────────────────────┤
│  Command Palette     │     AI Chat Widget               │
│  (Quick Commands)    │  (Conversational Trading)        │
│                      │                                  │
│  Cmd+K               │  Multi-turn dialogue             │
│  "buy 10 SOL"        │  "I want to buy SOL"             │
│  → Immediate         │  → Clarifying questions          │
│                      │  → Trade proposal                │
│                      │  → Approval → Execution          │
└──────────────────────┴──────────────────────────────────┘
           │                          │
           ▼                          ▼
┌────────────────────┐    ┌───────────────────────────────┐
│  Command Parser    │    │  Conversational Agent         │
│                    │    │  (intent-analyzer.ts)         │
│  Regex patterns    │    │  (conversational-agent.ts)    │
│  95% confidence    │    │                               │
│  for exact syntax  │    │  LLM-powered                  │
└────────────────────┘    │  Handles vague intent         │
           │              │  Multi-turn clarification     │
           │              └───────────────────────────────┘
           │                          │
           └──────────┬───────────────┘
                      ▼
           ┌────────────────────────┐
           │  Command Executor      │
           │                        │
           │  Executes trades       │
           │  Updates UI            │
           │  Logs transactions     │
           └────────────────────────┘
```

## Current State Analysis

### ✅ BUILT (Level 1)
1. **Command Palette** (`CommandPalette.tsx`)
   - Natural language parsing (regex-based)
   - Voice input support
   - Recent commands
   - Confidence scoring

2. **Command Parser** (`command-parser.ts`)
   - Pattern matching for trades, market switching, layouts
   - 95% confidence for exact syntax
   - Structured output

3. **Command Executor** (`command-executor.ts`)
   - Executes parsed commands
   - Safety validations
   - Toast notifications

4. **AI Chat Widget** (`EnhancedAIChatWidget.tsx`)
   - RxJS observables for agent state
   - Plan generation
   - Autonomous mode (basic)

### 🚧 MISSING (Level 2)
1. **Intent Analyzer** (`intent-analyzer.ts`) - ✅ JUST CREATED
   - LLM-powered intent extraction
   - Handles vague input
   - Generates clarifying questions
   - Creates trade proposals

2. **Conversational Agent** (`conversational-agent.ts`) - ✅ JUST CREATED
   - Multi-turn conversation state machine
   - Question → Answer → Proposal → Approval flow
   - Context retention

3. **UI Integration** - ❌ NOT YET BUILT
   - Wire conversational agent into AI Chat Widget
   - Handle clarification questions UI
   - Trade proposal approval UI

## Integration Steps

### Step 1: Update AI Chat Widget to Use Conversational Agent

**File:** `/app/trading-terminal/components/EnhancedAIChatWidget.tsx`

**Current handleSendMessage:**
```typescript
const handleSendMessage = async () => {
  const plan = await integratedAgent.generateEnhancedPlan(inputValue);
  if (plan.metrics && plan.metrics.confidence > 0.5) {
    await integratedAgent.executeEnhancedPlan(plan);
  }
};
```

**Updated handleSendMessage:**
```typescript
import { conversationalAgent } from '@/lib/trading/conversational-agent';

const [agentContext, setAgentContext] = useState({
  portfolio: {
    assets: [
      { symbol: 'SOL', amount: 10, usdValue: 2000 },
      { symbol: 'USDC', amount: 5000, usdValue: 5000 },
    ],
    totalValue: 7000,
  },
  riskProfile: 'moderate',
  recentActivity: [],
});

const handleSendMessage = async () => {
  if (!inputValue.trim()) return;

  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: inputValue.trim(),
    timestamp: new Date(),
  };

  setMessages(prev => [...prev, userMessage]);
  setInputValue('');
  setIsAgentActive(true);

  try {
    // Use conversational agent
    const response = await conversationalAgent.processMessage(
      userMessage.content,
      agentContext
    );

    const agentMessage: Message = {
      id: Date.now().toString(),
      role: 'agent',
      content: response.message,
      timestamp: new Date(),
      metadata: {
        state: response.state,
        proposal: response.proposal,
      },
    };

    setMessages(prev => [...prev, agentMessage]);

    // If proposal provided, render special UI
    if (response.proposal) {
      // Render trade proposal card with Approve/Reject buttons
    }
  } catch (error) {
    console.error('Agent error:', error);
    addAgentMessage(`Error: ${error}`, 'system');
  } finally {
    setIsAgentActive(false);
  }
};
```

### Step 2: Create Trade Proposal UI Component

**File:** `/app/trading-terminal/components/TradeProposalCard.tsx` (NEW)

```typescript
import React from 'react';
import { CheckCircle, XCircle, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TradeProposal } from '@/lib/trading/intent-analyzer';

interface TradeProposalCardProps {
  proposal: TradeProposal;
  onApprove: () => void;
  onReject: () => void;
  onModify: () => void;
}

export function TradeProposalCard({
  proposal,
  onApprove,
  onReject,
  onModify,
}: TradeProposalCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card my-2">
      <div className="text-sm font-semibold text-primary mb-3">
        📊 Trade Proposal
      </div>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Action:</span>
          <span className="font-semibold">{proposal.action}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Asset:</span>
          <span className="font-semibold">{proposal.asset}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Amount:</span>
          <span className="font-semibold">
            {proposal.amount} {proposal.asset} (~${proposal.usdValue.toFixed(2)})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Confidence:</span>
          <span className="font-semibold">
            {Math.round(proposal.confidence * 100)}%
          </span>
        </div>
      </div>

      <div className="p-3 bg-info/10 rounded text-xs mb-4">
        <div className="font-semibold text-info mb-1">Reasoning</div>
        <div className="text-foreground">{proposal.reasoning}</div>
      </div>

      <div className="p-3 bg-success/10 rounded text-xs mb-4">
        <div className="font-semibold text-success mb-1">Expected Outcome</div>
        <div className="text-foreground">{proposal.expectedOutcome}</div>
      </div>

      {proposal.risks.length > 0 && (
        <div className="p-3 bg-destructive/10 rounded text-xs mb-4">
          <div className="font-semibold text-destructive mb-1">Risks</div>
          <ul className="list-disc list-inside space-y-1 text-foreground">
            {proposal.risks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={onApprove}
          className="flex-1 bg-success hover:bg-success/90 text-white"
          size="sm"
        >
          <CheckCircle size={14} className="mr-2" />
          Approve
        </Button>
        <Button
          onClick={onReject}
          variant="outline"
          className="flex-1"
          size="sm"
        >
          <XCircle size={14} className="mr-2" />
          Reject
        </Button>
        <Button
          onClick={onModify}
          variant="outline"
          size="sm"
        >
          <Edit size={14} />
        </Button>
      </div>
    </div>
  );
}
```

### Step 3: Handle Proposal Approval in Chat Widget

```typescript
// In EnhancedAIChatWidget.tsx

const handleProposalAction = async (action: 'approve' | 'reject' | 'modify') => {
  setIsAgentActive(true);

  const response = await conversationalAgent.processMessage(
    action,
    agentContext
  );

  const agentMessage: Message = {
    id: Date.now().toString(),
    role: 'agent',
    content: response.message,
    timestamp: new Date(),
    metadata: {
      state: response.state,
      completed: response.completed,
    },
  };

  setMessages(prev => [...prev, agentMessage]);
  setIsAgentActive(false);
};

// In message rendering:
{message.metadata?.proposal && (
  <TradeProposalCard
    proposal={message.metadata.proposal}
    onApprove={() => handleProposalAction('approve')}
    onReject={() => handleProposalAction('reject')}
    onModify={() => handleProposalAction('modify')}
  />
)}
```

## Example Conversation Flows

### Flow 1: Vague Intent → Clarification → Execution

```
User: "I want to buy SOL"

Agent: I understand you want to BUY SOL.
       How much SOL do you want to buy? What's your budget?

User: "$500"

Agent: At current price ($200), that's 2.5 SOL. Do you want a stop loss?

User: "Yes, 10%"

Agent: [Trade Proposal Card]
       • Action: BUY
       • Asset: SOL
       • Amount: 2.5 SOL (~$500)
       • Stop Loss: $180 (-10%)
       • Confidence: 85%

       [Approve] [Reject] [Modify]

User: [Clicks Approve]

Agent: ✅ Trade Executed Successfully!
       Bought 2.5 SOL at market price.
       Stop loss set at $180.

       Is there anything else you'd like to do?
```

### Flow 2: Unclear Intent → Clarification → Rejection

```
User: "I'm worried about a crash"

Agent: I understand you want to REDUCE RISK.

       Should I:
       • Convert risky assets to stablecoins?
       • Set stop losses on existing positions?
       • Both?

User: "Set stop losses"

Agent: [Trade Proposal Card]
       • Action: SET STOP LOSS
       • Assets: SOL (10), BTC (0.1)
       • Stop levels: SOL $180 (-10%), BTC $40,500 (-10%)
       • Confidence: 90%

       [Approve] [Reject] [Modify]

User: [Clicks Reject]

Agent: Understood. Trade cancelled.
       What else can I help you with?
```

### Flow 3: Command Palette (Quick Command)

```
User: [Presses Cmd+K]
      "buy 10 SOL at market"

[Command Palette]
Command recognized (95% confidence)
Type: trade
Action: buy
Parameters: 10 SOL at market price

[Execute] [Cancel]

User: [Clicks Execute]

[Toast Notification]
✅ Trade executed: Bought 10 SOL at $200 ($2000 total)
```

## User Experience Improvements

### 1. Visual State Indicators

```typescript
// Show agent thinking state
{agentContext.state === 'ANALYZING_INTENT' && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
    <Loader2 size={14} className="animate-spin" />
    Analyzing your request...
  </div>
)}

{agentContext.state === 'EXECUTING' && (
  <div className="flex items-center gap-2 text-xs text-success p-2">
    <Loader2 size={14} className="animate-spin" />
    Executing trade...
  </div>
)}
```

### 2. Typing Indicators

```typescript
// Show "Agent is typing..." when waiting for LLM response
{isAgentActive && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
    <div className="flex gap-1">
      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
      <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-100" />
      <div className="w-2 h-2 rounded-full bg-primary animate-bounce delay-200" />
    </div>
    Agent is thinking...
  </div>
)}
```

### 3. Quick Action Buttons

```typescript
// After agent asks a question, show quick reply buttons
{message.metadata?.quickReplies && (
  <div className="flex flex-wrap gap-2 mt-2">
    {message.metadata.quickReplies.map((reply, i) => (
      <button
        key={i}
        onClick={() => handleQuickReply(reply)}
        className="px-3 py-1 text-xs bg-primary/10 hover:bg-primary/20 rounded-full"
      >
        {reply}
      </button>
    ))}
  </div>
)}
```

## Testing Scenarios

### Test 1: Intent Analyzer
```bash
# Should extract BUY intent with clarification needed
analyzeIntent("I think SOL looks good", userContext)
→ {intent: "BUY", asset: "SOL", clarificationNeeded: true}

# Should extract SELL intent with partial clarity
analyzeIntent("Take some profits on ETH", userContext)
→ {intent: "TAKE_PROFIT", asset: "ETH", clarificationNeeded: true}

# Should extract REDUCE_RISK intent
analyzeIntent("I'm worried about a crash", userContext)
→ {intent: "REDUCE_RISK", clarificationNeeded: false}
```

### Test 2: Conversational Flow
```bash
# Full conversation test
agent.processMessage("I want to buy SOL", context)
→ "How much SOL? What's your budget?"

agent.processMessage("$500", context)
→ "Do you want a stop loss?"

agent.processMessage("Yes, 10%", context)
→ [Trade Proposal]

agent.processMessage("approve", context)
→ ✅ Trade executed
```

### Test 3: Error Handling
```bash
# Invalid approval response
agent.processMessage("maybe", context) # while awaiting approval
→ "I didn't understand. Do you want to approve, reject, or modify?"

# LLM API failure
analyzeIntent("buy SOL", contextWithBadAPIKey)
→ {intent: "UNKNOWN", questions: ["Could you be more specific?"]}
```

## Performance Considerations

### LLM Latency
- Intent analysis: ~1-2 seconds (Claude API)
- Trade proposal: ~2-3 seconds (Claude API)
- **Total conversation:** 3-5 seconds vs <1s for regex parsing

**Optimization:**
1. Stream LLM responses (show partial text)
2. Cache common patterns (reduce API calls)
3. Use smaller model for simple queries (haiku vs sonnet)

### Cost Analysis
- Intent analysis: $0.003 per request (Claude Sonnet)
- Trade proposal: $0.005 per request
- **Per conversation:** ~$0.015 (2-3 LLM calls)
- **At 1000 conversations/day:** $15/day = $450/month

**Revenue model:** Premium feature ($49/month) → 4 users pays for it

## Deployment Checklist

- [ ] Add intent-analyzer.ts to production
- [ ] Add conversational-agent.ts to production
- [ ] Update EnhancedAIChatWidget with conversational flow
- [ ] Create TradeProposalCard component
- [ ] Add ANTHROPIC_API_KEY to environment
- [ ] Test full conversation flows
- [ ] Add error handling for API failures
- [ ] Implement usage limits (max 100 conversations/day for free tier)
- [ ] Add analytics tracking (conversation → trade conversion rate)
- [ ] Document user-facing behavior

## Next Steps

### Phase 1 (This Sprint) - Level 2 Agentic Trading
- [x] Build intent analyzer (DONE)
- [x] Build conversational agent (DONE)
- [ ] Integrate into AI Chat Widget
- [ ] Create trade proposal UI
- [ ] Test end-to-end flows

### Phase 2 (Next Sprint) - Level 3 Autonomous Strategies
- [ ] Build DCA strategy agent
- [ ] Build grid trading agent
- [ ] Build yield optimizer agent
- [ ] Add agent dashboard
- [ ] Cron-based execution

### Phase 3 (Future) - Level 4 Multi-Agent System
- [ ] Market analysis agent
- [ ] Risk assessment agent
- [ ] Monitoring agent
- [ ] Agent orchestrator
- [ ] Agent marketplace

---

**Status:** Level 1 (Command Palette) = ✅ DONE
**Status:** Level 2 (Intent + Conversation) = 🚧 70% DONE (backend ready, UI pending)
**Status:** Level 3 (Autonomous Strategies) = ❌ NOT STARTED
**Status:** Level 4 (Multi-Agent) = ❌ NOT STARTED

This is true **vibe trading** 🎯
