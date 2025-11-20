/**
 * Authentication utilities for Solana wallet-based sessions
 */

import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { nanoid } from 'nanoid';

export interface SessionData {
  sessionKey: string;
  walletAddress: string;
  signature: string;
  timestamp: number;
  expiresAt: number;
}

/**
 * Generate a session key for signing
 */
export function generateSessionKey(): string {
  return nanoid(32);
}

/**
 * Create the message to be signed by the wallet
 */
export function createSignMessage(sessionKey: string, walletAddress: string): string {
  const timestamp = Date.now();
  return `OpenSVM Authentication\n\nSession Key: ${sessionKey}\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\n\nPlease sign this message to authenticate with OpenSVM.`;
}

/**
 * Verify a signature for a given message and public key
 * Note: This is a simplified verification for development.
 * In production, you would use proper cryptographic verification.
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    // Development mode - be more lenient with signature verification
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_BYPASS_TOKEN_GATING === 'true') {
      // Basic validation: ensure all required fields are present and not empty
      return !!(message && signature && publicKey && 
               message.trim() && signature.trim() && publicKey.trim() &&
               publicKey.length >= 32 && signature.length >= 10);
    }
    
    // Try to decode signature as base64 first (matching useAuth.ts encoding)
    try {
      const signatureBytes = Buffer.from(signature, 'base64');
      const publicKeyObj = new PublicKey(publicKey);
      
      // Basic validation for now
      return signatureBytes.length >= 32 && publicKeyObj.toBase58() === publicKey;
    } catch (base64Error) {
      // Fallback to bs58 decoding for backward compatibility
      const signatureBytes = bs58.decode(signature);
      const publicKeyObj = new PublicKey(publicKey);
      
      // Basic validation for now
      return signatureBytes.length >= 32 && publicKeyObj.toBase58() === publicKey;
    }
  } catch (error) {
    console.error('Signature verification error:', error);
    
    // In development, allow authentication even if signature verification fails
    if (process.env.NODE_ENV === 'development') {
      console.warn('Development mode: allowing authentication despite signature verification error');
      return !!(message && signature && publicKey);
    }
    
    return false;
  }
}

/**
 * Validate session for API requests (server-side only)
 * This function is deprecated - use getSessionFromCookie() in auth-server.ts instead
 */
export function validateSession(_request: Request): SessionData | null {
  try {
    // This function needs to be implemented in the server context
    // where cookies() is available. For now, return null.
    // This will be handled in the individual API route files.
    return null;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}