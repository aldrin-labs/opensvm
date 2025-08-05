'use client';

import cytoscape from 'cytoscape';

export interface ViewportExtent {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface VirtualizedNode {
  id: string;
  position: { x: number; y: number };
  visible: boolean;
  priority: number; // Higher priority = more important to render
  lastVisible: number; // Timestamp when last visible
}

export interface VirtualizationStats {
  totalNodes: number;
  visibleNodes: number;
  culledNodes: number;
  renderTime: number;
  updateTime: number;
}

export class GraphVirtualizer {
  private visibleNodes = new Set<string>();
  private nodeCache = new Map<string, VirtualizedNode>();
  private viewportBuffer = 200; // Pixels outside viewport to keep rendered
  private maxVisibleNodes = 500; // Maximum nodes to render at once
  private priorityUpdateInterval = 100; // ms between priority updates
  private lastPriorityUpdate = 0;
  private stats: VirtualizationStats = {
    totalNodes: 0,
    visibleNodes: 0,
    culledNodes: 0,
    renderTime: 0,
    updateTime: 0,
  };

  constructor(
    private cy: cytoscape.Core,
    options: {
      maxVisibleNodes?: number;
      viewportBuffer?: number;
      priorityUpdateInterval?: number;
    } = {}
  ) {
    this.maxVisibleNodes = options.maxVisibleNodes || 500;
    this.viewportBuffer = options.viewportBuffer || 200;
    this.priorityUpdateInterval = options.priorityUpdateInterval || 100;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for viewport changes
    this.cy.on('pan zoom', this.throttledUpdateViewport);

    // Listen for node additions/removals
    this.cy.on('add', 'node', (event) => {
      const node = event.target;
      this.addNodeToCache(node);
    });

    this.cy.on('remove', 'node', (event) => {
      const node = event.target;
      this.removeNodeFromCache(node.id());
    });
  }

  private throttledUpdateViewport = this.throttle(() => {
    this.updateViewport();
  }, 16); // 60fps

  private throttle<T extends (...args: any[]) => void>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  public updateViewport(): void {
    const startTime = performance.now();

    const extent = this.getViewportExtent();
    let newVisibleNodes = new Set<string>();
    const now = Date.now();

    // Update priority scores if enough time has passed
    const shouldUpdatePriorities = now - this.lastPriorityUpdate > this.priorityUpdateInterval;

    // Find nodes in viewport
    this.cy.nodes().forEach((node) => {
      const id = node.id();
      const position = node.position();

      if (this.isNodeInViewport(position, extent)) {
        newVisibleNodes.add(id);

        // Update cache
        const cachedNode = this.nodeCache.get(id);
        if (cachedNode) {
          cachedNode.visible = true;
          cachedNode.lastVisible = now;

          if (shouldUpdatePriorities) {
            cachedNode.priority = this.calculateNodePriority(node, extent);
          }
        } else {
          this.addNodeToCache(node);
        }
      } else {
        // Node is outside viewport
        const cachedNode = this.nodeCache.get(id);
        if (cachedNode) {
          cachedNode.visible = false;
        }
      }
    });

    if (shouldUpdatePriorities) {
      this.lastPriorityUpdate = now;
    }

    // Apply virtualization if we have too many visible nodes
    if (newVisibleNodes.size > this.maxVisibleNodes) {
      newVisibleNodes = this.cullNodesByPriority(newVisibleNodes);
    }

    // Update visibility
    this.updateNodeVisibility(newVisibleNodes);

    // Update stats
    this.stats.updateTime = performance.now() - startTime;
    this.stats.totalNodes = this.cy.nodes().length;
    this.stats.visibleNodes = newVisibleNodes.size;
    this.stats.culledNodes = this.stats.totalNodes - this.stats.visibleNodes;

    this.visibleNodes = newVisibleNodes;
  }

  private getViewportExtent(): ViewportExtent {
    const pan = this.cy.pan();
    const zoom = this.cy.zoom();
    const container = this.cy.container();

    if (!container) {
      return { x1: 0, y1: 0, x2: 0, y2: 0 };
    }

    const rect = container.getBoundingClientRect();

    // Convert screen coordinates to graph coordinates
    const x1 = (-pan.x - this.viewportBuffer) / zoom;
    const y1 = (-pan.y - this.viewportBuffer) / zoom;
    const x2 = (-pan.x + rect.width + this.viewportBuffer) / zoom;
    const y2 = (-pan.y + rect.height + this.viewportBuffer) / zoom;

    return { x1, y1, x2, y2 };
  }

  private isNodeInViewport(position: { x: number; y: number }, extent: ViewportExtent): boolean {
    return (
      position.x >= extent.x1 &&
      position.x <= extent.x2 &&
      position.y >= extent.y1 &&
      position.y <= extent.y2
    );
  }

  private calculateNodePriority(node: cytoscape.NodeSingular, extent: ViewportExtent): number {
    const position = node.position();
    const nodeData = node.data();

    // Base priority factors
    let priority = 0;

    // Distance from viewport center
    const centerX = (extent.x1 + extent.x2) / 2;
    const centerY = (extent.y1 + extent.y2) / 2;
    const distance = Math.sqrt(
      Math.pow(position.x - centerX, 2) + Math.pow(position.y - centerY, 2)
    );
    priority += Math.max(0, 1000 - distance); // Closer = higher priority

    // Node type importance
    if (nodeData.type === 'transaction') {
      priority += 500; // Transactions are important
    } else if (nodeData.type === 'account') {
      priority += 300; // Accounts are somewhat important
    }

    // Connection count (degree centrality)
    const degree = node.degree(true);
    priority += degree * 10; // More connected = higher priority

    // Special states
    if (node.hasClass('highlighted') || node.hasClass('active')) {
      priority += 1000; // Always render highlighted/active nodes
    }

    if (nodeData.tracked) {
      priority += 800; // Tracked nodes are important
    }

    return priority;
  }

  private cullNodesByPriority(visibleNodes: Set<string>): Set<string> {
    // Convert to array with priorities
    const nodesWithPriority = Array.from(visibleNodes)
      .map(id => {
        const cachedNode = this.nodeCache.get(id);
        return {
          id,
          priority: cachedNode?.priority || 0
        };
      })
      .sort((a, b) => b.priority - a.priority) // Sort by priority descending
      .slice(0, this.maxVisibleNodes); // Take top N nodes

    return new Set(nodesWithPriority.map(item => item.id));
  }

  private updateNodeVisibility(newVisibleNodes: Set<string>): void {
    const renderStart = performance.now();

    // Hide nodes that are no longer visible
    this.visibleNodes.forEach(id => {
      if (!newVisibleNodes.has(id)) {
        const node = this.cy.getElementById(id);
        if (node.length > 0) {
          node.style('display', 'none');
          // Also hide connected edges
          node.connectedEdges().style('display', 'none');
        }
      }
    });

    // Show nodes that are now visible
    newVisibleNodes.forEach(id => {
      if (!this.visibleNodes.has(id)) {
        const node = this.cy.getElementById(id);
        if (node.length > 0) {
          node.style('display', 'element');
          // Show connected edges if both endpoints are visible
          node.connectedEdges().forEach(edge => {
            const sourceVisible = newVisibleNodes.has(edge.source().id());
            const targetVisible = newVisibleNodes.has(edge.target().id());
            if (sourceVisible && targetVisible) {
              edge.style('display', 'element');
            }
          });
        }
      }
    });

    this.stats.renderTime = performance.now() - renderStart;
  }

  private addNodeToCache(node: cytoscape.NodeSingular): void {
    const id = node.id();
    const position = node.position();
    const extent = this.getViewportExtent();

    this.nodeCache.set(id, {
      id,
      position,
      visible: this.isNodeInViewport(position, extent),
      priority: this.calculateNodePriority(node, extent),
      lastVisible: Date.now()
    });
  }

  private removeNodeFromCache(id: string): void {
    this.nodeCache.delete(id);
    this.visibleNodes.delete(id);
  }

  public getStats(): VirtualizationStats {
    return { ...this.stats };
  }

  public setMaxVisibleNodes(max: number): void {
    this.maxVisibleNodes = max;
    this.updateViewport(); // Re-evaluate with new limit
  }

  public setViewportBuffer(buffer: number): void {
    this.viewportBuffer = buffer;
    this.updateViewport(); // Re-evaluate with new buffer
  }

  public forceShowNode(nodeId: string): void {
    const cachedNode = this.nodeCache.get(nodeId);
    if (cachedNode) {
      cachedNode.priority = 10000; // Very high priority
      cachedNode.visible = true;
    }

    const node = this.cy.getElementById(nodeId);
    if (node.length > 0) {
      node.style('display', 'element');
      this.visibleNodes.add(nodeId);
    }
  }

  public destroy(): void {
    this.cy.off('pan zoom', this.throttledUpdateViewport);
    this.cy.off('add', 'node');
    this.cy.off('remove', 'node');
    this.visibleNodes.clear();
    this.nodeCache.clear();
  }
}

// Performance monitoring utilities
export class GraphPerformanceMonitor {
  private metrics = {
    frameRate: 0,
    renderTime: 0,
    layoutTime: 0,
    memoryUsage: 0,
    nodeCount: 0,
    edgeCount: 0
  };

  private frameCount = 0;
  private lastFrameTime = 0;
  private animationFrameId: number | null = null;

  constructor(private cy: cytoscape.Core) {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    const measureFrame = () => {
      const now = performance.now();

      if (this.lastFrameTime > 0) {
        const deltaTime = now - this.lastFrameTime;
        this.frameCount++;

        // Calculate FPS every second
        if (this.frameCount >= 60) {
          this.metrics.frameRate = 1000 / (deltaTime / this.frameCount);
          this.frameCount = 0;
        }
      }

      this.lastFrameTime = now;

      // Update other metrics
      this.metrics.nodeCount = this.cy.nodes().length;
      this.metrics.edgeCount = this.cy.edges().length;

      // Memory usage (if available)
      if ('memory' in performance) {
        this.metrics.memoryUsage = (performance as any).memory.usedJSHeapSize;
      }

      this.animationFrameId = requestAnimationFrame(measureFrame);
    };

    this.animationFrameId = requestAnimationFrame(measureFrame);
  }

  public measureLayoutTime<T>(layoutFunction: () => T): T {
    const start = performance.now();
    const result = layoutFunction();
    this.metrics.layoutTime = performance.now() - start;
    return result;
  }

  public measureRenderTime<T>(renderFunction: () => T): T {
    const start = performance.now();
    const result = renderFunction();
    this.metrics.renderTime = performance.now() - start;
    return result;
  }

  public getMetrics() {
    return { ...this.metrics };
  }

  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

// Intersection Observer for lazy loading
export class GraphLazyLoader {
  private observer: IntersectionObserver;
  private loadQueue = new Set<string>();
  private loadedNodes = new Set<string>();

  constructor(
    private onLoadNode: (nodeId: string) => Promise<void>,
    options: IntersectionObserverInit = {}
  ) {
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      options
    );
  }

  private async handleIntersection(entries: IntersectionObserverEntry[]): Promise<void> {
    for (const entry of entries) {
      const nodeId = entry.target.getAttribute('data-node-id');

      if (nodeId && entry.isIntersecting && !this.loadedNodes.has(nodeId)) {
        this.loadQueue.add(nodeId);

        // Debounced loading to avoid overwhelming the system
        setTimeout(() => {
          if (this.loadQueue.has(nodeId)) {
            this.loadNode(nodeId);
          }
        }, 100);
      }
    }
  }

  private async loadNode(nodeId: string): Promise<void> {
    try {
      this.loadQueue.delete(nodeId);
      this.loadedNodes.add(nodeId);
      await this.onLoadNode(nodeId);
    } catch (error) {
      console.error(`Failed to load node ${nodeId}:`, error);
      this.loadedNodes.delete(nodeId); // Allow retry
    }
  }

  public observeNode(element: Element, nodeId: string): void {
    element.setAttribute('data-node-id', nodeId);
    this.observer.observe(element);
  }

  public unobserveNode(element: Element): void {
    this.observer.unobserve(element);
  }

  public destroy(): void {
    this.observer.disconnect();
    this.loadQueue.clear();
    this.loadedNodes.clear();
  }
}

export default GraphVirtualizer;