'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { MessageSquare, Clock } from 'lucide-react';
import type { AIChatModel } from '@/lib/ai/models/ChatModels';
import { chatPersistenceService } from '@/lib/ai/services/ChatPersistenceService';

interface RecentChatsProps {
  isLoading?: boolean;
}

export function RecentChats({ isLoading: externalIsLoading = false }: RecentChatsProps) {
  const { publicKey, connected } = useWallet();
  const [chats, setChats] = useState<AIChatModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentChats() {
      if (!connected || !publicKey) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Get recent chats (limit to 5 for the home page)
        const recentChats = await chatPersistenceService.getUserChatHistory(5);
        setChats(recentChats);
      } catch (error) {
        console.error('Error fetching recent chats:', error);
        setChats([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecentChats();
  }, [connected, publicKey]);

  if (!connected) {
    return (
      <div className="bg-background border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Recent Messages</h2>
        </div>
        <p className="text-sm text-muted-foreground">Connect your wallet to see recent chat messages</p>
      </div>
    );
  }

  if (isLoading || externalIsLoading) {
    return (
      <div className="bg-background border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Recent Messages</h2>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Recent Messages</h2>
      </div>

      {chats.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No recent messages yet</p>
          <Link
            href="/chat"
            className="inline-block mt-3 text-sm text-primary hover:underline font-medium"
          >
            Start a conversation
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chat?id=${encodeURIComponent(chat.id)}`}
              className="block p-3 rounded-lg hover:bg-accent transition-colors duration-200 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {chat.title}
                  </h3>
                  {chat.metadata.summary && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {chat.metadata.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <time dateTime={new Date(chat.last_activity).toISOString()}>
                      {new Date(chat.last_activity).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </time>
                  </div>
                </div>
                <div className="flex-shrink-0 text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded">
                  {chat.metadata.total_messages}
                </div>
              </div>
            </Link>
          ))}
          <Link
            href="/chat"
            className="block mt-3 text-sm text-primary hover:underline font-medium text-center py-2"
          >
            View all messages
          </Link>
        </div>
      )}
    </div>
  );
}
