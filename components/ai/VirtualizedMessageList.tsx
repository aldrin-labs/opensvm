import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '@/lib/ai/types';

interface VirtualizedMessageListProps {
  messages: Message[];
  isProcessing: boolean;
  containerHeight?: number;
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  autoScrollToBottom?: boolean;
}

interface MessageItem {
  message: Message;
  index: number;
  height: number;
  top: number;
}

const ESTIMATED_MESSAGE_HEIGHT = 100; // pixels
const BUFFER_SIZE = 5; // number of extra messages to render outside viewport
const SCROLL_THRESHOLD = 50; // pixels from bottom to trigger auto-scroll

export function VirtualizedMessageList({
  messages,
  isProcessing,
  containerHeight: propContainerHeight,
  onScroll,
  autoScrollToBottom = true,
}: VirtualizedMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const heightCache = useRef<Map<number, number>>(new Map());
  const measurementRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  const [scrollTop, setScrollTop] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [containerHeight, setContainerHeight] = useState(600);

  // Measure container height dynamically
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        if (height > 0) {
          setContainerHeight(height);
        }
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    
    // Also update on prop change if provided
    if (propContainerHeight && propContainerHeight > 0) {
      setContainerHeight(propContainerHeight);
    }

    return () => window.removeEventListener('resize', updateHeight);
  }, [propContainerHeight]);

  // Calculate message positions and heights
  const messageItems = useMemo((): MessageItem[] => {
    let currentTop = 0;
    return messages.map((message, index) => {
      const cachedHeight = heightCache.current.get(index) || ESTIMATED_MESSAGE_HEIGHT;
      const item: MessageItem = {
        message,
        index,
        height: cachedHeight,
        top: currentTop,
      };
      currentTop += cachedHeight;
      return item;
    });
  }, [messages]);

  const totalHeight = messageItems.length > 0 
    ? messageItems[messageItems.length - 1].top + messageItems[messageItems.length - 1].height 
    : 0;

  // Calculate which messages should be visible
  const visibleRange = useMemo(() => {
    if (messageItems.length === 0) return { start: 0, end: 0 };

    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + containerHeight;

    let start = 0;
    let end = messageItems.length;

    // Find first visible message
    for (let i = 0; i < messageItems.length; i++) {
      if (messageItems[i].top + messageItems[i].height >= viewportTop) {
        start = Math.max(0, i - BUFFER_SIZE);
        break;
      }
    }

    // Find last visible message
    for (let i = start; i < messageItems.length; i++) {
      if (messageItems[i].top > viewportBottom) {
        end = Math.min(messageItems.length, i + BUFFER_SIZE);
        break;
      }
    }

    return { start, end };
  }, [messageItems, scrollTop, containerHeight]);

  const visibleMessages = messageItems.slice(visibleRange.start, visibleRange.end);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const newScrollTop = target.scrollTop;
    setScrollTop(newScrollTop);

    const threshold = SCROLL_THRESHOLD;
    const newIsAtBottom = newScrollTop + target.clientHeight >= target.scrollHeight - threshold;
    setIsAtBottom(newIsAtBottom);

    onScroll?.(newScrollTop, target.scrollHeight, target.clientHeight);
  }, [onScroll]);

  // Measure message heights and update cache
  const measureMessage = useCallback((index: number, element: HTMLDivElement | null) => {
    if (element && !heightCache.current.has(index)) {
      const height = element.getBoundingClientRect().height;
      heightCache.current.set(index, height);
      measurementRefs.current.set(index, element);
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScrollToBottom && isAtBottom && containerRef.current) {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      });
    }
  }, [messages.length, autoScrollToBottom, isAtBottom]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  // Expose scroll to bottom function
  useEffect(() => {
    if (messagesEndRef.current) {
      (messagesEndRef.current as any).scrollToBottom = scrollToBottom;
    }
  }, [scrollToBottom]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleMessages.map((item) => (
          <div
            key={item.index}
            ref={(el) => measureMessage(item.index, el)}
            style={{
              position: 'absolute',
              top: item.top,
              left: 0,
              right: 0,
              minHeight: item.height,
            }}
            className="px-4 py-2"
          >
            <article
              className={`flex w-full ${
                item.message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
              role="article"
              aria-label={`${item.message.role === 'user' ? 'Your message' : 'AI response'}`}
              tabIndex={0}
            >
              <div 
                className={`px-4 py-2 rounded-lg max-w-[80%] text-[12px] ${
                  item.message.role === 'user' 
                    ? 'bg-black text-white border border-white/20' 
                    : 'bg-black text-white border border-white/20'
                }`}
              >
                <div className="prose prose-invert max-w-none [&_p]:text-[12px] [&_li]:text-[12px] [&_h1]:text-[16px] [&_h2]:text-[15px] [&_h3]:text-[14px] [&_h4]:text-[13px] [&_h5]:text-[12px]">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: ({ node, ...props }) => (
                        <div className="overflow-auto my-2 bg-white/5 p-2 rounded">
                          <pre {...props} />
                        </div>
                      ),
                      code: ({ node, className, ...props }: any) => (
                        props.inline ?
                          <code className="bg-white/10 rounded px-1" {...props} /> :
                          <code {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="my-1" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-4 space-y-1" {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li className="text-[12px]" {...props} />
                      )
                    }}
                  >
                    {item.message.content}
                  </ReactMarkdown>
                </div>
              </div>
            </article>
          </div>
        ))}
        
        {/* Processing indicator */}
        {isProcessing && (
          <div
            style={{
              position: 'absolute',
              top: totalHeight,
              left: 0,
              right: 0,
            }}
            className="px-4 py-2"
          >
            <div
              role="status"
              aria-live="assertive"
              className="flex justify-center"
            >
              <div className="bg-black text-white border border-white/20 px-4 py-2 rounded-lg">
                <span className="animate-pulse">Processing...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>
    </div>
  );
}

export default VirtualizedMessageList;