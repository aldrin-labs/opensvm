import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Home, MapPin } from 'lucide-react';
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
    // Truncate history if it exceeds max size
    const displayHistory = history.slice(-maxHistorySize);
    const displayIndex = Math.max(0, currentIndex - (history.length - displayHistory.length));

    const formatLabel = (item: NavigationItem) => {
        if (item.type === 'account') {
            return `${item.label.substring(0, 8)}...`;
        } else {
            return `${item.label.substring(0, 8)}...`;
        }
    };

    const getItemIcon = (item: NavigationItem) => {
        if (item.type === 'account') {
            return <MapPin className="h-3 w-3 text-primary" />;
        } else {
            return <span className="w-3 h-3 rounded-full bg-primary" />;
        }
    };

    const getItemColor = (item: NavigationItem, index: number) => {
        if (index === displayIndex) {
            return 'bg-primary text-primary-foreground';
        } else if (index < displayIndex) {
            return 'bg-muted text-muted-foreground';
        } else {
            return 'bg-background text-foreground border border-border';
        }
    };

    return (
        <div className="absolute top-4 left-4 z-30 flex flex-col gap-3">
            {/* Navigation Controls */}
            <div className="flex items-center gap-2 p-3 bg-background/95 border border-border rounded-lg shadow-lg">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onGoHome}
                    className="h-8 px-2"
                    title="Go to initial account"
                >
                    <Home className="h-4 w-4" />
                </Button>

                <div className="flex gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onGoBack}
                        disabled={!canGoBack}
                        className="h-8 w-8 p-0"
                        title="Go back"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onGoForward}
                        disabled={!canGoForward}
                        className="h-8 w-8 p-0"
                        title="Go forward"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Breadcrumb Navigation */}
            {displayHistory.length > 1 && (
                <div className="p-3 bg-background/95 border border-border rounded-lg shadow-lg max-w-md">
                    <div className="text-sm font-medium mb-2">Navigation History</div>
                    <div className="flex flex-wrap gap-1">
                        {displayHistory.map((item, index) => (
                            <Badge
                                key={`${item.id}-${item.timestamp}`}
                                variant="secondary"
                                className={`cursor-pointer transition-all duration-200 hover:scale-105 ${getItemColor(item, index)}`}
                                onClick={() => onNavigate(history.length - displayHistory.length + index)}
                            >
                                <div className="flex items-center gap-1">
                                    {getItemIcon(item)}
                                    {formatLabel(item)}
                                </div>
                            </Badge>
                        ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                        {displayHistory.length} of {history.length} items
                    </div>
                </div>
            )}

            {/* Current Position Indicator */}
            <div className="p-3 bg-background/95 border border-border rounded-lg shadow-lg">
                <div className="text-sm font-medium mb-2">Current Position</div>
                <div className="text-xs text-muted-foreground space-y-1">
                    <div>History: {currentIndex + 1} of {history.length}</div>
                    {history[currentIndex] && (
                        <div className="flex items-center gap-2">
                            {getItemIcon(history[currentIndex])}
                            <span className="font-medium">
                                {history[currentIndex].type === 'account' ? 'Account' : 'Transaction'}
                            </span>
                            <span className="text-xs">
                                {formatLabel(history[currentIndex])}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
