import { track, getTelemetrySnapshot, clearTelemetry, startTimer, endTimer } from '../lib/ai/telemetry';

describe('AI Telemetry scaffold', () => {
    beforeEach(() => clearTelemetry());

    test('track stores events', () => {
        track('sidebar_open');
        const snap = getTelemetrySnapshot();
        expect(snap.some(e => e.type === 'sidebar_open')).toBe(true);
    });

    test('start/end timer emits duration', () => {
        startTimer('x');
        endTimer('x', 'timer_done');
        const snap = getTelemetrySnapshot();
        const evt = snap.find(e => e.type === 'timer_done');
        expect(evt).toBeTruthy();
        expect(typeof evt?.payload?.delta).toBe('number');
    });
});
