import { useLayoutEffect, useRef } from 'react';

export function useAutosizeTextarea(ref: React.RefObject<HTMLTextAreaElement>, value: string, maxLines = 6) {
    const lineHeightRef = useRef<number | null>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (lineHeightRef.current == null) {
            const styles = window.getComputedStyle(el);
            lineHeightRef.current = parseFloat(styles.lineHeight || '16');
        }
        el.style.height = 'auto';
        const lh = lineHeightRef.current || 16;
        const maxH = lh * maxLines + 8; // small padding fudge
        const newH = Math.min(maxH, el.scrollHeight);
        el.style.height = newH + 'px';
        try { window.dispatchEvent(new CustomEvent('svmai:event', { detail: { type: 'input_resize', ts: Date.now(), payload: { h: newH } } })); } catch { }
    }, [ref, value, maxLines]);
}
