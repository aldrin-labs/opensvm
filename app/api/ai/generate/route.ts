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

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Call OpenRouter API with streaming enabled
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': 'https://opensvm.com',
              'X-Title': 'OpenSVM Search'
            },
            body: JSON.stringify({
              model: 'anthropic/claude-3-sonnet:beta',
              messages: [
                {
                  role: 'system',
                  content: `You are an expert blockchain analyst assistant for OpenSVM, a blockchain explorer for Solana. 
                  You provide detailed, accurate, and insightful analysis of blockchain data.
                  
                  Focus on providing factual information about Solana blockchain, tokens, accounts, and transactions.
                  If you don't know something or don't have specific data, be honest about limitations.
                  Never make up information or pretend to have data that isn't available.
                  
                  Format your responses in clear paragraphs with occasional markdown formatting for readability.`
                },
                {
                  role: 'user',
                  content: `Analyze this query related to the Solana blockchain: "${query}"`
                }
              ],
              temperature: 0.7,
              max_tokens: 1000,
              stream: true
            })
          });

          if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.status}`);
          }

          // Process the streaming response
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Response body is not readable');
          }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Process the chunk
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0].delta.content;
                  
                  if (content) {
                    // Send the content chunk to the client
                    controller.enqueue(new TextEncoder().encode(content));
                  }
                } catch (e) {
                  console.error('Error parsing streaming response:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in streaming:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      }
    });

    // Return the stream as the response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      }
    });
  } catch (error) {
    console.error('Error generating AI response:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    );
  }
}
