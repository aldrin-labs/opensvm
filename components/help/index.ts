export { default as ContextualHelp } from './ContextualHelp';
export type { HelpContent } from './ContextualHelp';

export { default as TechnicalTooltip } from './TechnicalTooltip';

export { default as GuidedTour } from './GuidedTour';
export type { TourStep, TourConfig } from './GuidedTour';

export { HelpProvider, useHelp } from './HelpProvider';

export { default as HelpPanel } from './HelpPanel';

export { default as HelpButton } from './HelpButton';

// Re-export help content and tours
export { 
  transactionHelpContent, 
  getHelpContent, 
  getAllHelpIds, 
  searchHelpContent 
} from '../../lib/help/transaction-help-content';

export { 
  transactionExplorerTour, 
  instructionAnalysisTour, 
  accountChangesTour,
  getTourById,
  isTourCompleted,
  isTourSkipped,
  resetTourStatus
} from '../../lib/help/transaction-tours';