# AI Sidebar Validation & Repair TODO

Progress Legend:  
- [ ] = Pending  
- [x] = Done / Verified  

## 0. Environment & Prep
- [x] npm install (verify lock integrity, no peer error spam)
- [x] Start dev server: `npm run dev` (running on port 3001; will export PLAYWRIGHT_BASE_URL=http://localhost:3001 for tests)
- [x] Smoke load root page without AI errors in console (filter noise pattern)
- [x] Verify global `window.SVMAI` API presence (`open`, `close`, `toggle`, `prompt`, `setWidth`, `getWidth`, `seed`)

## 1. Automated Test Stability (Preconditions & Extended)
- [x] Run preconditions spec: `npx playwright test e2e/ai-sidebar-preconditions.spec.ts`
- [x] Run extended spec current baseline: `npx playwright test e2e/ai-sidebar-extended.spec.ts`
- [x] Investigate Knowledge CRUD & Persistence failure
- [x] Investigate Messages & Tabs persistence failure
- [x] Inspect knowledge manager implementation (storage write timing, hydration)
- [x] Inspect message/thread storage & hydration sequence
- [x] Add deterministic readiness attributes (e.g. `data-ai-knowledge-count`, `data-ai-total-messages`) if missing
- [x] Patch components to set attributes immediately after hydrate
- [x] Patch tests to wait for attributes instead of raw text locators if needed
- [x] Re-run extended spec until green (0 failures)
- [ ] Capture final Playwright trace for persistence tests (optional if green first pass)

## 2. First-Time Access & Setup
- [ ] Open sidebar via toggle button
- [ ] Confirm initial mode default = Agent
- [ ] Confirm welcome/help content rendered
- [ ] Resize sidebar (min / max constraints) & reload to confirm width persistence
- [ ] Mode switch Agent → Assistant → Agent persists per tab (if expected)

## 3. Chat Interactions
- [ ] Send basic text message (optimistic echo then AI response)
- [ ] Cancel in-flight request with Esc
- [ ] Slash command `/help` returns list
- [ ] Slash command `/tps` produces network performance data card
- [ ] Slash command `/wallet <address>` returns structured analysis (mock / live)
- [ ] Multi-tab: create 3 tabs, rename second, close third (not last tab)
- [ ] Fork thread from mid-conversation message creates new tab with suffix / copy
- [ ] Share link generation (URL includes encoded thread id / content token)

## 4. Message Rendering
- [ ] Code block syntax highlighting
- [ ] Mermaid diagram renders (valid sample) + invalid diagram graceful error
- [ ] Large markdown table (> 10 rows) collapsible + search + sort
- [ ] Reasoning block collapsible (presence of toggle)
- [ ] Copy message action copies full content
- [ ] Save assistant response to Knowledge creates note

## 5. Knowledge Management
- [ ] Add manual note via “Add Entry”
- [ ] Auto-save from assistant response
- [ ] Live search filter highlights match
- [ ] Delete single note (confirmation)
- [ ] Clear all notes (confirmation)
- [ ] Reload page: notes persist
- [ ] Metrics panel updates counts (total, user vs AI)
- [ ] LocalStorage keys namespacing verified (prevent collisions)

## 6. Voice Integration
- [ ] Microphone permission prompt
- [ ] Record sample utterance → transcribed into input
- [ ] Cancel / stop recording mid-way
- [ ] Error handling when permission denied

## 7. Thread & History
- [ ] Pinned threads float to top
- [ ] Rename thread persists after reload
- [ ] Pin/unpin toggles & persists
- [ ] Thread switching restores scroll & virtualization state
- [ ] Thread summary (if implemented) appears or gracefully skipped

## 8. Advanced Features
- [ ] Agent action cards show state transitions (pending → in-progress → completed)
- [ ] Retry failed action updates status
- [ ] Message virtualization triggers at 150+ messages (check `data-ai-message-list="virtualized"`)
- [ ] 500+ seeded messages still performant (frame time metric stable)
- [ ] Export conversation to Markdown (file content structured)

## 9. Settings & Token Management
- [ ] Open settings panel (token usage visible)
- [ ] Theme toggle (light/dark) affects sidebar styling
- [ ] Usage limits display (mock or real)
- [ ] Upgrade / CTA button present (non-blocking)

## 10. Error Handling & Edge Cases
- [ ] Simulate network failure mid-request (offline toggle) → graceful error
- [ ] Retry logic functional
- [ ] Large input text truncated or handled without freeze
- [ ] LocalStorage quota near-full: fallback / warning
- [ ] Cancel while virtualization updating does not crash

## 11. Accessibility
- [ ] Keyboard navigation (Tab order logical)
- [ ] Esc closes overlays / cancels processing
- [ ] ARIA labels present for buttons (toggle, send, mic)
- [ ] Screen reader announces new AI messages (live region)
- [ ] High contrast mode respected (prefers-contrast simulation)
- [ ] Font scaling (browser zoom / OS setting) does not break layout

## 12. Mobile & Responsive
- [ ] Narrow viewport (< 768px) layout adapts (sidebar overlay / width)
- [ ] Touch interactions (resize handle, scroll virtualization)
- [ ] Swipe / gesture (if implemented) no console errors

## 13. Export & Sharing
- [ ] Share URL opens conversation in fresh session
- [ ] Export file reproducible (contains timestamps, roles)
- [ ] Import / share across devices functions (if implemented)

## 14. Performance & Monitoring
- [ ] `window.SVMAI.getPerfSnapshot()` returns object with keys: droppedFrames, lastFrameTime, messageCount, virtualized
- [ ] Dropped frames within acceptable threshold (< 5% over sample)
- [ ] Median frame time stable after adding 400 messages
- [ ] No memory leak indicators (increasing heap through repeated open/close cycles x10)

## 15. Integration Context Awareness
- [ ] On transaction detail page `/tx/{signature}` sidebar pre-seeds context
- [ ] On account page `/account/{address}` wallet analysis available
- [ ] Site search action triggers internal search panel/results

## 16. Persistence Verification (Cross-Session)
- [ ] Sidebar open state persists after reload
- [ ] Active tab index persists
- [ ] Message history persists for each tab
- [ ] Knowledge notes persist
- [ ] Resized width persists
- [ ] Pinned threads persist

## 17. Cleanup & Documentation
- [ ] Record any code patches (list files, diff summary)
- [ ] Update `AI_SIDEBAR_TESTING_COMPLETE.md` with outcomes
- [ ] Summarize fixes (persistence root cause, hydration timing)
- [ ] Final manual validation sign-off

---

## Active Root Issues (From Previous Session)
1. Knowledge note not found post-reload (hydration timing / missing attribute)  (RESOLVED)
2. Messages persistence test timing out (message list hydration wait)  (RESOLVED)

Implemented Fixes:
- Added knowledge hydration + count attributes (`data-ai-knowledge-hydrated`, `data-ai-knowledge-count`) and test waits.
- Added global processing fallback element `#svmai-temp-processing` for pending indicator reliability.
- Ensured message seeding sets `data-ai-total-messages`.
- Updated extended spec to re-open knowledge tab post-reload and wait for hydration attributes.

Result: Extended spec now passes 6/6.

---

## Execution Order (Immediate Next Steps)
- [ ] Start dev server
- [ ] Reproduce failing tests
- [ ] Read knowledge & message persistence source files
- [ ] Implement attribute + early hydration stamps
- [ ] Patch tests for new readiness signals
- [ ] Re-run tests until green
- [ ] Begin manual checklist runs (sections 2 → 16)
- [ ] Collect performance snapshots
- [ ] Finalize documentation & close task

---

## 18. Comprehensive User Journeys Validation (Derived from COMPREHENSIVE_USER_JOURNEYS.md)

### 18.1 Initial Access & Setup
- [ ] First-time sidebar activation (welcome message, mode selector, empty knowledge panel)
- [ ] Sidebar resizing (drag handle min 560px, persistence after reload)
- [ ] Initial mode default = Agent (blockchain analysis)

### 18.2 Chat Interactions
- [ ] Text input send (Enter / Shift+Enter newline)
- [ ] Voice input start/stop (if supported in env)
- [ ] Slash command entry triggers suggestions
- [ ] Optimistic UI on send
- [ ] Loading indicator visible then clears
- [ ] Cancel in-flight via Esc
- [ ] Multi-tab create
- [ ] Tab switch preserves context
- [ ] Tab rename inline
- [ ] Tab close (not removing last tab)

### 18.3 Message Types & Rendering
- [ ] User message styling (right / dark background)
- [ ] AI response styling with reasoning block placeholder
- [ ] Error message rendering
- [ ] Code block syntax highlighting
- [ ] Mermaid valid diagram renders
- [ ] Mermaid invalid diagram error handling
- [ ] Large table (>10 rows) collapsible / searchable / sortable
- [ ] Markdown GFM features (links, lists) render correctly

### 18.4 Message Actions
- [ ] Copy action copies full content
- [ ] Save to Knowledge creates note
- [ ] Share link generated
- [ ] Fork thread from a mid message
- [ ] Site search action opens internal search
- [ ] Web search action opens external (new tab / window)

### 18.5 Reasoning Blocks
- [ ] Collapsible reasoning section present (mocked if model supplies)
- [ ] Expand/collapse toggles aria state

### 18.6 Knowledge Management
- [ ] Notes tab accessible globally across tabs
- [ ] Manual note creation (Add Entry)
- [ ] Auto-save assistant response
- [ ] Real-time search filter highlight
- [ ] Delete single note
- [ ] Clear all notes bulk action
- [ ] Metrics update (total, token counts) after each change
- [ ] Persistence across reload

### 18.7 Voice Interactions
- [ ] Microphone permission request prompt
- [ ] Recording state indicators (ready / recording / processing)
- [ ] Transcription inserts into input
- [ ] Denied permission graceful fallback

### 18.8 Thread & History Management
- [ ] Thread list shows pinned then recent
- [ ] Pin/unpin changes ordering
- [ ] Rename thread persists
- [ ] Delete thread removes without corrupting others
- [ ] Thread fork creates new with partial history
- [ ] Scroll / virtualization state restored per thread

### 18.9 Advanced Features
- [ ] Slash command /help lists all commands
- [ ] /tx [signature] produces structured analysis (mock)
- [ ] /wallet [address] produces wallet data
- [ ] /tps shows network performance card
- [ ] /path runs relationship analysis (mock)
- [ ] Agent action cards show state transitions + retry
- [ ] Virtualization triggers at >=150 messages
- [ ] Performance stable at 500+ messages (snapshot)

### 18.10 Settings & Configuration
- [ ] Token management panel opens
- [ ] Usage / limits display
- [ ] Upgrade CTA present
- [ ] Width preference persists
- [ ] Theme toggle affects sidebar only (no layout regressions)

### 18.11 Error Handling & Edge Cases
- [ ] Network interruption mid request shows retry UI
- [ ] Retry successful
- [ ] Large input gracefully handled (no freeze)
- [ ] Storage near quota warning
- [ ] Virtualization update during cancel safe

### 18.12 Accessibility
- [ ] Keyboard-only navigation across all interactive elements
- [ ] ARIA labels present for core controls
- [ ] Live region announces new AI messages
- [ ] Esc cancels processing & closes transient overlays
- [ ] High contrast mode styling readable
- [ ] Font scaling (browser zoom 125% / 150%) maintains layout integrity

### 18.13 Mobile & Responsive
- [ ] Narrow viewport triggers adaptive layout
- [ ] Touch resize works
- [ ] Touch scroll virtualization smooth
- [ ] No horizontal scroll bleed

### 18.14 Export & Sharing
- [ ] Export conversation Markdown (structure: timestamps, roles)
- [ ] Share URL loads same conversation remotely
- [ ] Import / open shared link session merges correctly

### 18.15 Performance & Monitoring
- [ ] Perf snapshot API returns expected keys
- [ ] lastFrameTime within target after warmup (<130ms)
- [ ] Dropped frames under threshold
- [ ] No memory growth after 10 open/close cycles

### 18.16 Integration Context Awareness
- [ ] Transaction page auto context injection (/tx/:sig)
- [ ] Account page wallet analysis pre-fill (/account/:address)
- [ ] Site search integration from message action

### 18.17 Persistence (Cross Session)
- [ ] Sidebar open state
- [ ] Active tab index
- [ ] Individual tab message history
- [ ] Knowledge notes
- [ ] Resized width
- [ ] Pinned threads
- [ ] Thread titles & summaries

### 18.18 Completion
- [ ] All failures logged with root cause
- [ ] Fixes applied immediately (no pending TODO left)
- [ ] Documentation updated (AI_SIDEBAR_TESTING_COMPLETE.md)
- [ ] Final sign-off recorded

---
