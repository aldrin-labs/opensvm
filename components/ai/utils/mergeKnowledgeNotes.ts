import type { Note } from '../types';

/**
 * Merge newly loaded knowledge notes with those optimistically added before the async load finished.
 * prev (optimistic) notes are kept at the front; only new loaded notes (by id) are appended.
 */
export function mergeKnowledgeNotes(prev: Note[], loaded: Note[]): Note[] {
    if (!prev.length) return loaded;
    if (!loaded.length) return prev;
    const existingIds = new Set(prev.map(n => n.id));
    const appended = loaded.filter(n => !existingIds.has(n.id));
    if (!appended.length) return prev; // preserve referential equality when no change
    return [...prev, ...appended];
}

// Helper for tests
export function makeNote(partial: Partial<Note> & { content: string }): Note {
    return {
        id: partial.id || `note-${Math.random().toString(36).slice(2)}`,
        author: partial.author || 'user',
        timestamp: partial.timestamp || Date.now(),
        content: partial.content
    };
}
