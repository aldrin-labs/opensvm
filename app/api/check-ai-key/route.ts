import { NextRequest, NextResponse } from 'next/server';

// Check if OpenRouter API key is available
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function POST(req: NextRequest) {
  // Check if API key is available
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'sk-or-v1-free-tier-demo-key') {
    return NextResponse.json(
      { available: false },
      { status: 200 }
    );
  }

  return NextResponse.json({ available: true });
}
