'use client';

import type { Note } from '../types';

/**
 * Centralized knowledge notes persistence utilities.
 * Backed by localStorage with robust guards for SSR / unavailable storage.
 *
 * Storage schema (key: aiKnowledgeNotes):
 * {
 *   "version": 1,
 *   "notes": Note[]
 * }
 */

const STORAGE_KEY = 'aiKnowledgeNotes';
const VERSION = 1;

interface StoredNotesV1 {
  version: number;
  notes: Note[];
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function safeParse(json: string | null): StoredNotesV1 | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && parsed.version === 1 && Array.isArray(parsed.notes)) {
      // Minimal structural validation of notes
      const notes = parsed.notes.filter((n: any) =>
        n &&
        typeof n.id === 'string' &&
        typeof n.content === 'string' &&
        typeof n.author === 'string' &&
        typeof n.timestamp === 'number'
      );
      return { version: 1, notes };
    }
  } catch {
    /* noop */
  }
  return null;
}

function loadRaw(): Note[] {
  if (!isBrowser()) return [];
  try {
    const stored = safeParse(window.localStorage.getItem(STORAGE_KEY));
    if (stored) return stored.notes;
  } catch {
    /* noop */
  }
  return [];
}

function persist(notes: Note[]): void {
  if (!isBrowser()) return;
  try {
    const payload: StoredNotesV1 = { version: VERSION, notes };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

function updateDomMetadata(count: number, phase: string) {
  if (!isBrowser()) return;
  try {
    const root = document.querySelector('[data-ai-sidebar-root]') as HTMLElement | null;
    if (root) {
      root.setAttribute('data-ai-knowledge-count', String(count));
      // Do not unset hydrated; hydration flag managed in AIChatSidebar on initial load
      if (!root.getAttribute('data-ai-knowledge-hydrated')) {
        root.setAttribute('data-ai-knowledge-hydrated', '1');
      }
    }
    window.dispatchEvent(new CustomEvent('svmai-knowledge-updated', {
      detail: { count, phase, ts: Date.now() }
    }));
  } catch {
    /* noop */
  }
}

/**
 * Load all knowledge notes from persistence.
 * Returns a promise for symmetry with existing async usage patterns.
 */
export async function loadKnowledgeNotes(): Promise<Note[]> {
  const notes = loadRaw();
  // Update DOM metadata (phase: load)
  updateDomMetadata(notes.length, 'load');
  return notes;
}

/**
 * Add a new knowledge note (deduplicates by id).
 */
export async function addKnowledgeNote(note: Note): Promise<void> {
  if (!note || typeof note.id !== 'string') return;
  const existing = loadRaw();
  if (!existing.find(n => n.id === note.id)) {
    existing.push(note);
    persist(existing);
    updateDomMetadata(existing.length, 'add');
  } else {
    // Still emit update so observers can react (count unchanged)
    updateDomMetadata(existing.length, 'add-duplicate');
  }
}

/**
 * Remove a knowledge note by id.
 */
export async function removeKnowledgeNote(id: string): Promise<void> {
  const existing = loadRaw();
  const next = existing.filter(n => n.id !== id);
  if (next.length !== existing.length) {
    persist(next);
    updateDomMetadata(next.length, 'remove');
  } else {
    updateDomMetadata(existing.length, 'remove-miss');
  }
}

/**
 * Clear all knowledge notes.
 */
export async function clearKnowledgeNotes(): Promise<void> {
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  }
  updateDomMetadata(0, 'clear');
}

/**
 * Replace the entire set of notes (used for imports or migrations).
 */
export async function replaceKnowledgeNotes(notes: Note[]): Promise<void> {
  if (!Array.isArray(notes)) return;
  const sanitized = notes.filter(n =>
    n &&
    typeof n.id === 'string' &&
    typeof n.content === 'string'
  );
  persist(sanitized);
  updateDomMetadata(sanitized.length, 'replace');
}

/**
 * Convenience helper for tests to assert persistence quickly.
 */
export function getKnowledgeNotesSync(): Note[] {
  return loadRaw();
}

/**
 * Migration hook (future versions):
 * Currently no migrations; placeholder for forward compatibility.
 */
export function migrateKnowledgeStore(): void {
  // Intentionally empty; add versioned migration logic here when schema changes.
}
