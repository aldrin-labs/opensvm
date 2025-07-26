# Multi-Key OpenRouter Configuration Example

This example shows how to set up and use multiple OpenRouter API keys for high-volume production workloads.

## Environment Setup

### `.env.local`
```bash
# Multiple OpenRouter API keys for load balancing
OPENROUTER_API_KEYS=sk-or-v1-a1b2c3d4e5f6g7h8,sk-or-v1-i9j0k1l2m3n4o5p6,sk-or-v1-q7r8s9t0u1v2w3x4,sk-or-v1-y5z6a7b8c9d0e1f2,sk-or-v1-g3h4i5j6k7l8m9n0

# Optional: Fallback single key (used if OPENROUTER_API_KEYS is not set)
OPENROUTER_API_KEY=sk-or-v1-backup-key-here

# Other required configs
QDRANT_URL=https://your-qdrant-instance.com
QDRANT_API_KEY=your-qdrant-key
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
```

## Key Benefits

With 5 OpenRouter API keys configured:

1. **5x Rate Limit Capacity**: Each key has its own rate limit
2. **Automatic Failover**: If one key fails, others continue working
3. **Load Distribution**: Requests are evenly distributed
4. **High Availability**: System continues even if some keys fail

## Monitoring Script

Create a monitoring script to check key health:

```typescript
// scripts/monitor-keys.ts
import { AnthropicClient } from '../lib/anthropic-proxy/core/AnthropicClient';

async function monitorKeys() {
  const client = new AnthropicClient();
  const stats = client.getKeyUsageStats();
  
  console.log('=== OpenRouter Key Status ===');
  console.log(`Total Keys: ${stats.totalKeys}`);
  console.log(`Active Keys: ${stats.activeKeys}`);
  console.log(`Failed Keys: ${stats.failedKeys}`);
  console.log(`Health Score: ${((stats.activeKeys / stats.totalKeys) * 100).toFixed(1)}%`);
  
  console.log('\n=== Individual Key Stats ===');
  Object.entries(stats.usage).forEach(([keyId, keyStats]: [string, any]) => {
    console.log(`${keyId}:`);
    console.log(`  Requests: ${keyStats.requests}`);
    console.log(`  Status: ${keyStats.isFailed ? '❌ Failed' : '✅ Active'}`);
    console.log(`  Preview: ${keyStats.keyPreview}`);
    console.log(`  Last Used: ${keyStats.lastUsed ? new Date(keyStats.lastUsed).toLocaleString() : 'Never'}`);
  });
  
  // Alert if too many keys are failing
  if (stats.failedKeys > stats.totalKeys / 2) {
    console.error('\n⚠️  WARNING: More than 50% of keys are failing!');
    // Send alert to monitoring system
  }
}

// Run every minute
setInterval(monitorKeys, 60000);
monitorKeys(); // Run immediately
```

## API Endpoint Usage

Check key statistics via API:

```bash
# Get current key statistics
curl -H "Authorization: Bearer sk-ant-api03-your-opensvm-key" \
     https://your-domain.com/api/opensvm/anthropic-keys/stats

# Response:
{
  "timestamp": "2024-02-15T10:30:00Z",
  "openRouterKeys": {
    "total": 5,
    "active": 4,
    "failed": 1
  },
  "usage": [
    {
      "id": "key_1",
      "requests": 1523,
      "lastUsed": "2024-02-15T10:29:45Z",
      "status": "active",
      "preview": "...g7h8"
    },
    {
      "id": "key_2",
      "requests": 1522,
      "lastUsed": "2024-02-15T10:29:50Z",
      "status": "active",
      "preview": "...o5p6"
    },
    {
      "id": "key_3",
      "requests": 1521,
      "lastUsed": "2024-02-15T10:29:55Z",
      "status": "failed",
      "preview": "...w3x4"
    },
    {
      "id": "key_4",
      "requests": 1520,
      "lastUsed": "2024-02-15T10:30:00Z",
      "status": "active",
      "preview": "...e1f2"
    },
    {
      "id": "key_5",
      "requests": 1519,
      "lastUsed": "2024-02-15T10:29:40Z",
      "status": "active",
      "preview": "...m9n0"
    }
  ],
  "health": {
    "allKeysOperational": false,
    "healthScore": "80.0%"
  }
}
```

## Load Testing Example

Test your multi-key setup with concurrent requests:

```typescript
// scripts/load-test.ts
import Anthropic from '@anthropic-ai/sdk';

async function loadTest() {
  const anthropic = new Anthropic({
    apiKey: 'sk-ant-api03-your-opensvm-key',
    baseURL: 'https://your-domain.com/v1'
  });

  const concurrentRequests = 50;
  const totalRequests = 500;
  
  console.log(`Starting load test: ${totalRequests} total requests, ${concurrentRequests} concurrent`);
  
  const startTime = Date.now();
  let completed = 0;
  let errors = 0;
  
  // Create request batches
  for (let i = 0; i < totalRequests; i += concurrentRequests) {
    const batch = Array(Math.min(concurrentRequests, totalRequests - i))
      .fill(null)
      .map((_, j) => 
        anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 50,
          messages: [{
            role: 'user',
            content: `Test request ${i + j + 1}`
          }]
        })
        .then(() => {
          completed++;
          process.stdout.write(`\rCompleted: ${completed}/${totalRequests}`);
        })
        .catch((error) => {
          errors++;
          console.error(`\nError on request ${i + j + 1}:`, error.message);
        })
      );
    
    await Promise.all(batch);
  }
  
  const duration = (Date.now() - startTime) / 1000;
  const rps = completed / duration;
  
  console.log('\n\n=== Load Test Results ===');
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful: ${completed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Duration: ${duration.toFixed(2)}s`);
  console.log(`Requests/Second: ${rps.toFixed(2)}`);
  
  // Check key distribution
  const client = new AnthropicClient();
  const stats = client.getKeyUsageStats();
  
  console.log('\n=== Key Distribution ===');
  Object.entries(stats.usage).forEach(([keyId, keyStats]: [string, any]) => {
    const percentage = ((keyStats.requests / completed) * 100).toFixed(1);
    console.log(`${keyId}: ${keyStats.requests} requests (${percentage}%)`);
  });
}

loadTest().catch(console.error);
```

## Production Monitoring Dashboard

Create a simple monitoring page:

```tsx
// app/admin/openrouter-status/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export default function OpenRouterStatus() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/opensvm/anthropic-keys/stats', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('apiKey')}`
          }
        });
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!stats) return <div>Error loading stats</div>;

  const healthScore = parseFloat(stats.health.healthScore);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">OpenRouter API Key Status</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.openRouterKeys.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Active Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.openRouterKeys.active}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Health Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{stats.health.healthScore}</div>
              <Progress value={healthScore} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Individual Key Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.usage.map((key: any) => (
              <div key={key.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <Badge variant={key.status === 'active' ? 'success' : 'destructive'}>
                    {key.status}
                  </Badge>
                  <span className="font-mono">{key.id}</span>
                  <span className="text-gray-500">({key.preview})</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{key.requests} requests</div>
                  <div className="text-sm text-gray-500">
                    {key.lastUsed ? `Last: ${new Date(key.lastUsed).toLocaleTimeString()}` : 'Never used'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Troubleshooting Common Issues

### Issue: Uneven Key Distribution
```bash
# Check if keys are being rotated properly
tail -f logs/opensvm.log | grep "getNextApiKey"

# Look for patterns like:
# Using key ending in ...g7h8
# Using key ending in ...o5p6
# Using key ending in ...w3x4
```

### Issue: Multiple Keys Failing
```bash
# Check OpenRouter status for all keys
for i in {1..5}; do
  echo "Checking key $i..."
  curl -H "Authorization: Bearer sk-or-v1-key$i" \
       https://openrouter.ai/api/v1/models
  echo -e "\n"
done
```

### Issue: Rate Limit Despite Multiple Keys
- Ensure keys are from different OpenRouter accounts if possible
- Check if all keys share the same rate limit pool
- Consider adding more keys or upgrading limits

## Best Practices Summary

1. **Use 3-10 Keys**: Balance between redundancy and manageability
2. **Monitor Continuously**: Set up alerts for key failures
3. **Rotate Regularly**: Replace keys monthly for security
4. **Test Failover**: Regularly test with some keys disabled
5. **Document Keys**: Keep track of which key is which
6. **Separate Environments**: Use different key sets for dev/prod
7. **Budget Per Key**: Set spending limits on each key individually

With this setup, you can handle thousands of requests per minute reliably! 