'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit3, Save, X, Plus, Trash2, Tag } from 'lucide-react';

interface Note {
  id: string;
  title?: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  color?: string;
}

interface NotesWidgetProps {
  config: {
    title: string;
    noteType?: 'single' | 'multiple';
    allowTags?: boolean;
    allowColors?: boolean;
    maxNotes?: number;
    placeholder?: string;
    autoSave?: boolean;
  };
  data?: Note[];
  size: { w: number; h: number };
}

export function NotesWidget({ config, data, size }: NotesWidgetProps) {
  const {
    title,
    noteType = 'single',
    allowTags = true,
    allowColors = false,
    maxNotes = 5,
    placeholder = 'Write your notes here...',
    autoSave = true,
  } = config;

  const [notes, setNotes] = useState<Note[]>(
    data || [
      {
        id: '1',
        title: 'Project Ideas',
        content: 'Implement new dashboard features\n- Drag and drop widgets\n- Custom themes\n- Export functionality',
        tags: ['project', 'ideas'],
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        color: 'yellow',
      },
      {
        id: '2',
        title: 'Meeting Notes',
        content: 'Q1 Planning Meeting:\n- Discussed roadmap priorities\n- Resource allocation\n- Timeline adjustments',
        tags: ['meeting', 'planning'],
        createdAt: '2024-01-14T14:00:00Z',
        updatedAt: '2024-01-14T15:00:00Z',
        color: 'blue',
      },
    ]
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '', tags: '' });

  const isCompact = size.h <= 3;
  const isSingleNote = noteType === 'single' || isCompact;

  useEffect(() => {
    if (autoSave && editingId) {
      const timer = setTimeout(() => {
        setEditingId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [notes, editingId, autoSave]);

  const handleSaveNote = (id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(note =>
      note.id === id
        ? { ...note, ...updates, updatedAt: new Date().toISOString() }
        : note
    ));
    setEditingId(null);
  };

  const handleAddNote = () => {
    if (newNote.content.trim()) {
      const note: Note = {
        id: Date.now().toString(),
        title: newNote.title.trim() || undefined,
        content: newNote.content.trim(),
        tags: newNote.tags.split(',').map(t => t.trim()).filter(Boolean),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setNotes(prev => [note, ...prev.slice(0, maxNotes - 1)]);
      setNewNote({ title: '', content: '', tags: '' });
      setIsAddingNote(false);
    }
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  const getColorClass = (color?: string) => {
    switch (color) {
      case 'yellow': return 'bg-yellow-50 border-yellow-200';
      case 'blue': return 'bg-blue-50 border-blue-200';
      case 'green': return 'bg-green-50 border-green-200';
      case 'red': return 'bg-red-50 border-red-200';
      case 'purple': return 'bg-purple-50 border-purple-200';
      default: return '';
    }
  };

  const renderSingleNote = () => {
    const note = notes[0];
    if (!note) {
      return (
        <div className="h-full p-2">
          <Textarea
            placeholder={placeholder}
            value=""
            className="h-full resize-none border-none bg-transparent text-sm"
            onChange={(e) => {
              const newNote: Note = {
                id: '1',
                content: e.target.value,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              setNotes([newNote]);
            }}
          />
        </div>
      );
    }

    if (editingId === note.id) {
      return (
        <div className="h-full p-2 space-y-2">
          {!isCompact && (
            <Input
              placeholder="Note title..."
              value={note.title || ''}
              onChange={(e) => handleSaveNote(note.id, { title: e.target.value })}
              className="text-sm border-none bg-transparent p-0 font-medium"
            />
          )}
          <Textarea
            value={note.content}
            onChange={(e) => handleSaveNote(note.id, { content: e.target.value })}
            className="flex-1 resize-none border-none bg-transparent text-sm"
            placeholder={placeholder}
          />
        </div>
      );
    }

    return (
      <div
        className={`h-full p-2 cursor-pointer hover:bg-accent/20 ${getColorClass(note.color)}`}
        onClick={() => setEditingId(note.id)}
      >
        {note.title && !isCompact && (
          <h3 className="font-medium text-sm mb-2 truncate">{note.title}</h3>
        )}
        <div className="text-sm whitespace-pre-wrap overflow-auto h-full">
          {note.content}
        </div>
        {note.tags && note.tags.length > 0 && !isCompact && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMultipleNotes = () => {
    return (
      <div className="space-y-2 h-full overflow-auto">
        {isAddingNote && (
          <div className="p-2 bg-accent/50 rounded border">
            <Input
              placeholder="Note title..."
              value={newNote.title}
              onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
              className="mb-2 h-7 text-xs"
            />
            <Textarea
              placeholder={placeholder}
              value={newNote.content}
              onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
              className="mb-2 resize-none text-xs"
              rows={3}
            />
            {allowTags && (
              <Input
                placeholder="Tags (comma separated)"
                value={newNote.tags}
                onChange={(e) => setNewNote(prev => ({ ...prev, tags: e.target.value }))}
                className="mb-2 h-7 text-xs"
              />
            )}
            <div className="flex space-x-2">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleAddNote}>
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  setIsAddingNote(false);
                  setNewNote({ title: '', content: '', tags: '' });
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {notes.slice(0, maxNotes).map(note => (
          <div
            key={note.id}
            className={`group p-2 rounded border hover:bg-accent/20 ${getColorClass(note.color)}`}
          >
            {note.title && (
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-xs truncate">{note.title}</h3>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => setEditingId(note.id)}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => handleDeleteNote(note.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground line-clamp-3 mb-2">
              {note.content}
            </div>
            
            {note.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {note.tags.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs h-4">
                    {tag}
                  </Badge>
                ))}
                {note.tags.length > 2 && (
                  <Badge variant="outline" className="text-xs h-4">
                    +{note.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        ))}

        {notes.length === 0 && !isAddingNote && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-xs">No notes yet</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          <div className="flex items-center space-x-2">
            {!isSingleNote && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsAddingNote(true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            {editingId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setEditingId(null)}
              >
                <Save className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 flex-1 overflow-hidden">
        {isSingleNote ? renderSingleNote() : renderMultipleNotes()}
      </CardContent>
    </Card>
  );
}

// Also export as default for backwards compatibility
export default NotesWidget;