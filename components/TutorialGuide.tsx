'use client';

import React from 'react';
import HelpButton from './help/HelpButton';
import { isTourCompleted } from '@/lib/help/transaction-tours';

/**
 * Legacy TutorialGuide component - now redirects to the new help system
 * @deprecated Use the new help system with GuidedTour and HelpProvider instead
 */
export function TutorialGuide() {
  // Check if the main transaction explorer tour has been completed
  const hasCompletedMainTour = isTourCompleted('transaction-explorer-tour');

  if (hasCompletedMainTour) {
    return (
      <HelpButton
        variant="text"
        tourId="transaction-explorer-tour"
        className="fixed bottom-4 right-4 bg-background border border-border rounded-lg shadow-lg px-3 py-2"
      >
        Restart Tutorial
      </HelpButton>
    );
  }

  return (
    <HelpButton
      variant="text"
      tourId="transaction-explorer-tour"
      className="fixed bottom-4 right-4 bg-background border border-border rounded-lg shadow-lg px-3 py-2"
    >
      Show Tutorial
    </HelpButton>
  );
}
