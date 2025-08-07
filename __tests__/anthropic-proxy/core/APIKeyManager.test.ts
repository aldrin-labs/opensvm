import { APIKeyManager } from '../../../lib/anthropic-proxy/core/APIKeyManager';
import { KeyStorage } from '../../../lib/anthropic-proxy/storage/KeyStorage';

// Mock the KeyStorage
jest.mock('../../../lib/anthropic-proxy/storage/KeyStorage');

// Mock all KeyGenerator functions
jest.mock('../../../lib/anthropic-proxy/utils/KeyGenerator', () => ({
  ...jest.requireActual('../../../lib/anthropic-proxy/utils/KeyGenerator'),
  validateKeyFormat: jest.fn(),
  verifyKeyChecksum: jest.fn(),
  generateAPIKey: jest.fn(),
  generateKeyId: jest.fn(),
  hashAPIKey: jest.fn(),
  getKeyPrefix: jest.fn()
}));

// Import the mocked functions
import { validateKeyFormat, verifyKeyChecksum } from '../../../lib/anthropic-proxy/utils/KeyGenerator';

const MockedKeyStorage = KeyStorage as jest.MockedClass<typeof KeyStorage>;

describe('APIKeyManager', () => {
  let apiKeyManager: APIKeyManager;
  let mockStorage: jest.Mocked<KeyStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = new MockedKeyStorage() as jest.Mocked<KeyStorage>;
    apiKeyManager = new APIKeyManager();
    (apiKeyManager as any).storage = mockStorage;
  });

  describe('generateKey', () => {
    it('should generate a new API key successfully', async () => {
      const request = {
        userId: 'user123',
        name: 'Test Key'
      };

      const mockApiKey = 'sk-ant-api03-test-key-data';
      const mockKeyId = 'key-id-123';
      const mockKeyHash = 'hash123';
      const mockKeyPrefix = 'sk-ant-api03-test...';

      // Mock the generator functions
      const { generateAPIKey, generateKeyId, hashAPIKey, getKeyPrefix } = require('../../../lib/anthropic-proxy/utils/KeyGenerator');
      generateAPIKey.mockReturnValue(mockApiKey);
      generateKeyId.mockReturnValue(mockKeyId);
      hashAPIKey.mockReturnValue(mockKeyHash);
      getKeyPrefix.mockReturnValue(mockKeyPrefix);

      mockStorage.storeKey.mockResolvedValue();

      const result = await apiKeyManager.generateKey(request);

      expect(result).toEqual({
        keyId: mockKeyId,
        apiKey: mockApiKey,
        keyPrefix: mockKeyPrefix,
        createdAt: expect.any(Date)
      });

      expect(mockStorage.storeKey).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockKeyId,
          userId: request.userId,
          name: request.name,
          keyHash: mockKeyHash,
          keyPrefix: mockKeyPrefix,
          isActive: true
        })
      );
    });

    it('should handle storage errors', async () => {
      const request = {
        userId: 'user123',
        name: 'Test Key'
      };

      mockStorage.storeKey.mockRejectedValue(new Error('Storage error'));

      await expect(apiKeyManager.generateKey(request)).rejects.toThrow('Failed to generate API key');
    });
  });

  describe('validateKey', () => {
    it('should validate a correct API key', async () => {
      const apiKey = 'sk-ant-api03-valid-key';
      const mockKeyRecord = {
        id: 'key123',
        userId: 'user123',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'sk-ant-api03-valid...',
        createdAt: new Date(),
        isActive: true,
        usageStats: {
          totalRequests: 0,
          totalTokensConsumed: 0,
          totalSVMAISpent: 0,
          averageTokensPerRequest: 0
        }
      };

      // Mock validation functions
      (validateKeyFormat as jest.Mock).mockReturnValue(true);
      (verifyKeyChecksum as jest.Mock).mockReturnValue(true);
      
      const { hashAPIKey } = require('../../../lib/anthropic-proxy/utils/KeyGenerator');
      hashAPIKey.mockReturnValue('hash123');

      mockStorage.getKeyByHash.mockResolvedValue(mockKeyRecord);

      const result = await apiKeyManager.validateKey(apiKey);

      expect(result).toEqual({
        isValid: true,
        keyId: 'key123',
        userId: 'user123'
      });
    });

    it('should reject invalid key format', async () => {
      const apiKey = 'invalid-key';

      (validateKeyFormat as jest.Mock).mockReturnValue(false);

      const result = await apiKeyManager.validateKey(apiKey);

      expect(result).toEqual({
        isValid: false,
        error: 'Invalid key format'
      });
    });

    it('should reject key with invalid checksum', async () => {
      const apiKey = 'sk-ant-api03-invalid-checksum';

      (validateKeyFormat as jest.Mock).mockReturnValue(true);
      (verifyKeyChecksum as jest.Mock).mockReturnValue(false);

      const result = await apiKeyManager.validateKey(apiKey);

      expect(result).toEqual({
        isValid: false,
        error: 'Invalid key checksum'
      });
    });

    it('should reject key not found in database', async () => {
      const apiKey = 'sk-ant-api03-not-found';

      (validateKeyFormat as jest.Mock).mockReturnValue(true);
      (verifyKeyChecksum as jest.Mock).mockReturnValue(true);
      
      const { hashAPIKey } = require('../../../lib/anthropic-proxy/utils/KeyGenerator');
      hashAPIKey.mockReturnValue('hash123');

      mockStorage.getKeyByHash.mockResolvedValue(null);

      const result = await apiKeyManager.validateKey(apiKey);

      expect(result).toEqual({
        isValid: false,
        error: 'Key not found'
      });
    });

    it('should reject inactive key', async () => {
      const apiKey = 'sk-ant-api03-inactive';
      const mockKeyRecord = {
        id: 'key123',
        userId: 'user123',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'sk-ant-api03-inactive...',
        createdAt: new Date(),
        isActive: false, // Inactive key
        usageStats: {
          totalRequests: 0,
          totalTokensConsumed: 0,
          totalSVMAISpent: 0,
          averageTokensPerRequest: 0
        }
      };

      (validateKeyFormat as jest.Mock).mockReturnValue(true);
      (verifyKeyChecksum as jest.Mock).mockReturnValue(true);
      
      const { hashAPIKey } = require('../../../lib/anthropic-proxy/utils/KeyGenerator');
      hashAPIKey.mockReturnValue('hash123');

      mockStorage.getKeyByHash.mockResolvedValue(mockKeyRecord);

      const result = await apiKeyManager.validateKey(apiKey);

      expect(result).toEqual({
        isValid: false,
        error: 'Key is inactive'
      });
    });
  });

  describe('updateKeyUsage', () => {
    it('should update key usage statistics', async () => {
      const keyId = 'key123';
      const tokensConsumed = 100;
      const svmaiSpent = 10;

      const mockKeyRecord = {
        id: keyId,
        userId: 'user123',
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'sk-ant-api03-test...',
        createdAt: new Date(),
        isActive: true,
        usageStats: {
          totalRequests: 5,
          totalTokensConsumed: 500,
          totalSVMAISpent: 50,
          averageTokensPerRequest: 100
        }
      };

      mockStorage.getKeyById.mockResolvedValue(mockKeyRecord);
      mockStorage.updateKeyUsage.mockResolvedValue();

      await apiKeyManager.updateKeyUsage(keyId, tokensConsumed, svmaiSpent);

      expect(mockStorage.updateKeyUsage).toHaveBeenCalledWith(
        keyId,
        {
          totalRequests: 6,
          totalTokensConsumed: 600,
          totalSVMAISpent: 60,
          lastRequestAt: expect.any(Date),
          averageTokensPerRequest: 100
        },
        expect.any(Date)
      );
    });

    it('should handle key not found', async () => {
      const keyId = 'nonexistent';
      
      mockStorage.getKeyById.mockResolvedValue(null);

      await expect(apiKeyManager.updateKeyUsage(keyId, 100, 10))
        .rejects.toThrow('Key not found');
    });
  });

  describe('getUserKeys', () => {
    it('should return user keys', async () => {
      const userId = 'user123';
      const mockKeys = [
        {
          id: 'key1',
          userId,
          name: 'Key 1',
          keyHash: 'hash1',
          keyPrefix: 'sk-ant-api03-key1...',
          createdAt: new Date(),
          isActive: true,
          usageStats: {
            totalRequests: 10,
            totalTokensConsumed: 1000,
            totalSVMAISpent: 100,
            averageTokensPerRequest: 100
          }
        }
      ];

      mockStorage.getUserKeys.mockResolvedValue(mockKeys);

      const result = await apiKeyManager.getUserKeys(userId);

      expect(result).toEqual(mockKeys);
      expect(mockStorage.getUserKeys).toHaveBeenCalledWith(userId);
    });
  });

  describe('deactivateKey', () => {
    it('should deactivate a key for authorized user', async () => {
      const keyId = 'key123';
      const userId = 'user123';

      const mockKeyRecord = {
        id: keyId,
        userId,
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'sk-ant-api03-test...',
        createdAt: new Date(),
        isActive: true,
        usageStats: {
          totalRequests: 0,
          totalTokensConsumed: 0,
          totalSVMAISpent: 0,
          averageTokensPerRequest: 0
        }
      };

      mockStorage.getKeyById.mockResolvedValue(mockKeyRecord);
      mockStorage.deactivateKey.mockResolvedValue();

      await apiKeyManager.deactivateKey(keyId, userId);

      expect(mockStorage.deactivateKey).toHaveBeenCalledWith(keyId);
    });

    it('should reject unauthorized user', async () => {
      const keyId = 'key123';
      const userId = 'user123';
      const wrongUserId = 'wrong-user';

      const mockKeyRecord = {
        id: keyId,
        userId,
        name: 'Test Key',
        keyHash: 'hash123',
        keyPrefix: 'sk-ant-api03-test...',
        createdAt: new Date(),
        isActive: true,
        usageStats: {
          totalRequests: 0,
          totalTokensConsumed: 0,
          totalSVMAISpent: 0,
          averageTokensPerRequest: 0
        }
      };

      mockStorage.getKeyById.mockResolvedValue(mockKeyRecord);

      await expect(apiKeyManager.deactivateKey(keyId, wrongUserId))
        .rejects.toThrow('Unauthorized');
    });
  });
});