import { useState, useCallback } from 'react';
import { Message } from '../types';
import { SolanaAgent } from '../core/agent';

interface UseAIChatProps {
  agent: SolanaAgent;
  initialMessage?: string;
}

export function useAIChat({ agent, initialMessage }: UseAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: initialMessage || 'Hello! I\'m your Solana blockchain assistant. How can I help you today?'
  }]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Use isRecording and setIsRecording for voice input functionality
  const toggleRecording = useCallback(() => {
    console.log(`${isRecording ? 'Stopping' : 'Starting'} voice recording...`);
    const newRecordingState = !isRecording;
    setIsRecording(newRecordingState);

    if (newRecordingState) {
      console.log('Voice recording started - preparing speech recognition');
      // Future: Start speech recognition API
    } else {
      console.log('Voice recording stopped - processing speech input');
      // Future: Process recorded speech and add to input
    }
    // Future: integrate with speech recognition API
  }, [isRecording]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim()
    };

    setInput('');
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      const response = await agent.processMessage(userMessage);
      setMessages(prev => [...prev, response]);
    } catch (error) {
      console.error('Error processing message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I encountered an error while processing your request. Please try again.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const addDirectResponse = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const resetChat = (newInitialMessage?: string) => {
    agent.clearContext();
    setMessages([{
      role: 'assistant',
      content: newInitialMessage || initialMessage || 'Hello! I\'m your Solana blockchain assistant. How can I help you today?'
    }]);
  };

  return {
    messages,
    input,
    isProcessing,
    isRecording,
    setInput,
    handleSubmit,
    resetChat,
    addDirectResponse,
    toggleRecording // Use toggleRecording for voice input functionality
  };
}
