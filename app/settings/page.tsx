'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/design-system/theme-provider';
import { useSettings } from '@/lib/settings';
import { useAccessibility } from '@/lib/accessibility';
import { 
  Accessibility, 
  Eye, 
  EyeOff, 
  Keyboard, 
  Volume2, 
  VolumeX, 
  Monitor, 
  Palette, 
  Type,
  Settings,
  RefreshCw
} from 'lucide-react';

export default function SettingsPage() {
  const { config, updateConfig, resetToDefaults } = useTheme();
  const { announceToScreenReader } = useAccessibility();
  const settings = useSettings();

  const handleAccessibilityChange = (key: string, value: boolean) => {
    updateConfig({ [key]: value });
    announceToScreenReader(`${key} ${value ? 'enabled' : 'disabled'}`, 'polite');
  };

  const handleFontSizeChange = (fontSize: 'sm' | 'base' | 'lg') => {
    updateConfig({ fontSize });
    announceToScreenReader(`Font size changed to ${fontSize}`, 'polite');
  };

  const handleThemeChange = (theme: any) => {
    settings.setTheme(theme);
    announceToScreenReader(`Theme changed to ${theme}`, 'polite');
  };

  const handleReset = () => {
    resetToDefaults();
    announceToScreenReader('Settings reset to defaults', 'polite');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Customize your OpenSVM experience with theme, accessibility, and display preferences.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Accessibility Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Accessibility className="w-5 h-5" />
              Accessibility
            </CardTitle>
            <CardDescription>
              Configure accessibility features to improve your experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* High Contrast */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-base font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  High Contrast Mode
                </div>
                <div className="text-sm text-muted-foreground">
                  Increases contrast for better visibility (currently disabled by default)
                </div>
              </div>
              <div className="opacity-50 pointer-events-none">
                <Switch
                  label=""
                  checked={false}
                  onChange={() => {}}
                />
              </div>
            </div>

            {/* Reduced Motion */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-base font-medium flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Reduce Motion
                </div>
                <div className="text-sm text-muted-foreground">
                  Reduces animations and transitions for users with motion sensitivity
                </div>
              </div>
              <Switch
                label=""
                checked={config.reducedMotion}
                onChange={(checked: boolean) => handleAccessibilityChange('reducedMotion', checked)}
              />
            </div>

            {/* Focus Visible */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-base font-medium flex items-center gap-2">
                  <Keyboard className="w-4 h-4" />
                  Keyboard Focus Indicators
                </div>
                <div className="text-sm text-muted-foreground">
                  Shows visible focus indicators for keyboard navigation
                </div>
              </div>
              <Switch
                label=""
                checked={config.focusVisible}
                onChange={(checked: boolean) => handleAccessibilityChange('focusVisible', checked)}
              />
            </div>

            {/* Font Size */}
            <div className="space-y-3">
              <Label className="text-base font-medium flex items-center gap-2">
                <Type className="w-4 h-4" />
                Font Size
              </Label>
              <div className="text-sm text-muted-foreground mb-2">
                Adjust the base font size throughout the application
              </div>
              <Select value={config.fontSize} onValueChange={handleFontSizeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select font size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="base">Medium (Default)</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Theme & Appearance
            </CardTitle>
            <CardDescription>
              Customize the visual appearance of the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Color Mode */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Color Mode</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Choose between light, dark, or system preference
              </div>
              <Select 
                value={config.mode} 
                onValueChange={(mode: 'light' | 'dark' | 'system') => updateConfig({ mode })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select color mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Theme Variant */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Theme Style</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Choose a visual theme for the application
              </div>
              <Select value={settings.theme} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paper">Paper</SelectItem>
                  <SelectItem value="cyberpunk">Cyberpunk</SelectItem>
                  <SelectItem value="solarized">Solarized</SelectItem>
                  <SelectItem value="dos">DOS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Font Family */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Font Family</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Choose the font used throughout the application
              </div>
              <Select value={settings.fontFamily} onValueChange={settings.setFontFamily}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select font family" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="berkeley">Berkeley Mono</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="jetbrains">JetBrains Mono</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Font Size for Theme Settings */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Text Size</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Adjust the overall text size in the application
              </div>
              <Select value={settings.fontSize} onValueChange={settings.setFontSize}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select text size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Reset Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Reset Settings
            </CardTitle>
            <CardDescription>
              Reset all settings to their default values
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
