'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    speechSynthesis: SpeechSynthesis;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

// Voice command types
interface VoiceCommand {
  patterns: string[];
  description: string;
  category: string;
  action: (params?: any) => void | Promise<void>;
  confirmation?: boolean;
  requiresConfirmation?: boolean;
}

interface VoiceSettings {
  enabled: boolean;
  language: string;
  voiceSpeed: number;
  voiceVolume: number;
  voicePitch: number;
  preferredVoice: string | null;
  continuousListening: boolean;
  audioFeedback: boolean;
  confirmActions: boolean;
  keywordActivation: boolean;
  activationKeyword: string;
}

interface VoiceContextValue {
  // State
  isListening: boolean;
  isSupported: boolean;
  lastCommand: string | null;
  settings: VoiceSettings;
  availableVoices: SpeechSynthesisVoice[];
  
  // Voice Recognition
  startListening: () => void;
  stopListening: () => void;
  processCommand: (command: string) => Promise<void>;
  
  // Speech Synthesis
  speak: (text: string, options?: SpeechOptions) => Promise<void>;
  stopSpeaking: () => void;
  
  // Command Management
  registerCommand: (id: string, command: VoiceCommand) => void;
  unregisterCommand: (id: string) => void;
  getCommands: () => VoiceCommand[];
  
  // Settings
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  
  // Navigation helpers
  announceElement: (element: Element | string, includeInstructions?: boolean) => void;
  announceNavigation: (location: string, context?: string) => void;
  announceAction: (action: string, result?: string) => void;
  announceError: (error: string) => void;
}

interface SpeechOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  interrupt?: boolean;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

const defaultSettings: VoiceSettings = {
  enabled: false,
  language: 'en-US',
  voiceSpeed: 1,
  voiceVolume: 0.8,
  voicePitch: 1,
  preferredVoice: null,
  continuousListening: false,
  audioFeedback: true,
  confirmActions: true,
  keywordActivation: true,
  activationKeyword: 'opensvm',
};

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>(defaultSettings);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [commands] = useState(new Map<string, VoiceCommand>());
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check browser support
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) && 
    'speechSynthesis' in window;

  // Initialize speech synthesis
  useEffect(() => {
    if (!isSupported) return;
    
    synthRef.current = window.speechSynthesis;
    
    const loadVoices = () => {
      const voices = synthRef.current?.getVoices() || [];
      setAvailableVoices(voices);
      
      // Set default voice if none selected
      if (!settings.preferredVoice && voices.length > 0) {
        const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
        if (englishVoice) {
          setSettings(prev => ({ ...prev, preferredVoice: englishVoice.name }));
        }
      }
    };
    
    loadVoices();
    synthRef.current?.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      synthRef.current?.removeEventListener('voiceschanged', loadVoices);
    };
  }, [isSupported, settings.preferredVoice]);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported || !settings.enabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = settings.continuousListening;
    recognition.interimResults = false;
    recognition.lang = settings.language;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setIsListening(true);
      if (settings.audioFeedback) {
        speak('Listening for commands', { interrupt: true });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (settings.continuousListening && settings.enabled) {
        setTimeout(() => recognition.start(), 1000);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        announceError('Microphone access denied. Please enable microphone permissions.');
      } else if (event.error === 'no-speech') {
        if (settings.audioFeedback) {
          speak('No speech detected. Try speaking more clearly.');
        }
      }
    };

    recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      if (result.isFinal) {
        const command = result[0].transcript.trim().toLowerCase();
        setLastCommand(command);
        processCommand(command);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabled, settings.continuousListening, settings.language, isSupported, settings.audioFeedback]);

  const startListening = useCallback(() => {
    if (!isSupported || !settings.enabled || isListening) return;
    
    try {
      recognitionRef.current?.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      speak(`Error: Failed to start voice recognition`, { interrupt: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, settings.enabled, isListening]);

  const stopListening = useCallback(() => {
    if (!isListening) return;
    
    recognitionRef.current?.stop();
    setIsListening(false);
    
    if (settings.audioFeedback) {
      speak('Voice recognition stopped', { interrupt: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, settings.audioFeedback]);

  const speak = useCallback(async (text: string, options: SpeechOptions = {}): Promise<void> => {
    if (!isSupported || !synthRef.current) return Promise.resolve();

    return new Promise((resolve) => {
      if (options.interrupt) {
        synthRef.current?.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply voice settings
      if (options.voice) {
        utterance.voice = options.voice;
      } else if (settings.preferredVoice) {
        const voice = availableVoices.find(v => v.name === settings.preferredVoice);
        if (voice) utterance.voice = voice;
      }
      
      utterance.rate = options.rate || settings.voiceSpeed;
      utterance.pitch = options.pitch || settings.voicePitch;
      utterance.volume = options.volume || settings.voiceVolume;

      utterance.onend = () => {
        currentUtteranceRef.current = null;
        resolve();
      };

      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        currentUtteranceRef.current = null;
        resolve();
      };

      currentUtteranceRef.current = utterance;
      synthRef.current?.speak(utterance);
    });
  }, [isSupported, settings, availableVoices]);

  const stopSpeaking = useCallback(() => {
    if (!synthRef.current) return;
    
    synthRef.current.cancel();
    currentUtteranceRef.current = null;
  }, []);

  const processCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;

    // Handle activation keyword
    if (settings.keywordActivation) {
      const normalizedCommand = command.toLowerCase();
      if (!normalizedCommand.includes(settings.activationKeyword.toLowerCase())) {
        return; // Ignore commands without activation keyword
      }
      // Remove activation keyword from command
      command = normalizedCommand.replace(settings.activationKeyword.toLowerCase(), '').trim();
    }

    // Find matching command
    let matchedCommand: VoiceCommand | null = null;
    let matchedId: string | null = null;

    for (const [id, voiceCommand] of commands) {
      for (const pattern of voiceCommand.patterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(command)) {
          matchedCommand = voiceCommand;
          matchedId = id;
          break;
        }
      }
      if (matchedCommand) break;
    }

    if (matchedCommand) {
      if (settings.audioFeedback) {
        speak(`Executing: ${matchedCommand.description}`);
      }

      if (settings.confirmActions && matchedCommand.requiresConfirmation) {
        const confirmed = await askForConfirmation(matchedCommand.description);
        if (!confirmed) {
          speak('Command cancelled');
          return;
        }
      }

      try {
        await matchedCommand.action();
        if (settings.audioFeedback && matchedCommand.confirmation) {
          speak(`${matchedCommand.description} completed`);
        }
      } catch (error) {
        console.error('Command execution error:', error);
        speak(`Error: Failed to execute: ${matchedCommand.description}`, { interrupt: true });
      }
    } else {
      if (settings.audioFeedback) {
        speak(`Command not recognized: ${command}. Say "help" to hear available commands.`);
      }
    }
  }, [commands, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const askForConfirmation = useCallback(async (action: string): Promise<boolean> => {
    return new Promise((resolve) => {
      speak(`Are you sure you want to ${action}? Say "yes" to confirm or "no" to cancel.`);
      
      // Set up temporary listener for confirmation
      const confirmationTimeout = setTimeout(() => {
        speak('No response received. Command cancelled.');
        resolve(false);
      }, 5000);

      const confirmationHandler = (command: string) => {
        clearTimeout(confirmationTimeout);
        const normalizedCommand = command.toLowerCase().trim();
        
        if (normalizedCommand.includes('yes') || normalizedCommand.includes('confirm')) {
          resolve(true);
        } else {
          resolve(false);
        }
      };

      // This is a simplified version - in a real implementation,
      // you'd need a more sophisticated confirmation system
      setTimeout(() => resolve(false), 5000);
    });
  }, [speak]);

  const registerCommand = useCallback((id: string, command: VoiceCommand) => {
    commands.set(id, command);
  }, [commands]);

  const unregisterCommand = useCallback((id: string) => {
    commands.delete(id);
  }, [commands]);

  const getCommands = useCallback(() => {
    return Array.from(commands.values());
  }, [commands]);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('voice-settings', JSON.stringify(updated));
      }
      
      return updated;
    });
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('voice-settings');
      if (stored) {
        try {
          const parsedSettings = JSON.parse(stored);
          setSettings(prev => ({ ...prev, ...parsedSettings }));
        } catch (error) {
          console.error('Failed to load voice settings:', error);
        }
      }
    }
  }, []);

  // Helper functions for announcements
  const announceElement = useCallback((element: Element | string, includeInstructions = false) => {
    if (!settings.audioFeedback) return;

    let text = '';
    
    if (typeof element === 'string') {
      text = element;
    } else {
      // Extract meaningful information from DOM element
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const ariaLabel = element.getAttribute('aria-label');
      const title = element.getAttribute('title');
      const textContent = element.textContent?.trim() || '';

      if (ariaLabel) {
        text = ariaLabel;
      } else if (title) {
        text = title;
      } else if (textContent) {
        text = textContent.slice(0, 100); // Limit length
      }

      // Add role/tag information
      if (role) {
        text = `${role}: ${text}`;
      } else if (tagName === 'button') {
        text = `Button: ${text}`;
      } else if (tagName === 'link' || tagName === 'a') {
        text = `Link: ${text}`;
      } else if (tagName === 'input') {
        const type = element.getAttribute('type') || 'text';
        text = `${type} input: ${text}`;
      }

      if (includeInstructions) {
        if (tagName === 'button' || role === 'button') {
          text += '. Press Enter or Space to activate.';
        } else if (tagName === 'link' || tagName === 'a') {
          text += '. Press Enter to follow link.';
        }
      }
    }

    if (text) {
      speak(text);
    }
  }, [settings.audioFeedback, speak]);

  const announceNavigation = useCallback((location: string, context?: string) => {
    if (!settings.audioFeedback) return;
    
    let announcement = `Navigated to ${location}`;
    if (context) {
      announcement += `. ${context}`;
    }
    
    speak(announcement, { interrupt: true });
  }, [settings.audioFeedback, speak]);

  const announceAction = useCallback((action: string, result?: string) => {
    if (!settings.audioFeedback) return;
    
    let announcement = action;
    if (result) {
      announcement += `. ${result}`;
    }
    
    speak(announcement);
  }, [settings.audioFeedback, speak]);

  const announceError = useCallback((error: string) => {
    speak(`Error: ${error}`, { interrupt: true });
  }, [speak]);

  const value: VoiceContextValue = {
    // State
    isListening,
    isSupported,
    lastCommand,
    settings,
    availableVoices,
    
    // Voice Recognition
    startListening,
    stopListening,
    processCommand,
    
    // Speech Synthesis
    speak,
    stopSpeaking,
    
    // Command Management
    registerCommand,
    unregisterCommand,
    getCommands,
    
    // Settings
    updateSettings,
    
    // Navigation helpers
    announceElement,
    announceNavigation,
    announceAction,
    announceError,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}

export type { VoiceCommand, VoiceSettings, SpeechOptions };