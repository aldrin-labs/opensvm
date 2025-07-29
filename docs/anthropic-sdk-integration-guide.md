# Anthropic SDK Integration Guide for OpenSVM

This guide shows you how to use popular Anthropic SDKs and tools with OpenSVM's proxy service to pay with SVMAI tokens while maintaining full compatibility.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Claude CLI](#claude-cli)
- [Python SDK](#python-sdk)
- [JavaScript/TypeScript SDK](#javascripttypescript-sdk)
- [Error Handling](#error-handling)
- [SVMAI Billing](#svmai-billing)
- [Streaming Responses](#streaming-responses)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

OpenSVM's Anthropic API proxy allows you to use any existing Anthropic SDK or tool by simply:

1. **Changing the base URL** to `https://opensvm.com/v1`
2. **Using your OpenSVM API key** instead of Anthropic's
3. **Depositing SVMAI tokens** for billing

**No code changes required** - all existing Anthropic SDK code works as-is!

## Getting Started

### 1. Get Your OpenSVM API Key

1. Visit [OpenSVM Dashboard](https://opensvm.com/dashboard)
2. Navigate to **API Keys** section
3. Click **Generate New Key**
4. Copy your key (format: `sk-ant-api03-...`)

### 2. Deposit SVMAI Tokens

1. Go to **Balance** section in dashboard
2. Click **Deposit SVMAI**
3. Send SVMAI tokens to the provided multisig address
4. Wait for confirmation (usually 1-2 minutes)

### 3. Configure Your SDK

Update your SDK configuration to use OpenSVM's endpoint:

```bash
# Base URL to use
https://opensvm.com/v1
```

## Claude CLI

The Claude CLI works perfectly with OpenSVM with minimal configuration.

### Installation

```bash
pip install claude-cli
```

### Configuration

Create or update your Claude CLI config:

```bash
# Set your OpenSVM API key
export ANTHROPIC_API_KEY="sk-ant-api03-your-opensvm-key-here"

# Set OpenSVM base URL
export ANTHROPIC_BASE_URL="https://opensvm.com/v1"
```

Or configure via file `~/.claude/config.json`:

```json
{
  "api_key": "sk-ant-api03-your-opensvm-key-here",
  "base_url": "https://opensvm.com/v1"
}
```

### Usage Examples

```bash
# Simple conversation
claude "Hello! How can you help me today?"

# Use specific model
claude --model claude-3-haiku-20240307 "Quick question about Python"

# System prompt
claude --system "You are a helpful coding assistant" "Write a function to sort an array"

# Max tokens
claude --max-tokens 500 "Write a short story"

# Streaming output
claude --stream "Tell me about quantum computing"

# Temperature control
claude --temperature 0.7 "Be creative and write a poem"

# With stop sequences
claude --stop-sequences "END" "Count to 10 and say END"
```

### Advanced CLI Usage

```bash
# Multi-turn conversation from file
claude --file conversation.txt

# Save conversation
claude "Hello" --save conversation.json

# Load and continue conversation
claude --load conversation.json "Continue our chat"

# Custom system prompt from file
claude --system-file system_prompt.txt "Your question here"
```

## Python SDK

The official `anthropic` Python library works seamlessly with OpenSVM.

### Installation

```bash
pip install anthropic
```

### Basic Setup

```python
import anthropic

# Initialize client with OpenSVM
client = anthropic.Anthropic(
    api_key="sk-ant-api03-your-opensvm-key-here",
    base_url="https://opensvm.com/v1"
)

# Alternative: use environment variables
# export ANTHROPIC_API_KEY="sk-ant-api03-your-opensvm-key-here"
# export ANTHROPIC_BASE_URL="https://opensvm.com/v1"
# client = anthropic.Anthropic()
```

### Usage Examples

#### Simple Message

```python
import anthropic

client = anthropic.Anthropic(
    api_key="sk-ant-api03-your-opensvm-key-here",
    base_url="https://opensvm.com/v1"
)

response = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello Claude!"}
    ]
)

print(response.content[0].text)
```

#### With System Prompt

```python
response = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    system="You are a helpful Python programming assistant.",
    messages=[
        {"role": "user", "content": "Help me debug this code"}
    ]
)
```

#### Multi-turn Conversation

```python
conversation = [
    {"role": "user", "content": "Hi, I'm working on a Python project"},
    {"role": "assistant", "content": "Great! I'd be happy to help. What are you working on?"},
    {"role": "user", "content": "I need help with error handling"}
]

response = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    messages=conversation
)

# Add response to conversation
conversation.append({
    "role": "assistant", 
    "content": response.content[0].text
})
```

#### Streaming

```python
stream = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    stream=True,
    messages=[
        {"role": "user", "content": "Tell me a story"}
    ]
)

for chunk in stream:
    if chunk.type == "content_block_delta":
        print(chunk.delta.text, end="", flush=True)
```

#### Async/Await

```python
import asyncio
import anthropic

async def main():
    client = anthropic.AsyncAnthropic(
        api_key="sk-ant-api03-your-opensvm-key-here",
        base_url="https://opensvm.com/v1"
    )
    
    response = await client.messages.create(
        model="claude-3-sonnet-20240229",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "Async request"}
        ]
    )
    
    print(response.content[0].text)

asyncio.run(main())
```

#### Error Handling

```python
import anthropic

client = anthropic.Anthropic(
    api_key="sk-ant-api03-your-opensvm-key-here",
    base_url="https://opensvm.com/v1"
)

try:
    response = client.messages.create(
        model="claude-3-sonnet-20240229",
        max_tokens=1024,
        messages=[
            {"role": "user", "content": "Hello"}
        ]
    )
    print(response.content[0].text)
    
except anthropic.AuthenticationError as e:
    print(f"Authentication error: {e}")
    # Check your API key
    
except anthropic.RateLimitError as e:
    print(f"Rate limit exceeded: {e}")
    # Wait and retry
    
except anthropic.BadRequestError as e:
    print(f"Bad request: {e}")
    # Check your request parameters
    
except Exception as e:
    # Handle SVMAI billing errors
    if hasattr(e, 'status_code') and e.status_code == 402:
        print("Insufficient SVMAI balance. Please deposit more tokens.")
    else:
        print(f"Unexpected error: {e}")
```

## JavaScript/TypeScript SDK

The official `@anthropic-ai/sdk` works perfectly with OpenSVM in both Node.js and browser environments.

### Installation

```bash
npm install @anthropic-ai/sdk
# or
yarn add @anthropic-ai/sdk
```

### Basic Setup

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: 'sk-ant-api03-your-opensvm-key-here',
  baseURL: 'https://opensvm.com/v1'
});

// Alternative: use environment variables
// ANTHROPIC_API_KEY=sk-ant-api03-your-opensvm-key-here
// ANTHROPIC_BASE_URL=https://opensvm.com/v1
// const anthropic = new Anthropic();
```

### Usage Examples

#### Simple Message

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: 'sk-ant-api03-your-opensvm-key-here',
  baseURL: 'https://opensvm.com/v1'
});

async function main() {
  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Hello Claude!' }
    ]
  });

  console.log(response.content[0].text);
}

main();
```

#### With TypeScript Types

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: 'sk-ant-api03-your-opensvm-key-here',
  baseURL: 'https://opensvm.com/v1'
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function sendMessage(messages: ChatMessage[]): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 1024,
    messages: messages
  });

  return response.content[0].text;
}

// Usage
const conversation: ChatMessage[] = [
  { role: 'user', content: 'Hello!' }
];

const reply = await sendMessage(conversation);
console.log(reply);
```

#### Streaming

```typescript
const stream = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1024,
  stream: true,
  messages: [
    { role: 'user', content: 'Tell me a story' }
  ]
});

for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    process.stdout.write(chunk.delta.text);
  }
}
```

#### Browser Usage

```html
<!DOCTYPE html>
<html>
<head>
    <title>Claude Chat</title>
</head>
<body>
    <div id="chat"></div>
    <input id="input" type="text" placeholder="Type a message...">
    <button id="send">Send</button>

    <script type="module">
        import Anthropic from 'https://esm.sh/@anthropic-ai/sdk';

        const anthropic = new Anthropic({
            apiKey: 'sk-ant-api03-your-opensvm-key-here',
            baseURL: 'https://opensvm.com/v1'
        });

        document.getElementById('send').addEventListener('click', async () => {
            const input = document.getElementById('input');
            const chat = document.getElementById('chat');
            
            const userMessage = input.value;
            chat.innerHTML += `<div><strong>You:</strong> ${userMessage}</div>`;
            
            try {
                const response = await anthropic.messages.create({
                    model: 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: userMessage }
                    ]
                });
                
                chat.innerHTML += `<div><strong>Claude:</strong> ${response.content[0].text}</div>`;
            } catch (error) {
                chat.innerHTML += `<div><strong>Error:</strong> ${error.message}</div>`;
            }
            
            input.value = '';
        });
    </script>
</body>
</html>
```

#### React Integration

```tsx
import React, { useState } from 'react';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY!,
  baseURL: 'https://opensvm.com/v1'
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1024,
        messages: newMessages
      });

      setMessages([
        ...newMessages,
        { role: 'assistant', content: response.content[0].text }
      ]);
    } catch (error) {
      console.error('Error:', error);
      // Handle SVMAI billing errors
      if (error.status === 402) {
        alert('Insufficient SVMAI balance. Please deposit more tokens.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

## Error Handling

OpenSVM maintains full compatibility with Anthropic's error types while adding SVMAI-specific billing errors.

### Standard Anthropic Errors

These work exactly as documented in Anthropic's SDK:

```python
# Python
try:
    response = client.messages.create(...)
except anthropic.AuthenticationError:
    # Invalid API key
except anthropic.RateLimitError:
    # Rate limit exceeded
except anthropic.BadRequestError:
    # Invalid request
```

```typescript
// TypeScript
try {
  const response = await anthropic.messages.create(...);
} catch (error) {
  if (error instanceof Anthropic.AuthenticationError) {
    // Invalid API key
  } else if (error instanceof Anthropic.RateLimitError) {
    // Rate limit exceeded
  } else if (error instanceof Anthropic.BadRequestError) {
    // Invalid request
  }
}
```

### SVMAI Billing Errors

SVMAI billing errors use HTTP 402 (Payment Required) but are formatted as `authentication_error` for SDK compatibility:

```python
# Python
try:
    response = client.messages.create(...)
except Exception as e:
    if hasattr(e, 'status_code') and e.status_code == 402:
        # Extract SVMAI balance info from headers
        balance = e.response.headers.get('x-svmai-balance')
        required = e.response.headers.get('x-svmai-required')
        deposit_address = e.response.headers.get('x-deposit-address')
        
        print(f"Need {required} SVMAI (current: {balance})")
        print(f"Deposit to: {deposit_address}")
```

```typescript
// TypeScript
try {
  const response = await anthropic.messages.create(...);
} catch (error) {
  if (error.status === 402) {
    const balance = error.headers?.['x-svmai-balance'];
    const required = error.headers?.['x-svmai-required'];
    const depositAddress = error.headers?.['x-deposit-address'];
    
    console.log(`Need ${required} SVMAI (current: ${balance})`);
    console.log(`Deposit to: ${depositAddress}`);
  }
}
```

## SVMAI Billing

### Understanding Costs

- **Input tokens**: Text you send to Claude
- **Output tokens**: Text Claude sends back
- **Model pricing**: Different models have different SVMAI costs per token

### Checking Balance

Use the OpenSVM dashboard or API to check your balance:

```bash
curl -H "Authorization: Bearer sk-ant-api03-your-key" \
     https://opensvm.com/api/opensvm/balance
```

### Depositing SVMAI

1. Get deposit address from dashboard
2. Send SVMAI tokens to the multisig address
3. Wait for confirmation (1-2 blocks)
4. Balance automatically updates

### Cost Estimation

```python
# Estimate costs before making requests
def estimate_cost(input_text: str, max_tokens: int, model: str) -> float:
    # Rough estimation - actual costs may vary
    input_tokens = len(input_text.split()) * 1.3  # Approximate
    total_tokens = input_tokens + max_tokens
    
    # Example pricing (check current rates)
    cost_per_1k_tokens = {
        'claude-3-haiku-20240307': 0.25,
        'claude-3-sonnet-20240229': 3.0,
        'claude-3-opus-20240229': 15.0
    }
    
    return (total_tokens / 1000) * cost_per_1k_tokens.get(model, 3.0)

# Usage
estimated_cost = estimate_cost("Hello Claude!", 100, "claude-3-sonnet-20240229")
print(f"Estimated cost: {estimated_cost} SVMAI")
```

## Streaming Responses

All SDKs support streaming for real-time responses:

### Python Streaming

```python
stream = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    stream=True,
    messages=[{"role": "user", "content": "Tell me a story"}]
)

full_response = ""
for chunk in stream:
    if chunk.type == "content_block_delta":
        text = chunk.delta.text
        print(text, end="", flush=True)
        full_response += text

print(f"\n\nFull response: {full_response}")
```

### TypeScript Streaming

```typescript
const stream = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1024,
  stream: true,
  messages: [{ role: 'user', content: 'Tell me a story' }]
});

let fullResponse = '';
for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta') {
    process.stdout.write(chunk.delta.text);
    fullResponse += chunk.delta.text;
  }
}

console.log(`\n\nFull response: ${fullResponse}`);
```

### Claude CLI Streaming

```bash
claude --stream "Tell me about quantum computing"
```

## Best Practices

### 1. Error Handling

Always implement proper error handling:

```python
import time
import anthropic

def make_request_with_retry(client, **kwargs):
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            return client.messages.create(**kwargs)
        except anthropic.RateLimitError as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                time.sleep(wait_time)
                continue
            raise
        except Exception as e:
            if hasattr(e, 'status_code') and e.status_code == 402:
                raise ValueError("Insufficient SVMAI balance")
            raise
```

### 2. Balance Monitoring

Check your balance regularly:

```python
def check_balance_before_request(estimated_cost: float):
    # Implement balance check
    response = requests.get(
        "https://opensvm.com/api/opensvm/balance",
        headers={"Authorization": f"Bearer {api_key}"}
    )
    balance = response.json()["balance"]
    
    if balance < estimated_cost:
        raise ValueError(f"Insufficient balance: {balance} < {estimated_cost}")
```

### 3. Efficient Token Usage

- Use appropriate models for your use case
- Set reasonable `max_tokens` limits
- Use system prompts to reduce repetitive instructions

### 4. Conversation Management

```python
class ConversationManager:
    def __init__(self, client, model="claude-3-sonnet-20240229"):
        self.client = client
        self.model = model
        self.messages = []
    
    def add_message(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
    
    def send_message(self, content: str) -> str:
        self.add_message("user", content)
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=self.messages
        )
        
        reply = response.content[0].text
        self.add_message("assistant", reply)
        return reply
    
    def clear_history(self):
        self.messages = []
```

## Troubleshooting

### Common Issues

#### 1. Authentication Error

```
Error: Your API key is invalid or missing
```

**Solution**: 
- Verify your OpenSVM API key format: `sk-ant-api03-...`
- Check that you're using the correct base URL
- Ensure your API key hasn't expired

#### 2. Insufficient Balance

```
Error: Insufficient SVMAI balance to process this request
```

**Solution**:
- Check your balance in the dashboard
- Deposit more SVMAI tokens
- Wait for transaction confirmation

#### 3. Rate Limiting

```
Error: You have exceeded your rate limit
```

**Solution**:
- Implement exponential backoff
- Reduce request frequency
- Consider upgrading your plan

#### 4. Model Not Available

```
Error: Model 'claude-xyz' is not available
```

**Solution**:
- Use supported models: `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`, `claude-3-opus-20240229`
- Check model names for typos

#### 5. Connection Issues

```
Error: Unable to connect to Anthropic API
```

**Solution**:
- Verify you're using `https://opensvm.com/v1` as base URL
- Check your internet connection
- Try again in a few minutes

### Debug Mode

Enable debug logging to troubleshoot:

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Your code here
```

```typescript
// Add debug headers
const anthropic = new Anthropic({
  apiKey: 'your-key',
  baseURL: 'https://opensvm.com/v1',
  defaultHeaders: {
    'X-Debug': 'true'
  }
});
```

### Getting Help

- **Documentation**: [https://docs.opensvm.com](https://docs.opensvm.com)
- **Support**: [https://opensvm.com/support](https://opensvm.com/support)
- **Discord**: [https://discord.gg/opensvm](https://discord.gg/opensvm)
- **GitHub Issues**: [https://github.com/opensvm/issues](https://github.com/opensvm/issues)

---

## Summary

OpenSVM provides seamless compatibility with all Anthropic SDKs and tools:

1. **No code changes required** - just update the base URL and API key
2. **Full feature support** - streaming, conversation history, all models
3. **SVMAI billing** - pay with tokens instead of traditional payment methods
4. **Error compatibility** - all existing error handling works
5. **Performance** - same response times and reliability as direct Anthropic access

Start building with Claude using SVMAI tokens today! 🚀 