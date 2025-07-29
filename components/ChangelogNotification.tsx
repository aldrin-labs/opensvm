'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bell, X } from 'lucide-react';
import { Button } from './ui/button';

interface ChangelogNotificationProps {
    className?: string;
}

export function ChangelogNotification({ className = '' }: ChangelogNotificationProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [changelogContent, setChangelogContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const popupRef = useRef<HTMLDivElement>(null);

    // Load changelog content when popup opens
    useEffect(() => {
        if (isOpen && !changelogContent) {
            setIsLoading(true);
            fetch('/CHANGELOG.md')
                .then(response => response.text())
                .then(content => {
                    setChangelogContent(content);
                    setIsLoading(false);
                })
                .catch(error => {
                    console.error('Failed to load changelog:', error);
                    setIsLoading(false);
                });
        }
    }, [isOpen, changelogContent]);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node) && isOpen) {
                setIsOpen(false);
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            if (typeof document !== 'undefined') {
                document.removeEventListener('mousedown', handleClickOutside);
            }
        };
    }, [isOpen]);

    // Close popup when Escape is pressed
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('keydown', handleEscape);
        }
        return () => {
            if (typeof document !== 'undefined') {
                document.removeEventListener('keydown', handleEscape);
            }
        };
    }, [isOpen]);

    // Initialize Mermaid when content loads
    useEffect(() => {
        if (changelogContent && isOpen) {
            // Dynamically import and initialize mermaid
            import('mermaid').then((mermaid) => {
                mermaid.default.initialize({
                    startOnLoad: true,
                    theme: 'neutral',
                    themeVariables: {
                        background: '#f7f7f7',
                        primaryColor: '#f7f7f7',
                        primaryTextColor: '#333333',
                        primaryBorderColor: '#555555',
                        lineColor: '#555555'
                    },
                    fontFamily: 'Courier New, Courier, monospace'
                });

                // Re-render mermaid diagrams
                setTimeout(() => {
                    mermaid.default.run();
                }, 100);
            }).catch(err => {
                console.warn('Mermaid not available:', err);
            });
        }
    }, [changelogContent, isOpen]);

    if (!isOpen) {
        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(true)}
                className={`relative p-1.5 ${className}`}
                aria-label="View Changelog"
            >
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
            </Button>
        );
    }

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div
                ref={popupRef}
                className="bg-background border border-input rounded-lg shadow-lg w-full max-w-[900px] max-h-[80vh] animate-in fade-in-0 zoom-in-95 overflow-hidden"
            >
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <h3 className="text-xl font-bold text-foreground">Latest Updates for $SVMAI Token Holders</h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                            <span className="ml-2 text-muted-foreground">Loading changelog...</span>
                        </div>
                    ) : (
                        <div>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    // Custom renderer for code blocks to handle mermaid
                                    code: ({ className, children, ...props }: any) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const language = match ? match[1] : '';

                                        if (language === 'mermaid') {
                                            return (
                                                <div className="mermaid bg-gray-50 p-4 rounded-lg my-4">
                                                    {String(children).replace(/\n$/, '')}
                                                </div>
                                            );
                                        }

                                        return (
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        );
                                    },
                                    // Style headings
                                    h1: ({ children }) => (
                                        <h1 className="text-3xl font-bold mb-6 text-foreground border-b border-border pb-2">
                                            {children}
                                        </h1>
                                    ),
                                    h2: ({ children }) => (
                                        <h2 className="text-2xl font-semibold mb-4 mt-8 text-foreground">
                                            {children}
                                        </h2>
                                    ),
                                    h3: ({ children }) => (
                                        <h3 className="text-xl font-semibold mb-3 mt-6 text-foreground">
                                            {children}
                                        </h3>
                                    ),
                                    // Style links
                                    a: ({ href, children }) => (
                                        <a
                                            href={href}
                                            className="text-blue-600 hover:text-blue-800 underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {children}
                                        </a>
                                    ),
                                    // Style lists
                                    ul: ({ children }) => (
                                        <ul className="list-disc list-inside mb-4 space-y-1">
                                            {children}
                                        </ul>
                                    ),
                                    li: ({ children }) => (
                                        <li className="text-foreground">
                                            {children}
                                        </li>
                                    ),
                                    // Style paragraphs
                                    p: ({ children }) => (
                                        <p className="mb-4 text-foreground leading-relaxed">
                                            {children}
                                        </p>
                                    ),
                                    // Style blockquotes
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-blue-500 pl-4 italic text-foreground/80 my-4">
                                            {children}
                                        </blockquote>
                                    ),
                                    // Style strong text
                                    strong: ({ children }) => (
                                        <strong className="font-semibold text-primary">
                                            {children}
                                        </strong>
                                    )
                                }}
                            >
                                {changelogContent}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 