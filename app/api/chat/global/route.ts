import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';

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

// In-memory storage (in production, use Redis or database)
let globalMessages: GlobalMessage[] = [];
let rateLimitMap = new Map<string, RateLimitEntry>();

const MAX_MESSAGES = 1000;
const GUEST_RATE_LIMIT = 5 * 60 * 1000; // 5 minutes
const USER_RATE_LIMIT = 30 * 1000; // 30 seconds

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

function isValidWalletAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
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
  try {
    return NextResponse.json({
      messages: globalMessages,
      totalMessages: globalMessages.length,
      maxMessages: MAX_MESSAGES
    });
  } catch (error) {
    console.error('Error fetching global messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // Create new message
    const newMessage: GlobalMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      content: content.trim(),
      sender,
      timestamp: Date.now(),
      type: 'user'
    };

    // Add message and enforce limit
    globalMessages.push(newMessage);
    
    // Keep only the latest MAX_MESSAGES
    if (globalMessages.length > MAX_MESSAGES) {
      globalMessages = globalMessages.slice(-MAX_MESSAGES);
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
      totalMessages: globalMessages.length
    });

  } catch (error) {
    console.error('Error posting global message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Clear all messages (admin function)
    globalMessages = [];
    rateLimitMap.clear();
    
    return NextResponse.json({
      success: true,
      message: 'All messages cleared'
    });
  } catch (error) {
    console.error('Error clearing messages:', error);
    return NextResponse.json({ error: 'Failed to clear messages' }, { status: 500 });
  }
}
