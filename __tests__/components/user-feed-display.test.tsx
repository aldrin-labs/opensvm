/**
 * UserFeedDisplay Component Tests
 * Tests for the infinite loop fix in the user feed functionality
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { UserFeedDisplay } from '@/components/user-history/UserFeedDisplay';
import '@testing-library/jest-dom';

// Mock dependencies
jest.mock('@/lib/feed-cache', () => ({
  getCachedFeedEvents: jest.fn(() => Promise.resolve(null)),
  cacheFeedEvents: jest.fn(() => Promise.resolve()),
  updateCachedEvent: jest.fn(() => Promise.resolve()),
  addEventToCache: jest.fn(() => Promise.resolve()),
  clearCache: jest.fn(() => Promise.resolve()),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock EventSource
class MockEventSource {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = jest.fn();
  
  constructor(url: string) {
    this.url = url;
    // Simulate successful connection after a short delay
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  // Helper method to simulate messages
  simulateMessage(data: any) {
    if (this.onmessage) {
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(data)
      });
      this.onmessage(messageEvent);
    }
  }

  // Helper method to simulate errors
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Replace global EventSource with mock
global.EventSource = MockEventSource as any;

describe('UserFeedDisplay - Infinite Loop Fix', () => {
  const testWalletAddress = '5J4r87t9DaNBdFQeTnLLJqPKF5f6Ck8GWk52fjpkxzGu';
  const mockFeedData = {
    events: [
      {
        id: 'event-1',
        eventType: 'transaction',
        timestamp: Date.now(),
        userAddress: testWalletAddress,
        userName: 'Test User',
        content: 'Test transaction event',
        likes: 5,
        hasLiked: false
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFeedData)
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render without infinite loops', async () => {
    render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for the component to load by looking for any element containing "Feed"
    await waitFor(() => {
      expect(screen.getByText('Feed')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should not trigger multiple fetch requests on rapid re-renders', async () => {
    const { rerender } = render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    // Rapidly re-render the component (simulating state changes that could cause infinite loops)
    for (let i = 0; i < 5; i++) {
      rerender(
        <UserFeedDisplay 
          walletAddress={testWalletAddress} 
          isMyProfile={false} 
        />
      );
    }

    // Give some time for any potential additional calls
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should still only have the initial fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should establish SSE connection without infinite reconnections', async () => {
    jest.useFakeTimers();
    
    render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for component to mount
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Should have established exactly one SSE connection
    expect(MockEventSource).toHaveBeenCalledTimes(1);
    
    // Advance time to check if there are unnecessary reconnections
    await act(async () => {
      jest.advanceTimersByTime(10000); // 10 seconds
    });

    // Should still be only one connection
    expect(MockEventSource).toHaveBeenCalledTimes(1);
  });

  it('should handle tab changes without triggering infinite loops', async () => {
    render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Feed')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Clear previous fetch calls
    mockFetch.mockClear();

    // Click on the "Following" tab
    const followingTab = screen.getByRole('button', { name: /following/i });
    act(() => {
      followingTab.click();
    });

    // Should trigger exactly one new fetch for the tab change
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    // Verify the request has the correct feed type
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toContain('type=following');
  });

  it('should handle SSE message updates without triggering reconnections', async () => {
    jest.useFakeTimers();
    
    const eventSourceInstances: MockEventSource[] = [];
    const OriginalEventSource = global.EventSource;
    
    global.EventSource = jest.fn().mockImplementation((url: string) => {
      const instance = new OriginalEventSource(url) as MockEventSource;
      eventSourceInstances.push(instance);
      return instance;
    });

    render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for SSE connection
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(eventSourceInstances).toHaveLength(1);
    const eventSource = eventSourceInstances[0];

    // Simulate receiving multiple SSE messages
    for (let i = 0; i < 5; i++) {
      act(() => {
        eventSource.simulateMessage({
          type: 'feed-update',
          event: {
            id: `new-event-${i}`,
            eventType: 'transaction',
            timestamp: Date.now() + i,
            userAddress: 'other-user',
            content: `New event ${i}`,
            likes: 0,
            hasLiked: false
          }
        });
      });
    }

    // Should still have only one SSE connection (no reconnections)
    expect(eventSourceInstances).toHaveLength(1);
    
    // Cleanup
    global.EventSource = OriginalEventSource;
  });

  it('should handle filter changes without reconnecting SSE', async () => {
    render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for initial load and SSE connection
    await waitFor(() => {
      expect(screen.getByText('Feed')).toBeInTheDocument();
    }, { timeout: 5000 });

    const initialSSECallCount = (MockEventSource as any).mock.calls.length;

    // Open filter menu and change a filter
    const filterButton = screen.getByRole('button', { name: /filter/i });
    act(() => {
      filterButton.click();
    });

    // Give some time for any potential SSE reconnections
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Should not have created new SSE connections
    expect((MockEventSource as any).mock.calls.length).toBe(initialSSECallCount);
  });

  it('should properly cleanup SSE connection on unmount', async () => {
    const { unmount } = render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Feed')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Get reference to the SSE instance
    const sseInstance = (MockEventSource as any).mock.instances[0];
    expect(sseInstance.close).not.toHaveBeenCalled();

    // Unmount component
    unmount();

    // SSE connection should be closed
    expect(sseInstance.close).toHaveBeenCalled();
  });
});