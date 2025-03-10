# OpenSVM - Solana Virtual Machine Explorer

OpenSVM is a comprehensive blockchain explorer for the Solana ecosystem, providing detailed insights into transactions, blocks, accounts, programs, and tokens on the Solana blockchain.

## Overview

OpenSVM offers a modern, user-friendly interface for exploring the Solana blockchain with advanced features like transaction visualization, wallet path finding, and AI-powered analysis. The project aims to make blockchain data more accessible and understandable for developers, users, and researchers.

## Key Features

- **Blockchain Data Browsing**: Explore blocks, transactions, accounts, programs, and tokens
- **Transaction Visualization**: Interactive visualizations of transaction flows and relationships
- **Wallet Path Finding**: Discover connections between wallets through token transfers
- **AI Assistant**: Get natural language explanations of blockchain data and transactions
- **Network Statistics**: Monitor Solana network performance and health metrics
- **Token Analytics**: Track token transfers, balances, and activities

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Blockchain Integration**: Solana Web3.js, SPL Token
- **Data Visualization**: D3.js, Cytoscape, Three.js, Chart.js
- **AI Components**: LLM integration via Together AI
- **State Management**: XState for complex workflows
- **Vector Database**: Qdrant for similarity search

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Environment variables (see `.example.env`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/opensvm.git
cd opensvm

# Install dependencies
npm install
# or
bun install

# Set up environment variables
cp .example.env .env.local
# Edit .env.local with your configuration

# Start the development server
npm run dev
# or
bun run dev
```

### Building for Production

```bash
npm run build
npm run start
# or
bun run build
bun run start
```

## Documentation

For more detailed documentation, see:

- [Architecture](./docs/ARCHITECTURE.md) - System architecture and components
- [Features](./docs/FEATURES.md) - Detailed feature descriptions
- [API Reference](./docs/API.md) - API endpoints and usage
- [Development Guide](./docs/DEVELOPMENT.md) - Development setup and guidelines

## License

[MIT License](LICENSE)