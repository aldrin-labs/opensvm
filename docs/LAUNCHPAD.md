# Off-Chain SOL ICO Launchpad

A robust, off-chain launchpad for Solana token launches with dynamic vesting, KOL rewards, anti-fraud controls, and full admin governance.

## Features

### For Contributors
- **Easy Contribution Flow**: Submit contributions with wallet address and optional referral code
- **Cryptographic Receipts**: Every contribution receives a signed receipt for verification
- **Multiple Deposit Methods**: Wallet transfer or in-app send
- **Progress Tracking**: Real-time updates on sale progress and status
- **Transparent Vesting**: Clear vesting schedules displayed upfront

### For KOLs (Key Opinion Leaders)
- **Application System**: Apply to become a KOL with profile and social links
- **Referral Links**: Generate custom referral links for campaigns
- **Dual Reward System**:
  - Contribution-based rewards from referred users
  - Volume-based rewards from trading activity
- **Dashboard**: Track attribution, volume, and claimable tokens
- **Vesting Transparency**: See your vesting schedule and claim history

### For Administrators
- **KOL Management**: Review, approve, or reject KOL applications
- **Sales Management**: Create and configure token sales
- **Fraud Detection**: Built-in heuristics flag suspicious activity
- **Audit Logs**: All admin actions logged for transparency
- **Settlement Preview**: Review token distribution before finalization

## Architecture

### Tech Stack
- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: In-memory with JSON persistence (MVP), PostgreSQL-ready
- **Cryptography**: TweetNaCl (Ed25519 signatures)
- **Validation**: Zod schemas

### Directory Structure
```
/app/launchpad/
├── page.tsx                    # Sales listing
├── sale/[saleId]/page.tsx     # Sale details
├── kol/
│   └── apply/page.tsx         # KOL application
└── admin/page.tsx             # Admin dashboard

/app/api/launchpad/
├── sales/                     # Sale endpoints
├── kol/                       # KOL endpoints
└── admin/                     # Admin endpoints

/components/launchpad/
├── ContributeModal.tsx        # Contribution form
└── ReceiptCard.tsx           # Contribution receipt

/lib/launchpad/
├── database.ts               # Data operations
└── utils.ts                  # Utilities & calculations

/types/
└── launchpad.ts              # TypeScript definitions
```

## Data Models

### Sale
- Token information (symbol, supply, mint address)
- Fundraising targets and current status
- Distribution percentages (liquidity, DAO, vesting, rewards)
- Vesting configuration (duration, cliff)
- Contribution limits

### Contribution
- Contributor wallet address
- Amount in lamports
- Referral information
- Cryptographic signature
- Status tracking
- Fraud detection flags

### Referrer (KOL)
- Profile information
- Social media links
- Payout wallet
- KYC status
- Approval status

### Referral Link
- Unique code
- Campaign information
- Expiration and usage limits
- Performance metrics

## Security Features

### Cryptographic Signing
All contribution receipts are signed with Ed25519:
```typescript
const signature = sign(receiptData, platformSecretKey);
receipt.platform_signature = base58.encode(signature);
```

Users can verify receipts locally:
```typescript
const isValid = verify(receiptData, signature, platformPublicKey);
```

### Fraud Detection
- **Device Fingerprinting**: SHA-256 hash of IP + User-Agent
- **Rate Limiting**: Max contributions per IP/device per time period
- **Self-Referral Prevention**: Block same wallet as contributor and referrer
- **Minimum Thresholds**: Enforce minimum contribution amounts
- **Volume Verification**: Only count trades with non-zero slippage

### Anti-Sybil Measures
- Device/IP tracking
- Contribution patterns analysis
- KYC gating for high-value flows
- Manual review for flagged contributions

## Reward Mathematics

### KOL Contribution Rewards
```
kol_pool_tokens = floor(kol_pool_percent * total_supply)
kol_share = floor(kol_pool_tokens * kol_contributions / total_contributions)
```

### Volume Rewards
```
daily_pool_tokens = floor((volume_rewards_percent * total_supply) / volume_days)
kol_day_share = floor(daily_pool_tokens * kol_volume / total_volume)
```

### Rounding
All rounding remainders are routed to a Treasury account and documented in the settlement report.

### Vesting
Linear vesting with optional cliff:
```
periods = duration_months * 4  // Weekly periods
amount_per_period = floor(total_amount / periods)
```

## API Endpoints

### Public Endpoints
- `GET /api/launchpad/sales` - List all sales
- `POST /api/launchpad/sales` - Create sale (admin)
- `GET /api/launchpad/sales/:id` - Get sale details
- `POST /api/launchpad/sales/:id/contribute` - Submit contribution
- `POST /api/launchpad/sales/:id/referral-links` - Create referral link
- `GET /api/launchpad/kol/:id` - Get KOL dashboard
- `POST /api/launchpad/kol/apply` - Apply as KOL

### Admin Endpoints
- `GET /api/launchpad/admin/referrers` - List KOL applications
- `POST /api/launchpad/admin/referrers/:id/approve` - Approve KOL
- `POST /api/launchpad/admin/referrers/:id/reject` - Reject KOL

## Setup & Usage

### Installation
```bash
npm install
```

### Seed Test Data
```bash
npx tsx scripts/seed-launchpad.ts
```

This creates:
- 2 sample sales (1 active, 1 upcoming)
- 2 KOLs (1 approved, 1 pending)
- Sample referral links

### Development
```bash
npm run dev
```

Visit:
- http://localhost:3000/launchpad - Sales listing
- http://localhost:3000/launchpad/kol/apply - KOL application
- http://localhost:3000/launchpad/admin - Admin dashboard

### Production Database

To migrate to PostgreSQL:

1. Create schema based on `types/launchpad.ts`
2. Update `lib/launchpad/database.ts` to use Prisma/Drizzle
3. Replace in-memory operations with SQL queries
4. Set `DATABASE_URL` in environment

## Configuration

All sales are configured with:
- Platform fee: 0.01% (configurable)
- Default distribution:
  - 50% liquidity
  - 25% DAO lock
  - 25% vesting (3 months)
  - 5% KOL rewards
  - 2% volume rewards
  - 1% SVMAI holder airdrop

## Testing

### Manual Testing
1. Seed data: `npx tsx scripts/seed-launchpad.ts`
2. Browse to `/launchpad`
3. Click on active sale
4. Click "Contribute Now"
5. Fill form and submit
6. View receipt with signature

### Verification Flow
1. Copy receipt JSON
2. Click "Verify Locally"
3. See signature validation result

## Future Enhancements

### Planned Features
- [ ] Daily volume report endpoints
- [ ] Volume reward distribution
- [ ] Dispute resolution interface
- [ ] Settlement finalization UI
- [ ] Email notifications
- [ ] WebSocket real-time updates
- [ ] Advanced analytics dashboard
- [ ] Export CSV reports
- [ ] KYC integration
- [ ] Multi-signature approvals

### Production Considerations
- [ ] Migrate to PostgreSQL
- [ ] Add Redis for caching
- [ ] Implement job queue for background tasks
- [ ] Add monitoring (Sentry, DataDog)
- [ ] Set up CI/CD pipeline
- [ ] Load testing
- [ ] Security audit
- [ ] Smart contract integration (optional)

## Audit & Compliance

### Auditability
- All contributions signed cryptographically
- Complete audit log for admin actions
- Settlement reports published as CSV/JSON
- KOLs can download all attribution proofs
- Public metrics available (opt-in)

### Transparency
- Vesting schedules visible upfront
- Token distribution percentages clear
- Rounding remainders documented
- All reward calculations deterministic

## Support

For issues or questions:
1. Check existing documentation
2. Review API contracts
3. Check audit logs for discrepancies
4. Contact support with receipt ID

## License

See main project LICENSE file.

---

**Built with discipline in security, transparency, and user experience.**
