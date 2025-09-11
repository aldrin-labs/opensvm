import { useCallback, useMemo } from 'react';
import { useDebounce } from './useDebounce';
import { SLASH_COMMANDS, completeSlashCommand, trackSlashUsage, getContextualSuggestions, getContextBadge } from '../utils/slashCommands';

interface UseSlashCommandsProps {
    input: string;
    showSlashHelp: boolean;
    slashIndex: number;
    onInputChange: (value: string) => void;
    setShowSlashHelp: (show: boolean) => void;
    setSlashIndex: (index: number | ((prev: number) => number)) => void;
}

export function useSlashCommands({
    input,
    showSlashHelp,
    slashIndex,
    onInputChange,
    setShowSlashHelp,
    setSlashIndex,
}: UseSlashCommandsProps) {
    // Debounced input for suggestions
    const debouncedInput = useDebounce(input, 180);

    // Get slash command context
    const getSlashContext = useCallback(() => {
        if (!debouncedInput.startsWith('/') || debouncedInput.startsWith('/ref ')) {
            return {
                raw: debouncedInput,
                trimmed: debouncedInput.trim(),
                afterSlash: debouncedInput.trim(),
                firstToken: '',
                suggestions: []
            };
        }
        const query = debouncedInput.slice(1);
        const suggestions = getContextualSuggestions(query);
        return {
            raw: debouncedInput,
            trimmed: debouncedInput.trim(),
            afterSlash: query,
            firstToken: query.split(' ')[0] || '',
            suggestions
        };
    }, [debouncedInput]);

    // Memoized slash context to prevent unnecessary recalculations
    const slashContext = useMemo(() => getSlashContext(), [getSlashContext]);

    // Handle tab completion
    const handleTabCompletion = useCallback((event: React.KeyboardEvent) => {
        // Immediate Tab completion safeguard for slash commands
        if (event.key === 'Tab' && !event.shiftKey) {
            const currentValue = input;

            // Idempotent guard: if we already have a completed command with trailing space
            if (/^\/[a-zA-Z]+ $/.test(currentValue)) {
                event.preventDefault();
                if (showSlashHelp) {
                    setShowSlashHelp(false);
                    setSlashIndex(0);
                }
                return true;
            }

            // Standard completion path
            if (currentValue.startsWith('/') && !currentValue.startsWith('/ref ')) {
                const trimmedForSuggestions = currentValue.trim();
                const partial = trimmedForSuggestions.slice(1);
                const suggestions = getContextualSuggestions(partial);
                if (suggestions.length > 0) {
                    event.preventDefault();
                    const result = completeSlashCommand(trimmedForSuggestions, 0, suggestions, 'tab');
                    const completedWithSpace = result.completed.endsWith(' ') ? result.completed : (result.completed + ' ');
                    onInputChange(completedWithSpace);
                    setShowSlashHelp(false);
                    setSlashIndex(0);
                    trackSlashUsage(suggestions[0].cmd, 'tab');
                    return true;
                }
            }
        }

        if (showSlashHelp) {
            const { suggestions } = slashContext;

            if (event.key === 'Tab' && !event.shiftKey && suggestions.length > 0) {
                event.preventDefault();
                const selectedCommand = suggestions[Math.min(slashIndex, suggestions.length - 1)];
                const result = completeSlashCommand(input, Math.min(slashIndex, suggestions.length - 1), suggestions, 'tab');
                onInputChange(result.completed);
                setShowSlashHelp(false);
                setSlashIndex(0);
                trackSlashUsage(selectedCommand.cmd, 'tab');
                return true;
            }

            if (event.key === 'Tab' && event.shiftKey && suggestions.length > 0) {
                event.preventDefault();
                setSlashIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return true;
            }

            if (event.key === 'ArrowDown' && suggestions.length > 0) {
                event.preventDefault();
                setSlashIndex(prev => (prev + 1) % suggestions.length);
                return true;
            }

            if (event.key === 'ArrowUp' && suggestions.length > 0) {
                event.preventDefault();
                setSlashIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return true;
            }

            if (event.key === 'ArrowRight' && suggestions.length > 0) {
                // Only handle if cursor is at end
                const target = event.target as HTMLTextAreaElement;
                if (target.selectionStart === target.value.length && target.selectionEnd === target.value.length) {
                    event.preventDefault();
                    const selectedCommand = suggestions[Math.min(slashIndex, suggestions.length - 1)];
                    const result = completeSlashCommand(input, Math.min(slashIndex, suggestions.length - 1), suggestions, 'right');
                    onInputChange(result.completed);
                    setShowSlashHelp(false);
                    setSlashIndex(0);
                    trackSlashUsage(selectedCommand.cmd, 'right');
                    return true;
                }
            }

            if (event.key === 'Enter' && !event.shiftKey && suggestions.length > 0) {
                const selectedCommand = suggestions[Math.min(slashIndex, suggestions.length - 1)];
                const result = completeSlashCommand(input, Math.min(slashIndex, suggestions.length - 1), suggestions, 'enter');
                if (!result.shouldSubmit) {
                    event.preventDefault();
                    onInputChange(result.completed);
                    setShowSlashHelp(false);
                    setSlashIndex(0);
                    trackSlashUsage(selectedCommand.cmd, 'enter');
                    return true;
                }
            }
        }

        return false;
    }, [input, showSlashHelp, slashIndex, slashContext, onInputChange, setShowSlashHelp, setSlashIndex]);

    // Handle enter key fallback completion
    const handleEnterCompletion = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            const rawValue = input;
            const trimmed = rawValue.trim();
            const hasTrailingSpace = rawValue.endsWith(' ');

            if (!hasTrailingSpace && /^\/[a-zA-Z]+$/.test(trimmed)) {
                const token = trimmed.slice(1).toLowerCase();
                const match = SLASH_COMMANDS.find(c => c.cmd.startsWith(token));
                if (match) {
                    event.preventDefault();
                    const completed = `/${match.cmd} `;
                    onInputChange(completed);
                    setShowSlashHelp(false);
                    setSlashIndex(0);
                    trackSlashUsage(match.cmd, 'enter');
                    return true;
                }
            }
        }
        return false;
    }, [input, onInputChange, setShowSlashHelp, setSlashIndex]);

    // Handle input change for slash commands
    const handleInputChange = useCallback((value: string) => {
        const showSlash = value.trim().startsWith('/') && !value.startsWith('/ref ');
        setShowSlashHelp(showSlash);
        if (showSlash) setSlashIndex(0);
    }, [setShowSlashHelp, setSlashIndex]);

    // Generate slash suggestions data
    const getSlashSuggestionsData = useCallback(() => {
        if (!showSlashHelp) return null;

        const { suggestions } = slashContext;
        const active = Math.min(slashIndex, suggestions.length - 1);

        return {
            suggestions,
            activeIndex: active,
            onSuggestionClick: (index: number) => {
                const result = completeSlashCommand(input, index, suggestions, 'tab');
                onInputChange(result.completed);
                setSlashIndex(0);
                trackSlashUsage(suggestions[index].cmd, 'tab');
            }
        };
    }, [showSlashHelp, slashContext, slashIndex, input, onInputChange, setSlashIndex]);

    return {
        slashContext,
        handleTabCompletion,
        handleEnterCompletion,
        handleInputChange,
        getSlashSuggestionsData,
    };
}
