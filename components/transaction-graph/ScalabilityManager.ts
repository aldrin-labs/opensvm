'use client';

import { MemoryManager } from './MemoryManager';
import { EdgeCaseManager } from './EdgeCaseManager';

// Enhanced interfaces for scalability
export interface ScalabilityMetrics {
  nodeCount: number;
  edgeCount: number;
  renderTime: number;
  memoryUsage: number;
  frameRate: number;
  interactionLatency: number;
  dataStreamingRate: number;
  cacheHitRatio: number;
}

export interface VirtualizationConfig {
  viewportWidth: number;
  viewportHeight: number;
  bufferZone: number; // Extra area around viewport to render
  minZoomForVirtualization: number;
  maxVisibleNodes: number;
  spatialIndexingEnabled: boolean;
  levelOfDetailEnabled: boolean;
}

export interface DataStreamingConfig {
  chunkSize: number;
  maxConcurrentChunks: number;
  prefetchDistance: number; // How far ahead to prefetch
  compressionEnabled: boolean;
  cacheExpiration: number;
}

export interface ServiceWorkerConfig {
  enabled: boolean;
  cacheStrategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
  maxCacheSize: number;
  backgroundSyncEnabled: boolean;
  offlinePageEnabled: boolean;
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  data: any;
  level: number; // For level-of-detail rendering
  isVisible: boolean;
  lastRenderTime: number;
  connections: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  data: any;
  isVisible: boolean;
  lastRenderTime: number;
}

export interface SpatialIndex {
  insert: (node: GraphNode) => void;
  remove: (nodeId: string) => void;
  query: (bounds: BoundingBox) => GraphNode[];
  clear: () => void;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DataChunk {
  id: string;
  bounds: BoundingBox;
  nodes: GraphNode[];
  edges: GraphEdge[];
  isLoaded: boolean;
  isLoading: boolean;
  priority: number;
  loadedAt: number;
}

// Spatial indexing implementation for efficient viewport queries
class QuadTree implements SpatialIndex {
  private root: QuadTreeNode | null = null;
  private bounds: BoundingBox;
  private maxDepth: number;
  private maxNodesPerQuadrant: number;

  constructor(
    bounds: BoundingBox,
    maxDepth: number = 8,
    maxNodesPerQuadrant: number = 50
  ) {
    this.bounds = bounds;
    this.maxDepth = maxDepth;
    this.maxNodesPerQuadrant = maxNodesPerQuadrant;
    this.root = new QuadTreeNode(bounds, 0, maxDepth, maxNodesPerQuadrant);
  }

  insert(node: GraphNode): void {
    if (this.root) {
      this.root.insert(node);
    }
  }

  remove(nodeId: string): void {
    if (this.root) {
      this.root.remove(nodeId);
    }
  }

  query(bounds: BoundingBox): GraphNode[] {
    if (!this.root) return [];
    return this.root.query(bounds);
  }

  clear(): void {
    this.root = new QuadTreeNode(
      this.bounds,
      0,
      this.maxDepth,
      this.maxNodesPerQuadrant
    );
  }
}

class QuadTreeNode {
  private bounds: BoundingBox;
  private depth: number;
  private maxDepth: number;
  private maxNodes: number;
  private nodes: GraphNode[] = [];
  private children: QuadTreeNode[] | null = null;
  private isLeaf = true;

  constructor(
    bounds: BoundingBox,
    depth: number,
    maxDepth: number,
    maxNodes: number
  ) {
    this.bounds = bounds;
    this.depth = depth;
    this.maxDepth = maxDepth;
    this.maxNodes = maxNodes;
  }

  insert(node: GraphNode): void {
    if (!this.contains(node)) return;

    if (this.isLeaf && this.nodes.length < this.maxNodes) {
      this.nodes.push(node);
      return;
    }

    if (this.isLeaf && this.depth < this.maxDepth) {
      this.subdivide();
    }

    if (!this.isLeaf && this.children) {
      for (const child of this.children) {
        child.insert(node);
      }
    } else {
      this.nodes.push(node);
    }
  }

  remove(nodeId: string): void {
    if (this.isLeaf) {
      this.nodes = this.nodes.filter(node => node.id !== nodeId);
    } else if (this.children) {
      for (const child of this.children) {
        child.remove(nodeId);
      }
    }
  }

  query(bounds: BoundingBox): GraphNode[] {
    if (!this.intersects(bounds)) return [];

    let result: GraphNode[] = [];

    if (this.isLeaf) {
      result = this.nodes.filter(node => this.nodeInBounds(node, bounds));
    } else if (this.children) {
      for (const child of this.children) {
        result.push(...child.query(bounds));
      }
    }

    return result;
  }

  private contains(node: GraphNode): boolean {
    return (
      node.x >= this.bounds.minX &&
      node.x <= this.bounds.maxX &&
      node.y >= this.bounds.minY &&
      node.y <= this.bounds.maxY
    );
  }

  private intersects(bounds: BoundingBox): boolean {
    return !(
      bounds.maxX < this.bounds.minX ||
      bounds.minX > this.bounds.maxX ||
      bounds.maxY < this.bounds.minY ||
      bounds.minY > this.bounds.maxY
    );
  }

  private nodeInBounds(node: GraphNode, bounds: BoundingBox): boolean {
    return (
      node.x >= bounds.minX &&
      node.x <= bounds.maxX &&
      node.y >= bounds.minY &&
      node.y <= bounds.maxY
    );
  }

  private subdivide(): void {
    const { minX, minY, maxX, maxY } = this.bounds;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    this.children = [
      new QuadTreeNode(
        { minX, minY, maxX: midX, maxY: midY },
        this.depth + 1,
        this.maxDepth,
        this.maxNodes
      ),
      new QuadTreeNode(
        { minX: midX, minY, maxX, maxY: midY },
        this.depth + 1,
        this.maxDepth,
        this.maxNodes
      ),
      new QuadTreeNode(
        { minX, minY: midY, maxX: midX, maxY },
        this.depth + 1,
        this.maxDepth,
        this.maxNodes
      ),
      new QuadTreeNode(
        { minX: midX, minY: midY, maxX, maxY },
        this.depth + 1,
        this.maxDepth,
        this.maxNodes
      )
    ];

    // Redistribute nodes to children
    for (const node of this.nodes) {
      for (const child of this.children) {
        child.insert(node);
      }
    }

    this.nodes = [];
    this.isLeaf = false;
  }
}

// Main scalability manager
export class ScalabilityManager {
  private static instance: ScalabilityManager | null = null;
  private memoryManager = MemoryManager.getInstance();
  private edgeCaseManager = EdgeCaseManager.getInstance();

  // Configuration
  private virtualizationConfig: VirtualizationConfig = {
    viewportWidth: 800,
    viewportHeight: 600,
    bufferZone: 200,
    minZoomForVirtualization: 0.5,
    maxVisibleNodes: 1000,
    spatialIndexingEnabled: true,
    levelOfDetailEnabled: true
  };

  private streamingConfig: DataStreamingConfig = {
    chunkSize: 100,
    maxConcurrentChunks: 4,
    prefetchDistance: 2,
    compressionEnabled: true,
    cacheExpiration: 300000 // 5 minutes
  };

  private serviceWorkerConfig: ServiceWorkerConfig = {
    enabled: true,
    cacheStrategy: 'stale-while-revalidate',
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    backgroundSyncEnabled: true,
    offlinePageEnabled: true
  };

  // State
  private spatialIndex: SpatialIndex | null = null;
  private dataChunks = new Map<string, DataChunk>();
  private loadingChunks = new Set<string>();
  private visibleNodes = new Set<string>();
  private visibleEdges = new Set<string>();
  private currentViewport: BoundingBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private currentZoom = 1;
  private performanceMetrics: ScalabilityMetrics = {
    nodeCount: 0,
    edgeCount: 0,
    renderTime: 0,
    memoryUsage: 0,
    frameRate: 60,
    interactionLatency: 0,
    dataStreamingRate: 0,
    cacheHitRatio: 0
  };

  // Performance tracking
  private frameTimeBuffer: number[] = [];
  private lastFrameTime = 0;
  private renderTimeBuffer: number[] = [];

  private constructor() {
    this.initializeSpatialIndex();
    this.registerServiceWorker();
    this.startPerformanceMonitoring();
  }

  static getInstance(): ScalabilityManager {
    if (!ScalabilityManager.instance) {
      ScalabilityManager.instance = new ScalabilityManager();
    }
    return ScalabilityManager.instance;
  }

  /**
   * Configure scalability settings
   */
  configure(config: {
    virtualization?: Partial<VirtualizationConfig>;
    streaming?: Partial<DataStreamingConfig>;
    serviceWorker?: Partial<ServiceWorkerConfig>;
  }): void {
    if (config.virtualization) {
      this.virtualizationConfig = { ...this.virtualizationConfig, ...config.virtualization };
    }
    if (config.streaming) {
      this.streamingConfig = { ...this.streamingConfig, ...config.streaming };
    }
    if (config.serviceWorker) {
      this.serviceWorkerConfig = { ...this.serviceWorkerConfig, ...config.serviceWorker };
    }
  }

  /**
   * Initialize spatial indexing
   */
  private initializeSpatialIndex(): void {
    if (this.virtualizationConfig.spatialIndexingEnabled) {
      // Initialize with a large bounds - will be updated as nodes are added
      const bounds: BoundingBox = {
        minX: -10000,
        minY: -10000,
        maxX: 10000,
        maxY: 10000
      };
      
      this.spatialIndex = new QuadTree(bounds);
    }
  }

  /**
   * Update viewport for virtualization
   */
  updateViewport(
    x: number,
    y: number,
    width: number,
    height: number,
    zoom: number
  ): void {
    this.currentZoom = zoom;
    
    const bufferZone = this.virtualizationConfig.bufferZone;
    this.currentViewport = {
      minX: x - bufferZone,
      minY: y - bufferZone,
      maxX: x + width + bufferZone,
      maxY: y + height + bufferZone
    };

    // Update visible elements
    this.updateVisibleElements();
    
    // Trigger data loading for new chunks
    this.loadVisibleChunks();
  }

  /**
   * Add nodes to the spatial index
   */
  addNodes(nodes: GraphNode[]): void {
    if (!this.spatialIndex) return;

    for (const node of nodes) {
      this.spatialIndex.insert(node);
    }

    this.performanceMetrics.nodeCount += nodes.length;
    this.updateVisibleElements();
  }

  /**
   * Remove nodes from spatial index
   */
  removeNodes(nodeIds: string[]): void {
    if (!this.spatialIndex) return;

    for (const nodeId of nodeIds) {
      this.spatialIndex.remove(nodeId);
      this.visibleNodes.delete(nodeId);
    }

    this.performanceMetrics.nodeCount -= nodeIds.length;
  }

  /**
   * Update visible elements based on current viewport
   */
  private updateVisibleElements(): void {
    if (!this.spatialIndex) return;

    const startTime = performance.now();

    // Clear previous visible sets
    this.visibleNodes.clear();
    this.visibleEdges.clear();

    // Query spatial index for visible nodes
    const visibleNodeObjects = this.spatialIndex.query(this.currentViewport);
    
    // Apply level of detail filtering
    const filteredNodes = this.applyLevelOfDetail(visibleNodeObjects);
    
    // Limit maximum visible nodes for performance
    const limitedNodes = filteredNodes.slice(0, this.virtualizationConfig.maxVisibleNodes);
    
    for (const node of limitedNodes) {
      this.visibleNodes.add(node.id);
      node.isVisible = true;
      node.lastRenderTime = Date.now();
      
      // Add connected edges to visible set
      for (const connectionId of node.connections) {
        if (this.visibleNodes.has(connectionId)) {
          const edgeId = `${node.id}-${connectionId}`;
          this.visibleEdges.add(edgeId);
        }
      }
    }

    const endTime = performance.now();
    this.renderTimeBuffer.push(endTime - startTime);
    
    // Keep buffer size manageable
    if (this.renderTimeBuffer.length > 100) {
      this.renderTimeBuffer.shift();
    }
    
    this.performanceMetrics.renderTime = this.renderTimeBuffer.reduce((a, b) => a + b, 0) / this.renderTimeBuffer.length;
  }

  /**
   * Apply level of detail based on zoom level
   */
  private applyLevelOfDetail(nodes: GraphNode[]): GraphNode[] {
    if (!this.virtualizationConfig.levelOfDetailEnabled) {
      return nodes;
    }

    // Define level of detail thresholds
    const lodThresholds = [
      { zoom: 0.1, maxNodes: 50, skipLevel: 3 },
      { zoom: 0.25, maxNodes: 200, skipLevel: 2 },
      { zoom: 0.5, maxNodes: 500, skipLevel: 1 },
      { zoom: 1.0, maxNodes: 1000, skipLevel: 0 }
    ];

    const currentLod = lodThresholds.find(lod => this.currentZoom >= lod.zoom) || lodThresholds[0];
    
    // Filter nodes based on level and importance
    const filteredNodes = nodes.filter(node => {
      // Keep important nodes at all zoom levels
      if (node.level === 0) return true;
      
      // Skip nodes based on level of detail
      return node.level <= currentLod.skipLevel;
    });

    // Sort by importance and limit count
    return filteredNodes
      .sort((a, b) => a.level - b.level)
      .slice(0, currentLod.maxNodes);
  }

  /**
   * Data streaming implementation
   */
  async loadDataChunk(chunkId: string, bounds: BoundingBox): Promise<DataChunk> {
    if (this.dataChunks.has(chunkId)) {
      const chunk = this.dataChunks.get(chunkId)!;
      if (chunk.isLoaded) {
        return chunk;
      }
    }

    if (this.loadingChunks.has(chunkId)) {
      // Already loading, wait for completion
      return new Promise((resolve) => {
        const checkLoaded = () => {
          const chunk = this.dataChunks.get(chunkId);
          if (chunk && chunk.isLoaded) {
            resolve(chunk);
          } else {
            this.memoryManager.safeSetTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
      });
    }

    this.loadingChunks.add(chunkId);

    try {
      const chunk: DataChunk = {
        id: chunkId,
        bounds,
        nodes: [],
        edges: [],
        isLoaded: false,
        isLoading: true,
        priority: this.calculateChunkPriority(bounds),
        loadedAt: Date.now()
      };

      this.dataChunks.set(chunkId, chunk);

      // Simulate data loading (replace with actual API call)
      const data = await this.fetchChunkData(chunkId, bounds);
      
      chunk.nodes = data.nodes;
      chunk.edges = data.edges;
      chunk.isLoaded = true;
      chunk.isLoading = false;

      // Add nodes to spatial index
      this.addNodes(chunk.nodes);

      return chunk;

    } finally {
      this.loadingChunks.delete(chunkId);
    }
  }

  /**
   * Load visible chunks based on current viewport
   */
  private async loadVisibleChunks(): Promise<void> {
    const chunkSize = this.streamingConfig.chunkSize;
    const chunksToLoad: string[] = [];

    // Calculate chunk grid for current viewport
    const startChunkX = Math.floor(this.currentViewport.minX / chunkSize);
    const endChunkX = Math.ceil(this.currentViewport.maxX / chunkSize);
    const startChunkY = Math.floor(this.currentViewport.minY / chunkSize);
    const endChunkY = Math.ceil(this.currentViewport.maxY / chunkSize);

    // Add prefetch distance
    const prefetch = this.streamingConfig.prefetchDistance;

    for (let x = startChunkX - prefetch; x <= endChunkX + prefetch; x++) {
      for (let y = startChunkY - prefetch; y <= endChunkY + prefetch; y++) {
        const chunkId = `chunk_${x}_${y}`;
        
        if (!this.dataChunks.has(chunkId) && !this.loadingChunks.has(chunkId)) {
          chunksToLoad.push(chunkId);
        }
      }
    }

    // Sort chunks by priority (closer to viewport = higher priority)
    chunksToLoad.sort((a, b) => {
      const aPriority = this.getChunkPriorityFromId(a);
      const bPriority = this.getChunkPriorityFromId(b);
      return bPriority - aPriority;
    });

    // Load chunks respecting concurrency limit
    const maxConcurrent = this.streamingConfig.maxConcurrentChunks;
    const currentLoading = this.loadingChunks.size;
    const toLoad = chunksToLoad.slice(0, maxConcurrent - currentLoading);

    const loadPromises = toLoad.map(chunkId => {
      const bounds = this.getChunkBoundsFromId(chunkId);
      return this.loadDataChunk(chunkId, bounds);
    });

    await Promise.allSettled(loadPromises);
  }

  /**
   * Calculate chunk priority based on distance from viewport center
   */
  private calculateChunkPriority(bounds: BoundingBox): number {
    const viewportCenterX = (this.currentViewport.minX + this.currentViewport.maxX) / 2;
    const viewportCenterY = (this.currentViewport.minY + this.currentViewport.maxY) / 2;
    const chunkCenterX = (bounds.minX + bounds.maxX) / 2;
    const chunkCenterY = (bounds.minY + bounds.maxY) / 2;
    
    const distance = Math.sqrt(
      Math.pow(viewportCenterX - chunkCenterX, 2) +
      Math.pow(viewportCenterY - chunkCenterY, 2)
    );
    
    return 1 / (1 + distance); // Higher priority for closer chunks
  }

  /**
   * Service Worker registration and management
   */
  private async registerServiceWorker(): Promise<void> {
    if (!this.serviceWorkerConfig.enabled || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', registration);

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleServiceWorkerMessage(event.data);
      });

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(data: any): void {
    switch (data.type) {
      case 'CACHE_UPDATE':
        console.log('Cache updated:', data.payload);
        break;
        
      case 'BACKGROUND_SYNC':
        console.log('Background sync completed:', data.payload);
        break;
        
      case 'OFFLINE_FALLBACK':
        console.log('Offline fallback activated:', data.payload);
        break;
    }
  }

  /**
   * Performance monitoring
   */
  private startPerformanceMonitoring(): void {
    const updateMetrics = () => {
      this.updatePerformanceMetrics();
    };

    this.memoryManager.safeSetInterval(updateMetrics, 1000, 'Performance metrics update');

    // Monitor frame rate
    const trackFrameRate = () => {
      const now = performance.now();
      if (this.lastFrameTime > 0) {
        const frameTime = now - this.lastFrameTime;
        this.frameTimeBuffer.push(frameTime);
        
        if (this.frameTimeBuffer.length > 60) {
          this.frameTimeBuffer.shift();
        }
        
        const avgFrameTime = this.frameTimeBuffer.reduce((a, b) => a + b, 0) / this.frameTimeBuffer.length;
        this.performanceMetrics.frameRate = 1000 / avgFrameTime;
      }
      
      this.lastFrameTime = now;
      this.memoryManager.safeRequestAnimationFrame(trackFrameRate, 'Frame rate tracking');
    };

    trackFrameRate();
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    // Update memory usage
    const memoryInfo = this.memoryManager.getMemoryMetrics();
    if (memoryInfo) {
      this.performanceMetrics.memoryUsage = memoryInfo.usedJSHeapSize;
    }

    // Update cache hit ratio
    const totalChunks = this.dataChunks.size;
    const loadedChunks = Array.from(this.dataChunks.values()).filter(chunk => chunk.isLoaded).length;
    this.performanceMetrics.cacheHitRatio = totalChunks > 0 ? loadedChunks / totalChunks : 0;

    // Update data streaming rate
    const recentChunks = Array.from(this.dataChunks.values())
      .filter(chunk => Date.now() - chunk.loadedAt < 10000); // Last 10 seconds
    this.performanceMetrics.dataStreamingRate = recentChunks.length / 10; // Chunks per second
  }

  /**
   * Utility methods
   */
  private async fetchChunkData(chunkId: string, bounds: BoundingBox): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    // Simulate API call with compression support
    const url = `/api/graph/chunk/${chunkId}`;
    const headers: HeadersInit = {};
    
    if (this.streamingConfig.compressionEnabled) {
      headers['Accept-Encoding'] = 'gzip, deflate, br';
    }

    const data = await this.edgeCaseManager.safeNetworkRequest(url, { headers });
    
    return {
      nodes: data.nodes || [],
      edges: data.edges || []
    };
  }

  private getChunkBoundsFromId(chunkId: string): BoundingBox {
    const [, x, y] = chunkId.split('_').map(Number);
    const size = this.streamingConfig.chunkSize;
    
    return {
      minX: x * size,
      minY: y * size,
      maxX: (x + 1) * size,
      maxY: (y + 1) * size
    };
  }

  private getChunkPriorityFromId(chunkId: string): number {
    const bounds = this.getChunkBoundsFromId(chunkId);
    return this.calculateChunkPriority(bounds);
  }

  /**
   * Public API methods
   */
  getVisibleNodes(): Set<string> {
    return new Set(this.visibleNodes);
  }

  getVisibleEdges(): Set<string> {
    return new Set(this.visibleEdges);
  }

  getPerformanceMetrics(): ScalabilityMetrics {
    return { ...this.performanceMetrics };
  }

  isNodeVisible(nodeId: string): boolean {
    return this.visibleNodes.has(nodeId);
  }

  isEdgeVisible(edgeId: string): boolean {
    return this.visibleEdges.has(edgeId);
  }

  /**
   * Clean up old chunks to manage memory
   */
  cleanupOldChunks(): void {
    const now = Date.now();
    const expiration = this.streamingConfig.cacheExpiration;
    
    for (const [chunkId, chunk] of this.dataChunks.entries()) {
      if (now - chunk.loadedAt > expiration) {
        // Remove nodes from spatial index
        this.removeNodes(chunk.nodes.map(node => node.id));
        
        // Remove chunk
        this.dataChunks.delete(chunkId);
      }
    }
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.dataChunks.clear();
    this.loadingChunks.clear();
    this.visibleNodes.clear();
    this.visibleEdges.clear();
    
    if (this.spatialIndex) {
      this.spatialIndex.clear();
    }
    
    ScalabilityManager.instance = null;
  }
}

export default ScalabilityManager;