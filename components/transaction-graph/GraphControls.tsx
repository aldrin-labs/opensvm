import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

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
    selectedTxType?: string;
    onTxTypeChange?: (txType: string) => void;
    selectedMints?: string[];
    onMintsChange?: (mints: string[]) => void;
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
    visibleElements,
    selectedTxType = '',
    onTxTypeChange,
    selectedMints = [],
    onMintsChange
}) => {
    const [mintInput, setMintInput] = useState('');

    const filterOptions = [
        { key: 'solTransfers', label: 'SOL' },
        { key: 'splTransfers', label: 'SPL' },
        { key: 'defi', label: 'DeFi' },
        { key: 'nft', label: 'NFT' },
        { key: 'programCalls', label: 'Program' },
        { key: 'system', label: 'System' },
        { key: 'funding', label: 'Funding' }
    ];

    const txTypeOptions = [
        { value: '', label: 'All Types' },
        { value: 'spl', label: 'SPL Transfer' },
        { value: 'sol', label: 'SOL Transfer' },
        { value: 'swap', label: 'Swap' },
        { value: 'defi', label: 'DeFi' },
        { value: 'nft', label: 'NFT' }
    ];

    const handleAddMint = () => {
        if (mintInput.trim() && onMintsChange) {
            const mints = mintInput.split(',').map(m => m.trim()).filter(m => m.length > 0);
            const uniqueMints = [...new Set([...selectedMints, ...mints])];
            onMintsChange(uniqueMints);
            setMintInput('');
        }
    };

    const handleRemoveMint = (mint: string) => {
        if (onMintsChange) {
            onMintsChange(selectedMints.filter(m => m !== mint));
        }
    };

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
                    type="button"
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
                    type="button"
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
                    type="button"
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
                    type="button"
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
                            type="button"
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent sideOffset={6} className="min-w-[16rem] max-h-[400px] overflow-y-auto">
                        {onTxTypeChange && (
                            <>
                                <DropdownMenuLabel className="text-xs">Transaction Type Filter</DropdownMenuLabel>
                                <div className="px-2 py-1.5">
                                    <Select value={selectedTxType} onValueChange={onTxTypeChange}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="All Types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {txTypeOptions.map(({ value, label }) => (
                                                <SelectItem key={value} value={value} className="text-xs">
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        
                        {onMintsChange && (
                            <>
                                <DropdownMenuLabel className="text-xs">Token Mint Filter</DropdownMenuLabel>
                                <div className="px-2 py-1.5 space-y-1.5">
                                    <div className="flex gap-1">
                                        <Input
                                            type="text"
                                            placeholder="Mint address(es)"
                                            value={mintInput}
                                            onChange={(e) => setMintInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddMint()}
                                            className="h-8 text-xs flex-1"
                                        />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleAddMint}
                                            className="h-8 px-2 text-xs"
                                            type="button"
                                        >
                                            Add
                                        </Button>
                                    </div>
                                    {selectedMints.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {selectedMints.map((mint) => (
                                                <Badge
                                                    key={mint}
                                                    variant="secondary"
                                                    className="text-[10px] px-1.5 py-0.5 cursor-pointer"
                                                    onClick={() => handleRemoveMint(mint)}
                                                >
                                                    {mint.slice(0, 4)}...{mint.slice(-4)}
                                                    <span className="ml-1">×</span>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        
                        <DropdownMenuLabel className="text-xs">View Filters</DropdownMenuLabel>
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
                    type="button"
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
