# OpenSVM Development Guide

This document provides guidelines and instructions for developers working on the OpenSVM project.

## Development Environment Setup

### Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Bun**: Latest version recommended for faster builds
- **Git**: For version control
- **IDE**: Visual Studio Code with recommended extensions (see `.vscode/extensions.json`)

### Getting Started

1. **Clone the repository**

```bash
git clone https://github.com/your-org/opensvm.git
cd opensvm
```

2. **Install dependencies**

```bash
# Using npm
npm install

# Using Bun (recommended)
bun install
```

3. **Set up environment variables**

```bash
cp .example.env .env.local
```

Edit `.env.local` with your configuration:

```
# Solana RPC endpoints
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
SOLANA_RPC_ENDPOINT_FALLBACK=https://solana-mainnet.g.alchemy.com/v2/your-api-key

# AI services
TOGETHER_API_KEY=your-together-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional services
FLIPSIDE_API_KEY=your-flipside-api-key
```

4. **Start the development server**

```bash
# Using npm
npm run dev

# Using Bun
bun run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
opensvm/
├── app/                  # Next.js app directory (pages and routes)
│   ├── api/              # API routes
│   ├── blocks/           # Block explorer pages
│   ├── tx/               # Transaction explorer pages
│   ├── account/          # Account explorer pages
│   ├── program/          # Program explorer pages
│   ├── token/            # Token explorer pages
│   └── wallet-path-finding/ # Wallet path finding feature
├── components/           # React components
│   ├── ui/               # UI components
│   ├── ai/               # AI-related components
│   └── transaction-graph/ # Transaction visualization components
├── lib/                  # Core libraries and utilities
│   ├── ai/               # AI functionality
│   ├── solana.ts         # Solana interaction utilities
│   └── transaction-parser.ts # Transaction parsing utilities
├── public/               # Static assets
├── server/               # Server-side code
├── styles/               # Global styles
├── types/                # TypeScript type definitions
└── utils/                # Utility functions
```

## Development Workflow

### Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature branches
- `fix/*`: Bug fix branches

### Commit Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Changes to the build process or auxiliary tools

### Pull Request Process

1. Create a feature or fix branch from `develop`
2. Implement your changes with appropriate tests
3. Ensure all tests pass
4. Submit a pull request to `develop`
5. Address review comments
6. Once approved, your PR will be merged

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific tests
npm test -- -t "test name"

# Run e2e tests
npm run test:e2e
```

### Test Structure

- Unit tests: Located alongside the code they test with `.test.ts` suffix
- E2E tests: Located in the `e2e/` directory

## Building for Production

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

## Performance Optimization

### Rendering Strategies

- Use server components for data-fetching and database operations
- Use client components for interactive UI elements
- Implement proper suspense boundaries for loading states

### Data Fetching

- Use incremental static regeneration (ISR) for semi-static data
- Implement proper caching strategies for RPC calls
- Use pagination for large datasets

### Bundle Optimization

- Keep client-side bundles small
- Lazy load components when appropriate
- Use dynamic imports for code splitting

## Solana Integration

### RPC Connection

The application uses a connection pool to manage Solana RPC connections:

```typescript
import { getConnection } from '@/lib/solana-connection';

// Get a connection from the pool
const connection = await getConnection();

// Use the connection
const blockInfo = await connection.getBlock(slot);
```

### Transaction Parsing

Use the transaction parser for detailed transaction analysis:

```typescript
import { parseTransaction } from '@/lib/transaction-parser';

// Parse a transaction
const parsedTx = await parseTransaction(signature);
```

## AI Integration

### Using the AI Agent

```typescript
import { SolanaAgent } from '@/lib/ai/core/agent';
import { createAgentConfig } from '@/lib/ai/core/factory';

// Create agent config
const config = createAgentConfig();

// Initialize agent
const agent = new SolanaAgent(config);

// Process a message
const response = await agent.processMessage({
  role: 'user',
  content: 'Explain this transaction: sig123...'
});
```

## Common Issues and Solutions

### RPC Rate Limiting

If you encounter RPC rate limiting:

1. Use multiple RPC endpoints
2. Implement exponential backoff for retries
3. Cache frequently accessed data

### Build Errors

If you encounter build errors:

1. Clear the Next.js cache: `rm -rf .next`
2. Reinstall dependencies: `bun install --force`
3. Use the fixed build script: `bun run build:fixed`

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [XState Documentation](https://xstate.js.org/docs/)