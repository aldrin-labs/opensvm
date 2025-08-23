import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY environment variable is not set' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { messages } = body;

    // Validate messages parameter
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages parameter is required and must be an array' },
        { status: 400 }
      );
    }

    // Validate message count and structure
    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'At least one message is required' },
        { status: 400 }
      );
    }

    if (messages.length > 20) {
      return NextResponse.json(
        { error: 'Too many messages. Maximum 20 messages allowed' },
        { status: 400 }
      );
    }

    // Validate each message structure and content length
    for (const [index, msg] of messages.entries()) {
      if (!msg || typeof msg !== 'object') {
        return NextResponse.json(
          { error: `Message at index ${index} must be an object` },
          { status: 400 }
        );
      }

      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: `Message at index ${index} must have 'role' and 'content' properties` },
          { status: 400 }
        );
      }

      if (typeof msg.role !== 'string' || typeof msg.content !== 'string') {
        return NextResponse.json(
          { error: `Message at index ${index} role and content must be strings` },
          { status: 400 }
        );
      }

      if (msg.content.length > 4000) {
        return NextResponse.json(
          { error: `Message at index ${index} content too long. Maximum 4000 characters` },
          { status: 400 }
        );
      }

      if (!['user', 'assistant'].includes(msg.role)) {
        return NextResponse.json(
          { error: `Message at index ${index} has invalid role. Must be 'user' or 'assistant'` },
          { status: 400 }
        );
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: messages.map((msg: { role: string; content: string; }) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ response: data.content[0].text });
  } catch (error) {
    console.error('Error in chat API route:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
