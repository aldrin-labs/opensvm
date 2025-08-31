import React, { useState } from 'react';
import { X, Plus, Pin } from 'lucide-react';
import type { ChatTab } from '../hooks/useChatTabs';

interface TabBarProps {
    tabs: ChatTab[];
    activeTabId: string | null;
    onTabClick: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onNewTab: () => void;
    onTabRename?: (tabId: string, name: string) => void;
    onTabTogglePin?: (tabId: string) => void;
    className?: string;
    // Knowledge view integration
    knowledgeActive?: boolean;
    onSelectKnowledge?: () => void;
}

interface TabItemProps {
    tab: ChatTab;
    isActive: boolean;
    onTabClick: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onTabRename?: (tabId: string, name: string) => void;
    onTabTogglePin?: (tabId: string) => void;
}

function TabItem({ tab, isActive, onTabClick, onTabClose, onTabRename, onTabTogglePin }: TabItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(tab.name);

    const handleDoubleClick = () => {
        if (onTabRename) {
            setIsEditing(true);
            setEditName(tab.name);
        }
    };

    const handleEditSubmit = () => {
        if (onTabRename && editName.trim()) {
            onTabRename(tab.id, editName.trim());
        }
        setIsEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleEditSubmit();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setEditName(tab.name);
        }
    };

    const getStatusIndicator = () => {
        if (tab.isProcessing) {
            return <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" data-ai-tab-status="processing" />;
        }
        if (tab.status) {
            return <div className="w-2 h-2 bg-green-400 rounded-full" data-ai-tab-status="ready" />;
        }
        return null;
    };

    return (
        <div
            className={`
        group flex items-center gap-2 min-w-0 max-w-[200px] relative
        ${isActive
                    ? 'bg-white text-black'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }
        border-r border-white/20 transition-colors
      `}
            data-ai-tab-header
            data-active={isActive ? 'true' : 'false'}
            data-ai-tab-id={tab.id}
            data-testid="ai-tab-header"
        >
            {/* Main tab content - clickable area */}
            <div
                className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0 cursor-pointer"
                onClick={() => onTabClick(tab.id)}
                onDoubleClick={handleDoubleClick}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onTabClick(tab.id);
                    }
                }}
            >
                {/* Status indicator */}
                <div className="flex-shrink-0">
                    {getStatusIndicator()}
                </div>

                {/* Tab name */}
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleEditSubmit}
                            onKeyDown={handleEditKeyDown}
                            className="w-full bg-transparent border-none outline-none text-sm font-medium"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            data-ai-tab-rename
                            aria-label={`Rename tab ${tab.name}`}
                        />
                    ) : (
                        <span className="text-sm font-medium truncate block" data-ai-tab-name>
                            {tab.name}
                        </span>
                    )}
                </div>

                {/* Mode indicator */}
                <div className={`text-xs opacity-60 ${isActive ? 'text-black/60' : 'text-white/60'}`} data-ai-tab-mode={tab.mode}>
                    {tab.mode === 'agent' ? 'A' : 'AI'}
                </div>

                {/* Status text */}
                {tab.status && (
                    <div className={`text-xs opacity-60 max-w-[80px] truncate ${isActive ? 'text-black/60' : 'text-white/60'}`} data-ai-tab-status-text>
                        {tab.status}
                    </div>
                )}
            </div>

            {/* Action buttons - separate from clickable area */}
            <div className="flex items-center">
                {/* Pin / Unpin button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onTabTogglePin?.(tab.id);
                    }}
                    className={`
              flex-shrink-0 p-1 rounded-sm transition-opacity
              ${tab.pinned ? '' : 'opacity-0 group-hover:opacity-100'}
              ${isActive
                            ? 'hover:bg-black/10 text-black/60 hover:text-black'
                            : 'hover:bg-white/20 text-white/60 hover:text-white'
                        }
            `}
                    aria-label={`${tab.pinned ? 'Unpin' : 'Pin'} ${tab.name}`}
                    aria-pressed={tab.pinned}
                    title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                    data-ai-tab-pin
                >
                    <Pin size={12} className={tab.pinned ? 'fill-current' : ''} />
                </button>

                {/* Close button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onTabClose(tab.id);
                    }}
                    className={`
              flex-shrink-0 p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity mr-2
              ${isActive
                            ? 'hover:bg-black/10 text-black/60 hover:text-black'
                            : 'hover:bg-white/20 text-white/60 hover:text-white'
                        }
            `}
                    aria-label={`Close ${tab.name}`}
                    data-ai-tab-close
                >
                    <X size={12} />
                </button>
            </div>
        </div>
    );
}

export function TabBar({
    tabs,
    activeTabId,
    onTabClick,
    onTabClose,
    onNewTab,
    onTabRename,
    onTabTogglePin,
    className = '',
    knowledgeActive = false,
    onSelectKnowledge
}: TabBarProps) {
    return (
        <div className={`flex items-center bg-black border-b border-white/20 ${className}`} data-ai-tabs>
            {/* Tabs container with horizontal scroll */}
            <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
                {/* Tab area with separate tablist and action buttons */}
                <div className="flex items-center min-w-max relative">
                    {/* Tablist with only tab elements - no buttons allowed */}
                    <div
                        role="tablist"
                        aria-label="AI chat tabs"
                        className="flex items-center"
                    >
                        {tabs.map((tab) => (
                            <div
                                key={tab.id}
                                className={`
                                    flex items-center gap-2 px-3 py-2 min-w-0 max-w-[150px] cursor-pointer transition-colors
                                    ${tab.id === activeTabId
                                        ? 'bg-white text-black'
                                        : 'text-white/80 hover:text-white hover:bg-white/10'
                                    }
                                    border-r border-white/20
                                `}
                                onClick={() => onTabClick(tab.id)}
                                role="tab"
                                aria-selected={tab.id === activeTabId}
                                data-ai-tab-header
                                data-active={tab.id === activeTabId ? 'true' : 'false'}
                                data-ai-tab-id={tab.id}
                                data-testid="ai-tab-header"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onTabClick(tab.id);
                                    }
                                }}
                            >
                                {/* Status indicator */}
                                <div className="flex-shrink-0">
                                    {tab.isProcessing && (
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" data-ai-tab-status="processing" />
                                    )}
                                    {tab.status && !tab.isProcessing && (
                                        <div className="w-2 h-2 bg-green-400 rounded-full" data-ai-tab-status="ready" />
                                    )}
                                </div>

                                {/* Tab name */}
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium truncate block" data-ai-tab-name>
                                        {tab.name}
                                    </span>
                                </div>

                                {/* Mode indicator */}
                                <div className={`text-xs opacity-60 ${tab.id === activeTabId ? 'text-black/60' : 'text-white/60'}`} data-ai-tab-mode={tab.mode}>
                                    {tab.mode === 'agent' ? 'A' : 'AI'}
                                </div>
                            </div>
                        ))}

                        {/* Knowledge tab */}
                        <div
                            className={`
                                flex-shrink-0 px-3 py-2 text-sm font-medium border-l border-white/20 cursor-pointer
                                ${knowledgeActive ? 'bg-white text-black' : 'text-white/80 hover:text-white hover:bg-white/10'}
                            `}
                            onClick={() => onSelectKnowledge?.()}
                            role="tab"
                            aria-selected={knowledgeActive}
                            aria-label="Knowledge notes"
                            data-ai-tab="knowledge"
                            data-testid="knowledge-tab"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onSelectKnowledge?.();
                                }
                            }}
                        >
                            Knowledge
                        </div>
                    </div>

                    {/* Action buttons overlay - positioned absolutely to avoid being in tablist */}
                    {tabs.map((tab) => (
                        <div
                            key={`actions-${tab.id}`}
                            className="absolute top-0 right-0 h-full flex items-center pointer-events-none"
                            style={{
                                right: `${tabs.findIndex(t => t.id === tab.id) * 150}px`, // Approximate tab width
                            }}
                        >
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                                {/* Pin button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabTogglePin?.(tab.id);
                                    }}
                                    className={`
                                        p-1 rounded-sm transition-opacity
                                        ${tab.pinned ? 'opacity-100' : ''}
                                        ${tab.id === activeTabId
                                            ? 'hover:bg-black/10 text-black/60 hover:text-black'
                                            : 'hover:bg-white/20 text-white/60 hover:text-white'
                                        }
                                    `}
                                    aria-label={`${tab.pinned ? 'Unpin' : 'Pin'} ${tab.name}`}
                                    aria-pressed={tab.pinned}
                                    title={tab.pinned ? 'Unpin tab' : 'Pin tab'}
                                    data-ai-tab-pin="true"
                                >
                                    <Pin size={10} className={tab.pinned ? 'fill-current' : ''} />
                                </button>

                                {/* Close button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabClose(tab.id);
                                    }}
                                    className={`
                                        p-1 rounded-sm
                                        ${tab.id === activeTabId
                                            ? 'hover:bg-black/10 text-black/60 hover:text-black'
                                            : 'hover:bg-white/20 text-white/60 hover:text-white'
                                        }
                                    `}
                                    aria-label={`Close ${tab.name}`}
                                    data-ai-tab-close="true"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* New tab button - completely outside tablist */}
            <div className="flex-shrink-0 border-l border-white/20">
                <button
                    onClick={() => onNewTab()}
                    className="p-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="New tab"
                    title="New tab"
                    data-ai-new-tab
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
}
