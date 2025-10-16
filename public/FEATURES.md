# OpenSVM Features

This document provides detailed information about the key features of the OpenSVM explorer.

## Blockchain Data Browsing

### Block Explorer

The block explorer allows users to view detailed information about blocks on the Solana blockchain.

**Features:**
- View block details including slot number, blockhash, parent slot, and timestamp
- See transaction counts, success/failure rates, and fees
- Explore rewards distributed to validators
- Analyze program invocations within the block
- Track token transfers within the block

**Usage:**
- Navigate to `/block/[slot]` to view details for a specific block
- Use the home page to see recent blocks

### Transaction Explorer

The transaction explorer provides detailed information about individual transactions.

**Features:**
- View transaction signatures, status, and timestamps
- See account balances before and after the transaction
- Analyze instruction data and program invocations
- Visualize transaction flow with interactive graphs
- Get AI-powered explanations of transaction purposes

**Usage:**
- Navigate to `/tx/[signature]` to view details for a specific transaction
- Click on transaction signatures from block views or search results

### Account Explorer

The account explorer shows information about Solana accounts.

**Features:**
- View account balances, owners, and executable status
- See token holdings and NFT collections
- Track transaction history for the account
- Analyze token transfers to and from the account
- View program invocations if the account is a program

**Usage:**
- Navigate to `/account/[address]` to view details for a specific account
- Click on account addresses from transaction views or search results

### Program Explorer

The program explorer provides insights into Solana programs (smart contracts).

**Features:**
- View program metadata and deployment information
- See accounts owned by the program
- Analyze recent invocations of the program
- Track usage statistics and popularity trends

**Usage:**
- Navigate to `/program/[address]` to view details for a specific program
- Click on program addresses from transaction views or search results

### Token Explorer

The token explorer shows information about tokens on Solana.

**Features:**
- View token metadata, supply, and decimals
- See holder statistics and distribution
- Track transfer volume and activity
- Analyze price data (if available)
- View related transactions

**Usage:**
- Navigate to `/token/[address]` to view details for a specific token
- Click on token addresses from transaction views or search results

## Advanced Features

### Transaction Visualization

The transaction visualization feature provides interactive graphical representations of transactions.

**Features:**
- Node-based graph visualization of transaction flow
- Account relationship mapping
- Program invocation hierarchy
- Token transfer visualization
- Interactive zooming and panning

**Usage:**
- Available on transaction detail pages
- Toggle between different visualization modes

### Wallet Path Finding

The wallet path finding feature discovers connections between wallets through token transfers.

**Features:**
- Find paths between any two Solana wallet addresses
- Visualize the connection graph
- See intermediate wallets in the path
- Track the specific transactions that connect wallets
- Configurable search depth

**Usage:**
- Navigate to `/wallet-path-finding`
- Enter source and target wallet addresses
- View the discovered path and related transactions

### AI Assistant

The AI assistant provides natural language interaction with blockchain data and real-time security monitoring.

**Features:**
- Ask questions about transactions, blocks, accounts, and tokens
- Get explanations of complex blockchain operations
- Request analysis of transaction patterns
- Receive guidance on using the explorer
- Interactive chat interface
- AI-driven anomaly detection and security alerts
- Real-time blockchain threat monitoring

**Usage:**
- Click the AI Assistant button on any page
- Type natural language questions or requests
- Receive AI-generated responses with relevant blockchain data
- Monitor security alerts and anomaly notifications

### Real-Time Monitoring

The real-time monitoring system provides live blockchain event streaming with AI-powered anomaly detection.

**Features:**
- Live blockchain event streaming (transactions, blocks, account changes)
- AI-driven anomaly detection for suspicious activities
- Real-time security alerts and notifications
- Customizable detection patterns and thresholds
- Historical anomaly statistics and reporting
- Interactive monitoring dashboard

**Usage:**
- Navigate to `/monitoring` to access the live monitoring dashboard
- View real-time events as they occur on the Solana blockchain
- Monitor anomaly alerts for potential security issues
- Configure detection sensitivity and alert preferences
- Export anomaly reports for further analysis

**Anomaly Types Detected:**
- High transaction failure rates
- Suspicious fee spikes
- Rapid transaction bursts from single addresses
- Unusual program activity patterns
- Network performance degradation

### Network Statistics

The network statistics feature provides insights into Solana network performance.

**Features:**
- Real-time TPS (Transactions Per Second) monitoring
- Validator activity tracking
- Success rate analysis
- Block time monitoring
- Historical performance trends

**Usage:**
- Available on the home page
- Dedicated network statistics sections on various pages

## Search Functionality

The search functionality allows users to find blockchain data quickly.

**Features:**
- Search by transaction signature
- Search by account address
- Search by block slot or hash
- Search by program ID
- Search by token address or symbol

**Usage:**
- Use the search bar in the header
- Enter a query and select from suggested results
- View detailed search results page

## UI Features

### Theme Switching

The theme switching feature allows users to customize the appearance of the explorer.

**Features:**
- Light and dark mode support
- System preference detection
- Persistent theme selection

**Usage:**
- Click the theme toggle in the header
- Select preferred theme

### Responsive Design

The responsive design ensures the explorer works well on all devices.

**Features:**
- Mobile-friendly layouts
- Adaptive components
- Touch-optimized interactions
- Responsive data tables and visualizations

**Usage:**
- Access the explorer from any device
- Experience optimized layouts based on screen size