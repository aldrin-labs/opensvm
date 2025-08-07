/**
 * Tensor Operations and Utilities for OpenSVM ML Pipeline
 * 
 * Provides efficient tensor operations for machine learning models
 * without requiring external ML frameworks in the browser.
 */

import type { TensorData } from '../types';

export class TensorUtils {
  /**
   * Create a tensor from array data
   */
  static createTensor(data: number[], shape: number[], dtype: 'float32' | 'int32' | 'uint8' = 'float32'): TensorData {
    const expectedSize = shape.reduce((a, b) => a * b, 1);
    if (data.length !== expectedSize) {
      throw new Error(`Data size ${data.length} does not match shape ${shape} (expected ${expectedSize})`);
    }

    return {
      shape,
      data: [...data], // clone array
      dtype
    };
  }

  /**
   * Reshape a tensor to new dimensions
   */
  static reshape(tensor: TensorData, newShape: number[]): TensorData {
    const oldSize = tensor.shape.reduce((a, b) => a * b, 1);
    const newSize = newShape.reduce((a, b) => a * b, 1);
    
    if (oldSize !== newSize) {
      throw new Error(`Cannot reshape tensor: size mismatch (${oldSize} vs ${newSize})`);
    }

    return {
      ...tensor,
      shape: [...newShape]
    };
  }

  /**
   * Normalize tensor values to [0, 1] range
   */
  static normalize(tensor: TensorData): TensorData {
    const data = [...tensor.data];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    if (range === 0) return tensor;

    const normalized = data.map(x => (x - min) / range);
    
    return {
      ...tensor,
      data: normalized
    };
  }

  /**
   * Standardize tensor values (zero mean, unit variance)
   */
  static standardize(tensor: TensorData): TensorData {
    const data = [...tensor.data];
    const mean = data.reduce((sum, x) => sum + x, 0) / data.length;
    const variance = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / data.length;
    const std = Math.sqrt(variance);

    if (std === 0) return tensor;

    const standardized = data.map(x => (x - mean) / std);

    return {
      ...tensor,
      data: standardized
    };
  }

  /**
   * Apply sliding window to time series data
   */
  static slidingWindow(tensor: TensorData, windowSize: number, stride: number = 1): TensorData[] {
    if (tensor.shape.length !== 1) {
      throw new Error('Sliding window only supports 1D tensors');
    }

    const data = tensor.data;
    const windows: TensorData[] = [];

    for (let i = 0; i <= data.length - windowSize; i += stride) {
      const window = data.slice(i, i + windowSize);
      windows.push(this.createTensor(window, [windowSize], tensor.dtype));
    }

    return windows;
  }

  /**
   * Matrix multiplication for 2D tensors
   */
  static matmul(a: TensorData, b: TensorData): TensorData {
    if (a.shape.length !== 2 || b.shape.length !== 2) {
      throw new Error('Matrix multiplication requires 2D tensors');
    }

    const [aRows, aCols] = a.shape;
    const [bRows, bCols] = b.shape;

    if (aCols !== bRows) {
      throw new Error(`Cannot multiply matrices: incompatible dimensions (${aRows}x${aCols}) x (${bRows}x${bCols})`);
    }

    const result = new Array(aRows * bCols).fill(0);

    for (let i = 0; i < aRows; i++) {
      for (let j = 0; j < bCols; j++) {
        let sum = 0;
        for (let k = 0; k < aCols; k++) {
          sum += a.data[i * aCols + k] * b.data[k * bCols + j];
        }
        result[i * bCols + j] = sum;
      }
    }

    return this.createTensor(result, [aRows, bCols], 'float32');
  }

  /**
   * Element-wise operations
   */
  static add(a: TensorData, b: TensorData): TensorData {
    this.validateSameShape(a, b);
    const result = a.data.map((x, i) => x + b.data[i]);
    return { ...a, data: result };
  }

  static subtract(a: TensorData, b: TensorData): TensorData {
    this.validateSameShape(a, b);
    const result = a.data.map((x, i) => x - b.data[i]);
    return { ...a, data: result };
  }

  static multiply(a: TensorData, b: TensorData): TensorData {
    this.validateSameShape(a, b);
    const result = a.data.map((x, i) => x * b.data[i]);
    return { ...a, data: result };
  }

  static divide(a: TensorData, b: TensorData): TensorData {
    this.validateSameShape(a, b);
    const result = a.data.map((x, i) => x / b.data[i]);
    return { ...a, data: result };
  }

  /**
   * Scalar operations
   */
  static addScalar(tensor: TensorData, scalar: number): TensorData {
    const result = tensor.data.map(x => x + scalar);
    return { ...tensor, data: result };
  }

  static multiplyScalar(tensor: TensorData, scalar: number): TensorData {
    const result = tensor.data.map(x => x * scalar);
    return { ...tensor, data: result };
  }

  /**
   * Activation functions
   */
  static relu(tensor: TensorData): TensorData {
    const result = tensor.data.map(x => Math.max(0, x));
    return { ...tensor, data: result };
  }

  static sigmoid(tensor: TensorData): TensorData {
    const result = tensor.data.map(x => 1 / (1 + Math.exp(-x)));
    return { ...tensor, data: result };
  }

  static tanh(tensor: TensorData): TensorData {
    const result = tensor.data.map(x => Math.tanh(x));
    return { ...tensor, data: result };
  }

  static softmax(tensor: TensorData): TensorData {
    const maxVal = Math.max(...tensor.data);
    const expValues = tensor.data.map(x => Math.exp(x - maxVal));
    const sumExp = expValues.reduce((sum, x) => sum + x, 0);
    const result = expValues.map(x => x / sumExp);
    return { ...tensor, data: result };
  }

  /**
   * Reduction operations
   */
  static sum(tensor: TensorData, axis?: number): TensorData {
    if (axis === undefined) {
      const total = tensor.data.reduce((sum, x) => sum + x, 0);
      return this.createTensor([total], [1], tensor.dtype);
    }
    
    // Implement axis-specific sum
    throw new Error('Axis-specific sum not implemented yet');
  }

  static mean(tensor: TensorData, axis?: number): TensorData {
    if (axis === undefined) {
      const avg = tensor.data.reduce((sum, x) => sum + x, 0) / tensor.data.length;
      return this.createTensor([avg], [1], tensor.dtype);
    }
    
    throw new Error('Axis-specific mean not implemented yet');
  }

  static max(tensor: TensorData): number {
    return Math.max(...tensor.data);
  }

  static min(tensor: TensorData): number {
    return Math.min(...tensor.data);
  }

  /**
   * Statistical operations
   */
  static variance(tensor: TensorData): number {
    const mean = tensor.data.reduce((sum, x) => sum + x, 0) / tensor.data.length;
    const variance = tensor.data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / tensor.data.length;
    return variance;
  }

  static std(tensor: TensorData): number {
    return Math.sqrt(this.variance(tensor));
  }

  static correlation(a: TensorData, b: TensorData): number {
    this.validateSameShape(a, b);
    
    const n = a.data.length;
    const meanA = a.data.reduce((sum, x) => sum + x, 0) / n;
    const meanB = b.data.reduce((sum, x) => sum + x, 0) / n;
    
    let numerator = 0;
    let sumSquareA = 0;
    let sumSquareB = 0;
    
    for (let i = 0; i < n; i++) {
      const diffA = a.data[i] - meanA;
      const diffB = b.data[i] - meanB;
      
      numerator += diffA * diffB;
      sumSquareA += diffA * diffA;
      sumSquareB += diffB * diffB;
    }
    
    const denominator = Math.sqrt(sumSquareA * sumSquareB);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Utility functions
   */
  static validateSameShape(a: TensorData, b: TensorData): void {
    if (a.shape.length !== b.shape.length || 
        !a.shape.every((dim, i) => dim === b.shape[i])) {
      throw new Error(`Shape mismatch: ${JSON.stringify(a.shape)} vs ${JSON.stringify(b.shape)}`);
    }
  }

  static clone(tensor: TensorData): TensorData {
    return {
      shape: [...tensor.shape],
      data: [...tensor.data],
      dtype: tensor.dtype
    };
  }

  static equals(a: TensorData, b: TensorData, tolerance: number = 1e-7): boolean {
    if (a.shape.length !== b.shape.length || 
        !a.shape.every((dim, i) => dim === b.shape[i])) {
      return false;
    }
    
    return a.data.every((val, i) => Math.abs(val - b.data[i]) <= tolerance);
  }

  /**
   * Convert tensor to different data types
   */
  static asType(tensor: TensorData, dtype: 'float32' | 'int32' | 'uint8'): TensorData {
    if (tensor.dtype === dtype) return tensor;
    
    let convertedData: number[];
    
    switch (dtype) {
      case 'int32':
        convertedData = tensor.data.map(x => Math.round(x));
        break;
      case 'uint8':
        convertedData = tensor.data.map(x => Math.max(0, Math.min(255, Math.round(x))));
        break;
      case 'float32':
      default:
        convertedData = tensor.data.map(x => Number(x));
        break;
    }
    
    return {
      ...tensor,
      data: convertedData,
      dtype
    };
  }

  /**
   * Print tensor information for debugging
   */
  static info(tensor: TensorData): string {
    return `Tensor(shape: [${tensor.shape.join(', ')}], dtype: ${tensor.dtype}, size: ${tensor.data.length})`;
  }
}

/**
 * Specialized operations for time series data
 */
export class TimeSeriesTensorUtils {
  /**
   * Create sequences for RNN/LSTM training
   */
  static createSequences(data: number[], sequenceLength: number, targetOffset: number = 1): { inputs: TensorData[], targets: TensorData[] } {
    const inputs: TensorData[] = [];
    const targets: TensorData[] = [];

    for (let i = 0; i < data.length - sequenceLength - targetOffset + 1; i++) {
      const inputSequence = data.slice(i, i + sequenceLength);
      const target = data[i + sequenceLength + targetOffset - 1];
      
      inputs.push(TensorUtils.createTensor(inputSequence, [sequenceLength], 'float32'));
      targets.push(TensorUtils.createTensor([target], [1], 'float32'));
    }

    return { inputs, targets };
  }

  /**
   * Apply technical indicators to time series
   */
  static movingAverage(tensor: TensorData, window: number): TensorData {
    const data = tensor.data;
    const ma: number[] = [];

    for (let i = window - 1; i < data.length; i++) {
      const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      ma.push(sum / window);
    }

    return TensorUtils.createTensor(ma, [ma.length], tensor.dtype);
  }

  static exponentialMovingAverage(tensor: TensorData, alpha: number): TensorData {
    const data = tensor.data;
    const ema: number[] = [data[0]];

    for (let i = 1; i < data.length; i++) {
      ema.push(alpha * data[i] + (1 - alpha) * ema[i - 1]);
    }

    return TensorUtils.createTensor(ema, [ema.length], tensor.dtype);
  }

  static rsi(tensor: TensorData, period: number = 14): TensorData {
    const data = tensor.data;
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate gains and losses
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    const rsi: number[] = [];
    
    // Calculate first RSI value
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period - 1; i < gains.length; i++) {
      if (i > period - 1) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      }
      
      const rs = avgGain / (avgLoss || 0.0001); // Avoid division by zero
      rsi.push(100 - (100 / (1 + rs)));
    }

    return TensorUtils.createTensor(rsi, [rsi.length], tensor.dtype);
  }

  static bolllingerBands(tensor: TensorData, period: number = 20, stdDev: number = 2): {
    upper: TensorData;
    middle: TensorData;
    lower: TensorData;
  } {
    const data = tensor.data;
    const upper: number[] = [];
    const middle: number[] = [];
    const lower: number[] = [];

    for (let i = period - 1; i < data.length; i++) {
      const window = data.slice(i - period + 1, i + 1);
      const mean = window.reduce((a, b) => a + b, 0) / period;
      const variance = window.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / period;
      const std = Math.sqrt(variance);

      middle.push(mean);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }

    return {
      upper: TensorUtils.createTensor(upper, [upper.length], tensor.dtype),
      middle: TensorUtils.createTensor(middle, [middle.length], tensor.dtype),
      lower: TensorUtils.createTensor(lower, [lower.length], tensor.dtype)
    };
  }
}