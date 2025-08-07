import { createHash, randomBytes } from 'crypto';

const KEY_PREFIX = 'svmai_';
const KEY_LENGTH = 32;

export function generateAPIKey(): string {
  const randomPart = randomBytes(KEY_LENGTH).toString('hex');
  const checksum = calculateChecksum(randomPart);
  return `${KEY_PREFIX}${randomPart}_${checksum}`;
}

export function generateKeyId(): string {
  return randomBytes(16).toString('hex');
}

export function hashAPIKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function validateKeyFormat(key: string): boolean {
  if (!key.startsWith(KEY_PREFIX)) {
    return false;
  }
  
  const parts = key.split('_');
  if (parts.length !== 3) {
    return false;
  }
  
  const [prefix, randomPart, checksum] = parts;
  if (prefix !== 'svmai' || randomPart.length !== KEY_LENGTH * 2 || checksum.length !== 8) {
    return false;
  }
  
  return true;
}

export function verifyKeyChecksum(key: string): boolean {
  if (!validateKeyFormat(key)) {
    return false;
  }
  
  const parts = key.split('_');
  const [, randomPart, providedChecksum] = parts;
  const expectedChecksum = calculateChecksum(randomPart);
  
  return providedChecksum === expectedChecksum;
}

export function getKeyPrefix(): string {
  return KEY_PREFIX;
}

function calculateChecksum(data: string): string {
  return createHash('md5').update(data).digest('hex').substring(0, 8);
}

export function extractKeyId(key: string): string | null {
  if (!validateKeyFormat(key)) {
    return null;
  }
  
  const parts = key.split('_');
  return createHash('sha256').update(parts[1]).digest('hex').substring(0, 16);
}

export function isValidKeyId(keyId: string): boolean {
  return /^[a-f0-9]{32}$/.test(keyId);
}