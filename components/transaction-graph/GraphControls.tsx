import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Filter,
    Eye,
    EyeOff,
    Maximize2,
    Minimize2
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

export interface GraphControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    onFit: () => void;
    onToggleFullscreen: () => void;
    isFullscreen: boolean;
    filters: {
        solTransfers: boolean;
        splTransfers: boolean;
        defi: boolean;
        nft: boolean;
        programCalls: boolean;
        system: boolean;
        funding: boolean;
    };
    onFilterChange: (filter: string, value: boolean) => void;
    visibleElements: {
        nodes: number;
        edges: number;
    };
}

export const GraphControls: React.FC<GraphControlsProps> = ({
    onZoomIn,
    onZoomOut,
    onReset,
    onFit,
    onToggleFullscreen,
    isFullscreen,
    filters,
    onFilterChange,
    visibleElements
}) => {
    const filterOptions = [
        { key: 'solTransfers', label: 'SOL' },
        { key: 'splTransfers', label: 'SPL' },
        { key: 'defi', label: 'DeFi' },
        { key: 'nft', label: 'NFT' },
        { key: 'programCalls', label: 'Program' },
        { key: 'system', label: 'System' },
        { key: 'funding', label: 'Funding' }
    ];

    return (
        <div className="absolute top-2 right-2 z-30">
            <div
                role="toolbar"
                aria-label="Graph controls"
                className="flex items-center gap-1 rounded-md border border-border bg-background/90 backdrop-blur px-2 h-8 shadow"
            >
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={onZoomIn}
                    className="h-7 w-7"
                    title="Zoom In"
                    aria-label="Zoom in"
                >
                    <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={onZoomOut}
                    className="h-7 w-7"
                    title="Zoom Out"
                    aria-label="Zoom out"
                >
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={onFit}
                    className="h-7 w-7"
                    title="Fit to view"
                    aria-label="Fit to view"
                >
                    <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={onReset}
                    className="h-7 w-7"
                    title="Reset view"
                    aria-label="Reset view"
                >
                    <RotateCcw className="h-4 w-4" />
                </Button>

                <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Filters"
                            aria-label="Filters"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={6} className="min-w-[12rem]">
                        <DropdownMenuLabel className="text-xs">Transaction types</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {filterOptions.map(({ key, label }) => {
                            const enabled = filters[key as keyof typeof filters];
                            return (
                                <DropdownMenuItem
                                    key={key}
                                    preventClose
                                    className="flex items-center gap-2 cursor-pointer"
                                    onClick={() => onFilterChange(key, !enabled)}
                                >
                                    {enabled ? <Eye className="h-3 w-3 text-primary" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
                                    <span className="text-sm">{label}</span>
                                    {enabled && (
                                        <Badge className="ml-auto h-5 px-1 text-[10px]" variant="secondary">on</Badge>
                                    )}
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

                <Button
                    size="icon"
                    variant="ghost"
                    onClick={onToggleFullscreen}
                    className="h-7 w-7"
                    title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>

                <span className="ml-2 text-[11px] text-muted-foreground whitespace-nowrap">
                    N: {visibleElements.nodes} · E: {visibleElements.edges}
                </span>
            </div>
        </div>
    );
};
