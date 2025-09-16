# AI Sidebar Manual Verification Master Checklist

Task Progress: 0%

Legend:  
- [ ] = Not Started  
- [~] = In Progress / Partially Verified  
- [x] = Complete  
Add brief notes after each item when moving to [~] or [x].

## 0. Environment & Baseline
- [ ] Start dev server (npm run dev) without build errors
- [ ] Open root page loads without runtime errors in console (excluding filtered external noise)
- [ ] Global `window.SVMAI` API object present with expected methods (open, close, toggle, prompt, setWidth, getWidth)

## 1. Initial Access & Setup
- [ ] 1.1 First-Time User Activation (sidebar toggle, welcome message, default mode, empty knowledge panel)
- [ ] 1.2 Sidebar Resizing (drag handle min clamp 560px, max viewport; persistence after reload)
- [ ] 1.3 Initial Mode Selection (Agent default; can switch to Assistant; mode indicator updates)

## 2. Chat Interactions
### 2.1 Basic Message Flow
- [ ] Text input submit (Enter)
- [ ] Multi-line (Shift+Enter)
- [ ] Voice button disabled/hidden if no permission
- [ ] Slash command autocompletion list appears
- [ ] Loading spinner / cancel (Esc) functionality
### 2.2 Multi-Tab Management
- [ ] Create new tab (plus)
- [ ] Switch tabs preserves content
- [ ] Rename via double-click
- [ ] Close tab (not allowed to close last)
- [ ] Pinned/active visual states (if applicable)
### 2.3 Message Types & Rendering
- [ ] User vs AI alignment/styles
- [ ] Error message rendering pathway (inject a forced error)
- [ ] Code blocks syntax highlighting (sample languages: ts, rust, bash)
- [ ] Mermaid diagram renders; invalid diagram shows handled error
- [ ] Large table (&gt;10 rows) collapsible + search + sort + virtualization
- [ ] Standard markdown (lists, headers, links) correct
### 2.4 Message Actions
- [ ] Copy to clipboard
- [ ] Save to Knowledge (creates note)
- [ ] Share link generation (URL structure valid, loads conversation)
- [ ] Fork thread creates new conversation branch
- [ ] Site Search action triggers internal search
- [ ] Web Search opens external Google query
### 2.5 Reasoning Blocks
- [ ] Collapsible reasoning section appears when available
- [ ] Toggle expand/collapse state persists per message (if designed)

## 3. Knowledge Management
- [ ] Notes tab accessible
- [ ] Add manual note (Add Entry)
- [ ] Auto-save from assistant response works
- [ ] Real-time search filtering with highlight
- [ ] Delete single note (confirmation)
- [ ] Clear all (confirmation)
- [ ] Metrics: total notes, token counts update
- [ ] Persistence after reload

## 4. Voice Interactions
- [ ] Microphone permission request flow
- [ ] Recording states: ready → recording → processing
- [ ] Transcription inserted into input
- [ ] Graceful fallback if unsupported
- [ ] (Future) Placeholder for voice commands does not break UI

## 5. Thread & History Management
- [ ] Thread list shows pinned above recent
- [ ] Auto-thread creation on new conversation
- [ ] Pin / unpin updates ordering
- [ ] Rename thread updates title everywhere
- [ ] Delete thread removes it and selects fallback
- [ ] Metadata (message count, last activity) updates

## 6. Advanced Features
### 6.1 Slash Commands
- [ ] /help lists commands
- [ ] /tx [signature] triggers transaction analysis response
- [ ] /wallet [address] wallet analysis
- [ ] /tps network performance metrics
- [ ] /path path finding results
### 6.2 Agent Actions
- [ ] Action cards show pending → in-progress → completed
- [ ] Failed action retry path
- [ ] Multiple actions queue renders correctly
### 6.3 Message Virtualization
- [ ] Virtualization activates &gt;150 messages (DOM node count reduced)
- [ ] Smooth scrolling, auto-scroll to bottom on new message
- [ ] Placeholders / windowing indicators appear

## 7. Settings & Configuration
- [ ] Token management panel opens (usage, limits)
- [ ] Upgrade / pricing link functional (if present)
- [ ] Width preference persists
- [ ] Theme toggle (light/dark) affects sidebar
- [ ] Notifications / action confirmations display

## 8. Error Handling & Edge Cases
- [ ] Simulate network loss mid message (shows retry / graceful state)
- [ ] Automatic retry logic triggers
- [ ] Large input (paste long text) handled without freeze
- [ ] Special characters escaped properly
- [ ] LocalStorage quota near limit (simulate) handled gracefully

## 9. Accessibility
- [ ] Keyboard navigation: tab order logical through toggle, tabs, input, actions
- [ ] Esc cancels pending generation
- [ ] ARIA labels on input, send, toggle, tabs
- [ ] Live region announces new AI messages
- [ ] High contrast mode (prefers-contrast) styling appropriate
- [ ] Font scaling (browser zoom 125% / 150%) layout intact
- [ ] Color independence (no color-only conveyed info)

## 10. Mobile & Responsive
- [ ] Narrow viewport (&lt; 640px) layout adjusts (stacking / overlay)
- [ ] Touch interactions (resize, tab switching) functional
- [ ] Gesture (if implemented) not breaking standard use
- [ ] Conversation share link opens properly on mobile

## 11. Export & Sharing
- [ ] Export conversation downloads Markdown file (verify structure)
- [ ] Share link loads same messages & metadata
- [ ] Timestamp formatting correct

## 12. Performance & Stress
- [ ] 150 message virtualization performance (scroll fluid)
- [ ] 300 message still responsive
- [ ] 500+ message extreme test (memory not ballooning uncontrollably)
- [ ] Message rendering time under threshold (subjective but note anomalies)
- [ ] CPU use during stream acceptable
- [ ] Memory freed when closing tabs / pruning old messages (if implemented)

## 13. Integration Scenarios
- [ ] Transaction page context awareness (prefills /tx or suggestions)
- [ ] Account page context
- [ ] URL share cross-browser (Chrome/Firefox)
- [ ] Cross-session persistence after full browser restart
- [ ] Export then re-import (if import exists; otherwise mark N/A)

## 14. Data Persistence & LocalStorage
- [ ] Width key present & updates
- [ ] Threads serialized/deserialized without corruption
- [ ] Knowledge notes integrity after reload
- [ ] Clean removal when deleting threads/notes

## 15. Diagnostics & Logging
- [ ] Console free of unhandled errors (excluding known filtered noise)
- [ ] Warnings triaged (React state update, aborted fetch)
- [ ] Timing metrics recorded (spinner min time)

## 16. Issue Remediation Loop
For each defect:
- [ ] Reproduce
- [ ] Capture console/network evidence
- [ ] Patch implemented
- [ ] Add / adjust automated test (e2e/unit)
- [ ] Update checklist / docs
- [ ] Retest & close

## 17. Documentation & Summaries
- [ ] Update AI_SIDEBAR_MANUAL_CHECKLIST.md with final statuses
- [ ] Update AI_SIDEBAR_TESTING_COMPLETE.md summary
- [ ] Add any new edge cases discovered to COMPREHENSIVE_USER_JOURNEYS.md (if needed)
- [ ] Commit changes with clear message

## 18. Final Acceptance
- [ ] All critical paths green
- [ ] All high/medium defects resolved or ticketed
- [ ] Performance acceptable
- [ ] Accessibility baseline met
- [ ] Sign-off recorded

---

Progress Notes:
(Add dated entries here as tasks move to [~] or [x].)
