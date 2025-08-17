import { threadManager } from './threadManager';
import { createDefaultMetadata } from '../types/conversation';
import type { ConversationThread, ConversationMessage } from '../types/conversation';
import type { Note } from '../types';

// Fixed thread id for global knowledge base
const KNOWLEDGE_THREAD_ID = 'knowledge_base';

function noteToMessage(note: Note): ConversationMessage {
    return {
        id: note.id,
        role: note.author,
        content: note.content,
        timestamp: new Date(note.timestamp).toISOString(),
        isKnowledge: true
    };
}

function messageToNote(msg: ConversationMessage): Note | null {
    if (!msg.isKnowledge) return null;
    if (msg.role !== 'user' && msg.role !== 'assistant') return null;
    return {
        id: msg.id,
        content: msg.content,
        author: msg.role,
        timestamp: new Date(msg.timestamp).getTime()
    };
}

async function ensureThread(): Promise<ConversationThread> {
    const existing = await threadManager.loadThread(KNOWLEDGE_THREAD_ID);
    if (existing) return existing;

    const meta = createDefaultMetadata(KNOWLEDGE_THREAD_ID);
    meta.title = 'Knowledge Base';
    meta.pinned = true;
    const thread: ConversationThread = { meta, messages: [] };
    await threadManager.saveThread(thread);
    return thread;
}

export async function loadKnowledgeNotes(): Promise<Note[]> {
    const thread = await ensureThread();
    return thread.messages.map(messageToNote).filter(Boolean) as Note[];
}

export async function saveKnowledgeNotes(notes: Note[]): Promise<void> {
    const thread = await ensureThread();
    thread.messages = notes.map(noteToMessage);
    await threadManager.saveThread(thread);
}

export async function addKnowledgeNote(note: Note): Promise<void> {
    const notes = await loadKnowledgeNotes();
    notes.push(note);
    await saveKnowledgeNotes(notes);
}

export async function removeKnowledgeNote(noteId: string): Promise<void> {
    const notes = await loadKnowledgeNotes();
    await saveKnowledgeNotes(notes.filter(n => n.id !== noteId));
}

export async function clearKnowledgeNotes(): Promise<void> {
    await saveKnowledgeNotes([]);
}

export { KNOWLEDGE_THREAD_ID };
