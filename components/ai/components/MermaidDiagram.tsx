/**
 * Phase 3.2.2: Mermaid Diagram Integration
 * Provides lazy-loaded Mermaid diagram rendering with error handling
 */

import React, { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/ai/telemetry';

interface MermaidDiagramProps {
    content: string;
    className?: string;
    maxHeight?: number;
}

interface MermaidConfig {
    theme: 'base' | 'dark' | 'default' | 'forest' | 'neutral';
    securityLevel: 'strict' | 'loose' | 'sandbox';
    startOnLoad: boolean;
    flowchart: {
        useMaxWidth: boolean;
        htmlLabels: boolean;
    };
    sequence: {
        useMaxWidth: boolean;
    };
    gantt: {
        useMaxWidth: boolean;
    };
}// Lazy-loaded Mermaid
let mermaidLoader: Promise<any> | null = null;

async function loadMermaid() {
    if (mermaidLoader) return mermaidLoader;

    mermaidLoader = (async () => {
        try {
            const mermaid = await import('mermaid');

            // Configure Mermaid for dark theme
            const config: MermaidConfig = {
                theme: 'dark',
                securityLevel: 'loose', // Allow HTML in labels
                startOnLoad: false,
                flowchart: {
                    useMaxWidth: true,
                    htmlLabels: true
                },
                sequence: {
                    useMaxWidth: true
                },
                gantt: {
                    useMaxWidth: true
                }
            };

            mermaid.default.initialize(config);
            return mermaid.default;
        } catch (error) {
            console.warn('Failed to load Mermaid:', error);
            return null;
        }
    })();

    return mermaidLoader;
}

// Detect if content is likely a Mermaid diagram
export function isMermaidContent(content: string): boolean {
    const trimmed = content.trim();

    // Common Mermaid diagram types
    const mermaidKeywords = [
        'graph',
        'flowchart',
        'sequenceDiagram',
        'classDiagram',
        'stateDiagram',
        'erDiagram',
        'gantt',
        'pie',
        'journey',
        'gitgraph',
        'mindmap',
        'timeline'
    ];

    return mermaidKeywords.some(keyword =>
        trimmed.toLowerCase().startsWith(keyword.toLowerCase())
    );
}

export function MermaidDiagram({
    content,
    className = '',
    maxHeight = 600
}: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [svgContent, setSvgContent] = useState<string>('');
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function renderDiagram() {
            try {
                setIsLoading(true);
                setError(null);

                const mermaid = await loadMermaid();

                if (!mermaid) {
                    throw new Error('Mermaid failed to load');
                }

                if (cancelled) return;

                // Generate unique ID for this diagram
                const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Validate and render the diagram
                const parseResult = await mermaid.parse(content);
                if (!parseResult) {
                    throw new Error('Invalid Mermaid syntax');
                }

                const { svg } = await mermaid.render(diagramId, content);

                if (!cancelled) {
                    setSvgContent(svg);

                    // Track diagram rendering
                    track('mermaid_rendered', {
                        content_length: content.length,
                        diagram_type: content.split('\n')[0].trim(),
                        successful: true
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    setError(errorMessage);

                    track('mermaid_render_failed', {
                        content_length: content.length,
                        error: errorMessage,
                        diagram_type: content.split('\n')[0].trim()
                    });
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        renderDiagram();

        return () => {
            cancelled = true;
        };
    }, [content]);

    if (isLoading) {
        return (
            <div
                className={`bg-gray-900 border border-gray-700 rounded-lg p-4 ${className}`}
                data-ai-mermaid="loading"
            >
                <div className="flex items-center space-x-2 text-gray-400">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Rendering diagram...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={`bg-gray-900 border border-gray-700 rounded-lg p-4 ${className}`}
                data-ai-mermaid="error"
            >
                <div className="text-red-400 text-sm mb-2">
                    Diagram rendering failed: {error}
                </div>
                <details className="text-gray-400 text-sm">
                    <summary className="cursor-pointer hover:text-white">Show raw content</summary>
                    <pre className="mt-2 whitespace-pre-wrap bg-gray-800 p-2 rounded border">
                        {content}
                    </pre>
                </details>
            </div>
        );
    }

    const diagramHeight = containerRef.current?.querySelector('svg')?.getBBox()?.height || 0;
    const shouldCollapse = diagramHeight > maxHeight;

    return (
        <div
            ref={containerRef}
            className={`bg-gray-900 border border-gray-700 rounded-lg overflow-hidden ${className}`}
            data-ai-mermaid="rendered"
            data-ai-diagram-height={diagramHeight}
            data-ai-table-collapsed={shouldCollapse ? isCollapsed : undefined}
            data-testid="mermaid-diagram"
        >
            {/* Header with controls */}
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400 font-mono">
                        Mermaid Diagram
                    </span>
                    <span className="text-xs text-gray-500">
                        {content.split('\n')[0].trim()}
                    </span>
                </div>

                <div className="flex items-center space-x-2">
                    {/* Phase 3.2.3: Collapse toggle for large diagrams */}
                    {shouldCollapse && (
                        <button
                            onClick={() => {
                                setIsCollapsed(!isCollapsed);
                                track('mermaid_toggle', {
                                    diagram_type: content.split('\n')[0].trim(),
                                    expanded: isCollapsed,
                                    height: diagramHeight
                                });
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                            data-ai-action="toggle-diagram-collapse"
                        >
                            {isCollapsed ? 'Expand diagram' : 'Collapse'}
                        </button>
                    )}

                    {/* Copy source button */}
                    <button
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(content);
                                track('mermaid_source_copied', {
                                    diagram_type: content.split('\n')[0].trim()
                                });

                                // Visual feedback
                                const button = containerRef.current?.querySelector('[data-ai-action="copy-mermaid"]');
                                if (button) {
                                    const original = button.textContent;
                                    button.textContent = 'Copied!';
                                    setTimeout(() => {
                                        button.textContent = original;
                                    }, 1000);
                                }
                            } catch (err) {
                                console.warn('Failed to copy diagram source:', err);
                            }
                        }}
                        className="text-xs text-gray-400 hover:text-white focus:outline-none focus:ring-1 focus:ring-gray-500 rounded px-2 py-1"
                        data-ai-action="copy-mermaid"
                        title="Copy diagram source"
                    >
                        Copy
                    </button>
                </div>
            </div>

            {/* Diagram content */}
            <div
                className={`${shouldCollapse && isCollapsed ? 'max-h-32 overflow-hidden' : ''}`}
                style={{ maxHeight: shouldCollapse && !isCollapsed ? maxHeight : undefined }}
            >
                <div
                    className="p-4 flex justify-center items-center bg-white rounded-b-lg"
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                />
            </div>

            {shouldCollapse && isCollapsed && (
                <div className="p-2 text-center border-t border-gray-700">
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="text-sm text-blue-400 hover:text-blue-300"
                    >
                        Click to expand large diagram
                    </button>
                </div>
            )}
        </div>
    );
}

// Auto-detect and render mermaid in markdown
export function AutoMermaidBlock({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLElement> & { children: string }) {
    if (isMermaidContent(children)) {
        return (
            <MermaidDiagram
                content={children}
                className="my-4"
                {...props}
            />
        );
    }

    // Fallback to regular code block
    return (
        <pre className={`bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto ${className}`}>
            <code>{children}</code>
        </pre>
    );
}
