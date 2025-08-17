/**
 * Phase 3.2.1: Syntax Highlighting Integration
 * Provides lazy-loaded syntax highlighting for code blocks
 */

import React, { useState, useEffect, useRef } from 'react';
import { track } from '@/lib/ai/telemetry';

interface CodeHighlighterProps {
    code: string;
    language?: string;
    className?: string;
    maxLines?: number; // For collapsible large code blocks
}

interface HighlightedCode {
    html: string;
    language: string;
}

// Lazy-loaded syntax highlighter
let prismLoader: Promise<any> | null = null;

async function loadPrism() {
    if (prismLoader) return prismLoader;

    prismLoader = (async () => {
        try {
            // Dynamically import Prism
            const Prism = await import('prismjs');

            // Load common languages
            await Promise.all([
                import('prismjs/components/prism-javascript' as any),
                import('prismjs/components/prism-typescript' as any),
                import('prismjs/components/prism-jsx' as any),
                import('prismjs/components/prism-tsx' as any),
                import('prismjs/components/prism-python' as any),
                import('prismjs/components/prism-rust' as any),
                import('prismjs/components/prism-solidity' as any),
                import('prismjs/components/prism-json' as any),
                import('prismjs/components/prism-yaml' as any),
                import('prismjs/components/prism-bash' as any),
                import('prismjs/components/prism-sql' as any),
                import('prismjs/components/prism-go' as any),
            ]);

            return Prism.default || Prism;
        } catch (error) {
            console.warn('Failed to load syntax highlighter:', error);
            return null;
        }
    })();

    return prismLoader;
}

// Language detection and normalization
function normalizeLanguage(lang?: string): string {
    if (!lang) return 'text';

    const normalized = lang.toLowerCase().trim();

    // Map common aliases
    const languageMap: Record<string, string> = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'rs': 'rust',
        'sol': 'solidity',
        'sh': 'bash',
        'shell': 'bash',
        'yml': 'yaml',
        'md': 'markdown'
    };

    return languageMap[normalized] || normalized;
}

async function highlightCode(code: string, language: string): Promise<HighlightedCode> {
    const Prism = await loadPrism();

    if (!Prism) {
        return { html: code, language: 'text' };
    }

    const normalizedLang = normalizeLanguage(language);

    try {
        // Check if language is supported
        if (Prism.languages[normalizedLang]) {
            const highlighted = Prism.highlight(code, Prism.languages[normalizedLang], normalizedLang);
            return { html: highlighted, language: normalizedLang };
        } else {
            // Fallback to plain text
            return { html: Prism.util.encode(code), language: 'text' };
        }
    } catch (error) {
        console.warn(`Syntax highlighting failed for language ${normalizedLang}:`, error);
        return { html: Prism.util.encode(code), language: 'text' };
    }
}

export function CodeHighlighter({
    code,
    language,
    className = '',
    maxLines = 50
}: CodeHighlighterProps) {
    const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const lines = code.split('\n');
    const shouldCollapse = lines.length > maxLines;
    const displayCode = isCollapsed ? lines.slice(0, 8).join('\n') + '\n...' : code;

    useEffect(() => {
        let cancelled = false;

        async function highlight() {
            try {
                setIsLoading(true);
                setError(null);

                const result = await highlightCode(displayCode, language || 'text');

                if (!cancelled) {
                    setHighlighted(result);

                    // Track syntax highlighting usage
                    track('code_highlighted', {
                        language: result.language,
                        lines: lines.length,
                        characters: code.length,
                        collapsed: isCollapsed
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        // Set initial collapsed state for large code blocks
        if (shouldCollapse && !isCollapsed) {
            setIsCollapsed(true);
        }

        highlight();

        return () => {
            cancelled = true;
        };
    }, [displayCode, language, lines.length, code.length, isCollapsed, shouldCollapse]);

    if (isLoading) {
        return (
            <div
                className={`bg-gray-900 border border-gray-700 rounded-lg p-4 ${className}`}
                data-ai-code-block="loading"
            >
                <div className="flex items-center space-x-2 text-gray-400">
                    <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Highlighting code...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={`bg-gray-900 border border-gray-700 rounded-lg p-4 ${className}`}
                data-ai-code-block="error"
            >
                <div className="text-red-400 text-sm mb-2">Syntax highlighting failed: {error}</div>
                <pre className="text-gray-300 whitespace-pre-wrap overflow-x-auto">
                    <code>{displayCode}</code>
                </pre>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`bg-gray-900 border border-gray-700 rounded-lg overflow-hidden ${className}`}
            data-ai-code-block={highlighted?.language || 'text'}
            data-ai-code-lines={lines.length}
            data-ai-table-collapsed={shouldCollapse ? isCollapsed : undefined}
        >
            {/* Header with language badge and controls */}
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400 font-mono">
                        {highlighted?.language || 'text'}
                    </span>
                    {lines.length > 1 && (
                        <span className="text-xs text-gray-500">
                            {lines.length} lines
                        </span>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    {/* Phase 3.2.3: Collapse toggle for large code blocks */}
                    {shouldCollapse && (
                        <button
                            onClick={() => {
                                setIsCollapsed(!isCollapsed);
                                track('code_toggle', {
                                    language: highlighted?.language || 'text',
                                    expanded: isCollapsed,
                                    lines: lines.length
                                });
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                            data-ai-action="toggle-code-collapse"
                        >
                            {isCollapsed ? `Show all ${lines.length} lines` : 'Collapse'}
                        </button>
                    )}

                    {/* Copy button */}
                    <button
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(code);
                                track('code_copied', {
                                    language: highlighted?.language || 'text',
                                    lines: lines.length
                                });

                                // Visual feedback (could be enhanced with a toast)
                                const button = containerRef.current?.querySelector('[data-ai-action="copy-code"]');
                                if (button) {
                                    const original = button.textContent;
                                    button.textContent = 'Copied!';
                                    setTimeout(() => {
                                        button.textContent = original;
                                    }, 1000);
                                }
                            } catch (err) {
                                console.warn('Failed to copy code:', err);
                            }
                        }}
                        className="text-xs text-gray-400 hover:text-white focus:outline-none focus:ring-1 focus:ring-gray-500 rounded px-2 py-1"
                        data-ai-action="copy-code"
                        title="Copy code to clipboard"
                    >
                        Copy
                    </button>
                </div>
            </div>

            {/* Code content */}
            <div className="overflow-x-auto">
                <pre className="p-4 text-sm">
                    <code
                        className={`language-${highlighted?.language || 'text'}`}
                        dangerouslySetInnerHTML={{ __html: highlighted?.html || displayCode }}
                    />
                </pre>
            </div>
        </div>
    );
}

// Enhanced markdown code component wrapper
export function MarkdownCodeBlock({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLElement> & { children: string }) {
    // Extract language from className (e.g., "language-javascript")
    const language = className?.replace(/language-/, '') || undefined;

    return (
        <CodeHighlighter
            code={children}
            language={language}
            className="my-4"
            {...props}
        />
    );
}
