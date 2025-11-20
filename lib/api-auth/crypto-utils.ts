/**
 * Crypto-secure utilities - SERVER-SIDE ONLY
 */

const isNode = typeof window === 'undefined';

export function generateSecureUUID(): string {
  if (isNode) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomUUID } = require('crypto');
    return randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateSecureRandomString(length: number = 9): string {
  if (isNode) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomBytes } = require('crypto');
    return randomBytes(Math.ceil(length * 0.75)).toString('hex').substring(0, length);
  }
  const array = new Uint8Array(Math.ceil(length * 0.75));
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('').substring(0, length);
}

export function generateSecureClientId(): string {
  return `client_${Date.now()}_${generateSecureRandomString(9)}`;
}

export function generateSecureActionId(): string {
  return `action_${Date.now()}_${generateSecureRandomString(9)}`;
}

export function generateSecureTestSignature(prefix: string = 'test-signature'): string {
  return `${prefix}-${generateSecureRandomString(7)}`;
}

export function generateSecureAuthToken(): string {
  return `${Date.now().toString(36)}_${generateSecureRandomString(12)}`;
}

export function generateSecureSessionToken(): string {
  return generateSecureRandomString(16) + Date.now().toString(36);
}
