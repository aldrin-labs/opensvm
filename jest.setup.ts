import '@testing-library/jest-dom';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
import { jest, expect } from '@jest/globals';

// Mock server-only package to allow tests to run
jest.mock('server-only', () => ({}));

// Polyfills for Next.js and Web APIs
global.TextEncoder = NodeTextEncoder as unknown as typeof global.TextEncoder;
global.TextDecoder = NodeTextDecoder as typeof global.TextDecoder;

// Mock Web Crypto API for Solana operations
const mockCrypto = {
  subtle: {
    digest: jest.fn().mockImplementation(async (...args: any[]) => {
      // Mock SHA-256 hash - return a consistent 32-byte array for testing
      const algorithm = args[0];
      const data = args[1];
      const mockHash = new Uint8Array(32);
      // Fill with deterministic values based on input
      const input = new Uint8Array(data);
      for (let i = 0; i < 32; i++) {
        mockHash[i] = (input[i % input.length] || 0) + i;
      }
      return Promise.resolve(mockHash.buffer);
    }),
    generateKey: jest.fn(),
    importKey: jest.fn(),
    exportKey: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    deriveBits: jest.fn(),
    deriveKey: jest.fn(),
  },
  getRandomValues: jest.fn().mockImplementation((...args: any[]) => {
    // Fill with deterministic pseudo-random values for testing
    const array = args[0];
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
};

// Ensure global crypto is properly set with fallback
global.crypto = mockCrypto as any;

// Add additional fallback for Web Crypto API access
if (!global.crypto) {
  global.crypto = mockCrypto as any;
}

// Override any existing crypto to ensure our mock is used
Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true,
  configurable: true
});

// Backup fallback - assign to window if it exists
if (typeof window !== 'undefined') {
  (window as any).crypto = mockCrypto;
}

// ReadableStream polyfill for Node.js environment
class MockReadableStream {
  constructor(underlyingSource?: any) {
    this.underlyingSource = underlyingSource;
  }

  private underlyingSource: any;

  getReader() {
    return {
      read: () => Promise.resolve({ done: true, value: undefined }),
      releaseLock: () => { },
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

// Polyfill ResizeObserver for tests (needed by ChatUI and other components relying on layout measurement)
if (typeof global.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe() { /* no-op */ }
    unobserve() { /* no-op */ }
    disconnect() { /* no-op */ }
  }
  // Assign to both global and window (if window exists)
  (global as any).ResizeObserver = MockResizeObserver;
  if (typeof window !== 'undefined') {
    (window as any).ResizeObserver = MockResizeObserver;
  }
}

 // Mock Request for Next.js API routes (enhanced to preserve JSON body for tests)
 export class MockRequest {
   public url: string;
   public method: string;
   public headers: Headers;
   public body: ReadableStream<Uint8Array> | null;
   public bodyUsed: boolean;
   private _rawBody?: string;
   private _jsonCache: any | undefined;
 
   constructor(input: string | URL, init?: RequestInit) {
     this.url = typeof input === 'string' ? input : input.toString();
     this.method = init?.method || 'GET';
     this.headers = new Headers(init?.headers);
     this.body = null; // We don't simulate streaming; route under test uses json()/text()
     this.bodyUsed = false;
 
     // Capture provided body (tests pass a string via JSON.stringify)
     const b: any = (init as any)?.body;
     if (typeof b === 'string') {
       this._rawBody = b;
     } else if (b instanceof Uint8Array) {
       this._rawBody = new TextDecoder().decode(b);
     } else if (b && typeof b === 'object') {
       // If an object is passed (unlikely in tests), serialize it
       try {
         this._rawBody = JSON.stringify(b);
       } catch {
         this._rawBody = '';
       }
     } else {
       this._rawBody = '';
     }
   }
 
   async json(): Promise<any> {
     this.bodyUsed = true;
     if (this._jsonCache !== undefined) return this._jsonCache;
     if (!this._rawBody || !this._rawBody.trim()) {
       this._jsonCache = {};
       return this._jsonCache;
     }
     try {
       this._jsonCache = JSON.parse(this._rawBody);
     } catch {
       this._jsonCache = {};
     }
     return this._jsonCache;
   }
 
   async text(): Promise<string> {
     this.bodyUsed = true;
     return this._rawBody || '';
   }
 
   async arrayBuffer(): Promise<ArrayBuffer> {
     this.bodyUsed = true;
     const enc = new TextEncoder();
     const bytes = enc.encode(this._rawBody || '');
     const copy = new Uint8Array(bytes); // ensure plain ArrayBuffer
     return copy.buffer;
   }
 
   async blob(): Promise<Blob> {
     this.bodyUsed = true;
     return new Blob([this._rawBody || '']);
   }
 
   async formData(): Promise<FormData> {
     this.bodyUsed = true;
     const fd = new FormData();
     try {
       const parsed = await this.json();
       if (parsed && typeof parsed === 'object') {
         for (const [k, v] of Object.entries(parsed)) {
           fd.append(k, typeof v === 'string' ? v : JSON.stringify(v));
         }
       }
     } catch {
       fd.append('body', this._rawBody || '');
     }
     return fd;
   }
 
   clone(): MockRequest {
     return new MockRequest(this.url, {
       method: this.method,
       headers: Object.fromEntries(this.headers.entries()),
       body: this._rawBody
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
    const copy = new Uint8Array(uint8Array); // copy to guarantee ArrayBuffer type
    return Promise.resolve(copy.buffer);
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

  constructor(init?: HeadersInit) {
    this.headers = {};

    if (init) {
      if (init instanceof Headers) {
        // Copy from another Headers instance
        for (const [key, value] of init.entries()) {
          this.headers[String(key).toLowerCase()] = String(value);
        }
      } else if (Array.isArray(init)) {
        // Handle array of [name, value] pairs
        for (const pair of init) {
          if (Array.isArray(pair) && pair.length >= 2) {
            this.headers[String(pair[0]).toLowerCase()] = String(pair[1]);
          }
        }
      } else if (typeof init === 'object' && init !== null) {
        // Handle plain object
        for (const [name, value] of Object.entries(init)) {
          this.headers[String(name).toLowerCase()] = String(value);
        }
      }
    }
  }

  get(name: string): string | null {
    return this.headers[name.toLowerCase()] || null;
  }

  set(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  has(name: string): boolean {
    return name.toLowerCase() in this.headers;
  }

  append(name: string, value: string): void {
    const key = String(name).toLowerCase();
    const existingValue = this.headers[key];
    if (existingValue) {
      this.headers[key] = String(existingValue) + ', ' + String(value);
    } else {
      this.headers[key] = String(value);
    }
  }

  delete(name: string): void {
    delete this.headers[name.toLowerCase()];
  }

  forEach(callback: (value: string, name: string, parent: Headers) => void): void {
    for (const [name, value] of this.entries()) {
      callback(value, name, this);
    }
  }

  entries(): IterableIterator<[string, string]> {
    return Object.entries(this.headers)[Symbol.iterator]();
  }

  keys(): IterableIterator<string> {
    return Object.keys(this.headers)[Symbol.iterator]();
  }

  values(): IterableIterator<string> {
    return Object.values(this.headers)[Symbol.iterator]();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
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
  useRouter: jest.fn(() => mockRouter),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/'),
  useParams: jest.fn(() => ({})),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

// Mock AuthContext globally
jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: jest.fn(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    walletAddress: null,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
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
  getParsedTransaction: jest.fn(() => Promise.resolve(null)),
  getParsedAccountInfo: jest.fn(() => Promise.resolve({
    value: null
  })),
  getAccountInfo: jest.fn(() => Promise.resolve(null)),
  getSignaturesForAddress: jest.fn(() => Promise.resolve([])),
  getParsedTokenAccountsByOwner: jest.fn(() => Promise.resolve({ value: [] })),
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

// Create proper PublicKey constructor mock that creates instances
const MockedPublicKey = jest.fn().mockImplementation((key: any) => {
  const instance = Object.create(MockedPublicKey.prototype);
  Object.assign(instance, {
    toString: () => key,
    toBase58: () => key,
    toBuffer: () => Buffer.from(key),
    equals: jest.fn(() => true),
  });
  return instance;
});

// Set up prototype and constructor property for Jest instance checks
MockedPublicKey.prototype.constructor = MockedPublicKey;

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => mockConnectionMethods),
  PublicKey: MockedPublicKey,
  Keypair: {
    fromSeed: jest.fn().mockImplementation((...args: any[]) => {
      const seed = args[0] as Uint8Array;
      return {
        publicKey: new MockedPublicKey(`GeneratedAddress${seed[0]}${seed[1]}${seed[2]}`),
        secretKey: seed
      };
    }),
    generate: jest.fn().mockImplementation(() => ({
      publicKey: new MockedPublicKey('GeneratedRandomAddress'),
      secretKey: new Uint8Array(64)
    }))
  },
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
    new MockedPublicKey('mock_pda'),
    255
  ]))
}));

// Mock SPL Token library
jest.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: jest.fn().mockImplementation(() =>
    Promise.resolve(new MockedPublicKey('mock_associated_token_address'))
  ),
  TOKEN_PROGRAM_ID: new MockedPublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  ASSOCIATED_TOKEN_PROGRAM_ID: new MockedPublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
  createAssociatedTokenAccountInstruction: jest.fn(),
  createTransferInstruction: jest.fn(),
  getAccount: jest.fn(),
  getMint: jest.fn(),
}));

// Add isOnCurve mock to the global object after PublicKey creation
(global as any).web3_js_1 = {
  PublicKey: {
    isOnCurve: jest.fn().mockReturnValue(true)
  }
};

// Mock SVMAIBalanceManager
jest.mock('./lib/anthropic-proxy/billing/SVMAIBalanceManager', () => ({
  SVMAIBalanceManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
    addBalance: jest.fn<(userId: string, amount: number, signature: string) => Promise<any>>().mockImplementation(
      (userId: string, amount: number, signature: string) =>
        Promise.resolve({
          svmaiBalance: amount + 1000, // Mock existing balance + new amount
          availableBalance: amount + 800, // Mock available balance
          lockedBalance: 200,
          lastUpdated: new Date()
        })
    ),
    getBalance: jest.fn<() => Promise<any>>().mockResolvedValue({
      svmaiBalance: 1000,
      availableBalance: 800,
      lockedBalance: 200
    }),
    deductBalance: jest.fn<() => Promise<any>>().mockResolvedValue({
      svmaiBalance: 900,
      availableBalance: 700,
      lockedBalance: 200
    }),
    hasBalance: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    hasSufficientBalance: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  }))
}));

// Mock BalanceStorage
jest.mock('./lib/anthropic-proxy/storage/BalanceStorage', () => ({
  BalanceStorage: jest.fn().mockImplementation(() => ({
    initialize: jest.fn<() => Promise<void>>().mockResolvedValue(undefined as void),
    logTransaction: jest.fn<(transaction: any) => Promise<void>>().mockResolvedValue(undefined as void),
    getTransactionHistory: jest.fn<(userId?: string) => Promise<any[]>>().mockResolvedValue([]),
    getTransactionById: jest.fn<(id: string) => Promise<any>>().mockResolvedValue(null),
    getUserBalance: jest.fn<(userId: string) => Promise<any>>().mockResolvedValue({
      balance: 1000,
      lastUpdated: new Date()
    }),
  }))
}));

// Mock rate limiter
const mockRateLimit = {
  check: jest.fn<AsyncFunction<boolean>>().mockResolvedValue(true),
};

jest.mock('@/lib/middleware/rate-limit', () => ({
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
      toBeOneOf: (expectedValues: any[]) => R;
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
  toBeOneOf(received: any, expectedValues: any[]) {
    const pass = expectedValues.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expectedValues.join(', ')}`
          : `expected ${received} to be one of ${expectedValues.join(', ')}`,
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
