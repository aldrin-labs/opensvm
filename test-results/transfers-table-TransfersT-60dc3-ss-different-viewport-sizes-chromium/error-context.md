# Page snapshot

```yaml
- alert
- navigation "Main navigation":
  - link "OPENSVM [AI]":
    - /url: /
  - text: 1:20:05 PM
  - searchbox "Search"
  - button "Search Settings":
    - img
  - button "Explore"
  - button "Tokens"
  - button "DeFi"
  - button "Analytics"
  - button:
    - img
  - button "Connect Wallet"
  - button "Open AI Assistant": AI Assistant
- main:
  - heading "Transfers Table Test Page" [level=1]
  - heading "All Transfers" [level=2]
  - img
  - textbox "Search transfers by address, token symbol, or signature..."
  - img
  - combobox:
    - option "All Types" [selected]
  - combobox:
    - option "All Tokens" [selected]
  - spinbutton
  - text: "-"
  - spinbutton
  - button "Solana Only"
  - button "Clear Filters"
  - text: Found 0 transfers (Solana-only)
  - region "All Transfers"
  - button "Loading..." [disabled]
```