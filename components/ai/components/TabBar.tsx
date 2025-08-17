import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { ChatTab } from '../hooks/useChatTabs';

interface TabBarProps {
    tabs: ChatTab[];
    activeTabId: string | null;
    onTabClick: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onNewTab: () => void;
    onTabRename?: (tabId: string, name: string) => void;
    className?: string;
}

interface TabItemProps {
    tab: ChatTab;
    isActive: boolean;
    onTabClick: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onTabRename?: (tabId: string, name: string) => void;
}

function TabItem({ tab, isActive, onTabClick, onTabClose, onTabRename }: TabItemProps) {
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
            return <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />;
        }
        if (tab.status) {
            return <div className="w-2 h-2 bg-green-400 rounded-full" />;
        }
        return null;
    };

    return (
        <div
            className={`
        group flex items-center gap-2 px-3 py-2 min-w-0 max-w-[200px] relative
        ${isActive
                    ? 'bg-white text-black'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }
        border-r border-white/20 cursor-pointer transition-colors
      `}
            onClick={() => onTabClick(tab.id)}
            onDoubleClick={handleDoubleClick}
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
                    />
                ) : (
                    <span className="text-sm font-medium truncate block">
                        {tab.name}
                    </span>
                )}
            </div>

            {/* Mode indicator */}
            <div className={`text-xs opacity-60 ${isActive ? 'text-black/60' : 'text-white/60'}`}>
                {tab.mode === 'agent' ? 'A' : 'AI'}
            </div>

            {/* Status text */}
            {tab.status && (
                <div className={`text-xs opacity-60 max-w-[80px] truncate ${isActive ? 'text-black/60' : 'text-white/60'}`}>
                    {tab.status}
                </div>
            )}

            {/* Close button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                }}
                className={`
          flex-shrink-0 p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity
          ${isActive
                        ? 'hover:bg-black/10 text-black/60 hover:text-black'
                        : 'hover:bg-white/20 text-white/60 hover:text-white'
                    }
        `}
                aria-label={`Close ${tab.name}`}
            >
                <X size={12} />
            </button>
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
    className = ''
}: TabBarProps) {
    return (
        <div className={`flex items-center bg-black border-b border-white/20 ${className}`}>
            {/* Tabs container with horizontal scroll */}
            <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
                <div className="flex items-center min-w-max">
                    {tabs.map((tab) => (
                        <TabItem
                            key={tab.id}
                            tab={tab}
                            isActive={tab.id === activeTabId}
                            onTabClick={onTabClick}
                            onTabClose={onTabClose}
                            onTabRename={onTabRename}
                        />
                    ))}
                </div>
            </div>

            {/* New tab button */}
            <button
                // Wrap to avoid React synthetic event being forwarded as the first arg
                // which previously caused an object to be stored as tab.name and crash rendering
                onClick={() => onNewTab()}
                className="flex-shrink-0 p-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors border-l border-white/20"
                aria-label="New tab"
                title="New tab"
            >
                <Plus size={16} />
            </button>
        </div>
    );
}
