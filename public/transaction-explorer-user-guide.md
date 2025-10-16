# Transaction Explorer User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Transaction Overview](#transaction-overview)
4. [Instruction Analysis](#instruction-analysis)
5. [Account Changes](#account-changes)
6. [AI-Powered Analysis](#ai-powered-analysis)
7. [Related Transactions](#related-transactions)
8. [Transaction Graph](#transaction-graph)
9. [Performance Metrics](#performance-metrics)
10. [Help System](#help-system)
11. [Troubleshooting](#troubleshooting)
12. [Advanced Features](#advanced-features)

## Introduction

The Enhanced Transaction Explorer provides comprehensive analysis tools for understanding Solana blockchain transactions. Whether you're a developer debugging smart contracts, a trader analyzing DeFi operations, or a researcher studying blockchain patterns, this guide will help you make the most of the available features.

### Key Features

- **Detailed Instruction Parsing**: Human-readable explanations of transaction instructions
- **Account Change Analysis**: Before/after state comparisons for all affected accounts
- **AI-Powered Explanations**: Natural language descriptions of transaction purposes and risks
- **Related Transaction Discovery**: Find connected transactions through various relationship types
- **Interactive Graph Visualization**: Visual representation of transaction flows and account relationships
- **Performance Metrics**: Detailed analysis of fees, compute usage, and efficiency
- **Contextual Help System**: Built-in documentation and guided tours

## Getting Started

### Accessing the Transaction Explorer

1. Navigate to any transaction page using a transaction signature
2. The URL format is: `/tx/[transaction-signature]`
3. You can also search for transactions from the main search bar

### First-Time User Tour

When you first visit the Transaction Explorer, you'll be offered an interactive tour that covers:

- Basic transaction information
- How to read instruction details
- Understanding account changes
- Using AI analysis features
- Navigating the graph visualization

To start the tour manually:
1. Click the help button (?) in the top navigation
2. Select "Interactive Tours" from the help panel
3. Choose "Transaction Explorer Tour"

## Transaction Overview

### Transaction Header

The transaction header displays essential information:

- **Signature**: Unique 88-character identifier for the transaction
- **Status**: Confirmation level (Processed, Confirmed, or Finalized)
- **Slot**: Block number where the transaction was included
- **Block Time**: When the transaction was processed
- **Fee**: Total cost paid for transaction processing

### Status Indicators

- 🟡 **Processed**: Transaction executed but not yet confirmed
- 🔵 **Confirmed**: Transaction has majority cluster confirmation
- 🟢 **Finalized**: Transaction is permanently committed to the blockchain

### Fee Breakdown

The fee section shows:
- **Base Fee**: Fixed cost per signature (~0.000005 SOL)
- **Priority Fee**: Optional fee for faster processing
- **Compute Fee**: Cost based on computational resources used

## Instruction Analysis

### Understanding Instructions

Instructions are the individual operations within a transaction. Each instruction:
- Calls a specific program
- Operates on designated accounts
- Includes parameters for the operation

### Instruction Display

Each instruction shows:

1. **Program Information**
   - Program name (if known) or address
   - Program category (System, Token, DeFi, NFT, etc.)
   - Link to program details

2. **Instruction Type**
   - Human-readable operation name
   - Technical instruction identifier

3. **Risk Assessment**
   - 🟢 Low Risk: Standard, safe operations
   - 🟡 Medium Risk: Requires attention
   - 🔴 High Risk: Potentially dangerous operations

4. **Compute Units**
   - Computational resources consumed
   - Efficiency relative to similar operations

### Expanding Instructions

Click on any instruction to see detailed information:

- **Description**: Plain English explanation of what the instruction does
- **Accounts**: List of all accounts involved with their roles
- **Parameters**: Data passed to the instruction
- **Inner Instructions**: Sub-operations triggered by this instruction
- **Logs**: Program output and debug information

### Account Roles

Common account roles include:
- **Payer**: Account paying transaction fees
- **Source**: Account sending tokens or SOL
- **Destination**: Account receiving tokens or SOL
- **Authority**: Account with permission to perform the operation
- **Program**: The program being invoked

## Account Changes

### Overview

The Account Changes section shows how the transaction affected each account's state, including:
- SOL balance changes
- Token balance modifications
- Account data updates
- Ownership transfers

### Balance Changes

Balance changes are displayed with:
- **Before**: Account balance prior to transaction
- **After**: Account balance after transaction
- **Change**: Net difference (positive = received, negative = sent/paid)

Color coding:
- 🟢 Green: Account received SOL
- 🔴 Red: Account sent SOL or paid fees
- ⚪ Gray: No change

### Token Changes

For SPL token modifications:
- **Token Mint**: The specific token that changed
- **Amount Changes**: Before/after amounts with percentage change
- **Significance**: High/Medium/Low based on amount and operation type

### Risk Assessment

The system analyzes all account changes to identify:
- Large or unusual balance transfers
- Unknown token interactions
- Authority changes
- Account closures
- Suspicious patterns

### Rent Exemption

Accounts must maintain minimum balances to avoid being garbage collected:
- **Rent Exempt**: Account has sufficient balance
- **Not Rent Exempt**: Account may be deleted if balance drops too low

## AI-Powered Analysis

### Transaction Explanation

The AI system provides:
- **Summary**: High-level description of what the transaction accomplishes
- **Main Action**: Primary purpose of the transaction
- **Secondary Effects**: Additional outcomes or side effects
- **Financial Impact**: How the transaction affects token/SOL balances

### Risk Analysis

AI risk assessment includes:
- **Risk Level**: Overall security assessment
- **Risk Factors**: Specific concerns identified
- **Recommendations**: Suggested actions or precautions

### DeFi Analysis

For DeFi transactions, the AI provides:
- Protocol identification
- Yield farming analysis
- Liquidity provision details
- Swap and trading information
- Financial impact calculations

### Limitations

Remember that AI analysis:
- Is provided for educational purposes
- Should not be considered financial advice
- May not catch all risks or nuances
- Should be combined with your own research

## Related Transactions

### Relationship Types

The system finds related transactions through:

1. **Same Accounts**: Transactions involving the same accounts
2. **Same Programs**: Transactions using identical programs
3. **Token Flows**: Following token transfers between accounts
4. **Time Proximity**: Transactions occurring close in time
5. **Authority Chains**: Connected through shared authorities

### Relationship Strength

Relationships are scored from 1-100%:
- **Strong (80-100%)**: Direct relationships, shared critical accounts
- **Medium (40-79%)**: Some shared elements, temporal proximity
- **Weak (1-39%)**: Minimal connections, distant relationships

### Using Related Transactions

Related transactions help you:
- Trace token flows and transaction chains
- Understand multi-step operations
- Identify patterns in account behavior
- Investigate suspicious activity
- Follow complex DeFi operations

## Transaction Graph

### Graph Elements

The interactive graph shows:
- **Nodes**: Accounts, programs, and tokens
- **Edges**: Transfers, instructions, and interactions
- **Colors**: Different types and roles
- **Sizes**: Importance and activity levels

### Node Types

- 🟡 **Transactions**: Square nodes representing transaction operations
- 🔵 **Accounts**: Circular nodes for user accounts
- 🟣 **Programs**: Triangle nodes for smart contracts
- 🟢 **Tokens**: Circular nodes for token mints

### Graph Controls

Available controls:
- **Zoom In/Out**: Adjust detail level
- **Reset View**: Return to default position
- **Play/Pause**: Control animation
- **Filters**: Show/hide node and edge types
- **Search**: Find specific accounts or programs
- **Export**: Save graph as PNG image
- **Fullscreen**: Expand to full window

### Navigation Tips

- **Click and drag** nodes to reposition them
- **Hover** over nodes and edges for quick information
- **Click** nodes for detailed information panels
- **Use mouse wheel** to zoom in and out
- **Click and drag** empty space to pan the view

### Mobile Usage

On mobile devices:
- **Tap** nodes for information
- **Pinch** to zoom in and out
- **Swipe** to pan around the graph
- **Double-tap** to reset view
- Use the control buttons for additional options

## Performance Metrics

### Available Metrics

The metrics section provides:

1. **Fee Analysis**
   - Total fee breakdown
   - Fee per compute unit
   - Priority fee analysis
   - Comparison with similar transactions

2. **Compute Usage**
   - Total compute units consumed
   - Compute units per instruction
   - Efficiency scoring
   - Resource optimization suggestions

3. **Transaction Size**
   - Data size in bytes
   - Number of accounts modified
   - Instruction count
   - Complexity analysis

4. **Efficiency Score**
   - Overall cost-effectiveness rating (0-100)
   - Comparison with network averages
   - Optimization recommendations

### Efficiency Scoring

- **Excellent (90-100)**: Highly optimized, minimal waste
- **Good (70-89)**: Well-optimized, reasonable costs
- **Fair (50-69)**: Some inefficiencies, room for improvement
- **Poor (0-49)**: Inefficient, high costs for work accomplished

### Using Metrics

Performance metrics help you:
- Optimize transaction costs
- Understand resource usage
- Compare different approaches
- Identify inefficient operations
- Plan for network congestion

## Help System

### Contextual Help

Throughout the interface, look for:
- **Help icons (?)**: Hover or click for explanations
- **Dotted underlines**: Technical terms with definitions
- **Info badges**: Additional context and tips

### Help Panel

Access comprehensive help by:
1. Clicking the help button in the navigation
2. Searching for specific topics
3. Browsing by category
4. Starting interactive tours

### Interactive Tours

Available tours:
- **Transaction Explorer Tour**: Complete overview of all features
- **Instruction Analysis Deep Dive**: Advanced instruction analysis
- **Account Changes Analysis**: Understanding state changes

### Technical Tooltips

Hover over technical terms to see:
- Definitions and explanations
- Examples and use cases
- Related concepts
- External documentation links

## Troubleshooting

### Common Issues

#### Transaction Not Found
- Verify the transaction signature is correct
- Check if the transaction is on the correct network
- Ensure the transaction has been processed

#### Slow Loading
- Large transactions may take longer to analyze
- AI analysis requires additional processing time
- Try refreshing the page if loading stalls

#### Missing Information
- Some historical transactions may have limited data
- Unknown programs may not have detailed parsing
- AI analysis may not be available for all transactions

#### Graph Not Displaying
- Ensure JavaScript is enabled
- Try refreshing the page
- Check browser compatibility (modern browsers required)

### Performance Tips

1. **For Large Transactions**
   - Use filters to focus on specific instruction types
   - Collapse unnecessary instruction details
   - Use the graph controls to navigate efficiently

2. **For Slow Connections**
   - Disable auto-refresh features
   - Use the simplified view when available
   - Focus on essential information first

3. **For Mobile Devices**
   - Use portrait orientation for better readability
   - Utilize swipe gestures for navigation
   - Take advantage of touch-optimized controls

### Getting Help

If you encounter issues:
1. Check the troubleshooting section in the help panel
2. Use the search function to find relevant help topics
3. Restart any interactive tours if they become stuck
4. Clear browser cache if experiencing persistent issues

## Advanced Features

### Keyboard Shortcuts

- **Escape**: Close modals and help panels
- **Arrow Keys**: Navigate between elements
- **Enter/Space**: Activate buttons and expand sections
- **Tab**: Move between interactive elements

### URL Parameters

You can customize the view using URL parameters:
- `?tab=instructions`: Open instructions tab by default
- `?tab=changes`: Open account changes tab by default
- `?tab=graph`: Open graph visualization tab by default
- `?help=true`: Open help panel automatically

### Browser Compatibility

Supported browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Accessibility Features

The interface includes:
- Screen reader compatibility
- Keyboard navigation support
- High contrast mode
- Adjustable text sizes
- Focus indicators
- ARIA labels and descriptions

### Data Export

You can export:
- Transaction graphs as PNG images
- Account change summaries
- Instruction details
- Performance metrics

### API Integration

For developers, the transaction explorer uses these API endpoints:
- `/api/transaction/[signature]`: Basic transaction data
- `/api/transaction/[signature]/analysis`: Detailed analysis
- `/api/transaction/[signature]/related`: Related transactions
- `/api/transaction/[signature]/explain`: AI explanations

---

## Conclusion

The Enhanced Transaction Explorer provides powerful tools for understanding Solana transactions. Take advantage of the interactive tours, contextual help, and comprehensive analysis features to gain deeper insights into blockchain operations.

For additional support or feature requests, please refer to the help panel or contact our support team.

**Happy exploring!** 🚀