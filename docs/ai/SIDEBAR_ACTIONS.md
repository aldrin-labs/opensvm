# AI Sidebar Actions

Small, useful actions available from the AI sidebar menu and input area.

## Actions

- Share
  - Copies a URL to clipboard that opens the AI sidebar (ai=1) and pre-fills the input (aitext) with your current input or the last user prompt.
  - Example: https://app.example/route?ai=1&aitext=Explain%20this%20transaction%3A%20...

- Export
  - Downloads a Markdown file containing the current tab's messages (user/assistant), with a timestamped filename.

- Help
  - Inserts "/help" in the input and submits, showing available slash commands.

## Keyboard

- Cancel: Press Esc while processing to cancel the current run.
- Submit: Enter to send, Shift+Enter for a newline.
- Context insert: Cmd/Ctrl+Shift+P inserts a context-aware prompt on tx/account pages.

## Notes

- Cancel is best-effort and stops UI updates; it doesn’t abort in-flight network calls.
- RPC logic is unchanged and uses the settings-driven client connection.
