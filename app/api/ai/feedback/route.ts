import { NextRequest, NextResponse } from 'next/server';

// Check if OpenRouter API key is available
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function POST(req: NextRequest) {
  // Check if API key is available
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'sk-or-v1-free-tier-demo-key') {
    return NextResponse.json(
      { message: 'Feedback received, but AI functionality is disabled.' },
      { status: 200 }
    );
  }

  try {
    const { query, feedback, response } = await req.json();

    if (!query || !feedback) {
      return NextResponse.json(
        { error: 'Query and feedback are required' },
        { status: 400 }
      );
    }

    // In a real implementation, you would store this feedback in a database
    console.log(`Feedback received: ${feedback} for query "${query}"`);
    
    // For now, we'll just acknowledge receipt
    return NextResponse.json({ 
      message: 'Feedback received',
      status: 'success'
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
}
