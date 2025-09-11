import { useState, useRef } from 'react';

interface ChatState {
    // Processing state
    optimisticProcessing: boolean;
    showProcessingUI: boolean;

    // Scroll state
    newMessageCount: number;
    isScrolledUp: boolean;
    shouldAutoScroll: boolean;

    // UI notifications
    copyNotice: boolean;
    actionNotice: string;

    // Input history
    inputHistory: string[];
    historyIndex: number | null;
    draftBeforeHistory: string;

    // Slash commands
    showSlashHelp: boolean;
    slashIndex: number;

    // Reference autocomplete
    showReferenceAutocomplete: boolean;
    referenceIndex: number;
}

interface ChatStateActions {
    setOptimisticProcessing: (value: boolean) => void;
    setShowProcessingUI: (value: boolean) => void;
    setNewMessageCount: (value: number | ((prev: number) => number)) => void;
    setIsScrolledUp: (value: boolean) => void;
    setShouldAutoScroll: (value: boolean) => void;
    setCopyNotice: (value: boolean) => void;
    setActionNotice: (value: string) => void;
    setInputHistory: (value: string[] | ((prev: string[]) => string[])) => void;
    setHistoryIndex: (value: number | null) => void;
    setDraftBeforeHistory: (value: string) => void;
    setShowSlashHelp: (value: boolean) => void;
    setSlashIndex: (value: number | ((prev: number) => number)) => void;
    setShowReferenceAutocomplete: (value: boolean) => void;
    setReferenceIndex: (value: number | ((prev: number) => number)) => void;
}

export function useChatState(): [ChatState, ChatStateActions] {
    // Processing state
    const [optimisticProcessing, setOptimisticProcessing] = useState(false);
    const [showProcessingUI, setShowProcessingUI] = useState(false);

    // Scroll state
    const [newMessageCount, setNewMessageCount] = useState(0);
    const [isScrolledUp, setIsScrolledUp] = useState(false);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    // UI notifications
    const [copyNotice, setCopyNotice] = useState(false);
    const [actionNotice, setActionNotice] = useState<string>('');

    // Input history
    const [inputHistory, setInputHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number | null>(null);
    const [draftBeforeHistory, setDraftBeforeHistory] = useState<string>('');

    // Slash commands
    const [showSlashHelp, setShowSlashHelp] = useState(false);
    const [slashIndex, setSlashIndex] = useState(0);

    // Reference autocomplete
    const [showReferenceAutocomplete, setShowReferenceAutocomplete] = useState(false);
    const [referenceIndex, setReferenceIndex] = useState(0);

    const state: ChatState = {
        optimisticProcessing,
        showProcessingUI,
        newMessageCount,
        isScrolledUp,
        shouldAutoScroll,
        copyNotice,
        actionNotice,
        inputHistory,
        historyIndex,
        draftBeforeHistory,
        showSlashHelp,
        slashIndex,
        showReferenceAutocomplete,
        referenceIndex,
    };

    const actions: ChatStateActions = {
        setOptimisticProcessing,
        setShowProcessingUI,
        setNewMessageCount,
        setIsScrolledUp,
        setShouldAutoScroll,
        setCopyNotice,
        setActionNotice,
        setInputHistory,
        setHistoryIndex,
        setDraftBeforeHistory,
        setShowSlashHelp,
        setSlashIndex,
        setShowReferenceAutocomplete,
        setReferenceIndex,
    };

    return [state, actions];
}
