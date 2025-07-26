# OpenRouter Setup Guide

This guide explains how to configure OpenSVM to use OpenRouter as the backend for Anthropic API requests.

## Prerequisites

1. An OpenRouter account: [Sign up at OpenRouter](https://openrouter.ai)
2. OpenRouter API credits
3. Access to your OpenSVM deployment

## Step 1: Get Your OpenRouter API Key(s)

### Single Key Setup
1. Log in to [OpenRouter Dashboard](https://openrouter.ai/keys)
2. Click "Create Key"
3. Give your key a name (e.g., "OpenSVM Production")
4. Copy the key - it starts with `sk-or-v1-`

### Multiple Keys Setup (Recommended for Production)
To avoid rate limits and increase reliability, you can use multiple OpenRouter API keys:

1. Create multiple API keys in the OpenRouter dashboard
2. Name them systematically (e.g., "OpenSVM Prod 1", "OpenSVM Prod 2", etc.)
3. Copy all the keys

## Step 2: Configure Environment Variables

### Single Key Configuration
```bash
# OpenRouter API Key (Single key)
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### Multiple Keys Configuration (Recommended)
```bash
# OpenRouter API Keys (Multiple keys separated by commas)
OPENROUTER_API_KEYS=sk-or-v1-key1,sk-or-v1-key2,sk-or-v1-key3

# You can have as many keys as needed
# The system will automatically round-robin between them
```

### Optional Configuration
```bash
# Custom OpenRouter endpoint (defaults to https://openrouter.ai/api/v1)
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

## Step 3: Verify Configuration

1. Restart your OpenSVM application
2. Check logs for successful initialization:
   ```
   ✓ Initialized with 3 OpenRouter API key(s)
   ✓ Using OpenRouter endpoint: https://openrouter.ai/api/v1
   ```

## Step 4: Test the Integration

Use curl to test the proxy:

```bash
curl -X POST https://your-opensvm-domain.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ant-api03-your-opensvm-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-sonnet-20240229",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "Hello! Can you confirm you are working through OpenRouter?"
      }
    ]
  }'
```

## Multi-Key Load Balancing

When using multiple OpenRouter API keys, the system provides:

### Automatic Round-Robin
- Keys are used in sequence: key1 → key2 → key3 → key1...
- Ensures even distribution of requests across all keys

### Rate Limit Handling
- If a key hits rate limits (429 error), it's temporarily marked as failed
- The system automatically switches to the next available key
- Failed keys are retried after a 5-minute cooldown period

### Key Usage Monitoring
You can monitor key usage through the API:

```typescript
// In your monitoring code
const stats = anthropicClient.getKeyUsageStats();
console.log(stats);
// Output:
// {
//   totalKeys: 3,
//   activeKeys: 3,
//   failedKeys: 0,
//   usage: {
//     key_1: { requests: 150, lastUsed: ..., isFailed: false, keyPreview: "...abc1" },
//     key_2: { requests: 149, lastUsed: ..., isFailed: false, keyPreview: "...def2" },
//     key_3: { requests: 151, lastUsed: ..., isFailed: false, keyPreview: "...ghi3" }
//   }
// }
```

## Available Models

Through OpenRouter, the following Anthropic models are available:

| OpenSVM Model Name | OpenRouter Model | Description |
|-------------------|------------------|-------------|
| claude-3-sonnet-20240229 | anthropic/claude-3.5-sonnet | Most capable, balanced model |
| claude-3-opus-20240229 | anthropic/claude-3-opus | Highest capability model |
| claude-3-haiku-20240307 | anthropic/claude-3-haiku | Fast, efficient model |
| claude-3-sonnet-4 | anthropic/claude-3.5-sonnet | Latest Sonnet version |
| claude-3-opus-4 | anthropic/claude-3-opus | Latest Opus version |

## Best Practices for Multiple Keys

### 1. Use Enough Keys
- For production workloads, use at least 3-5 keys
- More keys = better rate limit distribution

### 2. Monitor Key Health
- Set up monitoring for failed keys
- Alert when multiple keys are rate limited

### 3. Set Similar Limits
- Configure similar rate limits for all keys
- Ensures predictable behavior

### 4. Regular Key Rotation
- Rotate keys periodically for security
- Update one key at a time to avoid downtime

## Monitoring Usage

### OpenRouter Dashboard

Monitor your usage at [OpenRouter Usage](https://openrouter.ai/usage):
- Request counts per key
- Token usage per key
- Cost breakdown
- Rate limit status

### OpenSVM Logs

Check application logs for request details:
```bash
# See which keys are being used
tail -f logs/opensvm.log | grep "key ending"

# Monitor rate limit errors
tail -f logs/opensvm.log | grep "rate limit"

# Check key rotation
tail -f logs/opensvm.log | grep "trying next key"
```

## Troubleshooting

### Error: "At least one OpenRouter API key is required"
- Ensure `OPENROUTER_API_KEYS` or `OPENROUTER_API_KEY` is set
- Check for typos or extra spaces
- Restart the application after setting keys

### Error: "All keys exhausted"
- All your keys have hit rate limits
- Add more keys or wait for cooldown
- Check OpenRouter dashboard for limits

### Uneven Key Usage
- This is normal due to rate limit avoidance
- Keys that hit limits are temporarily skipped
- Usage will balance out over time

### Key Not Being Used
- Check if the key has been rate limited recently
- Verify the key is valid in OpenRouter dashboard
- Look for error logs related to that specific key

## Security Best Practices

1. **Never commit API keys**: Keep them in environment variables only
2. **Use separate keys**: Different keys for dev/staging/production
3. **Set spending limits**: Configure limits in OpenRouter dashboard for each key
4. **Monitor usage**: Set up alerts for unusual activity on any key
5. **Rotate keys regularly**: Change keys every 90 days
6. **Use key prefixes**: Name keys to identify their purpose (prod-1, prod-2, etc.)

## Advanced Configuration

### Custom Headers

Add custom headers for OpenRouter requests:

```typescript
// In your configuration
{
  headers: {
    'X-Custom-Header': 'value',
    'X-Request-Source': 'opensvm-prod'
  }
}
```

### Request Timeout

Configure timeout for OpenRouter requests:

```bash
# In environment variables
OPENROUTER_TIMEOUT=30000  # 30 seconds
```

### Retry Configuration

Set retry behavior for failed requests:

```bash
OPENROUTER_MAX_RETRIES=3
OPENROUTER_RETRY_DELAY=1000  # 1 second
```

## Cost Management

### Understanding Costs with Multiple Keys

- Each key has its own usage and billing
- Total cost = sum of all key usage
- Monitor each key's spending separately

### Cost Optimization Tips

1. Use appropriate models for tasks:
   - Haiku for simple queries
   - Sonnet for general tasks
   - Opus for complex reasoning

2. Set reasonable `max_tokens` limits
3. Implement caching for repeated queries
4. Monitor usage patterns and optimize
5. Set spending alerts for each key

## Support

### OpenRouter Support
- Documentation: https://openrouter.ai/docs
- Discord: https://discord.gg/openrouter
- Email: support@openrouter.ai

### OpenSVM Support
- GitHub Issues: https://github.com/opensvm/issues
- Discord: https://discord.gg/opensvm
- Documentation: https://docs.opensvm.com 