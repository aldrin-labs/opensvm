'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchSuggestion } from './types';

interface SearchSuggestionsProps {
  showSuggestions: boolean;
  suggestions: SearchSuggestion[];
  suggestionsRef: React.RefObject<HTMLDivElement>;
  setQuery: (query: string) => void;
  setShowSuggestions: (show: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
}

export const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  showSuggestions,
  suggestions,
  suggestionsRef,
  setQuery,
  setShowSuggestions,
  handleSubmit,
  isLoading = false,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!showSuggestions) {
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.2,
        staggerChildren: 0.03,
        when: "beforeChildren"
      }
    },
    exit: { 
      opacity: 0, 
      y: -10,
      transition: { duration: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -5 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -5 }
  };

  return (
    <AnimatePresence>
      {showSuggestions && (
        <motion.div 
          ref={suggestionsRef} 
          className="absolute top-full left-0 right-0 mt-1 bg-background border border-input rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {isLoading ? (
            <motion.div 
              className="px-4 py-3 text-center text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '600ms' }}></div>
              </div>
              <p className="mt-1 text-sm">Loading suggestions...</p>
            </motion.div>
          ) : suggestions.length === 0 ? (
            <motion.div 
              className="px-4 py-3 text-center text-muted-foreground"
              variants={itemVariants}
            >
              No suggestions found
            </motion.div>
          ) : (
            <>
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={index}
                  type="button"
                  onClick={() => {
                    setQuery(suggestion.value);
                    setShowSuggestions(false);
                    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-2 transition-colors duration-200 relative"
                  variants={itemVariants}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  whileHover={{ backgroundColor: 'rgba(var(--muted), 0.7)' }}
                  whileTap={{ scale: 0.98 }}
                >
                  {hoveredIndex === index && (
                    <motion.div 
                      className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r"
                      layoutId="suggestionHighlight"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                  <span className="text-xs text-muted-foreground uppercase font-medium bg-muted/50 px-1.5 py-0.5 rounded">
                    {suggestion.type}
                  </span>
                  <span className="flex-1 truncate text-foreground">
                    {suggestion.label || suggestion.value}
                  </span>
                </motion.button>
              ))}
              
              <motion.div 
                className="px-4 py-2 border-t border-input text-xs text-muted-foreground"
                variants={itemVariants}
              >
                <div className="flex justify-between items-center">
                  <span>Press <kbd className="px-1 py-0.5 bg-muted rounded border border-border text-xs">↑</kbd> <kbd className="px-1 py-0.5 bg-muted rounded border border-border text-xs">↓</kbd> to navigate</span>
                  <span>Press <kbd className="px-1 py-0.5 bg-muted rounded border border-border text-xs">Enter</kbd> to select</span>
                </div>
              </motion.div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
