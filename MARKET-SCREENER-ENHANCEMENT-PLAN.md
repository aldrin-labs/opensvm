# Market Screener Enhancement Plan

## Issues Identified

1. **All tabs show same data** - Only sorting changes, but the underlying token list is identical across Trending, All, My Pairs, Monitor, Followers, KOLs, and Whales tabs
2. **No DEX filtering** - Cannot filter by specific DEXes (Raydium, Meteora, Orca, Jupiter, etc.)
3. **No token pool search** - Cannot search for all pools containing a specific token (e.g., "show me all RIN pools")
4. **No OVSM pair** - Need to add OVSM token to the market list

## Solution Design

### 1. Tab-Specific Data Sources

Each tab should fetch different data:

- **Trending**: Top gainers by volume change (current implementation is OK)
- **All**: All available markets (current implementation is OK)
- **My Pairs**: User's saved/favorited pairs (needs localStorage)
- **Monitor**: User's watchlist (needs localStorage)
- **Followers**: Pairs followed by user's connections (needs social feature or mock)
- **KOLs**: Pairs recommended by Key Opinion Leaders (needs API or curated list)
- **Whales**: Pairs with large whale activity (needs on-chain analysis or Birdeye whale endpoint)

### 2. DEX Filter Implementation

Add filter options:
- All DEXes (default)
- Raydium
- Orca
- Meteora
- Jupiter
- Phoenix
- Lifinity
- Other

Data source: Birdeye API provides DEX information in pool/pair data

### 3. Token Pool Search

Add search modes:
- **Symbol search** (current): Search by token symbol (e.g., "SOL")
- **Pool search**: Find all pools containing a token (e.g., "RIN/USDC", "RIN/SOL", "RIN/BONK")

Implementation:
- Use Birdeye's token pairs endpoint: `/defi/token_pairs?address={mint}`
- Display all trading pairs for the searched token

### 4. Add OVSM Token

Add to FALLBACK_TOKENS list with proper mint address

## Implementation Steps

1. ✅ Analyze current implementation
2. ✅ Identify data sources
3. [ ] Add OVSM token to fallback list
4. [ ] Create new API endpoint for DEX-filtered markets
5. [ ] Create new API endpoint for token pool search
6. [ ] Update MarketScreener component with:
   - DEX filter dropdown
   - Pool search mode toggle
   - Tab-specific data fetching logic
   - localStorage for My Pairs and Monitor tabs
7. [ ] Add UI for filter controls
8. [ ] Test all features
9. [ ] Document changes

## API Endpoints Needed

### New: `/api/trading/pools`
- Query params: `token={mint}`, `dex={dex_name}`
- Returns: All pools/pairs for a specific token, optionally filtered by DEX

### Enhanced: `/api/trading/markets`
- Add query param: `dex={dex_name}` to filter by specific DEX
- Add query param: `tab={tab_type}` for tab-specific logic

## UI Changes

### Filter Panel Enhancements
```
[Search: ___________] [🔍]
[x] Search Mode: [ Symbol ▼ ]  // Symbol | Pools
[x] DEX Filter:  [ All ▼ ]     // All | Raydium | Orca | etc.
[x] Min Volume:  [_____]
[x] Max Volume:  [_____]
```

### Tab Behavior
- My Pairs: Show star icon to add/remove pairs
- Monitor: Show eye icon to add/remove from watchlist
- Each tab fetches appropriate data

## Technical Notes

- Use Birdeye API endpoints for real DEX data
- Implement localStorage for user preferences
- Add loading states for each tab
- Cache results per tab to reduce API calls
- Handle empty states gracefully
