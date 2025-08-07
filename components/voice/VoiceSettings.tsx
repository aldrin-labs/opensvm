'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useVoice } from '@/lib/voice';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Settings, 
  TestTube,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

export function VoiceSettings() {
  const {
    isSupported,
    isListening,
    settings,
    availableVoices,
    updateSettings,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    getCommands
  } = useVoice();

  const [testText, setTestText] = useState('Hello, this is a voice test message.');
  const [isTesting, setIsTesting] = useState(false);

  const handleTestVoice = async () => {
    if (isTesting) {
      stopSpeaking();
      setIsTesting(false);
      return;
    }

    setIsTesting(true);
    try {
      await speak(testText);
    } catch (error) {
      console.error('Voice test failed:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    updateSettings({ [key]: value });
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mic className="h-5 w-5" />
            <span>Voice & Audio Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Voice features are not supported in your browser. Please use a modern browser 
              that supports the Web Speech API (Chrome, Edge, Safari).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const commands = getCommands();
  const commandsByCategory = commands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, typeof commands>);

  return (
    <div className="space-y-6">
      {/* Main Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mic className="h-5 w-5" />
              <span>Voice & Audio Settings</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={settings.enabled ? 'default' : 'secondary'}>
                {settings.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              {isListening && (
                <Badge variant="destructive" className="animate-pulse">
                  <Mic className="h-3 w-3 mr-1" />
                  Listening
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Voice */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="voice-enabled">Enable Voice Navigation</Label>
              <p className="text-sm text-muted-foreground">
                Allow voice commands to control the application
              </p>
            </div>
            <Switch
              id="voice-enabled"
              checked={settings.enabled}
              onCheckedChange={(enabled) => handleSettingChange('enabled', enabled)}
            />
          </div>

          <Separator />

          {/* Voice Recognition Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Voice Recognition</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="language">Recognition Language</Label>
                <Select
                  value={settings.language}
                  onValueChange={(language) => handleSettingChange('language', language)}
                  disabled={!settings.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="en-GB">English (UK)</SelectItem>
                    <SelectItem value="es-ES">Spanish</SelectItem>
                    <SelectItem value="fr-FR">French</SelectItem>
                    <SelectItem value="de-DE">German</SelectItem>
                    <SelectItem value="it-IT">Italian</SelectItem>
                    <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                    <SelectItem value="ja-JP">Japanese</SelectItem>
                    <SelectItem value="ko-KR">Korean</SelectItem>
                    <SelectItem value="zh-CN">Chinese (Simplified)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activation-keyword">Activation Keyword</Label>
                <Input
                  id="activation-keyword"
                  value={settings.activationKeyword}
                  onChange={(e) => handleSettingChange('activationKeyword', e.target.value)}
                  disabled={!settings.enabled || !settings.keywordActivation}
                  placeholder="opensvm"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="continuous-listening">Continuous Listening</Label>
                  <p className="text-sm text-muted-foreground">
                    Keep listening for commands after each recognition
                  </p>
                </div>
                <Switch
                  id="continuous-listening"
                  checked={settings.continuousListening}
                  onCheckedChange={(continuousListening) => 
                    handleSettingChange('continuousListening', continuousListening)
                  }
                  disabled={!settings.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="keyword-activation">Require Activation Keyword</Label>
                  <p className="text-sm text-muted-foreground">
                    Only respond to commands that include the activation keyword
                  </p>
                </div>
                <Switch
                  id="keyword-activation"
                  checked={settings.keywordActivation}
                  onCheckedChange={(keywordActivation) => 
                    handleSettingChange('keywordActivation', keywordActivation)
                  }
                  disabled={!settings.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="confirm-actions">Confirm Destructive Actions</Label>
                  <p className="text-sm text-muted-foreground">
                    Ask for confirmation before executing destructive commands
                  </p>
                </div>
                <Switch
                  id="confirm-actions"
                  checked={settings.confirmActions}
                  onCheckedChange={(confirmActions) => 
                    handleSettingChange('confirmActions', confirmActions)
                  }
                  disabled={!settings.enabled}
                />
              </div>
            </div>

            {/* Voice Control Buttons */}
            <div className="flex space-x-2">
              <Button
                variant={isListening ? 'destructive' : 'default'}
                size="sm"
                onClick={isListening ? stopListening : startListening}
                disabled={!settings.enabled}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-4 w-4 mr-2" />
                    Stop Listening
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Start Listening
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Speech Synthesis Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Audio Feedback</h3>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="audio-feedback">Enable Audio Feedback</Label>
                <p className="text-sm text-muted-foreground">
                  Provide spoken feedback for actions and navigation
                </p>
              </div>
              <Switch
                id="audio-feedback"
                checked={settings.audioFeedback}
                onCheckedChange={(audioFeedback) => 
                  handleSettingChange('audioFeedback', audioFeedback)
                }
                disabled={!settings.enabled}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preferred-voice">Voice</Label>
                <Select
                  value={settings.preferredVoice || ''}
                  onValueChange={(preferredVoice) => 
                    handleSettingChange('preferredVoice', preferredVoice)
                  }
                  disabled={!settings.enabled || !settings.audioFeedback}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Default system voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map((voice) => (
                      <SelectItem key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Speech Rate: {settings.voiceSpeed}x</Label>
                <Slider
                  value={[settings.voiceSpeed]}
                  onValueChange={([voiceSpeed]) => handleSettingChange('voiceSpeed', voiceSpeed)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  disabled={!settings.enabled || !settings.audioFeedback}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Volume: {Math.round(settings.voiceVolume * 100)}%</Label>
                <Slider
                  value={[settings.voiceVolume]}
                  onValueChange={([voiceVolume]) => handleSettingChange('voiceVolume', voiceVolume)}
                  min={0}
                  max={1}
                  step={0.1}
                  disabled={!settings.enabled || !settings.audioFeedback}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Pitch: {settings.voicePitch}x</Label>
                <Slider
                  value={[settings.voicePitch]}
                  onValueChange={([voicePitch]) => handleSettingChange('voicePitch', voicePitch)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  disabled={!settings.enabled || !settings.audioFeedback}
                  className="w-full"
                />
              </div>
            </div>

            {/* Voice Test */}
            <div className="space-y-2">
              <Label htmlFor="test-text">Test Voice</Label>
              <div className="flex space-x-2">
                <Input
                  id="test-text"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Enter text to test voice..."
                  disabled={!settings.enabled || !settings.audioFeedback}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestVoice}
                  disabled={!settings.enabled || !settings.audioFeedback || !testText.trim()}
                >
                  {isTesting ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Test
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Commands */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="h-5 w-5" />
            <span>Available Voice Commands</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {settings.keywordActivation ? (
                  <>Say "{settings.activationKeyword}" followed by any of these commands:</>
                ) : (
                  <>You can say any of these commands:</>
                )}
              </AlertDescription>
            </Alert>

            {Object.entries(commandsByCategory).map(([category, categoryCommands]) => (
              <div key={category} className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center space-x-2">
                  <Badge variant="outline">{category}</Badge>
                  <span className="text-muted-foreground">({categoryCommands.length} commands)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {categoryCommands.map((command, index) => (
                    <div key={index} className="p-2 bg-accent/50 rounded text-sm">
                      <div className="font-medium">{command.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Examples: "{command.patterns.slice(0, 2).join('", "')}"
                        {command.patterns.length > 2 && ` +${command.patterns.length - 2} more`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>System Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Browser Support</span>
              <Badge variant={isSupported ? 'default' : 'destructive'}>
                {isSupported ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Supported
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Not Supported
                  </>
                )}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Voice Recognition</span>
              <Badge variant={settings.enabled && isSupported ? 'default' : 'secondary'}>
                {settings.enabled && isSupported ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Audio Feedback</span>
              <Badge variant={settings.audioFeedback && settings.enabled ? 'default' : 'secondary'}>
                {settings.audioFeedback && settings.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Available Voices</span>
              <Badge variant="outline">
                {availableVoices.length} voices
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Registered Commands</span>
              <Badge variant="outline">
                {commands.length} commands
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default VoiceSettings;