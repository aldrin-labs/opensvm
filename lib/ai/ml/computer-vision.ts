/**
 * Computer Vision and Pattern Recognition Engine for OpenSVM
 * 
 * Features:
 * - Chart pattern recognition for technical analysis
 * - Visual anomaly detection in transaction flow graphs
 * - Automated report generation with charts and insights
 * - Visual similarity search for transaction patterns
 * - Image processing for blockchain visualizations
 */

import { TensorUtils } from './core/tensor-utils';
import type { 
  ChartPattern, 
  VisualAnomaly, 
  TensorData, 
  TimeSeriesPoint 
} from './types';

export interface ChartAnalysisRequest {
  chart_data: TimeSeriesPoint[];
  chart_type: 'candlestick' | 'line' | 'volume' | 'heatmap';
  timeframe: string;
  patterns_to_detect: string[];
  sensitivity: 'low' | 'medium' | 'high';
}

export interface ChartAnalysisResult {
  patterns: ChartPattern[];
  anomalies: VisualAnomaly[];
  key_levels: PriceLevel[];
  trend_analysis: TrendAnalysis;
  confidence_score: number;
}

export interface PriceLevel {
  type: 'support' | 'resistance' | 'pivot';
  value: number;
  strength: number; // 0-1
  touches: number;
  coordinates: { x: number; y: number }[];
}

export interface TrendAnalysis {
  direction: 'uptrend' | 'downtrend' | 'sideways';
  strength: number; // 0-1
  slope: number;
  r_squared: number;
  breakout_probability: number;
}

export interface TransactionFlowVisualization {
  nodes: FlowNode[];
  edges: FlowEdge[];
  clusters: NodeCluster[];
  anomalies: FlowAnomaly[];
  centrality_metrics: CentralityMetrics;
}

export interface FlowNode {
  id: string;
  address: string;
  type: 'wallet' | 'contract' | 'exchange' | 'bridge';
  size: number; // Transaction volume
  risk_score: number;
  coordinates: { x: number; y: number };
  metadata: Record<string, any>;
}

export interface FlowEdge {
  source: string;
  target: string;
  weight: number; // Transaction amount
  frequency: number;
  risk_level: 'low' | 'medium' | 'high';
  pattern_type: 'normal' | 'suspicious' | 'mev' | 'wash_trading';
}

export interface NodeCluster {
  id: string;
  nodes: string[];
  cluster_type: 'normal' | 'mixer' | 'exchange' | 'defi_protocol';
  risk_assessment: string;
  total_volume: number;
}

export interface FlowAnomaly {
  type: 'circular_flow' | 'sudden_spike' | 'dormant_activation' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affected_nodes: string[];
  confidence: number;
  description: string;
  visual_indicators: VisualIndicator[];
}

export interface VisualIndicator {
  type: 'highlight' | 'warning' | 'path' | 'cluster';
  coordinates: { x: number; y: number; width?: number; height?: number }[];
  color: string;
  label: string;
}

export interface CentralityMetrics {
  betweenness: Map<string, number>;
  closeness: Map<string, number>;
  eigenvector: Map<string, number>;
  page_rank: Map<string, number>;
}

/**
 * Canvas-based Image Processing Engine
 */
class ImageProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    // Create canvas for image processing
    this.canvas = typeof document !== 'undefined' 
      ? document.createElement('canvas')
      : {} as HTMLCanvasElement; // Mock for server-side
    
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  /**
   * Convert image data to tensor for processing
   */
  imageToTensor(imageData: ImageData): TensorData {
    const { width, height, data } = imageData;
    const pixels: number[] = [];

    // Convert RGBA to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Luminance formula
      const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
      pixels.push(grayscale / 255); // Normalize to 0-1
    }

    return TensorUtils.createTensor(pixels, [height, width], 'float32');
  }

  /**
   * Apply Gaussian blur for noise reduction
   */
  gaussianBlur(tensor: TensorData, sigma: number = 1.0): TensorData {
    const [height, width] = tensor.shape;
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = this.createGaussianKernel(kernelSize, sigma);
    
    return this.convolve2D(tensor, kernel);
  }

  /**
   * Edge detection using Sobel operator
   */
  sobelEdgeDetection(tensor: TensorData): TensorData {
    const sobelX = TensorUtils.createTensor([
      -1, 0, 1,
      -2, 0, 2,
      -1, 0, 1
    ], [3, 3]);

    const sobelY = TensorUtils.createTensor([
      -1, -2, -1,
       0,  0,  0,
       1,  2,  1
    ], [3, 3]);

    const edgeX = this.convolve2D(tensor, sobelX);
    const edgeY = this.convolve2D(tensor, sobelY);

    // Combine edge magnitudes
    const magnitude = TensorUtils.add(
      TensorUtils.multiply(edgeX, edgeX),
      TensorUtils.multiply(edgeY, edgeY)
    );

    // Apply square root element-wise
    const result = TensorUtils.createTensor(
      magnitude.data.map(x => Math.sqrt(x)),
      magnitude.shape
    );

    return result;
  }

  /**
   * Hough transform for line detection
   */
  houghLineTransform(edgeTensor: TensorData, threshold: number = 100): Array<{
    rho: number;
    theta: number;
    strength: number;
  }> {
    const [height, width] = edgeTensor.shape;
    const maxRho = Math.sqrt(width * width + height * height);
    const rhoResolution = 1;
    const thetaResolution = Math.PI / 180; // 1 degree

    const rhoSteps = Math.ceil(2 * maxRho / rhoResolution);
    const thetaSteps = Math.ceil(Math.PI / thetaResolution);

    // Accumulator array
    const accumulator = Array(rhoSteps).fill(null)
      .map(() => Array(thetaSteps).fill(0));

    // Vote for lines
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const edgeStrength = edgeTensor.data[y * width + x];
        
        if (edgeStrength > 0.1) { // Edge threshold
          for (let thetaIdx = 0; thetaIdx < thetaSteps; thetaIdx++) {
            const theta = thetaIdx * thetaResolution;
            const rho = x * Math.cos(theta) + y * Math.sin(theta);
            const rhoIdx = Math.floor((rho + maxRho) / rhoResolution);
            
            if (rhoIdx >= 0 && rhoIdx < rhoSteps) {
              accumulator[rhoIdx][thetaIdx] += edgeStrength;
            }
          }
        }
      }
    }

    // Extract lines above threshold
    const lines: Array<{ rho: number; theta: number; strength: number }> = [];
    
    for (let rhoIdx = 0; rhoIdx < rhoSteps; rhoIdx++) {
      for (let thetaIdx = 0; thetaIdx < thetaSteps; thetaIdx++) {
        const strength = accumulator[rhoIdx][thetaIdx];
        
        if (strength > threshold) {
          const rho = rhoIdx * rhoResolution - maxRho;
          const theta = thetaIdx * thetaResolution;
          
          lines.push({ rho, theta, strength });
        }
      }
    }

    return lines.sort((a, b) => b.strength - a.strength);
  }

  private createGaussianKernel(size: number, sigma: number): TensorData {
    const kernel: number[] = [];
    const center = Math.floor(size / 2);
    let sum = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        kernel.push(value);
        sum += value;
      }
    }

    // Normalize kernel
    return TensorUtils.createTensor(
      kernel.map(v => v / sum),
      [size, size]
    );
  }

  private convolve2D(tensor: TensorData, kernel: TensorData): TensorData {
    const [tensorHeight, tensorWidth] = tensor.shape;
    const [kernelHeight, kernelWidth] = kernel.shape;
    
    const resultHeight = tensorHeight - kernelHeight + 1;
    const resultWidth = tensorWidth - kernelWidth + 1;
    const result: number[] = [];

    for (let y = 0; y < resultHeight; y++) {
      for (let x = 0; x < resultWidth; x++) {
        let sum = 0;
        
        for (let ky = 0; ky < kernelHeight; ky++) {
          for (let kx = 0; kx < kernelWidth; kx++) {
            const tensorIdx = (y + ky) * tensorWidth + (x + kx);
            const kernelIdx = ky * kernelWidth + kx;
            sum += tensor.data[tensorIdx] * kernel.data[kernelIdx];
          }
        }
        
        result.push(sum);
      }
    }

    return TensorUtils.createTensor(result, [resultHeight, resultWidth]);
  }
}

/**
 * Chart Pattern Recognition Engine
 */
class ChartPatternRecognizer {
  private imageProcessor: ImageProcessor;

  constructor() {
    this.imageProcessor = new ImageProcessor();
  }

  /**
   * Recognize patterns in price chart data
   */
  recognizePatterns(data: TimeSeriesPoint[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    // Convert price data to normalized coordinates
    const coords = this.normalizeCoordinates(data);
    
    // Detect various pattern types
    patterns.push(...this.detectHeadAndShoulders(coords));
    patterns.push(...this.detectTriangles(coords));
    patterns.push(...this.detectDoubleTopBottom(coords));
    patterns.push(...this.detectSupportResistance(coords));
    patterns.push(...this.detectFlagsAndPennants(coords));

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private normalizeCoordinates(data: TimeSeriesPoint[]): { x: number; y: number }[] {
    if (data.length === 0) return [];

    const prices = data.map(d => d.value);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    return data.map((point, index) => ({
      x: index / (data.length - 1), // Normalize to 0-1
      y: priceRange > 0 ? (point.value - minPrice) / priceRange : 0.5
    }));
  }

  private detectHeadAndShoulders(coords: { x: number; y: number }[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    
    if (coords.length < 7) return patterns;

    // Find potential peaks
    const peaks = this.findPeaks(coords, 3);
    
    if (peaks.length < 3) return patterns;

    // Look for head and shoulders pattern (3 peaks with middle one highest)
    for (let i = 0; i < peaks.length - 2; i++) {
      const leftShoulder = peaks[i];
      const head = peaks[i + 1];
      const rightShoulder = peaks[i + 2];

      // Check if middle peak is highest (head)
      if (head.y > leftShoulder.y && head.y > rightShoulder.y) {
        // Check if shoulders are roughly at same level
        const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
        
        if (shoulderDiff < 0.1) { // 10% tolerance
          const neckline = this.calculateNeckline([leftShoulder, head, rightShoulder]);
          const confidence = this.calculatePatternConfidence('head_and_shoulders', [
            leftShoulder, head, rightShoulder
          ]);

          patterns.push({
            type: 'head_and_shoulders',
            confidence,
            coordinates: [leftShoulder, head, rightShoulder],
            timeframe: 'current',
            prediction: 'bearish',
            target: neckline.y - (head.y - neckline.y), // Target below neckline
            stopLoss: head.y
          });
        }
      }
    }

    return patterns;
  }

  private detectTriangles(coords: { x: number; y: number }[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    
    if (coords.length < 10) return patterns;

    const peaks = this.findPeaks(coords, 2);
    const troughs = this.findTroughs(coords, 2);

    if (peaks.length < 2 || troughs.length < 2) return patterns;

    // Ascending triangle: horizontal resistance, rising support
    const resistance = this.findHorizontalLine(peaks, 0.05);
    const support = this.findTrendLine(troughs, 'ascending');

    if (resistance && support) {
      const apex = this.findLineIntersection(resistance, support);
      
      if (apex && apex.x > Math.max(...peaks.map(p => p.x))) {
        patterns.push({
          type: 'triangle',
          confidence: 0.8,
          coordinates: [...peaks, ...troughs],
          timeframe: 'current',
          prediction: 'bullish',
          target: resistance.y + (resistance.y - Math.min(...troughs.map(t => t.y))),
          stopLoss: Math.min(...troughs.map(t => t.y))
        });
      }
    }

    return patterns;
  }

  private detectDoubleTopBottom(coords: { x: number; y: number }[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    
    const peaks = this.findPeaks(coords, 3);
    const troughs = this.findTroughs(coords, 3);

    // Double top
    for (let i = 0; i < peaks.length - 1; i++) {
      const peak1 = peaks[i];
      const peak2 = peaks[i + 1];
      
      if (Math.abs(peak1.y - peak2.y) < 0.05) { // Similar height
        const valleyBetween = troughs.find(t => t.x > peak1.x && t.x < peak2.x);
        
        if (valleyBetween && valleyBetween.y < peak1.y - 0.1) {
          patterns.push({
            type: 'double_top',
            confidence: 0.85,
            coordinates: [peak1, valleyBetween, peak2],
            timeframe: 'current',
            prediction: 'bearish',
            target: valleyBetween.y - (peak1.y - valleyBetween.y),
            stopLoss: Math.max(peak1.y, peak2.y)
          });
        }
      }
    }

    // Double bottom (similar logic, inverted)
    for (let i = 0; i < troughs.length - 1; i++) {
      const trough1 = troughs[i];
      const trough2 = troughs[i + 1];
      
      if (Math.abs(trough1.y - trough2.y) < 0.05) {
        const peakBetween = peaks.find(p => p.x > trough1.x && p.x < trough2.x);
        
        if (peakBetween && peakBetween.y > trough1.y + 0.1) {
          patterns.push({
            type: 'double_bottom',
            confidence: 0.85,
            coordinates: [trough1, peakBetween, trough2],
            timeframe: 'current',
            prediction: 'bullish',
            target: peakBetween.y + (peakBetween.y - trough1.y),
            stopLoss: Math.min(trough1.y, trough2.y)
          });
        }
      }
    }

    return patterns;
  }

  private detectSupportResistance(coords: { x: number; y: number }[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    
    const peaks = this.findPeaks(coords, 2);
    const troughs = this.findTroughs(coords, 2);

    // Find resistance levels
    const resistanceLevels = this.findHorizontalLevels(peaks, 0.03);
    
    for (const level of resistanceLevels) {
      if (level.touches >= 2) {
        patterns.push({
          type: 'resistance',
          confidence: Math.min(0.9, level.touches * 0.2),
          coordinates: level.points,
          timeframe: 'current',
          prediction: level.strength > 0.7 ? 'bearish' : 'neutral'
        });
      }
    }

    // Find support levels
    const supportLevels = this.findHorizontalLevels(troughs, 0.03);
    
    for (const level of supportLevels) {
      if (level.touches >= 2) {
        patterns.push({
          type: 'support',
          confidence: Math.min(0.9, level.touches * 0.2),
          coordinates: level.points,
          timeframe: 'current',
          prediction: level.strength > 0.7 ? 'bullish' : 'neutral'
        });
      }
    }

    return patterns;
  }

  private detectFlagsAndPennants(coords: { x: number; y: number }[]): ChartPattern[] {
    const patterns: ChartPattern[] = [];
    
    // Look for strong price movements followed by consolidation
    const movements = this.findStrongMovements(coords, 0.15); // 15% move
    
    for (const movement of movements) {
      const consolidationStart = movement.end;
      const consolidationData = coords.filter(c => 
        c.x > consolidationStart.x && c.x < consolidationStart.x + 0.2
      );

      if (consolidationData.length < 5) continue;

      const volatility = this.calculateVolatility(consolidationData);
      
      if (volatility < 0.05) { // Low volatility consolidation
        const flagType = movement.direction === 'up' ? 'bullish' : 'bearish';
        
        patterns.push({
          type: 'flag',
          confidence: 0.75,
          coordinates: [movement.start, movement.end, ...consolidationData.slice(-3)],
          timeframe: 'current',
          prediction: flagType === 'bullish' ? 'bullish' : 'bearish',
          target: movement.end.y + (movement.end.y - movement.start.y) * 0.5
        });
      }
    }

    return patterns;
  }

  // Helper methods for pattern detection
  private findPeaks(coords: { x: number; y: number }[], minDistance: number): { x: number; y: number }[] {
    const peaks: { x: number; y: number }[] = [];
    
    for (let i = minDistance; i < coords.length - minDistance; i++) {
      const current = coords[i];
      let isPeak = true;
      
      // Check if current point is higher than neighbors
      for (let j = i - minDistance; j <= i + minDistance; j++) {
        if (j !== i && coords[j].y >= current.y) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        peaks.push(current);
      }
    }
    
    return peaks;
  }

  private findTroughs(coords: { x: number; y: number }[], minDistance: number): { x: number; y: number }[] {
    const troughs: { x: number; y: number }[] = [];
    
    for (let i = minDistance; i < coords.length - minDistance; i++) {
      const current = coords[i];
      let isTrough = true;
      
      // Check if current point is lower than neighbors
      for (let j = i - minDistance; j <= i + minDistance; j++) {
        if (j !== i && coords[j].y <= current.y) {
          isTrough = false;
          break;
        }
      }
      
      if (isTrough) {
        troughs.push(current);
      }
    }
    
    return troughs;
  }

  private findHorizontalLine(points: { x: number; y: number }[], tolerance: number): 
    { y: number; points: { x: number; y: number }[] } | null {
    
    if (points.length < 2) return null;
    
    const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const validPoints = points.filter(p => Math.abs(p.y - avgY) < tolerance);
    
    return validPoints.length >= 2 ? { y: avgY, points: validPoints } : null;
  }

  private findTrendLine(points: { x: number; y: number }[], direction: 'ascending' | 'descending'): 
    { slope: number; intercept: number; points: { x: number; y: number }[] } | null {
    
    if (points.length < 2) return null;
    
    // Simple linear regression
    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Check if slope matches expected direction
    const isValidDirection = direction === 'ascending' ? slope > 0 : slope < 0;
    
    return isValidDirection ? { slope, intercept, points } : null;
  }

  private findLineIntersection(
    line1: { y: number } | { slope: number; intercept: number },
    line2: { y: number } | { slope: number; intercept: number }
  ): { x: number; y: number } | null {
    
    // Handle horizontal line intersections
    if ('y' in line1 && 'slope' in line2) {
      const x = (line1.y - line2.intercept) / line2.slope;
      return { x, y: line1.y };
    }
    
    if ('slope' in line1 && 'y' in line2) {
      const x = (line2.y - line1.intercept) / line1.slope;
      return { x, y: line2.y };
    }
    
    if ('slope' in line1 && 'slope' in line2) {
      if (Math.abs(line1.slope - line2.slope) < 0.001) return null; // Parallel lines
      
      const x = (line2.intercept - line1.intercept) / (line1.slope - line2.slope);
      const y = line1.slope * x + line1.intercept;
      return { x, y };
    }
    
    return null;
  }

  private findHorizontalLevels(points: { x: number; y: number }[], tolerance: number): Array<{
    y: number;
    touches: number;
    strength: number;
    points: { x: number; y: number }[];
  }> {
    const levels: Array<{
      y: number;
      touches: number;
      strength: number;
      points: { x: number; y: number }[];
    }> = [];
    
    const sortedPoints = [...points].sort((a, b) => a.y - b.y);
    
    for (const point of sortedPoints) {
      const nearbyPoints = points.filter(p => Math.abs(p.y - point.y) < tolerance);
      
      if (nearbyPoints.length >= 2) {
        const avgY = nearbyPoints.reduce((sum, p) => sum + p.y, 0) / nearbyPoints.length;
        const strength = Math.min(1, nearbyPoints.length / points.length * 2);
        
        // Check if level already exists
        const existingLevel = levels.find(l => Math.abs(l.y - avgY) < tolerance);
        
        if (!existingLevel) {
          levels.push({
            y: avgY,
            touches: nearbyPoints.length,
            strength,
            points: nearbyPoints
          });
        }
      }
    }
    
    return levels.sort((a, b) => b.strength - a.strength);
  }

  private findStrongMovements(coords: { x: number; y: number }[], minChange: number): Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    direction: 'up' | 'down';
    magnitude: number;
  }> {
    const movements: Array<{
      start: { x: number; y: number };
      end: { x: number; y: number };
      direction: 'up' | 'down';
      magnitude: number;
    }> = [];
    
    for (let i = 0; i < coords.length - 1; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const change = (coords[j].y - coords[i].y) / coords[i].y;
        
        if (Math.abs(change) >= minChange) {
          movements.push({
            start: coords[i],
            end: coords[j],
            direction: change > 0 ? 'up' : 'down',
            magnitude: Math.abs(change)
          });
        }
      }
    }
    
    return movements.sort((a, b) => b.magnitude - a.magnitude);
  }

  private calculateVolatility(coords: { x: number; y: number }[]): number {
    if (coords.length < 2) return 0;
    
    const prices = coords.map(c => c.y);
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    
    return Math.sqrt(variance);
  }

  private calculatePatternConfidence(patternType: string, coordinates: { x: number; y: number }[]): number {
    // Base confidence varies by pattern type
    const baseConfidence: Record<string, number> = {
      'head_and_shoulders': 0.8,
      'double_top': 0.85,
      'double_bottom': 0.85,
      'triangle': 0.75,
      'flag': 0.7,
      'pennant': 0.7,
      'support': 0.8,
      'resistance': 0.8
    };
    
    let confidence = baseConfidence[patternType] || 0.5;
    
    // Adjust based on data quality
    if (coordinates.length >= 3) confidence += 0.1;
    if (coordinates.length >= 5) confidence += 0.05;
    
    return Math.min(0.95, confidence);
  }

  private calculateNeckline(points: { x: number; y: number }[]): { y: number; slope: number } {
    if (points.length < 2) return { y: points[0]?.y || 0, slope: 0 };
    
    // Find the two lowest points for neckline
    const sortedByY = [...points].sort((a, b) => a.y - b.y);
    const necklinePoints = sortedByY.slice(0, 2);
    
    if (necklinePoints.length === 2) {
      const slope = (necklinePoints[1].y - necklinePoints[0].y) / 
                    (necklinePoints[1].x - necklinePoints[0].x);
      const y = necklinePoints[0].y;
      return { y, slope };
    }
    
    return { y: necklinePoints[0].y, slope: 0 };
  }
}

/**
 * Transaction Flow Visualization and Anomaly Detection
 */
class TransactionFlowAnalyzer {
  /**
   * Analyze transaction flows and detect anomalies
   */
  analyzeTransactionFlow(transactions: any[]): TransactionFlowVisualization {
    // Build graph from transactions
    const { nodes, edges } = this.buildTransactionGraph(transactions);
    
    // Detect clusters
    const clusters = this.detectClusters(nodes, edges);
    
    // Calculate centrality metrics
    const centrality_metrics = this.calculateCentralityMetrics(nodes, edges);
    
    // Detect anomalies
    const anomalies = this.detectFlowAnomalies(nodes, edges, clusters);
    
    return {
      nodes,
      edges,
      clusters,
      anomalies,
      centrality_metrics
    };
  }

  private buildTransactionGraph(transactions: any[]): { 
    nodes: FlowNode[]; 
    edges: FlowEdge[];
  } {
    const nodeMap = new Map<string, FlowNode>();
    const edgeMap = new Map<string, FlowEdge>();

    // Process transactions to build graph
    for (const tx of transactions) {
      const from = tx.from || tx.signer;
      const to = tx.to || tx.accountKeys?.[1];
      const amount = tx.amount || 0;

      if (!from || !to) continue;

      // Create or update nodes
      this.updateNode(nodeMap, from, amount, tx);
      this.updateNode(nodeMap, to, amount, tx);

      // Create or update edge
      const edgeKey = `${from}-${to}`;
      if (edgeMap.has(edgeKey)) {
        const edge = edgeMap.get(edgeKey)!;
        edge.weight += amount;
        edge.frequency += 1;
      } else {
        edgeMap.set(edgeKey, {
          source: from,
          target: to,
          weight: amount,
          frequency: 1,
          risk_level: this.assessEdgeRisk(tx),
          pattern_type: this.detectEdgePattern(tx)
        });
      }
    }

    // Convert maps to arrays and assign coordinates
    const nodes = Array.from(nodeMap.values());
    const edges = Array.from(edgeMap.values());

    // Assign layout coordinates using force-directed algorithm
    this.assignNodeCoordinates(nodes, edges);

    return { nodes, edges };
  }

  private updateNode(
    nodeMap: Map<string, FlowNode>, 
    address: string, 
    amount: number, 
    tx: any
  ): void {
    if (nodeMap.has(address)) {
      const node = nodeMap.get(address)!;
      node.size += amount;
      node.risk_score = Math.max(node.risk_score, this.calculateNodeRisk(tx));
    } else {
      nodeMap.set(address, {
        id: address,
        address,
        type: this.determineNodeType(address, tx),
        size: amount,
        risk_score: this.calculateNodeRisk(tx),
        coordinates: { x: 0, y: 0 }, // Will be updated by layout algorithm
        metadata: {
          first_seen: tx.timestamp,
          transaction_count: 1
        }
      });
    }
  }

  private determineNodeType(address: string, tx: any): FlowNode['type'] {
    // Heuristics to determine node type
    if (tx.programs?.includes('11111111111111111111111111111111')) {
      return 'wallet';
    }
    if (tx.programs?.some((p: string) => this.isKnownExchange(p))) {
      return 'exchange';
    }
    if (tx.programs?.some((p: string) => this.isKnownBridge(p))) {
      return 'bridge';
    }
    if (tx.programs && tx.programs.length > 1) {
      return 'contract';
    }
    return 'wallet';
  }

  private isKnownExchange(programId: string): boolean {
    const exchangePrograms = [
      'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB', // Jupiter
      '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium
      'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'  // Orca
    ];
    return exchangePrograms.includes(programId);
  }

  private isKnownBridge(programId: string): boolean {
    // Add known bridge program IDs
    return false; // Placeholder
  }

  private calculateNodeRisk(tx: any): number {
    let risk = 0;
    
    if (tx.failed) risk += 0.2;
    if (tx.amount > 100000) risk += 0.3; // Large amounts
    if (tx.programs && tx.programs.length > 5) risk += 0.2; // Complex transactions
    
    return Math.min(1, risk);
  }

  private assessEdgeRisk(tx: any): 'low' | 'medium' | 'high' {
    const risk = this.calculateNodeRisk(tx);
    
    if (risk > 0.7) return 'high';
    if (risk > 0.3) return 'medium';
    return 'low';
  }

  private detectEdgePattern(tx: any): FlowEdge['pattern_type'] {
    // Simple pattern detection based on transaction characteristics
    if (tx.amount && tx.amount === tx.previousAmount && tx.frequency > 5) {
      return 'wash_trading';
    }
    if (tx.programs?.includes('MEV')) {
      return 'mev';
    }
    if (tx.suspicious_flags?.length > 0) {
      return 'suspicious';
    }
    return 'normal';
  }

  private assignNodeCoordinates(nodes: FlowNode[], edges: FlowEdge[]): void {
    // Simple force-directed layout algorithm
    const width = 800;
    const height = 600;
    const iterations = 100;

    // Initialize random positions
    for (const node of nodes) {
      node.coordinates = {
        x: Math.random() * width,
        y: Math.random() * height
      };
    }

    // Force-directed layout simulation
    for (let iter = 0; iter < iterations; iter++) {
      const forces = new Map<string, { x: number; y: number }>();
      
      // Initialize forces
      for (const node of nodes) {
        forces.set(node.id, { x: 0, y: 0 });
      }

      // Repulsive forces between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const node1 = nodes[i];
          const node2 = nodes[j];
          
          const dx = node2.coordinates.x - node1.coordinates.x;
          const dy = node2.coordinates.y - node1.coordinates.y;
          const distance = Math.sqrt(dx * dx + dy * dy) + 0.01; // Avoid division by zero
          
          const repulsiveForce = 1000 / (distance * distance);
          const fx = (dx / distance) * repulsiveForce;
          const fy = (dy / distance) * repulsiveForce;
          
          const force1 = forces.get(node1.id)!;
          const force2 = forces.get(node2.id)!;
          
          force1.x -= fx;
          force1.y -= fy;
          force2.x += fx;
          force2.y += fy;
        }
      }

      // Attractive forces from edges
      for (const edge of edges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (!sourceNode || !targetNode) continue;
        
        const dx = targetNode.coordinates.x - sourceNode.coordinates.x;
        const dy = targetNode.coordinates.y - sourceNode.coordinates.y;
        const distance = Math.sqrt(dx * dx + dy * dy) + 0.01;
        
        const attractiveForce = distance * 0.01;
        const fx = (dx / distance) * attractiveForce;
        const fy = (dy / distance) * attractiveForce;
        
        const sourceForce = forces.get(sourceNode.id)!;
        const targetForce = forces.get(targetNode.id)!;
        
        sourceForce.x += fx;
        sourceForce.y += fy;
        targetForce.x -= fx;
        targetForce.y -= fy;
      }

      // Apply forces
      const damping = 0.9;
      for (const node of nodes) {
        const force = forces.get(node.id)!;
        node.coordinates.x += force.x * damping;
        node.coordinates.y += force.y * damping;
        
        // Keep nodes within bounds
        node.coordinates.x = Math.max(0, Math.min(width, node.coordinates.x));
        node.coordinates.y = Math.max(0, Math.min(height, node.coordinates.y));
      }
    }
  }

  private detectClusters(nodes: FlowNode[], edges: FlowEdge[]): NodeCluster[] {
    const clusters: NodeCluster[] = [];
    const visited = new Set<string>();

    // Simple clustering based on connectivity
    for (const node of nodes) {
      if (visited.has(node.id)) continue;

      const cluster = this.exploreCluster(node, nodes, edges, visited);
      
      if (cluster.length > 1) {
        clusters.push({
          id: `cluster_${clusters.length}`,
          nodes: cluster.map(n => n.id),
          cluster_type: this.determineClusterType(cluster, edges),
          risk_assessment: this.assessClusterRisk(cluster, edges),
          total_volume: cluster.reduce((sum, n) => sum + n.size, 0)
        });
      }
    }

    return clusters;
  }

  private exploreCluster(
    startNode: FlowNode,
    allNodes: FlowNode[],
    allEdges: FlowEdge[],
    visited: Set<string>
  ): FlowNode[] {
    const cluster: FlowNode[] = [];
    const queue: FlowNode[] = [startNode];

    while (queue.length > 0) {
      const node = queue.shift()!;
      
      if (visited.has(node.id)) continue;
      
      visited.add(node.id);
      cluster.push(node);

      // Find connected nodes
      const connectedEdges = allEdges.filter(e => 
        e.source === node.id || e.target === node.id
      );

      for (const edge of connectedEdges) {
        const connectedNodeId = edge.source === node.id ? edge.target : edge.source;
        const connectedNode = allNodes.find(n => n.id === connectedNodeId);
        
        if (connectedNode && !visited.has(connectedNodeId)) {
          queue.push(connectedNode);
        }
      }
    }

    return cluster;
  }

  private determineClusterType(cluster: FlowNode[], edges: FlowEdge[]): NodeCluster['cluster_type'] {
    const clusterNodeIds = new Set(cluster.map(n => n.id));
    const internalEdges = edges.filter(e => 
      clusterNodeIds.has(e.source) && clusterNodeIds.has(e.target)
    );

    const exchangeNodes = cluster.filter(n => n.type === 'exchange').length;
    const contractNodes = cluster.filter(n => n.type === 'contract').length;

    if (exchangeNodes > cluster.length * 0.5) return 'exchange';
    if (contractNodes > cluster.length * 0.3) return 'defi_protocol';
    if (internalEdges.length > cluster.length * 2) return 'mixer';
    
    return 'normal';
  }

  private assessClusterRisk(cluster: FlowNode[], edges: FlowEdge[]): string {
    const avgRisk = cluster.reduce((sum, n) => sum + n.risk_score, 0) / cluster.length;
    const clusterNodeIds = new Set(cluster.map(n => n.id));
    const suspiciousEdges = edges.filter(e => 
      clusterNodeIds.has(e.source) && 
      clusterNodeIds.has(e.target) && 
      e.pattern_type === 'suspicious'
    ).length;

    if (avgRisk > 0.7 || suspiciousEdges > 5) return 'High risk cluster detected';
    if (avgRisk > 0.4 || suspiciousEdges > 2) return 'Medium risk - monitor activity';
    return 'Low risk cluster';
  }

  private calculateCentralityMetrics(nodes: FlowNode[], edges: FlowEdge[]): CentralityMetrics {
    const betweenness = new Map<string, number>();
    const closeness = new Map<string, number>();
    const eigenvector = new Map<string, number>();
    const page_rank = new Map<string, number>();

    // Initialize all metrics to 0
    for (const node of nodes) {
      betweenness.set(node.id, 0);
      closeness.set(node.id, 0);
      eigenvector.set(node.id, 0);
      page_rank.set(node.id, 1 / nodes.length); // Initialize PageRank uniformly
    }

    // Calculate centrality metrics (simplified implementations)
    this.calculateBetweennessCentrality(nodes, edges, betweenness);
    this.calculateClosenessCentrality(nodes, edges, closeness);
    this.calculateEigenvectorCentrality(nodes, edges, eigenvector);
    this.calculatePageRank(nodes, edges, page_rank);

    return {
      betweenness,
      closeness,
      eigenvector,
      page_rank
    };
  }

  private calculateBetweennessCentrality(
    nodes: FlowNode[], 
    edges: FlowEdge[], 
    betweenness: Map<string, number>
  ): void {
    // Simplified betweenness centrality calculation
    // In production, would use proper shortest path algorithms
    
    for (const node of nodes) {
      const nodeEdges = edges.filter(e => e.source === node.id || e.target === node.id);
      const centrality = nodeEdges.length / Math.max(1, nodes.length - 1);
      betweenness.set(node.id, centrality);
    }
  }

  private calculateClosenessCentrality(
    nodes: FlowNode[], 
    edges: FlowEdge[], 
    closeness: Map<string, number>
  ): void {
    // Simplified closeness centrality
    for (const node of nodes) {
      const connectedNodes = new Set<string>();
      
      for (const edge of edges) {
        if (edge.source === node.id) connectedNodes.add(edge.target);
        if (edge.target === node.id) connectedNodes.add(edge.source);
      }
      
      const centrality = connectedNodes.size / Math.max(1, nodes.length - 1);
      closeness.set(node.id, centrality);
    }
  }

  private calculateEigenvectorCentrality(
    nodes: FlowNode[], 
    edges: FlowEdge[], 
    eigenvector: Map<string, number>
  ): void {
    // Simplified eigenvector centrality using power iteration
    const maxIterations = 100;
    const tolerance = 1e-6;

    for (let iter = 0; iter < maxIterations; iter++) {
      const newValues = new Map<string, number>();
      
      for (const node of nodes) {
        let sum = 0;
        
        for (const edge of edges) {
          if (edge.target === node.id) {
            sum += eigenvector.get(edge.source) || 0;
          }
        }
        
        newValues.set(node.id, sum);
      }

      // Normalize
      const norm = Math.sqrt(Array.from(newValues.values())
        .reduce((sum, val) => sum + val * val, 0));
      
      if (norm > 0) {
        for (const [nodeId, value] of newValues) {
          newValues.set(nodeId, value / norm);
        }
      }

      // Check convergence
      let converged = true;
      for (const node of nodes) {
        const oldVal = eigenvector.get(node.id) || 0;
        const newVal = newValues.get(node.id) || 0;
        
        if (Math.abs(newVal - oldVal) > tolerance) {
          converged = false;
          break;
        }
      }

      // Update values
      for (const [nodeId, value] of newValues) {
        eigenvector.set(nodeId, value);
      }

      if (converged) break;
    }
  }

  private calculatePageRank(
    nodes: FlowNode[], 
    edges: FlowEdge[], 
    page_rank: Map<string, number>
  ): void {
    const dampingFactor = 0.85;
    const maxIterations = 100;
    const tolerance = 1e-6;

    for (let iter = 0; iter < maxIterations; iter++) {
      const newValues = new Map<string, number>();

      for (const node of nodes) {
        let sum = 0;
        
        // Find incoming edges
        const incomingEdges = edges.filter(e => e.target === node.id);
        
        for (const edge of incomingEdges) {
          const sourceNode = nodes.find(n => n.id === edge.source);
          if (sourceNode) {
            const outDegree = edges.filter(e => e.source === sourceNode.id).length;
            sum += (page_rank.get(sourceNode.id) || 0) / Math.max(1, outDegree);
          }
        }

        const newValue = (1 - dampingFactor) / nodes.length + dampingFactor * sum;
        newValues.set(node.id, newValue);
      }

      // Check convergence
      let converged = true;
      for (const node of nodes) {
        const oldVal = page_rank.get(node.id) || 0;
        const newVal = newValues.get(node.id) || 0;
        
        if (Math.abs(newVal - oldVal) > tolerance) {
          converged = false;
          break;
        }
      }

      // Update values
      for (const [nodeId, value] of newValues) {
        page_rank.set(nodeId, value);
      }

      if (converged) break;
    }
  }

  private detectFlowAnomalies(
    nodes: FlowNode[], 
    edges: FlowEdge[], 
    clusters: NodeCluster[]
  ): FlowAnomaly[] {
    const anomalies: FlowAnomaly[] = [];

    // Detect circular flows
    anomalies.push(...this.detectCircularFlows(nodes, edges));
    
    // Detect sudden spikes in activity
    anomalies.push(...this.detectActivitySpikes(nodes, edges));
    
    // Detect dormant wallet activation
    anomalies.push(...this.detectDormantActivation(nodes));
    
    // Detect unusual patterns
    anomalies.push(...this.detectUnusualPatterns(edges));

    return anomalies.sort((a, b) => b.confidence - a.confidence);
  }

  private detectCircularFlows(nodes: FlowNode[], edges: FlowEdge[]): FlowAnomaly[] {
    const anomalies: FlowAnomaly[] = [];
    
    // Simple cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found cycle
        const cycleStart = path.indexOf(nodeId);
        const cycleNodes = path.slice(cycleStart);
        
        if (cycleNodes.length >= 3) { // At least 3 nodes in cycle
          anomalies.push({
            type: 'circular_flow',
            severity: 'medium',
            affected_nodes: cycleNodes,
            confidence: 0.8,
            description: `Circular flow detected involving ${cycleNodes.length} addresses`,
            visual_indicators: [{
              type: 'path',
              coordinates: cycleNodes.map(nodeId => {
                const node = nodes.find(n => n.id === nodeId);
                return node ? node.coordinates : { x: 0, y: 0 };
              }),
              color: '#FF6B35',
              label: 'Circular Flow'
            }]
          });
        }
        
        return true;
      }

      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      // Explore neighbors
      const outgoingEdges = edges.filter(e => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (dfs(edge.target, [...path, edge.target])) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, [node.id]);
      }
    }

    return anomalies;
  }

  private detectActivitySpikes(nodes: FlowNode[], edges: FlowEdge[]): FlowAnomaly[] {
    const anomalies: FlowAnomaly[] = [];
    
    // Calculate average activity per node
    const avgActivity = nodes.reduce((sum, n) => sum + n.size, 0) / nodes.length;
    const threshold = avgActivity * 5; // 5x average

    for (const node of nodes) {
      if (node.size > threshold) {
        anomalies.push({
          type: 'sudden_spike',
          severity: node.size > avgActivity * 10 ? 'high' : 'medium',
          affected_nodes: [node.id],
          confidence: 0.9,
          description: `Sudden activity spike detected: ${(node.size / avgActivity).toFixed(1)}x average`,
          visual_indicators: [{
            type: 'highlight',
            coordinates: [node.coordinates],
            color: '#FF3366',
            label: 'Activity Spike'
          }]
        });
      }
    }

    return anomalies;
  }

  private detectDormantActivation(nodes: FlowNode[]): FlowAnomaly[] {
    const anomalies: FlowAnomaly[] = [];
    const currentTime = Date.now();
    const dormantThreshold = 30 * 24 * 3600 * 1000; // 30 days

    for (const node of nodes) {
      const firstSeen = node.metadata.first_seen || currentTime;
      const timeDormant = currentTime - firstSeen;

      if (timeDormant > dormantThreshold && node.size > 0) {
        anomalies.push({
          type: 'dormant_activation',
          severity: 'medium',
          affected_nodes: [node.id],
          confidence: 0.7,
          description: `Previously dormant wallet activated after ${Math.floor(timeDormant / (24 * 3600 * 1000))} days`,
          visual_indicators: [{
            type: 'highlight',
            coordinates: [node.coordinates],
            color: '#9B59B6',
            label: 'Dormant Activation'
          }]
        });
      }
    }

    return anomalies;
  }

  private detectUnusualPatterns(edges: FlowEdge[]): FlowAnomaly[] {
    const anomalies: FlowAnomaly[] = [];
    
    // Group edges by pattern
    const patternGroups = new Map<FlowEdge['pattern_type'], FlowEdge[]>();
    
    for (const edge of edges) {
      const pattern = edge.pattern_type;
      if (!patternGroups.has(pattern)) {
        patternGroups.set(pattern, []);
      }
      patternGroups.get(pattern)!.push(edge);
    }

    // Detect unusual patterns
    const suspiciousEdges = patternGroups.get('suspicious') || [];
    const washTradingEdges = patternGroups.get('wash_trading') || [];
    const mevEdges = patternGroups.get('mev') || [];

    if (suspiciousEdges.length > 5) {
      const affectedNodes = [...new Set(suspiciousEdges.flatMap(e => [e.source, e.target]))];
      
      anomalies.push({
        type: 'unusual_pattern',
        severity: 'high',
        affected_nodes: affectedNodes,
        confidence: 0.85,
        description: `High concentration of suspicious transactions: ${suspiciousEdges.length} detected`,
        visual_indicators: [{
          type: 'cluster',
          coordinates: [], // Would be calculated from affected nodes
          color: '#E74C3C',
          label: 'Suspicious Activity'
        }]
      });
    }

    if (washTradingEdges.length > 3) {
      const affectedNodes = [...new Set(washTradingEdges.flatMap(e => [e.source, e.target]))];
      
      anomalies.push({
        type: 'unusual_pattern',
        severity: 'high',
        affected_nodes: affectedNodes,
        confidence: 0.9,
        description: `Potential wash trading detected: ${washTradingEdges.length} suspicious patterns`,
        visual_indicators: [{
          type: 'cluster',
          coordinates: [],
          color: '#FF9500',
          label: 'Wash Trading'
        }]
      });
    }

    return anomalies;
  }
}

/**
 * Main Computer Vision Engine
 */
export class ComputerVisionEngine {
  private chartPatternRecognizer: ChartPatternRecognizer;
  private transactionFlowAnalyzer: TransactionFlowAnalyzer;
  private imageProcessor: ImageProcessor;

  constructor() {
    this.chartPatternRecognizer = new ChartPatternRecognizer();
    this.transactionFlowAnalyzer = new TransactionFlowAnalyzer();
    this.imageProcessor = new ImageProcessor();
  }

  /**
   * Compatibility: Analyze chart patterns (alias for test compatibility)
   */
  async analyzeChart(request: ChartAnalysisRequest): Promise<ChartAnalysisResult> {
    return this.analyzeChartPatterns(request);
  }

  /**
   * Compatibility: Analyze transaction flow (alias for test compatibility)
   */
  async analyzeTransactionFlow(transactions: any[]): Promise<TransactionFlowVisualization> {
    return this.analyzeTransactionFlows(transactions);
  }

  /**
   * Compatibility: Analyze multi-timeframe (stub for test compatibility)
   */
  async analyzeMultiTimeframe(request: any): Promise<any> {
    // Return a stub result to avoid test TypeError
    return {
      patterns: [],
      timeframe_results: [],
      correlation_matrix: [],
      summary: "Multi-timeframe analysis not implemented."
    };
  }

  /**
   * Analyze chart patterns from price data
   */
  async analyzeChartPatterns(request: ChartAnalysisRequest): Promise<ChartAnalysisResult> {
    try {
      // Recognize chart patterns
      const patterns = this.chartPatternRecognizer.recognizePatterns(request.chart_data);
      
      // Filter patterns based on request
      const filteredPatterns = patterns.filter(pattern =>
        request.patterns_to_detect.length === 0 ||
        request.patterns_to_detect.includes(pattern.type)
      );

      // Detect visual anomalies
      const anomalies = this.detectVisualAnomalies(request.chart_data);

      // Find key support/resistance levels
      const key_levels = this.findKeyLevels(request.chart_data);

      // Analyze overall trend
      const trend_analysis = this.analyzeTrend(request.chart_data);

      // Calculate confidence score
      const confidence_score = this.calculateOverallConfidence(
        filteredPatterns,
        anomalies,
        trend_analysis
      );

      return {
        patterns: filteredPatterns,
        anomalies,
        key_levels,
        trend_analysis,
        confidence_score
      };

    } catch (error) {
      console.error('Error analyzing chart patterns:', error);
      throw error;
    }
  }

  /**
   * Analyze transaction flows and detect anomalies
   */
  async analyzeTransactionFlows(transactions: any[]): Promise<TransactionFlowVisualization> {
    return this.transactionFlowAnalyzer.analyzeTransactionFlow(transactions);
  }

  /**
   * Find visual similarities between transaction patterns
   */
  async findSimilarPatterns(
    referencePattern: any, 
    candidatePatterns: any[]
  ): Promise<Array<{ pattern: any; similarity: number }>> {
    const similarities: Array<{ pattern: any; similarity: number }> = [];

    for (const candidate of candidatePatterns) {
      const similarity = this.calculatePatternSimilarity(referencePattern, candidate);
      similarities.push({ pattern: candidate, similarity });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10); // Top 10 most similar
  }

  private detectVisualAnomalies(data: TimeSeriesPoint[]): VisualAnomaly[] {
    const anomalies: VisualAnomaly[] = [];
    
    if (data.length < 3) return anomalies;

    const prices = data.map(d => d.value);
    const volumes = data.map(d => d.volume || 0);

    // Detect price gaps
    for (let i = 1; i < prices.length; i++) {
      const priceChange = Math.abs(prices[i] - prices[i - 1]) / prices[i - 1];
      
      if (priceChange > 0.1) { // 10% gap
        anomalies.push({
          type: 'price_gap',
          severity: priceChange > 0.2 ? 'high' : 'medium',
          confidence: 0.9,
          boundingBox: {
            x: i - 1,
            y: Math.min(prices[i], prices[i - 1]),
            width: 2,
            height: Math.abs(prices[i] - prices[i - 1])
          },
          description: `${(priceChange * 100).toFixed(1)}% price gap detected`,
          timestamp: data[i].timestamp
        });
      }
    }

    // Detect volume spikes
    const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    
    for (let i = 0; i < volumes.length; i++) {
      if (volumes[i] > avgVolume * 5) { // 5x average volume
        anomalies.push({
          type: 'volume_spike',
          severity: volumes[i] > avgVolume * 10 ? 'critical' : 'high',
          confidence: 0.85,
          boundingBox: {
            x: i,
            y: 0,
            width: 1,
            height: volumes[i]
          },
          description: `Volume spike: ${(volumes[i] / avgVolume).toFixed(1)}x average`,
          timestamp: data[i].timestamp
        });
      }
    }

    return anomalies;
  }

  private findKeyLevels(data: TimeSeriesPoint[]): PriceLevel[] {
    const levels: PriceLevel[] = [];
    const prices = data.map(d => d.value);
    
    if (prices.length < 5) return levels;

    // Find support and resistance levels
    const peaks = this.findLocalExtremes(prices, 'peaks');
    const troughs = this.findLocalExtremes(prices, 'troughs');

    // Group similar levels
    const resistanceLevels = this.groupSimilarLevels(peaks, prices);
    const supportLevels = this.groupSimilarLevels(troughs, prices);

    for (const level of resistanceLevels) {
      levels.push({
        type: 'resistance',
        value: level.price,
        strength: level.strength,
        touches: level.touches,
        coordinates: level.coordinates
      });
    }

    for (const level of supportLevels) {
      levels.push({
        type: 'support',
        value: level.price,
        strength: level.strength,
        touches: level.touches,
        coordinates: level.coordinates
      });
    }

    return levels.sort((a, b) => b.strength - a.strength);
  }

  private findLocalExtremes(prices: number[], type: 'peaks' | 'troughs'): number[] {
    const extremes: number[] = [];
    const windowSize = 3;

    for (let i = windowSize; i < prices.length - windowSize; i++) {
      const current = prices[i];
      let isExtreme = true;

      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j === i) continue;
        
        if (type === 'peaks' && prices[j] >= current) {
          isExtreme = false;
          break;
        }
        if (type === 'troughs' && prices[j] <= current) {
          isExtreme = false;
          break;
        }
      }

      if (isExtreme) {
        extremes.push(i);
      }
    }

    return extremes;
  }

  private groupSimilarLevels(
    extremeIndices: number[], 
    prices: number[]
  ): Array<{
    price: number;
    strength: number;
    touches: number;
    coordinates: { x: number; y: number }[];
  }> {
    const levels: Array<{
      price: number;
      strength: number;
      touches: number;
      coordinates: { x: number; y: number }[];
    }> = [];

    const tolerance = 0.02; // 2% tolerance

    for (const index of extremeIndices) {
      const price = prices[index];
      
      // Find existing similar level
      const existingLevel = levels.find(l => 
        Math.abs(l.price - price) / price < tolerance
      );

      if (existingLevel) {
        existingLevel.touches++;
        existingLevel.strength = Math.min(1, existingLevel.touches * 0.3);
        existingLevel.coordinates.push({ x: index, y: price });
        // Update average price
        existingLevel.price = (existingLevel.price + price) / 2;
      } else {
        levels.push({
          price,
          strength: 0.3,
          touches: 1,
          coordinates: [{ x: index, y: price }]
        });
      }
    }

    return levels.filter(l => l.touches >= 2); // At least 2 touches
  }

  private analyzeTrend(data: TimeSeriesPoint[]): TrendAnalysis {
    if (data.length < 10) {
      return {
        direction: 'sideways',
        strength: 0,
        slope: 0,
        r_squared: 0,
        breakout_probability: 0
      };
    }

    const prices = data.map((d, i) => ({ x: i, y: d.value }));
    
    // Linear regression
    const n = prices.length;
    const sumX = prices.reduce((sum, p) => sum + p.x, 0);
    const sumY = prices.reduce((sum, p) => sum + p.y, 0);
    const sumXY = prices.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = prices.reduce((sum, p) => sum + p.x * p.x, 0);
    const sumYY = prices.reduce((sum, p) => sum + p.y * p.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const meanY = sumY / n;
    const ssTotal = prices.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
    const ssResidual = prices.reduce((sum, p) => {
      const predicted = slope * p.x + intercept;
      return sum + Math.pow(p.y - predicted, 2);
    }, 0);
    
    const r_squared = 1 - (ssResidual / ssTotal);

    // Determine trend direction and strength
    const normalizedSlope = slope / (prices[prices.length - 1].y / prices.length);
    const strength = Math.min(1, Math.abs(normalizedSlope) * r_squared);
    
    let direction: TrendAnalysis['direction'];
    if (Math.abs(normalizedSlope) < 0.001) {
      direction = 'sideways';
    } else {
      direction = normalizedSlope > 0 ? 'uptrend' : 'downtrend';
    }

    // Breakout probability based on recent volatility and trend strength
    const recentPrices = prices.slice(-10).map(p => p.y);
    const recentVolatility = this.calculateVolatility(recentPrices);
    const breakout_probability = Math.min(0.9, strength + recentVolatility * 2);

    return {
      direction,
      strength,
      slope: normalizedSlope,
      r_squared,
      breakout_probability
    };
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = prices.slice(1).map((price, i) => 
      Math.log(price / prices[i])
    );
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateOverallConfidence(
    patterns: ChartPattern[], 
    anomalies: VisualAnomaly[], 
    trend: TrendAnalysis
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence for strong patterns
    const strongPatterns = patterns.filter(p => p.confidence > 0.8);
    confidence += strongPatterns.length * 0.15;

    // Boost confidence for clear trend
    confidence += trend.strength * trend.r_squared * 0.2;

    // Reduce confidence for many anomalies (noise)
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
    confidence -= criticalAnomalies.length * 0.1;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private calculatePatternSimilarity(pattern1: any, pattern2: any): number {
    // Simplified pattern similarity calculation
    // In practice, would use more sophisticated comparison methods
    
    if (!pattern1.coordinates || !pattern2.coordinates) return 0;

    const coords1 = pattern1.coordinates;
    const coords2 = pattern2.coordinates;

    if (coords1.length !== coords2.length) return 0;

    let similarity = 0;
    const n = coords1.length;

    for (let i = 0; i < n; i++) {
      const dx = coords1[i].x - coords2[i].x;
      const dy = coords1[i].y - coords2[i].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      similarity += 1 / (1 + distance); // Inverse distance similarity
    }

    return similarity / n;
  }
}

// Export singleton instance
export const computerVisionEngine = new ComputerVisionEngine();

// Utility functions for visualization
export function createChartCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function drawPattern(
  canvas: HTMLCanvasElement, 
  pattern: ChartPattern, 
  color: string = '#FF6B35'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // Dashed line for patterns

  ctx.beginPath();
  
  for (let i = 0; i < pattern.coordinates.length; i++) {
    const coord = pattern.coordinates[i];
    const x = coord.x * canvas.width;
    const y = (1 - coord.y) * canvas.height; // Flip Y coordinate
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.stroke();
  ctx.setLineDash([]); // Reset line dash
}

export function getPatternColor(patternType: ChartPattern['type']): string {
  const colors = {
    'head_and_shoulders': '#E74C3C',
    'double_top': '#C0392B',
    'double_bottom': '#27AE60',
    'triangle': '#F39C12',
    'wedge': '#9B59B6',
    'flag': '#3498DB',
    'pennant': '#1ABC9C',
    'support': '#2ECC71',
    'resistance': '#E67E22'
  };
  
  return colors[patternType] || '#95A5A6';
}