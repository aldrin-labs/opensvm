import { useRef, useEffect, MutableRefObject } from 'react';

interface UseAutosizeTextareaOptions {
  maxRows?: number;
  minRows?: number;
}

export function useAutosizeTextarea(
  value: string,
  options: UseAutosizeTextareaOptions = {}
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { maxRows = 6, minRows = 1 } = options;

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to get correct scrollHeight
    textarea.style.height = 'auto';
    
    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
    const minHeight = lineHeight * minRows;
    const maxHeight = lineHeight * maxRows;
    
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return { textareaRef, adjustHeight };
}
