// Lightweight telemetry scaffold for AI sidebar
// Emits console logs in dev and mirrors events as DOM CustomEvents for agent automation.

export interface AITelemetryEvent<T extends string = string, P = Record<string, any>> {
    type: T;
    ts: number; // epoch ms
    payload?: P;
}

interface TelemetryConfig {
    enabled: boolean;
    mirrorDomEvents: boolean; // dispatch CustomEvent('svmai:event')
    devConsole: boolean;
    maxQueue?: number;
}

const config: TelemetryConfig = {
    enabled: true,
    mirrorDomEvents: true,
    devConsole: true,
    maxQueue: 500
};

// Use non-generic storage to avoid TS variance friction when pushing generic events
const queue: AITelemetryEvent[] = [];

export function track<T extends string, P = Record<string, any>>(type: T, payload?: P) {
    if (!config.enabled) return;
    const evt: AITelemetryEvent<T, P> = { type, ts: Date.now(), payload };
    // @ts-ignore - generic variance in queue storage
    queue.push(evt);
    if (queue.length > (config.maxQueue || 500)) queue.shift();
    if (config.devConsole) {
        // Safe structured clone fallback
        try {
            // Avoid flooding: group by type? For now simple log.
            // Truncate potential large strings
            const safePayload: any = payload && typeof payload === 'object' ? { ...payload } : payload;
            if (safePayload && typeof safePayload === 'object') {
                for (const k of Object.keys(safePayload)) {
                    const v = (safePayload as any)[k];
                    if (typeof v === 'string' && v.length > 200) {
                        (safePayload as any)[k] = v.slice(0, 200) + '…';
                    }
                }
            }
            // eslint-disable-next-line no-console
            console.debug('[ai-telemetry]', type, safePayload);
        } catch { /* noop */ }
    }
    if (config.mirrorDomEvents && typeof window !== 'undefined') {
        try {
            window.dispatchEvent(new CustomEvent('svmai:event', { detail: evt }));
        } catch { /* noop */ }
    }
}

export function getTelemetrySnapshot(): AITelemetryEvent[] {
    return [...queue];
}

export function clearTelemetry() {
    queue.splice(0, queue.length);
}

export function setTelemetryEnabled(val: boolean) { config.enabled = !!val; }
export function setTelemetryDevConsole(val: boolean) { config.devConsole = !!val; }

// Helper to measure durations between two semantic points
const timers = new Map<string, number>();
export function startTimer(key: string) { timers.set(key, performance.now()); }
export function endTimer(key: string, emitType: string, extra?: Record<string, any>) {
    const start = timers.get(key);
    if (start != null) {
        const delta = performance.now() - start;
        track(emitType as any, { delta, ...(extra || {}) });
        timers.delete(key);
    }
}

// Expose in global (dev) for manual inspection/agent ingestion
if (typeof window !== 'undefined') {
    (window as any).SVMAI = (window as any).SVMAI || {};
    (window as any).SVMAI.getTelemetry = getTelemetrySnapshot;
}
