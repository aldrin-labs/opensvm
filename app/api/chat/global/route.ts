import { NextRequest, NextResponse } from 'next/server';
import { 
  storeGlobalChatMessage, 
  getGlobalChatMessages, 
  deleteGlobalChatMessage,
  GlobalChatMessage 
} from '@/lib/search/qdrant';
// Removed @solana/web3.js import to avoid server runtime bundling issues that caused 500s

// Fallback in-memory storage when Qdrant is not available
let fallbackMessages: GlobalChatMessage[] = [];

interface GlobalMessage {
  id: string;
  content: string;
  sender: string; // wallet address or "guest"
  timestamp: number;
  type: 'user' | 'system';
}

interface RateLimitEntry {
  lastMessage: number;
  messageCount: number;
}

// In-memory rate limiting (could be moved to Qdrant later if needed)
let rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old rate limit entries every hour
const RATE_LIMIT_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
let lastRateLimitCleanup = Date.now();

function cleanupRateLimits() {
  const now = Date.now();
  if (now - lastRateLimitCleanup < RATE_LIMIT_CLEANUP_INTERVAL) return;

  const maxAge = Math.max(GUEST_RATE_LIMIT, USER_RATE_LIMIT) * 2; // Keep entries for 2x the longest rate limit
  const cutoff = now - maxAge;

  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.lastMessage < cutoff) {
      rateLimitMap.delete(key);
    }
  }

  lastRateLimitCleanup = now;
}

const MAX_MESSAGES = 1000;
const GUEST_RATE_LIMIT = 5 * 60 * 1000; // 5 minutes
const USER_RATE_LIMIT = 30 * 1000; // 30 seconds

// Generate a consistent user color based on username/wallet
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

// Convert GlobalChatMessage to legacy GlobalMessage format for API compatibility
function convertToLegacyFormat(qdrantMessage: GlobalChatMessage): GlobalMessage {
  return {
    id: qdrantMessage.id,
    content: qdrantMessage.message,
    sender: qdrantMessage.walletAddress || qdrantMessage.username,
    timestamp: qdrantMessage.timestamp,
    type: 'user' as const
  };
}

// Convert legacy format to GlobalChatMessage for Qdrant storage
function convertToQdrantFormat(legacyMessage: {
  content: string;
  sender: string;
  timestamp: number;
  id: string;
}): GlobalChatMessage {
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

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

function isValidWalletAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  // Basic Base58 and length checks to avoid heavy @solana/web3.js dependency
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58Regex.test(address)) return false;
  // Solana pubkeys are 32 bytes; Base58 encoded length typically 32-44 chars
  return address.length >= 32 && address.length <= 44;
}

function enforceRateLimit(identifier: string, isUser: boolean): { allowed: boolean; timeLeft?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  const rateLimit = isUser ? USER_RATE_LIMIT : GUEST_RATE_LIMIT;

  if (!entry) {
    rateLimitMap.set(identifier, { lastMessage: now, messageCount: 1 });
    return { allowed: true };
  }

  const timeSinceLastMessage = now - entry.lastMessage;
  
  if (timeSinceLastMessage < rateLimit) {
    const timeLeft = rateLimit - timeSinceLastMessage;
    return { allowed: false, timeLeft };
  }

  // Update rate limit entry
  rateLimitMap.set(identifier, { lastMessage: now, messageCount: entry.messageCount + 1 });
  return { allowed: true };
}

export async function GET() {
  // Clean up old rate limit entries periodically
  cleanupRateLimits();

  try {
    // Try to fetch messages from Qdrant
    const result = await getGlobalChatMessages({
      limit: MAX_MESSAGES,
      offset: 0
    });
    
    // Test if Qdrant storage is working by attempting a small test
    // This ensures consistency with POST endpoint storage behavior
    try {
      const testMessage = {
        id: crypto.randomUUID(), // Use proper UUID for Qdrant compatibility
        username: 'test',
        message: 'test',
        timestamp: Date.now(),
        isGuest: true,
        userColor: '#FF6B6B'
      };
      
      // Try storing and immediately delete the test message
      await storeGlobalChatMessage(testMessage);
      await deleteGlobalChatMessage(testMessage.id);
      
      // If we get here, Qdrant is working properly
      const legacyMessages = result.messages.map(convertToLegacyFormat);
      
      return NextResponse.json({
        messages: legacyMessages,
        totalMessages: result.total,
        maxMessages: MAX_MESSAGES,
        storage: 'qdrant'
      });
    } catch (storageTestError: any) {
      // Qdrant storage is having issues (same as POST), use fallback
      console.warn('Qdrant storage test failed, using fallback storage for consistency:', storageTestError?.message || 'Unknown error');
      throw storageTestError; // Let the outer catch handle fallback
    }
  } catch (error: any) {
    console.warn('Qdrant not available, using fallback storage:', error?.message || 'Unknown error');
    
    // Fallback to in-memory storage
    const legacyMessages = fallbackMessages.map(convertToLegacyFormat);
    
    return NextResponse.json({
      messages: legacyMessages,
      totalMessages: fallbackMessages.length,
      maxMessages: MAX_MESSAGES,
      storage: 'fallback'
    });
  }
}

export async function POST(request: NextRequest) {
  // Clean up old rate limit entries periodically
  cleanupRateLimits();

  try {
    const body = await request.json();
    const { content, wallet } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    if (content.length > 1000) {
      return NextResponse.json({ error: 'Message too long (max 1000 characters)' }, { status: 400 });
    }

    // Determine sender and check rate limits
    const clientIP = getClientIdentifier(request);
    let sender = 'guest';
    let isUser = false;
    let rateLimitIdentifier = clientIP;

    if (wallet && typeof wallet === 'string' && isValidWalletAddress(wallet)) {
      sender = wallet;
      isUser = true;
      rateLimitIdentifier = wallet;
    }

    // Enforce rate limiting
    const rateLimitCheck = enforceRateLimit(rateLimitIdentifier, isUser);
    if (!rateLimitCheck.allowed) {
      const timeLeftMinutes = Math.ceil((rateLimitCheck.timeLeft || 0) / 60000);
      const timeLeftSeconds = Math.ceil(((rateLimitCheck.timeLeft || 0) % 60000) / 1000);
      
      return NextResponse.json({
        error: `Rate limit exceeded. Please wait ${timeLeftMinutes > 0 ? `${timeLeftMinutes}m ` : ''}${timeLeftSeconds}s before sending another message.`,
        timeLeft: rateLimitCheck.timeLeft
      }, { status: 429 });
    }

    // Create new message in legacy format first - use UUID for Qdrant compatibility
    const legacyMessage = {
      id: crypto.randomUUID(), // Use proper UUID for Qdrant compatibility
      content: content.trim(),
      sender,
      timestamp: Date.now()
    };

    // Convert to Qdrant format
    const qdrantMessage = convertToQdrantFormat(legacyMessage);

    let storageType = 'fallback';
    let totalMessages = 0;

    try {
      // Try to store in Qdrant first
      await storeGlobalChatMessage(qdrantMessage);
      
      // Get total count from Qdrant
      const { total } = await getGlobalChatMessages({ limit: 1 });
      totalMessages = total;
      storageType = 'qdrant';
      
      console.log(`[GlobalChat] Message stored in Qdrant from ${sender}: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`);
    } catch (qdrantError: any) {
      console.warn('Qdrant not available, using fallback storage:', qdrantError?.message || 'Unknown error');
      
      // Fallback to in-memory storage
      fallbackMessages.push(qdrantMessage);
      
      // Keep only the latest MAX_MESSAGES
      if (fallbackMessages.length > MAX_MESSAGES) {
        fallbackMessages = fallbackMessages.slice(-MAX_MESSAGES);
      }
      
      totalMessages = fallbackMessages.length;
      
      console.log(`[GlobalChat] Message stored in fallback from ${sender}: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`);
    }

    // Convert back to legacy format for response
    const responseMessage = convertToLegacyFormat(qdrantMessage);

    return NextResponse.json({
      success: true,
      message: responseMessage,
      totalMessages,
      storage: storageType
    });

  } catch (error) {
    console.error('Error posting global message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Clear fallback messages
    fallbackMessages = [];

    // Clear rate limiting
    rateLimitMap.clear();

    console.log('[GlobalChat] Cleared fallback messages and rate limits');

    // Note: Qdrant messages are not cleared as bulk deletion would require
    // fetching all IDs and deleting individually which is expensive.
    // This endpoint now clears the fallback storage and rate limits only.

    return NextResponse.json({
      success: true,
      message: 'Fallback messages and rate limits cleared. Note: Qdrant messages persist.',
      clearedFallback: true,
      clearedQdrant: false
    });
  } catch (error) {
    console.error('Error clearing messages:', error);
    return NextResponse.json({ error: 'Failed to clear messages' }, { status: 500 });
  }
}
