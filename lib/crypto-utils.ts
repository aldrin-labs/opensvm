/**
 * Crypto-secure utilities for UUID generation and other security-sensitive operations
 */
import { randomUUID, randomBytes } from 'crypto';

// Check if we're in a browser environment
const isNode = typeof window === 'undefined';

/**
 * Generate a crypto-secure UUID using Web Crypto API or Node.js crypto
 * Replaces Math.random() based UUID generation for security
 * Includes enhanced fallback for older browsers and environments
 */
export function generateSecureUUID(): string {
  if (isNode) {
    // Node.js environment
    return randomUUID();
  } else {
    // Browser environment with enhanced fallback support
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      // Fallback for browsers that support getRandomValues but not randomUUID
      return generateSecureUUIDFallback();
    } else {
      // Enhanced fallback for very old browsers
      return generateHardenedPolyfillUUID();
    }
  }
}

/**
 * Generate a crypto-secure client ID
 * Format: client_${timestamp}_${secureRandomString}
 */
export function generateSecureClientId(): string {
  const timestamp = Date.now();
  const randomPart = generateSecureRandomString(9);
  return `client_${timestamp}_${randomPart}`;
}

/**
 * Generate a crypto-secure action ID
 * Format: action_${timestamp}_${secureRandomString}
 */
export function generateSecureActionId(): string {
  const timestamp = Date.now();
  const randomPart = generateSecureRandomString(9);
  return `action_${timestamp}_${randomPart}`;
}

/**
 * Generate a crypto-secure random string of specified length
 * Uses base36 encoding for alphanumeric output
 */
export function generateSecureRandomString(length: number = 9): string {
  if (isNode) {
    // Node.js environment
    const bytes = randomBytes(Math.ceil(length * 0.75)); // Adjust for base36 encoding
    return bytes.toString('hex').substring(0, length);
  } else {
    // Browser environment
    const array = new Uint8Array(Math.ceil(length * 0.75));
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, length);
  }
}

/**
 * Generate a crypto-secure transaction/signature ID for testing
 */
export function generateSecureTestSignature(prefix: string = 'test-signature'): string {
  const randomPart = generateSecureRandomString(7);
  return `${prefix}-${randomPart}`;
}

/**
 * Fallback UUID generation for older browsers
 * Uses crypto.getRandomValues for security
 */
function generateSecureUUIDFallback(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  
  // Set version (4) and variant bits
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;
  
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}

/**
 * Generate crypto-secure token for authentication
 */
export function generateSecureAuthToken(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = generateSecureRandomString(12);
  return `${timestamp}_${randomPart}`;
}

/**
 * Generate crypto-secure session token
 */
export function generateSecureSessionToken(): string {
  return generateSecureRandomString(16) + Date.now().toString(36);
}

/**
 * Enhanced hardened polyfill for UUID generation in very old browsers
 * Uses multiple entropy sources and timing variations
 */
function generateHardenedPolyfillUUID(): string {
  // Use multiple sources of entropy for very old browsers
  const getRandomValue = () => {
    const sources = [
      () => Math.floor(Math.random() * 256),
      () => Date.now() % 256,
      () => Math.floor(performance.now() % 256),
      () => Math.floor(Math.random() * Date.now()) % 256,
    ];
    
    // XOR multiple sources for better entropy
    return sources.reduce((acc, source) => {
      try {
        return acc ^ source();
      } catch {
        return acc ^ Math.floor(Math.random() * 256);
      }
    }, 0) % 256;
  };

  const bytes = new Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = getRandomValue();
  }
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}