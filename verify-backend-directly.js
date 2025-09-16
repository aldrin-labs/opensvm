const http = require('http');

function iso() { return new Date().toISOString(); }

const scenarios = [
  {
    id: 'NET-TPS',
    query: 'What is the current TPS on Solana?',
    expectText: ['tps', 'transactions per second', 'network', 'load'],
  },
  {
    id: 'ACC-ANALYZE',
    query: 'Analyze this account: worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth',
    expectText: ['account', 'balance', 'owner', 'details'],
  },
  {
    id: 'TX-EXPLAIN',
    query: 'Explain this transaction: 2n12c2t5xK6jV2y5Y1Z9H8zV5B4p6N7c3a8Q1r9D6sVbKjHxYfWzR2yP5A3s4e6G8uK9mBwF7gH2jL',
    expectText: ['transaction', 'signature', 'status', 'slot', 'fee'],
  }
];

function postRequest(body) {
  const bodyString = JSON.stringify(body);
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/ai-response',
    method: 'POST',
    timeout: 30000, // 30-second timeout
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyString),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let combinedText = '';
      let fullBody = '';

      res.on('data', (chunk) => {
        fullBody += chunk.toString();
        // Process server-sent events
        const lines = fullBody.split('\n\n');
        fullBody = lines.pop() || ''; // Keep the last, possibly incomplete, line for the next chunk

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.substring(6));
              if (jsonData.text) {
                combinedText += jsonData.text;
              }
              // We can also check for a final "sources" message if the stream sends one
            } catch (e) {
              console.log(e);
              // Ignore parsing errors for now
            }
          }
        }
      });

      res.on('end', () => {
        // When the stream ends, resolve with the accumulated text
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          // Return a JSON structure that emulates the final, non-streamed response
          body: JSON.stringify({ text: combinedText }),
        });
      });
    });

    req.on('error', (e) => {
      console.log(e);
      reject(e);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 30 seconds'));
    });

    req.write(bodyString);
    req.end();
  });
}

async function run() {
  const results = {
    mode: 'direct_api',
    startedAt: iso(),
    finishedAt: null,
    queries: [],
    summary: { total: 0, passed: 0, failed: 0 },
  };

  console.log('=== AI BACKEND DIRECT VERIFICATION ===');

  for (const sc of scenarios) {
    console.log(`[RUNNING] ${sc.id}: ${sc.query}`);
    try {
      const response = await postRequest({ query: sc.query });
      const responseBody = JSON.parse(response.body);
      const content = responseBody.text.toLowerCase();

      const isFallback = content.includes("this is a fallback response");
      const contentOK = !isFallback && sc.expectText.some(t => content.includes(t));
      const passed = response.statusCode >= 200 && response.statusCode < 300 && contentOK;

      results.queries.push({
        id: sc.id,
        query: sc.query,
        passed,
        statusCode: response.statusCode,
        contentOK,
        responseExcerpt: response.body.slice(0, 500)
      });
      console.log(`[${passed ? 'PASS' : 'FAIL'}] ${sc.id} | StatusCode: ${response.statusCode} | Content OK: ${contentOK}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.stack : String(error);
      results.queries.push({
        id: sc.id,
        query: sc.query,
        passed: false,
        error: errorMessage,
      });
      console.log(`[FAIL] ${sc.id} | Error:`, error);
    }
  }

  results.summary.total = results.queries.length;
  results.summary.passed = results.queries.filter(q => q.passed).length;
  results.summary.failed = results.summary.total - results.summary.passed;
  results.finishedAt = iso();

  console.log(`\n--- FINAL RESULTS ---`);
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nSummary: ${results.summary.passed}/${results.summary.total} passed`);

  if (results.summary.failed > 0) process.exitCode = 1;

}

if (require.main === module) {
  run().catch(e => { console.error(e); process.exit(2); });
}
