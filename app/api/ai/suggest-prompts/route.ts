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
    const { query, currentResponse } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Call OpenRouter API to generate follow-up prompts
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://opensvm.com',
        'X-Title': 'OpenSVM Search'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku:beta', // Using a lighter model for prompt generation
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that generates relevant follow-up questions based on a user's query and the response they received.
            
Your task is to generate 5 concise, relevant follow-up questions that would help the user explore the topic further.

Guidelines:
1. Questions should be directly related to the original query and response
2. Questions should be diverse, covering different aspects of the topic
3. Questions should be concise (max 10 words each)
4. Questions should be phrased naturally as a user would ask them
5. Questions should not repeat information already covered in the response
6. Questions should focus on blockchain, cryptocurrency, and Solana-related topics`
          },
          {
            role: 'user',
            content: `Original query: "${query}"
            
Response they received:
${currentResponse || "No response available yet"}

Generate 5 concise follow-up questions that would be relevant and helpful.`
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse the generated content to extract the questions
    // The model should return a list of questions, we'll extract them
    const promptsArray = content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '').replace(/^["']|["']$/g, ''))
      .slice(0, 5); // Ensure we only get 5 prompts

    return NextResponse.json({ prompts: promptsArray });
  } catch (error) {
    console.error('Error generating prompt suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate prompt suggestions' },
      { status: 500 }
    );
  }
}
