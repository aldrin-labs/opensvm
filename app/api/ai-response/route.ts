import { NextRequest, NextResponse } from 'next/server';
import Together from 'together-ai';
import { createParser } from 'eventsource-parser';

export const runtime = 'edge';

// Function to extract potential sources from AI response
function extractSourcesFromText(text: string): { title: string, url: string }[] {
  const sources: { title: string, url: string }[] = [];

  // Default sources if none are extracted
  const defaultSources = [
    { title: 'Solana Documentation', url: 'https://docs.solana.com' },
    { title: 'Solana Explorer', url: 'https://explorer.solana.com' },
    { title: 'OpenSVM GitHub', url: 'https://github.com/aldrin-labs/opensvm' }
  ];

  // Try to extract URLs from the text
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);

  if (matches && matches.length > 0) {
    // For each URL found, create a source entry
    matches.forEach(url => {
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        const title = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);

        sources.push({
          title: `${title}`,
          url: url
        });
      } catch (e) {
        console.error('Error parsing URL:', e);
      }
    });

    return sources.length > 0 ? sources : defaultSources;
  }

  return defaultSources;
}

export async function POST(req: NextRequest) {
  let query: string | undefined;
  try {
    try {
      const body = await req.json();
      query = body.query;
    } catch {
      query = undefined;
    }

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.TOGETHER_API_KEY;

    if (!apiKey) {
      // Return a fallback response when API key is missing
      return NextResponse.json({
        text: `This is a fallback response for "${query}". The Together AI integration requires an API key to be set in the environment variables.`,
        sources: [
          { title: 'Solana Documentation', url: 'https://docs.solana.com' },
          { title: 'Solana Explorer', url: 'https://explorer.solana.com' },
          { title: 'OpenSVM GitHub', url: 'https://github.com/aldrin-labs/opensvm' }
        ]
      });
    }

    // Initialize Together AI client with API key
    const together = new Together({
      apiKey: apiKey || "",
    });

    // Define the model to use
    const MODEL = 'moonshotai/Kimi-K2-Instruct-0905';

    // Create a system prompt for blockchain and Solana-specific information
    const systemPrompt = `You are an AI assistant specialized in blockchain technology, particularly Solana. 
    Provide concise, accurate information about blockchain concepts, Solana programs, tokens, and transactions.
    When responding to queries, focus on technical accuracy and include relevant sources when possible.
    Format your response in clear paragraphs with bullet points for key information.
    At the end of your response, include a "Sources:" section with 2-3 relevant sources for the information provided.`;

    // Create a prompt that includes context about the search
    const prompt = `The user is searching for information related to: "${query ? query : ""}" on a Solana blockchain explorer.
    Provide relevant information about this query in the context of Solana blockchain.
    If it appears to be an address, token, or transaction, explain what it might be.
    If it's a general concept, explain how it relates to Solana.
    Include specific URLs or source names in your response that I can extract as citations.`;

    // Set up streaming response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Store the complete response to extract sources at the end
    let completeResponse = '';

    try {
      const stream = new ReadableStream({
        async start(controller) {
          // Function to handle streaming events
          function onParse(event: { type: string; data?: string }) {
            if (event.type === 'event') {
              const data = event.data;

              // Handle different event types
              try {
                if (!data) return;
                const json = JSON.parse(data);

                if (json.choices?.[0]?.delta?.content) {
                  const text = json.choices[0].delta.content;
                  completeResponse += text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                } else if (json.choices?.[0]?.finish_reason === 'stop') {
                  // Extract sources from the complete response
                  const sources = extractSourcesFromText(completeResponse);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`));
                  controller.close();
                }
              } catch (e) {
                console.error('Error parsing streaming response:', e);
                controller.error(e);
              }
            }
          }

          // Create parser for SSE
          const parser = createParser({ onParse } as any);

          // Call Together AI API with streaming
          try {
            const response = await together.chat.completions.create({
              model: MODEL as string,
              messages: [
                { role: 'system' as const, content: systemPrompt as string },
                { role: 'user' as const, content: prompt as string }
              ],
              temperature: 0.7,
              max_tokens: 800,
              stream: true,
            } as any);

            // Process the streaming response
            // @ts-ignore: body may exist on the response
            if (response.body) {
              // @ts-ignore: body may exist on the response
              const reader = response.body.getReader();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Parse chunks as they arrive
                parser.feed(decoder.decode(value));
              }
            }
          } catch (error) {
            console.error('Error calling Together AI API:', error);

            // Send error message to client
            const errorMessage = "Sorry, there was an error connecting to the AI service. Please try again later.";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: errorMessage })}\n\n`));

            // Add default sources
            const defaultSources = [
              { title: 'Solana Documentation', url: 'https://docs.solana.com' },
              { title: 'Solana Explorer', url: 'https://opensvm.com' }
            ];
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources: defaultSources })}\n\n`));
            controller.close();
          }
        }
      });

      // Return streaming response
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'X-Accel-Buffering': 'no',
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': '59',
          'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString(),
        },
      });
    } catch (streamError) {
      console.error('Error creating stream:', streamError);
      // Fallback to non-streaming response
      return NextResponse.json({
        text: `Failed to create streaming response for "${typeof query !== "undefined" ? query : ""}". Please try again later.`,
        error: streamError instanceof Error ? streamError.message : String(streamError),
        sources: extractSourcesFromText('')
      });
    }
  } catch (error) {
    console.error('Error in AI response API:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate AI response',
        message: error instanceof Error ? error.message : String(error),
        text: `There was an error processing your query "${typeof query !== "undefined" ? query : ""}". Please try again later.`,
        sources: [
          { title: 'Solana Documentation', url: 'https://docs.solana.com' },
          { title: 'Solana Explorer', url: 'https://explorer.solana.com' }
        ]
      },
      { status: 500 }
    );
  }
}
