# Solana RPC Methods - Slang Edition

Watch account changes.

**accountSubscribe(pubkey, config?)**
- `pubkey` (string): Account pubkey, base58
- `config.encoding`: `base58|base64|base64+zstd|jsonParsed` (base58 is slow AF)
- `config.commitment`: How final you want it
- Returns: sub ID (number)
- Unsub: `accountUnsubscribe(subId)`

**blockSubscribe(filter, config?)**
Watch new blocks when `confirmed`/`finalized`. 
- `filter`: `"all"` or `{mentionsAccountOrProgram: "pubkey"}`
- `config.commitment`: `confirmed|finalized` 
- `config.encoding`: `json|jsonParsed|base58|base64`
- `config.transactionDetails`: `full|accounts|signatures|none`
- `config.maxSupportedTransactionVersion`: Set to `0` for all txs
- `config.showRewards`: Include rewards array
- Returns: sub ID
- Unsub: `blockUnsubscribe(subId)`

**logsSubscribe(filter, config?)**
Watch tx logs.
- `filter`: `"all"|"allWithVotes"` or `{mentions: ["pubkey"]}`  
- Returns: sub ID
- Unsub: `logsUnsubscribe(subId)`

**programSubscribe(programId, config?)**
Watch program account changes.
- `programId` (string): Program pubkey
- `config.filters`: Array of filters (all must match)
- `config.encoding`: Data format
- Returns: sub ID
- Unsub: `programUnsubscribe(subId)`

**rootSubscribe()**
Watch root changes. No params.
- Returns: sub ID
- Unsub: `rootUnsubscribe(subId)`

**signatureSubscribe(signature, config?)**
Watch specific tx confirmation.
- `signature` (string): Tx sig, base58
- `config.commitment`: Finality level
- `config.enableReceivedNotification`: Also notify on receive
- Returns: sub ID (auto-cancels after notification)
- Unsub: `signatureUnsubscribe(subId)`

**slotSubscribe()**
Watch slot processing. No params.
- Returns: sub ID
- Unsub: `slotUnsubscribe(subId)`

**slotsUpdatesSubscribe()**
Watch slot updates (unstable). No params.
- Returns: sub ID  
- Unsub: `slotsUpdatesUnsubscribe(subId)`

**voteSubscribe()**
Watch vote gossip (unstable, needs `--rpc-pubsub-enable-vote-subscription`). No params.
- Returns: sub ID
- Unsub: `voteUnsubscribe(subId)`

---

## HTTP Methods

**getAccountInfo(pubkey, config?)**
Get account data.
- `pubkey` (string): Account address
- `config.encoding`: `base58|base64|base64+zstd|jsonParsed`
- `config.dataSlice`: `{offset, length}` for partial data
- `config.commitment`: Finality level
- Returns: Account object or null

**getBalance(pubkey, config?)**
Get lamport balance.
- `pubkey` (string): Account address
- Returns: Balance as u64

**getBlock(slot, config?)**
Get block info.
- `slot` (u64): Block slot
- `config.encoding`: `json|jsonParsed|base58|base64`
- `config.transactionDetails`: Detail level
- `config.maxSupportedTransactionVersion`: `0` for all tx types
- `config.rewards`: Show rewards array
- Returns: Block object or null

**getBlockCommitment(slot)**
Get block commitment.
- `slot` (u64): Block slot
- Returns: `{commitment: Array<u64>, totalStake: u64}`

**getBlockHeight(config?)**
Current block height.
- Returns: Block height as u64

**getBlockProduction(config?)**
Block production stats.
- `config.identity`: Filter by validator
- `config.range`: `{firstSlot, lastSlot?}`
- Returns: Production data by validator

**getBlocks(startSlot, endSlot?, config?)**
List confirmed blocks.
- `startSlot` (u64): Start slot
- `endSlot` (u64): End slot (max 500k range)
- Returns: Array of slot numbers

**getBlocksWithLimit(startSlot, limit, config?)**
List blocks with limit.
- `limit` (u64): Max blocks (≤500k)
- Returns: Array of slot numbers

**getBlockTime(slot)**
Block production time.
- `slot` (u64): Block slot
- Returns: Unix timestamp or null

**getClusterNodes()**
Cluster node info.
- Returns: Array of node objects with gossip/rpc/tpu addresses

**getEpochInfo(config?)**
Current epoch info.
- Returns: `{absoluteSlot, blockHeight, epoch, slotIndex, slotsInEpoch, transactionCount}`

**getEpochSchedule()**
Epoch schedule config.
- Returns: `{firstNormalEpoch, firstNormalSlot, leaderScheduleSlotOffset, slotsPerEpoch, warmup}`

**getFeeForMessage(message, config?)**
Get tx fee for message.
- `message` (string): Base64 message
- Returns: Fee in lamports

**getFirstAvailableBlock()**
Lowest unpurged block slot.
- Returns: Slot number

**getGenesisHash()**
Genesis hash.
- Returns: Hash string

**getHealth()**
Node health.
- Returns: `"ok"` or error object

**getHighestSnapshotSlot()**
Highest snapshot info.
- Returns: `{full: u64, incremental?: u64}` or error

**getIdentity()**
Node identity.
- Returns: `{identity: string}`

**getInflationGovernor(config?)**
Inflation settings.
- Returns: `{foundation, foundationTerm, initial, taper, terminal}`

**getInflationRate()**
Current inflation rates.
- Returns: `{total, validator, foundation, epoch}`

**getInflationReward(addresses, config?)**
Inflation rewards for addresses.
- `addresses` (Array): Account pubkeys
- `config.epoch`: Specific epoch
- Returns: Array of reward objects

**getLargestAccounts(config?)**
20 largest accounts by balance.
- `config.filter`: `"circulating"|"nonCirculating"`
- Returns: Array of `{address, lamports}`

**getLatestBlockhash(config?)**
Latest blockhash.
- Returns: `{blockhash, lastValidBlockHeight}`

**getLeaderSchedule(slot?, config?)**
Leader schedule for epoch.
- `slot` (u64): Slot for epoch lookup
- `config.identity`: Filter by validator
- Returns: Map of validator -> slot indices

**getMaxRetransmitSlot()**
Max retransmit slot.
- Returns: Slot number

**getMaxShredInsertSlot()**
Max shred insert slot.
- Returns: Slot number

**getMinimumBalanceForRentExemption(dataLength, config?)**
Min balance for rent exemption.
- `dataLength` (usize): Account data size
- Returns: Min lamports needed

**getMultipleAccounts(addresses, config?)**
Get multiple account info.
- `addresses` (Array): Up to 100 pubkeys
- `config.encoding`: Data format
- `config.dataSlice`: Partial data
- Returns: Array of account objects

**getProgramAccounts(programId, config?)**
Get all accounts owned by program.
- `programId` (string): Program pubkey
- `config.filters`: Account filters (all must match)
- `config.encoding`: Data format
- `config.dataSlice`: Partial data
- Returns: Array of `{pubkey, account}` objects

**getRecentPerformanceSamples(limit?)**
Recent perf samples.
- `limit` (usize): Number of samples (max 720)
- Returns: Array of perf objects

**getRecentPrioritizationFees(addresses?)**
Recent priority fees.
- `addresses` (Array): Up to 128 addresses
- Returns: Array of `{slot, prioritizationFee}`

**getSignaturesForAddress(address, config?)**
Get tx signatures for address.
- `address` (string): Account pubkey
- `config.limit`: Max sigs (1-1000)
- `config.before`: Start from this sig
- `config.until`: Stop at this sig
- Returns: Array of signature info

**getSignatureStatuses(signatures, config?)**
Check signature statuses.
- `signatures` (Array): Up to 256 signatures
- `config.searchTransactionHistory`: Search ledger cache
- Returns: Array of status objects

**getSlot(config?)**
Current slot.
- Returns: Slot number

**getSlotLeader(config?)**
Current slot leader.
- Returns: Validator pubkey

**getSlotLeaders(startSlot, limit)**
Slot leaders for range.
- `startSlot` (u64): Start slot
- `limit` (u64): Number of slots (1-5000)
- Returns: Array of validator pubkeys

**getStakeMinimumDelegation(config?)**
Min stake delegation.
- Returns: Min lamports

**getSupply(config?)**
Total supply info.
- `config.excludeNonCirculatingAccountsList`: Skip account list
- Returns: `{total, circulating, nonCirculating, nonCirculatingAccounts}`

**getTokenAccountBalance(tokenAccount, config?)**
SPL token account balance.
- `tokenAccount` (string): Token account pubkey
- Returns: `{amount, decimals, uiAmount, uiAmountString}`

**getTokenAccountsByDelegate(delegate, filter, config?)**
Token accounts by delegate.
- `delegate` (string): Delegate pubkey
- `filter`: `{mint: string}` or `{programId: string}`
- `config.encoding`: Data format
- Returns: Array of token accounts

**getTokenAccountsByOwner(owner, filter, config?)**
Token accounts by owner.
- `owner` (string): Owner pubkey  
- `filter`: `{mint: string}` or `{programId: string}`
- Returns: Array of token accounts

**getTokenLargestAccounts(mint, config?)**
20 largest token holders.
- `mint` (string): Token mint pubkey
- Returns: Array of `{address, amount, decimals, uiAmount, uiAmountString}`

**getTokenSupply(mint, config?)**
Token total supply.
- `mint` (string): Token mint pubkey
- Returns: `{amount, decimals, uiAmount, uiAmountString}`

**getTransaction(signature, config?)**
Get tx details.
- `signature` (string): Tx signature
- `config.encoding`: `json|jsonParsed|base64|base58`
- `config.maxSupportedTransactionVersion`: `0` for all tx types
- Returns: Transaction object or null

**getTransactionCount(config?)**
Total tx count.
- Returns: Count as u64

**getVersion()**
Node software version.
- Returns: `{"solana-core": string, "feature-set": u32}`

**getVoteAccounts(config?)**
Voting accounts info.
- `config.votePubkey`: Filter by vote account
- `config.keepUnstakedDelinquents`: Include delinquent validators
- Returns: `{current: Array, delinquent: Array}` of vote accounts

**isBlockhashValid(blockhash, config?)**
Check if blockhash still valid.
- `blockhash` (string): Blockhash to check
- Returns: Boolean

**minimumLedgerSlot()**
Lowest ledger slot.
- Returns: Slot number

**requestAirdrop(pubkey, lamports, config?)**
Request testnet airdrop.
- `pubkey` (string): Recipient address
- `lamports` (u64): Amount to airdrop
- Returns: Transaction signature

**sendTransaction(transaction, config?)**
Submit signed tx.
- `transaction` (string): Fully-signed tx (base58/base64)
- `config.encoding`: `base58|base64`
- `config.skipPreflight`: Skip checks
- `config.preflightCommitment`: Preflight commitment level
- `config.maxRetries`: Max retry attempts
- Returns: Transaction signature

**simulateTransaction(transaction, config?)**
Simulate tx execution.
- `transaction` (string): Tx data (signed/unsigned)
- `config.encoding`: `base58|base64`
- `config.replaceRecentBlockhash`: Use latest blockhash
- `config.sigVerify`: Verify signatures
- `config.innerInstructions`: Include inner instructions
- `config.accounts`: Return specific account states
- Returns: Simulation result with logs, accounts, errors

---

## Key Concepts

**Commitment Levels:**
- `processed`: Latest block (may be rolled back)
- `confirmed`: Majority confirmed (likely final) 
- `finalized`: Supermajority confirmed (permanent)

**Encoding Options:**
- `base58`: Slow, max 129 bytes
- `base64`: Fast, any size
- `base64+zstd`: Compressed base64
- `jsonParsed`: Human-readable when possible

**Filters (for getProgramAccounts):**
- `{dataSize: number}`: Exact data size
- `{memcmp: {offset: number, bytes: string}}`: Memory comparison

**WebSocket Endpoint:** `ws://localhost:8900`
**HTTP Endpoint:** `http://localhost:8899`

**Rate Limits:** Varies by RPC provider
**Batch Requests:** Send array of requests in single HTTP call
