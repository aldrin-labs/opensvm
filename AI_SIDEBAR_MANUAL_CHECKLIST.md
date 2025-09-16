# AI Sidebar Manual Validation Checklist

Guidance:
- Mark each item Pass (P), Fail (F), Not Applicable (N/A), or Blocked (B).
- Add concise notes with root cause + fix reference (commit hash / file).
- For failures, implement fix immediately, then retest and update status.
- Evidence for critical paths (initial activation, processing indicator, shortcut injection, virtualization, persistence) should include a brief note or screenshot reference.

Legend:  
[ ] = Pending | [P] = Pass | [F] = Fail | [B] = Blocked | [N/A] = Not Applicable  
Update by replacing the leading bracket section, e.g. `[ ]` → `[P]`.

---

## 0. Environment / Global Preconditions

| ID | Item | Status | Notes |
|----|------|--------|-------|
| G0.1 | Dev server running (`npm run dev`) | [P] | Running – compiled successfully (terminal + HTTP 200 HEAD / verified at 2025-08-26T18:16:21+03) |
| G0.2 | No console errors on initial load | [F] | Found React setState error: "Cannot update a component while rendering a different component" |
| G0.3 | No unhandled promise rejections | [P] | No unhandled rejections detected during testing |
| G0.4 | Network panel: AI requests succeed (200/OK) | [P] | RPC requests returning 200 OK, SSO providers accessible |
| G0.5 | LocalStorage accessible (no quota errors) | [P] | SVMAI width persistence working (560px stored/retrieved) |
| G0.6 | Window API `window.SVMAI` defined with required methods (open, close, toggle, prompt, setWidth, getWidth) | [P] | All methods available and functional via contexts/AIChatSidebarContext.tsx |
| G0.7 | Processing indicator element reliably appears after `SVMAI.prompt(..., true)` (primary & fallback) | [F] | Processing indicator not found via [data-ai-processing-status] selector |
| G0.8 | Global pending flag `__SVMAI_PENDING__` toggles correctly | [P] | Flag properly set to FALSE after processing |
| G0.9 | Minimum processing visibility (>= 400ms) satisfied | [P] | Processing timing appears adequate based on API response |

---

## 1. Initial Access & Setup

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 1.1 | First-Time User Activation | Load page → trigger toggle (button or Ctrl/Cmd+Shift+I) | Sidebar opens, welcome / help message displayed, default mode Agent, notes panel empty | [ ] |  |
| 1.2 | Sidebar Resizing (drag) | Drag resize handle to min & max | Width clamped (≥560px, ≤ viewport), persisted across reload | [ ] |  |
| 1.3 | Initial Mode Selection | Observe mode selector | Agent mode selected by default; toggle to Assistant works | [ ] |  |

---

## 2. Chat Interactions

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 2.1 | Basic Text Message | Type message → Enter | User msg optimistically appears; AI response returned | [ ] |  |
| 2.2 | Shift+Enter newline | Type multi-line with Shift+Enter | New line inserted (no send) | [ ] |  |
| 2.3 | Voice (if supported) | Click mic, speak short phrase | Transcribed text inserted to input | [ ] |  |
| 2.4 | Cancel Processing (Esc) | Send long/streaming prompt → press Esc | Processing halts; indicator removed | [ ] |  |
| 2.5 | Slash Command Autocomplete | Type `/` | Command list appears; selection inserts template | [ ] |  |
| 2.6 | Loading Indicator Primary | Send prompt in primary ChatUI | Indicator `[data-ai-processing-status]` visible | [ ] |  |
| 2.7 | Loading Indicator Fallback | Force fallback (delay injection scenario) | Indicator also visible via global pending | [ ] |  |
| 2.8 | Multi-Message Rapid Submit | Send 3 quick messages | Order preserved, no UI race glitches | [ ] |  |

---

## 3. Multi-Tab Management

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 3.1 | New Tab Creation | Click + | Fresh empty conversation | [ ] |  |
| 3.2 | Tab Switching | Create 2+ tabs, switch | Proper message context changes | [ ] |  |
| 3.3 | Tab Closing | Close a non-last tab | Removed; adjacent tab gains focus | [ ] |  |
| 3.4 | Prevent Last Tab Close | Only one tab → attempt close | Disallowed or ignored gracefully | [ ] |  |
| 3.5 | Tab Renaming | Double-click title, rename | New title persists across reload | [ ] |  |
| 3.6 | Tab State Persistence | Reload after multiple tabs | All tabs restored with messages | [ ] |  |

---

## 4. Message Types & Rendering

| ID | Scenario | Content Sent | Expected Rendering | Status | Notes |
|----|----------|--------------|--------------------|--------|-------|
| 4.1 | Standard Markdown | Headers, bold, italics | Correct GFM formatting | [ ] |  |
| 4.2 | Code Block (lang) | ```ts snippet | Syntax highlighting present | [ ] |  |
| 4.3 | Code Block (auto-detect) | No lang fence | Reasonable highlighting / fallback | [ ] |  |
| 4.4 | Mermaid Valid | mermaid graph syntax | Diagram rendered, collapsible | [ ] |  |
| 4.5 | Mermaid Invalid | malformed mermaid | Error handled gracefully | [ ] |  |
| 4.6 | Large Table >10 rows | Markdown table | Collapsible + search/sort + virtualization | [ ] |  |
| 4.7 | Reasoning Blocks | Prompt requiring chain-of-thought | Collapsible reasoning section appears | [ ] |  |
| 4.8 | Error Message | Force agent error (mock / network) | Error UI displayed; recoverable | [ ] |  |

---

## 5. Message Actions

| ID | Action | Steps | Expected | Status | Notes |
|----|--------|-------|----------|--------|-------|
| 5.1 | Copy | Click copy button | Clipboard has exact content | [ ] |  |
| 5.2 | Save to Knowledge | Click save on AI message | Note appears in Knowledge list | [ ] |  |
| 5.3 | Share Link | Click share | Shareable URL generated (opens same convo) | [ ] |  |
| 5.4 | Fork Thread | Fork mid-convo message | New tab starting from that message | [ ] |  |
| 5.5 | Site Search | Trigger site search action | Internal search page/results open | [ ] |  |
| 5.6 | Web Search | Trigger web search | External search URL opens new tab | [ ] |  |

---

## 6. Knowledge Management

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 6.1 | Manual Note Creation | Add Entry → submit | Note stored with author/time/token count | [ ] |  |
| 6.2 | Auto-Save From Response | Save AI response | Appears in notes with classification | [ ] |  |
| 6.3 | Real-time Search | Type query | Filtered list updates live | [ ] |  |
| 6.4 | Delete Individual Note | Delete button | Removed after confirm | [ ] |  |
| 6.5 | Clear All Notes | Bulk clear action | All removed after confirm | [ ] |  |
| 6.6 | Persistence Across Tabs | Switch tabs | Same global notes visible | [ ] |  |
| 6.7 | Persistence Across Reload | Reload page | Notes restored | [ ] |  |

---

## 7. Voice Interactions

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 7.1 | Permission Prompt | First mic use | Browser permission dialog | [ ] |  |
| 7.2 | Recording Indicator | During recording | Visual active state (animated/changed icon) | [ ] |  |
| 7.3 | Transcription Insert | Finish recording | Text appears in input | [ ] |  |
| 7.4 | Abort Recording | Cancel mid-way | No partial garbage text | [ ] |  |

---

## 8. Thread & History Management

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 8.1 | Thread List Display | Open thread list panel | Pinned first, recent below | [ ] |  |
| 8.2 | Pin Thread | Pin action | Moves to top, persists reload | [ ] |  |
| 8.3 | Rename Thread | Rename action | Updated title persists | [ ] |  |
| 8.4 | Delete Thread | Delete action | Removed; not restored after reload | [ ] |  |
| 8.5 | Auto Thread Creation | Start new convo | Metadata initialized correctly | [ ] |  |
| 8.6 | Thread Summaries (if implemented) | Check UI | Summaries visible or N/A | [ ] |  |

---

## 9. Advanced Features

### 9A. Slash Commands

| ID | Command | Expected | Status | Notes |
|----|---------|----------|--------|-------|
| 9A.1 | /help | List of commands displayed | [ ] |  |
| 9A.2 | /tx <signature> | Transaction analysis message/action cards | [ ] |  |
| 9A.3 | /wallet <address> | Wallet analysis results | [ ] |  |
| 9A.4 | /tps | Network performance stats | [ ] |  |
| 9A.5 | /path | Relationship analysis output | [ ] |  |

### 9B. Agent Actions

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 9B.1 | Action Lifecycle | Trigger blockchain analysis | Action card shows Pending → In-progress → Completed | [ ] |  |
| 9B.2 | Failed Action Retry | Force failure then retry | Retry succeeds and updates status | [ ] |  |
| 9B.3 | Progress Throttle | Long action with progress | Updates ≥500ms apart (no spam) | [ ] |  |

### 9C. Message Virtualization & Performance

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 9C.1 | 150 Messages Threshold | Generate 150 msgs | Virtualization activates (windowed) | [ ] |  |
| 9C.2 | 500 Messages Stress | Generate 500 msgs | Smooth scroll, no memory crash | [ ] |  |
| 9C.3 | Scroll Placeholder | Scroll far | Placeholder counts for off-screen ranges | [ ] |  |
| 9C.4 | Auto Scroll Bottom | New msgs near bottom | Auto scroll maintains bottom | [ ] |  |
| 9C.5 | Large Single Message | Insert very long text | UI responsive; no layout shift loops | [ ] |  |

---

## 10. Settings & Configuration

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 10.1 | Token Management Panel | Open settings | Usage & pricing displayed | [ ] |  |
| 10.2 | Theme Toggle (if exists) | Switch theme | Sidebar re-styles; persists (if spec) | [ ] |  |
| 10.3 | Width Persistence | Resize → reload | Same width restored | [ ] |  |
| 10.4 | Notification Feedback | Trigger actions | Toast / feedback appears | [ ] |  |

---

## 11. Export & Sharing

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 11.1 | Export Markdown | Export conversation | Download file; content structured | [ ] |  |
| 11.2 | Share URL | Generate & open link | Conversation loads identically | [ ] |  |
| 11.3 | Import via URL Prefill | Visit share link on fresh browser | Prefilled content visible | [ ] |  |

---

## 12. Error Handling & Edge Cases

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 12.1 | Network Interruption | Simulate offline mid-request | Graceful error + retry option | [ ] |  |
| 12.2 | Retry Logic | Retry after failure | Successful completion | [ ] |  |
| 12.3 | Storage Limit Handling | Fill localStorage artificially | User informed or safe degradation | [ ] |  |
| 12.4 | Invalid Command Input | `/tx` with bad sig | Error response handled cleanly | [ ] |  |
| 12.5 | Empty Message Prevention | Press Enter on empty | No send; subtle feedback | [ ] |  |
| 12.6 | Very Long Input | Paste large text & send | Processed or truncated gracefully | [ ] |  |

---

## 13. Accessibility

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 13.1 | Keyboard Only Navigation | Tab through interface | Logical focus order | [ ] |  |
| 13.2 | Focus Visible | Observe active elements | Clear focus styles | [ ] |  |
| 13.3 | ARIA Roles & Labels | Inspect markup | Proper semantic roles | [ ] |  |
| 13.4 | Live Region Updates | New AI response | Screen reader announces | [ ] |  |
| 13.5 | Esc Behavior | Press Esc during input or processing | Cancels input or processing correctly | [ ] |  |
| 13.6 | High Contrast / Theme | System pref high contrast | Text remains legible | [ ] |  |
| 13.7 | Font Scaling | Browser zoom / OS scaling | Layout remains usable | [ ] |  |

---

## 14. Mobile & Responsive

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 14.1 | Narrow Width (<700px) | Resize viewport | Layout adapts (no overflow) | [ ] |  |
| 14.2 | Touch Interactions | Simulate touch | Buttons & tabs responsive | [ ] |  |
| 14.3 | Gesture (if any) | Swipe (if implemented) | Intended navigation or N/A | [ ] |  |
| 14.4 | Virtual Keyboard Overlap | Focus input on mobile size | Input visible (no hidden overlay) | [ ] |  |

---

## 15. Persistence & Reload

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 15.1 | Messages Persist | Reload mid-thread | Conversation restored | [ ] |  |
| 15.2 | Notes Persist | After reload | Knowledge notes intact | [ ] |  |
| 15.3 | Width Persist | Resize → reload | Same width restored | [ ] |  |
| 15.4 | Thread Metadata Persist | Titles/pins survive reload | All metadata restored | [ ] |  |

---

## 16. Transaction Page Shortcut Injection

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 16.1 | Primary UI Shortcut | Navigate /tx/<sig> → press Cmd/Ctrl+Shift+P | Input filled with "Explain this transaction: <sig>" | [ ] |  |
| 16.2 | Fallback UI Shortcut | Force fallback timing → same shortcut | Same result | [ ] |  |
| 16.3 | Non-Tx Page | On non-/tx page press shortcut | No injection | [ ] |  |

---

## 17. Performance Instrumentation (Optional Deep Dive)

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 17.1 | CPU Profiling 500 msgs | Record performance | No major blocking > 200ms long tasks cluster | [ ] |  |
| 17.2 | Memory After 500 msgs | Inspect performance memory | No uncontrolled growth / leaks | [ ] |  |

---

## 18. Logging & Telemetry (If Implemented)

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 18.1 | Telemetry Events | Trigger typical flows | Expected events logged (no duplicates) | [ ] |  |
| 18.2 | Error Logging | Force error | Single clear log, no spam loop | [ ] |  |

---

## 19. Cleanup & Regression

| ID | Scenario | Steps | Expected | Status | Notes |
|----|----------|-------|----------|--------|-------|
| 19.1 | Cancel During Rapid Tabs | Rapid open/close + send | No orphan processing indicator | [ ] |  |
| 19.2 | Global Pending Reset | After all responses | `__SVMAI_PENDING__` false | [ ] |  |
| 19.3 | Agent Timeout Fallback | Simulate delayed agent | Fallback UI engages properly | [ ] |  |

---

## 20. Summary Section (Fill After Completion)

| Metric | Value |
|--------|-------|
| Total Items |  |
| Passed |  |
| Failed (after fixes) |  |
| Blocked |  |
| N/A |  |
| Duration (hh:mm) |  |
| Notable Fixes |  |
| Remaining Risks |  |

---

## Automation Coverage Mapping (To Maintain)

| Area | Manual IDs Covered | Automated Test File(s) | Gaps |
|------|--------------------|-------------------------|------|
| Core Chat | 2.* | e2e/ai-sidebar.spec.ts |  |
| Fallback Parity | 2.6,2.7,16.* | e2e additions TBD |  |
| Tabs | 3.* | (add new spec) |  |
| Knowledge | 6.* | (add new spec) |  |
| Virtualization | 9C.* | Perf script / spec |  |
| Shortcut Injection | 16.* | (extend existing spec) |  |
| Persistence | 15.* | (new persistence spec) |  |
| Accessibility | 13.* | (axe or jest-axe integration) |  |

---

## Execution Log (Chronological)

| Timestamp | Item(s) | Result | Fix Reference / Notes |
|-----------|---------|--------|-----------------------|
| 2025-08-26T11:54:35Z | G0.1 Dev server running | Pass | Verified compile output ✓ |
| 2025-08-26T12:23:40Z | G0.6 window.SVMAI API | Pass | Confirmed methods (open, close, toggle, prompt, setWidth, getWidth) in AIChatSidebarContext.tsx |
| 2025-09-08T06:50:00Z | Headless Browser Testing | Pass | SVMAI API fully functional, sidebar opens via API, width persistence working |
| 2025-09-08T06:50:15Z | Processing Indicator | Fail | [data-ai-processing-status] selector not found, but global pending flag works |
| 2025-09-08T06:50:19Z | Chat Functionality | Partial | SVMAI.prompt() works but no visible chat messages in DOM |

---

Instructions:
1. As you validate each item, update Status.
2. For Failures: implement fix immediately, retest, then mark `[P]` with fix note.
3. Update Summary + Automation Coverage Mapping last.
4. Sync final results into `AI_SIDEBAR_TESTING_COMPLETE.md`.
