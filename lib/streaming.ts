import { ReadableStream } from 'stream/web';

export interface StreamOptions {
  chunkSize?: number;
  delimiter?: string;
  flushInterval?: number;
}

/**
 * Creates a streaming response for large datasets
 */
export function createStreamingResponse(
  dataGenerator: AsyncGenerator<any, void, unknown>,
  options: StreamOptions = {}
): Response {
  const { 
    delimiter = '\n',
    flushInterval = 100 
  } = options;

  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      // Start with array opening
      controller.enqueue(encoder.encode('['));
      let first = true;

      try {
        // Periodic flush to ensure data is sent
        intervalId = setInterval(() => {
          // Force a flush by enqueueing an empty chunk
          controller.enqueue(encoder.encode(''));
        }, flushInterval);

        for await (const chunk of dataGenerator) {
          if (!first) {
            controller.enqueue(encoder.encode(','));
          }
          first = false;
          
          const json = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(json));
          
          // Add delimiter for readability
          if (delimiter) {
            controller.enqueue(encoder.encode(delimiter));
          }
        }

        // Close the array
        controller.enqueue(encoder.encode(']'));
      } catch (error) {
        controller.error(error);
      } finally {
        if (intervalId) {
          clearInterval(intervalId);
        }
        controller.close();
      }
    },
    
    cancel() {
      if (intervalId) {
        clearInterval(intervalId);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Stream NDJSON (Newline Delimited JSON) format
 */
export function createNDJSONStream(
  dataGenerator: AsyncGenerator<any, void, unknown>
): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of dataGenerator) {
          const line = JSON.stringify(chunk) + '\n';
          controller.enqueue(encoder.encode(line));
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Batch data into chunks for streaming
 */
export async function* batchGenerator<T>(
  items: T[],
  batchSize: number = 100
): AsyncGenerator<T[], void, unknown> {
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize);
    // Small delay to prevent overwhelming the client
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * Stream data with progress updates
 */
export function createProgressStream(
  dataGenerator: AsyncGenerator<any, void, unknown>,
  totalItems: number
): Response {
  const encoder = new TextEncoder();
  let processed = 0;
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('{"data":['));
        let first = true;

        for await (const chunk of dataGenerator) {
          if (!first) {
            controller.enqueue(encoder.encode(','));
          }
          first = false;
          
          controller.enqueue(encoder.encode(JSON.stringify(chunk)));
          
          processed++;
          
          // Send progress update every 10 items
          if (processed % 10 === 0 || processed === totalItems) {
            const progress = {
              type: 'progress',
              processed,
              total: totalItems,
              percentage: Math.round((processed / totalItems) * 100)
            };
            
            controller.enqueue(encoder.encode(
              `],"progress":${JSON.stringify(progress)},"data":[`
            ));
          }
        }

        controller.enqueue(encoder.encode(']}'));
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Helper to convert array to async generator
 */
export async function* arrayToAsyncGenerator<T>(
  array: T[]
): AsyncGenerator<T, void, unknown> {
  for (const item of array) {
    yield item;
    // Small delay to simulate async processing
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}
