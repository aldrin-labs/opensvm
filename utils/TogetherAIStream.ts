import { createParser } from "eventsource-parser";

export type ChatGPTAgent = "user" | "system";

export interface ChatGPTMessage {
  role: ChatGPTAgent;
  content: string;
}

export interface TogetherAIStreamPayload {
  model: string;
  messages: ChatGPTMessage[];
  stream: boolean;
}

interface StreamChoice {
  delta: {
    content?: string;
  };
  index: number;
  finish_reason: string | null;
}

interface StreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StreamChoice[];
}

const STREAM_TIMEOUT = 30000; // 30 seconds timeout

export async function TogetherAIStream(payload: TogetherAIStreamPayload) {
  if (!process.env.TOGETHER_API_KEY) {
    throw new Error('TOGETHER_API_KEY environment variable is not set');
  }


  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT);

  try {
    const res = await fetch("https://api.together.xyz/v1/chat/completions", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
      },
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const readableStream = new ReadableStream({
      async start(controller) {
        if (!res.ok) {
          const errorData = {
            status: res.status,
            statusText: res.statusText,
            body: await res.text(),
          };
          console.error(
            `Stream Error: received ${res.status} status code`,
            JSON.stringify(errorData, null, 2)
          );
          controller.error(new Error(`HTTP ${res.status}: ${res.statusText}`));
          return;
        }

        if (!res.body) {
          controller.error(new Error('No response body received'));
          return;
        }

        const parser = createParser({
          onEvent(event: any) {
            if (event.type === 'event') {
              try {
                controller.enqueue(encoder.encode(event.data));
              } catch (e) {
                console.error('Error processing event:', e);
                controller.error(e);
              }
            }
          }
        });

        try {
          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.feed(decoder.decode(value));
          }
          controller.close();
        } catch (e) {
          console.error('Error reading stream:', e);
          controller.error(e);
        }
      },
    });

    let counter = 0;
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const data = decoder.decode(chunk);

        if (data === "[DONE]") {
          controller.terminate();
          return;
        }

        try {
          const json = JSON.parse(data) as StreamResponse;
          const text = json.choices[0]?.delta?.content || "";

          // Skip prefix newlines
          if (counter < 2 && (text.match(/\n/) || []).length) {
            return;
          }

          const payload = { text };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
          counter++;
        } catch (e) {
          console.error('Error transforming chunk:', e);
          if (e instanceof Error) {
            controller.error(new Error(`Transform error: ${e.message}`));
          } else {
            controller.error(new Error('Unknown transform error'));
          }
        }
      },
    });

    return readableStream.pipeThrough(transformStream);
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('Stream creation error:', e);
    throw e;
  }
}
