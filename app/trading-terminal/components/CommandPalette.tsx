/**
 * CommandPalette
 *
 * Omnipresent command palette for the trading terminal.
 * Activated via Cmd+K/Ctrl+K, accepts natural language commands for:
 * - Trade execution ("buy 10 SOL at market")
 * - Market switching ("show me BONK/USDC")
 * - Layout changes ("switch to day trader layout")
 * - Widget control ("maximize chart", "show positions")
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  Search,
  TrendingUp,
  Layout,
  Maximize2,
  Mic,
  MicOff,
  Loader2,
  ArrowRight,
  Zap,
  Info,
} from 'lucide-react';
import { parseNaturalLanguageCommand, type ParsedCommand } from '@/lib/trading/command-parser';
import { executeCommand } from '@/lib/trading/command-executor';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMarket: string;
  onMarketChange: (market: string) => void;
  onLayoutChange: (presetId: string) => void;
  onTradeExecute: (command: any) => void;
  onMaximizeTile: (tileId: string) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  selectedMarket,
  onMarketChange,
  onLayoutChange,
  onTradeExecute,
  onMaximizeTile,
}: CommandPaletteProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Load recent commands from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trading_recent_commands');
      if (saved) {
        setRecentCommands(JSON.parse(saved));
      }
    }
  }, []);

  // Save command to recent
  const saveRecentCommand = useCallback((command: string) => {
    const updated = [command, ...recentCommands.filter((c) => c !== command)].slice(0, 10);
    setRecentCommands(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trading_recent_commands', JSON.stringify(updated));
    }
  }, [recentCommands]);

  // Parse input as user types
  useEffect(() => {
    if (input.trim()) {
      const parsed = parseNaturalLanguageCommand(input);
      setParsedCommand(parsed);
    } else {
      setParsedCommand(null);
    }
  }, [input]);

  // Execute command
  const handleExecute = useCallback(async () => {
    if (!parsedCommand || parsedCommand.confidence < 0.6) {
      return;
    }

    setIsProcessing(true);
    saveRecentCommand(input);

    try {
      await executeCommand(parsedCommand, {
        selectedMarket,
        onMarketChange,
        onLayoutChange,
        onTradeExecute,
        onMaximizeTile,
      });

      // Close palette after successful execution
      setTimeout(() => {
        setInput('');
        setParsedCommand(null);
        onClose();
      }, 300);
    } catch (error) {
      console.error('Command execution failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [parsedCommand, input, selectedMarket, onMarketChange, onLayoutChange, onTradeExecute, onMaximizeTile, saveRecentCommand, onClose]);

  // Voice input setup
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Toggle voice input
  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) {
      alert('Voice input not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && input.trim() && !isProcessing) {
        e.preventDefault();
        handleExecute();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, input, isProcessing, handleExecute, onClose]);

  // Command suggestions
  const suggestions = [
    { text: 'buy 10 SOL at market', category: 'trade', icon: TrendingUp },
    { text: 'show me BONK/USDC chart', category: 'market', icon: Search },
    { text: 'switch to day trader layout', category: 'layout', icon: Layout },
    { text: 'maximize chart', category: 'widget', icon: Maximize2 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 bg-card border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
          <Command size={20} className="text-primary" />
          <span className="text-sm font-semibold text-primary">Trading Command Palette</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            <kbd className="px-1">Cmd</kbd>+<kbd className="px-1">K</kbd>
          </Badge>
        </div>

        {/* Input */}
        <div className="relative">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search size={18} className="text-muted-foreground flex-shrink-0" />
            <Input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a command... (e.g., 'buy 10 SOL at market')"
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
              disabled={isProcessing || isListening}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleVoiceInput}
              className={`flex-shrink-0 ${isListening ? 'text-destructive' : 'text-muted-foreground'}`}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </Button>
          </div>

          {isListening && (
            <div className="px-4 py-2 bg-primary/10 border-b border-border">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Loader2 size={14} className="animate-spin" />
                Listening...
              </div>
            </div>
          )}
        </div>

        {/* Parsed Command Preview */}
        {parsedCommand && parsedCommand.confidence >= 0.6 && (
          <div className="px-4 py-3 border-b border-border bg-success/5">
            <div className="flex items-start gap-3">
              <Zap size={16} className="text-success mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-success mb-1">
                  Command recognized ({Math.round(parsedCommand.confidence * 100)}% confidence)
                </div>
                <div className="text-xs text-muted-foreground">
                  <strong>Type:</strong> {parsedCommand.type} •{' '}
                  <strong>Action:</strong> {parsedCommand.action}
                  {parsedCommand.parameters && (
                    <>
                      {' '}•{' '}
                      <strong>Parameters:</strong> {JSON.stringify(parsedCommand.parameters)}
                    </>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleExecute}
                disabled={isProcessing}
                className="flex items-center gap-2 bg-success hover:bg-success/90 text-white flex-shrink-0"
              >
                {isProcessing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    Execute
                    <ArrowRight size={14} />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {parsedCommand && parsedCommand.confidence < 0.6 && (
          <div className="px-4 py-3 border-b border-border bg-warning/5">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-warning mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-warning mb-1">
                  Low confidence ({Math.round(parsedCommand.confidence * 100)}%)
                </div>
                <div className="text-xs text-muted-foreground">
                  Try being more specific or use one of the examples below
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {!input.trim() && (
          <div className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              Quick Commands
            </div>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => {
                const Icon = suggestion.icon;
                return (
                  <button
                    key={index}
                    onClick={() => setInput(suggestion.text)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg hover:bg-muted transition-colors group"
                  >
                    <Icon size={16} className="text-muted-foreground group-hover:text-primary" />
                    <span className="text-sm flex-1">{suggestion.text}</span>
                    <Badge variant="secondary" className="text-xs">
                      {suggestion.category}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Commands */}
        {!input.trim() && recentCommands.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              Recent Commands
            </div>
            <div className="space-y-1">
              {recentCommands.slice(0, 5).map((cmd, index) => (
                <button
                  key={index}
                  onClick={() => setInput(cmd)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left rounded hover:bg-muted transition-colors text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowRight size={12} />
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-card/50 text-xs text-muted-foreground flex items-center justify-between">
          <span>💡 Pro tip: Use voice input for hands-free trading</span>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-background border border-border rounded">Enter</kbd>
            <span>to execute</span>
            <kbd className="px-1.5 py-0.5 bg-background border border-border rounded ml-2">Esc</kbd>
            <span>to close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
