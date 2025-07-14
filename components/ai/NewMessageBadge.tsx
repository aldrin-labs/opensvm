import React from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewMessageBadgeProps {
  messageCount: number;
  isVisible: boolean;
  onClick: () => void;
  className?: string;
}

export function NewMessageBadge({
  messageCount,
  isVisible,
  onClick,
  className,
}: NewMessageBadgeProps) {
  if (!isVisible || messageCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20",
        "transition-all duration-300 ease-in-out",
        isVisible 
          ? "opacity-100 translate-y-0 scale-100" 
          : "opacity-0 translate-y-2 scale-95 pointer-events-none",
        className
      )}
    >
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full",
          "new-message-badge",
          "shadow-lg backdrop-blur-sm",
          "hover:scale-105 active:scale-95",
          "transition-all duration-200 ease-in-out",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          "group cursor-pointer"
        )}
        aria-label={`${messageCount} new message${messageCount > 1 ? 's' : ''} - click to scroll to bottom`}
        role="button"
        tabIndex={0}
      >
        {/* Message icon */}
        <MessageCircle 
          size={16} 
          className="new-message-badge-icon transition-transform duration-200 group-hover:scale-110" 
        />
        
        {/* Message count and text */}
        <span className="text-sm font-medium new-message-badge-text">
          {messageCount === 1 
            ? '1 new message' 
            : `${messageCount} new messages`
          }
        </span>
        
        {/* Down arrow */}
        <ChevronDown 
          size={16} 
          className="new-message-badge-arrow transition-all duration-200 group-hover:translate-y-0.5" 
        />
        
        {/* Pulse animation for attention */}
        <div className="absolute inset-0 rounded-full new-message-badge-pulse opacity-75 animate-ping" />
      </button>
    </div>
  );
}

export default NewMessageBadge;