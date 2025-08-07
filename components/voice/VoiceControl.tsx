'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { useVoice } from '@/lib/voice';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Settings, 
  Loader2,
  AlertCircle
} from 'lucide-react';

interface VoiceControlProps {
  variant?: 'floating' | 'inline' | 'compact';
  showStatus?: boolean;
  showSettings?: boolean;
  className?: string;
}

export function VoiceControl({ 
  variant = 'inline',
  showStatus = true,
  showSettings = false,
  className = ''
}: VoiceControlProps) {
  const {
    isSupported,
    isListening,
    settings,
    lastCommand,
    startListening,
    stopListening,
    announceAction
  } = useVoice();

  const [showLastCommand, setShowLastCommand] = useState(false);

  // Show last command briefly when it changes
  useEffect(() => {
    if (lastCommand) {
      setShowLastCommand(true);
      const timer = setTimeout(() => {
        setShowLastCommand(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [lastCommand]);

  if (!isSupported) {
    if (variant === 'compact') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" disabled className={className}>
                <AlertCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Voice features not supported in this browser</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Voice features not available</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleToggleListening = () => {
    if (isListening) {
      stopListening();
      announceAction('Voice recognition stopped');
    } else {
      startListening();
      announceAction('Voice recognition started');
    }
  };

  // Compact variant for toolbars
  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <div className={`flex items-center space-x-2 ${className}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isListening ? 'destructive' : 'ghost'}
                size="sm"
                onClick={handleToggleListening}
                disabled={!settings.enabled}
                className={isListening ? 'animate-pulse' : ''}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {!settings.enabled 
                  ? 'Voice recognition disabled'
                  : isListening 
                    ? 'Stop listening'
                    : 'Start listening'
                }
              </p>
            </TooltipContent>
          </Tooltip>
          
          {showStatus && (
            <Badge 
              variant={settings.enabled ? (isListening ? 'destructive' : 'default') : 'secondary'}
              className="text-xs"
            >
              {!settings.enabled ? 'Off' : isListening ? 'Listening' : 'Ready'}
            </Badge>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // Floating variant for overlay
  if (variant === 'floating') {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Card className="shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Button
                variant={isListening ? 'destructive' : 'default'}
                size="lg"
                onClick={handleToggleListening}
                disabled={!settings.enabled}
                className={`relative ${isListening ? 'animate-pulse' : ''}`}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-5 w-5 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    {settings.enabled ? 'Listen' : 'Disabled'}
                  </>
                )}
                
                {isListening && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                )}
              </Button>

              {showSettings && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Voice settings</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {showStatus && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge 
                    variant={settings.enabled ? (isListening ? 'destructive' : 'default') : 'secondary'}
                    className="text-xs"
                  >
                    {!settings.enabled ? 'Disabled' : isListening ? 'Listening' : 'Ready'}
                  </Badge>
                </div>
                
                {settings.audioFeedback && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Audio:</span>
                    <div className="flex items-center space-x-1">
                      <Volume2 className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">On</span>
                    </div>
                  </div>
                )}

                {showLastCommand && lastCommand && (
                  <div className="text-xs text-muted-foreground bg-accent/50 rounded p-2 mt-2">
                    <div className="font-medium">Last command:</div>
                    <div className="truncate">"{lastCommand}"</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default inline variant
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              variant={isListening ? 'destructive' : 'default'}
              size="sm"
              onClick={handleToggleListening}
              disabled={!settings.enabled}
              className={isListening ? 'animate-pulse' : ''}
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  {settings.enabled ? 'Start Listening' : 'Voice Disabled'}
                </>
              )}
            </Button>

            {showStatus && (
              <div className="flex items-center space-x-2">
                <Badge 
                  variant={settings.enabled ? (isListening ? 'destructive' : 'default') : 'secondary'}
                >
                  {!settings.enabled ? 'Disabled' : isListening ? 'Listening' : 'Ready'}
                </Badge>
                
                {settings.audioFeedback ? (
                  <Volume2 className="h-4 w-4 text-green-500" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )}
          </div>

          {showSettings && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configure voice settings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {showLastCommand && lastCommand && (
          <div className="mt-3 p-2 bg-accent/50 rounded text-sm">
            <div className="font-medium text-muted-foreground">Last command:</div>
            <div className="mt-1">"{lastCommand}"</div>
          </div>
        )}

        {!settings.enabled && (
          <div className="mt-3 text-xs text-muted-foreground">
            Enable voice features in settings to use voice commands.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Voice status indicator for minimal UI presence
export function VoiceStatusIndicator({ className = '' }: { className?: string }) {
  const { isSupported, isListening, settings } = useVoice();

  if (!isSupported || !settings.enabled) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {isListening ? (
        <>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          <Mic className="h-3 w-3 text-red-500" />
        </>
      ) : (
        <Mic className="h-3 w-3 text-muted-foreground" />
      )}
    </div>
  );
}

// Quick access button for global voice toggle
export function VoiceToggleButton({ className = '' }: { className?: string }) {
  const {
    isSupported,
    isListening,
    settings,
    startListening,
    stopListening
  } = useVoice();

  if (!isSupported || !settings.enabled) {
    return null;
  }

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isListening ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleToggle}
            className={`${className} ${isListening ? 'animate-pulse' : ''}`}
            aria-label={isListening ? 'Stop voice recognition' : 'Start voice recognition'}
          >
            {isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isListening ? 'Stop listening' : 'Start listening'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default VoiceControl;