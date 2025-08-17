import { SLASH_COMMANDS } from '../slashCommands';

describe('Slash Commands with /ref', () => {
    it('should include /ref command in the list', () => {
        const refCommand = SLASH_COMMANDS.find(cmd => cmd.cmd === 'ref');

        expect(refCommand).toBeDefined();
        expect(refCommand?.desc).toBe('Reference a knowledge note in your message');
        expect(refCommand?.context).toBe('general');
        expect(refCommand?.category).toBe('action');
        expect(refCommand?.example).toBe('/ref solana architecture');
    });

    it('should have correct total number of commands', () => {
        // Should have original 8 commands plus our new /ref command
        expect(SLASH_COMMANDS).toHaveLength(9);
    });

    it('should maintain all original commands', () => {
        const commandNames = SLASH_COMMANDS.map(cmd => cmd.cmd);

        expect(commandNames).toContain('tps');
        expect(commandNames).toContain('tx');
        expect(commandNames).toContain('wallet');
        expect(commandNames).toContain('path');
        expect(commandNames).toContain('help');
        expect(commandNames).toContain('explain');
        expect(commandNames).toContain('analyze');
        expect(commandNames).toContain('search');
        expect(commandNames).toContain('ref');
    });
});
