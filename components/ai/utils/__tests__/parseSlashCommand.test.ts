import { parseSlashCommand, slashHelpMessage } from '../parseSlashCommand';

describe('parseSlashCommand', () => {
    it('parses /tps', () => {
        const res = parseSlashCommand('/tps');
        expect(res).toEqual({ type: 'tps', prompt: 'What is the current Solana TPS?' });
    });

    it('parses /tx <sig>', () => {
        const sig = '1'.repeat(64);
        const res = parseSlashCommand(`/tx ${sig}`);
        expect(res).toEqual({ type: 'tx', signature: sig, prompt: `Explain this transaction: ${sig}` });
    });

    it('parses /wallet <address>', () => {
        const addr = '3x6zJm8k2q9sG4d7fY2bR1nV5pQ8wT7uC6dE4fG2hJkL';
        const res = parseSlashCommand(`/wallet ${addr}`);
        expect(res).toEqual({ type: 'wallet', address: addr, prompt: `Summarize this wallet: ${addr}` });
    });

    it('parses /path <a> <b>', () => {
        // Use simple valid base58 addresses of length 32
        const a = '1'.repeat(32);
        const b = '2'.repeat(32);
        const res = parseSlashCommand(`/path ${a} ${b}`);
        expect(res).toEqual({ type: 'path', walletA: a, walletB: b, prompt: `Find path between wallets ${a} and ${b}` });
    });

    it('returns help message', () => {
        const msg = slashHelpMessage();
        expect(msg).toMatch(/Slash commands/);
        expect(msg).toMatch(/\/tps/);
        expect(msg).toMatch(/\/tx/);
        expect(msg).toMatch(/\/wallet/);
        expect(msg).toMatch(/\/path/);
    });
});
