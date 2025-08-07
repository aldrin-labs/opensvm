export interface APIKeyRecord {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdAt: Date;
  isActive: boolean;
  usageStats: {
    totalRequests: number;
    totalTokensConsumed: number;
    totalSVMAISpent: number;
    averageTokensPerRequest: number;
    lastRequestAt?: Date;
  };
}

export interface APIKeyData {
  id: string;
  keyHash: string;
  userId: string;
  name?: string;
  isActive: boolean;
  createdAt: number;
  lastUsed?: number;
  usageCount: number;
}

export class KeyStorage {
  private keys = new Map<string, APIKeyRecord>();

  async storeKey(keyData: APIKeyRecord): Promise<void> {
    this.keys.set(keyData.id, keyData);
  }

  async getKeyById(keyId: string): Promise<APIKeyRecord | null> {
    return this.keys.get(keyId) || null;
  }

  async getKeyByHash(keyHash: string): Promise<APIKeyRecord | null> {
    for (const key of this.keys.values()) {
      if (key.keyHash === keyHash) {
        return key;
      }
    }
    return null;
  }

  async getUserKeys(userId: string): Promise<APIKeyRecord[]> {
    return Array.from(this.keys.values()).filter(key => key.userId === userId);
  }

  async updateKeyUsage(keyId: string, usage: Partial<APIKeyRecord['usageStats']>, lastRequestAt: Date): Promise<void> {
    const existing = this.keys.get(keyId);
    if (!existing) return;
    
    this.keys.set(keyId, {
      ...existing,
      usageStats: { ...existing.usageStats, ...usage, lastRequestAt }
    });
  }

  async deactivateKey(keyId: string): Promise<void> {
    const existing = this.keys.get(keyId);
    if (!existing) return;
    
    this.keys.set(keyId, { ...existing, isActive: false });
  }

  // Legacy methods for backward compatibility
  async store(keyData: APIKeyData): Promise<void> {
    const record: APIKeyRecord = {
      id: keyData.id,
      userId: keyData.userId,
      name: keyData.name || '',
      keyHash: keyData.keyHash,
      keyPrefix: '',
      createdAt: new Date(keyData.createdAt),
      isActive: keyData.isActive,
      usageStats: {
        totalRequests: keyData.usageCount,
        totalTokensConsumed: 0,
        totalSVMAISpent: 0,
        averageTokensPerRequest: 0,
        lastRequestAt: keyData.lastUsed ? new Date(keyData.lastUsed) : undefined
      }
    };
    await this.storeKey(record);
  }

  async retrieve(keyId: string): Promise<APIKeyData | null> {
    const record = await this.getKeyById(keyId);
    if (!record) return null;

    return {
      id: record.id,
      keyHash: record.keyHash,
      userId: record.userId,
      name: record.name,
      isActive: record.isActive,
      createdAt: record.createdAt.getTime(),
      lastUsed: record.usageStats.lastRequestAt?.getTime(),
      usageCount: record.usageStats.totalRequests
    };
  }

  async findByHash(keyHash: string): Promise<APIKeyData | null> {
    const record = await this.getKeyByHash(keyHash);
    if (!record) return null;

    return {
      id: record.id,
      keyHash: record.keyHash,
      userId: record.userId,
      name: record.name,
      isActive: record.isActive,
      createdAt: record.createdAt.getTime(),
      lastUsed: record.usageStats.lastRequestAt?.getTime(),
      usageCount: record.usageStats.totalRequests
    };
  }

  async listByUser(userId: string): Promise<APIKeyData[]> {
    const records = await this.getUserKeys(userId);
    return records.map(record => ({
      id: record.id,
      keyHash: record.keyHash,
      userId: record.userId,
      name: record.name,
      isActive: record.isActive,
      createdAt: record.createdAt.getTime(),
      lastUsed: record.usageStats.lastRequestAt?.getTime(),
      usageCount: record.usageStats.totalRequests
    }));
  }

  async update(keyId: string, updates: Partial<APIKeyData>): Promise<boolean> {
    const existing = this.keys.get(keyId);
    if (!existing) return false;
    
    const updatedRecord = { ...existing };
    if (updates.isActive !== undefined) updatedRecord.isActive = updates.isActive;
    if (updates.name !== undefined) updatedRecord.name = updates.name;
    if (updates.lastUsed !== undefined) {
      updatedRecord.usageStats.lastRequestAt = new Date(updates.lastUsed);
    }
    if (updates.usageCount !== undefined) {
      updatedRecord.usageStats.totalRequests = updates.usageCount;
    }
    
    this.keys.set(keyId, updatedRecord);
    return true;
  }

  async delete(keyId: string): Promise<boolean> {
    return this.keys.delete(keyId);
  }

  async exists(keyId: string): Promise<boolean> {
    return this.keys.has(keyId);
  }

  async clear(): Promise<void> {
    this.keys.clear();
  }

  async count(): Promise<number> {
    return this.keys.size;
  }
}