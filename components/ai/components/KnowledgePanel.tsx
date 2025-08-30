import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, BookOpen, Hash, MessageSquare, X } from 'lucide-react';
import { Note } from '../types';
import { track } from '../../../lib/ai/telemetry';
import { estimateTokens } from '../utils/tokenCounter';

interface KnowledgePanelProps {
    notes: Note[];
    onAddNote?: (content: string) => void;
    onRemoveNote?: (id: string) => void;
    onClearNotes?: () => void;
    onPromoteToContext?: (noteId: string, content: string) => void;
    className?: string;
}

/**
 * Parse structured note content (first line optional title).
 * Returns { title, body }
 */
function splitNote(content: string) {
    if (!content) return { title: '', body: '' };
    const lines = content.split(/\r?\n/);
    if (lines.length === 1) return { title: lines[0].trim(), body: '' };
    const title = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();
    return { title, body };
}

function matchQuery(content: string, author: string, query: string): boolean {
    const lcContent = content.toLowerCase();
    const lcAuthor = author.toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);

    if (tokens.length === 0) return true;

    // Support simple AND / OR logic (uppercase operators)
    // Split by OR groups, each OR group is AND of its terms
    const orGroups = query
        .split(/\bOR\b/)
        .map(group => group.trim())
        .filter(Boolean);

    return orGroups.some(group => {
        const andParts = group.split(/\bAND\b/).map(p => p.trim()).filter(Boolean);
        return andParts.every(part => {
            const term = part.toLowerCase();
            return lcContent.includes(term) || lcAuthor.includes(term);
        });
    });
}

function highlight(content: string, query: string): React.ReactNode {
    if (!query.trim()) return content;

    // Collect unique terms (exclude operators)
    const rawTerms = query
        .split(/\s+/)
        .filter(t => t && t !== 'AND' && t !== 'OR');

    const terms = Array.from(new Set(rawTerms.map(t => t.toLowerCase()))).sort((a, b) => b.length - a.length);
    if (terms.length === 0) return content;

    let remaining = content;
    const parts: React.ReactNode[] = [];
    const regex = new RegExp(terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');

    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = regex.exec(content)) !== null) {
        const start = match.index;
        const end = regex.lastIndex;
        if (start > lastIndex) {
            parts.push(content.slice(lastIndex, start));
        }
        parts.push(
            <mark
                key={`h-${start}-${end}`}
                className="bg-yellow-300/70 text-black px-0.5 rounded-sm search-highlight"
                data-testid="highlight"
            >
                {content.slice(start, end)}
            </mark>
        );
        lastIndex = end;
    }
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }
    return parts;
}

export function KnowledgePanel({
    notes,
    onAddNote,
    onRemoveNote,
    onClearNotes,
    onPromoteToContext,
    className = ''
}: KnowledgePanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');
    const [newNoteContent, setNewNoteContent] = useState('');

    // Filter notes (supports AND / OR)
    const filteredNotes = useMemo(() => {
        if (!searchQuery.trim()) return notes;
        return notes.filter(note => matchQuery(note.content, note.author, searchQuery));
    }, [notes, searchQuery]);

    // Metrics
    const knowledgeMetrics = useMemo(() => {
        const totalTokens = notes.reduce((sum, note) => sum + estimateTokens(note.content), 0);
        const userNotes = notes.filter(n => n.author === 'user').length;
        const assistantNotes = notes.filter(n => n.author === 'assistant').length;

        return {
            totalNotes: notes.length,
            totalTokens,
            userNotes,
            assistantNotes,
            avgTokensPerNote: notes.length > 0 ? Math.round(totalTokens / notes.length) : 0
        };
    }, [notes]);

    const handleAddNote = () => {
        if (!onAddNote) return;
        const bodyCombined = [newNoteTitle.trim(), newNoteContent.trim()].filter(Boolean).join('\n');
        if (!bodyCombined.trim()) return;

        onAddNote(bodyCombined);
        setNewNoteTitle('');
        setNewNoteContent('');
        setShowAddForm(false);

        track('knowledge_action', {
            action: 'add_note',
            contentLength: bodyCombined.length,
            tokens: estimateTokens(bodyCombined)
        });
    };

    const handleRemoveNote = (noteId: string) => {
        if (!onRemoveNote) return;
        const note = notes.find(n => n.id === noteId);
        onRemoveNote(noteId);
        track('knowledge_action', {
            action: 'remove_note',
            author: note?.author,
            tokens: note ? estimateTokens(note.content) : 0
        });
    };

    const handlePromoteToContext = (noteId: string, content: string) => {
        if (onPromoteToContext) {
            onPromoteToContext(noteId, content);
            track('knowledge_action', {
                action: 'promote_to_context',
                noteId,
                noteTokens: estimateTokens(content)
            });
        }
    };

    const handleSearchChange = (query: string) => {
        setSearchQuery(query);
        track('knowledge_action', {
            action: 'search',
            queryLength: query.length,
            resultsCount: query.trim() ? filteredNotes.length : notes.length
        });
    };

    return (
        <div
            className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900 ${className}`}
            data-ai-component="knowledge-panel"
            data-testid="knowledge-panel"
            data-ai-knowledge-panel="1"
        >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        Knowledge Base
                    </h3>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search knowledge entries... (supports AND / OR)"
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        data-ai-input="knowledge-search"
                        data-testid="knowledge-search"
                    />
                </div>

                {/* Metrics */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <Hash className="w-3 h-3" />
                        <span>{knowledgeMetrics.totalNotes} entries</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        <span>~{knowledgeMetrics.totalTokens} tokens</span>
                    </div>
                </div>
            </div>

            {/* Notes List */}
            <div
                className="flex-1 overflow-y-auto p-4"
                data-testid="knowledge-notes-list"
                data-ai-knowledge-list="1"
            >
                {filteredNotes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {searchQuery ? (
                            <>
                                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No entries found for "{searchQuery}"</p>
                            </>
                        ) : (
                            <>
                                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No knowledge entries yet</p>
                                <button
                                    onClick={() => setShowAddForm(true)}
                                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                                    data-ai-action="add-first-note"
                                    data-testid="add-entry-button"
                                >
                                    Add your first entry
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredNotes.map((note) => {
                            const { title, body } = splitNote(note.content);
                            const titleDisplay = title || '(Untitled)';
                            const bodyDisplay = body;
                            const highlightedTitle = highlight(titleDisplay, searchQuery);
                            const highlightedBody = highlight(bodyDisplay, searchQuery);
                            return (
                                <div
                                    key={note.id}
                                    className="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-sm transition-shadow"
                                    data-ai-note-id={note.id}
                                    data-ai-note-author={note.author}
                                    data-ai-knowledge-item="1"
                                    data-testid="note-item"
                                    data-id={note.id}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                                        note.author === 'user'
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                                    }`}
                                                    data-testid="author-tag"
                                                >
                                                    {note.author === 'assistant' ? 'AI' : 'User'}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    ~{estimateTokens(note.content)} tok
                                                </span>
                                            </div>
                                            <div className="mb-1 font-semibold text-sm text-gray-900 dark:text-white break-words">
                                                {highlightedTitle}
                                            </div>
                                            {bodyDisplay && (
                                                <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                                                    {highlightedBody}
                                                </p>
                                            )}
                                            <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                                                <time
                                                    data-testid="note-timestamp"
                                                    dateTime={new Date(note.timestamp).toISOString()}
                                                >
                                                    {new Date(note.timestamp).toLocaleDateString()} {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </time>
                                                <span
                                                    className="opacity-70"
                                                    data-testid="note-id"
                                                >
                                                    ID: {note.id.split('-').slice(-1)[0]}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {onPromoteToContext && (
                                                <button
                                                    onClick={() => handlePromoteToContext(note.id, note.content)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-600"
                                                    title="Add to conversation context"
                                                    data-ai-action="promote-to-context"
                                                    data-testid="promote-note"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </button>
                                            )}
                                            {onRemoveNote && (
                                                <button
                                                    onClick={() => handleRemoveNote(note.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-600"
                                                    title="Remove note"
                                                    data-ai-action="delete-note"
                                                    data-testid="delete-note"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Note Form */}
            {showAddForm && (
                <div
                    className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    data-testid="note-creation-form"
                >
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">New Knowledge Entry</h4>
                        <button
                            onClick={() => {
                                setShowAddForm(false);
                                setNewNoteTitle('');
                                setNewNoteContent('');
                            }}
                            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            aria-label="Close form"
                            data-testid="close-note-form"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <input
                        value={newNoteTitle}
                        onChange={(e) => setNewNoteTitle(e.target.value)}
                        placeholder="Title (first line)"
                        className="w-full mb-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        data-testid="note-title"
                    />
                    <textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Add knowledge entry content..."
                        className="w-full p-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={3}
                        data-ai-input="new-note-content"
                        data-testid="note-content"
                    />
                    <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            ~{estimateTokens([newNoteTitle, newNoteContent].join('\n'))} tokens
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowAddForm(false);
                                    setNewNoteTitle('');
                                    setNewNoteContent('');
                                }}
                                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                data-ai-action="cancel-add-note"
                                data-testid="cancel-add-note"
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddNote}
                                disabled={!newNoteTitle.trim() && !newNoteContent.trim()}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                data-ai-action="save-note"
                                data-testid="save-note"
                                type="button"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Bar */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => setShowAddForm(v => !v)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        data-ai-action="toggle-add-form"
                        data-testid="add-entry-button"
                        type="button"
                    >
                        <Plus className="w-4 h-4" />
                        {showAddForm ? 'Close' : 'Add Entry'}
                    </button>

                    {notes.length > 0 && onClearNotes && (
                        <button
                            onClick={() => {
                                if (confirm(`Clear all ${notes.length} knowledge entries?`)) {
                                    onClearNotes();
                                    track('knowledge_action', {
                                        action: 'clear_all',
                                        entriesCleared: notes.length,
                                        totalTokens: knowledgeMetrics.totalTokens
                                    });
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            title="Clear all knowledge"
                            data-ai-action="clear-all-notes"
                            data-testid="clear-notes-button"
                            type="button"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear All
                        </button>
                    )}
                </div>

                {/* Summary Stats */}
                {notes.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400">
                        <div className="grid grid-cols-3 gap-2">
                            <span>User: {knowledgeMetrics.userNotes}</span>
                            <span>AI: {knowledgeMetrics.assistantNotes}</span>
                            <span>Avg: {knowledgeMetrics.avgTokensPerNote}tok</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
