import crypto from 'crypto';

/**
 * Encryption utilities for SVM Bank
 * Uses AES-256-GCM for encrypting private keys
 * Encryption key is derived from server secret + user's public key + random salt
 *
 * Storage format (v2): VERSION(1) + SALT(64) + IV(16) + CIPHERTEXT + TAG(16)
 * Legacy format (v1): IV(16) + CIPHERTEXT + TAG(16)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;
const CURRENT_VERSION = 2;

/**
 * Derives an encryption key from the server secret, user's wallet address, and salt
 */
function deriveKey(userWalletAddress: string, salt: Buffer): Buffer {
  const serverSecret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!serverSecret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET not configured');
  }

  // Combine server secret with user's wallet address
  const combined = `${serverSecret}:${userWalletAddress}`;

  // Derive key using PBKDF2 with the provided salt
  return crypto.pbkdf2Sync(combined, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Legacy key derivation (v1) - deterministic salt from wallet address
 * @deprecated Use deriveKey with random salt instead
 */
function deriveKeyLegacy(userWalletAddress: string): Buffer {
  const serverSecret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!serverSecret) {
    throw new Error('API_KEY_ENCRYPTION_SECRET not configured');
  }

  const combined = `${serverSecret}:${userWalletAddress}`;
  const salt = crypto.createHash('sha256').update(userWalletAddress).digest();
  return crypto.pbkdf2Sync(combined, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts a private key (Uint8Array or Buffer) for storage
 * Uses random salt for each encryption (v2 format)
 */
export function encryptPrivateKey(
  privateKey: Uint8Array | Buffer,
  userWalletAddress: string
): string {
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key with random salt
  const key = deriveKey(userWalletAddress, salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(privateKey)),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  // Combine: VERSION(1 byte) + SALT(64) + IV(16) + encrypted data + auth tag(16)
  const versionByte = Buffer.alloc(1);
  versionByte.writeUInt8(CURRENT_VERSION, 0);

  const combined = Buffer.concat([versionByte, salt, iv, encrypted, tag]);

  // Return as base64 string
  return combined.toString('base64');
}

/**
 * Decrypts a private key from storage
 * Supports both v2 (random salt) and v1 (legacy deterministic salt) formats
 */
export function decryptPrivateKey(
  encryptedData: string,
  userWalletAddress: string
): Uint8Array {
  const combined = Buffer.from(encryptedData, 'base64');

  // Check version byte to determine format
  const version = combined.length > (SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1)
    ? combined.readUInt8(0)
    : 1; // Legacy format (no version byte)

  if (version === 2) {
    // V2 format: VERSION(1) + SALT(64) + IV(16) + CIPHERTEXT + TAG(16)
    const salt = combined.subarray(1, 1 + SALT_LENGTH);
    const iv = combined.subarray(1 + SALT_LENGTH, 1 + SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(combined.length - TAG_LENGTH);
    const encrypted = combined.subarray(1 + SALT_LENGTH + IV_LENGTH, combined.length - TAG_LENGTH);

    const key = deriveKey(userWalletAddress, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return new Uint8Array(decrypted);
  } else {
    // V1 Legacy format: IV(16) + CIPHERTEXT + TAG(16)
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(combined.length - TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

    const key = deriveKeyLegacy(userWalletAddress);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return new Uint8Array(decrypted);
  }
}

/**
 * Re-encrypts a private key with the new v2 format (random salt)
 * Use this to migrate legacy v1 encrypted keys
 */
export function reencryptPrivateKey(
  encryptedData: string,
  userWalletAddress: string
): string {
  // First decrypt with whatever format it's in
  const privateKey = decryptPrivateKey(encryptedData, userWalletAddress);
  // Then re-encrypt with v2 format
  return encryptPrivateKey(privateKey, userWalletAddress);
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
