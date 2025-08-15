# Verification Rules (Always-On)

These are the non-negotiable rules for changes in this repo. They ensure every change is proven to work with clear evidence.

## Always verify, always prove

- Map requirements to outcomes
  - Create or update a short checklist mapping each requirement to a concrete verification (test/assertion/screenshot/log).
  - Include this mapping in the PR under "Requirements coverage".

- Build and type safety
  - Run build and typecheck. Fix errors instead of suppressing them.
  - Status must be included in the PR: Build PASS/FAIL, Typecheck PASS/FAIL.

- Lint hygiene
  - Run lint and address errors. Do not silence rules without context.

- Tests first, evidence after
  - For UI changes: add or update a Playwright spec that exercises the changed UI paths.
  - For logic changes: add/update unit tests (Jest) for the touched areas.
  - Prefer minimal, focused tests (happy path + 1-2 edge cases) over broad fragile tests.

- Visual proof for UI
  - Capture step-by-step screenshots for key UI flows touched by the change (e.g., sidebar open/expand/resize/close).
  - Save under `screenshots/<feature>/` and reference them in the PR.

- Artifacts
  - Attach test results or link to `test-results/` artifacts if failures/flakes occur.
  - Summarize any flakes with retry outcome and mitigation.

- No broken states
  - Do not end a PR with failing build/tests/lint unless explicitly approved and justified.
  - If a check is intentionally skipped, document the reason and the follow-up.

## PR content must include

- Summary of change and impacted areas.
- Requirements coverage table: each requirement → verification method → status.
- Quality gates: Build, Lint, Typecheck, Unit, E2E (PASS/FAIL with brief notes).
- Evidence links: screenshots paths and relevant traces (if any).
- Risk/rollback plan for user-visible changes.

## Quick commands (local)

- Build/typecheck: `npm run build` or `bun run build`
- Lint: `npm run lint`
- Unit tests: `npm test`
- E2E focused example: `npx playwright test e2e/ai-sidebar-screenshots.spec.ts`

## Notes

- For visual regressions, prefer deterministic locators and wait strategies in Playwright.
- Default to increasing test reliability over adding sleeps; use role/label-based selectors.
- Update `/docs/architecture/adr/` when making architectural shifts.
