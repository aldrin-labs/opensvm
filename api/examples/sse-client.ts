#!/usr/bin/env bun
/**
 * SSE Client Example for OpenSVM MCP Streaming Server
 *
 * This example shows how to:
 * 1. Start a streaming investigation
 * 2. Receive real-time events via Server-Sent Events
 * 3. Handle different event types (progress, findings, complete)
 *
 * Run: bun run examples/sse-client.ts [wallet_address]
 */

const API_URL = process.env.MCP_API_URL || 'http://localhost:3001';

interface StreamEvent {
  type: string;
  data: any;
  id?: string;
}

/**
 * Start a streaming investigation and process events
 */
async function streamInvestigation(target: string, type: string = 'wallet_forensics'): Promise<void> {
  console.log(`\n[SSE] Starting streaming investigation for ${target}`);
  console.log(`[SSE] Type: ${type}`);
  console.log('[SSE] Connecting...\n');

  const response = await fetch(`${API_URL}/investigate/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({
      target,
      type,
      config: {
        maxDepth: 3,
        maxTransactions: 50,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent: Partial<StreamEvent> = {};

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent.type = line.slice(7);
      } else if (line.startsWith('data: ')) {
        try {
          currentEvent.data = JSON.parse(line.slice(6));
        } catch {
          currentEvent.data = line.slice(6);
        }
      } else if (line.startsWith('id: ')) {
        currentEvent.id = line.slice(4);
      } else if (line === '' && currentEvent.type) {
        handleEvent(currentEvent as StreamEvent);
        currentEvent = {};
      } else if (line.startsWith(': ')) {
        // Comment (keepalive ping)
        process.stdout.write('.');
      }
    }
  }

  console.log('\n[SSE] Stream ended');
}

/**
 * Handle incoming SSE event
 */
function handleEvent(event: StreamEvent): void {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);

  switch (event.type) {
    case 'connected':
      console.log(`[${timestamp}] Connected - Investigation ID: ${event.data.investigationId}`);
      break;

    case 'start':
      console.log(`[${timestamp}] Investigation started`);
      console.log(`  Target: ${event.data.target}`);
      console.log(`  Type: ${event.data.type}`);
      break;

    case 'progress':
      console.log(`[${timestamp}] Progress: ${event.data.message || event.data.step}`);
      break;

    case 'tool_call':
      console.log(`[${timestamp}] Calling tool: ${event.data.tool}`);
      if (event.data.args) {
        console.log(`  Args: ${JSON.stringify(event.data.args).slice(0, 100)}`);
      }
      break;

    case 'tool_result':
      console.log(`[${timestamp}] Tool result received`);
      if (event.data.summary) {
        console.log(`  Summary: ${event.data.summary}`);
      }
      break;

    case 'anomaly':
      console.log(`[${timestamp}] [ANOMALY] ${event.data.type || 'Detected'}`);
      console.log(`  Severity: ${event.data.severity || 'unknown'}`);
      console.log(`  Description: ${event.data.description || JSON.stringify(event.data).slice(0, 100)}`);
      break;

    case 'finding':
      console.log(`[${timestamp}] [FINDING] ${event.data.title || 'New finding'}`);
      if (event.data.details) {
        console.log(`  Details: ${event.data.details}`);
      }
      break;

    case 'report':
      console.log(`[${timestamp}] Report generated`);
      console.log(`  Risk Level: ${event.data.riskLevel || 'N/A'}`);
      console.log(`  Anomalies: ${event.data.anomalyCount || 0}`);
      break;

    case 'complete':
      console.log(`\n[${timestamp}] Investigation complete!`);
      if (event.data.result) {
        console.log('\n--- Final Report ---');
        console.log(JSON.stringify(event.data.result, null, 2).slice(0, 2000));
        if (JSON.stringify(event.data.result).length > 2000) {
          console.log('... (truncated)');
        }
      }
      break;

    case 'error':
      console.error(`[${timestamp}] [ERROR] ${event.data.error || JSON.stringify(event.data)}`);
      break;

    default:
      console.log(`[${timestamp}] [${event.type}] ${JSON.stringify(event.data).slice(0, 200)}`);
  }
}

/**
 * Subscribe to an existing investigation stream
 */
async function subscribeToInvestigation(investigationId: string): Promise<void> {
  console.log(`\n[SSE] Subscribing to investigation: ${investigationId}`);

  const response = await fetch(`${API_URL}/stream/${investigationId}`, {
    headers: {
      'Accept': 'text/event-stream',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent: Partial<StreamEvent> = {};

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent.type = line.slice(7);
      } else if (line.startsWith('data: ')) {
        try {
          currentEvent.data = JSON.parse(line.slice(6));
        } catch {
          currentEvent.data = line.slice(6);
        }
      } else if (line.startsWith('id: ')) {
        currentEvent.id = line.slice(4);
      } else if (line === '' && currentEvent.type) {
        handleEvent(currentEvent as StreamEvent);
        currentEvent = {};
      }
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage:');
    console.log('  bun run examples/sse-client.ts <wallet_address>     # Start new investigation');
    console.log('  bun run examples/sse-client.ts --subscribe <id>     # Subscribe to existing');
    console.log('\nExample:');
    console.log('  bun run examples/sse-client.ts EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    process.exit(1);
  }

  try {
    if (args[0] === '--subscribe' && args[1]) {
      await subscribeToInvestigation(args[1]);
    } else {
      await streamInvestigation(args[0], args[1] || 'wallet_forensics');
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
