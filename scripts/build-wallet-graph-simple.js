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

const MAX_DEPTH = 2; // Only go 2 levels deep

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
  if (transfer.programId && DEFI_PROGRAMS.has(transfer.programId)) {
    return true;
  }
  if (DEFI_PROGRAMS.has(transfer.from) || DEFI_PROGRAMS.has(transfer.to)) {
    return true;
  }
  return false;
}

function addNode(address) {
  if (!graph.nodes.has(address)) {
    graph.nodes.set(address, {
      id: address,
      label: address.substring(0, 8) + '...',
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

async function buildGraph() {
  console.log('🚀 Building SVMAI Wallet Network Graph...\n');
  console.log(`Start Address: ${START_ADDRESS}`);
  console.log(`Max Depth: ${MAX_DEPTH} levels`);
  console.log(`Excluding DeFi Programs: ${DEFI_PROGRAMS.size} protocols\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const toProcess = [{ address: START_ADDRESS, depth: 0 }];
  const visited = new Set();
  
  while (toProcess.length > 0) {
    const { address, depth } = toProcess.shift();
    
    if (visited.has(address) || depth > MAX_DEPTH) {
      continue;
    }
    
    visited.add(address);
    console.log(`[${visited.size}] Processing: ${address.substring(0, 12)}... (depth: ${depth})`);
    
    const transfers = await fetchTransfers(address);
    let directTransfers = 0;
    
    for (const transfer of transfers) {
      if (isDeFiAddress(transfer)) {
        continue;
      }
      
      directTransfers++;
      addNode(transfer.from);
      addNode(transfer.to);
      addEdge(transfer.from, transfer.to, transfer.tokenAmount, transfer.date, transfer.txId);
      
      // Add connected address to queue if within depth limit
      const connected = transfer.from === address ? transfer.to : transfer.from;
      if (!visited.has(connected) && depth < MAX_DEPTH) {
        toProcess.push({ address: connected, depth: depth + 1 });
      }
    }
    
    console.log(`  ✓ Added ${directTransfers} direct wallet transfers\n`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ Processed ${visited.size} addresses\n`);
}

function visualizeGraph() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║              SVMAI WALLET NETWORK GRAPH                               ║');
  console.log('║              (Direct Transfers Only, No DeFi)                         ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📊 Graph Statistics:\n`);
  console.log(`   Total Nodes: ${graph.nodes.size}`);
  console.log(`   Total Edges: ${graph.edges.length}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const nodeArray = Array.from(graph.nodes.values());
  nodeArray.sort((a, b) => (b.totalIn + b.totalOut) - (a.totalIn + a.totalOut));
  
  console.log('🔝 TOP WALLET NODES (by volume):\n');
  
  const top15 = nodeArray.slice(0, 15);
  for (let i = 0; i < top15.length; i++) {
    const node = top15[i];
    const prefix = node.id === START_ADDRESS ? '🎯 ' : `${i + 1}. `;
    const shortAddr = node.id.substring(0, 8) + '...' + node.id.substring(node.id.length - 4);
    console.log(`${prefix}${shortAddr}`);
    console.log(`   In:  ${node.transfers.in.length} transfers, ${node.totalIn.toFixed(2)} SVMAI`);
    console.log(`   Out: ${node.transfers.out.length} transfers, ${node.totalOut.toFixed(2)} SVMAI`);
    console.log(`   Net: ${(node.totalIn - node.totalOut).toFixed(2)} SVMAI\n`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('🔗 DIRECT CONNECTIONS FROM TARGET:\n');
  
  const targetNode = graph.nodes.get(START_ADDRESS);
  if (targetNode) {
    console.log(`Incoming (${targetNode.transfers.in.length}):`);
    targetNode.transfers.in.forEach(t => {
      const shortFrom = t.from.substring(0, 8) + '...' + t.from.substring(t.from.length - 4);
      console.log(`  ← ${shortFrom} : ${parseFloat(t.amount).toFixed(2)} SVMAI (${t.date.substring(0, 10)})`);
    });
    
    if (targetNode.transfers.out.length > 0) {
      console.log(`\nOutgoing (${targetNode.transfers.out.length}):`);
      targetNode.transfers.out.forEach(t => {
        const shortTo = t.to.substring(0, 8) + '...' + t.to.substring(t.to.length - 4);
        console.log(`  → ${shortTo} : ${parseFloat(t.amount).toFixed(2)} SVMAI (${t.date.substring(0, 10)})`);
      });
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const sortedEdges = [...graph.edges].sort((a, b) => b.amount - a.amount);
  console.log('💰 LARGEST DIRECT TRANSFERS (Top 10):\n');
  
  for (let i = 0; i < Math.min(10, sortedEdges.length); i++) {
    const edge = sortedEdges[i];
    const shortFrom = edge.from.substring(0, 8) + '...';
    const shortTo = edge.to.substring(0, 8) + '...';
    console.log(`${i + 1}. ${edge.amount.toFixed(2)} SVMAI`);
    console.log(`   ${shortFrom} → ${shortTo}`);
    console.log(`   Date: ${edge.date.substring(0, 10)}\n`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Network structure visualization
  console.log('📈 NETWORK STRUCTURE:\n');
  
  const targetConnections = [];
  for (const edge of graph.edges) {
    if (edge.to === START_ADDRESS) {
      targetConnections.push({ type: 'IN', from: edge.from, amount: edge.amount });
    } else if (edge.from === START_ADDRESS) {
      targetConnections.push({ type: 'OUT', to: edge.to, amount: edge.amount });
    }
  }
  
  const incomingTotal = targetConnections.filter(c => c.type === 'IN').reduce((sum, c) => sum + c.amount, 0);
  const outgoingTotal = targetConnections.filter(c => c.type === 'OUT').reduce((sum, c) => sum + c.amount, 0);
  
  console.log('Target Address (🎯):');
  console.log(`${START_ADDRESS}\n`);
  
  const incoming = targetConnections.filter(c => c.type === 'IN');
  if (incoming.length > 0) {
    console.log(`Incoming: ${incoming.length} addresses → ${incomingTotal.toFixed(2)} SVMAI`);
    incoming.forEach(c => {
      const short = c.from.substring(0, 8) + '...' + c.from.substring(c.from.length - 4);
      console.log(`  ${short} → [${c.amount.toFixed(2)}]`);
    });
  }
  
  const outgoing = targetConnections.filter(c => c.type === 'OUT');
  if (outgoing.length > 0) {
    console.log(`\nOutgoing: ${outgoing.length} addresses ← ${outgoingTotal.toFixed(2)} SVMAI`);
    outgoing.forEach(c => {
      const short = c.to.substring(0, 8) + '...' + c.to.substring(c.to.length - 4);
      console.log(`  [${c.amount.toFixed(2)}] → ${short}`);
    });
  }
}

function exportData() {
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
  
  require('fs').writeFileSync('svmai-wallet-graph.json', JSON.stringify(graphData, null, 2));
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ Graph data exported to: svmai-wallet-graph.json\n');
}

async function main() {
  try {
    await buildGraph();
    visualizeGraph();
    exportData();
    console.log('✨ Analysis complete!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
