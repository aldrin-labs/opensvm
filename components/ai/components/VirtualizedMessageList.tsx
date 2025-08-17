/**
 * Phase 3.1: Virtualization for Performance & Scale
 * Provides windowed virtualization for large message lists (>150 messages)
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import type { Message } from '../types';

interface VirtualizedMessageListProps {
    messages: Message[];
    renderMessage: (message: Message, index: number) => React.ReactNode;
    threshold?: number; // When to enable virtualization (default: 150)
    itemHeight?: number; // Estimated height per message (default: 120)
    containerHeight?: number; // Visible height (default: 400)
    overscan?: number; // Extra items to render outside viewport (default: 5)
    onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
    autoScrollToBottom?: boolean;
    className?: string;
}

export function VirtualizedMessageList({
    messages,
    renderMessage,
    threshold = 150,
    itemHeight = 120,
    containerHeight = 400,
    overscan = 5,
    onScroll,
    autoScrollToBottom = true,
    className = ''
}: VirtualizedMessageListProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Phase 3.1.2: Conditional virtualization based on message count
    const shouldVirtualize = messages.length > threshold;

    // Calculate visible range for virtualization
    const visibleRange = useMemo(() => {
        if (!shouldVirtualize) {
            return { start: 0, end: messages.length };
        }

        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const endIndex = Math.min(
            messages.length,
            Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
        );

        return { start: startIndex, end: endIndex };
    }, [shouldVirtualize, scrollTop, itemHeight, containerHeight, overscan, messages.length]);

    // Phase 3.1.3: Auto-scroll functionality
    const scrollToBottom = React.useCallback(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, []);

    // Handle scroll events
    const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        const newScrollTop = target.scrollTop;
        const { scrollHeight, clientHeight } = target;

        setScrollTop(newScrollTop);

        // Check if at bottom (within 50px threshold)
        const atBottom = newScrollTop + clientHeight >= scrollHeight - 50;
        setIsAtBottom(atBottom);

        onScroll?.(newScrollTop, scrollHeight, clientHeight);
    }, [onScroll]);

    // Auto-scroll when new messages arrive if at bottom
    useEffect(() => {
        if (autoScrollToBottom && isAtBottom) {
            scrollToBottom();
        }
    }, [messages.length, autoScrollToBottom, isAtBottom, scrollToBottom]);

    // Render virtualized or regular list
    if (!shouldVirtualize) {
        // Regular rendering for small message lists
        return (
            <div
                ref={containerRef}
                className={`overflow-y-auto ${className}`}
                style={{ height: containerHeight }}
                onScroll={handleScroll}
                data-ai-message-list="regular"
            >
                <div className="space-y-4">
                    {messages.map((message, index) => (
                        <div key={`msg-${index}`} data-ai-msg-index={index}>
                            {renderMessage(message, index)}
                        </div>
                    ))}
                    {/* Phase 3.1.3: Scroll sentinel */}
                    <div
                        ref={sentinelRef}
                        data-ai-scroll-sentinel
                        aria-hidden="true"
                    />
                </div>
            </div>
        );
    }

    // Virtualized rendering for large message lists
    const totalHeight = messages.length * itemHeight;
    const offsetY = visibleRange.start * itemHeight;

    return (
        <div
            ref={containerRef}
            className={`overflow-y-auto ${className}`}
            style={{ height: containerHeight }}
            onScroll={handleScroll}
            data-ai-message-list="virtualized"
            data-ai-message-count={messages.length}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Render visible messages */}
                <div
                    style={{
                        transform: `translateY(${offsetY}px)`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                    }}
                >
                    <div className="space-y-4">
                        {messages.slice(visibleRange.start, visibleRange.end).map((message, index) => {
                            const actualIndex = visibleRange.start + index;
                            return (
                                <div
                                    key={`msg-${actualIndex}`}
                                    data-ai-msg-index={actualIndex}
                                    style={{ minHeight: itemHeight }}
                                >
                                    {renderMessage(message, actualIndex)}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Render placeholders for offscreen messages */}
                {visibleRange.start > 0 && (
                    <div
                        style={{ height: offsetY }}
                        className="flex items-center justify-center text-white/30 text-xs"
                        data-virtualized="true"
                        data-ai-placeholder="start"
                    >
                        {visibleRange.start} messages above...
                    </div>
                )}

                {visibleRange.end < messages.length && (
                    <div
                        style={{
                            position: 'absolute',
                            top: visibleRange.end * itemHeight,
                            height: (messages.length - visibleRange.end) * itemHeight,
                        }}
                        className="flex items-center justify-center text-white/30 text-xs"
                        data-virtualized="true"
                        data-ai-placeholder="end"
                    >
                        {messages.length - visibleRange.end} messages below...
                    </div>
                )}

                {/* Phase 3.1.3: Scroll sentinel for auto-scroll */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        height: 1,
                        width: '100%'
                    }}
                    data-ai-scroll-sentinel
                    aria-hidden="true"
                />
            </div>
        </div>
    );
}

// Phase 3.1.5: Performance monitoring utilities
export function usePerformanceMonitoring(enabled = true) {
    const frameTimeRef = useRef<number>(0);
    const droppedFramesRef = useRef<number>(0);
    const lastFrameTimeRef = useRef<number>(performance.now());

    useEffect(() => {
        if (!enabled) return;

        let animationId: number;

        const measureFrame = () => {
            const now = performance.now();
            const deltaTime = now - lastFrameTimeRef.current;

            // Frame is "dropped" if it takes significantly longer than 16.67ms (60fps)
            if (deltaTime > 20) {
                droppedFramesRef.current++;
            }

            frameTimeRef.current = deltaTime;
            lastFrameTimeRef.current = now;

            animationId = requestAnimationFrame(measureFrame);
        };

        animationId = requestAnimationFrame(measureFrame);

        return () => cancelAnimationFrame(animationId);
    }, [enabled]);

    return {
        getDroppedFrames: () => droppedFramesRef.current,
        getLastFrameTime: () => frameTimeRef.current,
        resetCounters: () => {
            droppedFramesRef.current = 0;
            frameTimeRef.current = 0;
        }
    };
}

// Phase 3.1.5: Global performance snapshot

export function setupGlobalPerfSnapshot(
    getMessageCount: () => number,
    isVirtualized: () => boolean,
    perfMonitor: ReturnType<typeof usePerformanceMonitoring>
) {
    if (typeof window !== 'undefined') {
        window.SVMAI = window.SVMAI || {};
        window.SVMAI.getPerfSnapshot = () => ({
            droppedFrames: perfMonitor.getDroppedFrames(),
            lastFrameTime: perfMonitor.getLastFrameTime(),
            messageCount: getMessageCount(),
            virtualized: isVirtualized()
        });
    }
}
