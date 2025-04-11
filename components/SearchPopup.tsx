'use client';
import { useState, useEffect, useRef } from 'react';
import { useKeyboardShortcut } from '@/lib/hooks/keyboard';
import EnhancedSearchBar from '@/components/search';

export function SearchPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  
  // Use a single keyboard shortcut hook to detect both Command+K and Ctrl+K
  useKeyboardShortcut('k', () => {
    setIsOpen(true);
  }, { metaKey: true, ctrlKey: true });

  // Close the popup when Escape is pressed
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Close the popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node) && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div 
        ref={popupRef}
        className="bg-background border border-input rounded-lg shadow-lg w-full max-w-[600px] p-6 animate-in fade-in-0 zoom-in-95"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">Search</h3>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <EnhancedSearchBar />
      </div>
    </div>
  );
}
