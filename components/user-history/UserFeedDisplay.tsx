/**
 * User Feed Display Component
 * Shows real-time feed of events from all users or followed users
 * Enhanced with filtering, infinite scrolling, and rich event cards
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  cacheFeedEvents,
  getCachedFeedEvents,
  updateCachedEvent,
  addEventToCache,
  clearCache,
  FeedEvent as CachedFeedEvent,
  FeedFilters
} from '@/lib/feed-cache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  Globe, 
  Users, 
  Heart, 
  Clock, 
  User, 
  RefreshCw, 
  AlertCircle, 
  Filter,
  Search,
  Coins,
  X,
  ChevronDown,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';

// Type definitions for feed events
interface FeedEvent {
  id: string;
  eventType: 'transaction' | 'visit' | 'like' | 'follow' | 'other';
  timestamp: number;
  userAddress: string;
  userName?: string;
  userAvatar?: string;
  content: string;
  targetAddress?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  likes: number;
  hasLiked: boolean;
}

interface UserFeedDisplayProps {
  walletAddress: string;
  isMyProfile: boolean;
}

export function UserFeedDisplay({ walletAddress, isMyProfile }: UserFeedDisplayProps) {
  // Core state
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Pagination and infinite scroll
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);

  // Filtering and search
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    eventTypes: ['transaction', 'visit', 'like', 'follow', 'other'],
    dateRange: 'all' as 'today' | 'week' | 'month' | 'all',
    sortOrder: 'newest' as 'newest' | 'popular'
  });

  // User experience preferences
  const [groupByTime, setGroupByTime] = useState(true);

  // Custom hook for intersection observer (for infinite scrolling)
  useEffect(() => {
    if (!loaderRef.current || !hasMore || loading || events.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadMoreEvents();
          }
        });
      },
      {
        rootMargin: '0px',
        threshold: 0.1,
      }
    );

    observer.observe(loaderRef.current);

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [loaderRef, hasMore, loading, events.length]);

  // Function to fetch feed data with caching
  const fetchFeed = useCallback(async (feedType: 'for-you' | 'following', reset = true) => {
    try {
      if (reset) {
        setLoading(true);
        setError(null);
        setPage(1);
        setHasMore(true);
      }
      
      // Create filter object for cache
      const filterObj: FeedFilters = {
        eventTypes: filters.eventTypes,
        dateRange: filters.dateRange,
        sortOrder: filters.sortOrder,
        searchQuery: searchQuery
      };
      
      // Check cache first if this is the initial load
      if (reset) {
        console.log('Checking cache for feed data...');
        const cachedEvents = await getCachedFeedEvents(walletAddress, feedType, filterObj);
        
        if (cachedEvents) {
          console.log('Using cached feed data');
          setEvents(cachedEvents);
          setLoading(false);
          return;
        }
        console.log('No valid cache found, fetching from API');
      }
      
      // If cache miss or pagination, proceed with API request
      const queryParams = new URLSearchParams({
        type: feedType,
        page: reset ? '1' : page.toString(),
        limit: '10',
        dateRange: filters.dateRange,
        eventTypes: filters.eventTypes.join(','),
        sort: filters.sortOrder
      });
      
      const response = await fetch(`/api/user-feed/${walletAddress}?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch feed data');
      }
      
      const data = await response.json();
      
      // Update state with new data
      if (reset) {
        setEvents(data.events);
        
        // Cache the events for future use
        cacheFeedEvents(walletAddress, feedType, data.events, filterObj)
          .catch(error => console.error('Error caching feed events:', error));
      } else {
        setEvents(prev => [...prev, ...data.events]);
        
        // Add new events to cache
        if (data.events.length > 0) {
          // We only cache the first page as a complete set
          // For subsequent pages, we just add individual events
          data.events.forEach((event: FeedEvent) => {
            addEventToCache(walletAddress, feedType, event)
              .catch(error => console.error('Error adding event to cache:', error));
          });
        }
      }
      
      // Check if there are more events to load
      setHasMore(data.events.length === 10);
      
    } catch (err) {
      setError('Failed to load feed events');
      console.error('Error fetching feed:', err);
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [walletAddress, page, filters]);

  // Load more events for infinite scrolling
  async function loadMoreEvents() {
    if (loading || !hasMore || loadingMore.current) return;
    
    loadingMore.current = true;
    setPage(prevPage => prevPage + 1);
    await fetchFeed(activeTab, false);
  }

  // Initialize SSE connection for real-time updates
  useEffect(() => {
    const setupEventSource = () => {
      setConnectionStatus('connecting');
      
      const queryParams = new URLSearchParams({
        walletAddress,
        type: activeTab,
        eventTypes: filters.eventTypes.join(',')
      });
      
      const newEventSource = new EventSource(`/api/sse-events/feed?${queryParams}`);
      
      newEventSource.onopen = () => {
        setConnectionStatus('connected');
        console.log('SSE connection established');
      };
      
      newEventSource.onmessage = (event) => {
        // Set to connected on first message as a fallback
        if (connectionStatus !== 'connected') {
          setConnectionStatus('connected');
        }
        
        try {
          console.log('SSE raw data:', event.data);
          const data = JSON.parse(event.data);
          console.log('Parsed SSE data:', data);
          
          if (!data) {
            console.error('SSE event data is null or undefined');
            return;
          }
          
          if (data.type === 'feed-update') {
            // Validate event data exists and has required fields
            if (!data.event) {
              console.error('SSE feed-update missing event data');
              return;
            }
            
            if (!data.event.id) {
              console.error('SSE event missing id', data.event);
              return;
            }
            
            // Ensure userAddress exists to prevent slice errors
            if (!data.event.userAddress) {
              console.warn('SSE event missing userAddress, adding placeholder', data.event);
              data.event.userAddress = 'unknown-address';
            }
            
            // Check if event matches current filters
            if (shouldShowEvent(data.event)) {
              console.log('Adding new event:', data.event);
              // Add new event to the feed
              setEvents(prevEvents => {
                const exists = prevEvents.some(e => e.id === data.event.id);
                if (exists) {
                  // Update cache for this event
                  updateCachedEvent(data.event.id, data.event)
                    .catch(error => console.error('Error updating cached event:', error));
                    
                  return prevEvents.map(e => e.id === data.event.id ? data.event : e);
                } else {
                  // Add to beginning for 'newest' sort, or in correct position for 'popular'
                  if (filters.sortOrder === 'newest') {
                    // Add new event to cache
                    addEventToCache(walletAddress, activeTab, data.event)
                      .catch(error => console.error('Error adding event to cache:', error));
                      
                    return [data.event, ...prevEvents];
                  } else {
                    const newEvents = [...prevEvents, data.event];
                    
                    // Add new event to cache
                    addEventToCache(walletAddress, activeTab, data.event)
                      .catch(error => console.error('Error adding event to cache:', error));
                      
                    return newEvents.sort((a, b) => b.likes - a.likes);
                  }
                }
              });
            }
          } else if (data.type === 'like-update') {
            // Validate like-update data
            if (!data.eventId || typeof data.likes !== 'number') {
              console.error('SSE like-update missing required fields', data);
              return;
            }
            
            // Update likes count for an event
            setEvents(prevEvents => {
              const updatedEvents = prevEvents.map(event =>
                event.id === data.eventId
                  ? {
                      ...event,
                      likes: data.likes,
                      hasLiked: data.userHasLiked === walletAddress ? true : event.hasLiked
                    }
                  : event
              );
              
              // Update cache for this event if it exists
              const updatedEvent = updatedEvents.find(e => e.id === data.eventId);
              if (updatedEvent) {
                updateCachedEvent(data.eventId, {
                  likes: data.likes,
                  hasLiked: data.userHasLiked === walletAddress
                }).catch(error => console.error('Error updating cached event:', error));
              }
              
              return updatedEvents;
            });
            
            // If sorted by popularity, re-sort the events
            if (filters.sortOrder === 'popular') {
              setEvents(prev => [...prev].sort((a, b) => b.likes - a.likes));
            }
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };
      
      newEventSource.onerror = (error) => {
        console.error('Detailed EventSource error:', { error, readyState: newEventSource.readyState });
        setConnectionStatus('disconnected');
        newEventSource.close();
        // Attempt to reconnect after a few seconds
        setTimeout(setupEventSource, 5000);
      };
      
      setEventSource(newEventSource);
    };
    
    // Initial fetch
    fetchFeed(activeTab);
    
    // Setup SSE
    setupEventSource();
    
    // Cleanup on unmount
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [walletAddress, activeTab, fetchFeed, filters.eventTypes]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    const newTab = value as 'for-you' | 'following';
    setActiveTab(newTab);
    fetchFeed(newTab);
    
    // Reconnect SSE with new parameters
    if (eventSource) {
      eventSource.close();
    }
    
    // Reset search query when changing tabs
    setSearchQuery('');
  };

  // Check if an event should be shown based on current filters
  const shouldShowEvent = (event: FeedEvent): boolean => {
    // Validate event has required fields
    if (!event || !event.eventType || typeof event.timestamp !== 'number') {
      console.error('Invalid event in shouldShowEvent:', event);
      return false;
    }
    
    // Check event type filter
    if (!filters.eventTypes.includes(event.eventType)) {
      return false;
    }
    
    // Check date range filter
    const now = Date.now();
    const eventDate = event.timestamp;
    
    if (filters.dateRange === 'today') {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      if (eventDate < todayStart) return false;
    } else if (filters.dateRange === 'week') {
      const weekStart = now - 7 * 24 * 60 * 60 * 1000;
      if (eventDate < weekStart) return false;
    } else if (filters.dateRange === 'month') {
      const monthStart = now - 30 * 24 * 60 * 60 * 1000;
      if (eventDate < monthStart) return false;
    }
    
    // Check search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      
      // Ensure we always return a boolean by checking each condition separately
      const contentMatch = event.content ? event.content.toLowerCase().includes(query) : false;
      const userNameMatch = event.userName ? event.userName.toLowerCase().includes(query) : false;
      const eventTypeMatch = event.eventType ? event.eventType.toLowerCase().includes(query) : false;
      const addressMatch = event.userAddress ? event.userAddress.toLowerCase().includes(query) : false;
      
      return contentMatch || userNameMatch || eventTypeMatch || addressMatch;
    }
    
    return true;
  };

  // Filter events based on current filters and search query
  const filteredEvents = useMemo(() => {
    return events.filter(shouldShowEvent);
  }, [events, filters, searchQuery]);

  // Group events by time period
  const groupedEvents = useMemo(() => {
    if (!groupByTime) return { all: filteredEvents };
    
    const groups: Record<string, FeedEvent[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: []
    };
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const thisWeekStart = today - (now.getDay() * 86400000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    
    filteredEvents.forEach(event => {
      if (event.timestamp >= today) {
        groups.today.push(event);
      } else if (event.timestamp >= yesterday) {
        groups.yesterday.push(event);
      } else if (event.timestamp >= thisWeekStart) {
        groups.thisWeek.push(event);
      } else if (event.timestamp >= thisMonthStart) {
        groups.thisMonth.push(event);
      } else {
        groups.older.push(event);
      }
    });
    
    return groups;
  }, [filteredEvents, groupByTime]);

  // Handle like action
  const handleLike = async (eventId: string) => {
    try {
      setLikeError(null); // Clear any previous errors
      const event = events.find(e => e.id === eventId);
      if (!event) return;
      
      // Optimistically update UI first for better UX
      const newLikes = event.hasLiked ? event.likes - 1 : event.likes + 1;
      const newHasLiked = !event.hasLiked;
      
      setEvents(prevEvents =>
        prevEvents.map(evt =>
          evt.id === eventId
            ? {
                ...evt,
                likes: newLikes,
                hasLiked: newHasLiked
              }
            : evt
        )
      );
      
      // Update the cache for this event
      updateCachedEvent(eventId, {
        likes: newLikes,
        hasLiked: newHasLiked
      }).catch(error => console.error('Error updating cached event like status:', error));
      
      // If sorted by popularity, re-sort the events
      if (filters.sortOrder === 'popular') {
        setEvents(prev => [...prev].sort((a, b) => b.likes - a.likes));
      }
      
      const action = event.hasLiked ? 'unlike-event' : 'like-event';
      
      const response = await fetch(`/api/user-social/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId })
      });
      
      if (!response.ok) {
        // Revert the optimistic update if the request fails
        setEvents(prevEvents =>
          prevEvents.map(evt =>
            evt.id === eventId
              ? {
                  ...evt,
                  likes: event.likes, // Revert to original value
                  hasLiked: event.hasLiked // Revert to original state
                }
              : evt
          )
        );
        
        // Also revert in cache
        updateCachedEvent(eventId, {
          likes: event.likes,
          hasLiked: event.hasLiked
        }).catch(error => console.error('Error reverting cached event like status:', error));
        
        // Handle different error types
        if (response.status === 401) {
          setLikeError('Please connect your wallet to like posts');
        } else if (response.status === 403) {
          // Handle token gating errors
          const errorData = await response.json();
          if (errorData.tokenGating) {
            setLikeError(`You need at least 100,000 SVMAI tokens to like events. Your current balance: ${errorData.tokenGating.current.toLocaleString()}`);
          } else {
            setLikeError(errorData.error || 'Access denied');
          }
        } else {
          setLikeError('Failed to like/unlike event');
        }
      }
    } catch (err) {
      console.error('Error liking/unliking event:', err);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return 'Unknown time';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  // Format wallet address
  const formatWalletAddress = (address?: string): string => {
    if (!address) return 'Unknown';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  };

  // Format date for group headings
  const formatGroupDate = (group: string): string => {
    switch (group) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'thisWeek': return 'This Week';
      case 'thisMonth': return 'This Month';
      case 'older': return 'Older';
      default: return group;
    }
  };

  // Get icon for event type
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'transaction':
        return <Coins className="h-4 w-4 text-blue-500" />;
      case 'visit':
        return <Globe className="h-4 w-4 text-green-500" />;
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'follow':
        return <User className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // Loading skeleton component
  const FeedItemSkeleton = () => (
    <div className="flex gap-3 p-4 rounded-lg border bg-card">
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="pt-1">
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
    </div>
  );

  // Render event card
  const EventCard = ({ event }: { event: FeedEvent }) => (
    <div className="flex gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={event.userAvatar} />
        <AvatarFallback className="bg-primary/10 text-primary">
          {event.userName?.[0] || (event.userAddress ? formatWalletAddress(event.userAddress)[0] : '?')}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-medium">
              {event.userName || (event.userAddress ? formatWalletAddress(event.userAddress) : 'Unknown User')}
            </span>
            <span className="text-xs text-muted-foreground">
              • {formatTimestamp(event.timestamp)}
            </span>
            <span className="ml-1">{getEventIcon(event.eventType)}</span>
            <Badge variant="outline" className="text-xs ml-1 px-1 py-0">
              {event.eventType}
            </Badge>
          </div>
        </div>
        
        <p className="text-sm">{event.content}</p>
        
        {/* Rich content for transaction events */}
        {event.eventType === 'transaction' && event.metadata?.amount && (
          <div className="mt-2 p-2 rounded-md bg-muted/50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-yellow-500" />
                <span className="font-medium">{event.metadata.amount} SOL</span>
              </div>
              {event.metadata?.txId && (
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  View Transaction
                </Button>
              )}
            </div>
          </div>
        )}
        
        {/* Media support */}
        {event.metadata?.mediaUrl && (
          <div className="mt-2 rounded-md overflow-hidden">
            <img 
              src={event.metadata.mediaUrl} 
              alt="Event media"
              className="w-full h-auto max-h-48 object-cover"
            />
          </div>
        )}
        
        <div className="flex items-center gap-4 pt-1">
          <Button 
            variant="ghost" 
            size="sm"
            className={`flex items-center gap-1 p-1 h-auto ${event.hasLiked ? 'text-red-500' : 'text-muted-foreground'}`}
            onClick={() => handleLike(event.id)}
          >
            <Heart className={`h-4 w-4 ${event.hasLiked ? 'fill-current' : ''}`} />
            <span className="text-xs">{event.likes}</span>
          </Button>
        </div>
      </div>
    </div>
  );

  // Loading state
  if (loading && events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tab skeleton */}
          <div className="w-full border-b mb-4">
            <div className="grid w-full grid-cols-2">
              <Skeleton className="h-10 mx-auto w-24" />
              <Skeleton className="h-10 mx-auto w-24" />
            </div>
          </div>
          
          {/* Feed items skeleton */}
          <div className="space-y-4">
            <FeedItemSkeleton />
            <FeedItemSkeleton />
            <FeedItemSkeleton />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error && events.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-10 space-y-3">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              There was a problem loading the feed. This could be due to a network issue or server error.
            </p>
            <Button
              onClick={() => fetchFeed(activeTab)}
              variant="default"
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {activeTab === 'for-you' ? <Globe className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            Feed
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setGroupByTime(!groupByTime)}
            >
              <Clock className="h-4 w-4 mr-2" />
              {groupByTime ? 'Show as List' : 'Group by Time'}
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchFeed(activeTab)}
                disabled={loading}
                title="Refresh feed"
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearCache(walletAddress, activeTab)
                    .then(() => fetchFeed(activeTab))
                    .catch(error => console.error('Error clearing cache:', error));
                }}
                disabled={loading}
                title="Clear cache and refresh"
                className="h-8 px-2 text-xs"
              >
                <span>Clear Cache</span>
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full border-b mb-4">
          <div className="grid w-full grid-cols-2">
            <button
              onClick={() => handleTabChange('for-you')}
              className={`flex items-center justify-center gap-2 px-4 py-2 transition-colors ${
                activeTab === 'for-you'
                  ? 'border-b-2 border-primary text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>For You</span>
            </button>
            <button
              onClick={() => handleTabChange('following')}
              className={`flex items-center justify-center gap-2 px-4 py-2 transition-colors ${
                activeTab === 'following'
                  ? 'border-b-2 border-primary text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Following</span>
            </button>
          </div>
        </div>
        
        {/* Filters and search */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search feed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Event Types</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {['transaction', 'visit', 'like', 'follow', 'other'].map(type => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => {
                      const isSelected = filters.eventTypes.includes(type);
                      setFilters(prev => ({
                        ...prev,
                        eventTypes: isSelected 
                          ? prev.eventTypes.filter(t => t !== type)
                          : [...prev.eventTypes, type]
                      }));
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border rounded flex items-center justify-center">
                        {filters.eventTypes.includes(type) && <span>✓</span>}
                      </div>
                      <span className="flex items-center gap-2">
                        {getEventIcon(type)}
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {['today', 'week', 'month', 'all'].map(range => (
                  <DropdownMenuItem
                    key={range}
                    onClick={() => {
                      setFilters(prev => ({ 
                        ...prev, 
                        dateRange: range as 'today' | 'week' | 'month' | 'all' 
                      }));
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full flex items-center justify-center">
                        {filters.dateRange === range && <span>●</span>}
                      </div>
                      <span>
                        {range === 'today' ? 'Today' : 
                         range === 'week' ? 'This Week' : 
                         range === 'month' ? 'This Month' : 
                         'All Time'}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setFilters(prev => ({ 
                      ...prev, 
                      sortOrder: 'newest' 
                    }));
                    setEvents(prev => [...prev].sort((a, b) => b.timestamp - a.timestamp));
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full flex items-center justify-center">
                      {filters.sortOrder === 'newest' && <span>●</span>}
                    </div>
                    <Clock className="h-4 w-4 mr-2" />
                    <span>Newest First</span>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  onClick={() => {
                    setFilters(prev => ({ 
                      ...prev, 
                      sortOrder: 'popular' 
                    }));
                    setEvents(prev => [...prev].sort((a, b) => b.likes - a.likes));
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full flex items-center justify-center">
                      {filters.sortOrder === 'popular' && <span>●</span>}
                    </div>
                    <Heart className="h-4 w-4 mr-2" />
                    <span>Most Popular</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Connection status indicator */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`h-2 w-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' :
            connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-red-500'
          }`} />
          <span className="text-xs text-muted-foreground">
            {connectionStatus === 'connected' ? 'Live updates active' :
             connectionStatus === 'connecting' ? 'Connecting...' :
             'Disconnected - retrying'}
          </span>
        </div>
        
        <div className="mt-2">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-10 bg-muted/20 rounded-md flex flex-col items-center justify-center space-y-3">
              {activeTab === 'for-you' ? (
                <Globe className="h-12 w-12 text-muted-foreground/40 mb-2" />
              ) : (
                <Users className="h-12 w-12 text-muted-foreground/40 mb-2" />
              )}
              <p className="text-muted-foreground font-medium">
                {searchQuery 
                  ? 'No events match your search criteria.' 
                  : activeTab === 'for-you'
                    ? 'No events to show at the moment.'
                    : 'No events from users you follow.'}
              </p>
              {activeTab === 'following' && !searchQuery && (
                <p className="text-sm text-muted-foreground max-w-xs">
                  Follow more users to see their activity here.
                </p>
              )}
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="mt-2"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Search
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchFeed(activeTab)}
                className="mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {groupByTime ? (
                // Grouped events by time periods
                Object.entries(groupedEvents).map(([period, periodEvents]) => 
                  periodEvents.length > 0 && (
                    <div key={period} className="space-y-2 mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground capitalize">
                        {formatGroupDate(period)}
                      </h3>
                      <div className="space-y-4">
                        {periodEvents.map(event => (
                          <EventCard key={event.id} event={event} />
                        ))}
                      </div>
                    </div>
                  )
                )
              ) : (
                // Non-grouped events
                filteredEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))
              )}
              
              {/* Infinite scroll loader */}
              {hasMore && (
                <div ref={loaderRef} className="h-10 flex justify-center items-center">
                  {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                </div>
              )}
              
              {loading && events.length > 0 && (
                <div className="flex justify-center items-center gap-2 py-4 bg-muted/10 rounded-md">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading more events...</span>
                </div>
              )}

              {connectionStatus === 'disconnected' && (
                <div className="flex justify-center items-center gap-2 py-3 mt-4 bg-destructive/10 rounded-md border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">Connection lost</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 ml-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (eventSource) {
                        eventSource.close();
                      }
                      // Reinitialize the SSE connection
                      const setupEventSource = () => {
                        setConnectionStatus('connecting');
                        const queryParams = new URLSearchParams({
                          walletAddress,
                          type: activeTab,
                          eventTypes: filters.eventTypes.join(',')
                        });
                        const newEventSource = new EventSource(`/api/sse-events/feed?${queryParams}`);
                        setEventSource(newEventSource);
                      };
                      setupEventSource();
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reconnect
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}