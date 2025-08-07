import '@testing-library/jest-dom';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
import { jest, expect } from '@jest/globals';

// Polyfills for Next.js and Web APIs
global.TextEncoder = NodeTextEncoder;
global.TextDecoder = NodeTextDecoder as typeof global.TextDecoder;

// ReadableStream polyfill for Node.js environment
class MockReadableStream {
  constructor(underlyingSource?: any) {
    this.underlyingSource = underlyingSource;
  }
  
  private underlyingSource: any;
  
  getReader() {
    return {
      read: () => Promise.resolve({ done: true, value: undefined }),
      releaseLock: () => {},
      closed: Promise.resolve(undefined)
    };
  }
  
  cancel() {
    return Promise.resolve();
  }
  
  pipeTo() {
    return Promise.resolve();
  }
  
  pipeThrough() {
    return this;
  }
  
  tee() {
    return [this, this];
  }
}

class MockWritableStream {
  write = jest.fn();
  close = jest.fn();
  abort = jest.fn();
}

global.ReadableStream = MockReadableStream as any;
global.WritableStream = MockWritableStream as any;

// Additional Web API polyfills
global.TransformStream = class MockTransformStream {
  readable = new MockReadableStream();
  writable = new MockWritableStream();
} as any;

// Mock Request for Next.js API routes
export class MockRequest {
  public url: string;
  public method: string;
  public headers: Headers;
  public body: ReadableStream<Uint8Array> | null;
  public bodyUsed: boolean;

  constructor(input: string | URL, init?: RequestInit) {
    this.url = typeof input === 'string' ? input : input.toString();
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers);
    this.body = null;
    this.bodyUsed = false;
  }

  json(): Promise<any> {
    this.bodyUsed = true;
    return Promise.resolve({});
  }

  text(): Promise<string> {
    this.bodyUsed = true;
    return Promise.resolve('');
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    this.bodyUsed = true;
    return Promise.resolve(new ArrayBuffer(0));
  }

  blob(): Promise<Blob> {
    this.bodyUsed = true;
    return Promise.resolve(new Blob());
  }

  formData(): Promise<FormData> {
    this.bodyUsed = true;
    return Promise.resolve(new FormData());
  }

  clone(): MockRequest {
    return new MockRequest(this.url, {
      method: this.method,
      headers: Object.fromEntries(this.headers.entries())
    });
  }
}

global.Request = MockRequest as unknown as typeof Request;

// Mock AbortController
export class MockAbortController {
  signal = { aborted: false };
  abort() {
    this.signal.aborted = true;
  }
}

global.AbortController = MockAbortController as unknown as typeof AbortController;

// Mock Response, Request, and Headers for fetch API
export class MockResponse {
  private bodyContent: string;
  public status: number;
  public statusText: string;
  public headers: Headers;
  public ok: boolean;
  public redirected: boolean;
  public type: ResponseType;
  public url: string;
  public bodyUsed: boolean;
  public readable: ReadableStream<Uint8Array> | null;
  public body: ReadableStream<Uint8Array> | null;
  public bytes: () => Promise<Uint8Array>;

  constructor(body: string | object, init?: { status?: number; statusText?: string; headers?: Record<string, string>, url?: string }) {
    this.bodyContent = typeof body === 'string' ? body : JSON.stringify(body);
    this.status = init?.status ?? 200;
    this.statusText = init?.statusText ?? '';
    this.headers = new Headers(init?.headers);
    this.ok = this.status >= 200 && this.status < 300;
    this.redirected = false;
    this.type = 'default';
    this.url = init?.url ?? '';
    this.bodyUsed = false;
    this.readable = null;
    this.body = null;
    this.bytes = () => {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(this.bodyContent);
      return Promise.resolve(encoded);
    };
  }

  // Static method for NextResponse.json compatibility
  static json(data: any, init?: { status?: number; statusText?: string; headers?: Record<string, string> }) {
    return new MockResponse(data, init);
  }

  json(): Promise<any> {
    this.bodyUsed = true;
    return Promise.resolve(JSON.parse(this.bodyContent));
  }

  text(): Promise<string> {
    this.bodyUsed = true;
    return Promise.resolve(this.bodyContent);
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    this.bodyUsed = true;
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(this.bodyContent);
    const arrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
    return Promise.resolve(arrayBuffer as ArrayBuffer);
  }

  blob(): Promise<Blob> {
    this.bodyUsed = true;
    return Promise.resolve(new Blob([this.bodyContent]));
  }

  formData(): Promise<FormData> {
    this.bodyUsed = true;
    const formData = new FormData();
    try {
      const json = JSON.parse(this.bodyContent);
      for (const key in json) {
        if (Object.prototype.hasOwnProperty.call(json, key)) {
          formData.append(key, json[key]);
        }
      }
    } catch (e) {
      // If body is not JSON, append the entire body as a single field
      formData.append('body', this.bodyContent);
    }
    return Promise.resolve(formData);
  }

  clone(): MockResponse {
    return new MockResponse(this.bodyContent, {
      status: this.status,
      statusText: this.statusText,
      headers: Object.fromEntries(this.headers.entries())
    });
  }
}

global.Response = MockResponse as unknown as typeof Response;
global.Headers = class Headers {
  private headers: Record<string, string>;

  constructor(init?: Record<string, string>) {
    this.headers = init || {};
  }

  get(name: string): string | null {
    return this.headers[name.toLowerCase()] || null;
  }

  set(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  entries(): IterableIterator<[string, string]> {
    return Object.entries(this.headers)[Symbol.iterator]();
  }
} as unknown as typeof Headers;

// Mock Next.js router
type RouterFunction = (...args: any[]) => void;
const mockRouter = {
  push: jest.fn<RouterFunction>(),
  replace: jest.fn<RouterFunction>(),
  prefetch: jest.fn<RouterFunction>(),
  back: jest.fn<RouterFunction>(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '',
}));

// Mock Solana Connection - fix initialization order
type AsyncFunction<T> = (...args: any[]) => Promise<T>;

// Pre-define the mock connection before using it
const mockConnectionMethods = {
  getBlockHeight: jest.fn(() => Promise.resolve(100)),
  getProgramAccounts: jest.fn(() => Promise.resolve([])),
  getTransaction: jest.fn(() => Promise.resolve({
    meta: { err: null },
    transaction: { message: { instructions: [] } }
  })),
  getParsedAccountInfo: jest.fn(() => Promise.resolve({
    value: null
  })),
  getVoteAccounts: jest.fn(() => Promise.resolve({ current: [], delinquent: [] })),
  getMinimumBalanceForRentExemption: jest.fn(() => Promise.resolve(2282880)),
  getBalance: jest.fn(() => Promise.resolve(5000000000)),
  getLatestBlockhash: jest.fn(() => Promise.resolve({
    blockhash: 'test_blockhash',
    lastValidBlockHeight: 1000
  })),
  confirmTransaction: jest.fn(() => Promise.resolve({ value: { err: null } })),
  getTokenAccountBalance: jest.fn(() => Promise.resolve({
    value: { amount: '150000000000', decimals: 6 }
  })),
  getParsedProgramAccounts: jest.fn(() => Promise.resolve([])),
};

// Export the mock connection for use in tests
export const mockConnection = mockConnectionMethods;

// Type for PublicKey mock
type PublicKeyMock = {
  toString: () => string;
  toBase58: () => string;
};

type PublicKeyConstructor = (key: string) => PublicKeyMock;

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => mockConnectionMethods),
  PublicKey: jest.fn().mockImplementation((key: any) => ({
    toString: () => key,
    toBase58: () => key,
    toBuffer: () => Buffer.from(key)
  })) as any,
  Transaction: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    recentBlockhash: '',
    feePayer: null
  })),
  StakeProgram: {
    programId: 'Stake11111111111111111111111111111111111111',
    space: 200,
    initialize: jest.fn(),
    delegate: jest.fn()
  },
  SystemProgram: {
    createAccountWithSeed: jest.fn(),
    transfer: jest.fn(),
    createAccount: jest.fn()
  },
  Authorized: jest.fn(),
  Lockup: jest.fn(),
  LAMPORTS_PER_SOL: 1000000000,
  findProgramAddress: jest.fn(() => Promise.resolve([
    { toBase58: () => 'mock_pda' },
    255
  ]))
}));

// Mock rate limiter
const mockRateLimit = {
  check: jest.fn<AsyncFunction<boolean>>().mockResolvedValue(true),
};

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: () => mockRateLimit,
}));

// Test utilities
export const TEST_ENDPOINTS = {
  local: 'http://localhost:8899',
  devnet: 'https://api.devnet.solana.com',
  mockRPC: 'mock://solana',
} as const;

export const fixtures = {
  nftCollections: [
    {
      address: 'DGNAqCCHypUq5kQhRhxXpUj9H1yBj7iGZUmDgqJBVhMV',
      name: 'Degen Apes',
      symbol: 'DAPE',
      mintDate: '2025-01-27',
      image: 'https://example.com/dape.png',
    },
    {
      address: 'SMNKqxEVjmqmEuEYHzKVTKLPGWpwHkxRTxkGJhBhxVi',
      name: 'Solana Monke',
      symbol: 'SMONK',
      mintDate: '2025-01-26',
      image: 'https://example.com/smonk.png',
    },
  ],
  tokenDetails: {
    decimals: 9,
    supply: '1000000000',
    volume: '50000',
  },
} as const;

// Mock fetch globally
type FetchFunction = typeof fetch;
const mockFetch = jest.fn<FetchFunction>();
global.fetch = mockFetch;

export const mockNetworkConditions = {
  offline: () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
  },
  slow: () => {
    mockFetch.mockImplementation(
      () => new Promise<Response>((resolve) => setTimeout(() => {
        resolve(new MockResponse("{}", {
          status: 200,
          headers: { 'Content-Type': 'application/json', url: '' }
        }) as any);
      }, 2000))
    );
  },
  normal: () => {
    mockFetch.mockResolvedValue(
      new MockResponse("{}", {
        status: 200,
        headers: { 'Content-Type': 'application/json', url: '' }
      }) as any
    );
  },
};

// Custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchPerformanceMetrics: (expected: number, tolerance?: number) => R;
    }
  }
}

expect.extend({
  toMatchPerformanceMetrics(received: number, expected: number, tolerance = 0.05) {
    const pass = Math.abs(received - expected) <= expected * tolerance;
    return {
      pass,
      message: () =>
        `expected ${received} to be within ${tolerance * 100}% of ${expected}`,
    };
  },
});

// Global test cleanup and setup
let activeTimers: Set<any> = new Set();
let activeIntervals: Set<any> = new Set();
let pendingPromises: Set<Promise<any>> = new Set();

// Override timer functions to track active timers
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

global.setTimeout = ((fn: (...args: any[]) => void, delay?: number) => {
  const timerId = originalSetTimeout(fn, delay);
  activeTimers.add(timerId);
  return timerId;
}) as typeof setTimeout;

global.setInterval = ((fn: (...args: any[]) => void, delay?: number) => {
  const intervalId = originalSetInterval(fn, delay);
  activeIntervals.add(intervalId);
  return intervalId;
}) as typeof setInterval;

global.clearTimeout = ((timerId: any) => {
  activeTimers.delete(timerId);
  return originalClearTimeout(timerId);
}) as typeof clearTimeout;

global.clearInterval = ((intervalId: any) => {
  activeIntervals.delete(intervalId);
  return originalClearInterval(intervalId);
}) as typeof clearInterval;

// Track fetch requests
const originalFetch = global.fetch;
global.fetch = (async (...args: Parameters<typeof fetch>) => {
  const promise = originalFetch(...args);
  pendingPromises.add(promise);
  
  try {
    const result = await promise;
    pendingPromises.delete(promise);
    return result;
  } catch (error) {
    pendingPromises.delete(promise);
    throw error;
  }
}) as typeof fetch;

// Global cleanup function
export function cleanupTestResources() {
  // Clear all active timers
  activeTimers.forEach(timerId => {
    try {
      originalClearTimeout(timerId);
    } catch (e) {
      // Ignore errors
    }
  });
  activeTimers.clear();

  // Clear all active intervals
  activeIntervals.forEach(intervalId => {
    try {
      originalClearInterval(intervalId);
    } catch (e) {
      // Ignore errors
    }
  });
  activeIntervals.clear();

  // Clear pending promises (they will resolve/reject naturally)
  pendingPromises.clear();

  // Reset all mocks
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}

// Setup cleanup after each test
afterEach(() => {
  cleanupTestResources();
});

// Setup cleanup before each test
beforeEach(() => {
  // Reset network conditions to normal
  mockNetworkConditions.normal();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled promise rejection:', reason);
  pendingPromises.delete(promise);
});

// Mock console methods that might cause issues in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  // Filter out known harmless errors
  const message = args[0]?.toString() || '';
  if (
    message.includes('ResizeObserver loop limit exceeded') ||
    message.includes('Warning: ReactDOM.render is deprecated') ||
    message.includes('Warning: findDOMNode is deprecated')
  ) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  // Filter out known harmless warnings
  const message = args[0]?.toString() || '';
  if (
    message.includes('componentWillReceiveProps has been renamed') ||
    message.includes('componentWillMount has been renamed')
  ) {
    return;
  }
  originalConsoleWarn(...args);
};
