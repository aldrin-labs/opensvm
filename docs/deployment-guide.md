# OpenSVM Anthropic API Proxy - Deployment Guide

This guide covers the complete deployment process for the OpenSVM Anthropic API Proxy with SVMAI billing.

## 📋 Prerequisites

### Required Services

1. **OpenRouter Account**
   - Multiple API keys for load balancing
   - Format: `sk-or-v1-...`

2. **Qdrant Vector Database**
   - Version 1.0+ recommended
   - Can be self-hosted or cloud-hosted

3. **Solana RPC Access**
   - Mainnet RPC endpoint
   - WebSocket support recommended

4. **SVMAI Token Setup**
   - Multisig wallet address
   - SVMAI token mint address

### System Requirements

- **Node.js**: 18+ LTS
- **Memory**: 2GB+ RAM
- **Storage**: 10GB+ available space
- **Network**: Stable internet connection

## 🚀 Quick Start

### 1. Environment Configuration

Copy the example configuration:

```bash
cp lib/anthropic-proxy/config/deployment.example.env .env.local
```

Edit `.env.local` with your actual values:

```bash
# Required: OpenRouter API Keys
OPENROUTER_API_KEYS=sk-or-v1-your-key-1,sk-or-v1-your-key-2

# Required: Qdrant Database
QDRANT_URL=https://your-qdrant-instance.com
QDRANT_API_KEY=your-qdrant-api-key

# Required: Solana Configuration
SOLANA_MULTISIG_ADDRESS=YourActualMultisigAddress
SVMAI_TOKEN_MINT=YourActualSVMAITokenMint

# Required: Admin Access
ADMIN_USER_IDS=your-admin-user-id
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize Database Collections

```bash
npm run setup:qdrant
```

### 4. Start the Application

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 🔧 Detailed Configuration

### OpenRouter Setup

1. **Create OpenRouter Account**: Visit [OpenRouter.ai](https://openrouter.ai)
2. **Generate API Keys**: Create 3-5 keys for load balancing
3. **Configure Models**: Ensure access to Claude models
4. **Set Rate Limits**: Configure appropriate limits per key

```bash
OPENROUTER_API_KEYS=sk-or-v1-key1,sk-or-v1-key2,sk-or-v1-key3
OPENROUTER_TIMEOUT=30000
OPENROUTER_RETRIES=3
```

### Qdrant Database Setup

#### Option 1: Qdrant Cloud (Recommended for Production)

1. Sign up at [Qdrant Cloud](https://cloud.qdrant.io)
2. Create a cluster
3. Get connection details

```bash
QDRANT_URL=https://your-cluster.qdrant.cloud
QDRANT_API_KEY=your-api-key
```

#### Option 2: Self-Hosted Qdrant

```bash
# Using Docker
docker run -p 6333:6333 qdrant/qdrant

# Configuration
QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY not needed for local development
```

### Solana Configuration

1. **Set up Multisig Wallet**:
   ```bash
   # Using Solana CLI
   solana-keygen new -o multisig-keypair.json
   solana program create-multisig --multisig-keypair multisig-keypair.json
   ```

2. **Configure SVMAI Token**:
   ```bash
   SVMAI_TOKEN_MINT=YourSVMAITokenMintAddress
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
   ```

## 🏗️ Production Deployment

### Docker Deployment

1. **Create Dockerfile**:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

2. **Build and Run**:

```bash
docker build -t opensvm-anthropic-proxy .
docker run -p 3000:3000 --env-file .env.production opensvm-anthropic-proxy
```

### Docker Compose

```yaml
version: '3.8'

services:
  proxy:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - qdrant
      - redis
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage
    restart: unless-stopped

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  qdrant_data:
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: anthropic-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: anthropic-proxy
  template:
    metadata:
      labels:
        app: anthropic-proxy
    spec:
      containers:
      - name: proxy
        image: opensvm/anthropic-proxy:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: proxy-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: anthropic-proxy-service
spec:
  selector:
    app: anthropic-proxy
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## 🔒 Security Hardening

### 1. API Key Security

```bash
# Use strong API key format validation
API_KEY_STRICT_FORMAT=true
API_KEY_MIN_LENGTH=64

# Rotate keys regularly
# Set up key rotation schedule
```

### 2. Network Security

```bash
# Restrict CORS origins
CORS_ORIGINS=https://opensvm.com,https://app.opensvm.com

# Enable IP whitelisting if needed
IP_WHITELIST=192.168.1.0/24,10.0.0.0/8

# Set request size limits
MAX_REQUEST_SIZE=10485760
```

### 3. Rate Limiting

```bash
# Conservative production limits
GLOBAL_REQUESTS_PER_MINUTE=1000
USER_REQUESTS_PER_MINUTE=60
API_KEY_REQUESTS_PER_MINUTE=30
```

## 📊 Monitoring Setup

### 1. Enable Monitoring

```bash
MONITORING_ENABLED=true
LOG_LEVEL=info
ALERTS_ENABLED=true
```

### 2. Configure Alerts

```bash
ERROR_RATE_THRESHOLD=5
RESPONSE_TIME_THRESHOLD=3000
MEMORY_THRESHOLD=80
NOTIFICATION_CHANNELS=console,email,slack
```

### 3. Health Checks

The proxy exposes health check endpoints:

- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed system metrics
- `GET /api/opensvm/anthropic-keys/stats` - OpenRouter key statistics (admin only)

## 🔧 Maintenance

### Database Maintenance

```bash
# Clean up old metrics (run weekly)
npm run cleanup:metrics

# Backup Qdrant data
npm run backup:qdrant

# Optimize collections
npm run optimize:qdrant
```

### Log Management

```bash
# Rotate logs
npm run rotate:logs

# Clean old logs
npm run clean:logs --days=30
```

### Performance Monitoring

```bash
# Check memory usage
npm run monitor:memory

# Check response times
npm run monitor:performance

# Check error rates
npm run monitor:errors
```

## 🚨 Troubleshooting

### Common Issues

#### 1. OpenRouter Rate Limits

**Symptoms**: 429 errors, slow responses
**Solution**: 
- Add more OpenRouter API keys
- Increase `OPENROUTER_RATE_LIMIT_BUFFER`
- Check key rotation logs

#### 2. Qdrant Connection Issues

**Symptoms**: Database errors, failed writes
**Solution**:
- Check `QDRANT_URL` and `QDRANT_API_KEY`
- Verify network connectivity
- Check Qdrant service status

#### 3. High Memory Usage

**Symptoms**: Out of memory errors
**Solution**:
- Reduce `METRICS_BUFFER_SIZE`
- Decrease `METRICS_RETENTION_DAYS`
- Add more memory to deployment

#### 4. Solana RPC Issues

**Symptoms**: Deposit monitoring failures
**Solution**:
- Switch to different RPC provider
- Increase `SOLANA_MAX_RETRIES`
- Check RPC endpoint status

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
LOG_SENSITIVE_DATA=true  # Development only!
```

### Performance Tuning

```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=2048"

# Optimize metrics
METRICS_FLUSH_INTERVAL=60000  # Flush more frequently
METRICS_BUFFER_SIZE=500       # Smaller buffer

# Connection pooling
DATABASE_POOL_SIZE=20
```

## 📈 Scaling

### Horizontal Scaling

1. **Load Balancer**: Use nginx or cloud load balancer
2. **Multiple Instances**: Run 3+ proxy instances
3. **Shared State**: Use Redis for rate limiting
4. **Database**: Use Qdrant cluster

### Vertical Scaling

1. **CPU**: 2+ cores recommended
2. **Memory**: 4GB+ for high traffic
3. **Storage**: SSD for better performance

## 🔄 Updates

### Rolling Updates

```bash
# Build new image
docker build -t opensvm-anthropic-proxy:v2.0.0 .

# Update deployment
kubectl set image deployment/anthropic-proxy proxy=opensvm-anthropic-proxy:v2.0.0

# Monitor rollout
kubectl rollout status deployment/anthropic-proxy
```

### Configuration Updates

```bash
# Update config maps
kubectl create configmap proxy-config --from-env-file=.env.production --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up changes
kubectl rollout restart deployment/anthropic-proxy
```

## 📞 Support

For deployment support:

1. **Documentation**: Check the `/docs` directory
2. **Issues**: Create GitHub issue with deployment details
3. **Logs**: Include relevant log snippets
4. **Configuration**: Sanitize and include config (remove secrets!)

## 🔗 Related Documentation

- [API Documentation](./API.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Security Guide](./SECURITY.md)
- [OpenRouter Setup](./openrouter-setup.md)
- [Multi-Key Example](./multi-key-example.md) 