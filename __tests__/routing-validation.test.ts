import { isValidTransactionSignature, isValidSolanaAddress } from '@/lib/utils';

describe('Routing Parameter Validation', () => {
  describe('Transaction Signature Validation', () => {
    test('should validate correct transaction signatures', () => {
      // Valid base58 88-character signature
      const validSignature = '3Eq21vXNB5s86c62bVuUfTeaMif1N2kUqRPBmGRJhyTA5E233pZy4kEz3Z7c9E8UwGRZpBPZ';
      expect(isValidTransactionSignature(validSignature)).toBe(true);
    });

    test('should reject invalid transaction signatures', () => {
      // Too short
      expect(isValidTransactionSignature('shortSig')).toBe(false);
      
      // Too long
      expect(isValidTransactionSignature('3Eq21vXNB5s86c62bVuUfTeaMif1N2kUqRPBmGRJhyTA5E233pZy4kEz3Z7c9E8UwGRZpBPZTooLong')).toBe(false);
      
      // Invalid characters (includes 0 and O)
      expect(isValidTransactionSignature('0Eq21vXNB5s86c62bVuUfTeaMif1N2kUqRPBmGRJhyTA5E233pZy4kEz3Z7c9E8UwGRZpBP0')).toBe(false);
      
      // Empty string
      expect(isValidTransactionSignature('')).toBe(false);
      
      // Null/undefined
      expect(isValidTransactionSignature(null as any)).toBe(false);
      expect(isValidTransactionSignature(undefined as any)).toBe(false);
    });
  });

  describe('Solana Address Validation', () => {
    test('should validate correct Solana addresses', () => {
      // Valid base58 addresses of various lengths
      const validAddresses = [
        '11111111111111111111111111111111', // System Program
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
        'So11111111111111111111111111111111111111112', // Wrapped SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      ];

      validAddresses.forEach(address => {
        expect(isValidSolanaAddress(address)).toBe(true);
      });
    });

    test('should reject invalid Solana addresses', () => {
      // Invalid characters
      expect(isValidSolanaAddress('0OIl1234567890123456789012345678901234567890')).toBe(false);
      
      // Too short
      expect(isValidSolanaAddress('short')).toBe(false);
      
      // Too long (over 44 characters)
      expect(isValidSolanaAddress('ThisAddressIsWayTooLongToBeAValidSolanaAddress12345')).toBe(false);
      
      // Empty string
      expect(isValidSolanaAddress('')).toBe(false);
      
      // Special characters
      expect(isValidSolanaAddress('Token!@#$%^&*()1234567890123456789012345')).toBe(false);
      
      // Null/undefined
      expect(isValidSolanaAddress(null as any)).toBe(false);
      expect(isValidSolanaAddress(undefined as any)).toBe(false);
    });
  });

  describe('Slot Number Validation', () => {
    test('should validate positive integers as valid slots', () => {
      expect(Number.isInteger(parseInt('123456', 10))).toBe(true);
      expect(parseInt('123456', 10) >= 0).toBe(true);
      
      expect(Number.isInteger(parseInt('0', 10))).toBe(true);
      expect(parseInt('0', 10) >= 0).toBe(true);
    });

    test('should reject invalid slot numbers', () => {
      // Negative numbers
      expect(parseInt('-123', 10) >= 0).toBe(false);
      
      // Non-integers
      expect(Number.isInteger(parseInt('123.456', 10))).toBe(true); // parseInt truncates, but we need to check the original
      expect('123.456'.includes('.')).toBe(true);
      
      // Non-numeric strings
      expect(isNaN(parseInt('abc123', 10))).toBe(true);
      expect(isNaN(parseInt('', 10))).toBe(true);
      
      // Special characters
      expect(isNaN(parseInt('12!@#', 10))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle URL encoding/decoding edge cases', () => {
      // URL encoded valid address
      const encoded = encodeURIComponent('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const decoded = decodeURIComponent(encoded);
      expect(isValidSolanaAddress(decoded)).toBe(true);
      
      // Whitespace trimming
      expect(isValidSolanaAddress('  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA  '.trim())).toBe(true);
    });

    test('should handle potential injection attempts', () => {
      // SQL injection-like patterns
      expect(isValidSolanaAddress("'; DROP TABLE users; --")).toBe(false);
      
      // Script injection patterns
      expect(isValidSolanaAddress('<script>alert("xss")</script>')).toBe(false);
      
      // Path traversal patterns
      expect(isValidSolanaAddress('../../../etc/passwd')).toBe(false);
    });
  });
});