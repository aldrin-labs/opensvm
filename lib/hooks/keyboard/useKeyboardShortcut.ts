'use client';
import { useEffect, useState } from 'react';

type KeyboardShortcutOptions = {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

/**
 * Hook to detect keyboard shortcuts
 * @param key The key to listen for (e.g., 'k', 'Enter')
 * @param callback The function to call when the shortcut is triggered
 * @param options Additional key modifiers (meta, ctrl, alt, shift)
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: KeyboardShortcutOptions = {}
) {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if the key matches and any of the required modifiers are pressed
      // For metaKey and ctrlKey, we check if either is required and if so, is it pressed
      const metaKeyMatch = options.metaKey ? event.metaKey : true;
      const ctrlKeyMatch = options.ctrlKey ? event.ctrlKey : true;
      
      // If both metaKey and ctrlKey are specified, we need either one to be pressed
      const modifierMatch = options.metaKey && options.ctrlKey 
        ? (event.metaKey || event.ctrlKey) 
        : (metaKeyMatch && ctrlKeyMatch);
      
      // Check other modifiers normally
      const altKeyMatch = options.altKey === undefined || event.altKey === options.altKey;
      const shiftKeyMatch = options.shiftKey === undefined || event.shiftKey === options.shiftKey;

      if (
        event.key.toLowerCase() === key.toLowerCase() &&
        modifierMatch &&
        altKeyMatch &&
        shiftKeyMatch
      ) {
        // Prevent default behavior (like browser shortcuts)
        event.preventDefault();
        
        // Set pressed state to true
        setPressed(true);
        
        // Call the callback function
        callback();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === key.toLowerCase()) {
        setPressed(false);
      }
    };

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Clean up event listeners
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [key, callback, options.metaKey, options.ctrlKey, options.altKey, options.shiftKey]);

  return pressed;
}
