import { useState, useEffect } from 'react';
import type { Message, Note, AgentAction } from '../types';
import { SolanaAgent } from '../core/agent';
import { SOLANA_RPC_KNOWLEDGE, PUMPFUN_KNOWLEDGE } from '../core/knowledge';
import { executeAction } from '../actions';
import { UserHistoryService } from '@/lib/user-history';
import { useWallet } from '@solana/wallet-adapter-react';

interface UseAIChatTabsProps {
  agent: SolanaAgent;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const createSystemNotes = (): Note[] => ([
  {
    id: 'pumpfun-program',
    content: JSON.stringify(PUMPFUN_KNOWLEDGE, null, 2),
    author: 'assistant',
    timestamp: Date.now()
  },
  {
    id: 'solana-rpc',
    content: JSON.stringify(SOLANA_RPC_KNOWLEDGE, null, 2),
    author: 'assistant',
    timestamp: Date.now()
  }
]);

const formatActionResponse = (response: Message, action: AgentAction): Message => {
  // Handle custom actions
  if (response?.metadata?.data?.result?.actionName) {
    const { actionName, params } = response.metadata.data.result;
    if (actionName === 'wallet_path_finding') {
      return {
        role: 'assistant' as const,
        content: `I'll find the path between wallet ${params.walletA} and ${params.walletB} by tracking token transfers...`,
        metadata: response.metadata
      };
    }
  }

  // Standard action response formatting
  if (response?.metadata?.data) {
    return {
      role: 'assistant' as const,
      content: `Action completed: ${action.description}\n\`\`\`json\n${JSON.stringify(response.metadata.data, null, 2)}\n\`\`\``,
      metadata: response.metadata
    };
  }
  return response;
};

export function useAIChatTabs({ agent }: UseAIChatTabsProps) {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState('agent');
  const [agentMessages, setAgentMessages] = useState<Message[]>([{
    role: 'assistant',
    content: `#### I'm your Solana blockchain assistant. I can help you analyze on-chain data and interact with pump.fun.

##### Available commands:

* Get transaction details
* Check account balances and token holdings
* Analyze wallet activity
* Track program usage
* Monitor pump.fun tokens
* Track bonding curves
* Execute pump.fun trades
* Find paths between wallets

##### What would you like to check on Solana?`
  }]);
  const [assistantMessages, setAssistantMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'I\'m an AI assistant focused on Solana and blockchain. I can help with explanations and analysis using my knowledge and API data. How can I assist you?'
  }]);
  const [notes, setNotes] = useState<Note[]>(createSystemNotes());
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  // Save message to user history
  const saveToHistory = (message: Message, tabType: 'agent' | 'assistant' | 'notes') => {
    if (!publicKey) return;
    
    try {
      UserHistoryService.addHistoryEntry({
        id: `ai-chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        walletAddress: publicKey.toString(),
        timestamp: Date.now(),
        path: '/ai-chat',
        pageType: 'ai-chat',
        pageTitle: `AI Chat - ${tabType}`,
        metadata: {
          aiChatMessage: {
            role: message.role as 'user' | 'assistant' | 'agent',
            content: message.content,
            tabType
          }
        }
      });
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim()
    };

    setInput('');
    setIsProcessing(true);

    if (activeTab === 'agent') {
      setAgentMessages(prev => [...prev, userMessage]);
      saveToHistory(userMessage, 'agent');

      try {
        // First get the plan with actions
        const planResponse = await agent.processMessage({
          role: 'system',
          content: `You are a Solana blockchain agent with access to RPC methods. Create a plan to handle this request: "${userMessage.content}" using available methods: ${Object.keys(SOLANA_RPC_KNOWLEDGE).join(', ')}. Format actions as [ACTION]type:description[/ACTION].`
        });

        const actions = extractActionsFromResponse(planResponse.content);
        
        if (actions.length === 0) {
          // Try direct execution if no actions were generated
          const response = await agent.processMessage(userMessage);
          setAgentMessages(prev => [...prev, response]);
          saveToHistory(response, 'agent');
          setIsProcessing(false);
          return;
        }

        // Add the plan to messages
        const planMessage = {
          role: 'assistant' as const,
          content: `**I will execute these actions:**\n${actions.map((action, i) => `${i + 1}. ${action.description}`).join('\n')}`
        };
        setAgentMessages(prev => [...prev, planMessage]);
        saveToHistory(planMessage, 'agent');

        // Execute each action in sequence
        const results = [];
        for (const action of actions) {
          try {
            // Update current action to in_progress
            setAgentActions(prev => [...prev, { ...action, status: 'in_progress' }]);

            // Special handling for wallet path finding
            if (action.type === 'wallet_path_finding') {
              // Extract wallet addresses from the description
              const walletAddressRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
              const walletAddresses = action.description.match(walletAddressRegex) || [];
              
              if (walletAddresses.length >= 2) {
                // Add response indicating the action is being processed
                setAgentMessages(prev => [...prev, {
                  role: 'assistant',
                  content: `Finding path between wallets ${walletAddresses[0]} and ${walletAddresses[1]}...`
                }]);
                
                try {
                  // Execute the custom action
                  const customResult = await executeAction('wallet_path_finding', {
                    walletA: walletAddresses[0],
                    walletB: walletAddresses[1],
                    maxDepth: 42
                  }, {
                    streamResponse: (text: string) => {
                      setAgentMessages(prev => [...prev, {
                        role: 'assistant',
                        content: text
                      }]);
                    },
                    response: (text: string) => {
                      setAgentMessages(prev => [...prev, {
                        role: 'assistant',
                        content: text
                      }]);
                    }
                  });
                  
                  results.push({
                    action,
                    response: {
                      role: 'assistant' as const,
                      content: 'Path finding complete.',
                      metadata: {
                        type: 'account' as const,
                        data: customResult
                      }
                    },
                    status: 'completed' as const
                  });
                } catch (error) {
                  results.push({
                    action,
                    error: error instanceof Error ? error.message : String(error),
                    status: 'failed' as const
                  });
                }
                
                // Update action status
                setAgentActions(prev => 
                  prev.map(a => a.id === action.id 
                    ? { ...a, status: 'completed' as const }
                    : a
                  )
                );
                continue;
              }
            }

            // Standard action execution
            const actionResponse = await agent.processMessage({
              role: 'user',
              content: action.description
            });

            // Add result
            results.push({
              action,
              response: actionResponse,
              status: 'completed' as const
            });

            // Update action status
            setAgentActions(prev => 
              prev.map(a => a.id === action.id 
                ? { ...a, status: 'completed' as const }
                : a
              )
            );

          } catch (error) {
            console.error(`Error executing action ${action.description}:`, error);
            results.push({
              action,
              error: error instanceof Error ? error.message : String(error),
              status: 'failed' as const
            });

            // Update action status
            setAgentActions(prev => 
              prev.map(a => a.id === action.id 
                ? { ...a, status: 'failed' as const, error: error instanceof Error ? error.message : String(error) }
                : a
              )
            );
          }
        }

        // Add results to messages
        for (const result of results) {
          if (result.status === 'completed' && result.response) {
            const formattedResponse = formatActionResponse(result.response, result.action);
            setAgentMessages(prev => [...prev, formattedResponse]);
            saveToHistory(formattedResponse, 'agent');
          } else if (result.status === 'failed') {
            const errorMessage = {
              role: 'assistant' as const,
              content: `**Error executing action:** ${result.action.description}\n${result.error}`
            };
            setAgentMessages(prev => [...prev, errorMessage]);
            saveToHistory(errorMessage, 'agent');
          }
        }

        // Add summary message
        const successCount = results.filter(r => r.status === 'completed').length;
        const failureCount = results.filter(r => r.status === 'failed').length;
        const summaryMessage = {
          role: 'assistant' as const,
          content: `**Execution Summary:**\n- ${successCount} action${successCount !== 1 ? 's' : ''} completed successfully\n- ${failureCount} action${failureCount !== 1 ? 's' : ''} failed${failureCount > 0 ? '\n\nYou can retry failed actions using the retry button.' : ''}`
        };
        setAgentMessages(prev => [...prev, summaryMessage]);
        saveToHistory(summaryMessage, 'agent');

      } catch (error) {
        console.error('Error in agent execution:', error);
        const errorMessage = {
          role: 'assistant' as const,
          content: `**Error:** ${error instanceof Error ? error.message : String(error)}. Please try again with more specific information.`
        };
        setAgentMessages(prev => [...prev, errorMessage]);
        saveToHistory(errorMessage, 'agent');
      }
    } else if (activeTab === 'assistant') {
      setAssistantMessages(prev => [...prev, userMessage]);
      saveToHistory(userMessage, 'assistant');
      try {
        const response = await agent.processMessage(userMessage);
        setAssistantMessages(prev => [...prev, response]);
        saveToHistory(response, 'assistant');
      } catch (error) {
        console.error('Error processing message:', error);
        const errorMessage = {
          role: 'assistant' as const,
          content: 'I encountered an error while processing your request. Please try again.'
        };
        setAssistantMessages(prev => [...prev, errorMessage]);
        saveToHistory(errorMessage, 'assistant');
      }
    } else if (activeTab === 'notes') {
      const newNote: Note = {
        id: Date.now().toString(),
        content: input.trim(),
        author: 'user',
        timestamp: Date.now()
      };
      setNotes(prev => [...prev, newNote]);
    }

    setIsProcessing(false);
  };

  const extractActionsFromResponse = (response: string): AgentAction[] => {
    const actionMatches = response.match(/\[ACTION\](.*?)\[\/ACTION\]/g) || [];
    return actionMatches.map(match => {
      const actionContent = match.replace('[ACTION]', '').replace('[/ACTION]', '').trim();
      const firstColonIndex = actionContent.indexOf(':');
      if (firstColonIndex === -1) {
        throw new Error('Invalid action format: missing type delimiter');
      }
      const type = actionContent.slice(0, firstColonIndex).trim();
      const description = actionContent.slice(firstColonIndex + 1).trim();
      return {
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type.toLowerCase() as AgentAction['type'],
        status: 'pending' as const,
        description
      };
    });
  };

  const startRecording = () => {
    try {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (event.results[0] && event.results[0][0]) {
          const speechResult = event.results[0][0].transcript;
          setInput(speechResult);
        }
        setIsRecording(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Speech recognition is not supported in this browser.');
    }
  };

  const handleNewChat = () => {
    if (activeTab === 'agent') {
      agent.clearContext();
      setAgentMessages([{
        role: 'assistant',
        content: `#### I'm your Solana blockchain assistant. I can help you analyze on-chain data and interact with pump.fun.

##### Available commands:

* Get transaction details
* Check account balances and token holdings
* Analyze wallet activity
* Track program usage
* Monitor pump.fun tokens
* Track bonding curves
* Execute pump.fun trades
* Find paths between wallets

##### What would you like to check on Solana?`
      }]);
      setAgentActions([]);
    } else if (activeTab === 'assistant') {
      agent.clearContext();
      setAssistantMessages([{
        role: 'assistant',
        content: 'I\'m an AI assistant focused on Solana and blockchain. I can help with explanations and analysis using my knowledge and API data. How can I assist you?'
      }]);
    }
  };

  const clearNotes = () => {
    setNotes(createSystemNotes());
  };

  const resetEverything = () => {
    agent.clearContext();
    setAgentMessages([{
      role: 'assistant',
      content: `#### I'm your Solana blockchain assistant. I can help you analyze on-chain data and interact with pump.fun.

##### Available commands:

* Get transaction details
* Check account balances and token holdings
* Analyze wallet activity
* Track program usage
* Monitor pump.fun tokens
* Track bonding curves
* Execute pump.fun trades
* Find paths between wallets

##### What would you like to check on Solana?`
    }]);
    setAssistantMessages([{
      role: 'assistant',
      content: 'I\'m an AI assistant focused on Solana and blockchain. I can help with explanations and analysis using my knowledge and API data. How can I assist you?'
    }]);
    clearNotes();
    setAgentActions([]);
  };

  const retryAction = async (actionId: string) => {
    const action = agentActions.find(a => a.id === actionId);
    if (!action) return;

    try {
      // Update action status to in_progress
      setAgentActions(prev => prev.map(a => 
        a.id === actionId 
          ? { ...a, status: 'in_progress' as const, error: undefined }
          : a
      ));

      // Special handling for wallet path finding actions
      if (action.type === 'wallet_path_finding') {
        const walletAddressRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
        const walletAddresses = action.description.match(walletAddressRegex) || [];
        
        if (walletAddresses.length >= 2) {
          setAgentMessages(prev => [...prev, {
            role: 'assistant',
            content: `Retrying path finding between wallets ${walletAddresses[0]} and ${walletAddresses[1]}...`
          }]);
          
          try {
            const customResult = await executeAction('wallet_path_finding', {
              walletA: walletAddresses[0],
              walletB: walletAddresses[1],
              maxDepth: 42
            }, {
              streamResponse: (text: string) => {
                setAgentMessages(prev => [...prev, {
                  role: 'assistant',
                  content: text
                }]);
              },
              response: (text: string) => {
                setAgentMessages(prev => [...prev, {
                  role: 'assistant',
                  content: text
                }]);
              }
            });
            
            // Update action status to completed
            setAgentActions(prev => prev.map(a => 
              a.id === actionId 
                ? { ...a, status: 'completed' as const }
                : a
            ));
            
            return;
          } catch (error) {
            // Update action status to failed
            const errorMessage = error instanceof Error ? error.message : String(error);
            setAgentActions(prev => prev.map(a => 
              a.id === actionId 
                ? { ...a, status: 'failed' as const, error: errorMessage }
                : a
            ));
            
            setAgentMessages(prev => [...prev, {
              role: 'assistant',
              content: `**Error retrying path finding action:** ${errorMessage}`
            }]);
            
            return;
          }
        }
      }

      // Standard action execution
      const executionResponse = await agent.processMessage({
        role: 'user',
        content: action.description
      });

      // Update action status to completed
      setAgentActions(prev => prev.map(a => 
        a.id === actionId 
          ? { ...a, status: 'completed' as const }
          : a
      ));

      // Add the response to messages
      setAgentMessages(prev => [...prev, formatActionResponse(executionResponse, action)]);

    } catch (error) {
      console.error('Error retrying action:', error);
      // Update action status to failed
      setAgentActions(prev => prev.map(a => 
        a.id === actionId 
          ? { ...a, status: 'failed' as const, error: error instanceof Error ? error.message : String(error) }
          : a
      ));
      setAgentMessages(prev => [...prev, {
        role: 'assistant',
        content: `**Error retrying action:** ${error instanceof Error ? error.message : String(error)}`
      }]);
    }
  };

  const messages = activeTab === 'agent' ? agentMessages : 
                  activeTab === 'assistant' ? assistantMessages : [];

  return {
    activeTab,
    setActiveTab,
    messages,
    input,
    isProcessing,
    setInput,
    handleSubmit,
    handleNewChat,
    notes,
    agentActions,
    setAgentActions,
    clearNotes,
    resetEverything,
    retryAction,
    setAgentMessages,
    startRecording,
    isRecording
  };
}
