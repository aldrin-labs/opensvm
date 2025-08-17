import { mergeKnowledgeNotes, makeNote } from '../components/ai/utils/mergeKnowledgeNotes';

describe('mergeKnowledgeNotes', () => {
    it('returns loaded when prev empty', () => {
        const loaded = [makeNote({ content: 'a' }), makeNote({ content: 'b' })];
        expect(mergeKnowledgeNotes([], loaded)).toEqual(loaded);
    });

    it('returns prev when loaded empty', () => {
        const prev = [makeNote({ content: 'x' })];
        expect(mergeKnowledgeNotes(prev, [])).toEqual(prev);
    });

    it('appends only new loaded notes maintaining prev order', () => {
        const shared = makeNote({ id: 'same', content: 'shared' });
        const prev = [shared, makeNote({ content: 'recent1' })];
        const loaded = [shared, makeNote({ content: 'old1' }), makeNote({ content: 'old2' })];
        const merged = mergeKnowledgeNotes(prev, loaded);
        expect(merged.slice(0, prev.length)).toEqual(prev);
        const appended = merged.slice(prev.length);
        expect(appended.map(n => n.id)).toEqual(
            loaded.filter(l => !prev.find(p => p.id === l.id)).map(n => n.id)
        );
    });

    it('returns prev unchanged when no new ids', () => {
        const a = makeNote({ id: 'a', content: 'A' });
        const b = makeNote({ id: 'b', content: 'B' });
        const prev = [a, b];
        const loaded = [a, b];
        expect(mergeKnowledgeNotes(prev, loaded)).toBe(prev);
    });
});
