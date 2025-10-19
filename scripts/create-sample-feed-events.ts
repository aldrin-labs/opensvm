/**
 * Script to create sample feed events for testing
 * Run with: npx tsx scripts/create-sample-feed-events.ts
 */

import {
  createFollowEvent,
  createLikeEvent,
  createTransactionEvent,
  createProfileUpdateEvent
} from '../lib/feed-events';

async function createSampleEvents() {
  console.log('Creating sample feed events...');

  try {
    // Create some follow events
    await createFollowEvent(
      '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
      '11111111111111111111111111111111',
      'Alice'
    );
    console.log('✓ Created follow event 1');

    await createFollowEvent(
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      '11111111111111111111111111111111',
      'Bob'
    );
    console.log('✓ Created follow event 2');

    // Create some like events
    await createLikeEvent(
      'SysvarRent111111111111111111111111111111111',
      '11111111111111111111111111111111',
      'Charlie'
    );
    console.log('✓ Created like event 1');

    // Create a transaction event
    await createTransactionEvent(
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'transfer',
      100.5,
      'SOL',
      'test-transaction-id-123',
      'Dave'
    );
    console.log('✓ Created transaction event');

    // Create a profile update event
    await createProfileUpdateEvent(
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      'avatar',
      'Eve'
    );
    console.log('✓ Created profile update event');

    console.log('\n✅ Successfully created 5 sample feed events!');
    console.log('These events should now appear in the feed on profile pages.');
  } catch (error) {
    console.error('❌ Error creating sample events:', error);
    process.exit(1);
  }
}

createSampleEvents()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
