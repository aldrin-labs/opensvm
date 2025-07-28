import '@testing-library/jest-dom';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
import { jest, expect } from '@jest/globals';

// Polyfills for Next.js and Web APIs
global.TextEncoder = NodeTextEncoder;
global.TextDecoder = NodeTextDecoder as typeof global.TextDecoder;

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

// Mock Solana Connection
type AsyncFunction<T> = (...args: any[]) => Promise<T>;
const mockConnection = {
  getBlockHeight: jest.fn<AsyncFunction<number>>().mockResolvedValue(100),
  getProgramAccounts: jest.fn<AsyncFunction<any[]>>().mockResolvedValue([]),
};

// Type for PublicKey mock
type PublicKeyMock = {
  toString: () => string;
  toBase58: () => string;
};

type PublicKeyConstructor = (key: string) => PublicKeyMock;

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => mockConnection),
  PublicKey: jest.fn<PublicKeyConstructor>().mockImplementation((key: string) => ({
    toString: () => key,
    toBase58: () => key,
  })),
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
