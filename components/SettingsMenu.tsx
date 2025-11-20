'use client';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/lib/settings';
import { useTheme } from '../lib/design-system/theme-provider';
import { updateClientRpcEndpoint } from '@/lib/solana/solana-connection';
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
  { id: 'default', name: 'Default' },
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
  const { config, updateConfig } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [alwaysOpen, setAlwaysOpen] = useState(false);
  const [alwaysRender, setAlwaysRender] = useState(false);
  const [showCustomRpc, setShowCustomRpc] = useState(false);

  const [tempSettings, setTempSettings] = useState({
    theme: config?.variant || 'cyberpunk',
    fontFamily: settings?.fontFamily || 'berkeley',
    fontSize: settings?.fontSize || 'medium',
    rpcEndpoint: settings?.rpcEndpoint || { name: 'osvm rpc', url: 'opensvm', network: 'mainnet' },
    customRpcEndpoint: settings?.customRpcEndpoint || '',
  });

  // Update tempSettings only when settings menu is opened, not on every config change
  useEffect(() => {
    if (settings && config && isOpen) {
      setTempSettings({
        theme: config.variant,
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        rpcEndpoint: settings.rpcEndpoint,
        customRpcEndpoint: settings.customRpcEndpoint,
      });
    }
  }, [isOpen]); // Only reset when menu opens, not on config changes

  // E2E aid: allow tests to programmatically open the menu without relying on UI events
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).__E2E_OPEN_SETTINGS__ === true) {
        // Defer to ensure hydration completed
        setTimeout(() => setIsOpen(true), 0);
      }
      if (typeof window !== 'undefined') {
        if ((window as any).__E2E_ALWAYS_OPEN === true) setAlwaysOpen(true);
        if ((window as any).__E2E_ALWAYS_RENDER_SETTINGS === true) setAlwaysRender(true);
      }
    } catch {/* noop */ }
  }, []);

  // E2E events: allow programmatic open/close via custom events or globals
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const open = () => setIsOpen(true);
    const close = () => setIsOpen(false);
    window.addEventListener('e2e:open-settings', open as EventListener);
    window.addEventListener('e2e:close-settings', close as EventListener);
    // Expose globals for direct invocation
    (window as any).__openSettingsMenu = open;
    (window as any).__closeSettingsMenu = close;
    (window as any).__isSettingsMounted = true;
    return () => {
      window.removeEventListener('e2e:open-settings', open as EventListener);
      window.removeEventListener('e2e:close-settings', close as EventListener);
      try {
        delete (window as any).__openSettingsMenu;
        delete (window as any).__closeSettingsMenu;
        delete (window as any).__isSettingsMounted;
      } catch {/* noop */ }
    };
  }, []);

  // E2E state exposure: reflect current open state for tests to poll
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__isSettingsOpen = isOpen;
    }
  }, [isOpen]);

  const handleApply = () => {
    console.log('SettingsMenu: Applying settings:', tempSettings);
    // Helper to set persistent cluster cookie
    const setClusterCookie = (value: string) => {
      try {
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const attrs = `; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure ? '; Secure' : ''}`;
        document.cookie = `cluster=${encodeURIComponent(value)}${attrs}`;
      } catch (e) {
        console.warn('Failed to set cluster cookie', e);
      }
    };

    // Apply theme changes using the theme provider (primary method)
    console.log('SettingsMenu: Updating theme to:', tempSettings.theme);
    updateConfig({ variant: tempSettings.theme as any });
    
    // Also sync with settings store for compatibility
    try { 
      settings.setTheme(tempSettings.theme as any); 
    } catch (e) {
      console.warn('Failed to sync theme with settings store:', e);
    }

    // Apply other settings
    settings.setFontFamily(tempSettings.fontFamily);
    settings.setFontSize(tempSettings.fontSize);
    settings.setRpcEndpoint(tempSettings.rpcEndpoint);

    // Handle custom RPC endpoint
    if (showCustomRpc && tempSettings.customRpcEndpoint) {
      settings.addCustomRpcEndpoint('Custom', tempSettings.customRpcEndpoint);
      // Persist custom URL to cookie so server proxy honors it
      setClusterCookie(tempSettings.customRpcEndpoint);
    } else {
      // Persist selection to cookie: 'opensvm' stays pooled; URLs force specific RPC
      const selected = tempSettings.rpcEndpoint?.url === 'opensvm'
        ? 'opensvm'
        : tempSettings.rpcEndpoint?.url;
      if (selected) setClusterCookie(selected);
    }
    
    // Keep client on proxy endpoint for safety
    updateClientRpcEndpoint('opensvm');
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempSettings({
      theme: config.variant,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      rpcEndpoint: settings.rpcEndpoint,
      customRpcEndpoint: settings.customRpcEndpoint,
    });
    setShowCustomRpc(false);
    setIsOpen(false);
  };

  // E2E fallback: render a simplified always-visible panel with same selectors
  if (alwaysRender) {
    const [showThemeList, _setShowThemeList] = [true, true]; // always visible for simplicity
    return (
      <div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md"
          aria-label="Settings"
          data-test="settings-menu-trigger"
        >
          {icons.settings}
        </Button>
        <div
          className="w-[280px] max-w-[90vw] max-h-[90vh] overflow-auto border rounded-md p-2 bg-background shadow-md fixed left-4 top-16 z-[1000]"
          data-test="settings-menu"
          data-testid="settings-menu"
          id="settings-menu-content"
          aria-label="Settings menu"
          data-e2e-is-open="true"
        >
          <div className="px-2 py-1.5 text-sm font-semibold">Settings</div>
          <div className="-mx-1 my-1 h-px bg-border" />
          <div
            data-test="settings-theme-submenu"
            role="button"
            tabIndex={0}
            className="px-2 py-1.5 text-sm cursor-pointer"
          >
            Theme: {themes.find(t => t.id === tempSettings.theme)?.name}
          </div>
          {showThemeList && (
            <div className="pl-2">
              {themes.map(theme => (
                <div
                  key={theme.id}
                  className="px-2 py-1.5 text-sm cursor-pointer hover:bg-secondary rounded-sm"
                  onClick={() => setTempSettings(s => ({ ...s, theme: theme.id as any }))}
                >
                  {theme.name}
                </div>
              ))}
            </div>
          )}

          <div className="-mx-1 my-1 h-px bg-border" />
          <div
            data-test="settings-font-submenu"
            role="button"
            tabIndex={0}
            className="px-2 py-1.5 text-sm cursor-pointer"
          >
            Font: {fonts.find(f => f.id === tempSettings.fontFamily)?.name}
          </div>
          <div className="pl-2">
            {fonts.map(font => (
              <div
                key={font.id}
                className="px-2 py-1.5 text-sm cursor-pointer hover:bg-secondary rounded-sm"
                onClick={() => setTempSettings(s => ({ ...s, fontFamily: font.id }))}
              >
                {font.name}
              </div>
            ))}
          </div>

          <div className="-mx-1 my-1 h-px bg-border" />
          <div
            data-test="settings-size-submenu"
            role="button"
            tabIndex={0}
            className="px-2 py-1.5 text-sm cursor-pointer"
          >
            Size: {fontSizes.find(s => s.id === tempSettings.fontSize)?.name}
          </div>
          <div className="pl-2">
            {fontSizes.map(size => (
              <div
                key={size.id}
                className="px-2 py-1.5 text-sm cursor-pointer hover:bg-secondary rounded-sm"
                onClick={() => setTempSettings(s => ({ ...s, fontSize: size.id }))}
              >
                {size.name}
              </div>
            ))}
          </div>

          <div className="-mx-1 my-1 h-px bg-border" />
          <div
            data-test="settings-rpc-submenu"
            role="button"
            tabIndex={0}
            className="px-2 py-1.5 text-sm cursor-pointer"
          >
            {tempSettings.rpcEndpoint.url === 'opensvm' ? (
              <div className="flex flex-col items-start bg-[#8B5CF6]/10 -mx-2 px-2 py-1">
                <div className="font-medium">RPC: {tempSettings.rpcEndpoint.name}</div>
                <div className="text-sm text-[#8B5CF6]">15 endpoints (Round-Robin)</div>
              </div>
            ) : (
              <div className="flex flex-col items-start">
                <div>RPC: {tempSettings.rpcEndpoint.name}</div>
                {tempSettings.rpcEndpoint.url !== 'opensvm' && (
                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {tempSettings.rpcEndpoint.url}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="pl-2">
            {settings.availableRpcEndpoints.map((endpoint) => (
              <div
                key={endpoint.url}
                className="px-2 py-1.5 text-sm cursor-pointer hover:bg-secondary rounded-sm"
                onClick={() => {
                  setTempSettings(s => ({ ...s, rpcEndpoint: endpoint }));
                  setShowCustomRpc(false);
                }}
              >
                {endpoint.url === 'opensvm' ? (
                  <div className="flex flex-col w-full bg-[#8B5CF6]/10 -mx-2 px-2 py-1">
                    <div className="font-medium">{endpoint.name}</div>
                    <div className="text-sm text-[#8B5CF6]">15 endpoints (Round-Robin)</div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div>{endpoint.name} ({endpoint.network})</div>
                    {endpoint.url !== 'opensvm' && (
                      <div className="text-xs text-muted-foreground">{endpoint.url}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="-mx-1 my-1 h-px bg-border" />
            <div
              className="px-2 py-1.5 text-sm cursor-pointer hover:bg-secondary rounded-sm"
              onClick={() => setShowCustomRpc(true)}
            >
              Custom...
            </div>
          </div>

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
          <div className="flex justify-end gap-2 p-2 sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <Button variant="outline" size="sm" onClick={handleCancel} data-test="settings-cancel">Cancel</Button>
            <Button variant="default" size="sm" onClick={handleApply} data-test="settings-apply">Apply</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu open={alwaysOpen || isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md"
          aria-label="Settings"
          data-test="settings-menu-trigger"
        >
          {icons.settings}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[280px]"
        data-test="settings-menu"
        data-testid="settings-menu"
        id="settings-menu-content"
        aria-label="Settings menu"
        data-e2e-is-open={alwaysOpen || isOpen ? 'true' : 'false'}
      >
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Theme Selection */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-test="settings-theme-submenu">Theme: {themes.find(t => t.id === tempSettings.theme)?.name}</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {themes.map((theme) => (
                <DropdownMenuItem
                  key={theme.id}
                  preventClose
                  onClick={() => setTempSettings(s => ({ ...s, theme: theme.id as any }))}
                >
                  {theme.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Font Family Selection */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-test="settings-font-submenu">Font: {fonts.find(f => f.id === tempSettings.fontFamily)?.name}</DropdownMenuSubTrigger>
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
          <DropdownMenuSubTrigger data-test="settings-size-submenu">Size: {fontSizes.find(s => s.id === tempSettings.fontSize)?.name}</DropdownMenuSubTrigger>
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
          <DropdownMenuSubTrigger data-test="settings-rpc-submenu">
            {tempSettings.rpcEndpoint.url === 'opensvm' ? (
              <div className="flex flex-col items-start bg-[#8B5CF6]/10 -mx-2 px-2 py-1">
                <div className="font-medium">RPC: {tempSettings.rpcEndpoint.name}</div>
                <div className="text-sm text-[#8B5CF6]">15 endpoints (Round-Robin)</div>
              </div>
            ) : (
              <div className="flex flex-col items-start">
                <div>RPC: {tempSettings.rpcEndpoint.name}</div>
                {tempSettings.rpcEndpoint.url !== 'opensvm' && (
                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {tempSettings.rpcEndpoint.url}
                  </div>
                )}
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
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div>{endpoint.name} ({endpoint.network})</div>
                      {endpoint.url !== 'opensvm' && (
                        <div className="text-xs text-muted-foreground">{endpoint.url}</div>
                      )}
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

        {/* Documentation Links */}
        <DropdownMenuLabel>Documentation</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href="/docs" target="_blank" rel="noopener noreferrer">
            User Documentation
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/swagger" target="_blank" rel="noopener noreferrer">
            API Reference
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/blog" target="_blank" rel="noopener noreferrer">
            Blog
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/news" target="_blank" rel="noopener noreferrer">
            News
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/changelog" target="_blank" rel="noopener noreferrer">
            Changelog
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 p-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            data-test="settings-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleApply}
            data-test="settings-apply"
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
        aria-label="Settings"
        data-test="settings-menu-trigger"
        disabled
      >
        {icons.settings}
      </Button>
    );
  }

  return <SettingsMenuClient />;
}
