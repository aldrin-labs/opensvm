'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchSuggestion } from './types';
import { Badge } from '@/components/ui/badge';

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
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const suggestionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!showSuggestions) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!suggestions.length) return;

      // Arrow down - move selection down
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
      }

      // Arrow up - move selection up
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
      }

      // Enter - select the current suggestion
      else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const suggestion = suggestions[selectedIndex];
        if (suggestion) {
          setQuery(suggestion.value);
          setShowSuggestions(false);
          handleSubmit({ preventDefault: () => {} } as React.FormEvent);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions, suggestions, selectedIndex, setQuery, setShowSuggestions, handleSubmit]);

  // Scroll to the selected suggestion
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionButtonsRef.current[selectedIndex]) {
      suggestionButtonsRef.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

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

  // Function to get type-specific styles
  const getTypeStyles = (type: string) => {
    const styles: Record<string, { bg: string, text: string, icon: JSX.Element }> = {
      'address': { 
        bg: 'bg-amber-100 dark:bg-amber-900/20', 
        text: 'text-amber-800 dark:text-amber-400',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        )
      },
      'transaction': { 
        bg: 'bg-blue-100 dark:bg-blue-900/20', 
        text: 'text-blue-800 dark:text-blue-400',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
          </svg>
        )
      },
      'token': { 
        bg: 'bg-green-100 dark:bg-green-900/20', 
        text: 'text-green-800 dark:text-green-400',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
        )
      },
      'program': { 
        bg: 'bg-purple-100 dark:bg-purple-900/20', 
        text: 'text-purple-800 dark:text-purple-400',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )
      }
    };
    
    return styles[type] || { 
      bg: 'bg-gray-100 dark:bg-gray-900/20', 
      text: 'text-gray-800 dark:text-gray-400',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      )
    };
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
              <p>No suggestions found</p>
              <p className="text-xs mt-1">Try different keywords or check the address format</p>
            </motion.div>
          ) : (
            <>
              {/* Legend for result types */}
              <div className="px-3 py-2 bg-muted/30 border-b border-input flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">Result types:</span>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 text-[10px] px-1.5 py-0 flex items-center">                
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
                    </svg>
                    TX
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 text-[10px] px-1.5 py-0 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    Address
                  </Badge>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 text-[10px] px-1.5 py-0 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                      <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                    </svg>
                    Token
                  </Badge>
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 text-[10px] px-1.5 py-0 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Program
                  </Badge>
                </div>
              </div>
                            
              <div className="max-h-[240px] overflow-y-auto py-1">
                {suggestions.map((suggestion, index) => {
                  const typeStyle = getTypeStyles(suggestion.type);
                  const isSelected = index === selectedIndex;
                  
                  return (
                    <motion.button
                      key={index}
                      ref={el => suggestionButtonsRef.current[index] = el}
                      type="button"
                      onClick={() => {
                        setQuery(suggestion.value);
                        setShowSuggestions(false);
                        handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                      }}
                      className={`w-full px-4 py-2.5 text-left hover:bg-muted flex items-center gap-2 transition-colors duration-200 relative ${isSelected ? 'bg-muted' : ''}`}
                      variants={itemVariants}
                      onMouseEnter={() => {
                        setHoveredIndex(index);
                        setSelectedIndex(index);
                      }}
                      onMouseLeave={() => setHoveredIndex(null)}
                      whileHover={{ backgroundColor: 'rgba(var(--muted), 0.7)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {(hoveredIndex === index || isSelected) && (
                        <motion.div 
                          className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r"
                          layoutId="suggestionHighlight"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                      
                      <Badge className={`${typeStyle.bg} ${typeStyle.text} text-[10px] px-1.5 py-0.5 flex items-center`}>
                        {typeStyle.icon}
                        {suggestion.type}
                      </Badge>
                      
                      <div className="flex-1 flex flex-col">
                        <span className="text-sm truncate text-foreground font-medium">
                          {suggestion.label || suggestion.value}
                        </span>
                        {suggestion.label && suggestion.label !== suggestion.value && (
                          <span className="text-xs text-muted-foreground truncate">
                            {suggestion.value.length > 10 
                              ? `${suggestion.value.substring(0, 6)}...${suggestion.value.substring(suggestion.value.length - 4)}` 
                              : suggestion.value}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              
              <motion.div 
                className="px-4 py-2 border-t border-input text-xs text-muted-foreground bg-muted/30"
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
