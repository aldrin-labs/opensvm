import { useCallback, useEffect, useRef } from 'react';

interface UseAutosizeTextareaOptions {
    maxRows?: number;
    minRows?: number;
}

export function useAutosizeTextarea(
    value: string,
    options: UseAutosizeTextareaOptions = {}
) {
    const { maxRows = 6, minRows = 1 } = options;
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';

        // Calculate line height
        const styles = window.getComputedStyle(textarea);
        const lineHeight = parseInt(styles.lineHeight, 10);

        // Calculate min and max heights
        const minHeight = lineHeight * minRows;
        const maxHeight = lineHeight * maxRows;

        // Get the scroll height and clamp it
        const scrollHeight = textarea.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);

        // Set the new height
        textarea.style.height = `${newHeight}px`;

        // Emit resize event for agent tracking
        try {
            window.dispatchEvent(new CustomEvent('svmai:event', {
                detail: {
                    type: 'input_resize',
                    ts: Date.now(),
                    payload: { h: newHeight }
                }
            }));
        } catch (error) {
            // Ignore custom event errors
        }
    }, [maxRows, minRows]);

    // Adjust height when value changes
    useEffect(() => {
        adjustHeight();
    }, [value, adjustHeight]);

    // Adjust height when textarea ref changes
    useEffect(() => {
        if (textareaRef.current) {
            adjustHeight();
        }
    }, [adjustHeight]);

    return {
        textareaRef,
        adjustHeight
    };
}
