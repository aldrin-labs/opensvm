# AI Sidebar Quick Actions

Small, testable shortcuts surfaced above the input when the AI sidebar is open on the Agent tab.

- TPS: asks "What is the current Solana TPS?" and auto-submits
- Explain Tx: fills a template "Explain this transaction: <paste signature>" (auto-fills and can auto-submit if you're on a /tx/… page)
- Wallet Summary: fills a template "Summarize this wallet: <paste address>" (auto-fills and can auto-submit if you're on an /account/… or /user/… page)
- Use Page Context: appears when on /tx/… or /account|/user/…, prefills a context-aware prompt

Notes
- No RPC changes were made. Uses existing client connection and sidebar context.
- Programmatic API: `window.SVMAI.prompt(text, submit?)` remains available for tests and manual checks.
- Data attributes are provided for E2E: `[data-ai-quick="tps|explain-tx|wallet-summary"]`.
 - Keyboard: Cmd/Ctrl+Shift+P inserts a context-aware prompt into the input (when available).
