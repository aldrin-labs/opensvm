#!/usr/bin/env node

const API_BASE = 'http://localhost:3000/api/account-transfers';
const SVMAI_MINT = 'Cpzvdx6pppc9TNArsGsqgShCsKC9NCCjA2gtzHvUpump';
const START_ADDRESS = '5rVDMMoBQs3zJQ9DT7oxsoNZfxptgLCKhuWqdwoX9q85';

// Known DeFi programs to exclude from graph
const DEFI_PROGRAMS = new Set([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', // Pump.fun
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB', // Meteora
  'ComputeBudget111111111111111111111111111111',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpools
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', // Known Jupiter hub
]);

const graph = {
  nodes: new Map(),
  edges: [],
};

const visited = new Set();
const queue = [START_ADDRESS];
let processedCount = 0;
const MAX_DEPTH = 50; // Limit recursive exploration

async function fetchTransfers(address) {
  try {
    const url = `${API_BASE}/${address}?mints=${SVMAI_MINT}&bypassCache=true`;
    const response = await fetch(url);
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`Error fetching ${address}: ${error.message}`);
    return [];
  }
}

function isDeFiAddress(transfer) {
  // Check if programId is a DeFi protocol
  if (transfer.programId && DEFI_PROGRAMS.has(transfer.programId)) {
    return true;
  }
  
  // Check if address itself is in DeFi list
  if (DEFI_PROGRAMS.has(transfer.from) || DEFI_PROGRAMS.has(transfer.to)) {
    return true;
  }
  
  return false;
}

function addNode(address, label = null) {
  if (!graph.nodes.has(address)) {
    graph.nodes.set(address, {
      id: address,
      label: label || address.substring(0, 8) + '...',
      transfers: { in: [], out: [] },
      totalIn: 0,
      totalOut: 0,
    });
  }
}

function addEdge(from, to, amount, date, txId) {
  graph.edges.push({
    from,
    to,
    amount: parseFloat(amount),
    date,
    txId,
  });
  
  // Update node statistics
  const fromNode = graph.nodes.get(from);
  const toNode = graph.nodes.get(to);
  
  if (fromNode) {
    fromNode.transfers.out.push({ to, amount, date });
    fromNode.totalOut += parseFloat(amount);
  }
  
  if (toNode) {
    toNode.transfers.in.push({ from, amount, date });
    toNode.totalIn += parseFloat(amount);
  }
}

async function processAddress(address, depth = 0) {
  if (visited.has(address) || depth > MAX_DEPTH) {
    return;
  }
  
  visited.add(address);
  processedCount++;
  
  console.log(`\n[${processedCount}] Processing: ${address.substring(0, 12)}... (depth: ${depth})`);
  
  const transfers = await fetchTransfers(address);
  console.log(`  Found ${transfers.length} transfers`);
  
  let directWalletTransfers = 0;
  const connectedAddresses = new Set();
  
  for (const transfer of transfers) {
    // Skip DeFi protocol transfers
    if (isDeFiAddress(transfer)) {
      console.log(`  ⊗ Skipping DeFi transfer via ${transfer.programId || 'unknown'}`);
      continue;
    }
    
    directWalletTransfers++;
    
    // Add nodes
    addNode(transfer.from);
    addNode(transfer.to);
    
    // Add edge
    addEdge(transfer.from, transfer.to, transfer.tokenAmount, transfer.date, transfer.txId);
    
    // Queue connected address for processing
    const connectedAddress = transfer.from === address ? transfer.to : transfer.from;
    if (!visited.has(connectedAddress)) {
      connectedAddresses.add(connectedAddress);
    }
  }
  
  console.log(`  ✓ Added ${directWalletTransfers} direct wallet transfers`);
  console.log(`  → ${connectedAddresses.size} new addresses to explore`);
  
  // Process connected addresses
  for (const connectedAddr of connectedAddresses) {
    await processAddress(connectedAddr, depth + 1);
  }
}

function generateVisualization() {
  console.log('\n\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║              SVMAI WALLET NETWORK GRAPH                               ║');
  console.log('║              (Excluding DeFi Protocols)                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📊 Graph Statistics:\n`);
  console.log(`   Total Nodes: ${graph.nodes.size}`);
  console.log(`   Total Edges: ${graph.edges.length}`);
  console.log(`   Addresses Processed: ${processedCount}`);
  console.log(`   Explored Depth: Up to ${MAX_DEPTH} levels\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Sort nodes by total volume
  const nodeArray = Array.from(graph.nodes.values());
  nodeArray.sort((a, b) => (b.totalIn + b.totalOut) - (a.totalIn + a.totalOut));
  
  console.log('🔝 TOP WALLET NODES (by volume):\n');
  
  const top20 = nodeArray.slice(0, 20);
  for (let i = 0; i < top20.length; i++) {
    const node = top20[i];
    const prefix = node.id === START_ADDRESS ? '🎯 ' : `${i + 1}. `;
    console.log(`${prefix}${node.id}`);
    console.log(`   In:  ${node.transfers.in.length} transfers, ${node.totalIn.toFixed(2)} SVMAI`);
    console.log(`   Out: ${node.transfers.out.length} transfers, ${node.totalOut.toFixed(2)} SVMAI`);
    console.log(`   Net: ${(node.totalIn - node.totalOut).toFixed(2)} SVMAI\n`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Find clusters/communities
  console.log('🔗 DIRECT CONNECTIONS FROM TARGET:\n');
  
  const targetNode = graph.nodes.get(START_ADDRESS);
  if (targetNode) {
    console.log(`Incoming connections (${targetNode.transfers.in.length}):`);
    targetNode.transfers.in.forEach(t => {
      console.log(`  ← ${t.from.substring(0, 12)}... : ${parseFloat(t.amount).toFixed(2)} SVMAI (${t.date.substring(0, 10)})`);
    });
    
    console.log(`\nOutgoing connections (${targetNode.transfers.out.length}):`);
    targetNode.transfers.out.forEach(t => {
      console.log(`  → ${t.to.substring(0, 12)}... : ${parseFloat(t.amount).toFixed(2)} SVMAI (${t.date.substring(0, 10)})`);
    });
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Largest transfers
  const sortedEdges = [...graph.edges].sort((a, b) => b.amount - a.amount);
  console.log('💰 LARGEST TRANSFERS (Top 15):\n');
  
  for (let i = 0; i < Math.min(15, sortedEdges.length); i++) {
    const edge = sortedEdges[i];
    console.log(`${i + 1}. ${edge.amount.toFixed(2)} SVMAI`);
    console.log(`   ${edge.from.substring(0, 12)}... → ${edge.to.substring(0, 12)}...`);
    console.log(`   Date: ${edge.date}`);
    console.log(`   Tx: ${edge.txId.substring(0, 20)}...\n`);
  }
}

function exportGraphData() {
  const graphData = {
    metadata: {
      startAddress: START_ADDRESS,
      mint: SVMAI_MINT,
      timestamp: new Date().toISOString(),
      nodeCount: graph.nodes.size,
      edgeCount: graph.edges.length,
      maxDepth: MAX_DEPTH,
    },
    nodes: Array.from(graph.nodes.values()),
    edges: graph.edges,
  };
  
  const fs = require('fs');
  fs.writeFileSync('svmai-wallet-graph.json', JSON.stringify(graphData, null, 2));
  console.log('\n✅ Graph data exported to: svmai-wallet-graph.json\n');
}

async function main() {
  console.log('🚀 Starting SVMAI Wallet Network Analysis...\n');
  console.log(`Start Address: ${START_ADDRESS}`);
  console.log(`Token: SVMAI (${SVMAI_MINT})`);
  console.log(`Excluding DeFi Programs: ${DEFI_PROGRAMS.size} protocols\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    await processAddress(START_ADDRESS, 0);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Graph building complete!\n');
    
    generateVisualization();
    exportGraphData();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ Analysis complete!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

main();
