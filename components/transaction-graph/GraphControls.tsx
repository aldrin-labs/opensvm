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
        <div className="absolute top-4 right-4 z-30 flex flex-col gap-3">
            {/* Zoom and Navigation Controls */}
            <div className="flex flex-col gap-2 p-3 bg-background/95 border border-border rounded-lg shadow-lg">
                <div className="flex gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onZoomIn}
                        className="h-8 w-8 p-0"
                        title="Zoom In"
                    >
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onZoomOut}
                        className="h-8 w-8 p-0"
                        title="Zoom Out"
                    >
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onFit}
                        className="h-8 w-8 p-0"
                        title="Fit to View"
                    >
                        <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onReset}
                        className="h-8 w-8 p-0"
                        title="Reset View"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onToggleFullscreen}
                    className="h-8 w-8 p-0"
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
            </div>

            {/* Filter Controls */}
            <div className="p-3 bg-background/95 border border-border rounded-lg shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-4 w-4" />
                    <span className="text-sm font-medium">Filters</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {filterOptions.map(({ key, label }) => (
                        <Badge
                            key={key}
                            variant={filters[key as keyof typeof filters] ? "default" : "secondary"}
                            className={`cursor-pointer transition-colors border ${filters[key as keyof typeof filters]
                                    ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                }`}
                            onClick={() => onFilterChange(key, !filters[key as keyof typeof filters])}
                        >
                            {filters[key as keyof typeof filters] ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                            {label}
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Graph Stats */}
            <div className="p-3 bg-background/95 border border-border rounded-lg shadow-lg">
                <div className="text-sm font-medium mb-2">Graph Info</div>
                <div className="text-xs text-muted-foreground space-y-1">
                    <div>Nodes: {visibleElements.nodes}</div>
                    <div>Edges: {visibleElements.edges}</div>
                </div>
            </div>
        </div>
    );
};
