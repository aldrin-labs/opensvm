'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SearchButtonProps {
  isLoading: boolean;
}

export const SearchButton: React.FC<SearchButtonProps> = ({ isLoading }) => {
  return (
    <motion.button
      type="submit"
      disabled={isLoading}
      className={`rounded-r-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-all duration-300 ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
      whileHover={{ scale: isLoading ? 1 : 1.03, backgroundColor: 'rgb(var(--primary) / 0.9)' }}
      whileTap={{ scale: isLoading ? 1 : 0.97 }}
      initial={{ opacity: 0.9 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {isLoading ? (
        <motion.div 
          className="flex items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <motion.span 
            animate={{ 
              opacity: [0.6, 1, 0.6],
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 1.5,
              ease: "easeInOut" 
            }}
          >
            Searching...
          </motion.span>
        </motion.div>
      ) : (
        <motion.span 
          className="flex items-center"
          initial={{ x: -5, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 200 }}
        >
          <motion.svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 mr-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            animate={{ rotate: [0, 15, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </motion.svg>
          Search
        </motion.span>
      )}
    </motion.button>
  );
};
