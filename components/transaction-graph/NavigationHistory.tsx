import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Home, MapPin, History as HistoryIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import type { NavigationItem } from './types';

export interface NavigationHistoryProps {
    history: NavigationItem[];
    currentIndex: number;
    onNavigate: (index: number) => void;
    onGoBack: () => void;
    onGoForward: () => void;
    onGoHome: () => void;
    canGoBack: boolean;
    canGoForward: boolean;
    maxHistorySize?: number;
}

export const NavigationHistory: React.FC<NavigationHistoryProps> = ({
    history,
    currentIndex,
    onNavigate,
    onGoBack,
    onGoForward,
    onGoHome,
    canGoBack,
    canGoForward,
    maxHistorySize = 20
}) => {
    const displayHistory = history.slice(-maxHistorySize);
    // Note: keep local index logic inline where needed to avoid unused variable
    // derive locally when needed to avoid unused variable warnings

    const formatLabel = (item: NavigationItem) => {
        return `${item.label.substring(0, 8)}...`;
    };

    const getItemIcon = (item: NavigationItem) => {
        if (item.type === 'account') {
            return <MapPin className="h-3 w-3 text-primary" />;
        }
        return <span className="w-3 h-3 rounded-full bg-primary" />;
    };

    return (
        <div className="absolute top-2 left-2 z-30">
            <div
                role="toolbar"
                aria-label="Navigation history"
                className="flex items-center gap-1 rounded-md border border-border bg-background/90 backdrop-blur px-2 h-8 shadow"
            >
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={onGoHome}
                    className="h-7 w-7"
                    title="Go to initial account"
                    aria-label="Go to initial account"
                    type="button"
                >
                    <Home className="h-4 w-4" />
                </Button>

                <Button
                    size="icon"
                    variant="ghost"
                    onClick={onGoBack}
                    disabled={!canGoBack}
                    className="h-7 w-7"
                    title="Back"
                    aria-label="Back"
                    type="button"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={onGoForward}
                    disabled={!canGoForward}
                    className="h-7 w-7"
                    title="Forward"
                    aria-label="Forward"
                    type="button"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>

                <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="History"
                            aria-label="History"
                            type="button"
                        >
                            <HistoryIcon className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={6} className="min-w-[14rem] max-h-[50vh] overflow-auto">
                        <DropdownMenuLabel className="text-xs">Recent navigation</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {displayHistory.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">No history yet</div>
                        )}
                        {displayHistory.map((item, index) => {
                            const absoluteIndex = history.length - displayHistory.length + index;
                            const isActive = absoluteIndex === currentIndex;
                            return (
                                <DropdownMenuItem
                                    key={`${item.id}-${item.timestamp}`}
                                    className={`flex items-center gap-2 ${isActive ? 'bg-primary/10' : ''}`}
                                    onClick={() => onNavigate(absoluteIndex)}
                                >
                                    {getItemIcon(item)}
                                    <span className="text-sm">{formatLabel(item)}</span>
                                    {isActive && <Badge className="ml-auto h-5 px-1 text-[10px]" variant="secondary">current</Badge>}
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>

                <span className="ml-2 text-[11px] text-muted-foreground whitespace-nowrap">
                    {currentIndex + 1} / {history.length}
                </span>
            </div>
        </div>
    );
};
