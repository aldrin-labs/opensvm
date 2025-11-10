import crypto from 'crypto';

/**
 * Encryption utilities for SVM Bank
 * Uses AES-256-GCM for encrypting private keys
 * Encryption key is derived from server secret + user's public key
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Derives an encryption key from the server secret and user's wallet address
 */
function deriveKey(userWalletAddress: string): Buffer {
  const serverSecret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!serverSecret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET not configured');
  }

  // Combine server secret with user's wallet address
  const combined = `${serverSecret}:${userWalletAddress}`;
  
  // Use a fixed salt derived from the wallet address for deterministic key derivation
  const salt = crypto.createHash('sha256').update(userWalletAddress).digest();
  
  // Derive key using PBKDF2
  return crypto.pbkdf2Sync(combined, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts a private key (Uint8Array or Buffer) for storage
 */
export function encryptPrivateKey(
  privateKey: Uint8Array | Buffer,
  userWalletAddress: string
): string {
  const key = deriveKey(userWalletAddress);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(privateKey)),
    cipher.final()
  ]);
  
  const tag = cipher.getAuthTag();
  
  // Combine IV + encrypted data + auth tag
  const combined = Buffer.concat([iv, encrypted, tag]);
  
  // Return as base64 string
  return combined.toString('base64');
}

/**
 * Decrypts a private key from storage
 */
export function decryptPrivateKey(
  encryptedData: string,
  userWalletAddress: string
): Uint8Array {
  const key = deriveKey(userWalletAddress);
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return new Uint8Array(decrypted);
}

/**
 * Validates that encryption/decryption works correctly
 */
export function testEncryption(userWalletAddress: string): boolean {
  try {
    const testData = crypto.randomBytes(64);
    const encrypted = encryptPrivateKey(testData, userWalletAddress);
    const decrypted = decryptPrivateKey(encrypted, userWalletAddress);
    
    return Buffer.from(testData).equals(Buffer.from(decrypted));
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}
