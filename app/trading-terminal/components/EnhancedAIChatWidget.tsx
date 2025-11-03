'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Loader2, 
  MessageSquare,
  Play,
  Pause,
  Settings,
  TrendingUp,
  Activity,
  Eye,
  EyeOff,
  Zap
} from 'lucide-react';
import { integratedAgent, agentController } from '@/lib/trading/ai-agent-integration';
import { AgentState } from '@/lib/trading/ai-agent-core';
import type { TradingPlan, AgentAction } from '@/lib/trading/ai-agent-core';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  timestamp: Date;
  metadata?: {
    action?: AgentAction;
    plan?: TradingPlan;
    state?: AgentState;
    visual?: {
      type: 'highlight' | 'analysis' | 'execution';
      target?: string;
      color?: string;
    };
  };
}

interface EnhancedAIChatWidgetProps {
  market: string;
  walletConnected: boolean;
  marketData: any;
  onTradeExecute?: (command: any) => void;
}

export default function EnhancedAIChatWidget({ 
  market, 
  walletConnected = false,
  marketData
}: EnhancedAIChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: `🤖 **AI Trading Agent Ready**\n\nI can autonomously analyze markets and execute trades while you watch. My capabilities include:\n\n• 📊 Real-time market analysis\n• 🎯 Strategy generation & execution\n• 👁️ Visual interaction with terminal UI\n• ⚡ Autonomous trading modes\n\nTry: "Analyze SOL for trading opportunities" or "Start scalping with low risk"`,
      timestamp: new Date(),
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>(AgentState.IDLE);
  const [currentPlan, setCurrentPlan] = useState<TradingPlan | null>(null);
  const [showAgentVision, setShowAgentVision] = useState(true);
  const [autonomousMode, setAutonomousMode] = useState(false);
  const [agentConfig, setAgentConfig] = useState({
    strategy: 'scalping' as 'scalping' | 'swing' | 'dca',
    riskLevel: 'low' as 'low' | 'medium' | 'high',
    maxPositions: 3,
    stopLossPercent: 2,
    takeProfitPercent: 3
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Setup agent listeners
  useEffect(() => {
    // Listen to agent state changes
    const stateSubscription = integratedAgent.stateChanges$.subscribe(state => {
      setAgentState(state);
      addAgentMessage(`State: ${state}`, 'system');
    });
    
    // Listen to agent thoughts
    const thoughtsSubscription = integratedAgent.thoughts$.subscribe(thought => {
      addAgentMessage(`💭 ${thought}`, 'agent');
    });
    
    // Listen to plan updates
    const planSubscription = integratedAgent.planUpdates$.subscribe(plan => {
      setCurrentPlan(plan);
      if (plan) {
        addAgentMessage(
          `📋 **Plan ${plan.status}**: ${plan.goal}\n` +
          `Strategy: ${plan.strategy}\n` +
          `Steps: ${plan.steps.length}\n` +
          `Risk: ${plan.metrics?.riskLevel || 'unknown'}`,
          'agent'
        );
      }
    });
    
    // Listen to action executions
    const actionSubscription = integratedAgent.actionExecutions$.subscribe(action => {
      if (showAgentVision) {
        addAgentMessage(
          `⚡ **Action**: ${action.description}\n` +
          `Status: ${action.status}\n` +
          `Target: ${action.uiTarget || 'none'}\n` +
          `Duration: ${action.duration}ms`,
          'agent',
          { action }
        );
      }
    });
    
    // Listen for approval requests
    integratedAgent.on('approvalRequired', (plan: TradingPlan) => {
      addAgentMessage(
        `⚠️ **Approval Required**\n\n${plan.goal}\n\nStrategy: ${plan.strategy}\n` +
        `Confidence: ${(plan.metrics?.confidence || 0) * 100}%\n\n` +
        `Do you approve this plan?`,
        'system',
        { plan }
      );
    });
    
    // Listen for plan summaries
    integratedAgent.on('planSummary', (summary: any) => {
      addAgentMessage(
        `✅ **Plan Complete**\n\n` +
        `Goal: ${summary.goal}\n` +
        `Status: ${summary.status}\n` +
        `Steps: ${summary.stepsCompleted}/${summary.totalSteps}\n` +
        `Duration: ${summary.duration}s`,
        'system'
      );
    });
    
    return () => {
      stateSubscription.unsubscribe();
      thoughtsSubscription.unsubscribe();
      planSubscription.unsubscribe();
      actionSubscription.unsubscribe();
    };
  }, [showAgentVision]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const addAgentMessage = useCallback((
    content: string, 
    role: 'agent' | 'system' = 'agent',
    metadata?: any
  ) => {
    const message: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      metadata
    };
    
    setMessages(prev => [...prev, message]);
  }, []);
  
  const handleStartAutonomous = (command: string) => {
    let strategy: 'scalping' | 'swing' | 'dca' = 'scalping';
    
    if (command.includes('swing')) strategy = 'swing';
    else if (command.includes('dca')) strategy = 'dca';
    
    setAgentConfig(prev => ({ ...prev, strategy }));
    setAutonomousMode(true);
    
    agentController.startAutonomousTrading({
      ...agentConfig,
      strategy
    });
    
    addAgentMessage(
      `🚀 **Autonomous Mode Started**\n\n` +
      `Strategy: ${strategy}\n` +
      `Risk Level: ${agentConfig.riskLevel}\n` +
      `Max Positions: ${agentConfig.maxPositions}\n` +
      `Stop Loss: ${agentConfig.stopLossPercent}%\n` +
      `Take Profit: ${agentConfig.takeProfitPercent}%`,
      'system'
    );
  };
  
  const handleStopAutonomous = () => {
    agentController.stopAutonomousTrading();
    setAutonomousMode(false);
    
    addAgentMessage(
      `⏹️ **Autonomous Mode Stopped**`,
      'system'
    );
  };
  
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isAgentActive) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsAgentActive(true);
    
    try {
      // Check for autonomous mode commands
      const command = inputValue.toLowerCase();
      
      if (command.includes('start') && (command.includes('scalp') || command.includes('swing') || command.includes('dca'))) {
        // Start autonomous trading
        handleStartAutonomous(command);
      } else if (command.includes('stop')) {
        // Stop autonomous trading
        handleStopAutonomous();
      } else {
        // Generate and execute a plan based on user input
        const plan = await integratedAgent.generateEnhancedPlan(inputValue);
        
        if (plan.metrics && plan.metrics.confidence && plan.metrics.confidence > 0.5) {
          // Auto-execute if confidence is high enough
          await integratedAgent.executeEnhancedPlan(plan);
        } else {
          // Ask for approval
          addAgentMessage(
            `Plan generated but confidence is low (${((plan.metrics?.confidence || 0) * 100).toFixed(0)}%). ` +
            `Please review and approve manually.`,
            'system'
          );
        }
      }
    } catch (error) {
      console.error('Agent error:', error);
      addAgentMessage(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'system'
      );
    } finally {
      setIsAgentActive(false);
    }
  };
  
  const handleApprovePlan = () => {
    if (currentPlan) {
      integratedAgent.emit('planApproved');
      addAgentMessage('✅ Plan approved, executing...', 'system');
    }
  };
  
  const handleRejectPlan = () => {
    if (currentPlan) {
      integratedAgent.emit('planRejected');
      addAgentMessage('❌ Plan rejected', 'system');
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className="ai-agent-chat-widget flex flex-col bg-card border-t border-border h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-primary" />
          <span className="text-sm font-semibold">AI Trading Agent</span>
          {autonomousMode && (
            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-500 rounded animate-pulse">
              AUTO
            </span>
          )}
          {agentState !== AgentState.IDLE && (
            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-500 rounded">
              {agentState}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAgentVision(!showAgentVision)}
            className="p-1 hover:bg-border rounded"
            title={showAgentVision ? 'Hide agent vision' : 'Show agent vision'}
          >
            {showAgentVision ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          {autonomousMode ? (
            <button
              onClick={handleStopAutonomous}
              className="p-1 hover:bg-border rounded text-red-500"
              title="Stop autonomous mode"
            >
              <Pause size={14} />
            </button>
          ) : (
            <button
              onClick={() => handleStartAutonomous('start scalping')}
              className="p-1 hover:bg-border rounded text-green-500"
              title="Start autonomous mode"
            >
              <Play size={14} />
            </button>
          )}
        </div>
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
                message.role === 'agent' ? 'bg-primary/20' : 
                message.role === 'system' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
              }`}>
                {message.role === 'agent' ? (
                  <Bot size={16} className="text-primary" />
                ) : message.role === 'system' ? (
                  <AlertCircle size={16} className="text-yellow-500" />
                ) : (
                  <Zap size={16} className="text-blue-500" />
                )}
              </div>
            )}
            
            <div className={`flex flex-col max-w-[80%] ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-3 py-2 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground'
                  : message.role === 'system'
                  ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                  : message.role === 'agent'
                  ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30'
                  : 'bg-card border border-border'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {/* Plan approval buttons */}
                {message.metadata?.plan && message.metadata.plan.status === 'draft' && (
                  <div className="mt-2 pt-2 border-t border-border flex gap-2">
                    <button
                      onClick={handleApprovePlan}
                      className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      <CheckCircle size={12} className="inline mr-1" />
                      Approve
                    </button>
                    <button
                      onClick={handleRejectPlan}
                      className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      <X size={12} className="inline mr-1" />
                      Reject
                    </button>
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
        
        {isAgentActive && (
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
      
      {/* Input Area */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask agent to analyze or trade..."
            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isAgentActive}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isAgentActive}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAgentActive ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            Market: <span className="font-semibold text-primary">{market}</span>
            {walletConnected ? (
              <span className="ml-2 text-green-500">● Connected</span>
            ) : (
              <span className="ml-2 text-yellow-500">● Not connected</span>
            )}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <Activity size={12} className="text-muted-foreground" />
            <span className="text-muted-foreground">
              {autonomousMode ? 'Autonomous Trading Active' : 'Manual Mode'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
