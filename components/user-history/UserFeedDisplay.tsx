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
  FeedFilters
} from '@/lib/caching/feed-cache';
import { SocialFeedEvent } from '@/lib/feed-events';
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
  ArrowUpDown,
  Eye
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

// Use SocialFeedEvent from the proper module
type FeedEvent = SocialFeedEvent & { hasLiked: boolean };

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
  const [systemHealthy, setSystemHealthy] = useState<boolean>(true);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  // Retry logic state
  const [retryCount, setRetryCount] = useState(0);
  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);
  const maxRetries = 5;
  const baseRetryDelay = 2000; // Start with 2 seconds

  // Profile-specific features based on isMyProfile
  const profileFeatures = useMemo(() => {
    if (isMyProfile) {
      return {
        canDeleteEvents: true,
        canEditProfile: true,
        showPrivateEvents: true,
        canManageFollowers: true,
        showAnalytics: true
      };
    }
    return {
      canDeleteEvents: false,
      canEditProfile: false,
      showPrivateEvents: false,
      canManageFollowers: false,
      showAnalytics: false
    };
  }, [isMyProfile]);

  // Pagination and infinite scroll
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);

  // Filtering and search
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    eventTypes: [] as string[], // Empty array means show all event types
    dateRange: 'all' as 'today' | 'week' | 'month' | 'all',
    sortOrder: 'newest' as 'newest' | 'popular'
  });

  // User experience preferences
  const [groupByTime, setGroupByTime] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
          // Convert cached events to FeedEvent format  
          const convertedEvents = cachedEvents.map((cachedEvent: any) => ({
            id: cachedEvent.id,
            eventType: cachedEvent.eventType,
            timestamp: cachedEvent.timestamp,
            userAddress: cachedEvent.userAddress,
            userName: cachedEvent.userName,
            userAvatar: cachedEvent.userAvatar,
            content: cachedEvent.content,
            targetAddress: cachedEvent.targetAddress,
            targetId: cachedEvent.targetId,
            metadata: cachedEvent.metadata,
            likes: cachedEvent.likes || 0,
            hasLiked: cachedEvent.hasLiked || false
          }));
          setEvents(convertedEvents);
          setLoading(false);
          
          // Still fetch fresh data in background to update cache
          // This ensures users see cached data immediately but get fresh data soon
          console.log('Fetching fresh data in background to update cache...');
        } else {
          console.log('No valid cache found, fetching from API');
        }
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

      // Check system health from metadata
      if (data.metadata && data.metadata.systemHealthy === false) {
        setSystemHealthy(false);
        setError(data.metadata.message || 'Feed service is temporarily unavailable');
        setEvents([]);
        setLoading(false);
        return;
      }

      setSystemHealthy(true);

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
      setHasMore(data.metadata?.hasMore ?? data.events.length === 10);

    } catch (err) {
      setError('Failed to load feed events');
      console.error('Error fetching feed:', err);
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [walletAddress, page, filters, searchQuery]);

  // Load more events for infinite scrolling
  const loadMoreEvents = useCallback(async () => {
    if (loading || !hasMore || loadingMore.current) return;

    loadingMore.current = true;
    setPage(prevPage => prevPage + 1);
    await fetchFeed(activeTab, false);
  }, [loading, hasMore, activeTab, fetchFeed]);

  // Check if an event should be shown based on current filters
  const shouldShowEvent = useCallback((event: FeedEvent): boolean => {
    // Validate event has required fields
    if (!event || !event.eventType || typeof event.timestamp !== 'number') {
      console.error('Invalid event in shouldShowEvent:', event);
      return false;
    }

    // Check event type filter (only if filters are applied)
    if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.eventType)) {
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
  }, [filters, searchQuery]);

  // Custom hook for intersection observer (for infinite scrolling)
  useEffect(() => {
    if (!loaderRef.current || !hasMore || loading || events.length === 0) {
      return;
    }

    // Capture loaderRef for cleanup
    const loaderElement = loaderRef.current;

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

    observer.observe(loaderElement);

    return () => {
      if (loaderElement) {
        observer.unobserve(loaderElement);
      }
    };
  }, [hasMore, loading, events.length, loadMoreEvents]);

  // Initialize feed data on mount and tab change
  useEffect(() => {
    fetchFeed(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, activeTab]);

  // Setup SSE connection separately to avoid infinite loops
  useEffect(() => {
    if (!walletAddress) return;

    let currentEventSource: EventSource | null = null;
    let currentRetryTimeout: NodeJS.Timeout | null = null;
    let currentRetryCount = 0;
    let setupTimeout: NodeJS.Timeout | null = null;

    const setupEventSource = () => {
      // Clear any existing connections
      if (currentEventSource) {
        currentEventSource.close();
      }
      if (currentRetryTimeout) {
        clearTimeout(currentRetryTimeout);
        currentRetryTimeout = null;
      }

      setConnectionStatus('connecting');

      const queryParams = new URLSearchParams({
        walletAddress,
        type: activeTab,
        eventTypes: filters.eventTypes.join(',')
      });

      const newEventSource = new EventSource(`/api/sse-events/feed?${queryParams}`);
      currentEventSource = newEventSource;
      setEventSource(newEventSource);

      newEventSource.onopen = () => {
        setConnectionStatus('connected');
        currentRetryCount = 0;
        setRetryCount(0);
        console.log('SSE connection established');
      };

      newEventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'feed-update' && data.event) {
            setEvents(prevEvents => {
              const exists = prevEvents.some(e => e.id === data.event.id);
              if (!exists) {
                return [data.event, ...prevEvents];
              }
              return prevEvents;
            });
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };

      newEventSource.onerror = () => {
        setConnectionStatus('disconnected');
        newEventSource.close();
        
        // Implement exponential backoff retry logic
        if (currentRetryCount < maxRetries) {
          const delay = baseRetryDelay * Math.pow(2, currentRetryCount);
          console.log(`SSE connection failed, retrying in ${delay}ms (attempt ${currentRetryCount + 1}/${maxRetries})`);
          
          currentRetryCount++;
          setRetryCount(currentRetryCount);
          
          const timeout = setTimeout(() => {
            setupEventSource();
          }, delay);
          
          currentRetryTimeout = timeout;
          setRetryTimeout(timeout);
        } else {
          console.log('Max retry attempts reached, SSE connection abandoned');
        }
      };
    };

    // Debounce SSE setup to prevent rapid reconnections when filters change
    setupTimeout = setTimeout(() => {
      setupEventSource();
    }, 300);

    return () => {
      if (setupTimeout) {
        clearTimeout(setupTimeout);
      }
      if (currentEventSource) {
        currentEventSource.close();
      }
      if (currentRetryTimeout) {
        clearTimeout(currentRetryTimeout);
      }
    };
  }, [walletAddress, activeTab, filters.eventTypes]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    const newTab = value as 'for-you' | 'following';
    setActiveTab(newTab);
    
    // Reset search query when changing tabs
    setSearchQuery('');
    
    // Note: SSE reconnection will be handled automatically by the useEffect
    // that depends on activeTab
  };

  // Filter events based on current filters and search query
  const filteredEvents = useMemo(() => {
    return events.filter(shouldShowEvent);
  }, [events, shouldShowEvent]);

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

  // Group consecutive events from the same user for stacking
  const stackedEvents = useMemo(() => {
    const stacked: Array<{
      id: string;
      isGroup: boolean;
      events: FeedEvent[];
      groupKey: string;
      primaryEvent: FeedEvent;
    }> = [];

    let currentGroup: FeedEvent[] = [];
    let lastUserAddress = '';

    // Sort events by timestamp first (newest first)
    const sortedEvents = [...filteredEvents].sort((a, b) => b.timestamp - a.timestamp);

    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];

      // Check if this event should be grouped with the previous ones
      if (event.userAddress === lastUserAddress && currentGroup.length > 0) {
        currentGroup.push(event);
      } else {
        // Process the previous group if it exists
        if (currentGroup.length > 0) {
          if (currentGroup.length === 1) {
            // Single event, add as-is
            stacked.push({
              id: currentGroup[0].id,
              isGroup: false,
              events: currentGroup,
              groupKey: currentGroup[0].id,
              primaryEvent: currentGroup[0]
            });
          } else {
            // Multiple events from same user, create a group
            const groupKey = `group-${currentGroup[0].userAddress}-${currentGroup[0].timestamp}`;
            stacked.push({
              id: groupKey,
              isGroup: true,
              events: currentGroup,
              groupKey,
              primaryEvent: currentGroup[0] // Most recent event as primary
            });
          }
        }

        // Start new group
        currentGroup = [event];
        lastUserAddress = event.userAddress;
      }
    }

    // Process the last group
    if (currentGroup.length > 0) {
      if (currentGroup.length === 1) {
        stacked.push({
          id: currentGroup[0].id,
          isGroup: false,
          events: currentGroup,
          groupKey: currentGroup[0].id,
          primaryEvent: currentGroup[0]
        });
      } else {
        const groupKey = `group-${currentGroup[0].userAddress}-${currentGroup[0].timestamp}`;
        stacked.push({
          id: groupKey,
          isGroup: true,
          events: currentGroup,
          groupKey,
          primaryEvent: currentGroup[0]
        });
      }
    }

    return stacked;
  }, [filteredEvents]);

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

  // Toggle group expansion
  const toggleGroupExpansion = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
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
      case 'token_transfer':
        return <Coins className="h-4 w-4 text-yellow-500" />;
      case 'like':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'follow':
        return <User className="h-4 w-4 text-purple-500" />;
      case 'profile_update':
        return <User className="h-4 w-4 text-green-500" />;
      case 'visit':
        return <Eye className="h-4 w-4 text-cyan-500" />;
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

        {/* Event content with clickable link for visit events */}
        {event.eventType === 'visit' && event.metadata?.clickableUrl ? (
          <a 
            href={event.metadata.clickableUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm hover:underline text-primary cursor-pointer block"
          >
            {event.content} →
          </a>
        ) : (
          <p className="text-sm">{event.content}</p>
        )}

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

  // Render grouped event card with expand/collapse functionality  
  const GroupedEventCard = ({
    groupData,
    isExpanded,
    onToggle
  }: {
    groupData: {
      id: string;
      isGroup: boolean;
      events: FeedEvent[];
      groupKey: string;
      primaryEvent: FeedEvent;
    };
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const { events, primaryEvent } = groupData;
    const additionalCount = events.length - 1;

    return (
      <div className="border rounded-lg bg-card">
        {/* Primary event with group indicator */}
        <div
          className={`flex gap-3 p-4 hover:bg-accent/5 transition-colors cursor-pointer ${isExpanded ? 'border-b' : ''
            }`}
          onClick={onToggle}
        >
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={primaryEvent.userAvatar} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {primaryEvent.userName?.[0] || (primaryEvent.userAddress ? formatWalletAddress(primaryEvent.userAddress)[0] : '?')}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-medium">
                  {primaryEvent.userName || (primaryEvent.userAddress ? formatWalletAddress(primaryEvent.userAddress) : 'Unknown User')}
                </span>
                <span className="text-xs text-muted-foreground">
                  • {formatTimestamp(primaryEvent.timestamp)}
                </span>
                <span className="ml-1">{getEventIcon(primaryEvent.eventType)}</span>
                <Badge variant="outline" className="text-xs ml-1 px-1 py-0">
                  {primaryEvent.eventType}
                </Badge>
                {additionalCount > 0 && (
                  <Badge variant="secondary" className="text-xs ml-2 px-2 py-0">
                    +{additionalCount} more
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''
                  }`}
              />
            </div>

            {/* Event content with clickable link for visit events */}
            {primaryEvent.eventType === 'visit' && primaryEvent.metadata?.clickableUrl ? (
              <a 
                href={primaryEvent.metadata.clickableUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm hover:underline text-primary cursor-pointer block"
                onClick={(e) => e.stopPropagation()}
              >
                {primaryEvent.content} →
              </a>
            ) : (
              <p className="text-sm">{primaryEvent.content}</p>
            )}

            {/* Rich content for transaction events */}
            {primaryEvent.eventType === 'transaction' && primaryEvent.metadata?.amount && (
              <div className="mt-2 p-2 rounded-md bg-muted/50">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">{primaryEvent.metadata.amount} SOL</span>
                  </div>
                  {primaryEvent.metadata?.txId && (
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      View Transaction
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center gap-1 p-1 h-auto ${primaryEvent.hasLiked ? 'text-red-500' : 'text-muted-foreground'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike(primaryEvent.id);
                }}
              >
                <Heart className={`h-4 w-4 ${primaryEvent.hasLiked ? 'fill-current' : ''}`} />
                <span className="text-xs">{primaryEvent.likes}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Expanded events in tree structure */}
        {isExpanded && additionalCount > 0 && (
          <div className="px-4 pb-4">
            <div className="ml-12 space-y-3 pt-3">
              {events.slice(1).map((event, index) => (
                <div
                  key={event.id}
                  className="flex gap-3 p-3 rounded-md bg-muted/20 border-l-2 border-primary/20"
                  data-event-index={index + 1} // Use index for event positioning in tree structure
                  style={{
                    marginLeft: `${Math.min(index * 8, 32)}px`, // Progressive indentation based on index
                    opacity: Math.max(1 - (index * 0.1), 0.6) // Fade effect based on position
                  }}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={event.userAvatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {event.userName?.[0] || (event.userAddress ? formatWalletAddress(event.userAddress)[0] : '?')}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </span>
                      <span className="ml-1">{getEventIcon(event.eventType)}</span>
                      <Badge variant="outline" className="text-xs ml-1 px-1 py-0">
                        {event.eventType}
                      </Badge>
                    </div>

                    {/* Event content with clickable link for visit events */}
                    {event.eventType === 'visit' && event.metadata?.clickableUrl ? (
                      <a 
                        href={event.metadata.clickableUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm hover:underline text-primary cursor-pointer block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {event.content} →
                      </a>
                    ) : (
                      <p className="text-sm">{event.content}</p>
                    )}

                    {/* Rich content for transaction events */}
                    {event.eventType === 'transaction' && event.metadata?.amount && (
                      <div className="mt-2 p-2 rounded-md bg-muted/30">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Coins className="h-3 w-3 text-yellow-500" />
                            <span className="text-sm font-medium">{event.metadata.amount} SOL</span>
                          </div>
                          {event.metadata?.txId && (
                            <Button variant="outline" size="sm" className="h-6 text-xs">
                              View
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`flex items-center gap-1 p-1 h-auto ${event.hasLiked ? 'text-red-500' : 'text-muted-foreground'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLike(event.id);
                        }}
                      >
                        <Heart className={`h-3 w-3 ${event.hasLiked ? 'fill-current' : ''}`} />
                        <span className="text-xs">{event.likes}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

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
              {!systemHealthy 
                ? 'The feed service is currently unavailable. Our team has been notified and is working on restoring service.'
                : 'There was a problem loading the feed. This could be due to a network issue or temporary server error.'
              }
            </p>
            <Button
              onClick={() => fetchFeed(activeTab)}
              variant="default"
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            {!systemHealthy && (
              <p className="text-xs text-muted-foreground mt-4">
                Status: Database service unavailable
              </p>
            )}
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
              {groupByTime ? 'Timestamp View' : 'Time Groups'}
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
              className={`flex items-center justify-center gap-2 px-4 py-2 transition-colors ${activeTab === 'for-you'
                  ? 'border-b-2 border-primary text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Globe className="h-4 w-4" />
              <span>For You</span>
            </button>
            <button
              onClick={() => handleTabChange('following')}
              className={`flex items-center justify-center gap-2 px-4 py-2 transition-colors ${activeTab === 'following'
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
                  {filters.eventTypes.length > 0 && filters.eventTypes.length < 6 && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                      {filters.eventTypes.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Event Types</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Select All / Deselect All option */}
                <DropdownMenuItem
                  onClick={() => {
                    const allTypes = ['transaction', 'follow', 'like', 'profile_update', 'token_transfer', 'visit'];
                    const isAllSelected = filters.eventTypes.length === allTypes.length;
                    setFilters(prev => ({
                      ...prev,
                      eventTypes: isAllSelected ? [] : allTypes
                    }));
                  }}
                  className="font-medium"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border rounded flex items-center justify-center">
                      {filters.eventTypes.length === 6 && <span>✓</span>}
                    </div>
                    <span>
                      {filters.eventTypes.length === 6 ? 'Deselect All' : 'Select All'}
                    </span>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {['transaction', 'follow', 'like', 'profile_update', 'token_transfer', 'visit'].map(type => (
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
                        {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}

                {filters.eventTypes.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          eventTypes: []
                        }));
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Event Type Filters
                    </DropdownMenuItem>
                  </>
                )}

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
          <div className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
            }`} />
          <span className="text-xs text-muted-foreground">
            {connectionStatus === 'connected' ? 'Live updates active' :
              connectionStatus === 'connecting' ?
                (retryCount > 0 ? `Reconnecting... (attempt ${retryCount}/${maxRetries})` : 'Connecting...') :
                retryCount >= maxRetries ? 'Connection failed - manual retry required' : 'Disconnected - retrying'}
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
                  : filters.eventTypes.length > 0 && filters.eventTypes.length < 6
                    ? 'No events match the selected filters.'
                    : activeTab === 'for-you'
                      ? systemHealthy 
                        ? 'No events to show at the moment.'
                        : 'Unable to load feed - service unavailable.'
                      : 'No events from users you follow.'}
              </p>
              {activeTab === 'for-you' && !searchQuery && (filters.eventTypes.length === 0 || filters.eventTypes.length === 6) && systemHealthy && (
                <p className="text-sm text-muted-foreground max-w-xs">
                  Feed events are created when users perform actions like following, liking, or making transactions. Check back later!
                </p>
              )}
              {filters.eventTypes.length > 0 && filters.eventTypes.length < 6 && (
                <p className="text-sm text-muted-foreground max-w-xs">
                  Try removing some filters or check back later for matching events.
                </p>
              )}
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
                // Stacked events (grouped by user when consecutive)
                stackedEvents.map(groupData => {
                  if (groupData.isGroup) {
                    return (
                      <GroupedEventCard
                        key={groupData.groupKey}
                        groupData={groupData}
                        isExpanded={expandedGroups.has(groupData.groupKey)}
                        onToggle={() => toggleGroupExpansion(groupData.groupKey)}
                      />
                    );
                  } else {
                    return (
                      <EventCard key={groupData.id} event={groupData.primaryEvent} />
                    );
                  }
                })
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
                      // Reset retry count and trigger reconnection by updating a dummy state
                      setRetryCount(0);
                      setConnectionStatus('connecting');
                      // The useEffect will handle reconnection when connectionStatus changes
                      window.location.reload();
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reconnect
                  </Button>
                </div>
              )}

              {/* Like Error Display */}
              {likeError && (
                <div className="flex justify-center items-center gap-2 py-3 mt-4 bg-destructive/10 rounded-md border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">{likeError}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 ml-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setLikeError(null)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                </div>
              )}

              {/* Profile-specific features */}
              {profileFeatures.showAnalytics && (
                <div className="mt-4 p-4 bg-primary/5 rounded-md border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Your Activity Analytics</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium">{events.length}</span> total events
                    </div>
                    <div>
                      <span className="font-medium">{events.reduce((sum, e) => sum + e.likes, 0)}</span> total likes received
                    </div>
                    <div>
                      <span className="font-medium">{events.filter(e => e.eventType === 'transaction').length}</span> transactions
                    </div>
                    <div>
                      <span className="font-medium">{events.filter(e => e.hasLiked).length}</span> events liked by you
                    </div>
                  </div>
                  {profileFeatures.canEditProfile && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 h-7"
                      onClick={() => console.log('Edit profile clicked')}
                    >
                      <User className="h-3 w-3 mr-1" />
                      Edit Profile
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
