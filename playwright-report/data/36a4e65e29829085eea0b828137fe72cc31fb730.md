# Page snapshot

```yaml
- alert
- navigation "Main navigation":
  - link "OPENSVM [AI]":
    - /url: /
  - text: 1:06:29 PM
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
  - heading "Solana Ecosystem Analytics" [level=1]
  - paragraph: Comprehensive analytics for DEXes, cross-chain flows, DeFi protocols, and validator performance.
  - tablist "Analytics navigation tabs":
    - tab "Overview tab - Network overview and key metrics": Overview
    - tab "Solana DEX tab - DEX volume, liquidity, and arbitrage opportunities" [selected]: Solana DEX
    - tab "Cross-Chain tab - Bridge flows and asset migrations": Cross-Chain
    - tab "DeFi Health tab - Protocol health and risk monitoring": DeFi Health
    - tab "Validators tab - Validator performance and decentralization analytics": Validators
    - tab "Launchpads tab - Token launch platforms and IDO analytics": Launchpads
    - tab "Bots tab - Telegram, Discord, and Matrix trading bots": Bots
    - tab "Aggregators tab - DEX and liquidity aggregation platforms": Aggregators
    - tab "Marketplaces tab - NFT and digital asset marketplaces": Marketplaces
    - tab "Social Fi tab - Social finance and community platforms": Social Fi
    - tab "Info Fi tab - Blockchain information and analytics platforms": Info Fi
    - tab "DeFAI tab - AI-powered DeFi and trading tools": DeFAI
  - tabpanel:
    - img
    - text: Loading DEX analytics...
```