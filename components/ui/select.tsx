import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

export function Select({ className = '', ...props }: SelectProps) {
  return (
    <select
      className={`block w-full px-3 py-2 text-sm bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${className}`}
      {...props}
    />
  );
} 
