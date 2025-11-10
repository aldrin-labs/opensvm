# How to Create an API Key - Complete Guide

**Last Updated:** November 10, 2025

---

## Quick Overview

Creating an API key for OpenSVM is a 3-step process:
1. **Generate the API key** (using CLI or API)
2. **Bind your Solana wallet** (via web interface)
3. **Use the API key** (in your applications)

Total time: ~2-3 minutes

---

## Prerequisites

Before you start, make sure you have:

- [ ] A Solana wallet (Phantom, Solflare, etc.) installed in your browser
- [ ] The OpenSVM project running locally OR access to the production site
- [ ] Node.js installed (if using CLI method)

---

## Method 1: Using the CLI Script (Recommended)

### Step 1: Generate API Key via CLI

1. **Open your terminal** and navigate to the project directory:
   ```bash
   cd /home/larp/aldrin/opensvm
   ```

2. **Run the API key creation script:**
   ```bash
   node scripts/create-api-key.js --name "My First API Key"
   ```

   **Optional parameters:**
   - `--name "Custom Name"` - Give your key a descriptive name
   - `--expires 30` - Set expiration in days (default: never expires)
   - `--no-auth-link` - Skip automatic auth link generation

3. **Save the output** - You'll see something like this:
   ```
   ✅ API Key created successfully!
   
   API Key Details:
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ID: abc123def456...
   Name: My First API Key
   Status: pending (awaiting wallet binding)
   Created: 2025-11-10T17:00:00.000Z
   
   🔑 Your API Key (SAVE THIS - IT WON'T BE SHOWN AGAIN!):
   osvm_1234567890abcdefghijklmnopqrstuvwxyz...
   
   🔗 Auth Link (expires in 15 minutes):
   http://localhost:3000/auth/bind?token=xyz789abc...
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   Next Steps:
   1. SAVE the API key above in a secure location
   2. Open the auth link to bind your Solana wallet
   3. After binding, use your API key in requests
   ```

4. **⚠️ CRITICAL: Save the API key immediately!**
   
   Copy the `osvm_...` key and store it securely:
   
   ```bash
   # Option A: Save to .env file
   echo "OPENSVM_API_KEY=osvm_1234567890abcdefghijklmnopqrstuvwxyz..." >> .env
   
   # Option B: Save to environment variable
   export OPENSVM_API_KEY="osvm_1234567890abcdefghijklmnopqrstuvwxyz..."
   
   # Option C: Save to password manager or secure note
   ```
   
   **You will NEVER see this key again!** If you lose it, you'll need to create a new one.

### Step 2: Bind Your Wallet

1. **Copy the auth link** from the terminal output (it looks like `http://localhost:3000/auth/bind?token=xyz789...`)

2. **Open the link in your browser** - You'll see the wallet binding page

3. **Connect your Solana wallet:**
   - Click the "Connect Wallet" button
   - Select your wallet (Phantom, Solflare, etc.)
   - Approve the connection in your wallet extension

4. **Authorize the API key:**
   - Click "Authorize API Key" button
   - Your wallet will prompt you to sign a message
   - Click "Sign" or "Approve" in your wallet

5. **Success!** You should see:
   ```
   ✅ Success! 
   Your wallet has been bound to the API key.
   You can now close this window and use your API key.
   ```

### Step 3: Test Your API Key

Test that your API key works:

```bash
# Test with a transaction lookup
curl -H "Authorization: Bearer $OPENSVM_API_KEY" \
  http://localhost:3000/api/transaction/YOUR_TX_SIGNATURE

# Test with account stats
curl -H "Authorization: Bearer $OPENSVM_API_KEY" \
  http://localhost:3000/api/account-stats/YOUR_WALLET_ADDRESS
```

If you see a JSON response with data, **congratulations!** Your API key is working! 🎉

---

## Method 2: Using the API Directly

### Step 1: Generate API Key via API

Make a POST request to create the API key:

```bash
curl -X POST http://localhost:3000/api/auth/api-keys/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key",
    "generateAuthLink": true
  }'
```

**Response:**
```json
{
  "success": true,
  "apiKey": {
    "id": "abc123def456",
    "name": "My API Key",
    "status": "pending",
    "createdAt": "2025-11-10T17:00:00.000Z",
    "permissions": ["read:*"]
  },
  "rawKey": "osvm_1234567890abcdefghijklmnopqrstuvwxyz...",
  "authLink": "http://localhost:3000/auth/bind?token=xyz789...",
  "authLinkExpiresAt": "2025-11-10T17:15:00.000Z",
  "message": "API key created successfully. The raw key will not be shown again."
}
```

**⚠️ Save the `rawKey` immediately!** Store it in a secure location.

### Step 2: Bind Your Wallet

Same as Method 1, Step 2 above - open the `authLink` in your browser and follow the wallet binding process.

---

## Advanced Options

### Create API Key with Custom Expiration

```bash
# Expires in 30 days
node scripts/create-api-key.js --name "Temporary Key" --expires 30

# Or via API
curl -X POST http://localhost:3000/api/auth/api-keys/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Temporary Key",
    "expiresInDays": 30,
    "generateAuthLink": true
  }'
```

### Create API Key with Custom Permissions

```bash
curl -X POST http://localhost:3000/api/auth/api-keys/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Read-only Key",
    "permissions": ["read:transactions", "read:accounts"],
    "generateAuthLink": true
  }'
```

---

## Using Your API Key

### In CLI Tools

```bash
#!/bin/bash
# example-script.sh

# Set your API key
export OPENSVM_API_KEY="osvm_your_key_here"

# Make authenticated requests
curl -H "Authorization: Bearer $OPENSVM_API_KEY" \
  http://localhost:3000/api/account-stats/YOUR_ADDRESS
```

### In Node.js/JavaScript

```javascript
// config.js
const OPENSVM_API_KEY = process.env.OPENSVM_API_KEY;

async function getTransaction(signature) {
  const response = await fetch(
    `http://localhost:3000/api/transaction/${signature}`,
    {
      headers: {
        'Authorization': `Bearer ${OPENSVM_API_KEY}`
      }
    }
  );
  
  const data = await response.json();
  return data;
}

// Usage
getTransaction('YOUR_TX_SIGNATURE')
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

### In Python

```python
import os
import requests

OPENSVM_API_KEY = os.getenv('OPENSVM_API_KEY')

def get_transaction(signature):
    headers = {
        'Authorization': f'Bearer {OPENSVM_API_KEY}'
    }
    
    response = requests.get(
        f'http://localhost:3000/api/transaction/{signature}',
        headers=headers
    )
    
    return response.json()

# Usage
data = get_transaction('YOUR_TX_SIGNATURE')
print(data)
```

### In Telegram Bot

```javascript
const TelegramBot = require('node-telegram-bot-api');
const OPENSVM_API_KEY = process.env.OPENSVM_API_KEY;

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

bot.onText(/\/tx (.+)/, async (msg, match) => {
  const signature = match[1];
  
  try {
    const response = await fetch(
      `http://localhost:3000/api/transaction/${signature}`,
      {
        headers: {
          'Authorization': `Bearer ${OPENSVM_API_KEY}`
        }
      }
    );
    
    const data = await response.json();
    bot.sendMessage(msg.chat.id, `Transaction: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    bot.sendMessage(msg.chat.id, `Error: ${error.message}`);
  }
});
```

---

## Managing Your API Keys

### List All Your API Keys

```bash
# If you have a session/JWT token
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:3000/api/auth/api-keys/list
```

### View API Key Usage Metrics

```bash
curl -H "Authorization: Bearer $OPENSVM_API_KEY" \
  http://localhost:3000/api/auth/api-keys/metrics
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "apiKeyId": "abc123",
    "totalRequests": 1500,
    "successfulRequests": 1450,
    "failedRequests": 50,
    "averageResponseTime": 250,
    "lastActivity": "2025-11-10T13:00:00Z",
    "requestsByEndpoint": {
      "/api/transaction": 800,
      "/api/account-stats": 400
    }
  }
}
```

### View API Key Activity Logs

```bash
curl -H "Authorization: Bearer $OPENSVM_API_KEY" \
  'http://localhost:3000/api/auth/api-keys/activity?limit=50'
```

### Revoke an API Key

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://localhost:3000/api/auth/api-keys/KEY_ID_HERE
```

---

## Troubleshooting

### "Invalid auth token"

**Problem:** The auth link has expired or been used already.

**Solution:**
1. Generate a new auth link:
   ```bash
   curl -X POST http://localhost:3000/api/auth/auth-link/create \
     -H "Content-Type: application/json" \
     -d '{"apiKeyId": "YOUR_KEY_ID"}'
   ```
2. Use the new link within 15 minutes

### "Invalid wallet signature"

**Problem:** Wallet signature verification failed.

**Solution:**
1. Make sure your wallet is connected
2. Try refreshing the page
3. Disconnect and reconnect your wallet
4. Try signing again

### "API key not found"

**Problem:** Using an invalid or revoked API key.

**Solution:**
1. Verify you're using the correct API key
2. Check if the key was revoked
3. Create a new API key if needed

### Lost Your API Key?

**Unfortunately, there's no way to retrieve a lost API key.** You must:
1. Create a new API key
2. Update your applications with the new key
3. Optionally revoke the old key

---

## Security Best Practices

### ✅ DO:

- **Store API keys in environment variables**
  ```bash
  # .env file
  OPENSVM_API_KEY=osvm_your_key_here
  ```

- **Use different keys for different environments**
  - Development: `osvm_dev_...`
  - Staging: `osvm_staging_...`
  - Production: `osvm_prod_...`

- **Rotate keys periodically**
  - Create new key every 90 days
  - Update applications
  - Revoke old key

- **Use descriptive names**
  ```bash
  node scripts/create-api-key.js --name "Production Bot - Nov 2025"
  ```

- **Set expiration dates for temporary keys**
  ```bash
  node scripts/create-api-key.js --name "Test Key" --expires 7
  ```

### ❌ DON'T:

- **Never commit API keys to version control**
  ```bash
  # Add to .gitignore
  .env
  .env.local
  ```

- **Never share API keys in plain text**
  - Don't send via email
  - Don't post in Slack/Discord
  - Don't include in screenshots

- **Never use the same key across multiple services**
  - Create separate keys for each application/service

- **Never hardcode API keys in client-side code**
  ```javascript
  // ❌ BAD - Exposed to users
  const API_KEY = "osvm_1234567890...";
  
  // ✅ GOOD - Server-side only
  const API_KEY = process.env.OPENSVM_API_KEY;
  ```

---

## FAQ

### Q: Can I have multiple API keys?
**A:** Yes! You can create as many API keys as you need. Each can have different names, permissions, and expiration dates.

### Q: Can one API key be bound to multiple wallets?
**A:** No, each API key can only be bound to one Solana wallet. Create multiple keys if you need multiple wallet bindings.

### Q: What happens if my API key expires?
**A:** The key becomes inactive and API requests will fail. You'll need to create a new API key.

### Q: Can I change the wallet bound to an API key?
**A:** No, wallet bindings are permanent. You must create a new API key to bind a different wallet.

### Q: What permissions does `read:*` mean?
**A:** This gives read access to all endpoints. You can customize permissions when creating keys.

### Q: How long do auth links last?
**A:** Auth links expire after 15 minutes by default. You can customize this when creating the link.

### Q: Can I use API keys in production?
**A:** Yes! The API key system is production-ready and stored securely in Qdrant.

---

## Complete Example Workflow

Here's a complete example of creating and using an API key:

```bash
# 1. Create the API key
node scripts/create-api-key.js --name "My Telegram Bot"

# 2. Save the output
echo "OPENSVM_API_KEY=osvm_abc123..." >> .env

# 3. Open auth link in browser (from terminal output)
# http://localhost:3000/auth/bind?token=xyz789...

# 4. Connect wallet and sign message

# 5. Test the API key
source .env
curl -H "Authorization: Bearer $OPENSVM_API_KEY" \
  http://localhost:3000/api/account-stats/YOUR_ADDRESS

# 6. Use in your application
node your-app.js
```

---

## Next Steps

Now that you have an API key, you can:

1. **Build CLI tools** - Automate blockchain queries
2. **Create bots** - Telegram/Discord bots with Solana data
3. **Integrate with apps** - Add blockchain data to your applications
4. **Monitor metrics** - Track your API key usage and performance

---

## Support

Need help? Check these resources:

- **Documentation:** See `API-KEY-AUTH-SYSTEM.md` for detailed technical docs
- **API Reference:** See `llms.txt` for all available endpoints
- **GitHub Issues:** Report bugs or request features
- **Discord:** Join the community for support

---

**Happy building! 🚀**
