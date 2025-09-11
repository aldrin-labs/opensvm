/**
 * UserFeedDisplay Component Integration Tests
 * Tests for the infinite loop fix in the user feed functionality
 * Focused on core functionality rather than UI elements
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { UserFeedDisplay } from '@/components/user-history/UserFeedDisplay';

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

// Mock EventSource with more tracking
class MockEventSource {
  static instances: MockEventSource[] = [];
  static totalCreated = 0;
  
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = jest.fn();
  closed = false;
  
  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    MockEventSource.totalCreated++;
    
    // Simulate successful connection after a short delay
    setTimeout(() => {
      if (!this.closed && this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  static reset() {
    MockEventSource.instances = [];
    MockEventSource.totalCreated = 0;
  }

  // Helper method to simulate messages
  simulateMessage(data: any) {
    if (!this.closed && this.onmessage) {
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(data)
      });
      this.onmessage(messageEvent);
    }
  }
}

// Replace global EventSource with mock
global.EventSource = MockEventSource as any;

describe('UserFeedDisplay - Infinite Loop Prevention', () => {
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
    MockEventSource.reset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockFeedData)
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not create excessive SSE connections', async () => {
    jest.useFakeTimers();
    
    const { rerender } = render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Allow initial setup
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    const initialConnectionCount = MockEventSource.totalCreated;
    expect(initialConnectionCount).toBe(1);

    // Rapidly re-render multiple times (simulating state changes)
    for (let i = 0; i < 10; i++) {
      rerender(
        <UserFeedDisplay 
          walletAddress={testWalletAddress} 
          isMyProfile={false} 
        />
      );
    }

    // Allow time for any delayed effects
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Should not have created additional connections
    expect(MockEventSource.totalCreated).toBe(initialConnectionCount);
  });

  it('should limit API fetch calls during rapid updates', async () => {
    const { rerender } = render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });

    const initialFetchCount = mockFetch.mock.calls.length;

    // Rapidly re-render the component 
    for (let i = 0; i < 5; i++) {
      rerender(
        <UserFeedDisplay 
          walletAddress={testWalletAddress} 
          isMyProfile={false} 
        />
      );
    }

    // Allow some time for any potential additional calls
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // Should not have triggered additional fetches
    expect(mockFetch).toHaveBeenCalledTimes(initialFetchCount);
  });

  it('should handle SSE messages without reconnecting', async () => {
    jest.useFakeTimers();
    
    render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for SSE setup
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(MockEventSource.instances).toHaveLength(1);
    const eventSource = MockEventSource.instances[0];

    // Simulate receiving multiple messages rapidly
    for (let i = 0; i < 20; i++) {
      act(() => {
        eventSource.simulateMessage({
          type: 'feed-update',
          event: {
            id: `event-${i}`,
            eventType: 'transaction',
            timestamp: Date.now() + i,
            userAddress: 'other-user',
            content: `Event ${i}`,
            likes: 0,
            hasLiked: false
          }
        });
      });
    }

    // Allow processing
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    // Should still have only one connection
    expect(MockEventSource.totalCreated).toBe(1);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('should cleanup properly on unmount', async () => {
    const { unmount } = render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for component to initialize
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    }, { timeout: 1000 });

    const eventSource = MockEventSource.instances[0];
    expect(eventSource.close).not.toHaveBeenCalled();

    // Unmount
    unmount();

    // Should have closed the connection
    expect(eventSource.close).toHaveBeenCalled();
  });

  it('should handle wallet address changes correctly', async () => {
    const { rerender } = render(
      <UserFeedDisplay 
        walletAddress={testWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Wait for initial setup
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    }, { timeout: 1000 });

    const initialEventSource = MockEventSource.instances[0];

    // Change wallet address
    const newWalletAddress = 'ABC123456789ABC123456789ABC123456789ABC123456789';
    rerender(
      <UserFeedDisplay 
        walletAddress={newWalletAddress} 
        isMyProfile={false} 
      />
    );

    // Should close old connection and create new one
    await waitFor(() => {
      expect(initialEventSource.close).toHaveBeenCalled();
      expect(MockEventSource.totalCreated).toBe(2);
    }, { timeout: 1000 });
  });
});