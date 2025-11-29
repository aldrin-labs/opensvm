/**
 * LayoutPresetSelector
 *
 * Dropdown component for selecting trading terminal layout presets.
 * Allows users to quickly switch between different layout configurations.
 */

'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check, Layout } from 'lucide-react';
import { getAllPresets, type LayoutPreset } from '@/lib/trading/layout-presets';

interface LayoutPresetSelectorProps {
  currentPresetId: string;
  onPresetChange: (presetId: string) => void;
}

export default function LayoutPresetSelector({
  currentPresetId,
  onPresetChange,
}: LayoutPresetSelectorProps) {
  const presets = getAllPresets();
  const currentPreset = presets.find((p) => p.id === currentPresetId);

  // Group presets by target user level
  const beginnerPresets = presets.filter((p) => p.targetUser === 'beginner');
  const intermediatePresets = presets.filter((p) => p.targetUser === 'intermediate');
  const advancedPresets = presets.filter((p) => p.targetUser === 'advanced');
  const expertPresets = presets.filter((p) => p.targetUser === 'expert');

  const renderPresetItem = (preset: LayoutPreset) => {
    const isActive = preset.id === currentPresetId;

    return (
      <DropdownMenuItem
        key={preset.id}
        onClick={() => onPresetChange(preset.id)}
        className={`flex items-start gap-3 p-3 cursor-pointer ${
          isActive ? 'bg-primary/10' : ''
        }`}
      >
        <span className="text-2xl flex-shrink-0">{preset.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{preset.name}</span>
            {isActive && <Check size={14} className="text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {preset.description}
          </p>
        </div>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 h-8 px-3 bg-card border-border hover:bg-muted transition-colors"
          data-ai-control="layout-preset-selector"
        >
          <Layout size={14} className="text-primary" />
          <span className="text-xs font-medium hidden sm:inline">
            Layout: {currentPreset?.name || 'Intermediate'}
          </span>
          <span className="text-xs font-medium sm:hidden">{currentPreset?.icon || '📊'}</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-[320px] max-h-[600px] overflow-y-auto bg-card border-border"
      >
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-semibold text-primary uppercase">
          <Layout size={14} />
          Select Layout Preset
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />

        {/* Beginner Presets */}
        {beginnerPresets.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">
              Beginner
            </DropdownMenuLabel>
            {beginnerPresets.map(renderPresetItem)}
          </>
        )}

        {/* Intermediate Presets */}
        {intermediatePresets.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-border my-1" />
            <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">
              Intermediate
            </DropdownMenuLabel>
            {intermediatePresets.map(renderPresetItem)}
          </>
        )}

        {/* Advanced Presets */}
        {advancedPresets.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-border my-1" />
            <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">
              Advanced
            </DropdownMenuLabel>
            {advancedPresets.map(renderPresetItem)}
          </>
        )}

        {/* Expert Presets */}
        {expertPresets.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-border my-1" />
            <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">
              Expert
            </DropdownMenuLabel>
            {expertPresets.map(renderPresetItem)}
          </>
        )}

        <DropdownMenuSeparator className="bg-border my-1" />
        <div className="px-3 py-2 text-xs text-muted-foreground">
          💡 Tip: Your layout preference is saved automatically
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
