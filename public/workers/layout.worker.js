// Layout computation Web Worker
// This runs heavy layout calculations off the main thread

self.addEventListener('message', function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'COMPUTE_DAGRE_LAYOUT':
      computeDagreLayout(data);
      break;
    case 'COMPUTE_FORCE_LAYOUT':
      computeForceLayout(data);
      break;
    case 'COMPUTE_GRID_LAYOUT':
      computeGridLayout(data);
      break;
    case 'OPTIMIZE_NODE_POSITIONS':
      optimizeNodePositions(data);
      break;
    default:
      self.postMessage({ type: 'ERROR', error: 'Unknown message type' });
  }
});

// Dagre layout computation
function computeDagreLayout(data) {
  const { nodes, edges, options } = data;
  
  try {
    // Simplified dagre algorithm implementation for web worker
    const graph = buildGraph(nodes, edges);
    const layers = assignLayers(graph, options.rankDir || 'TB');
    const positions = assignPositions(layers, options);
    
    self.postMessage({
      type: 'LAYOUT_COMPUTED',
      algorithm: 'dagre',
      positions: positions,
      metadata: {
        layers: layers.length,
        totalNodes: nodes.length,
        computeTime: performance.now() - data.startTime
      }
    });
  } catch (error) {
    self.postMessage({
      type: 'LAYOUT_ERROR',
      error: error.message,
      algorithm: 'dagre'
    });
  }
}

// Force-directed layout computation
function computeForceLayout(data) {
  const { nodes, edges, options } = data;
  
  try {
    const positions = new Map();
    const velocities = new Map();
    
    // Initialize positions and velocities
    nodes.forEach(node => {
      positions.set(node.id, {
        x: node.position?.x || Math.random() * 1000,
        y: node.position?.y || Math.random() * 1000
      });
      velocities.set(node.id, { x: 0, y: 0 });
    });
    
    const iterations = options.iterations || 100;
    const repulsionStrength = options.repulsionStrength || 1000;
    const attractionStrength = options.attractionStrength || 0.1;
    const damping = options.damping || 0.9;
    
    // Run simulation
    for (let i = 0; i < iterations; i++) {
      // Calculate repulsion forces
      nodes.forEach(nodeA => {
        const posA = positions.get(nodeA.id);
        const velA = velocities.get(nodeA.id);
        
        nodes.forEach(nodeB => {
          if (nodeA.id === nodeB.id) return;
          
          const posB = positions.get(nodeB.id);
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          const force = repulsionStrength / (distance * distance);
          velA.x += (dx / distance) * force;
          velA.y += (dy / distance) * force;
        });
      });
      
      // Calculate attraction forces for edges
      edges.forEach(edge => {
        const posSource = positions.get(edge.source);
        const posTarget = positions.get(edge.target);
        const velSource = velocities.get(edge.source);
        const velTarget = velocities.get(edge.target);
        
        if (!posSource || !posTarget || !velSource || !velTarget) return;
        
        const dx = posTarget.x - posSource.x;
        const dy = posTarget.y - posSource.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        
        const force = attractionStrength * distance;
        
        velSource.x += (dx / distance) * force;
        velSource.y += (dy / distance) * force;
        velTarget.x -= (dx / distance) * force;
        velTarget.y -= (dy / distance) * force;
      });
      
      // Update positions and apply damping
      nodes.forEach(node => {
        const pos = positions.get(node.id);
        const vel = velocities.get(node.id);
        
        pos.x += vel.x;
        pos.y += vel.y;
        
        vel.x *= damping;
        vel.y *= damping;
      });
      
      // Send progress updates every 10 iterations
      if (i % 10 === 0) {
        self.postMessage({
          type: 'LAYOUT_PROGRESS',
          progress: (i / iterations) * 100,
          algorithm: 'force'
        });
      }
    }
    
    // Convert positions map to object
    const finalPositions = {};
    nodes.forEach(node => {
      finalPositions[node.id] = positions.get(node.id);
    });
    
    self.postMessage({
      type: 'LAYOUT_COMPUTED',
      algorithm: 'force',
      positions: finalPositions,
      metadata: {
        iterations: iterations,
        totalNodes: nodes.length,
        computeTime: performance.now() - data.startTime
      }
    });
  } catch (error) {
    self.postMessage({
      type: 'LAYOUT_ERROR',
      error: error.message,
      algorithm: 'force'
    });
  }
}

// Grid layout computation
function computeGridLayout(data) {
  const { nodes, options } = data;
  
  try {
    const cols = options.cols || Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    const spacingX = options.spacingX || 200;
    const spacingY = options.spacingY || 200;
    const offsetX = options.offsetX || 0;
    const offsetY = options.offsetY || 0;
    
    const positions = {};
    
    nodes.forEach((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      positions[node.id] = {
        x: offsetX + col * spacingX,
        y: offsetY + row * spacingY
      };
    });
    
    self.postMessage({
      type: 'LAYOUT_COMPUTED',
      algorithm: 'grid',
      positions: positions,
      metadata: {
        rows: rows,
        cols: cols,
        totalNodes: nodes.length,
        computeTime: performance.now() - data.startTime
      }
    });
  } catch (error) {
    self.postMessage({
      type: 'LAYOUT_ERROR',
      error: error.message,
      algorithm: 'grid'
    });
  }
}

// Optimize existing node positions to reduce edge crossings
function optimizeNodePositions(data) {
  const { nodes, edges, options } = data;
  
  try {
    const positions = {};
    const iterations = options.iterations || 50;
    
    // Initialize with current positions
    nodes.forEach(node => {
      positions[node.id] = {
        x: node.position?.x || 0,
        y: node.position?.y || 0
      };
    });
    
    // Optimization loop
    for (let i = 0; i < iterations; i++) {
      let totalImprovement = 0;
      
      nodes.forEach(node => {
        const currentPos = positions[node.id];
        const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
        
        if (connectedEdges.length === 0) return;
        
        // Calculate ideal position based on connected nodes
        let idealX = 0;
        let idealY = 0;
        let connectionCount = 0;
        
        connectedEdges.forEach(edge => {
          const otherNodeId = edge.source === node.id ? edge.target : edge.source;
          const otherPos = positions[otherNodeId];
          
          if (otherPos) {
            idealX += otherPos.x;
            idealY += otherPos.y;
            connectionCount++;
          }
        });
        
        if (connectionCount > 0) {
          idealX /= connectionCount;
          idealY /= connectionCount;
          
          // Move towards ideal position gradually
          const moveX = (idealX - currentPos.x) * 0.1;
          const moveY = (idealY - currentPos.y) * 0.1;
          
          positions[node.id].x += moveX;
          positions[node.id].y += moveY;
          
          totalImprovement += Math.abs(moveX) + Math.abs(moveY);
        }
      });
      
      // Send progress
      if (i % 5 === 0) {
        self.postMessage({
          type: 'OPTIMIZATION_PROGRESS',
          progress: (i / iterations) * 100,
          improvement: totalImprovement
        });
      }
      
      // Early termination if converged
      if (totalImprovement < 1) {
        break;
      }
    }
    
    self.postMessage({
      type: 'LAYOUT_COMPUTED',
      algorithm: 'optimization',
      positions: positions,
      metadata: {
        iterations: iterations,
        totalNodes: nodes.length,
        computeTime: performance.now() - data.startTime
      }
    });
  } catch (error) {
    self.postMessage({
      type: 'LAYOUT_ERROR',
      error: error.message,
      algorithm: 'optimization'
    });
  }
}

// Helper functions for dagre algorithm
function buildGraph(nodes, edges) {
  const graph = new Map();
  
  nodes.forEach(node => {
    graph.set(node.id, {
      id: node.id,
      data: node.data,
      incoming: [],
      outgoing: []
    });
  });
  
  edges.forEach(edge => {
    const sourceNode = graph.get(edge.source);
    const targetNode = graph.get(edge.target);
    
    if (sourceNode && targetNode) {
      sourceNode.outgoing.push(edge.target);
      targetNode.incoming.push(edge.source);
    }
  });
  
  return graph;
}

function assignLayers(graph, rankDir) {
  const layers = [];
  const visited = new Set();
  const nodeToLayer = new Map();
  
  // Find root nodes (no incoming edges for TB, no outgoing for BT)
  const rootNodes = [];
  graph.forEach((node, id) => {
    if (rankDir === 'TB' && node.incoming.length === 0) {
      rootNodes.push(id);
    } else if (rankDir === 'BT' && node.outgoing.length === 0) {
      rootNodes.push(id);
    }
  });
  
  // If no root nodes, pick arbitrary starting points
  if (rootNodes.length === 0) {
    graph.forEach((node, id) => {
      if (rootNodes.length < 3) { // Limit to avoid too many roots
        rootNodes.push(id);
      }
    });
  }
  
  // BFS to assign layers
  let currentLayer = 0;
  let queue = [...rootNodes];
  
  while (queue.length > 0) {
    const nextQueue = [];
    const currentLayerNodes = [];
    
    queue.forEach(nodeId => {
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        currentLayerNodes.push(nodeId);
        nodeToLayer.set(nodeId, currentLayer);
        
        const node = graph.get(nodeId);
        if (node) {
          const neighbors = rankDir === 'TB' ? node.outgoing : node.incoming;
          neighbors.forEach(neighborId => {
            if (!visited.has(neighborId)) {
              nextQueue.push(neighborId);
            }
          });
        }
      }
    });
    
    if (currentLayerNodes.length > 0) {
      layers.push(currentLayerNodes);
    }
    
    queue = [...new Set(nextQueue)]; // Remove duplicates
    currentLayer++;
    
    // Prevent infinite loops
    if (currentLayer > graph.size) {
      break;
    }
  }
  
  // Add any remaining unvisited nodes
  graph.forEach((node, id) => {
    if (!visited.has(id)) {
      layers.push([id]);
      nodeToLayer.set(id, layers.length - 1);
    }
  });
  
  return layers;
}

function assignPositions(layers, options) {
  const positions = {};
  const rankSep = options.rankSep || 150;
  const nodeSep = options.nodeSep || 100;
  const rankDir = options.rankDir || 'TB';
  
  layers.forEach((layer, layerIndex) => {
    const layerWidth = layer.length * nodeSep;
    const startX = -layerWidth / 2;
    
    layer.forEach((nodeId, nodeIndex) => {
      let x, y;
      
      if (rankDir === 'TB' || rankDir === 'BT') {
        x = startX + nodeIndex * nodeSep;
        y = layerIndex * rankSep;
        if (rankDir === 'BT') {
          y = -y;
        }
      } else { // LR or RL
        x = layerIndex * rankSep;
        y = startX + nodeIndex * nodeSep;
        if (rankDir === 'RL') {
          x = -x;
        }
      }
      
      positions[nodeId] = { x, y };
    });
  });
  
  return positions;
}

// Error handling
self.addEventListener('error', function(error) {
  self.postMessage({
    type: 'WORKER_ERROR',
    error: error.message,
    filename: error.filename,
    lineno: error.lineno
  });
});