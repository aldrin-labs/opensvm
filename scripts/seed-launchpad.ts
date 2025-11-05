/**
 * Seed data for testing the launchpad
 */

import {
  createSale,
  createReferrer,
  createContribution,
  createReferralLink,
} from '../lib/launchpad/database';
import { generateId, solToLamports } from '../lib/launchpad/utils';

async function seed() {
  console.log('Seeding launchpad data...');

  // Create a sample sale
  const sale = await createSale({
    id: generateId(),
    name: 'SVMAI Protocol Token Launch',
    token_symbol: 'SVMAI',
    token_mint: 'SvmAi1111111111111111111111111111111111111',
    total_supply: 1_000_000_000,
    target_raise_lamports: solToLamports(10000), // 10,000 SOL
    current_raise_lamports: solToLamports(2500), // 2,500 SOL raised
    status: 'active',
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    liquidity_percent: 50,
    dao_lock_percent: 25,
    vesting_percent: 25,
    kol_pool_percent: 5,
    volume_rewards_percent: 2,
    airdrop_percent: 1,
    vesting_duration_months: 3,
    vesting_cliff_days: 30,
    volume_rewards_days: 30,
    min_contribution_lamports: solToLamports(0.1),
    max_contribution_lamports: solToLamports(100),
    max_referrer_volume_percent: 20,
    platform_fee_percent: 0.0001,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  console.log('Created sale:', sale.id);

  // Create another upcoming sale
  const upcomingSale = await createSale({
    id: generateId(),
    name: 'DeFi Aggregator Token',
    token_symbol: 'DEFI',
    token_mint: 'DeFi1111111111111111111111111111111111111',
    total_supply: 500_000_000,
    target_raise_lamports: solToLamports(5000),
    current_raise_lamports: 0,
    status: 'upcoming',
    start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    end_date: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString(), // 37 days from now
    liquidity_percent: 50,
    dao_lock_percent: 25,
    vesting_percent: 25,
    kol_pool_percent: 5,
    volume_rewards_percent: 2,
    airdrop_percent: 1,
    vesting_duration_months: 6,
    vesting_cliff_days: 60,
    volume_rewards_days: 60,
    min_contribution_lamports: solToLamports(1),
    max_contribution_lamports: solToLamports(500),
    max_referrer_volume_percent: 20,
    platform_fee_percent: 0.0001,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  console.log('Created upcoming sale:', upcomingSale.id);

  // Create sample KOLs
  const kol1 = await createReferrer({
    id: generateId(),
    display_name: 'CryptoInfluencer',
    status: 'approved',
    payout_wallet: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    kyc_verified: true,
    email: 'crypto@example.com',
    socials: {
      twitter: 'cryptoinfluencer',
      telegram: 'cryptoinfluencer',
    },
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    approved_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    approved_by: 'admin',
  });
  console.log('Created KOL 1:', kol1.id);

  const kol2 = await createReferrer({
    id: generateId(),
    display_name: 'SolanaWhale',
    status: 'pending',
    payout_wallet: '8DWzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWW',
    kyc_verified: false,
    email: 'whale@example.com',
    socials: {
      twitter: 'solanawhale',
      discord: 'solanawhale#1234',
    },
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  console.log('Created KOL 2 (pending):', kol2.id);

  // Create referral link for approved KOL
  const refLink = await createReferralLink({
    id: generateId(),
    kol_id: kol1.id,
    sale_id: sale.id,
    code: 'CRYPTO123',
    url: `https://opensvm.com/launchpad/sale/${sale.id}?ref=CRYPTO123`,
    campaign_name: 'Launch Week',
    status: 'active',
    current_uses: 15,
    created_at: new Date().toISOString(),
  });
  console.log('Created referral link:', refLink.id);

  console.log('\nSeeding complete!');
  console.log(`\nActive Sale ID: ${sale.id}`);
  console.log(`Upcoming Sale ID: ${upcomingSale.id}`);
  console.log(`Approved KOL ID: ${kol1.id}`);
  console.log(`Pending KOL ID: ${kol2.id}`);
}

seed().catch(console.error);
