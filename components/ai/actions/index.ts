import { WalletPathFindingAction } from './WalletPathFindingAction';

// Define and export all available AI actions
export const aiActions = [
  WalletPathFindingAction,
];

// Export the wallet path finding action for direct import
export const walletPathFindingAction = WalletPathFindingAction;

/**
 * Get a custom AI action by name
 */
export function getActionByName(name: string) {
  return aiActions.find(action => action.name === name);
}

/**
 * Execute a custom AI action
 */
export async function executeAction(actionName: string, params: any, context: any) {
  const action = getActionByName(actionName);
  if (!action) {
    throw new Error(`Action not found: ${actionName}`);
  }
  
  try {
    return await action.execute({ params, ...context });
  } catch (error) {
    console.error(`Error executing action ${actionName}:`, error);
    throw error;
  }
}
