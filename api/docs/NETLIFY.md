# Netlify Deployment Guide

This repository includes Netlify configuration for easy deployment.

## Deployment Options

### 1. Auto-Deploy (Recommended)

1. Connect your GitHub repository to Netlify
2. Netlify will automatically detect and deploy using `netlify.toml`
3. Your MCP server will be available at `https://your-site.netlify.app`

### 2. Manual Deploy

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy to Netlify
bun run deploy
```

### 3. Preview Deploy

```bash
# Create preview deploy
netlify deploy --dir=.
```

## What Gets Deployed

- **Static Assets**: Source code, documentation, API spec
- **Demo Server**: Simple HTTP server for testing
- **Documentation Site**: README.md rendered as HTML
- **Health Endpoint**: `/health` for monitoring

## MCP Usage with Netlify

Once deployed, you can reference the server in MCP configurations:

```json
{
  "mcpServers": {
    "dflow-mcp": {
      "command": "curl",
      "args": [
        "-X", "POST", 
        "https://your-site.netlify.app/api/tools/call",
        "-H", "Content-Type: application/json",
        "-d", "@-"
      ]
    }
  }
}
```

## CDN and Performance

Netlify automatically:
- Serves files from global CDN
- Handles HTTPS certificates
- Provides automatic gzip compression
- Sets appropriate cache headers

## Custom Domain

To use a custom domain:

1. Go to Netlify dashboard → Site settings → Domain management
2. Add your custom domain
3. Update DNS records as instructed
4. Update MCP configuration with new domain