/**
 * Phase 3.2: Enhanced Message Renderer
 * Integrates syntax highlighting, Mermaid diagrams, and collapsible tables
 */

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeHighlighter } from './CodeHighlighter';
import { MermaidDiagram, isMermaidContent } from './MermaidDiagram';
import { CollapsibleTable, isTableContent, AutoTableBlock } from './CollapsibleTable';
import { track } from '@/lib/ai/telemetry';
import { parseAssistantMessage } from '@/lib/ai/reasoning/parseAssistantMessage';
import { ReasoningBlock } from '../reasoning/ReasoningBlock';

interface EnhancedMessageRendererProps {
    content: string;
    messageId: string;
    className?: string;
    role?: 'user' | 'assistant' | 'system';
}

interface ContentBlock {
    type: 'text' | 'code' | 'mermaid' | 'table';
    content: string;
    language?: string;
    metadata?: {
        lines?: number;
        estimated_tokens?: number;
    };
}

// Parse message content into structured blocks
function parseMessageContent(content: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const lines = content.split('\n');
    let currentBlock: string[] = [];
    let currentType: ContentBlock['type'] = 'text';
    let currentLanguage: string | undefined;
    let inCodeBlock = false;

    const flushCurrentBlock = () => {
        if (currentBlock.length > 0) {
            const blockContent = currentBlock.join('\n');

            // Auto-detect special content types for text blocks
            if (currentType === 'text') {
                if (isMermaidContent(blockContent)) {
                    currentType = 'mermaid';
                } else if (isTableContent(blockContent)) {
                    currentType = 'table';
                }
            }

            blocks.push({
                type: currentType,
                content: blockContent,
                language: currentLanguage,
                metadata: {
                    lines: currentBlock.length,
                    estimated_tokens: Math.ceil(blockContent.length / 4) // Rough token estimate
                }
            });

            currentBlock = [];
            currentType = 'text';
            currentLanguage = undefined;
        }
    };

    for (const line of lines) {
        // Detect code block start/end
        const codeBlockMatch = line.match(/^```(\w+)?/);
        const codeBlockEnd = line === '```';

        if (codeBlockMatch && !inCodeBlock) {
            // Start of code block
            flushCurrentBlock();
            inCodeBlock = true;
            currentType = 'code';
            currentLanguage = codeBlockMatch[1];
        } else if (codeBlockEnd && inCodeBlock) {
            // End of code block
            flushCurrentBlock();
            inCodeBlock = false;
        } else if (inCodeBlock) {
            // Inside code block
            currentBlock.push(line);
        } else {
            // Regular text - accumulate until we find a pattern or code block
            currentBlock.push(line);

            // Check if we should flush for special content
            const blockContent = currentBlock.join('\n');
            if (currentBlock.length > 3) { // Only check after some content
                if (isMermaidContent(blockContent) || isTableContent(blockContent)) {
                    const lastLines = currentBlock.slice(-3);
                    if (lastLines.every(l => l.trim() === '')) {
                        // Flush if we have empty lines (likely end of special content)
                        flushCurrentBlock();
                    }
                }
            }
        }
    }

    // Flush remaining content
    flushCurrentBlock();

    return blocks;
}

export function EnhancedMessageRenderer({
    content,
    messageId,
    className = '',
    role
}: EnhancedMessageRendererProps) {
    // Phase 3.4: Reasoning block extraction (only for assistant messages)
    const reasoningParsed = useMemo(() => {
        if (role !== 'assistant') return null;
        try {
            const parsed = parseAssistantMessage(content);
            return parsed;
        } catch (e) {
            console.warn('Reasoning parse failed', e);
            return null;
        }
    }, [content, role]);

    const effectiveContent = reasoningParsed?.reasoning ? reasoningParsed.visible : content;
    const contentBlocks = useMemo(() => {
        const blocks = parseMessageContent(effectiveContent);

        // Track content analysis
        track('message_content_analyzed', {
            message_id: messageId,
            total_blocks: blocks.length,
            block_types: blocks.map(b => b.type),
            has_code: blocks.some(b => b.type === 'code'),
            has_mermaid: blocks.some(b => b.type === 'mermaid'),
            has_table: blocks.some(b => b.type === 'table'),
            total_lines: blocks.reduce((sum, b) => sum + (b.metadata?.lines || 0), 0)
        });

        return blocks;
    }, [effectiveContent, messageId]);

    const renderBlock = (block: ContentBlock, index: number) => {
        const key = `${messageId}-block-${index}`;

        switch (block.type) {
            case 'code':
                return (
                    <CodeHighlighter
                        key={key}
                        code={block.content}
                        language={block.language}
                        className="my-4"
                    />
                );

            case 'mermaid':
                return (
                    <MermaidDiagram
                        key={key}
                        content={block.content}
                        className="my-4"
                    />
                );

            case 'table':
                return (
                    <AutoTableBlock
                        key={key}
                        className="my-4"
                    >
                        {block.content}
                    </AutoTableBlock>
                );

            case 'text':
            default:
                // Render as markdown with ReactMarkdown and enhanced components
                return (
                    <div key={key} className="prose prose-invert max-w-none my-2">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                pre: ({ node, ...props }) => (
                                    <div className="overflow-auto my-2 bg-white/5 p-2 rounded">
                                        <pre {...props} />
                                    </div>
                                ),
                                code: ({ node, className, ...props }) => {
                                    const isInline = !className;
                                    return isInline ? (
                                        <code className="bg-white/10 rounded px-1" {...props} />
                                    ) : (
                                        <code {...props} />
                                    );
                                },
                                p: ({ node, ...props }) => (
                                    <p className="my-1" {...props} />
                                )
                            }}
                        >
                            {block.content}
                        </ReactMarkdown>
                    </div>
                );
        }
    };

    return (
        <div
            className={`enhanced-message-content ${className}`}
            data-ai-message-id={messageId}
            data-ai-content-blocks={contentBlocks.length}
            data-ai-enhanced-renderer
            aria-label="Enhanced message renderer"
        >
            {/* Visible content blocks */}
            {contentBlocks.map(renderBlock)}
            {/* Collapsible reasoning section */}
            {reasoningParsed?.reasoning && (
                <ReasoningBlock
                    text={reasoningParsed.reasoning.text}
                    tokensEst={reasoningParsed.reasoning.tokensEst}
                    messageId={messageId}
                    initiallyExpanded={false}
                />
            )}
        </div>
    );
}

// Export enhanced components for direct use
export {
    CodeHighlighter,
    MermaidDiagram,
    CollapsibleTable,
    isMermaidContent,
    isTableContent
};
