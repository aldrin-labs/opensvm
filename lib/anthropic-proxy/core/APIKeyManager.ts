import { KeyStorage, APIKeyData, APIKeyRecord } from '../storage/KeyStorage';
import { generateAPIKey, generateKeyId, hashAPIKey, validateKeyFormat, verifyKeyChecksum, getKeyPrefix } from '../utils/KeyGenerator';

export interface GenerateKeyRequest {
  userId: string;
  name: string;
}

export interface GenerateKeyResponse {
  keyId: string;
  apiKey: string;
  keyPrefix: string;
  createdAt: Date;
}

export interface ValidateKeyResponse {
  isValid: boolean;
  keyId?: string;
  userId?: string;
  error?: string;
}

export class APIKeyManager {
  private storage: KeyStorage;

  constructor() {
    this.storage = new KeyStorage();
  }

  async generateKey(request: GenerateKeyRequest): Promise<GenerateKeyResponse> {
    try {
      const apiKey = generateAPIKey();
      const keyId = generateKeyId();
      const keyHash = hashAPIKey(apiKey);
      const keyPrefix = getKeyPrefix();
      const createdAt = new Date();

      const keyRecord: APIKeyRecord = {
        id: keyId,
        userId: request.userId,
        name: request.name,
        keyHash,
        keyPrefix,
        createdAt,
        isActive: true,
        usageStats: {
          totalRequests: 0,
          totalTokensConsumed: 0,
          totalSVMAISpent: 0,
          averageTokensPerRequest: 0
        }
      };

      await this.storage.storeKey(keyRecord);

      return {
        keyId,
        apiKey,
        keyPrefix,
        createdAt
      };
    } catch (error) {
      throw new Error('Failed to generate API key');
    }
  }

  async validateKey(apiKey: string): Promise<ValidateKeyResponse> {
    try {
      // Validate key format
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

      // Find key in database
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
      return {
        isValid: false,
        error: 'Validation error'
      };
    }
  }

  async updateKeyUsage(keyId: string, tokensConsumed: number, svmaiSpent: number): Promise<void> {
    const keyRecord = await this.storage.getKeyById(keyId);
    if (!keyRecord) {
      throw new Error('Key not found');
    }

    const updatedStats = {
      totalRequests: keyRecord.usageStats.totalRequests + 1,
      totalTokensConsumed: keyRecord.usageStats.totalTokensConsumed + tokensConsumed,
      totalSVMAISpent: keyRecord.usageStats.totalSVMAISpent + svmaiSpent,
      lastRequestAt: new Date(),
      averageTokensPerRequest: Math.round((keyRecord.usageStats.totalTokensConsumed + tokensConsumed) / (keyRecord.usageStats.totalRequests + 1))
    };

    await this.storage.updateKeyUsage(keyId, updatedStats, new Date());
  }

  async getUserKeys(userId: string): Promise<APIKeyRecord[]> {
    return await this.storage.getUserKeys(userId);
  }

  async deactivateKey(keyId: string, userId: string): Promise<void> {
    const keyRecord = await this.storage.getKeyById(keyId);
    if (!keyRecord) {
      throw new Error('Key not found');
    }

    if (keyRecord.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await this.storage.deactivateKey(keyId);
  }

  // Legacy methods for backward compatibility
  async revokeKey(keyId: string): Promise<boolean> {
    try {
      await this.storage.deactivateKey(keyId);
      return true;
    } catch {
      return false;
    }
  }

  async deleteKey(keyId: string): Promise<boolean> {
    return await this.storage.delete(keyId);
  }

  async getKeyInfo(keyId: string): Promise<APIKeyData | null> {
    return await this.storage.retrieve(keyId);
  }

  async keyExists(keyId: string): Promise<boolean> {
    return await this.storage.exists(keyId);
  }
}