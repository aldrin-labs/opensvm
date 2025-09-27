#!/usr/bin/env npx tsx

/**
 * Migration script to transfer chat messages from file-based storage to Qdrant
 */

import { readFile, existsSync } from 'fs';
import { promisify } from 'util';
import path from 'path';
import { 
  storeGlobalChatMessage, 
  batchStoreGlobalChatMessages,
  getGlobalChatMessages,
  GlobalChatMessage,
  checkQdrantHealth 
} from '../lib/qdrant';

const readFileAsync = promisify(readFile);

// Define interfaces for legacy message format
interface LegacyGlobalMessage {
  id: string;
  content: string;
  sender: string; // wallet address or "guest"
  timestamp: number;
  type: 'user' | 'system';
}

// Legacy file paths
const STORAGE_DIR = path.join(process.cwd(), '.chat-data');
const MESSAGES_FILE = path.join(STORAGE_DIR, 'global-messages.json');

/**
 * Generate a consistent user color based on username/wallet
 */
function generateUserColor(identifier: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F06292', '#AED581', '#FFB74D',
    '#64B5F6', '#81C784', '#FFD54F', '#FF8A65', '#BA68C8'
  ];
  
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Validate if address is a Solana wallet
 */
function isValidWalletAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(address)) return false;
  return address.length >= 32 && address.length <= 44;
}

/**
 * Convert legacy format to GlobalChatMessage for Qdrant storage
 */
function convertToQdrantFormat(legacyMessage: LegacyGlobalMessage): GlobalChatMessage {
  const isWallet = isValidWalletAddress(legacyMessage.sender);
  
  return {
    id: legacyMessage.id,
    username: isWallet ? `${legacyMessage.sender.slice(0, 4)}...${legacyMessage.sender.slice(-4)}` : legacyMessage.sender,
    walletAddress: isWallet ? legacyMessage.sender : undefined,
    message: legacyMessage.content,
    timestamp: legacyMessage.timestamp,
    isGuest: !isWallet,
    userColor: generateUserColor(legacyMessage.sender)
  };
}

/**
 * Load existing messages from file storage
 */
async function loadLegacyMessages(): Promise<LegacyGlobalMessage[]> {
  if (!existsSync(MESSAGES_FILE)) {
    console.log('📁 No legacy messages file found at:', MESSAGES_FILE);
    return [];
  }

  try {
    const data = await readFileAsync(MESSAGES_FILE, 'utf8');
    const messages = JSON.parse(data);
    
    if (!Array.isArray(messages)) {
      console.error('❌ Invalid message format in legacy file');
      return [];
    }

    console.log(`📄 Found ${messages.length} messages in legacy storage`);
    return messages;
  } catch (error) {
    console.error('❌ Error reading legacy messages:', error);
    return [];
  }
}

/**
 * Check if messages already exist in Qdrant
 */
async function checkExistingMessages(): Promise<number> {
  try {
    const result = await getGlobalChatMessages({ limit: 1 });
    return result.total;
  } catch (error) {
    console.warn('⚠️  Could not check existing Qdrant messages:', error);
    return 0;
  }
}

/**
 * Migrate messages from legacy storage to Qdrant
 */
async function migrateMessages(legacyMessages: LegacyGlobalMessage[]): Promise<boolean> {
  if (legacyMessages.length === 0) {
    console.log('✅ No messages to migrate');
    return true;
  }

  try {
    // Convert all messages to Qdrant format
    const qdrantMessages = legacyMessages.map(convertToQdrantFormat);
    
    console.log(`🔄 Converting ${legacyMessages.length} messages to Qdrant format...`);
    
    // Use batch storage for efficiency
    await batchStoreGlobalChatMessages(qdrantMessages);
    
    console.log(`✅ Successfully migrated ${legacyMessages.length} messages to Qdrant`);
    return true;
  } catch (error) {
    console.error('❌ Error migrating messages to Qdrant:', error);
    return false;
  }
}

/**
 * Verify migration success
 */
async function verifyMigration(expectedCount: number): Promise<boolean> {
  try {
    const result = await getGlobalChatMessages({ limit: 1 });
    const actualCount = result.total;
    
    console.log(`📊 Migration verification: Expected ${expectedCount}, Found ${actualCount}`);
    
    if (actualCount >= expectedCount) {
      console.log('✅ Migration verification successful');
      return true;
    } else {
      console.error('❌ Migration verification failed: count mismatch');
      return false;
    }
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting chat migration to Qdrant...\n');

  // Check Qdrant health
  console.log('🔍 Checking Qdrant connection...');
  const isQdrantHealthy = await checkQdrantHealth();
  
  if (!isQdrantHealthy) {
    console.error('❌ Qdrant is not available. Please ensure Qdrant is running on http://localhost:6333');
    console.log('\n💡 To start Qdrant with Docker:');
    console.log('   docker run -d -p 6333:6333 qdrant/qdrant');
    process.exit(1);
  }
  
  console.log('✅ Qdrant connection successful\n');

  // Check existing messages in Qdrant
  const existingCount = await checkExistingMessages();
  if (existingCount > 0) {
    console.log(`⚠️  Found ${existingCount} existing messages in Qdrant`);
    console.log('This migration will add to existing messages (no duplicates will be created)\n');
  }

  // Load legacy messages
  console.log('📂 Loading legacy messages...');
  const legacyMessages = await loadLegacyMessages();
  
  if (legacyMessages.length === 0) {
    console.log('✅ No legacy messages found to migrate');
    console.log('\n📋 Migration Summary:');
    console.log(`   • Legacy messages: 0`);
    console.log(`   • Qdrant messages: ${existingCount}`);
    console.log(`   • Status: Nothing to migrate`);
    return;
  }

  // Perform migration
  console.log(`\n🔄 Migrating ${legacyMessages.length} messages...`);
  const migrationSuccess = await migrateMessages(legacyMessages);
  
  if (!migrationSuccess) {
    console.error('❌ Migration failed');
    process.exit(1);
  }

  // Verify migration
  console.log('\n🔍 Verifying migration...');
  const verificationSuccess = await verifyMigration(existingCount + legacyMessages.length);
  
  if (!verificationSuccess) {
    console.error('❌ Migration verification failed');
    process.exit(1);
  }

  // Final summary
  console.log('\n✅ Migration completed successfully!');
  console.log('\n📋 Migration Summary:');
  console.log(`   • Legacy messages migrated: ${legacyMessages.length}`);
  console.log(`   • Total messages in Qdrant: ${existingCount + legacyMessages.length}`);
  console.log(`   • Status: Complete`);
  
  console.log('\n💡 Next steps:');
  console.log('   • The global chat now uses Qdrant for persistent storage');
  console.log('   • Messages have vector embeddings for semantic search');
  console.log('   • Legacy file storage can be safely removed if desired');
}

// Run migration
if (require.main === module) {
  main().catch((error) => {
    console.error('\n💥 Fatal error during migration:', error);
    process.exit(1);
  });
}

export { main as runChatMigration };
