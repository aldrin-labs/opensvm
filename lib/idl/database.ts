/**
 * IDL Database - Persistent storage for Solana program IDLs
 *
 * Stores Anchor IDL JSONs for program discovery and parsing.
 * Uses JSON file persistence (can be upgraded to PostgreSQL/MongoDB in production).
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ============= Types =============

export interface StoredIDL {
  id: string;
  programId: string;
  name: string;
  version: string;
  description?: string;
  idl: any; // Full Anchor IDL JSON
  network: 'mainnet' | 'devnet' | 'testnet' | 'localnet';
  verified: boolean;
  uploadedBy?: string;
  source?: 'anchor' | 'manual' | 'onchain' | 'github';
  sourceUrl?: string;
  instructionCount: number;
  accountCount: number;
  typeCount: number;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IDLSearchResult {
  programId: string;
  name: string;
  version: string;
  description?: string;
  network: string;
  verified: boolean;
  instructionCount: number;
  createdAt: string;
}

// ============= Database Setup =============

const DATA_DIR = join(process.cwd(), '.data', 'idl');

// In-memory store
const idlStore = new Map<string, StoredIDL>();
let initialized = false;

/**
 * Initialize database - load from disk if available
 */
export async function initIDLDatabase(): Promise<void> {
  if (initialized) return;

  try {
    // Create data directory if it doesn't exist
    if (!existsSync(DATA_DIR)) {
      await mkdir(DATA_DIR, { recursive: true });
    }

    // Load IDLs from disk
    const filePath = join(DATA_DIR, 'idls.json');
    if (existsSync(filePath)) {
      try {
        const data = await readFile(filePath, 'utf-8');
        const items: StoredIDL[] = JSON.parse(data);
        items.forEach((item) => {
          idlStore.set(item.id, item);
        });
      } catch (error) {
        console.error('Error loading IDLs:', error);
      }
    }

    initialized = true;
    console.log(`IDL database initialized. IDLs: ${idlStore.size}`);
  } catch (error) {
    console.error('Error initializing IDL database:', error);
    throw error;
  }
}

/**
 * Persist store to disk
 */
async function persistStore(): Promise<void> {
  try {
    const items = Array.from(idlStore.values());
    const filePath = join(DATA_DIR, 'idls.json');
    await writeFile(filePath, JSON.stringify(items, null, 2));
  } catch (error) {
    console.error('Error persisting IDLs:', error);
  }
}

/**
 * Generate unique ID for IDL storage
 */
function generateId(programId: string, network: string): string {
  return `${programId}_${network}`;
}

// ============= IDL Operations =============

/**
 * Store or update an IDL
 */
export async function storeIDL(params: {
  programId: string;
  idl: any;
  network?: 'mainnet' | 'devnet' | 'testnet' | 'localnet';
  verified?: boolean;
  uploadedBy?: string;
  source?: 'anchor' | 'manual' | 'onchain' | 'github';
  sourceUrl?: string;
}): Promise<StoredIDL> {
  await initIDLDatabase();

  const network = params.network || 'mainnet';
  const id = generateId(params.programId, network);
  const now = new Date().toISOString();

  // Extract metadata from IDL
  const metadata = params.idl.metadata || {};
  const name = metadata.name || params.idl.name || 'Unknown';
  const version = metadata.version || params.idl.version || '0.0.0';
  const description = metadata.description || params.idl.description;

  // Count elements
  const instructionCount = params.idl.instructions?.length || 0;
  const accountCount = params.idl.accounts?.length || 0;
  const typeCount = params.idl.types?.length || 0;
  const errorCount = params.idl.errors?.length || 0;

  const existing = idlStore.get(id);

  const storedIDL: StoredIDL = {
    id,
    programId: params.programId,
    name,
    version,
    description,
    idl: params.idl,
    network,
    verified: params.verified ?? false,
    uploadedBy: params.uploadedBy,
    source: params.source || 'manual',
    sourceUrl: params.sourceUrl,
    instructionCount,
    accountCount,
    typeCount,
    errorCount,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  idlStore.set(id, storedIDL);
  await persistStore();
  return storedIDL;
}

/**
 * Get IDL by program ID
 */
export async function getIDL(
  programId: string,
  network: string = 'mainnet'
): Promise<StoredIDL | undefined> {
  await initIDLDatabase();

  // Try exact match first
  const id = generateId(programId, network);
  const exact = idlStore.get(id);
  if (exact) return exact;

  // Try to find any network if not found
  for (const [, idl] of idlStore) {
    if (idl.programId === programId) {
      return idl;
    }
  }

  return undefined;
}

/**
 * Get all IDLs for a program across networks
 */
export async function getIDLsByProgram(programId: string): Promise<StoredIDL[]> {
  await initIDLDatabase();
  return Array.from(idlStore.values()).filter((idl) => idl.programId === programId);
}

/**
 * Delete an IDL
 */
export async function deleteIDL(
  programId: string,
  network: string = 'mainnet'
): Promise<boolean> {
  await initIDLDatabase();
  const id = generateId(programId, network);
  const deleted = idlStore.delete(id);
  if (deleted) {
    await persistStore();
  }
  return deleted;
}

/**
 * List all IDLs with optional filters
 */
export async function listIDLs(filters?: {
  network?: string;
  verified?: boolean;
  source?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: IDLSearchResult[]; total: number }> {
  await initIDLDatabase();
  let idls = Array.from(idlStore.values());

  // Apply filters
  if (filters?.network) {
    idls = idls.filter((i) => i.network === filters.network);
  }
  if (filters?.verified !== undefined) {
    idls = idls.filter((i) => i.verified === filters.verified);
  }
  if (filters?.source) {
    idls = idls.filter((i) => i.source === filters.source);
  }

  // Sort by creation time descending
  idls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = idls.length;

  // Apply pagination
  const offset = filters?.offset || 0;
  const limit = filters?.limit || 100;
  idls = idls.slice(offset, offset + limit);

  // Return summary results
  const items: IDLSearchResult[] = idls.map((i) => ({
    programId: i.programId,
    name: i.name,
    version: i.version,
    description: i.description,
    network: i.network,
    verified: i.verified,
    instructionCount: i.instructionCount,
    createdAt: i.createdAt,
  }));

  return { items, total };
}

/**
 * Search IDLs by name, program ID, or instruction names
 */
export async function searchIDLs(query: string, filters?: {
  network?: string;
  verified?: boolean;
  limit?: number;
}): Promise<{ items: IDLSearchResult[]; total: number }> {
  await initIDLDatabase();

  const queryLower = query.toLowerCase();
  let idls = Array.from(idlStore.values());

  // Search across multiple fields
  idls = idls.filter((i) => {
    // Match program ID
    if (i.programId.toLowerCase().includes(queryLower)) return true;

    // Match name
    if (i.name.toLowerCase().includes(queryLower)) return true;

    // Match description
    if (i.description?.toLowerCase().includes(queryLower)) return true;

    // Match instruction names
    const instructions = i.idl.instructions || [];
    if (instructions.some((inst: any) => inst.name?.toLowerCase().includes(queryLower))) {
      return true;
    }

    // Match account names
    const accounts = i.idl.accounts || [];
    if (accounts.some((acc: any) => acc.name?.toLowerCase().includes(queryLower))) {
      return true;
    }

    // Match type names
    const types = i.idl.types || [];
    if (types.some((t: any) => t.name?.toLowerCase().includes(queryLower))) {
      return true;
    }

    return false;
  });

  // Apply filters
  if (filters?.network) {
    idls = idls.filter((i) => i.network === filters.network);
  }
  if (filters?.verified !== undefined) {
    idls = idls.filter((i) => i.verified === filters.verified);
  }

  // Sort by relevance (exact matches first)
  idls.sort((a, b) => {
    const aExact = a.programId === query || a.name.toLowerCase() === queryLower;
    const bExact = b.programId === query || b.name.toLowerCase() === queryLower;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const total = idls.length;
  const limit = filters?.limit || 20;
  idls = idls.slice(0, limit);

  const items: IDLSearchResult[] = idls.map((i) => ({
    programId: i.programId,
    name: i.name,
    version: i.version,
    description: i.description,
    network: i.network,
    verified: i.verified,
    instructionCount: i.instructionCount,
    createdAt: i.createdAt,
  }));

  return { items, total };
}

/**
 * Get IDL statistics
 */
export async function getIDLStats(): Promise<{
  totalIDLs: number;
  verifiedIDLs: number;
  byNetwork: Record<string, number>;
  bySource: Record<string, number>;
  totalInstructions: number;
}> {
  await initIDLDatabase();
  const idls = Array.from(idlStore.values());

  const byNetwork: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalInstructions = 0;

  idls.forEach((i) => {
    byNetwork[i.network] = (byNetwork[i.network] || 0) + 1;
    bySource[i.source || 'unknown'] = (bySource[i.source || 'unknown'] || 0) + 1;
    totalInstructions += i.instructionCount;
  });

  return {
    totalIDLs: idls.length,
    verifiedIDLs: idls.filter((i) => i.verified).length,
    byNetwork,
    bySource,
    totalInstructions,
  };
}

/**
 * Validate IDL structure
 */
export function validateIDL(idl: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!idl || typeof idl !== 'object') {
    errors.push('IDL must be a valid JSON object');
    return { valid: false, errors };
  }

  // Check for Anchor IDL format (v0.30+)
  const hasNewFormat = idl.address && idl.metadata;
  // Check for legacy Anchor IDL format
  const hasLegacyFormat = idl.name && idl.instructions;

  if (!hasNewFormat && !hasLegacyFormat) {
    errors.push('IDL must have either (address + metadata) for Anchor 0.30+ or (name + instructions) for legacy format');
  }

  if (!idl.instructions || !Array.isArray(idl.instructions)) {
    errors.push('IDL must have an instructions array');
  } else {
    idl.instructions.forEach((inst: any, idx: number) => {
      if (!inst.name) {
        errors.push(`Instruction at index ${idx} missing name`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// ============= Export =============

export default {
  initIDLDatabase,
  storeIDL,
  getIDL,
  getIDLsByProgram,
  deleteIDL,
  listIDLs,
  searchIDLs,
  getIDLStats,
  validateIDL,
};
