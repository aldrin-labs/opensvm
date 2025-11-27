/**
 * Solana Address Annotations Database (Qdrant)
 *
 * Store and manage user annotations for Solana addresses
 * using Qdrant vector database for storage and search
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import * as crypto from 'crypto';

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_SERVER || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT || undefined;
const COLLECTION_NAME = 'solana_annotations';
const VECTOR_SIZE = 384;

// Types
export interface Annotation {
  id: string;
  address: string;
  type: 'account' | 'program' | 'wallet' | 'token' | 'nft' | 'pda' | 'other';
  label: string;
  description?: string;
  tags: string[];
  category?: string;
  risk?: 'safe' | 'suspicious' | 'malicious' | 'unknown';
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationInput {
  address: string;
  type?: Annotation['type'];
  label: string;
  description?: string;
  tags?: string[];
  category?: string;
  risk?: Annotation['risk'];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

// Singleton client
let client: QdrantClient | null = null;

function getClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }
  return client;
}

// Generate searchable text for vector embedding
function getSearchableText(annotation: Partial<Annotation>): string {
  const parts = [
    annotation.address,
    annotation.label,
    annotation.description,
    annotation.type,
    annotation.category,
    ...(annotation.tags || []),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

// Simple hash-based vector (for demo - use real embeddings in production)
function textToVector(text: string): number[] {
  const hash = crypto.createHash('sha512').update(text).digest();
  const vector: number[] = [];

  for (let i = 0; i < VECTOR_SIZE; i++) {
    const byteIndex = i % hash.length;
    const value = (hash[byteIndex] / 255) * 2 - 1;
    vector.push(value);
  }

  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return vector.map(v => v / magnitude);
}

function generateId(): string {
  // Generate UUID v4 for Qdrant compatibility
  return crypto.randomUUID();
}

// Validate Solana address (base58, 32-44 chars)
function isValidSolanaAddress(address: string): boolean {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
}

// Sanitize string input to prevent XSS
function sanitizeString(str: string | undefined): string | undefined {
  if (!str) return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Recursively sanitize all string values in an object
function sanitizeMetadata(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj) return obj;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key) || key;
    if (typeof value === 'string') {
      result[sanitizedKey] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[sanitizedKey] = value.map(v => typeof v === 'string' ? sanitizeString(v) : v);
    } else if (typeof value === 'object' && value !== null) {
      result[sanitizedKey] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      result[sanitizedKey] = value;
    }
  }
  return result;
}

// Track if collection has been initialized
let collectionInitialized = false;

/**
 * Initialize the annotations collection
 */
export async function initAnnotationsCollection(): Promise<void> {
  if (collectionInitialized) return;

  const qdrant = getClient();

  // List all collections to check if ours exists
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

  if (exists) {
    console.log(`Collection ${COLLECTION_NAME} already exists`);
    collectionInitialized = true;
    return;
  }

  // Collection doesn't exist, create it
  console.log(`Creating collection ${COLLECTION_NAME}...`);
  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: VECTOR_SIZE,
      distance: 'Cosine',
    },
  });

  // Create payload indexes
  const indexes = ['address', 'type', 'risk', 'category', 'createdBy'];
  for (const field of indexes) {
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: field,
      field_schema: 'keyword',
    });
  }

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: 'tags',
    field_schema: 'keyword',
  });

  await qdrant.createPayloadIndex(COLLECTION_NAME, {
    field_name: 'createdAt',
    field_schema: 'keyword',
  });

  console.log(`Created collection ${COLLECTION_NAME} with indexes`);
  collectionInitialized = true;
}

/**
 * Create a new annotation
 */
export async function createAnnotation(input: AnnotationInput): Promise<Annotation> {
  const qdrant = getClient();
  await initAnnotationsCollection();

  if (!input.address || !isValidSolanaAddress(input.address)) {
    throw new Error('Invalid Solana address');
  }

  if (!input.label || input.label.trim().length === 0) {
    throw new Error('Label is required');
  }

  if (input.label.length > 200) {
    throw new Error('Label must be 200 characters or less');
  }

  if (input.description && input.description.length > 2000) {
    throw new Error('Description must be 2000 characters or less');
  }

  const validTypes = ['account', 'program', 'wallet', 'token', 'nft', 'pda', 'other'];
  if (input.type && !validTypes.includes(input.type)) {
    throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  const validRisks = ['safe', 'suspicious', 'malicious', 'unknown'];
  if (input.risk && !validRisks.includes(input.risk)) {
    throw new Error(`Invalid risk. Must be one of: ${validRisks.join(', ')}`);
  }

  // Validate tags
  if (input.tags) {
    if (input.tags.length > 20) {
      throw new Error('Maximum 20 tags allowed');
    }
    for (const tag of input.tags) {
      if (tag.length > 50) {
        throw new Error('Each tag must be 50 characters or less');
      }
    }
  }

  // Validate category length
  if (input.category && input.category.length > 50) {
    throw new Error('Category must be 50 characters or less');
  }

  const id = generateId();
  const now = new Date().toISOString();

  const annotation: Annotation = {
    id,
    address: input.address,
    type: input.type || 'other',
    label: sanitizeString(input.label.trim()) || '',
    description: sanitizeString(input.description?.trim()),
    tags: (input.tags || []).map(t => sanitizeString(t.toLowerCase().trim()) || '').filter(Boolean),
    category: sanitizeString(input.category?.toLowerCase().trim()),
    risk: input.risk || 'unknown',
    metadata: sanitizeMetadata(input.metadata),
    createdBy: sanitizeString(input.createdBy),
    createdAt: now,
    updatedAt: now,
  };

  const searchText = getSearchableText(annotation);
  const vector = textToVector(searchText);

  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points: [
      {
        id: id,
        vector,
        payload: annotation as unknown as Record<string, unknown>,
      },
    ],
  });

  return annotation;
}

/**
 * Get annotation by ID
 */
export async function getAnnotation(id: string): Promise<Annotation | null> {
  const qdrant = getClient();

  try {
    const result = await qdrant.retrieve(COLLECTION_NAME, {
      ids: [id],
      with_payload: true,
    });

    if (result.length === 0) {
      return null;
    }

    return result[0].payload as unknown as Annotation;
  } catch {
    return null;
  }
}

/**
 * Get all annotations for an address
 */
export async function getAnnotationsByAddress(address: string): Promise<Annotation[]> {
  const qdrant = getClient();

  const result = await qdrant.scroll(COLLECTION_NAME, {
    filter: {
      must: [{ key: 'address', match: { value: address } }],
    },
    limit: 100,
    with_payload: true,
  });

  return result.points.map(p => p.payload as unknown as Annotation);
}

/**
 * Get all annotations with a specific tag
 */
export async function getAnnotationsByTag(tag: string): Promise<Annotation[]> {
  const qdrant = getClient();
  const normalizedTag = tag.toLowerCase().trim();

  const result = await qdrant.scroll(COLLECTION_NAME, {
    filter: {
      must: [{ key: 'tags', match: { value: normalizedTag } }],
    },
    limit: 100,
    with_payload: true,
  });

  return result.points.map(p => p.payload as unknown as Annotation);
}

/**
 * Get all annotations in a category
 */
export async function getAnnotationsByCategory(category: string): Promise<Annotation[]> {
  const qdrant = getClient();
  const normalizedCategory = category.toLowerCase().trim();

  const result = await qdrant.scroll(COLLECTION_NAME, {
    filter: {
      must: [{ key: 'category', match: { value: normalizedCategory } }],
    },
    limit: 100,
    with_payload: true,
  });

  return result.points.map(p => p.payload as unknown as Annotation);
}

/**
 * Search annotations (semantic + filters)
 */
export async function searchAnnotations(query: {
  q?: string;
  type?: Annotation['type'];
  risk?: Annotation['risk'];
  tags?: string[];
  category?: string;
  address?: string;
  limit?: number;
  offset?: number;
}): Promise<{ annotations: Annotation[]; total: number }> {
  const qdrant = getClient();
  // Validate and constrain limit/offset
  const limit = Math.min(Math.max(query.limit || 50, 1), 1000);
  const offset = Math.max(query.offset || 0, 0);

  // Build filter conditions
  const mustConditions: Array<{
    key: string;
    match: { value: string };
  }> = [];

  if (query.type) {
    mustConditions.push({ key: 'type', match: { value: query.type } });
  }

  if (query.risk) {
    mustConditions.push({ key: 'risk', match: { value: query.risk } });
  }

  if (query.category) {
    mustConditions.push({
      key: 'category',
      match: { value: query.category.toLowerCase() },
    });
  }

  if (query.address) {
    mustConditions.push({ key: 'address', match: { value: query.address } });
  }

  // Add tag filters
  if (query.tags && query.tags.length > 0) {
    for (const tag of query.tags) {
      mustConditions.push({ key: 'tags', match: { value: tag.toLowerCase() } });
    }
  }

  const filter = mustConditions.length > 0 ? { must: mustConditions } : undefined;

  // If there's a search query, use vector search
  if (query.q && query.q.trim()) {
    const queryVector = textToVector(query.q.toLowerCase());

    const results = await qdrant.search(COLLECTION_NAME, {
      vector: queryVector,
      filter,
      limit: limit + offset,
      with_payload: true,
    });

    const annotations = results
      .slice(offset)
      .map(r => r.payload as unknown as Annotation);

    return { annotations, total: results.length };
  }

  // Otherwise, use scroll with filters
  const result = await qdrant.scroll(COLLECTION_NAME, {
    filter,
    limit: limit + offset,
    with_payload: true,
  });

  const annotations = result.points
    .slice(offset, offset + limit)
    .map(p => p.payload as unknown as Annotation);

  return { annotations, total: result.points.length };
}

/**
 * Update an annotation
 */
export async function updateAnnotation(
  id: string,
  updates: Partial<AnnotationInput>
): Promise<Annotation | null> {
  const existing = await getAnnotation(id);

  if (!existing) {
    return null;
  }

  // Apply updates (with sanitization)
  if (updates.label !== undefined) {
    existing.label = sanitizeString(updates.label.trim()) || '';
  }
  if (updates.description !== undefined) {
    existing.description = sanitizeString(updates.description?.trim());
  }
  if (updates.type !== undefined) {
    const validTypes = ['account', 'program', 'wallet', 'token', 'nft', 'pda', 'other'];
    if (!validTypes.includes(updates.type)) {
      throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }
    existing.type = updates.type;
  }
  if (updates.tags !== undefined) {
    existing.tags = updates.tags.map(t => sanitizeString(t.toLowerCase().trim()) || '').filter(Boolean);
  }
  if (updates.category !== undefined) {
    existing.category = sanitizeString(updates.category?.toLowerCase().trim());
  }
  if (updates.risk !== undefined) {
    const validRisks = ['safe', 'suspicious', 'malicious', 'unknown'];
    if (!validRisks.includes(updates.risk)) {
      throw new Error(`Invalid risk. Must be one of: ${validRisks.join(', ')}`);
    }
    existing.risk = updates.risk;
  }
  if (updates.metadata !== undefined) {
    existing.metadata = { ...existing.metadata, ...sanitizeMetadata(updates.metadata) };
  }

  existing.updatedAt = new Date().toISOString();

  // Update in Qdrant
  const qdrant = getClient();
  const searchText = getSearchableText(existing);
  const vector = textToVector(searchText);

  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points: [
      {
        id: id,
        vector,
        payload: existing as unknown as Record<string, unknown>,
      },
    ],
  });

  return existing;
}

/**
 * Delete an annotation
 */
export async function deleteAnnotation(id: string): Promise<boolean> {
  const qdrant = getClient();

  try {
    await qdrant.delete(COLLECTION_NAME, {
      wait: true,
      points: [id],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get annotation statistics
 */
export async function getAnnotationStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byRisk: Record<string, number>;
  uniqueAddresses: number;
}> {
  const qdrant = getClient();

  // Get collection info
  const info = await qdrant.getCollection(COLLECTION_NAME).catch(() => null);
  const total = info?.points_count || 0;

  // Get all annotations to compute stats
  const result = await qdrant.scroll(COLLECTION_NAME, {
    limit: 10000,
    with_payload: true,
  });

  const annotations = result.points.map(p => p.payload as unknown as Annotation);

  const byType: Record<string, number> = {};
  const byRisk: Record<string, number> = {};
  const addresses = new Set<string>();

  for (const annotation of annotations) {
    byType[annotation.type] = (byType[annotation.type] || 0) + 1;
    byRisk[annotation.risk || 'unknown'] = (byRisk[annotation.risk || 'unknown'] || 0) + 1;
    addresses.add(annotation.address);
  }

  return {
    total,
    byType,
    byRisk,
    uniqueAddresses: addresses.size,
  };
}

/**
 * Bulk import annotations
 */
export async function bulkImportAnnotations(
  annotations: AnnotationInput[]
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  for (let i = 0; i < annotations.length; i++) {
    try {
      await createAnnotation(annotations[i]);
      imported++;
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { imported, errors };
}

/**
 * Export all annotations
 */
export async function exportAnnotations(): Promise<Annotation[]> {
  const qdrant = getClient();

  const result = await qdrant.scroll(COLLECTION_NAME, {
    limit: 100000,
    with_payload: true,
  });

  return result.points.map(p => p.payload as unknown as Annotation);
}
