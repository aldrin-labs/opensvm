import { 
  isValidTransactionSignature, 
  isValidSolanaAddress,
  isValidSlot,
  containsSecurityThreats,
} from '@/lib/validators';

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
      expect(isValidSlot('123456')).toBe(true);
      expect(isValidSlot('0')).toBe(true);
      expect(isValidSlot('999999999')).toBe(true);
    });

    test('should reject invalid slot numbers', () => {
      // Negative numbers
      expect(isValidSlot('-123')).toBe(false);
      
      // Decimal numbers (this was the main issue!)
      expect(isValidSlot('123.456')).toBe(false);
      expect(isValidSlot('0.5')).toBe(false);
      
      // Non-numeric strings
      expect(isValidSlot('abc123')).toBe(false);
      expect(isValidSlot('')).toBe(false);
      expect(isValidSlot('slot')).toBe(false);
      
      // Special characters
      expect(isValidSlot('12!@#')).toBe(false);
      expect(isValidSlot('12_34')).toBe(false);
      expect(isValidSlot('12,34')).toBe(false);
      
      // Whitespace
      expect(isValidSlot(' 123 ')).toBe(false);
      expect(isValidSlot('123 ')).toBe(false);
      expect(isValidSlot(' 123')).toBe(false);
      
      // Null/undefined
      expect(isValidSlot(null as any)).toBe(false);
      expect(isValidSlot(undefined as any)).toBe(false);
    });
  });

  describe('Security Threat Detection', () => {
    test('should detect SQL injection attempts', () => {
      expect(containsSecurityThreats("'; DROP TABLE users; --")).toBe(true);
      expect(containsSecurityThreats("' OR 1=1 --")).toBe(true);
      expect(containsSecurityThreats("/* comment */")).toBe(true);
    });

    test('should detect XSS attempts', () => {
      expect(containsSecurityThreats('<script>alert("xss")</script>')).toBe(true);
      expect(containsSecurityThreats('<img onload="alert(1)">')).toBe(true);
      expect(containsSecurityThreats('<div onclick="evil()">')).toBe(true);
    });

    test('should detect path traversal attempts', () => {
      expect(containsSecurityThreats('../../../etc/passwd')).toBe(true);
      expect(containsSecurityThreats('..\\..\\windows\\system32')).toBe(true);
      expect(containsSecurityThreats('..%2f..%2fetc%2fpasswd')).toBe(true);
    });

    test('should detect command injection attempts', () => {
      expect(containsSecurityThreats('address; rm -rf /')).toBe(true);
      expect(containsSecurityThreats('address && whoami')).toBe(true);
      expect(containsSecurityThreats('address | cat /etc/passwd')).toBe(true);
      expect(containsSecurityThreats('address`whoami`')).toBe(true);
      expect(containsSecurityThreats('address$(whoami)')).toBe(true);
    });

    test('should allow valid blockchain parameters', () => {
      expect(containsSecurityThreats('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe(false);
      expect(containsSecurityThreats('3Eq21vXNB5s86c62bVuUfTeaMif1N2kUqRPBmGRJhyTA5E233pZy4kEz3Z7c9E8UwGRZpBPZ')).toBe(false);
      expect(containsSecurityThreats('123456')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle URL encoding/decoding edge cases', () => {
      // URL encoded valid address
      const encoded = encodeURIComponent('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
      const decoded = decodeURIComponent(encoded);
      expect(isValidSolanaAddress(decoded)).toBe(true);
      
      // Note: We don't auto-trim in validators - this should be done in route handlers
      expect(isValidSolanaAddress('  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA  ')).toBe(false);
      expect(isValidSolanaAddress('  TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA  '.trim())).toBe(true);
    });
  });
});