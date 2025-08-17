/**
 * Phase 4.1.1: Structured Metadata Layer
 * Add data attributes to message DOM for machine extractable transcripts
 */

import React from 'react';
import { generateMessageId } from '../types/conversation';
import { estimateTokens } from '../utils/tokenCounter';
import { track } from '@/lib/ai/telemetry';

export interface MessageMetadata {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokenCount?: number;
  isKnowledge?: boolean;
  metadata?: Record<string, any>;
}

interface MessageWithMetadataProps {
  message: MessageMetadata;
  children: React.ReactNode;
  className?: string;
}

// Enhanced message wrapper with structured metadata
export function MessageWithMetadata({ 
  message, 
  children, 
  className = '' 
}: MessageWithMetadataProps) {
  // Ensure message has deterministic ID
  const messageId = message.id || generateMessageId();
  
  // Calculate token count if not provided
  const tokenCount = message.tokenCount || estimateTokens(message.content);
  
  return (
    <div
      className={`message-container ${className}`}
      data-ai-msg-id={messageId}
      data-ai-msg-role={message.role}
      data-ai-msg-timestamp={message.timestamp}
      data-ai-msg-tokens={tokenCount}
      data-ai-msg-knowledge={message.isKnowledge || undefined}
      data-ai-msg-length={message.content.length}
      data-ai-extractable="true"
    >
      {children}
    </div>
  );
}

// Extract message metadata from DOM element
export function extractMessageMetadata(element: HTMLElement): MessageMetadata | null {
  const id = element.getAttribute('data-ai-msg-id');
  const role = element.getAttribute('data-ai-msg-role') as MessageMetadata['role'];
  const timestamp = element.getAttribute('data-ai-msg-timestamp');
  const tokenCountStr = element.getAttribute('data-ai-msg-tokens');
  const isKnowledgeStr = element.getAttribute('data-ai-msg-knowledge');
  
  if (!id || !role || !timestamp) {
    return null;
  }
  
  // Extract content from the element
  const content = element.textContent || '';
  
  return {
    id,
    role,
    content,
    timestamp,
    tokenCount: tokenCountStr ? parseInt(tokenCountStr, 10) : undefined,
    isKnowledge: isKnowledgeStr === 'true'
  };
}

// Extract all messages from DOM
export function extractAllMessagesFromDOM(): MessageMetadata[] {
  const messageElements = document.querySelectorAll('[data-ai-extractable="true"]');
  const messages: MessageMetadata[] = [];
  
  messageElements.forEach((element) => {
    if (element instanceof HTMLElement) {
      const metadata = extractMessageMetadata(element);
      if (metadata) {
        messages.push(metadata);
      }
    }
  });
  
  // Sort by timestamp
  return messages.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// Export transcript in various formats
export interface ExportOptions {
  format: 'json' | 'markdown' | 'csv';
  threadId?: string;
  includeMetadata?: boolean;
  includeTokenCounts?: boolean;
}

export interface ExportResult {
  data: string;
  filename: string;
  mimeType: string;
  stats: {
    messageCount: number;
    totalTokens: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

export async function exportTranscript(options: ExportOptions = { format: 'json' }): Promise<ExportResult> {
  const messages = extractAllMessagesFromDOM();
  
  if (messages.length === 0) {
    throw new Error('No messages found to export');
  }
  
  const stats = {
    messageCount: messages.length,
    totalTokens: messages.reduce((sum, msg) => sum + (msg.tokenCount || 0), 0),
    dateRange: {
      start: messages[0].timestamp,
      end: messages[messages.length - 1].timestamp
    }
  };
  
  let data: string;
  let filename: string;
  let mimeType: string;
  
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const threadSuffix = options.threadId ? `_${options.threadId.slice(-8)}` : '';
  
  switch (options.format) {
    case 'json':
      data = JSON.stringify({
        exported_at: new Date().toISOString(),
        thread_id: options.threadId,
        metadata: options.includeMetadata ? {
          export_options: options,
          stats
        } : undefined,
        messages: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          ...(options.includeTokenCounts && { token_count: msg.tokenCount }),
          ...(msg.isKnowledge && { is_knowledge: true }),
          ...(options.includeMetadata && msg.metadata && { metadata: msg.metadata })
        }))
      }, null, 2);
      filename = `svmai-transcript${threadSuffix}_${timestamp}.json`;
      mimeType = 'application/json';
      break;
      
    case 'markdown':
      const lines: string[] = [];
      lines.push(`# SVMAI Conversation Export`);
      lines.push(`Exported: ${new Date().toLocaleString()}`);
      lines.push(`Messages: ${stats.messageCount}`);
      if (options.includeTokenCounts) {
        lines.push(`Total Tokens: ${stats.totalTokens}`);
      }
      lines.push('');
      
      messages.forEach((msg, index) => {
        lines.push(`## Message ${index + 1} (${msg.role})`);
        lines.push(`**Time:** ${new Date(msg.timestamp).toLocaleString()}`);
        if (options.includeTokenCounts && msg.tokenCount) {
          lines.push(`**Tokens:** ${msg.tokenCount}`);
        }
        if (msg.isKnowledge) {
          lines.push(`**Source:** Knowledge Base`);
        }
        lines.push('');
        lines.push(msg.content);
        lines.push('');
        lines.push('---');
        lines.push('');
      });
      
      data = lines.join('\n');
      filename = `svmai-transcript${threadSuffix}_${timestamp}.md`;
      mimeType = 'text/markdown';
      break;
      
    case 'csv':
      const csvLines: string[] = [];
      const headers = ['id', 'role', 'timestamp', 'content'];
      if (options.includeTokenCounts) headers.push('token_count');
      if (options.includeMetadata) headers.push('is_knowledge');
      
      csvLines.push(headers.join(','));
      
      messages.forEach(msg => {
        const row = [
          `"${msg.id}"`,
          `"${msg.role}"`,
          `"${msg.timestamp}"`,
          `"${msg.content.replace(/"/g, '""')}"` // Escape quotes
        ];
        
        if (options.includeTokenCounts) {
          row.push(String(msg.tokenCount || ''));
        }
        if (options.includeMetadata) {
          row.push(msg.isKnowledge ? 'true' : 'false');
        }
        
        csvLines.push(row.join(','));
      });
      
      data = csvLines.join('\n');
      filename = `svmai-transcript${threadSuffix}_${timestamp}.csv`;
      mimeType = 'text/csv';
      break;
      
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
  
  // Track export event
  track('transcript_exported', {
    format: options.format,
    message_count: stats.messageCount,
    total_tokens: stats.totalTokens,
    thread_id: options.threadId,
    include_metadata: options.includeMetadata,
    include_tokens: options.includeTokenCounts
  });
  
  return {
    data,
    filename,
    mimeType,
    stats
  };
}

// Download transcript file
export async function downloadTranscript(options: ExportOptions = { format: 'json' }): Promise<void> {
  try {
    const result = await exportTranscript(options);
    
    const blob = new Blob([result.data], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    track('transcript_downloaded', {
      format: options.format,
      filename: result.filename,
      size_kb: Math.round(result.data.length / 1024)
    });
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

// Global API exposure for agents
if (typeof window !== 'undefined') {
  window.SVMAI = window.SVMAI || {};
  window.SVMAI.exportTranscript = exportTranscript;
  
  // Also expose utility functions
  window.SVMAI.extractMessages = extractAllMessagesFromDOM;
  window.SVMAI.downloadTranscript = downloadTranscript;
}

// Hook for embedding pipeline (Phase 4.1.3)
let embeddingQueue: string[] = [];

export function queueForEmbedding(messageId: string): void {
  if (!embeddingQueue.includes(messageId)) {
    embeddingQueue.push(messageId);
    
    // Dispatch event for agent awareness
    window.dispatchEvent(new CustomEvent('svmai:embedding_queue', {
      detail: { messageId, queueSize: embeddingQueue.length }
    }));
    
    track('embedding_queued', {
      message_id: messageId,
      queue_size: embeddingQueue.length
    });
  }
}

export function getEmbeddingQueue(): string[] {
  return [...embeddingQueue];
}

export function clearEmbeddingQueue(): void {
  const cleared = embeddingQueue.length;
  embeddingQueue = [];
  
  track('embedding_queue_cleared', {
    cleared_count: cleared
  });
}
