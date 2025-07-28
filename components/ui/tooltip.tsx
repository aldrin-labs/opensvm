'use client';

import React, { useState } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPosition({
      x: rect.left + (typeof window !== 'undefined' ? window.scrollX : 0),
      y: rect.bottom + (typeof window !== 'undefined' ? window.scrollY : 0) + 5
    });
    setIsVisible(true);
  };

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="absolute z-50 px-2 py-1 text-xs text-white bg-neutral-900 rounded shadow-lg whitespace-nowrap tooltip-animation"
          style={{
            left: position.x,
            top: position.y,
            transform: 'translateX(-50%)'
          }}
        >
          {content}
        </div>
      )}
      <style jsx global>{`
        .tooltip-animation {
          animation: tooltipFadeIn 0.2s ease-in-out;
        }
        
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
