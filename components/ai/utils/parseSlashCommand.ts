export type ParsedCommand =
    | { type: 'tps'; prompt: string }
    | { type: 'tx'; signature: string; prompt: string }
    | { type: 'wallet'; address: string; prompt: string }
    | { type: 'path'; walletA: string; walletB: string; prompt: string }
    | { type: 'help' };

const PUBKEY_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const TX_RE = /\b[A-Za-z0-9]{50,}\b/;

export function parseSlashCommand(input: string): ParsedCommand | null {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;

    const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
    const cmd = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
        case 'tps':
            return { type: 'tps', prompt: 'What is the current Solana TPS?' };
        case 'tx': {
            const sig = args[0] || '';
            if (!TX_RE.test(sig)) return null;
            return { type: 'tx', signature: sig, prompt: `Explain this transaction: ${sig}` };
        }
        case 'wallet':
        case 'account':
        case 'user': {
            const addr = args[0] || '';
            if (!PUBKEY_RE.test(addr)) return null;
            return { type: 'wallet', address: addr, prompt: `Summarize this wallet: ${addr}` };
        }
        case 'path': {
            const [a, b] = args;
            if (!PUBKEY_RE.test(a || '') || !PUBKEY_RE.test(b || '')) return null;
            return { type: 'path', walletA: a!, walletB: b!, prompt: `Find path between wallets ${a} and ${b}` };
        }
        case 'help':
            return { type: 'help' };
        default:
            return null;
    }
}

export function slashHelpMessage(): string {
    return `#### Slash commands

• /tps — Show current Solana TPS
• /tx <signature> — Explain the given transaction
• /wallet <address> — Summarize a wallet
• /path <walletA> <walletB> — Find a path between two wallets
• /help — Show this help`;
}
