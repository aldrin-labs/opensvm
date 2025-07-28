import { QdrantClient } from '@qdrant/js-client-rest';
import { APIKey, KeyUsageStats } from '../types/ProxyTypes';

/**
 * Qdrant-based storage for API keys
 */

const COLLECTION_NAME = 'anthropic_api_keys';

export class KeyStorage {
  private client: QdrantClient;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY
    });
  }

  /**
   * Initialize the collection if it doesn't exist
   */
  async initialize(): Promise<void> {
    // Skip initialization during build time or when Qdrant is not available
    if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
      console.log('Skipping KeyStorage initialization during build');
      return;
    }

    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

      if (!exists) {
        // Create collection
        await this.client.createCollection(COLLECTION_NAME, {
          vectors: {
            size: 1, // Minimal vector size since we're using it as a document store
            distance: 'Cosine'
          }
        });
      }
    } catch (error) {
      // Handle connection errors gracefully during build or when Qdrant is unavailable
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('fetch failed') ||
        error.message.includes('Connection refused')
      )) {
        console.warn('KeyStorage: Qdrant not available, skipping initialization:', error.message);
        return;
      }

      console.error('Failed to initialize KeyStorage:', error);
      throw error;
    }
  }

  /**
   * Store API key
   */
  async storeKey(apiKey: APIKey): Promise<void> {
    try {
      await this.client.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: apiKey.id,
            vector: [0], // Dummy vector
            payload: {
              userId: apiKey.userId,
              name: apiKey.name,
              keyHash: apiKey.keyHash,
              keyPrefix: apiKey.keyPrefix,
              createdAt: apiKey.createdAt.toISOString(),
              lastUsedAt: apiKey.lastUsedAt?.toISOString(),
              isActive: apiKey.isActive,
              usageStats: apiKey.usageStats
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to store API key:', error);
      throw error;
    }
  }

  /**
   * Get API key by ID
   */
  async getKeyById(keyId: string): Promise<APIKey | null> {
    try {
      const result = await this.client.retrieve(COLLECTION_NAME, {
        ids: [keyId],
        with_payload: true
      });

      if (result.length === 0) {
        return null;
      }

      const point = result[0];
      const payload = point.payload as any;

      return {
        id: keyId,
        userId: payload.userId,
        name: payload.name,
        keyHash: payload.keyHash,
        keyPrefix: payload.keyPrefix,
        createdAt: new Date(payload.createdAt),
        lastUsedAt: payload.lastUsedAt ? new Date(payload.lastUsedAt) : undefined,
        isActive: payload.isActive,
        usageStats: payload.usageStats
      };
    } catch (error) {
      console.error('Failed to get API key:', error);
      return null;
    }
  }

  /**
   * Get API key by hash
   */
  async getKeyByHash(keyHash: string): Promise<APIKey | null> {
    try {
      const result = await this.client.scroll(COLLECTION_NAME, {
        filter: {
          must: [
            {
              key: 'keyHash',
              match: { value: keyHash }
            }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (result.points.length === 0) {
        return null;
      }

      const point = result.points[0];
      const payload = point.payload as any;

      return {
        id: point.id as string,
        userId: payload.userId,
        name: payload.name,
        keyHash: payload.keyHash,
        keyPrefix: payload.keyPrefix,
        createdAt: new Date(payload.createdAt),
        lastUsedAt: payload.lastUsedAt ? new Date(payload.lastUsedAt) : undefined,
        isActive: payload.isActive,
        usageStats: payload.usageStats
      };
    } catch (error) {
      console.error('Failed to get API key by hash:', error);
      return null;
    }
  }

  /**
   * Get all keys for a user
   */
  async getUserKeys(userId: string): Promise<APIKey[]> {
    try {
      const result = await this.client.scroll(COLLECTION_NAME, {
        filter: {
          must: [
            {
              key: 'userId',
              match: { value: userId }
            }
          ]
        },
        limit: 100,
        with_payload: true
      });

      return result.points.map(point => {
        const payload = point.payload as any;
        return {
          id: point.id as string,
          userId: payload.userId,
          name: payload.name,
          keyHash: payload.keyHash,
          keyPrefix: payload.keyPrefix,
          createdAt: new Date(payload.createdAt),
          lastUsedAt: payload.lastUsedAt ? new Date(payload.lastUsedAt) : undefined,
          isActive: payload.isActive,
          usageStats: payload.usageStats
        };
      });
    } catch (error) {
      console.error('Failed to get user keys:', error);
      return [];
    }
  }

  /**
   * Update key usage stats
   */
  async updateKeyUsage(keyId: string, usageStats: KeyUsageStats, lastUsedAt: Date): Promise<void> {
    try {
      const existingKey = await this.getKeyById(keyId);
      if (!existingKey) {
        throw new Error('Key not found');
      }

      await this.client.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: keyId,
            vector: [0],
            payload: {
              userId: existingKey.userId,
              name: existingKey.name,
              keyHash: existingKey.keyHash,
              keyPrefix: existingKey.keyPrefix,
              createdAt: existingKey.createdAt.toISOString(),
              lastUsedAt: lastUsedAt.toISOString(),
              isActive: existingKey.isActive,
              usageStats: usageStats
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to update key usage:', error);
      throw error;
    }
  }

  /**
   * Deactivate API key
   */
  async deactivateKey(keyId: string): Promise<void> {
    try {
      const existingKey = await this.getKeyById(keyId);
      if (!existingKey) {
        throw new Error('Key not found');
      }

      await this.client.upsert(COLLECTION_NAME, {
        wait: true,
        points: [
          {
            id: keyId,
            vector: [0],
            payload: {
              userId: existingKey.userId,
              name: existingKey.name,
              keyHash: existingKey.keyHash,
              keyPrefix: existingKey.keyPrefix,
              createdAt: existingKey.createdAt.toISOString(),
              lastUsedAt: existingKey.lastUsedAt?.toISOString(),
              isActive: false,
              usageStats: existingKey.usageStats
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to deactivate key:', error);
      throw error;
    }
  }

  /**
   * Delete API key
   */
  async deleteKey(keyId: string): Promise<void> {
    try {
      await this.client.delete(COLLECTION_NAME, {
        wait: true,
        points: [keyId]
      });
    } catch (error) {
      console.error('Failed to delete key:', error);
      throw error;
    }
  }
}