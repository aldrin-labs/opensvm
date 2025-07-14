'use client';

/**
 * GPU-accelerated utilities for transaction graph rendering
 * Provides hardware acceleration hints and optimized rendering functions
 */

/**
 * Apply GPU acceleration hints to DOM elements
 * @param element The DOM element to optimize
 */
export const enableGPUAcceleration = (element: HTMLElement): void => {
  // Force GPU layer creation
  element.style.willChange = 'transform';
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
  
  // Optimize for performance
  element.style.imageRendering = 'optimizeSpeed';
  element.style.pointerEvents = 'auto';
};

/**
 * Setup GPU-accelerated canvas context
 * @param canvas Canvas element
 * @returns Optimized 2D context with GPU acceleration hints
 */
export const setupGPUCanvas = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null => {
  // Request GPU-accelerated context
  const context = canvas.getContext('2d', {
    alpha: true,
    desynchronized: true, // Enable GPU acceleration
    powerPreference: 'high-performance',
    willReadFrequently: false // Optimize for write operations
  }) as CanvasRenderingContext2D | null;
  
  if (!context) return null;
  
  // Apply GPU acceleration hints to canvas
  enableGPUAcceleration(canvas);
  
  // Set high DPI support
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  context.scale(dpr, dpr);
  
  return context;
};

/**
 * GPU-accelerated animation frame scheduler
 * Uses requestAnimationFrame with performance optimizations
 */
export class GPUAnimationScheduler {
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  // Removed unused targetFPS variable
  private frameInterval: number;
  
  constructor(targetFPS: number = 60) {
    this.frameInterval = 1000 / targetFPS;
  }
  
  /**
   * Schedule a function to run at the target FPS
   * @param callback Function to execute
   */
  schedule(callback: () => void): void {
    const animate = (currentTime: number) => {
      if (currentTime - this.lastFrameTime >= this.frameInterval) {
        callback();
        this.lastFrameTime = currentTime;
      }
      
      this.animationFrameId = requestAnimationFrame(animate);
    };
    
    this.animationFrameId = requestAnimationFrame(animate);
  }
  
  /**
   * Cancel scheduled animation
   */
  cancel(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

/**
 * GPU-accelerated particle system for visual effects
 */
export class GPUParticleSystem {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
  }>;
  private scheduler: GPUAnimationScheduler;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = setupGPUCanvas(canvas);
    if (!context) throw new Error('Could not get GPU-accelerated canvas context');
    
    this.context = context;
    this.particles = [];
    this.scheduler = new GPUAnimationScheduler(60);
  }
  
  /**
   * Add a particle to the system
   * @param x X position
   * @param y Y position
   * @param vx X velocity
   * @param vy Y velocity
   * @param life Particle lifetime in frames
   * @param color Particle color
   * @param size Particle size
   */
  addParticle(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number): void {
    this.particles.push({
      x, y, vx, vy,
      life,
      maxLife: life,
      color,
      size
    });
  }
  
  /**
   * Add burst effect at position
   * @param x X position
   * @param y Y position
   * @param count Number of particles
   * @param color Particle color
   */
  addBurst(x: number, y: number, count: number = 10, color: string = '#4CAF50'): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 30 + Math.random() * 30;
      const size = 2 + Math.random() * 3;
      
      this.addParticle(x, y, vx, vy, life, color, size);
    }
  }
  
  /**
   * Start the particle system animation
   */
  start(): void {
    this.scheduler.schedule(() => {
      this.update();
      this.render();
    });
  }
  
  /**
   * Stop the particle system
   */
  stop(): void {
    this.scheduler.cancel();
  }
  
  /**
   * Update particle positions and lifetimes
   */
  private update(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Update lifetime
      particle.life--;
      
      // Remove dead particles
      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  /**
   * Render particles with GPU acceleration
   */
  private render(): void {
    // Clear canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Batch render particles for performance
    this.context.save();
    
    for (const particle of this.particles) {
      const alpha = particle.life / particle.maxLife;
      this.context.globalAlpha = alpha;
      this.context.fillStyle = particle.color;
      
      this.context.beginPath();
      this.context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.context.fill();
    }
    
    this.context.restore();
  }
}

/**
 * GPU-accelerated throttle function with frame timing
 * @param fn Function to throttle
 * @param frameRate Target frame rate (default 60fps)
 * @returns Throttled function
 */
export function gpuThrottle<Args extends unknown[]>(
  fn: (...args: Args) => void, 
  frameRate: number = 60
): (...args: Args) => void {
  const frameInterval = 1000 / frameRate;
  let lastTime = 0;
  let animationFrameId: number | null = null;
  
  return (...args: Args) => {
    const now = performance.now();
    
    if (now - lastTime >= frameInterval) {
      lastTime = now;
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        fn(...args);
      });
    }
  };
}

/**
 * Create GPU-accelerated CSS transform for elements
 * @param x X translation
 * @param y Y translation
 * @param scale Scale factor
 * @param rotate Rotation in degrees
 * @returns CSS transform string
 */
export const createGPUTransform = (
  x: number = 0, 
  y: number = 0, 
  scale: number = 1, 
  rotate: number = 0
): string => {
  return `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`;
};

/**
 * Apply hardware acceleration to Cytoscape container
 * @param container Container element
 */
export const optimizeCytoscapeContainer = (container: HTMLElement): void => {
  enableGPUAcceleration(container);
  
  // Additional optimizations for Cytoscape
  container.style.contain = 'layout style paint';
  container.style.contentVisibility = 'auto';
  
  // Find canvas elements and optimize them
  const canvases = container.querySelectorAll('canvas');
  canvases.forEach(canvas => {
    enableGPUAcceleration(canvas as HTMLCanvasElement);
  });
};

const gpuUtils = {
  enableGPUAcceleration,
  setupGPUCanvas,
  GPUAnimationScheduler,
  GPUParticleSystem,
  gpuThrottle,
  createGPUTransform,
  optimizeCytoscapeContainer
};

export default gpuUtils;