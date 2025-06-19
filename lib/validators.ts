import DOMPurify from 'dompurify';
/**
 * Shared validation functions for routing parameters
 * Prevents code duplication across middleware and route components
 */

/**
 * Validates if a string contains only valid base58 characters
 */
export const isValidBase58 = (str: string): boolean => {
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
};

/**
 * Validates if a string is a valid Solana transaction signature
 * Signatures are exactly 88 characters long and contain only base58 characters
 */
export const isValidTransactionSignature = (signature: string): boolean => {
  return signature && signature.length === 88 && isValidBase58(signature);
};

/**
 * Validates if a string is a valid Solana address
 * Addresses are between 32-44 characters long and contain only base58 characters
 */
export const isValidSolanaAddress = (address: string): boolean => {
  return address && address.length >= 32 && address.length <= 44 && isValidBase58(address);
};

/**
 * Validates if a string is a valid slot number
 * Slots must be positive integers (including 0) with no decimal points
 * Uses regex to ensure the entire string is a valid integer
 */
export const isValidSlot = (slot: string): boolean => {
  // Use regex to ensure the entire string is digits only
  // This prevents issues with parseInt truncating decimals (e.g., "123.456" -> 123)
  if (!slot || !/^\d+$/.test(slot)) {
    return false;
  }
  
  // Additional check for reasonable slot bounds
  const slotNumber = parseInt(slot, 10);
  return slotNumber >= 0 && slotNumber <= 9007199254740991; // MAX_SAFE_INTEGER value
};

/**
 * Validates if a string is a valid program address
 * Same validation as Solana addresses
 */
export const isValidProgramAddress = (address: string): boolean => {
  return isValidSolanaAddress(address);
};

/**
 * Validates if a string is a valid mint address
 * Same validation as Solana addresses
 */
export const isValidMintAddress = (address: string): boolean => {
  return isValidSolanaAddress(address);
};

/**
 * Checks for potential security threats in input strings
 * Rejects strings containing common injection patterns
 */
export const containsSecurityThreats = (input: string): boolean => {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Use DOMPurify to sanitize the input
  const sanitizedInput = DOMPurify.sanitize(input);

  // Check for common injection patterns
  const dangerousPatterns = [
    // SQL injection patterns
    /('|\\'|;\s*--|;\s*\/\*)/i,
    // XSS patterns (already sanitized by DOMPurify)
    // Removed script tag regex; replaced with DOMPurify sanitization.
    // Path traversal patterns
    /\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c/i,
    // Command injection patterns
    /[;&|`$(){}[\]]/,
  ];

  return dangerousPatterns.some(pattern => pattern.test(sanitizedInput));
};

/**
 * Sanitizes a parameter string by removing potentially harmful characters
 * Used as a fallback when validation fails but we want to attempt recovery
 */
export const sanitizeParameter = (param: string): string => {
  if (!param || typeof param !== 'string') {
    return '';
  }

  // Remove potentially harmful characters while preserving valid base58 characters
  return param.replace(/[^1-9A-HJ-NP-Za-km-z]/g, '');
};