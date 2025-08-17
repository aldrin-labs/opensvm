# AI Sidebar KPIs (Baseline Definitions)

Date: 2025-08-15
Commit: 64a775cbc4d1985fb95a78c5a3b8fe099cdef17d
Status: Draft (instrumentation scaffold only)

## KPI List

1. Messages Visible @1000px Height
   - Definition: Count of fully visible message bubbles in viewport at 1000px sidebar height (density = comfortable baseline).
   - Collection: Measured via DOM query in a dev diagnostic helper.
   - Formula: visibleMessages = number of `.chat-main-container [data-ai-message-role]` elements whose bounding rect fully within container.
   - Target Baseline: Record baseline; Phase 1 goal +40% in compact mode.

2. Avg Tokens / User Message (Pre-Trimming)
   - Definition: Approx token count (heuristic 4 chars ≈ 1 token) of user-authored prompts before any model-side trimming.
   - Collection: track('message_send',{role:'user', tokensEst}).
   - Formula: mean(tokensEst where role=user over session).
   - Target Baseline: Establish; monitor for increase after autosize (1.3.1/1.3.2).

3. First Meaningful Paint (FMP) of Sidebar Open
   - Definition: Time from `sidebar_open` event to first assistant/user message container render.
   - Collection: track('sidebar_open',{t0:performance.now()}); when first message DOM node appears, track('sidebar_fmp',{delta}).
   - Formula: delta = fmpTs - openTs.
   - Target Baseline: Capture median over 20 openings; reduce with later perf work.

4. Interaction Latency (Send -> First Token)
   - Definition: Time between user submit (`message_send`) and assistant first response text node insertion (`message_append` first chunk).
   - Collection: track('message_first_token',{delta}).
   - Target Baseline: Record; optimize streaming / backend later.

5. Early Close Rate (Abandon Proxy)
   - Definition: Percentage of sidebar open events closed within 10 seconds without any `message_send`.
   - Collection: track('sidebar_close',{openDuration}); classify if openDuration < 10000 and no sends.
   - Formula: earlyCloseRate = earlyCloses / totalOpens.
   - Target Baseline: Record; aim to reduce post Phase 1 UX improvements.

## Telemetry Event Schema (Initial)

CustomEvent: `svmai:event` detail: { type: string; ts: number; payload?: Record<string,any> }

Core events to emit in Phase 0:
- sidebar_open
- sidebar_close
- message_send
- message_append (each assistant append or final)
- sidebar_fmp

Planned Phase 1 additions:
- width_change, density_change, font_size_change

## Privacy & PII Guardrails
- No raw wallet/private keys logged.
- Truncate message content to first 120 chars for diagnostics (omit if sensitive markers detected in future enhancements).

## Dev Mode Visualization
All events currently logged via console.debug('[ai-telemetry]', eventType, payload).

## Next Steps
- Implement production exporter/batching later (Phase 5 Observability).
- Add performance sampling for virtualization (Phase 3).
