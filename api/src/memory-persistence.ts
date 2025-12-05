#!/usr/bin/env bun
/**
 * Memory Persistence
 *
 * Persists agent memory to disk for cross-session learning.
 * Supports multiple storage backends:
 * - File-based (JSON)
 * - SQLite
 * - Redis (for distributed systems)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface PersistenceConfig {
  type: 'file' | 'sqlite' | 'redis';
  path?: string; // For file/sqlite
  redisUrl?: string; // For redis
  autoSaveInterval?: number; // Auto-save every N ms (0 = disabled)
  maxBackups?: number; // Number of backup files to keep
}

export interface PersistenceData {
  version: string;
  savedAt: number;
  data: object;
}

// ============================================================================
// File-Based Persistence
// ============================================================================

export class FilePersistence {
  private path: string;
  private backupPath: string;
  private maxBackups: number;
  private autoSaveTimer?: ReturnType<typeof setInterval>;

  constructor(config: { path: string; maxBackups?: number; autoSaveInterval?: number }) {
    this.path = config.path;
    this.backupPath = config.path.replace('.json', '.backup.json');
    this.maxBackups = config.maxBackups ?? 5;

    // Ensure directory exists
    const dir = dirname(this.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Set up auto-save if configured
    if (config.autoSaveInterval && config.autoSaveInterval > 0) {
      // Auto-save is triggered externally since we don't have data reference
    }
  }

  /**
   * Save data to disk
   */
  save(data: object): boolean {
    try {
      // Create backup if file exists
      if (existsSync(this.path)) {
        this.createBackup();
      }

      const persistence: PersistenceData = {
        version: '1.0.0',
        savedAt: Date.now(),
        data,
      };

      writeFileSync(this.path, JSON.stringify(persistence, null, 2));
      return true;
    } catch (error) {
      console.error('[FilePersistence] Save failed:', error);
      return false;
    }
  }

  /**
   * Load data from disk
   */
  load(): object | null {
    try {
      if (!existsSync(this.path)) {
        // Try loading from backup
        return this.loadBackup();
      }

      const content = readFileSync(this.path, 'utf-8');
      const persistence: PersistenceData = JSON.parse(content);

      console.log(`[FilePersistence] Loaded data from ${new Date(persistence.savedAt).toISOString()}`);
      return persistence.data;
    } catch (error) {
      console.error('[FilePersistence] Load failed:', error);
      return this.loadBackup();
    }
  }

  /**
   * Create a backup of current file
   */
  private createBackup(): void {
    try {
      if (existsSync(this.path)) {
        // Rotate backups
        for (let i = this.maxBackups - 1; i >= 1; i--) {
          const from = this.getBackupPath(i - 1);
          const to = this.getBackupPath(i);
          if (existsSync(from)) {
            const content = readFileSync(from, 'utf-8');
            writeFileSync(to, content);
          }
        }

        // Save current as first backup
        const content = readFileSync(this.path, 'utf-8');
        writeFileSync(this.getBackupPath(0), content);
      }
    } catch (error) {
      console.error('[FilePersistence] Backup failed:', error);
    }
  }

  private getBackupPath(index: number): string {
    return this.path.replace('.json', `.backup${index}.json`);
  }

  /**
   * Try to load from backup files
   */
  private loadBackup(): object | null {
    for (let i = 0; i < this.maxBackups; i++) {
      const backupPath = this.getBackupPath(i);
      if (existsSync(backupPath)) {
        try {
          const content = readFileSync(backupPath, 'utf-8');
          const persistence: PersistenceData = JSON.parse(content);
          console.log(`[FilePersistence] Recovered from backup ${i}`);
          return persistence.data;
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  /**
   * Check if data exists
   */
  exists(): boolean {
    return existsSync(this.path);
  }

  /**
   * Delete all data
   */
  clear(): void {
    try {
      if (existsSync(this.path)) {
        writeFileSync(this.path, JSON.stringify({ version: '1.0.0', savedAt: Date.now(), data: {} }));
      }
    } catch (error) {
      console.error('[FilePersistence] Clear failed:', error);
    }
  }

  /**
   * Get file info
   */
  getInfo(): object {
    if (!existsSync(this.path)) {
      return { exists: false };
    }

    try {
      const content = readFileSync(this.path, 'utf-8');
      const persistence: PersistenceData = JSON.parse(content);
      return {
        exists: true,
        version: persistence.version,
        savedAt: new Date(persistence.savedAt).toISOString(),
        sizeBytes: content.length,
      };
    } catch {
      return { exists: true, error: 'Failed to read file' };
    }
  }

  /**
   * Stop auto-save timer
   */
  stop(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }
}

// ============================================================================
// Memory Persistence Manager
// ============================================================================

export class MemoryPersistence {
  private backend: FilePersistence;
  private autoSaveTimer?: ReturnType<typeof setInterval>;
  private pendingData?: object;

  constructor(config: Partial<PersistenceConfig> = {}) {
    const type = config.type ?? 'file';
    const path = config.path ?? join(process.cwd(), 'data', 'debate-memory.json');

    if (type !== 'file') {
      throw new Error(`Unsupported persistence type: ${type}. Only 'file' is currently supported.`);
    }

    this.backend = new FilePersistence({
      path,
      maxBackups: config.maxBackups ?? 5,
    });

    // Set up auto-save
    if (config.autoSaveInterval && config.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(() => {
        if (this.pendingData) {
          this.save(this.pendingData);
          this.pendingData = undefined;
        }
      }, config.autoSaveInterval);
    }
  }

  /**
   * Save memory state
   */
  save(data: object): boolean {
    return this.backend.save(data);
  }

  /**
   * Mark data for auto-save
   */
  markDirty(data: object): void {
    this.pendingData = data;
  }

  /**
   * Load memory state
   */
  load(): object | null {
    return this.backend.load();
  }

  /**
   * Check if saved data exists
   */
  exists(): boolean {
    return this.backend.exists();
  }

  /**
   * Clear all saved data
   */
  clear(): void {
    this.backend.clear();
  }

  /**
   * Get persistence info
   */
  getInfo(): object {
    return this.backend.getInfo();
  }

  /**
   * Stop persistence (clean up timers)
   */
  stop(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
    this.backend.stop();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let persistenceInstance: MemoryPersistence | null = null;

export function getMemoryPersistence(config?: Partial<PersistenceConfig>): MemoryPersistence {
  if (!persistenceInstance) {
    persistenceInstance = new MemoryPersistence(config);
  }
  return persistenceInstance;
}

export function createMemoryPersistence(config: Partial<PersistenceConfig>): MemoryPersistence {
  persistenceInstance = new MemoryPersistence(config);
  return persistenceInstance;
}

export default MemoryPersistence;
