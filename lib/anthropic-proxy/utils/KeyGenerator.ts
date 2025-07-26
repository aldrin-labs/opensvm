import crypto from 'crypto';

/**
 * Generates Anthropic-compatible API keys in format: sk-ant-api03-[data]
 * Based on Anthropic's key format specification
 */

const KEY_PREFIX = 'sk-ant-api03-';
const KEY_DATA_LENGTH = 64; // Base64 encoded data length

export interface KeyComponents {
  version: string;
  userId: string;
  randomData: string;
  checksum: string;
}

/**
 * Generate a new Anthropic-compatible API key
 */
export function generateAPIKey(userId: string): string {
  // Version (2 bytes)
  const version = '01';
  
  // User ID hash (16 bytes) - hash the userId to fixed length
  const userIdHash = crypto
    .createHash('sha256')
    .update(userId)
    .digest('hex')
    .substring(0, 32); // 16 bytes = 32 hex chars
  
  // Random data (32 bytes)
  const randomData = crypto.randomBytes(32).toString('hex');
  
  // Combine data
  const combinedData = version + userIdHash + randomData;
  
  // Calculate checksum (4 bytes)
  const checksum = crypto
    .createHash('sha256')
    .update(combinedData)
    .digest('hex')
    .substring(0, 8); // 4 bytes = 8 hex chars
  
  // Final data with checksum
  const finalData = combinedData + checksum;
  
  // Convert to base64 and create key
  const base64Data = Buffer.from(finalData, 'hex').toString('base64');
  
  return KEY_PREFIX + base64Data;
}

/**
 * Validate API key format
 */
export function validateKeyFormat(key: string): boolean {
  if (!key.startsWith(KEY_PREFIX)) {
    return false;
  }
  
  const data = key.substring(KEY_PREFIX.length);
  
  // Check if it's valid base64
  try {
    const decoded = Buffer.from(data, 'base64');
    return decoded.length >= 54; // Minimum expected length
  } catch {
    return false;
  }
}

/**
 * Extract components from API key
 */
export function extractKeyComponents(key: string): KeyComponents | null {
  if (!validateKeyFormat(key)) {
    return null;
  }
  
  try {
    const data = key.substring(KEY_PREFIX.length);
    const decoded = Buffer.from(data, 'base64').toString('hex');
    
    return {
      version: decoded.substring(0, 2),
      userId: decoded.substring(2, 34),
      randomData: decoded.substring(34, 98),
      checksum: decoded.substring(98, 106)
    };
  } catch {
    return null;
  }
}

/**
 * Verify key checksum
 */
export function verifyKeyChecksum(key: string): boolean {
  const components = extractKeyComponents(key);
  if (!components) {
    return false;
  }
  
  const combinedData = components.version + components.userId + components.randomData;
  const expectedChecksum = crypto
    .createHash('sha256')
    .update(combinedData)
    .digest('hex')
    .substring(0, 8);
  
  return components.checksum === expectedChecksum;
}

/**
 * Hash API key for secure storage
 */
export function hashAPIKey(key: string): string {
  return crypto
    .createHash('sha256')
    .update(key)
    .digest('hex');
}

/**
 * Get key prefix for display (first 8 chars after prefix)
 */
export function getKeyPrefix(key: string): string {
  if (!key.startsWith(KEY_PREFIX)) {
    return '';
  }
  
  const data = key.substring(KEY_PREFIX.length);
  return KEY_PREFIX + data.substring(0, 8) + '...';
}

/**
 * Generate a secure random key ID
 */
export function generateKeyId(): string {
  return crypto.randomUUID();
}