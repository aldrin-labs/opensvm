# AI Sidebar Improvement Plan

Comprehensive, execution-focused checklist. Each major objective is decomposed into ~20 minute atomic subtasks ("micro-tasks"). Every micro-task lists: Goal, Steps, Deliverables, Impact (Sidebar UX / Platform / Revenue). Check off as you complete. Adjust ordering if blockers emerge.

Legend: 
- [ ] = not started
- [~] = in progress
- [x] = done

---
## Agent-Friendliness Principles & Hooks (NEW)
Goal: Every enhancement serves both human users and autonomous / semi-autonomous agents (browser automation scripts, internal AI assistants) by exposing stable, structured, machine-parseable interfaces.

### Core Principles
1. Stable Selectors: Use `data-ai-*` attributes (NOT brittle role/text) for automation.
2. Deterministic State: Avoid random ordering unless explicitly sorted; provide `data-state` attributes (e.g., `data-density="compact"`).
3. Structured Metadata: Embed lightweight JSON or token counts via `data-*` rather than parsing text content.
4. Event Emission: Fire synthetic DOM CustomEvents (`svmai:event`) with detail payloads for critical state changes a headless agent can subscribe to.
5. Idempotent Actions: Repeated calls (e.g., open sidebar) should yield same terminal state without error.
6. Graceful Degradation: If advanced rendering (Mermaid, syntax highlight) not loaded, fallback still parseable.
7. Accessibility Alignment: Proper ARIA improves agent semantic inference (dual benefit with screen readers).
8. Bounded Mutation: DOM subtree updates localized; avoid full reflow of ancestor containers to reduce flakiness in DOM diff polling.

### Mandatory Data Attributes (Baseline Set)
| Element | Attribute(s) | Purpose |
|---------|--------------|---------|
| Sidebar root | `data-ai-sidebar` | Root anchor for automation. |
| Message article | `data-ai-message`, `data-role="user|assistant"`, `data-msg-id` | Iterate & extract conversation. |
| Reasoning block | `data-ai-reasoning`, `data-collapsed="true|false"`, `data-token-est` | Agents decide expansion. |
| Action toolbar | `data-ai-msg-actions` | Discover available actions. |
| Slash suggestion | `data-ai-slash-option` | Autocomplete harvesting. |
| Knowledge note | `data-ai-note` | Extraction & embedding. |
| Preferences root | `data-ai-preferences` | Snapshot UI state. |
| Width handle | `data-ai-resize-handle` | Programmatic resize. |
| Quick action button | `data-ai-quick` | Trigger semantic shortcuts. |
| Settings modal | `data-ai-settings-modal` | Modal state tracking. |

### CustomEvent Schema (initial)
`svmai:event` with `detail = { type: string; ts: number; payload?: Record<string,any> }`
Events to emit: `sidebar_open`, `sidebar_close`, `message_send`, `message_append`, `reasoning_toggle`, `width_change`, `density_change`, `font_size_change`, `thread_fork`, `knowledge_add`.

### Agent Acceptance Addendum
For each micro-task: if it touches UI, it must (a) preserve existing `data-ai-*` selectors, (b) introduce new ones for new interactive elements, (c) emit events when state changes, (d) update agent docs appendix if new events/attributes added.

---
## Phase 0 — Baseline & Guardrails (Pre-Changes)
Purpose: lock in current behavior + metrics so improvements are measurable.

### 0.1 Baseline Snapshot & Metrics
- [ ] 0.1.1 Capture current UI screenshots
  - Goal: Preserve reference for regressions & visual diff.
  - Description: Produce a canonical visual baseline of every major interaction state (open, expanded, resized, menu open, tokens modal, new chat, pre/post message send, collapse, closed) so later visual deltas are intentional and code reviewers can quickly spot regressions.
  - Steps: Use existing full interaction test; copy latest `screenshots/ai-sidebar/full` to `docs/ai/sidebar-baseline/`; add a short README with capture date + viewport + commit hash.
  - Acceptance Criteria: Folder exists, README lists commit SHA & viewport; at least 10 distinct state screenshots; PR includes these assets (or git-lfs pointer if large).
  - Deliverables: Folder of curated PNGs; short README with date.
  - Impact: Sidebar: safer iteration. Platform: audit trail. Revenue: reduces regression-induced churn risk.
- [ ] 0.1.2 Define quantitative KPIs
  - Goal: Pick 5 metrics (messages visible @1000px, avg tokens/message before trimming, first meaningful paint of sidebar open, interaction latency, abandon rate proxy via early close).
  - Description: Establish measurable success indicators; clarifies whether UX changes increase throughput, depth of use, and retention. KPIs become part of weekly review dashboard.
  - Steps: Draft metrics doc; add lightweight telemetry stubs (no PII) placeholders; specify event payload schemas; circulate for review.
  - Acceptance Criteria: Document lists each KPI with definition, formula, collection point, and target baseline; telemetry stub code merged (console logging in dev).
  - Deliverables: `docs/ai/sidebar-kpis.md`.
  - Impact: Enables ROI tracking; improved prioritization.
- [ ] 0.1.3 Add telemetry hooks (scaffold)
  - Goal: Non-blocking event emitters (e.g., `aiSidebar:event` logger abstraction).
  - Description: Foundational instrumentation enabling behavior analytics without coupling UI components to analytics vendor; easily swapped later.
  - Steps: Create `lib/ai/telemetry.ts`; export `track(event, data)`; integrate open/close, resize, send; ensure no runtime errors if disabled; debounce high-frequency events.
  - Acceptance Criteria: Calls appear in dev console for each instrumented event; no performance warnings; unit test verifies `track` no-ops when disabled flag is false.
  - Deliverables: File + 5 inserted call sites.
  - Impact: Data-driven optimization.
    - Agent Considerations: Ensure telemetry wrapper optionally mirrors events as DOM CustomEvents for in-browser agents (`track` internally calls `dispatchEvent`).

### 0.2 Test Hardening
- [ ] 0.2.1 Add deterministic message seeding util
  - Goal: Inject N mock messages for density tests.
  - Description: Enables simulation of large conversations for validating performance, virtualization, scrolling, and visual density adjustments consistently across environments.
  - Steps: Add helper `seedMessages(count)` in test utils; expose via window for manual QA; create a playwright spec that seeds 200 messages; verify scroll height & last message visibility.
  - Acceptance Criteria: Test passes; seeded messages show predictable content pattern (index numbers); no flakiness over 3 runs.
  - Deliverables: `tests/utils/aiSeed.ts`; new spec verifying scroll & layout.
  - Impact: Facilitates density improvements; prevents performance regressions.
    - Agent Considerations: Seeding util also exposes a window API `window.__SVMAI_SEED__(n)` for automated agent warm-up.
- [ ] 0.2.2 Accessibility smoke test
  - Goal: Automated check for ARIA + keyboard.
  - Description: Early detection of regressions in roles, labels, focus order; reduces later remediation cost.
  - Steps: Integrate axe-core in one playwright test; run analysis after sidebar fully rendered; fail on serious & critical issues; document any intentional violations.
  - Acceptance Criteria: Test file exists; run outputs zero serious violations; pipeline gate ready.
  - Deliverables: `e2e/ai-sidebar-a11y.spec.ts`.
  - Impact: Broader audience usability (retention & compliance).
    - Agent Considerations: Axe test ensures semantic roles agents may rely on remain stable; store violation snapshot for diff.

---
## Phase 1 — High-Impact Quick Wins (Week 1)
Focus: Density, visual differentiation, comfort settings, input ergonomics.

### 1.1 Density / Compact Mode
- [ ] 1.1.1 Introduce UI preference state
  - Goal: Add `uiPreferences` slice (density, fontSize) persisted in localStorage.
  - Description: Central store for personalization to avoid scattering localStorage access throughout components; foundation for future AB tests.
  - Steps: Create `hooks/useUIPreferences.ts`; implement context/provider or simple hook with lazy init; read/write JSON under `aiUIPrefs` key; include type definitions.
  - Acceptance Criteria: Hook returns stable reference; updating density re-renders consumers; persistence survives reload.
  - Deliverables: `hooks/useUIPreferences.ts`.
  - Impact: Sidebar personalization; Platform baseline for future preference features; Revenue via improved session length.
- [ ] 1.1.2 Apply compact classnames
  - Goal: Switch spacing tokens when density = compact.
  - Description: Compact mode reduces vertical whitespace and padding to increase messages per viewport without sacrificing readability.
  - Steps: Add conditional logic: comfortable -> space-y-4, px-4 py-2; compact -> space-y-2, px-3 py-1.5; update max-width rule if needed; ensure no layout jump on toggle (animate gap with transition?).
  - Acceptance Criteria: Toggling density updates spacing instantly; message count visible at 1000px increases ≥40%; no console errors.
  - Deliverables: Diff in `ChatUI.tsx` lines (message list).
  - Impact: +~80–120% more messages visible.
    - Agent Considerations: Add `data-density` attribute on root container so agents can detect layout mode without computing style.
- [ ] 1.1.3 Add density toggle control
  - Goal: User can toggle from header menu > Settings > Appearance.
  - Description: Provide discoverable UI to change density; persists choice; accessible radio group.
  - Steps: Extend SettingsModal with fieldset + radios; connect to hook; add aria-labels; show preview snippet if space allows.
  - Acceptance Criteria: Selection persists after reload; keyboard navigable; visually indicates current selection.
  - Deliverables: UI control + persisted toggle.
  - Impact: Lower bounce for power users.
    - Agent Considerations: Density toggle control labeled with `data-ai-pref-density`; fire `density_change` event.

### 1.2 Message Visual Differentiation
- [ ] 1.2.1 Define role token styles
  - Goal: Distinguish user vs assistant bubbles.
  - Description: Visual role cues decrease misattribution errors (user re-reading their own question thinking it's AI output) and improve scanning speed in dense threads.
  - Steps: Introduce utility classes: user -> border-accent/60 + subtle background tint; assistant -> neutral border + faint gradient top; maintain dark mode contrast; update conditional styles in map.
  - Acceptance Criteria: Contrast ratio ≥4.5:1 for text; immediate visual distinction; screenshot added.
  - Deliverables: Updated conditional classes.
  - Impact: Faster cognitive parsing; reduces misread responses.
    - Agent Considerations: Role styling paired with `data-role`; do not rely solely on visual cues.
- [ ] 1.2.2 Add optional role label (tiny)
  - Goal: Label above bubble, 10–11px uppercase.
  - Description: Supplement color/border differentiation with explicit textual role (a11y friendly), minimizing ambiguity in multi-agent scenarios.
  - Steps: Render small label span; add sr-only role announcement or aria-label on article; style with tracking-wide.
  - Acceptance Criteria: Labels visible in both densities; turning off labels hides them fully; no layout shift when added.
  - Deliverables: Modified message render function.
  - Impact: Improves multi-role/agent clarity.
    - Agent Considerations: Label container gets `data-ai-role-label` for scraping distinct from message text.
- [ ] 1.2.3 Setting to hide labels
  - Goal: Preference switch to disable labels.
  - Description: Allows minimalist view for users prioritizing vertical density.
  - Steps: Add boolean in preferences; toggle in Appearance; wrap label render in conditional.
  - Acceptance Criteria: Toggle persists across reload; default = on.
  - Deliverables: Preferences update.
  - Impact: Customization reduces annoyance friction.
    - Agent Considerations: Preference change triggers CustomEvent with new `labelsVisible` boolean.

### 1.3 Autosizing Input & Multi-line Comfort
- [ ] 1.3.1 Create useAutosizeTextarea hook
  - Goal: Auto grow to max 6 lines.
  - Description: Improves authoring of nuanced prompts while preventing runaway growth that pushes messages off screen.
  - Steps: On value change set height to 'auto', read scrollHeight, clamp to maxHeight (calc from line-height * 6), set explicit px height.
  - Acceptance Criteria: Growth smooth; no scrollbars until max lines reached; shrinking works when text deleted.
  - Deliverables: `hooks/useAutosizeTextarea.ts`.
  - Impact: Encourages richer prompts (value density increases LLM relevance, potential upsell into advanced usage).
    - Agent Considerations: Textarea gets `data-ai-chat-input`; autosize height changes emit throttled `input_resize` event (payload: {h}).
- [ ] 1.3.2 Integrate hook into ChatUI
  - Goal: Replace static rows=1.
  - Description: Wire autosize with existing input; ensure Enter submit logic unaffected.
  - Steps: Provide ref; call hook; remove fixed rows attr; adjust padding if height > single line.
  - Acceptance Criteria: No regression in slash command dropdown positioning; screenshot updated.
  - Deliverables: Code diff.
  - Impact: Input friction reduction.
    - Agent Considerations: Maintain stable textarea ID so agents can reattach after rerenders.
- [ ] 1.3.3 Keyboard quick clear (Ctrl+L style)
  - Goal: Provide additional shortcut if not colliding.
  - Description: Speed tool for iterative refinement workflows; avoids manual selection/backspace.
  - Steps: Add key handler for Ctrl+Shift+K; call onInputChange(''); announce via aria-live ("Input cleared").
  - Acceptance Criteria: Works only when focus in textarea; does not trigger browser default; documented in quick tips.
  - Deliverables: Code addition.
  - Impact: Power user velocity.
    - Agent Considerations: Shortcut registered also documented in agent appendix to avoid collisions with automation keystrokes.

### 1.4 Resize Handle & Accessibility
- [ ] 1.4.1 Increase hit target
  - Goal: Expand invisible region to 10px.
  - Description: Reduces failed/rescue drag attempts improving perceived quality.
  - Steps: Add absolutely positioned wrapper wider than visual line; maintain visual center line.
  - Acceptance Criteria: Drag success rate (manual test 10 tries) = 100%; no overlap interference with content click targets.
  - Deliverables: Layout update.
  - Impact: Reduced failed drag attempts.
    - Agent Considerations: Add `data-ai-resize-handle`; width mutation emits `width_change` event.
- [ ] 1.4.2 Make handle keyboard adjustable
  - Goal: ArrowLeft/Right change width by 24px.
  - Description: Accessibility compliance & inclusive design; enables precise adjustments.
  - Steps: Add `tabIndex=0`; keydown listener; clamp width; aria-valuenow, aria-valuemin, aria-valuemax (treat as slider if appropriate) or describe via aria-label.
  - Acceptance Criteria: Focus ring visible; width updates on arrow keys; screen reader announces change.
  - Deliverables: A11y improvement.
  - Impact: Inclusivity; platform compliance.
    - Agent Considerations: Keyboard adjustments also fire same `width_change` event path for uniform automation.
- [ ] 1.4.3 Telemetry on width changes
  - Goal: Log distribution of widths for data-driven default.
  - Description: Data informs default width adjustments & potential responsive heuristics.
  - Steps: Debounce width updates; bucket into ranges (<=420, 421-520, 521-640, >640); send `width_change` event.
  - Acceptance Criteria: Event fires at most once per 500ms continuous drag; payload includes bucket + exact px.
  - Deliverables: Telemetry code.
  - Impact: Future optimization insight.
    - Agent Considerations: Bucket & raw width included in CustomEvent detail.

### 1.5 Settings Modal Enhancements
- [ ] 1.5.1 Add ESC to close
  - Goal: Overlay intercept fix.
  - Description: Provide an intuitive keyboard escape route consistent with modal patterns; resolves current test flakiness cause.
  - Steps: useEffect add keydown listener; if key==='Escape' invoke onClose; cleanup on unmount.
  - Acceptance Criteria: ESC closes modal from any focusable child; does not propagate to underlying page.
  - Deliverables: Code diff.
  - Impact: Faster dismissal; reduces confusion.
    - Agent Considerations: Settings modal root gets `data-ai-settings-modal`; ESC close dispatches `settings_close` event.
- [ ] 1.5.2 Focus trap & return focus
  - Goal: Usable keyboard flow.
  - Description: Prevent focus from leaving modal while open; restore focus to triggering button on close for continuity.
  - Steps: Implement simple trap (cycle first/last); store activeElement before open; focus first interactive element; on close refocus trigger.
  - Acceptance Criteria: Tabbing cycles within; shift+tab works; lighthouse a11y score improves/unchanged.
  - Deliverables: Minimal trap logic or simplex library.
  - Impact: Accessibility rating improvement.
    - Agent Considerations: Focus trap exposes active element index via `data-focus-index` for agent step-through testing.
- [ ] 1.5.3 Appearance section grouping
  - Goal: Cluster density, font size.
  - Description: Improves discoverability by thematically grouping personalization controls; reduces cognitive load scanning Settings.
  - Steps: Add subheading "Appearance"; wrap related controls; optional dividers; accessible heading structure (h3 or aria-level).
  - Acceptance Criteria: Screen reader outlines coherent hierarchy; visual grouping evident.
  - Deliverables: Updated SettingsModal.
  - Impact: Discoverability of personalization.
    - Agent Considerations: Group wrapper `data-ai-appearance-group` for parsing available prefs.

### 1.6 Font Size Preference
- [ ] 1.6.1 Add fontSize to preferences (12/13/14)
  - Goal: Adjustable base font size.
  - Description: Accessibility & comfort; supports varied display DPI and user vision requirements.
  - Steps: Extend preferences type; default 12; persist value; export enumerated options constant.
  - Acceptance Criteria: Hook returns current fontSize; persists after reload.
  - Deliverables: Hook update.
    - Agent Considerations: Expose getter `window.SVMAI?.getPreferences()` returning snapshot JSON.
- [ ] 1.6.2 Apply dynamic class on root chat container
  - Goal: Scale typography consistently.
  - Description: Single switch point avoids scattering conditional class logic.
  - Steps: Add wrapper class mapping (12 -> text-[12px], 13 -> text-[13px], 14 -> text-[14px]); ensure nested overrides (code, headings) remain proportional.
  - Acceptance Criteria: Snapshot test for each size variant passes.
  - Deliverables: Conditional class logic.
    - Agent Considerations: Root chat container gets `data-font-size="12|13|14"`.
- [ ] 1.6.3 Include in settings UI
  - Goal: Provide selection UI.
  - Description: Simple select or segmented control; accessible labels; live preview of current size.
  - Steps: Add control under Appearance; onChange update preference; announce via aria-live ("Font size set to 14px").
  - Acceptance Criteria: Changing size reflows immediately; no layout break.
  - Deliverables: UI control.
    - Agent Considerations: Font size control adds `data-ai-pref-font-size` attribute.
  - Impacts (all 3): Increases readability -> session duration -> retention & LTV uplift.

---
## Phase 2 — Progressive Disclosure & Message Tooling (Week 2)

### 2.1 Reasoning / Thinking Collapse
- [ ] 2.1.1 Define reasoning delimiter convention
  - Goal: Recognize internal chain-of-thought vs final answer.
  - Description: Establish a consistent pattern (e.g., "<REASONING>...</REASONING>" or delimiter lines) allowing UI and agents to segment internal reasoning from user-facing summary; avoids brittle regex on natural language.
  - Steps: Add server/model side tag markers (if already present simulate splitting by "Thought:" blocks).
  - Acceptance Criteria: Document lists delimiter format, rationale, and backward compatibility strategy; sample message transformation included.
  - Deliverables: Spec in `docs/ai/reasoning-format.md`.
  - Impact: Cleaner UI reduces cognitive overload -> higher engagement.
    - Agent Considerations: Specify reasoning delimiter also in agent appendix for deterministic split; include token estimate attribute.
- [ ] 2.1.2 Implement parser utility
  - Goal: Turn raw assistant message into structured pieces.
  - Description: Pure function to safely split visible answer from reasoning using spec; resilient to missing delimiters (returns entire content as visible).
  - Steps: Create `parseAssistantMessage(content)` returning { visible, reasoning? }.
  - Acceptance Criteria: Unit tests cover: no delimiter, both sections, nested delimiter edge, truncated reasoning; 100% branch coverage for utility.
  - Deliverables: Utility file + unit test.
  - Impact: Reusable foundation.
    - Agent Considerations: Parser exports pure function agents can reuse in headless mode.
- [ ] 2.1.3 Collapsible UI component
  - Goal: Present reasoning collapsed by default with expand.
  - Description: Accessible disclosure pattern using button -> region (aria-expanded + id/aria-controls) with reduced font-size and monospace option.
  - Steps: `<ReasoningBlock collapsed>` with token count, toggle.
  - Acceptance Criteria: Toggle changes aria-expanded; reasoning content hidden from assistive tech when collapsed; animation <150ms.
  - Deliverables: Component + styling.
  - Impact: Optional depth for power users.
    - Agent Considerations: Toggle button `data-ai-reasoning-toggle`; event on expand/collapse with token count.
- [ ] 2.1.4 Persist collapse preference
  - Goal: Maintain user default state across sessions.
  - Description: Preference flag `showReasoningDefault=false`; new messages respect preference; manual per-message toggle unaffected.
  - Steps: Use preferences; default collapsed.
  - Acceptance Criteria: Reload retains state; does not retro-collapse expanded messages during same session.
  - Output: Preference field.
- [ ] 2.1.5 Telemetry: expansion rate
  - Goal: Measure adoption of reasoning view.
  - Description: Track proportion of assistant messages whose reasoning was expanded at least once.
  - Steps: track('reasoning_toggle').
  - Acceptance Criteria: Event includes message id, expanded boolean, token count.
  - Impact: Measure value & potential gating for premium.
    - Agent Considerations: Telemetry event mirrored to DOM for third-party orchestration.

### 2.2 Message Action Toolbar
- [ ] 2.2.1 Create action bar component
  - Actions: Copy, Save to Knowledge, Share, Fork Thread, Site Search, Web Search.
  - Steps: `MessageActions.tsx` with props { message, onAction }.
  - Impact: Increases downstream feature discovery.
    - Agent Considerations: Each action button: `data-ai-action="copy|save|share|fork|site-search|web-search"`.
- [ ] 2.2.2 Inject under assistant messages
  - Goal: Make actions discoverable yet unobtrusive.
  - Description: Show toolbar on hover/focus with fade; keyboard focus arrives via Tab after message container.
  - Steps: Render on hover/focus via opacity transition.
  - Acceptance Criteria: No layout shift on reveal; accessible name on each button; toolbar hidden from screen readers when not visible (aria-hidden).
- [ ] 2.2.3 Implement Save to Knowledge
  - Goal: Persist selected assistant content as note.
  - Description: Extract markdown raw text; add timestamp + source message id; show toast with undo option.
  - Steps: Reuse existing notes insertion API; add toast.
  - Acceptance Criteria: Note appears instantly in Knowledge tab; undo removes it; event logged.
- [ ] 2.2.4 Implement Fork Thread
  - Goal: Create new conversation starting at selected message snapshot.
  - Description: Generate thread id; copy all prior user+assistant messages up to selection; navigate or switch context view.
  - Steps: Create new conversation state seeded with selected message & prior context summary.
  - Acceptance Criteria: New thread visible in threads list (Phase 3 dependency) or temporary indicator; original thread unchanged.
- [ ] 2.2.5 Implement Site Search
  - Goal: Quick pivot from answer to platform-wide search.
  - Description: Open internal search route with prefilled query = message text (trim to 120 chars, add ellipsis).
  - Steps: Trigger internal search route with encoded query.
  - Acceptance Criteria: New tab or panel opens; query field populated.
- [ ] 2.2.6 Implement Web Search placeholder
  - Goal: External research launching.
  - Description: For MVP open new window to Google/Bing with encoded query; future: aggregator API.
  - Steps: Open new tab to Google/Bing with query; later integrate API.
  - Acceptance Criteria: Window blocked rate minimal; message_action event logged.
- [ ] 2.2.7 Telemetry per action
  - Goal: Quantify feature usage distribution.
  - Description: Emit single schema {action, msgId, ts}.
  - Steps: track('msg_action', { action }).
  - Acceptance Criteria: All actions produce event; deduplicate repeated rapid clicks via 500ms throttle.
  - Revenue Impact: Surfaces advanced interactions -> upsell conversion signals.
    - Agent Considerations: Action executions dispatch `message_action` CustomEvent.

### 2.3 Knowledge Enhancements
- [ ] 2.3.1 Add search filter for notes
  - Goal: Allow rapid retrieval of stored knowledge.
  - Description: Client-side fuzzy or prefix filter; highlight matches.
  - Steps: Input field filtering client-side.
  - Acceptance Criteria: Filtering under 50ms for 500 notes; empty state message.
- [ ] 2.3.2 Promote note to context button
  - Goal: Reuse knowledge in new prompt quickly.
  - Description: Appends note content to current input (if non-empty, adds separator line). Cursor moves to end.
  - Steps: Appends note content to input with citation marker.
  - Acceptance Criteria: Input updated without losing undo stack; action logged.
- [ ] 2.3.3 Count tokens of notes cluster
  - Goal: Awareness of context size.
  - Description: Estimate tokens via heuristic; show aggregate near heading.
  - Steps: Simple rough token estimator (4 chars ≈1 token) aggregated.
  - Acceptance Criteria: Display updates on add/remove; test ensures estimator returns number.
- [ ] 2.3.4 Telemetry: note use frequency
  - Goal: Track note value.
  - Description: Fire event on promote, edit (future), delete.
  - Steps: track('knowledge_use').
  - Acceptance Criteria: Event includes action type and note id.
  - Revenue: Identifies engaged research workflows (target pro plans).
    - Agent Considerations: Notes search input `data-ai-notes-search`; results list items maintain `data-ai-note`.

### 2.4 Slash Command Enhancements
- [ ] 2.4.1 Add metadata descriptions
  - Goal: Improve discoverability of slash verbs.
  - Description: Extend internal list to include description; render below or in tooltip.
  - Steps: Extend suggestion objects { cmd, desc }.
  - Acceptance Criteria: Each suggestion displays description; screen reader reads both.
- [ ] 2.4.2 Right arrow completion
  - Goal: Provide alternative to Tab.
  - Description: If caret at end and suggestion active, Right inserts remainder.
  - Steps: Key handler addition.
  - Acceptance Criteria: Works only when no selection range; does not move caret wrongly.
- [ ] 2.4.3 Contextual suggestions (tx / account)
  - Goal: Prioritize context-relevant commands.
  - Description: Reorder suggestions placing matching contextual verbs first; style with subtle badge.
  - Steps: If pageContext present, reorder list.
  - Acceptance Criteria: Order stable; test verifies first item for tx page.
- [ ] 2.4.4 Telemetry: adoption metrics
  - Goal: Measure slash productivity impact.
  - Description: Track command chosen & completion method (tab/right/enter).
  - Steps: track('slash_used', { cmd }).
  - Acceptance Criteria: Event schema includes method; aggregated counts visible in dev log.
  - Impact: Increases speed -> more queries per session.
    - Agent Considerations: Slash suggestion objects exported for offline agent prompt building.

---
## Phase 3 — Performance & Scale (Week 3)
Agent Layer Focus: Ensure virtualization does not hide messages from agent extraction (render minimal metadata placeholders with `data-virtualized="true"`).

### 3.1 Virtualization Reintroduction
- [ ] 3.1.1 Pick lib or custom (e.g., react-virtual)
  - Steps: Spike branch measuring complexity.
  - Deliverable: decision note.
    - Agent Considerations: Choose library supporting itemKey prop for stable IDs to keep data-msg-id continuity.
- [ ] 3.1.2 Implement windowed list >150 msgs
  - Steps: Conditional switch when length threshold reached.
    - Agent Considerations: Offscreen messages replaced by lightweight placeholder retaining data-msg-id and data-virtualized attribute.
- [ ] 3.1.3 Maintain auto-scroll anchor
  - Steps: Use last index sentinel; on new messages scroll into view.
    - Agent Considerations: Sentinel element has `data-ai-scroll-sentinel` for detection.
- [ ] 3.1.4 Performance test (seed 500)
  - Steps: Playwright: measure time to interactive.
    - Agent Considerations: Also measure agent extraction time for 500 messages (scripted benchmark).
- [ ] 3.1.5 Telemetry: dropped frames sampling
  - Steps: `requestAnimationFrame` delta sampling.
    - Agent Considerations: Expose perf summary via `window.SVMAI?.getPerfSnapshot()`.
  - Revenue: Handles heavy research sessions → retention for power users.

### 3.2 Rendering Enhancements
- [ ] 3.2.1 Syntax highlight integration
  - Goal: Improve code readability.
  - Description: Add lazy-loaded highlighting (prism) only when code fences present; theme align with dark palette.
  - Steps: Add `rehype-prism-plus`; lazy-load CSS.
  - Acceptance Criteria: Highlighting applied to at least 5 languages; fallback plain text if load fails.
- [ ] 3.2.2 Mermaid diagrams opt-in
  - Goal: Enable structured diagram rendering.
  - Description: Detect fenced ```mermaid blocks; render via remark-mermaid; protect with error boundary fallback preformatted text.
  - Steps: remark-mermaid; wrap in error boundary.
  - Acceptance Criteria: Diagram renders; error fallback logs warning not error.
- [ ] 3.2.3 Collapsible large tables
  - Goal: Avoid overwhelming vertical space.
  - Description: If markdown table >20 rows, show first 8 + "Show more"; persist expanded state per message.
  - Steps: Detect >20 rows; add show more.
  - Acceptance Criteria: Expand/collapse toggles correctly; a11y attributes present.
  - Impact: Improves legibility; appeals to pro analytics users.
    - Agent Considerations: Large table collapse state carries `data-ai-table-collapsed`.

### 3.3 Thread Management
- [ ] 3.3.1 Conversation metadata schema
  - Goal: Formalize thread persistence.
  - Description: Define lightweight interface with version property for migrations.
  - Steps: Define { id, createdAt, title, summary }.
  - Acceptance Criteria: Type exported; unit test serializes/deserializes sample.
    - Agent Considerations: Expose threads list via `window.SVMAI?.threads()`; each item data-thread-id attr in DOM.
- [ ] 3.3.2 Store & list recent threads
  - Goal: Provide UI for past sessions.
  - Description: LocalStorage or IndexedDB store; list sorted by updatedAt desc.
  - Steps: Sidebar or menu list; limit 25.
  - Acceptance Criteria: Oldest pruned after adding 26th; rendering under 50ms for 25 items.
    - Agent Considerations: Provide pagination metadata attributes if more than 25.
- [ ] 3.3.3 Rename + pin actions
  - Goal: Allow organization of important threads.
  - Description: Pin moves thread to top pinned section; rename inline edit with Enter commit Esc cancel.
  - Steps: UI controls per item.
  - Acceptance Criteria: Pin order stable; rename persists reload.
- [ ] 3.3.4 Auto-summary generation
  - Goal: Friendly thread titles/summaries.
  - Description: Summarize first user prompt + latest assistant answer (truncate 60 chars) asynchronously.
  - Steps: Summarize first + last messages; update on new assistant reply.
  - Acceptance Criteria: Summary available <1s after reply; fallback uses first 6 words.
- [ ] 3.3.5 Telemetry: thread reopen rate
  - Goal: Measure multi-session value.
  - Description: Event on selecting existing thread vs new.
  - Impact: Multi-thread retention improvements.
    - Agent Considerations: Reopen events dispatch `thread_open` with thread id.

---
## Phase 4 — Advanced Intelligence & Monetization (Week 4+)
Agent Layer Focus: Premium gating should not silently remove hooks; instead add `data-gated="true"` and CTA element for agent awareness.

### 4.1 Structured Metadata Layer
- [ ] 4.1.1 Add data attributes to message DOM
  - Goal: Machine extractable transcript.
  - Description: Add deterministic ids (uuid v7 or incremental) & token estimate attribute for cost analytics.
  - Steps: `data-ai-msg-id`, role, tokens est.
  - Acceptance Criteria: Attributes present for all messages including system/notes; no duplicates.
    - Agent Considerations: Token estimate attribute stable schema: integer tokens; if unknown omit attribute (agents treat missing as needs estimation).
- [ ] 4.1.2 Export JSON transcript
  - Goal: Enable archival / external tooling.
  - Description: Build exporter returning array of {id, role, content, ts, tokens?}.
  - Steps: Action in menu -> download.
  - Acceptance Criteria: Downloaded file valid JSON; respects selected thread only.
    - Agent Considerations: Also provide programmatic `window.SVMAI?.exportTranscript({format:'json'})`.
- [ ] 4.1.3 Programmatic embedding pipeline (future)
  - Goal: Lay groundwork for vector search enrichment.
  - Description: Provide queue stub function pushing message ids into pending list for future worker.
  - Steps: Stub call to vector index.
  - Acceptance Criteria: Stub logs queue size; no runtime errors when disabled flag false.
  - Revenue: Enables enterprise analytics upsell.
    - Agent Considerations: Embedding stub dispatches `embedding_queue` event with note/message id.

### 4.2 Premium Feature Gating
- [ ] 4.2.1 Flag advanced reasoning view
  - Goal: Create value differentiation.
  - Description: After N reasoning expansions (configurable) show overlay with upgrade CTA preserving underlying content.
  - Steps: If not premium, show CTA overlay after X expansions.
  - Acceptance Criteria: Overlay dismissible; expansions counted correctly; event logged.
    - Agent Considerations: Overlay root `data-ai-premium-overlay` for detection; include feature code in attribute.
- [ ] 4.2.2 Higher token limits in settings
  - Goal: Limit resource-heavy usage for free tier.
  - Description: Disable slider beyond threshold with tooltip explaining; immediate upgrade link.
  - Steps: Disable slider beyond threshold unless upgraded.
  - Acceptance Criteria: Attempt to drag beyond threshold blocked; gating event logged once per session.
    - Agent Considerations: Slider retains value attribute but adds `data-locked="true"` when gated.
- [ ] 4.2.3 Telemetry funnel for gated clicks
  - Goal: Measure conversion path.
  - Description: Log events sequence: view_gate -> click_upgrade -> upgrade_success/fail.
  - Revenue: Conversion driver instrumentation.
    - Agent Considerations: Gated click event detail includes `feature` & `reason`.

### 4.3 Enhanced Knowledge Graph Tie-In
- [ ] 4.3.1 Link saved knowledge to vector search
  - Goal: Semantic retrieval for context injection.
  - Description: When note added, schedule embedding creation & index insertion (mock if infra absent yet).
  - Steps: Background job to embed new notes.
  - Acceptance Criteria: Embedding job queued event; duplicate prevention (idempotent).
- [ ] 4.3.2 Inline related knowledge suggestions
  - Goal: Encourage reuse of existing knowledge.
  - Description: After assistant reply, show up to 3 notes ranked by embedding similarity.
  - Steps: After assistant reply, show 3 chips.
  - Acceptance Criteria: Chips clickable; dismiss hides for that reply only.
- [ ] 4.3.3 Measure note -> prompt reuse rate
  - Goal: Quantify knowledge leverage.
  - Description: Track ratio of prompts containing inserted note content.
  - Impact: Indicates stickiness; informs pricing tiers.
    - Agent Considerations: Related knowledge suggestions list `data-ai-related-knowledge` container.

---
## Phase 5 — Quality, Polishing & Continuous Optimization
Agent Layer Focus: Visual polish changes must not rename or remove existing `data-ai-*` attributes; animation wrappers add `data-anim-wrapper` where needed.

### 5.1 UX Polish
- [ ] 5.1.1 Micro-animations (fade/scale in messages)
  - Goal: Improve perceived fluidity without harming performance.
  - Description: Apply reduced-motion-safe transitions (opacity+translateY <120ms) to new message mount.
  - Steps: Tailwind animate or framer-motion optional, behind reduced-motion check.
  - Acceptance Criteria: No CLS; disabled when prefers-reduced-motion set.
    - Agent Considerations: If animation delays content insertion, insert skeleton with same data attributes immediately.
- [ ] 5.1.2 Consistent border radii & shadows
  - Goal: Visual coherence.
  - Description: Centralize design tokens; replace ad-hoc radii/shadows.
  - Steps: Extract design tokens file.
  - Acceptance Criteria: Single source file; lint rule optional to prevent inline shadow strings.
    - Agent Considerations: Tokens export as JS object available to agents for consistent theming snapshot.
- [ ] 5.1.3 Dark theme contrast review
  - Goal: Ensure accessible contrast.
  - Description: Run automated contrast checker across message & control surfaces; adjust tokens.
  - Steps: Run contrast tooling; adjust subtle borders.
  - Acceptance Criteria: All text/background pairs meet WCAG AA; report stored.
    - Agent Considerations: Provide contrast report JSON accessible at `window.SVMAI?.contrastReport` in dev mode.

### 5.2 Observability & Feedback Loop
- [ ] 5.2.1 In-app feedback button
  - Goal: Capture contextual qualitative input.
  - Description: Small button near toolbar opens inline form; includes hidden context snapshot (thread id, message count).
  - Steps: Inline form capturing category & optional email.
  - Acceptance Criteria: Submission posts payload (or logs) with anti-spam min length; confirmation toast.
    - Agent Considerations: Feedback form root `data-ai-feedback-form`; submission event `feedback_submit`.
- [ ] 5.2.2 Weekly KPI dashboard generation script
  - Goal: Automate reporting.
  - Description: Script aggregates raw telemetry JSON -> Markdown & JSON summary (top commands, avg session length, expansion rate).
  - Steps: Node script aggregating telemetry JSON -> markdown report.
  - Acceptance Criteria: Script runs locally; output committed in /docs/analytics/ with date stamp.
    - Agent Considerations: Expose raw aggregated JSON endpoint or file path in doc for agent ingestion.
- [ ] 5.2.3 Churn risk detector heuristic
  - Goal: Early retention intervention.
  - Description: Detect pattern open->close cycles under 10s (>=3 in 5m) and emit churn signal event.
  - Steps: Identify pattern: open -> close <10s repeatedly; log event.
  - Acceptance Criteria: Debounced detection; unit test simulating pattern triggers once.
    - Agent Considerations: Emit `churn_signal` CustomEvent so proactive agent could intervene with help tip.

### 5.3 Experimentation Hooks
- [ ] 5.3.1 Add experiment assignment util
  - Goal: Deterministic bucketing.
  - Description: Hash stable user key with murmurhash -> bucket; store in localStorage; supports multi-experiment registry.
  - Steps: Deterministic hash of user id (or anonymous key) -> bucket.
  - Acceptance Criteria: Same key always yields same bucket; unit test with fixtures.
    - Agent Considerations: Bucket id available via `data-ai-exp-bucket` on root.
- [ ] 5.3.2 A/B compact mode default
  - Goal: Validate compact default effect.
  - Description: Assign users to baseline vs compact default; metrics compare retention & messages per session.
  - Steps: 50/50 assign; measure engagement delta.
  - Acceptance Criteria: Experiment metadata recorded; safe fallback if preference manually changed.
    - Agent Considerations: Experiment assignment event `experiment_assign` fires once per session.
- [ ] 5.3.3 Report significance template
  - Goal: Standardize AB analysis.
  - Description: Node script computing chi-square / p-value for key proportions; outputs Markdown + JSON.
  - Steps: Script for chi-square / proportion test output.
  - Acceptance Criteria: Script handles missing data gracefully; includes min sample size check.
    - Agent Considerations: Statistical report also serializable JSON for agent summarization.

---
## Cross-Cutting Concerns

| Concern | Mitigation |
|---------|------------|
| Regression risk | Snapshot + e2e before merges |
| Performance drift | Telemetry + virtualization threshold |
| Accessibility | Axe test per PR + manual keyboard pass |
| Token cost | Collapsed reasoning by default |
| Cognitive overload | Progressive disclosure (actions, reasoning) |
| Revenue alignment | Telemetry gating & premium flags |

---
## Implementation Order Guidance
1. Baseline (0.x) must precede visual + interaction changes.
2. Phase 1 delivers immediate perceived speed & clarity wins (often lifts engagement fastest).
3. Phase 2 builds retention surfaces (actions, reasoning collapse) and seeds monetization levers.
4. Phase 3 ensures scalability for power users (prevent performance cliff). 
5. Phase 4 unlocks monetization levers (premium reasoning depth, analytics). 
6. Phase 5 institutionalizes continuous improvement.

---
## Impact Summary (Roll-Up)
- Sidebar UX: +Message density, +Control, +Clarity, −Cognitive load.
- Platform: Adds telemetry, preference architecture, scalability patterns (virtualization, structured metadata).
- Revenue: More engaged sessions → higher probability of conversion; feature gating + advanced insights supply clear upsell points; knowledge reuse fosters lock-in.

---
## Suggested Daily Cadence (Example)
Day 1: 0.1.x + 0.2.x
Day 2: 1.1.x + 1.3.1/1.3.2
Day 3: 1.2.x + 1.4.x
Day 4: 1.5.x + 1.6.x
Day 5: Buffer / QA / Deploy Phase 1

---
## Definition of Done (Per Micro-Task)
- Code merged & passes lint/test.
- Telemetry (if specified) emits event (visible in dev log).
- Screenshots updated if visual.
- Docs updated if new capability.
 - Agent hooks present (data attributes + events) and documented if new.

---
## Next Step Recommendation
Start with 0.1.1–0.1.3 today; these unlock safe iteration + measurable progress. Then proceed to density (1.1) for immediate user-facing improvement.

---
_End of plan._
