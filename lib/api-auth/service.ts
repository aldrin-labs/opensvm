/**
 * API Authentication Service
 * Handles API key generation, auth link creation, and wallet binding
 * Uses Qdrant for persistent storage
 */

import { randomBytes, createHash } from 'crypto';
import { qdrantClient } from '@/lib/qdrant';
import type {
  ApiKey,
  AuthLink,
  ApiKeyCreateRequest,
  ApiKeyCreateResponse,
  AuthLinkCreateRequest,
  AuthLinkCreateResponse,
  WalletBindRequest,
  WalletBindResponse,
  ApiKeyActivity,
  ApiKeyMetrics,
  ApiKeyActivityListRequest,
  ApiKeyActivityListResponse,
} from './types';

// Qdrant collection names
const COLLECTIONS = {
  API_KEYS: 'api_keys',
  AUTH_LINKS: 'auth_links',
  API_KEY_ACTIVITY: 'api_key_activity',
} as const;

// Cache to track which collections have been initialized
const initializedCollections = new Set<string>();

/**
 * Initialize Qdrant collections for API auth
 */
async function ensureCollections(): Promise<void> {
  // Skip if already initialized
  if (initializedCollections.has('api_auth_collections')) {
    return;
  }
  
  try {
    // Check and create API keys collection
    const apiKeysExists = await qdrantClient.getCollection(COLLECTIONS.API_KEYS).catch(() => null);
    if (!apiKeysExists) {
      await qdrantClient.createCollection(COLLECTIONS.API_KEYS, {
        vectors: {
          size: 384,
          distance: 'Cosine',
        },
      });

      // Create indexes for faster lookups
      await qdrantClient.createPayloadIndex(COLLECTIONS.API_KEYS, {
        field_name: 'id',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTIONS.API_KEYS, {
        field_name: 'key',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTIONS.API_KEYS, {
        field_name: 'userId',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTIONS.API_KEYS, {
        field_name: 'status',
        field_schema: 'keyword',
      });
    }

    // Check and create auth links collection
    const authLinksExists = await qdrantClient.getCollection(COLLECTIONS.AUTH_LINKS).catch(() => null);
    if (!authLinksExists) {
      await qdrantClient.createCollection(COLLECTIONS.AUTH_LINKS, {
        vectors: {
          size: 384,
          distance: 'Cosine',
        },
      });

      // Create indexes
      await qdrantClient.createPayloadIndex(COLLECTIONS.AUTH_LINKS, {
        field_name: 'id',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTIONS.AUTH_LINKS, {
        field_name: 'token',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTIONS.AUTH_LINKS, {
        field_name: 'apiKeyId',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTIONS.AUTH_LINKS, {
        field_name: 'status',
        field_schema: 'keyword',
      });
    }
    
    // Mark as initialized
    initializedCollections.add('api_auth_collections');
  } catch (error) {
    console.error('Failed to initialize API auth collections:', error);
    throw error;
  }
}

/**
 * Generate a simple embedding vector for storage
 */
function generateSimpleEmbedding(text: string): number[] {
  const hash = createHash('sha256').update(text).digest();
  const vector = new Array(384).fill(0);
  for (let i = 0; i < 384; i++) {
    vector[i] = hash[i % hash.length] / 255;
  }
  return vector;
}

/**
 * Generate a secure random API key
 */
function generateApiKey(): string {
  return `osvm_${randomBytes(32).toString('hex')}`;
}

/**
 * Generate a secure random token for auth links
 */
function generateAuthToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash an API key for storage
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Encrypt sensitive data before storing in database
 * Uses AES-256-GCM with a secret key from environment
 */
function encryptData(data: string): string {
  const crypto = require('crypto');
  const secretKey = process.env.API_KEY_ENCRYPTION_SECRET;
  
  if (!secretKey) {
    throw new Error('API_KEY_ENCRYPTION_SECRET environment variable is required');
  }

  // Derive a 32-byte key from the secret
  const key = createHash('sha256').update(secretKey).digest();
  
  // Generate a random IV (initialization vector)
  const iv = crypto.randomBytes(16);
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  // Encrypt the data
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Get the auth tag
  const authTag = cipher.getAuthTag();
  
  // Return IV + authTag + encrypted data (all hex encoded)
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data from database
 */
function decryptData(encryptedData: string): string {
  const crypto = require('crypto');
  const secretKey = process.env.API_KEY_ENCRYPTION_SECRET;
  
  if (!secretKey) {
    throw new Error('API_KEY_ENCRYPTION_SECRET environment variable is required');
  }

  // Derive the same 32-byte key
  const key = createHash('sha256').update(secretKey).digest();
  
  // Split the encrypted data
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  // Create decipher
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  // Decrypt the data
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Create a new API key
 */
export async function createApiKey(
  request: ApiKeyCreateRequest
): Promise<ApiKeyCreateResponse> {
  await ensureCollections();

  const rawKey = generateApiKey();
  const hashedKey = hashApiKey(rawKey);
  const id = randomBytes(16).toString('hex');

  const expiresAt = request.expiresInDays
    ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  const apiKey: ApiKey = {
    id,
    key: encryptData(hashedKey), // Encrypt the hashed key before storage
    name: request.name,
    createdAt: new Date(),
    expiresAt,
    permissions: request.permissions || ['read:*'],
    metadata: request.metadata,
    status: 'pending', // Pending until wallet is bound
  };

  // Store in Qdrant
  await qdrantClient.upsert(COLLECTIONS.API_KEYS, {
    wait: true,
    points: [
      {
        id,
        vector: generateSimpleEmbedding(id),
        payload: apiKey,
      },
    ],
  });

  return {
    apiKey: {
      ...apiKey,
      key: '***', // Don't expose hashed key
    },
    rawKey, // Only returned once
  };
}

/**
 * Create an auth link for wallet binding
 */
export async function createAuthLink(
  request: AuthLinkCreateRequest
): Promise<AuthLinkCreateResponse> {
  await ensureCollections();

  // Get API key directly by ID
  const apiKey = await getApiKey(request.apiKeyId);
  
  if (!apiKey) {
    throw new Error('API key not found');
  }

  if (apiKey.status === 'revoked') {
    throw new Error('API key is revoked');
  }

  const token = generateAuthToken();
  const id = randomBytes(16).toString('hex');
  const expiresInMinutes = request.expiresInMinutes || 15;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  const authLink: AuthLink = {
    id,
    apiKeyId: request.apiKeyId,
    token,
    expiresAt,
    createdAt: new Date(),
    status: 'pending',
  };

  // Store in Qdrant
  await qdrantClient.upsert(COLLECTIONS.AUTH_LINKS, {
    wait: true,
    points: [
      {
        id,
        vector: generateSimpleEmbedding(token),
        payload: authLink,
      },
    ],
  });

  // Generate the full auth link URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const authLinkUrl = `${baseUrl}/auth/bind?token=${token}`;

  return {
    authLink: authLinkUrl,
    expiresAt,
    token,
  };
}

/**
 * Bind a wallet to an API key via auth link
 */
export async function bindWallet(
  request: WalletBindRequest
): Promise<WalletBindResponse> {
  await ensureCollections();

  // Get auth link from Qdrant
  const authLinkResult = await qdrantClient.search(COLLECTIONS.AUTH_LINKS, {
    vector: new Array(384).fill(0),
    filter: {
      must: [{ key: 'token', match: { value: request.token } }],
    },
    limit: 1,
    with_payload: true,
  });

  if (authLinkResult.length === 0) {
    throw new Error('Invalid auth token');
  }

  const authLink = authLinkResult[0].payload as AuthLink;

  if (authLink.status !== 'pending') {
    throw new Error('Auth link already used');
  }

  if (new Date() > new Date(authLink.expiresAt)) {
    // Update status to expired
    await qdrantClient.upsert(COLLECTIONS.AUTH_LINKS, {
      wait: true,
      points: [
        {
          id: authLink.id,
          vector: generateSimpleEmbedding(authLink.token),
          payload: { ...authLink, status: 'expired' },
        },
      ],
    });
    throw new Error('Auth link expired');
  }

  // Get API key from Qdrant
  const apiKeyResult = await qdrantClient.search(COLLECTIONS.API_KEYS, {
    vector: new Array(384).fill(0),
    filter: {
      must: [{ key: 'id', match: { value: authLink.apiKeyId } }],
    },
    limit: 1,
    with_payload: true,
  });

  if (apiKeyResult.length === 0) {
    throw new Error('API key not found');
  }

  const apiKey = apiKeyResult[0].payload as ApiKey;

  // Verify wallet signature
  const isValid = await verifyWalletSignature(
    request.walletAddress,
    request.message,
    request.signature
  );

  if (!isValid) {
    throw new Error('Invalid wallet signature');
  }

  // Update API key with wallet binding
  const updatedApiKey: ApiKey = {
    ...apiKey,
    userId: request.walletAddress,
    status: 'active',
  };

  await qdrantClient.upsert(COLLECTIONS.API_KEYS, {
    wait: true,
    points: [
      {
        id: apiKey.id,
        vector: generateSimpleEmbedding(apiKey.id),
        payload: updatedApiKey,
      },
    ],
  });

  // Update auth link status
  const updatedAuthLink: AuthLink = {
    ...authLink,
    status: 'used',
    usedAt: new Date(),
    boundWallet: request.walletAddress,
  };

  await qdrantClient.upsert(COLLECTIONS.AUTH_LINKS, {
    wait: true,
    points: [
      {
        id: authLink.id,
        vector: generateSimpleEmbedding(authLink.token),
        payload: updatedAuthLink,
      },
    ],
  });

  return {
    success: true,
    apiKeyId: apiKey.id,
    walletAddress: request.walletAddress,
  };
}

/**
 * Verify a wallet signature (Solana)
 */
async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    // Import Solana web3.js dynamically to avoid bundling issues
    const { PublicKey } = await import('@solana/web3.js');
    const nacl = await import('tweetnacl');
    
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, 'base64');
    
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Validate an API key
 */
export async function validateApiKey(rawKey: string): Promise<ApiKey | null> {
  await ensureCollections();

  const hashedKey = hashApiKey(rawKey);

  // We need to search all keys and decrypt to compare
  // This is less efficient but necessary with encryption
  const result = await qdrantClient.search(COLLECTIONS.API_KEYS, {
    vector: generateSimpleEmbedding('validate'),
    limit: 1000, // Get all keys (adjust if you have more)
  });

  // Find matching key by decrypting and comparing
  let matchedApiKey: ApiKey | null = null;
  for (const item of result) {
    const apiKey = item.payload as ApiKey;
    try {
      const decryptedKey = decryptData(apiKey.key);
      if (decryptedKey === hashedKey) {
        matchedApiKey = apiKey;
        break;
      }
    } catch (error) {
      // Skip keys that fail to decrypt (shouldn't happen in normal operation)
      continue;
    }
  }

  if (!matchedApiKey) {
    return null;
  }

  // Check if expired
  if (matchedApiKey.expiresAt && new Date() > new Date(matchedApiKey.expiresAt)) {
    return null;
  }

  // Check if revoked
  if (matchedApiKey.status === 'revoked') {
    return null;
  }

  // Update last used timestamp
  const updatedApiKey: ApiKey = {
    ...matchedApiKey,
    lastUsedAt: new Date(),
  };

  await qdrantClient.upsert(COLLECTIONS.API_KEYS, {
    wait: false, // Don't wait for this update
    points: [
      {
        id: matchedApiKey.id,
        vector: generateSimpleEmbedding(matchedApiKey.id),
        payload: updatedApiKey,
      },
    ],
  });

  return updatedApiKey;
}

/**
 * Get API key by ID
 */
export async function getApiKey(id: string): Promise<ApiKey | null> {
  await ensureCollections();

  const result = await qdrantClient.search(COLLECTIONS.API_KEYS, {
    vector: new Array(384).fill(0),
    filter: {
      must: [{ key: 'id', match: { value: id } }],
    },
    limit: 1,
    with_payload: true,
  });

  if (result.length === 0) {
    return null;
  }

  return result[0].payload as ApiKey;
}

/**
 * List all API keys (for admin/user)
 */
export async function listApiKeys(userId?: string): Promise<ApiKey[]> {
  await ensureCollections();

  const searchParams: any = {
    vector: new Array(384).fill(0),
    limit: 100,
    with_payload: true,
  };

  if (userId) {
    searchParams.filter = {
      must: [{ key: 'userId', match: { value: userId } }],
    };
  }

  const result = await qdrantClient.search(COLLECTIONS.API_KEYS, searchParams);

  return result.map((r) => r.payload as ApiKey);
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  await ensureCollections();

  const apiKey = await getApiKey(id);

  if (!apiKey) {
    return false;
  }

  const updatedApiKey: ApiKey = {
    ...apiKey,
    status: 'revoked',
  };

  await qdrantClient.upsert(COLLECTIONS.API_KEYS, {
    wait: true,
    points: [
      {
        id: apiKey.id,
        vector: generateSimpleEmbedding(apiKey.id),
        payload: updatedApiKey,
      },
    ],
  });

  return true;
}

/**
 * Get auth link status
 */
export async function getAuthLinkStatus(token: string): Promise<AuthLink | null> {
  await ensureCollections();

  const result = await qdrantClient.search(COLLECTIONS.AUTH_LINKS, {
    vector: new Array(384).fill(0),
    filter: {
      must: [{ key: 'token', match: { value: token } }],
    },
    limit: 1,
    with_payload: true,
  });

  if (result.length === 0) {
    return null;
  }

  return result[0].payload as AuthLink;
}

/**
 * Initialize activity logging collection
 */
async function ensureActivityCollection(): Promise<void> {
  // Skip if already initialized
  if (initializedCollections.has('activity_collection')) {
    return;
  }
  
  try {
    const activityExists = await qdrantClient.getCollection(COLLECTIONS.API_KEY_ACTIVITY).catch(() => null);
    if (!activityExists) {
      await qdrantClient.createCollection(COLLECTIONS.API_KEY_ACTIVITY, {
        vectors: {
          size: 384,
          distance: 'Cosine',
        },
      });

      // Create indexes for faster lookups
      await qdrantClient.createPayloadIndex(COLLECTIONS.API_KEY_ACTIVITY, {
        field_name: 'apiKeyId',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTIONS.API_KEY_ACTIVITY, {
        field_name: 'endpoint',
        field_schema: 'keyword',
      });
      await qdrantClient.createPayloadIndex(COLLECTIONS.API_KEY_ACTIVITY, {
        field_name: 'statusCode',
        field_schema: 'integer',
      });
    }
    
    // Mark as initialized
    initializedCollections.add('activity_collection');
  } catch (error) {
    console.error('Failed to initialize activity collection:', error);
    throw error;
  }
}

/**
 * Log API key activity
 */
export async function logApiKeyActivity(activity: Omit<ApiKeyActivity, 'id' | 'timestamp'>): Promise<void> {
  await ensureActivityCollection();

  const id = randomBytes(16).toString('hex');
  const timestamp = new Date();
  const fullActivity: ApiKeyActivity = {
    id,
    timestamp,
    apiKeyId: activity.apiKeyId,
    endpoint: activity.endpoint,
    method: activity.method,
    statusCode: activity.statusCode,
    responseTime: activity.responseTime,
    metadata: activity.metadata,
  };

  // Store in Qdrant (don't wait to avoid slowing down requests)
  await qdrantClient.upsert(COLLECTIONS.API_KEY_ACTIVITY, {
    wait: false,
    points: [
      {
        id,
        vector: generateSimpleEmbedding(`${activity.apiKeyId}-${timestamp.toISOString()}`),
        payload: fullActivity,
      },
    ],
  });
}

/**
 * Get activity logs for an API key
 */
export async function getApiKeyActivity(
  request: ApiKeyActivityListRequest
): Promise<ApiKeyActivityListResponse> {
  await ensureActivityCollection();

  const limit = request.limit || 50;
  const offset = request.offset || 0;

  // Build filter
  const filter: any = {
    must: [{ key: 'apiKeyId', match: { value: request.apiKeyId } }],
  };

  // Add date range filters if provided
  if (request.startDate || request.endDate) {
    const range: any = {};
    if (request.startDate) {
      range.gte = request.startDate.toISOString();
    }
    if (request.endDate) {
      range.lte = request.endDate.toISOString();
    }
    filter.must.push({ key: 'timestamp', range });
  }

  // Get activities
  const result = await qdrantClient.scroll(COLLECTIONS.API_KEY_ACTIVITY, {
    filter,
    limit: limit + 1, // Get one extra to check if there are more
    offset,
    with_payload: true,
  });

  const activities = result.points.slice(0, limit).map((p) => p.payload as ApiKeyActivity);
  const hasMore = result.points.length > limit;

  return {
    activities,
    total: result.points.length,
    hasMore,
  };
}

/**
 * Get metrics for an API key
 */
export async function getApiKeyMetrics(apiKeyId: string): Promise<ApiKeyMetrics> {
  await ensureActivityCollection();

  // Get all activities for this key
  const result = await qdrantClient.scroll(COLLECTIONS.API_KEY_ACTIVITY, {
    filter: {
      must: [{ key: 'apiKeyId', match: { value: apiKeyId } }],
    },
    limit: 10000, // Adjust based on expected activity volume
    with_payload: true,
  });

  const activities = result.points.map((p) => p.payload as ApiKeyActivity);

  if (activities.length === 0) {
    return {
      apiKeyId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsByEndpoint: {},
      requestsByDay: {},
    };
  }

  // Calculate metrics
  const totalRequests = activities.length;
  const successfulRequests = activities.filter((a) => a.statusCode >= 200 && a.statusCode < 400).length;
  const failedRequests = totalRequests - successfulRequests;
  const averageResponseTime =
    activities.reduce((sum, a) => sum + a.responseTime, 0) / totalRequests;
  const lastActivity = activities.reduce((latest, a) =>
    new Date(a.timestamp) > new Date(latest.timestamp) ? a : latest
  ).timestamp;

  // Group by endpoint
  const requestsByEndpoint: Record<string, number> = {};
  activities.forEach((a) => {
    requestsByEndpoint[a.endpoint] = (requestsByEndpoint[a.endpoint] || 0) + 1;
  });

  // Group by day
  const requestsByDay: Record<string, number> = {};
  activities.forEach((a) => {
    const day = new Date(a.timestamp).toISOString().split('T')[0];
    requestsByDay[day] = (requestsByDay[day] || 0) + 1;
  });

  return {
    apiKeyId,
    totalRequests,
    successfulRequests,
    failedRequests,
    averageResponseTime,
    lastActivity,
    requestsByEndpoint,
    requestsByDay,
  };
}
