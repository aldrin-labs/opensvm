'use client';

import { FC, ReactNode, useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  onWidthChange?: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  initialWidth?: number;
}

export const AIChatSidebar: FC<AIChatSidebarProps> = ({
  isOpen,
  onClose,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
  initialWidth = 400
}): ReactNode => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m the OpenSVM AI Assistant. How can I help you with Solana today?'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    // Simulate AI response after a short delay
    setTimeout(() => {
      const responses = [
        "I'm analyzing the Solana blockchain data for you...",
        "That's an interesting question about Solana! Let me provide some information...",
        "Based on the current network stats, Solana is processing about 4,000 TPS right now.",
        "You can connect your wallet using the 'Connect Wallet' button in the navigation bar.",
        "Solana's architecture is designed for high throughput and low transaction costs.",
        "The current SOL price and market data can be found in the Analytics section.",
        "NFT collections on Solana include Solana Monkey Business, DeGods, and many others.",
        "I can help you understand transaction details, token information, and network statistics."
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const assistantMessage: Message = { role: 'assistant', content: randomResponse };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div 
      data-testid="ai-chat-sidebar" 
      className={isOpen ? 'visible' : 'hidden'}
      style={{ 
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100%',
        width: `${initialWidth}px`,
        zIndex: 50,
        background: 'var(--background)',
        borderLeft: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column'
      }}
      aria-hidden={!isOpen}
    >
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-bold flex items-center gap-2">
          <Bot size={18} />
          AI Assistant
        </h2>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close AI chat"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground ml-4' 
                    : 'bg-muted mr-4'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs opacity-70">
                  {message.role === 'user' ? (
                    <>
                      <span>You</span>
                      <User size={12} />
                    </>
                  ) : (
                    <>
                      <Bot size={12} />
                      <span>AI Assistant</span>
                    </>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 rounded-lg bg-muted mr-4">
                <div className="flex items-center gap-2 mb-1 text-xs opacity-70">
                  <Bot size={12} />
                  <span>AI Assistant</span>
                </div>
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Solana..."
            className="resize-none min-h-[60px]"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!input.trim() || isLoading}
            className="bg-[#00DC82] text-black hover:bg-[#00DC82]/90"
          >
            <Send size={18} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          The AI assistant can help with Solana questions, transactions, and network information.
        </p>
      </div>
    </div>
  );
};