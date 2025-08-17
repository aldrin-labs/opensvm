# AI Sidebar Baseline Visual Snapshot

Date: 2025-08-15
Commit: 64a775cbc4d1985fb95a78c5a3b8fe099cdef17d
Viewport: 1440x900 (intended reference)

This directory will contain baseline screenshots for key sidebar UI states prior to Phase 1 improvements.

States to capture (at least 10):
1. Sidebar closed
2. Sidebar open (empty thread)
3. Sidebar open with initial user message
4. Sidebar with assistant reply
5. Sidebar resized (wide)
6. New message badge visible (scrolled up)
7. Notes tab active with entries
8. Slash command suggestions visible
9. Processing state (in-progress response)
10. Voice recording active (if applicable)
11. Settings modal open (once implemented)

Capture Guidance:
- Use deterministic seed of messages (test util coming in 0.2.1) for reproducibility.
- Store PNGs named with incremental index + slug, e.g., `01-closed.png`, `02-open-empty.png`.
- Avoid personal data or secrets.

Update this README if viewport or capture process changes.
