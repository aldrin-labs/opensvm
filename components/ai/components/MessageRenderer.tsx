import React, { memo } from 'react';
import type { Message } from '../types';
import { MessageActions, type MessageActionType } from './MessageActions';
import { EnhancedMessageRenderer } from './EnhancedMessageRenderer';
import { ReasoningBlock } from './ReasoningBlock';
import { parseAssistantMessage } from '../../../lib/ai/parseAssistantMessage';

interface MessageRendererProps {
  message: Message;
  index: number;
  showRoleLabels: boolean;
  density: 'comfortable' | 'compact';
  fontSize: number;
  showReasoningDefault: boolean;
  onAction: (action: MessageActionType, message: Message) => void;
}

const MessageRenderer = memo<MessageRendererProps>(({
  message,
  index,
  showRoleLabels,
  density,
  fontSize,
  showReasoningDefault,
  onAction
}) => {
  // Helper function to format plan steps (extracted from original renderMessage)
  const formatPlan = (planSteps: Array<{ tool: string; reason?: string; input?: string }>) => {
    if (!planSteps || planSteps.length === 0) return null;

    return (
      <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
        <div className="text-sm font-semibold text-blue-300 mb-2">📋 Execution Plan</div>
        <div className="space-y-2">
          {planSteps.map((step, idx) => (
            <div key={idx} className="text-sm">
              <div className="font-medium text-white">
                Step {idx + 1}: {step.tool?.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()}
              </div>
              {step.reason && (
                <div className="text-gray-300 text-xs mt-1">📝 {step.reason}</div>
              )}
              {step.input && (
                <div className="text-gray-400 text-xs mt-1">
                  📥 Input: <code className="bg-black/30 px-1 rounded">{step.input.length > 50 ? step.input.substring(0, 47) + '...' : step.input}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render message content based on role
  const renderMessageContent = () => {
    if (message.role === 'assistant') {
      const parsed = parseAssistantMessage(message.content);
      
      // Fallback: if parsing failed to produce a reasoning object but raw tag exists,
      // extract first reasoning segment to ensure a visible toggle for E2E reliability.
      let reasoning = parsed.reasoning;
      if (!reasoning && typeof message.content === 'string' && message.content.includes('<REASONING>')) {
        try {
          const m = message.content.match(/<REASONING>([\s\S]*?)<\/REASONING>/);
          if (m && m[1] && m[1].trim()) {
            const text = m[1].trim();
            reasoning = { text, tokensEst: Math.ceil(text.length / 4) };
          }
        } catch { /* noop */ }
      }

      return (
        <>
          <EnhancedMessageRenderer
            content={parsed.visible}
            messageId={`message-${index}`}
            className="prose prose-invert max-w-none"
            role={message.role}
          />
          {parsed.plan && formatPlan(parsed.plan)}
          {parsed.final && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="text-sm font-semibold text-green-300 mb-2">✅ Final Answer</div>
              <div className="text-sm text-white whitespace-pre-wrap">{parsed.final}</div>
            </div>
          )}
          {reasoning && (
            <ReasoningBlock
              reasoning={reasoning}
              collapsed={!showReasoningDefault}
            />
          )}
        </>
      );
    }

    return (
      <EnhancedMessageRenderer
        content={message.content}
        messageId={`message-${index}`}
        className="prose prose-invert max-w-none"
        role={message.role}
      />
    );
  };

  return (
    <article
      key={index}
      className={`group flex w-full ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      role="article"
      aria-label={`${message.role === 'user' ? 'Your message' : 'AI response'}`}
      data-ai-message-role={message.role === 'user' ? 'user' : 'assistant'}
      tabIndex={0}
    >
      <div className="flex flex-col max-w-[80%]">
        {showRoleLabels && (
          <div className="text-[10px] text-white/50 mb-1 px-1">
            {message.role === 'user' ? 'You' : 'AI Assistant'}
          </div>
        )}
        <div
          className={`relative ${density === 'compact' ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-lg ${
            message.role === 'user'
              ? 'bg-slate-800 text-white border border-blue-400/60 shadow-lg shadow-blue-500/10'
              : 'bg-slate-900 text-white border border-slate-600/40 bg-gradient-to-t from-slate-900 to-slate-800/90 shadow-lg'
          }`}
          data-role={message.role}
          style={{
            fontSize: `${fontSize}px`,
            '--prose-body': `${fontSize}px`,
            '--prose-headings': `${Math.min(fontSize + 4, 20)}px`,
          } as React.CSSProperties}
        >
          {renderMessageContent()}
          <MessageActions
            message={message}
            onAction={onAction}
            className="opacity-0 group-hover:opacity-100 absolute -top-2 -right-2 transition-opacity z-10"
          />
        </div>
      </div>
    </article>
  );
});

MessageRenderer.displayName = 'MessageRenderer';

export { MessageRenderer };
