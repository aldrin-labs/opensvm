// global.d.ts
interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    SVMAI?: {
        // Phase 3.1: Performance monitoring
        getPerfSnapshot?: () => {
            droppedFrames: number;
            lastFrameTime: number;
            messageCount: number;
            virtualized: boolean;
        };

        // Phase 3.3: Thread management
        threads?: () => Promise<Array<{
            id: string;
            meta: import('./components/ai/types/conversation').ConversationMetadata;
        }>>;
        loadThread?: (id: string) => Promise<import('./components/ai/types/conversation').ConversationThread | null>;
        getStorageStats?: () => Promise<import('./components/ai/utils/threadManager').ThreadStorageStats>;

        // Future extensions
        contrastReport?: any; // Phase 5.1.3

        // Phase 4.2: Premium gating
        premium?: {
            getConfig: () => import('./components/ai/utils/premiumGating').PremiumConfig;
            canUse: (feature: string, usage: number) => boolean;
            trackUsage: (feature: string, count: number) => boolean;
        };
        
        // Phase 4.1.1: Message metadata utilities
        exportTranscript?: (options?: { format: 'json' | 'markdown' }) => Promise<string>;
        extractMessages?: () => import('./components/ai/utils/messageMetadata').MessageMetadata[];
        downloadTranscript?: (options?: import('./components/ai/utils/messageMetadata').ExportOptions) => Promise<void>;
    };
}