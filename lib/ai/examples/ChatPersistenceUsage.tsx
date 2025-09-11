/**
 * Example usage of the enhanced HistoryPanel with chat persistence
 * This shows how to integrate chat persistence with user authentication
 */

import React, { useEffect, useState } from 'react';
import { ChatUI } from '../../../components/ai/ChatUI';
import { chatPersistenceService } from '../services/ChatPersistenceService';
import type { Message } from '../../../components/ai/types';

interface ChatPersistenceUsageProps {
    // Your authentication system props
    user?: {
        id: string;
        email: string;
        isLoggedIn: boolean;
    };
}

export function ChatPersistenceUsage({ user }: ChatPersistenceUsageProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [tabs, setTabs] = useState<any[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    // Example of configuring persistence when user logs in
    useEffect(() => {
        if (user?.isLoggedIn && user.id) {
            // Configure the persistence service for this user
            chatPersistenceService.configure({
                autoSave: true,
                userId: user.id,
                enableSearch: true
            });

            console.log('Chat persistence enabled for user:', user.id);
        } else {
            // Disable persistence when not logged in
            chatPersistenceService.configure({
                autoSave: false,
                enableSearch: false
            });

            console.log('Chat persistence disabled - user not logged in');
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        const userMessage: Message = {
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsProcessing(true);

        try {
            // Your AI processing logic here
            // ...

            const assistantMessage: Message = {
                role: 'assistant',
                content: 'This is a demo response',
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, assistantMessage]);

            // If user is logged in, the chat will be auto-saved
            // due to the ChatUI's useEffect that monitors tab changes
        } catch (error) {
            console.error('Error processing message:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTabClick = (tabId: string) => {
        setActiveTabId(tabId);
        // Load chat from persistence if needed
        // Your tab switching logic here
    };

    const handleTabDelete = async (tabId: string) => {
        if (user?.id && user.isLoggedIn) {
            try {
                await chatPersistenceService.deleteChat(tabId, user.id);
                // Remove from local tabs
                setTabs(prev => prev.filter(tab => tab.id !== tabId));

                if (activeTabId === tabId && tabs.length > 1) {
                    // Switch to another tab
                    const remainingTabs = tabs.filter(tab => tab.id !== tabId);
                    setActiveTabId(remainingTabs[0]?.id || null);
                }
            } catch (error) {
                console.error('Error deleting chat:', error);
            }
        }
    };

    return (
        <div className="h-full">
            {/* Show persistence status */}
            {user?.isLoggedIn ? (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-green-300 text-sm">
                            Chat persistence enabled - Your conversations are being saved and searchable
                        </span>
                    </div>
                </div>
            ) : (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                        <span className="text-yellow-300 text-sm">
                            Log in to enable chat persistence and semantic search
                        </span>
                    </div>
                </div>
            )}

            <ChatUI
                messages={messages}
                input={input}
                isProcessing={isProcessing}
                onInputChange={setInput}
                onSubmit={handleSubmit}
                tabs={tabs}
                activeTabId={activeTabId}
                onTabClick={handleTabClick}
                onTabDelete={handleTabDelete}
                historyActive={true}
                // Chat persistence props
                userId={user?.id}
                enablePersistence={user?.isLoggedIn || false}
            />
        </div>
    );
}

/**
 * Example of real-time search integration
 */
export function ChatSearchExample({ userId }: { userId: string }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const performSearch = async () => {
            setIsSearching(true);
            try {
                const results = await chatPersistenceService.realtimeSearch(searchQuery);
                setSearchResults(results);
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        // Debounce search
        const timer = setTimeout(performSearch, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    return (
        <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Real-time Chat Search</h3>

            <div className="relative mb-4">
                <input
                    type="text"
                    placeholder="Search your chat history..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50"
                />
                {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full"></div>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                {searchResults.map((result, index) => (
                    <div key={index} className="bg-white/5 border border-white/20 rounded-lg p-3">
                        <div className="font-medium text-blue-300 mb-1">
                            {result.chat.title}
                        </div>
                        <div className="text-sm text-white/80">
                            {result.message.content.substring(0, 150)}...
                        </div>
                        <div className="text-xs text-white/50 mt-2">
                            Relevance: {(result.relevance_score * 100).toFixed(1)}%
                        </div>
                    </div>
                ))}
            </div>

            {searchQuery && !isSearching && searchResults.length === 0 && (
                <div className="text-center text-white/50 py-8">
                    No results found for "{searchQuery}"
                </div>
            )}
        </div>
    );
}
