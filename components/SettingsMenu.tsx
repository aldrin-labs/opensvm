'use client';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/lib/settings';
import { updateClientRpcEndpoint } from '@/lib/solana-connection';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

const icons = {
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const themes = [
  { id: 'paper', name: 'Paper' },
  { id: 'high-contrast', name: 'High Contrast' },
  { id: 'dos-blue', name: 'DOS Blue' },
  { id: 'cyberpunk', name: 'Cyberpunk' },
  { id: 'solarized', name: 'Solarized' },
] as const;

const fonts = [
  { id: 'berkeley', name: 'Berkeley Mono' },
  { id: 'inter', name: 'Inter' },
  { id: 'jetbrains', name: 'JetBrains Mono' },
] as const;

const fontSizes = [
  { id: 'small', name: 'Small' },
  { id: 'medium', name: 'Medium' },
  { id: 'large', name: 'Large' },
] as const;

// Client-side only component that uses settings
function SettingsMenuClient() {
  const settings = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomRpc, setShowCustomRpc] = useState(false);

  const [tempSettings, setTempSettings] = useState({
    theme: settings?.theme || 'paper',
    fontFamily: settings?.fontFamily || 'berkeley',
    fontSize: settings?.fontSize || 'medium',
    rpcEndpoint: settings?.rpcEndpoint || { name: 'OpenSVM', url: 'opensvm', network: 'mainnet' },
    customRpcEndpoint: settings?.customRpcEndpoint || '',
  });

  // Update tempSettings when settings change
  useEffect(() => {
    if (settings) {
      setTempSettings({
        theme: settings.theme,
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        rpcEndpoint: settings.rpcEndpoint,
        customRpcEndpoint: settings.customRpcEndpoint,
      });
    }
  }, [settings]);

  const handleApply = () => {
    if (showCustomRpc && tempSettings.customRpcEndpoint) {
      settings.addCustomRpcEndpoint('Custom', tempSettings.customRpcEndpoint);
      updateClientRpcEndpoint(tempSettings.customRpcEndpoint);
    } else {
      settings.setTheme(tempSettings.theme);
      settings.setFontFamily(tempSettings.fontFamily);
      settings.setFontSize(tempSettings.fontSize);
      settings.setRpcEndpoint(tempSettings.rpcEndpoint);
      updateClientRpcEndpoint(tempSettings.rpcEndpoint.url);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempSettings({
      theme: settings.theme,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      rpcEndpoint: settings.rpcEndpoint,
      customRpcEndpoint: settings.customRpcEndpoint,
    });
    setShowCustomRpc(false);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md"
        >
          {icons.settings}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Theme Selection */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Theme: {themes.find(t => t.id === tempSettings.theme)?.name}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {themes.map((theme) => (
                <DropdownMenuItem
                  key={theme.id}
                  preventClose
                  onClick={() => setTempSettings(s => ({ ...s, theme: theme.id }))}
                >
                  {theme.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Font Family Selection */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Font: {fonts.find(f => f.id === tempSettings.fontFamily)?.name}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {fonts.map((font) => (
                <DropdownMenuItem
                  key={font.id}
                  preventClose
                  onClick={() => setTempSettings(s => ({ ...s, fontFamily: font.id }))}
                >
                  {font.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Font Size Selection */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Size: {fontSizes.find(s => s.id === tempSettings.fontSize)?.name}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {fontSizes.map((size) => (
                <DropdownMenuItem
                  key={size.id}
                  preventClose
                  onClick={() => setTempSettings(s => ({ ...s, fontSize: size.id }))}
                >
                  {size.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* RPC Endpoint Selection */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {tempSettings.rpcEndpoint.url === 'opensvm' ? (
              <div className="flex flex-col items-start bg-[#8B5CF6]/10 -mx-2 px-2 py-1">
                <div className="font-medium">RPC: {tempSettings.rpcEndpoint.name}</div>
                <div className="text-sm text-[#8B5CF6]">15 endpoints (Round-Robin)</div>
              </div>
            ) : (
              <div className="flex flex-col items-start">
                <div>RPC: {tempSettings.rpcEndpoint.name}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {tempSettings.rpcEndpoint.url === 'opensvm' ? 'opensvm' : tempSettings.rpcEndpoint.url}
                </div>
              </div>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {settings.availableRpcEndpoints.map((endpoint) => (
                <DropdownMenuItem
                  key={endpoint.url}
                  preventClose
                  onClick={() => {
                    setTempSettings(s => ({ ...s, rpcEndpoint: endpoint }));
                    setShowCustomRpc(false);
                  }}
                >
                  {endpoint.url === 'opensvm' ? (
                    <div className="flex flex-col w-full bg-[#8B5CF6]/10 -mx-2 px-2 py-1">
                      <div className="font-medium">{endpoint.name}</div>
                      <div className="text-sm text-[#8B5CF6]">15 endpoints (Round-Robin)</div>
                      <div className="text-xs text-muted-foreground">opensvm</div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div>{endpoint.name} ({endpoint.network})</div>
                      <div className="text-xs text-muted-foreground">{endpoint.url}</div>
                    </div>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                preventClose
                onClick={() => setShowCustomRpc(true)}
              >
                Custom...
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Custom RPC Input */}
        {showCustomRpc && (
          <div className="p-2">
            <Input
              placeholder="Enter custom RPC URL"
              value={tempSettings.customRpcEndpoint}
              onChange={(e) => setTempSettings(s => ({ ...s, customRpcEndpoint: e.target.value }))}
              className="mb-2"
            />
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 p-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SettingsMenu() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-md"
        disabled
      >
        {icons.settings}
      </Button>
    );
  }

  return <SettingsMenuClient />;
}
