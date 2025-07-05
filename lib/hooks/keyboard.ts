import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: KeyboardShortcutOptions = {}
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;

      const metaKeyPressed = options.metaKey ? event.metaKey : true;
      const ctrlKeyPressed = options.ctrlKey ? event.ctrlKey : true;
      const altKeyPressed = options.altKey ? event.altKey : !options.altKey;
      const shiftKeyPressed = options.shiftKey ? event.shiftKey : !options.shiftKey;

      // Check if the specified modifier keys match
      const shouldTrigger = 
        (!options.metaKey || event.metaKey) &&
        (!options.ctrlKey || event.ctrlKey) &&
        (!options.altKey || event.altKey) &&
        (!options.shiftKey || event.shiftKey);

      if (shouldTrigger) {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, options]);
}