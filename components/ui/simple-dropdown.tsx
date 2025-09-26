'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SimpleDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end' | 'center';
  className?: string;
}

export function SimpleDropdown({ 
  trigger, 
  children, 
  align = 'end',
  className = '' 
}: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Simplified event handlers without useCallback to prevent dependency issues
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  const alignClass = {
    start: 'left-0',
    center: 'left-1/2 transform -translate-x-1/2',
    end: 'right-0'
  }[align];

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      
      {isOpen && (
        <div className={`absolute top-full mt-1 ${alignClass} min-w-48 bg-background border border-border rounded-md shadow-lg z-50 ${className}`}>
          <div className="py-1" onClick={() => setIsOpen(false)}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

interface SimpleDropdownItemProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
  onClick?: () => void;
}

export function SimpleDropdownItem({ 
  children, 
  asChild = false, 
  className = '',
  onClick 
}: SimpleDropdownItemProps) {
  if (asChild) {
    // Simplified asChild implementation without React.cloneElement to prevent render loops
    const child = children as React.ReactElement;
    return (
      <div className={`block w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors ${className}`}>
        {child}
      </div>
    );
  }

  return (
    <button
      className={`block w-full px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
