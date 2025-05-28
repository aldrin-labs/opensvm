import { NextRequest, NextResponse } from 'next/server';

// Check if OpenRouter API key is available
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function POST(req: NextRequest) {
  // Check if API key is available
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'sk-or-v1-free-tier-demo-key') {
    return NextResponse.json(
      { error: 'AI functionality is disabled. No API key available.' },
      { status: 403 }
    );
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Call OpenRouter API to generate sources
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://opensvm.com',
        'X-Title': 'OpenSVM Search'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku:beta', // Using a lighter model for sources generation
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that generates relevant sources for blockchain and cryptocurrency queries.
            
Your task is to generate 3-5 relevant sources that would be helpful for the user's query.

Each source should have:
1. A title
2. A URL

Focus on reputable blockchain resources like:
- Official documentation (Solana docs, etc.)
- Block explorers (Solscan, Solana Explorer)
- Reputable crypto news sites
- DEX platforms for tokens (Jupiter, Raydium)
- NFT marketplaces for NFTs (Magic Eden)

Return the sources in a simple list format.`
          },
          {
            role: 'user',
            content: `Generate 3-5 relevant sources for this query: "${query}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the generated content to extract the sources
    const sourcesRegex = /(?:^|\n)(?:\d+\.\s*)?([^:\n]+):\s*(https?:\/\/[^\s]+)/gm;
    const matches = [...content.matchAll(sourcesRegex)];
    
    const sources = matches.map(match => ({
      title: match[1].trim(),
      url: match[2].trim()
    }));

    // If no sources were extracted, provide default ones
    if (sources.length === 0) {
      return NextResponse.json({
        sources: [
          { title: 'Solana Documentation', url: 'https://docs.solana.com' },
          { title: 'Solana Explorer', url: 'https://explorer.solana.com' },
          { title: 'Solscan', url: 'https://solscan.io' }
        ]
      });
    }

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Error generating sources:', error);
    return NextResponse.json(
      { error: 'Failed to generate sources' },
      { status: 500 }
    );
  }
}
