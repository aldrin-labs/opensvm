import { 
  APIKey, 
  KeyGenerationRequest, 
  KeyGenerationResult, 
  KeyValidationResult,
  KeyUsageStats 
} from '../types/ProxyTypes';
import { 
  generateAPIKey, 
  generateKeyId, 
  hashAPIKey, 
  getKeyPrefix, 
  validateKeyFormat, 
  verifyKeyChecksum 
} from '../utils/KeyGenerator';
import { KeyStorage } from '../storage/KeyStorage';

/**
 * Manages API key lifecycle: generation, validation, storage, and usage tracking
 */
export class APIKeyManager {
  private storage: KeyStorage;

  constructor() {
    this.storage = new KeyStorage();
  }

  /**
   * Initialize the key manager
   */
  async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  /**
   * Generate a new API key for a user
   */
  async generateKey(request: KeyGenerationRequest): Promise<KeyGenerationResult> {
    try {
      // Generate the actual API key
      const apiKey = generateAPIKey(request.userId);
      const keyId = generateKeyId();
      const keyHash = hashAPIKey(apiKey);
      const keyPrefix = getKeyPrefix(apiKey);

      // Create API key record
      const apiKeyRecord: APIKey = {
        id: keyId,
        userId: request.userId,
        name: request.name,
        keyHash,
        keyPrefix,
        createdAt: new Date(),
        isActive: true,
        usageStats: {
          totalRequests: 0,
          totalTokensConsumed: 0,
          totalSVMAISpent: 0,
          averageTokensPerRequest: 0
        }
      };

      // Store in database
      await this.storage.storeKey(apiKeyRecord);

      return {
        keyId,
        apiKey, // Return the full key only once
        keyPrefix,
        createdAt: apiKeyRecord.createdAt
      };
    } catch (error) {
      console.error('Failed to generate API key:', error);
      throw new Error('Failed to generate API key');
    }
  }

  /**
   * Validate an API key and return user info
   */
  async validateKey(apiKey: string): Promise<KeyValidationResult> {
    try {
      // Basic format validation
      if (!validateKeyFormat(apiKey)) {
        return {
          isValid: false,
          error: 'Invalid key format'
        };
      }

      // Verify checksum
      if (!verifyKeyChecksum(apiKey)) {
        return {
          isValid: false,
          error: 'Invalid key checksum'
        };
      }

      // Look up key in database
      const keyHash = hashAPIKey(apiKey);
      const keyRecord = await this.storage.getKeyByHash(keyHash);

      if (!keyRecord) {
        return {
          isValid: false,
          error: 'Key not found'
        };
      }

      if (!keyRecord.isActive) {
        return {
          isValid: false,
          error: 'Key is inactive'
        };
      }

      return {
        isValid: true,
        keyId: keyRecord.id,
        userId: keyRecord.userId
      };
    } catch (error) {
      console.error('Failed to validate API key:', error);
      return {
        isValid: false,
        error: 'Validation failed'
      };
    }
  }

  /**
   * Get API key by ID
   */
  async getKey(keyId: string): Promise<APIKey | null> {
    try {
      return await this.storage.getKeyById(keyId);
    } catch (error) {
      console.error('Failed to get API key:', error);
      return null;
    }
  }

  /**
   * Get all keys for a user
   */
  async getUserKeys(userId: string): Promise<APIKey[]> {
    try {
      return await this.storage.getUserKeys(userId);
    } catch (error) {
      console.error('Failed to get user keys:', error);
      return [];
    }
  }

  /**
   * Update key usage statistics
   */
  async updateKeyUsage(
    keyId: string, 
    tokensConsumed: number, 
    svmaiSpent: number
  ): Promise<void> {
    try {
      const key = await this.storage.getKeyById(keyId);
      if (!key) {
        throw new Error('Key not found');
      }

      // Update usage stats
      const newStats: KeyUsageStats = {
        totalRequests: key.usageStats.totalRequests + 1,
        totalTokensConsumed: key.usageStats.totalTokensConsumed + tokensConsumed,
        totalSVMAISpent: key.usageStats.totalSVMAISpent + svmaiSpent,
        lastRequestAt: new Date(),
        averageTokensPerRequest: Math.round(
          (key.usageStats.totalTokensConsumed + tokensConsumed) / 
          (key.usageStats.totalRequests + 1)
        )
      };

      await this.storage.updateKeyUsage(keyId, newStats, new Date());
    } catch (error) {
      console.error('Failed to update key usage:', error);
      throw error;
    }
  }

  /**
   * Deactivate an API key
   */
  async deactivateKey(keyId: string, userId: string): Promise<void> {
    try {
      const key = await this.storage.getKeyById(keyId);
      if (!key) {
        throw new Error('Key not found');
      }

      if (key.userId !== userId) {
        throw new Error('Unauthorized');
      }

      await this.storage.deactivateKey(keyId);
    } catch (error) {
      console.error('Failed to deactivate key:', error);
      throw error;
    }
  }

  /**
   * Delete an API key
   */
  async deleteKey(keyId: string, userId: string): Promise<void> {
    try {
      const key = await this.storage.getKeyById(keyId);
      if (!key) {
        throw new Error('Key not found');
      }

      if (key.userId !== userId) {
        throw new Error('Unauthorized');
      }

      await this.storage.deleteKey(keyId);
    } catch (error) {
      console.error('Failed to delete key:', error);
      throw error;
    }
  }

  /**
   * Get key statistics for admin/monitoring
   */
  async getKeyStats(): Promise<{
    totalKeys: number;
    activeKeys: number;
    totalRequests: number;
    totalTokensConsumed: number;
  }> {
    try {
      // This would need to be implemented with proper aggregation
      // For now, return basic stats
      return {
        totalKeys: 0,
        activeKeys: 0,
        totalRequests: 0,
        totalTokensConsumed: 0
      };
    } catch (error) {
      console.error('Failed to get key stats:', error);
      throw error;
    }
  }
}