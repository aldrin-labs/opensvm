'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, AlertCircle, CheckCircle, X, Loader2, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tradeCommand?: TradeCommand;
  isConfirmed?: boolean;
}

interface TradeCommand {
  action: 'buy' | 'sell';
  amount: number;
  token: string;
  orderType: 'market' | 'limit';
  price?: number;
  estimatedValue?: number;
}

interface AIChatTradingWidgetProps {
  market: string;
  onTradeExecute?: (command: TradeCommand) => void;
  walletConnected?: boolean;
  marketData?: {
    stats: {
      price: number;
      change24h: number;
      volume24h: number;
      high24h: number;
      low24h: number;
    };
    orderBook?: {
      bids: Array<{ price: number; amount: number }>;
      asks: Array<{ price: number; amount: number }>;
      spreadPercent?: number;
    };
    recentTrades?: Array<{ price: number; amount: number; side: 'buy' | 'sell'; timestamp: number }>;
  };
}

export default function AIChatTradingWidget({ 
  market, 
  onTradeExecute,
  walletConnected = false,
  marketData
}: AIChatTradingWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your AI trading assistant. I can help you:\n\n• Analyze market trends\n• Execute trades with natural language\n• Monitor your positions\n• Provide trading insights\n\nTry: "What's the current SOL trend?" or "Buy 10 SOL at market price"`,
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [pendingTrade, setPendingTrade] = useState<{ messageId: string; command: TradeCommand } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history from session storage
  useEffect(() => {
    const savedMessages = sessionStorage.getItem('ai-trading-chat-history');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((m: Message) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })));
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }, []);

  // Save chat history to session storage
  useEffect(() => {
    if (messages.length > 1) { // Don't save just the welcome message
      sessionStorage.setItem('ai-trading-chat-history', JSON.stringify(messages));
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call AI chat API
      const response = await fetch('/api/trading/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue.trim(),
          market,
          walletConnected,
          chatHistory: messages.slice(-5), // Send last 5 messages for context
          marketData: marketData ? {
            price: marketData.stats.price,
            change24h: marketData.stats.change24h,
            volume24h: marketData.stats.volume24h,
            high24h: marketData.stats.high24h,
            low24h: marketData.stats.low24h,
            orderBook: marketData.orderBook ? {
              topBid: marketData.orderBook.bids[0],
              topAsk: marketData.orderBook.asks[0],
              spread: marketData.orderBook.spreadPercent,
              bidDepth: marketData.orderBook.bids.slice(0, 5),
              askDepth: marketData.orderBook.asks.slice(0, 5),
            } : undefined,
            recentTrades: marketData.recentTrades?.slice(0, 10).map(trade => ({
              price: trade.price,
              amount: trade.amount,
              side: trade.side,
              timestamp: trade.timestamp,
            })),
          } : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        tradeCommand: data.tradeCommand,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If there's a trade command, set it as pending
      if (data.tradeCommand) {
        setPendingTrade({
          messageId: assistantMessage.id,
          command: data.tradeCommand,
        });
      }
    } catch (error) {
      console.error('AI chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `Sorry, I encountered an error. Please try again. ${error instanceof Error ? error.message : ''}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmTrade = () => {
    if (!pendingTrade) return;

    // Mark message as confirmed
    setMessages(prev => prev.map(m => 
      m.id === pendingTrade.messageId 
        ? { ...m, isConfirmed: true }
        : m
    ));

    // Execute trade
    if (onTradeExecute) {
      onTradeExecute(pendingTrade.command);
    }

    // Add confirmation message
    const confirmationMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: `✓ Trade executed: ${pendingTrade.command.action.toUpperCase()} ${pendingTrade.command.amount} ${pendingTrade.command.token} at ${pendingTrade.command.orderType} price`,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, confirmationMessage]);
    setPendingTrade(null);
  };

  const handleCancelTrade = () => {
    if (!pendingTrade) return;

    // Add cancellation message
    const cancelMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: '✗ Trade cancelled',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, cancelMessage]);
    setPendingTrade(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isExpanded) {
    return (
      <div className="h-12 bg-card border-t border-border flex items-center justify-between px-4 cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-primary" />
          <span className="text-sm font-semibold">AI Trading Assistant</span>
        </div>
        <MessageSquare size={16} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="ai-chat-trading-widget flex flex-col bg-card border-t border-border" style={{ height: '400px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-primary" />
          <span className="text-sm font-semibold">AI Trading Assistant</span>
          {!walletConnected && (
            <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded">
              Wallet Not Connected
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-border rounded"
          title="Minimize"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role !== 'user' && (
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'assistant' ? 'bg-primary/20' : 'bg-yellow-500/20'
              }`}>
                {message.role === 'assistant' ? (
                  <Bot size={16} className="text-primary" />
                ) : (
                  <AlertCircle size={16} className="text-yellow-500" />
                )}
              </div>
            )}
            
            <div className={`flex flex-col max-w-[80%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-3 py-2 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground'
                  : message.role === 'system'
                  ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                  : 'bg-card border border-border'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {/* Trade Command Display */}
                {message.tradeCommand && (
                  <div className="mt-2 pt-2 border-t border-border space-y-1">
                    <div className="text-xs font-semibold text-primary">Trade Details:</div>
                    <div className="text-xs space-y-0.5">
                      <div>Action: <span className="font-semibold">{message.tradeCommand.action.toUpperCase()}</span></div>
                      <div>Amount: <span className="font-semibold">{message.tradeCommand.amount} {message.tradeCommand.token}</span></div>
                      <div>Type: <span className="font-semibold">{message.tradeCommand.orderType}</span></div>
                      {message.tradeCommand.price && (
                        <div>Price: <span className="font-semibold">${message.tradeCommand.price.toFixed(2)}</span></div>
                      )}
                      {message.tradeCommand.estimatedValue && (
                        <div>Est. Value: <span className="font-semibold">${message.tradeCommand.estimatedValue.toFixed(2)}</span></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <span className="text-xs text-muted-foreground mt-1">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User size={16} className="text-primary" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot size={16} className="text-primary" />
            </div>
            <div className="px-3 py-2 rounded-lg bg-card border border-border">
              <Loader2 size={16} className="animate-spin text-primary" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Trade Confirmation Modal */}
      {pendingTrade && (
        <div className="px-4 py-3 bg-yellow-500/10 border-t border-yellow-500/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-yellow-500" />
              <span className="text-xs text-yellow-500 font-semibold">
                Confirm trade execution?
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmTrade}
                disabled={!walletConnected}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <CheckCircle size={12} />
                Confirm
              </button>
              <button
                onClick={handleCancelTrade}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          </div>
          {!walletConnected && (
            <p className="text-xs text-yellow-500 mt-2">
              Please connect your wallet to execute trades
            </p>
          )}
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about markets or place trades..."
            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Current market: <span className="font-semibold text-primary">{market}</span>
          {walletConnected ? (
            <span className="ml-2 text-green-500">● Connected</span>
          ) : (
            <span className="ml-2 text-yellow-500">● Not connected</span>
          )}
        </p>
      </div>
    </div>
  );
}
