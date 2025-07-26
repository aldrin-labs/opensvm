'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { TourConfig } from './GuidedTour';
import { HelpContent } from './ContextualHelp';
import { transactionHelpContent } from '@/lib/help/transaction-help-content';
import { 
  transactionExplorerTour, 
  instructionAnalysisTour, 
  accountChangesTour,
  getTourById,
  isTourCompleted
} from '@/lib/help/transaction-tours';

interface HelpContextType {
  // Help content
  getHelpContent: (id: string) => HelpContent | undefined;
  searchHelpContent: (query: string) => HelpContent[];
  
  // Tours
  availableTours: TourConfig[];
  activeTour: TourConfig | null;
  startTour: (tourId: string) => void;
  stopTour: () => void;
  isTourActive: boolean;
  
  // Help panel
  isHelpPanelOpen: boolean;
  openHelpPanel: () => void;
  closeHelpPanel: () => void;
  toggleHelpPanel: () => void;
  
  // Settings
  showHelpHints: boolean;
  setShowHelpHints: (show: boolean) => void;
  autoStartTours: boolean;
  setAutoStartTours: (auto: boolean) => void;
  
  // Analytics
  trackHelpInteraction: (type: string, id: string, data?: any) => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

interface HelpProviderProps {
  children: React.ReactNode;
}

export const HelpProvider: React.FC<HelpProviderProps> = ({ children }) => {
  const [activeTour, setActiveTour] = useState<TourConfig | null>(null);
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
  const [showHelpHints, setShowHelpHints] = useState(true);
  const [autoStartTours, setAutoStartTours] = useState(false);

  const availableTours = [
    transactionExplorerTour,
    instructionAnalysisTour,
    accountChangesTour
  ];

  // Move trackHelpInteraction above all useCallback hooks that depend on it
  const trackHelpInteraction = useCallback((type: string, id: string, data?: any) => {
    // Track help interactions for analytics
    const event = {
      type,
      id,
      timestamp: Date.now(),
      data
    };

    // Store in localStorage for now (could be sent to analytics service)
    const interactions = JSON.parse(localStorage.getItem('help-interactions') || '[]');
    interactions.push(event);
    // Keep only last 100 interactions
    if (interactions.length > 100) {
      interactions.splice(0, interactions.length - 100);
    }
    localStorage.setItem('help-interactions', JSON.stringify(interactions));
    // Log for development
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('Help interaction:', event);
    }
  }, []);
  // ...existing code...

  // Load settings from localStorage
  useEffect(() => {
    const savedHelpHints = localStorage.getItem('help-hints-enabled');
    if (savedHelpHints !== null) {
      setShowHelpHints(savedHelpHints === 'true');
    }

    const savedAutoStart = localStorage.getItem('help-auto-start-tours');
    if (savedAutoStart !== null) {
      setAutoStartTours(savedAutoStart === 'true');
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('help-hints-enabled', showHelpHints.toString());
  }, [showHelpHints]);

  useEffect(() => {
    localStorage.setItem('help-auto-start-tours', autoStartTours.toString());
  }, [autoStartTours]);

  const getHelpContent = useCallback((id: string): HelpContent | undefined => {
    return transactionHelpContent[id];
  }, []);

  const searchHelpContent = useCallback((query: string): HelpContent[] => {
    const lowercaseQuery = query.toLowerCase();
    return Object.values(transactionHelpContent).filter(content =>
      content.title.toLowerCase().includes(lowercaseQuery) ||
      content.description.toLowerCase().includes(lowercaseQuery) ||
      content.relatedTopics?.some(topic => topic.toLowerCase().includes(lowercaseQuery))
    );
  }, []);

  const startTour = useCallback((tourId: string) => {
    const tour = getTourById(tourId);
    if (tour) {
      setActiveTour(tour);
      trackHelpInteraction('tour_started', tourId);
    }
  }, [trackHelpInteraction]);

  const stopTour = useCallback(() => {
    if (activeTour) {
      trackHelpInteraction('tour_stopped', activeTour.id);
    }
    setActiveTour(null);
  }, [activeTour, trackHelpInteraction]);

  const openHelpPanel = useCallback(() => {
    setIsHelpPanelOpen(true);
    trackHelpInteraction('help_panel_opened', 'main');
  }, [trackHelpInteraction]);

  const closeHelpPanel = useCallback(() => {
    setIsHelpPanelOpen(false);
    trackHelpInteraction('help_panel_closed', 'main');
  }, [trackHelpInteraction]);

  const toggleHelpPanel = useCallback(() => {
    if (isHelpPanelOpen) {
      closeHelpPanel();
    } else {
      openHelpPanel();
    }
  }, [isHelpPanelOpen, openHelpPanel, closeHelpPanel]);

  // ...existing code...

  // Auto-start tours for new users
  useEffect(() => {
    if (autoStartTours && typeof window !== 'undefined') {
      // Check if user is new to transaction explorer
      const hasSeenTransactionExplorer = localStorage.getItem('has-seen-transaction-explorer');
      
      if (!hasSeenTransactionExplorer && !isTourCompleted('transaction-explorer-tour')) {
        // Wait a bit for the page to load
        setTimeout(() => {
          startTour('transaction-explorer-tour');
          localStorage.setItem('has-seen-transaction-explorer', 'true');
        }, 2000);
      }
    }
  }, [autoStartTours, startTour]);

  const contextValue: HelpContextType = {
    getHelpContent,
    searchHelpContent,
    availableTours,
    activeTour,
    startTour,
    stopTour,
    isTourActive: activeTour !== null,
    isHelpPanelOpen,
    openHelpPanel,
    closeHelpPanel,
    toggleHelpPanel,
    showHelpHints,
    setShowHelpHints,
    autoStartTours,
    setAutoStartTours,
    trackHelpInteraction
  };

  return (
    <HelpContext.Provider value={contextValue}>
      {children}
    </HelpContext.Provider>
  );
};

export const useHelp = (): HelpContextType => {
  const context = useContext(HelpContext);
  if (context === undefined) {
    throw new Error('useHelp must be used within a HelpProvider');
  }
  return context;
};