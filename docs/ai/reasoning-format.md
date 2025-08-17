# Reasoning Delimiter Specification

Date: 2025-08-15
Status: Draft (Phase 2.1.1)

## Purpose
Provide a deterministic, lightweight convention for embedding *internal reasoning* (chain-of-thought / scratch pad) inside model responses while keeping the *final answer* clearly separable for UI collapse, telemetry, and agent parsing.

## Delimiters
Reasoning segment MUST be wrapped in top-level block tags:

```
<REASONING>
...internal reasoning text (may contain markdown/code)...
</REASONING>
```

Anything outside the outermost `<REASONING>...</REASONING>` pair is considered *visible answer*.

### Rules
1. Only one top-level reasoning block per message. Nested `<REASONING>` tags inside the block are treated as plain text.
2. If either opening or closing tag missing -> treat entire message as visible (reasoning omitted).
3. Tags SHOULD appear on their own line (recommended) but parser tolerates inline.
4. Whitespace immediately inside tags is trimmed.
5. Token estimation heuristic: `Math.ceil(reasoning.length / 4)` (4 chars ≈ 1 token).

## Examples

Message with reasoning:
```
<REASONING>
Step 1: Fetch account balance...
Step 2: Compare deltas...
</REASONING>
Final balance increased by 12 SOL.
```
Parsed => visible: "Final balance increased by 12 SOL." reasoning: multi-line block.

Missing closing tag:
```
<REASONING>
I started thinking but message truncated
```
Parsed => entire content visible; no reasoning extracted.

## Parser Output Shape
`{ visible: string; reasoning?: { text: string; tokensEst: number } }`

## Agent / DOM Integration
UI renders reasoning collapsed by default, using:
`data-ai-reasoning` attribute on container
`data-collapsed="true|false"`
`data-token-est="<int>"`

Toggle button has `data-ai-reasoning-toggle` and emits CustomEvent `svmai:event` detail `{ type:'reasoning_toggle', payload:{ msgId, expanded, tokens } }`.

## Future Extensions
- Optional `<REDACTED>` sections for PII filtering.
- Multi-block reasoning (versus single) if needed for staged reasoning.

---
End of spec.
