'use client';

// Type-safe fullscreen API interface - using intersection types instead of extending
export interface FullscreenElement {
  requestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => void;
  webkitRequestFullscreen?: () => void;
  msRequestFullscreen?: () => void;
}

export interface FullscreenDocument {
  exitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => void;
  webkitExitFullscreen?: () => void;
  msExitFullscreen?: () => void;
}

// Type-safe performance memory interface
export interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

export interface ExtendedWindow extends Window {
  performance: ExtendedPerformance;
  gc?: () => void;
}

// Type-safe cytoscape graph data
export interface CytoscapeNode {
  data: {
    id: string;
    label?: string;
    type?: string;
    group?: string;
    size?: number;
    color?: string;
    [key: string]: any;
  };
  position?: { x: number; y: number };
  classes?: string;
}

export interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    value?: number;
    color?: string;
    type?: string;
    [key: string]: any;
  };
  classes?: string;
}

export interface CytoscapeElements {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

// GPU graph data types
export interface GPUNode {
  id: string;
  label?: string;
  type?: string;
  group?: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  data?: any;
}

export interface GPULink {
  id: string;
  source: string;
  target: string;
  value?: number;
  color?: string;
  type?: string;
  data?: any;
}

export interface GPUGraphData {
  nodes: GPUNode[];
  links: GPULink[];
}

// Type guards for runtime type checking
export function isFullscreenElement(element: HTMLElement): boolean {
  return 'requestFullscreen' in element ||
         'mozRequestFullScreen' in element ||
         'webkitRequestFullscreen' in element ||
         'msRequestFullscreen' in element;
}

export function isFullscreenDocument(doc: Document): boolean {
  return 'exitFullscreen' in doc ||
         'mozCancelFullScreen' in doc ||
         'webkitExitFullscreen' in doc ||
         'msExitFullscreen' in doc;
}

export function hasPerformanceMemory(perf: Performance): perf is ExtendedPerformance {
  return 'memory' in perf;
}

export function hasGarbageCollector(win: Window): win is ExtendedWindow {
  return 'gc' in win;
}

// Utility functions for safe type casting
export function safeRequestFullscreen(element: HTMLElement): Promise<void> | void {
  if (!isFullscreenElement(element)) {
    console.warn('Fullscreen not supported on this element');
    return Promise.resolve();
  }

  const fsElement = element as any;
  if (fsElement.requestFullscreen) {
    return fsElement.requestFullscreen();
  } else if (fsElement.mozRequestFullScreen) {
    return fsElement.mozRequestFullScreen();
  } else if (fsElement.webkitRequestFullscreen) {
    return fsElement.webkitRequestFullscreen();
  } else if (fsElement.msRequestFullscreen) {
    return fsElement.msRequestFullscreen();
  }
}

export function safeExitFullscreen(doc: Document): Promise<void> | void {
  if (!isFullscreenDocument(doc)) {
    console.warn('Exit fullscreen not supported');
    return Promise.resolve();
  }

  const fsDoc = doc as any;
  if (fsDoc.exitFullscreen) {
    return fsDoc.exitFullscreen();
  } else if (fsDoc.mozCancelFullScreen) {
    return fsDoc.mozCancelFullScreen();
  } else if (fsDoc.webkitExitFullscreen) {
    return fsDoc.webkitExitFullscreen();
  } else if (fsDoc.msExitFullscreen) {
    return fsDoc.msExitFullscreen();
  }
}

export function safeGetMemoryInfo(win: Window): PerformanceMemory | null {
  if (hasPerformanceMemory(win.performance)) {
    return win.performance.memory || null;
  }
  return null;
}

export function safeCallGarbageCollector(win: Window): void {
  if (hasGarbageCollector(win)) {
    try {
      (win as any).gc?.();
    } catch (error) {
      console.warn('Failed to call garbage collector:', error);
    }
  }
}