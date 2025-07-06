# Development Guidelines

This document outlines development standards and best practices for the OpenSVM project, ensuring consistency, maintainability, and quality across the codebase.

## Code Style and Standards

### TypeScript Guidelines

#### Strict Type Safety
```typescript
// ✅ Good: Use strict types
interface TransactionData {
  signature: string;
  slot: number;
  blockTime: number | null;
  meta: TransactionMeta;
}

// ❌ Avoid: Using 'any' type
interface BadTransactionData {
  signature: any;
  slot: any;
  meta: any;
}
```

#### Interface Design
```typescript
// ✅ Good: Clear, specific interfaces
interface TransactionTableProps {
  transactions: TransactionData[];
  sortBy: 'signature' | 'timestamp' | 'slot';
  sortOrder: 'asc' | 'desc';
  onSort: (field: string, order: 'asc' | 'desc') => void;
  onRowClick: (transaction: TransactionData) => void;
}

// ✅ Good: Use generic types appropriately
interface TableProps<T> {
  data: T[];
  columns: ColumnDefinition<T>[];
  onRowClick: (item: T) => void;
}
```

#### Error Handling
```typescript
// ✅ Good: Specific error types
class SolanaRPCError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = 'SolanaRPCError';
  }
}

// ✅ Good: Result types for error handling
type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

async function fetchAccountData(address: string): Promise<Result<AccountData, SolanaRPCError>> {
  try {
    const data = await connection.getAccountInfo(new PublicKey(address));
    return { success: true, data: processAccountData(data) };
  } catch (error) {
    return { 
      success: false, 
      error: new SolanaRPCError(
        'Failed to fetch account data',
        -1,
        connection.rpcEndpoint
      )
    };
  }
}
```

### React Component Guidelines

#### Component Structure
```typescript
/**
 * Component documentation following architectural patterns
 * @see docs/architecture/components.md#component-best-practices
 */

interface ComponentProps {
  // Props interface
}

interface ComponentState {
  // State interface if needed
}

// ✅ Good: Functional component with proper typing
const MyComponent: React.FC<ComponentProps> = ({ 
  prop1, 
  prop2, 
  onAction 
}) => {
  // Hooks at the top
  const [state, setState] = useState<ComponentState>({});
  const { data, loading, error } = useCustomHook();
  
  // Event handlers
  const handleClick = useCallback((event: React.MouseEvent) => {
    // Handle click
    onAction(event);
  }, [onAction]);
  
  // Derived state
  const processedData = useMemo(() => {
    return expensiveComputation(data);
  }, [data]);
  
  // Early returns for loading/error states
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  // Main render
  return (
    <div className="component-container">
      {processedData.map(item => (
        <ItemComponent 
          key={item.id} 
          item={item} 
          onClick={handleClick}
        />
      ))}
    </div>
  );
};

export default MyComponent;
```

#### Custom Hooks
```typescript
/**
 * Custom hook for transaction data fetching
 * @see docs/architecture/components.md#custom-hooks
 */

interface UseTransactionDataResult {
  data: TransactionData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useTransactionData(signature: string): UseTransactionDataResult {
  const [data, setData] = useState<TransactionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const transaction = await fetchTransaction(signature);
      setData(transaction);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [signature]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return { data, loading, error, refetch: fetchData };
}
```

### CSS and Styling Guidelines

#### Tailwind CSS Usage
```typescript
// ✅ Good: Semantic class combinations
const TransactionCard = ({ transaction, status }) => (
  <div className={cn(
    // Base styles
    "rounded-lg border p-4 shadow-sm",
    // Conditional styles
    status === 'confirmed' && "border-green-200 bg-green-50",
    status === 'failed' && "border-red-200 bg-red-50",
    status === 'pending' && "border-yellow-200 bg-yellow-50",
    // Interactive styles
    "hover:shadow-md transition-shadow duration-200"
  )}>
    {/* Content */}
  </div>
);

// ✅ Good: Custom CSS classes for complex styles
// In CSS file
.transaction-flow-chart {
  @apply relative overflow-hidden;
}

.transaction-node {
  @apply cursor-pointer transition-all duration-200;
  @apply hover:scale-110 hover:shadow-lg;
}

.transaction-link {
  @apply stroke-current opacity-60;
  @apply hover:opacity-100;
}
```

#### Responsive Design
```typescript
// ✅ Good: Mobile-first responsive design
const ResponsiveTable = () => (
  <div className="w-full overflow-x-auto">
    <table className="min-w-full">
      <thead className="hidden md:table-header-group">
        {/* Desktop headers */}
      </thead>
      <tbody>
        {data.map(item => (
          <tr key={item.id} className="block md:table-row border-b md:border-none">
            <td className="block md:table-cell p-2 md:p-4">
              {/* Responsive cell content */}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

## Performance Guidelines

### Component Optimization

#### Memoization
```typescript
// ✅ Good: Proper memoization usage
const ExpensiveComponent = memo(({ data, onUpdate }) => {
  const processedData = useMemo(() => {
    return expensiveComputation(data);
  }, [data]);
  
  const handleUpdate = useCallback((id: string, value: any) => {
    onUpdate(id, value);
  }, [onUpdate]);
  
  return (
    <div>
      {processedData.map(item => (
        <MemoizedItem 
          key={item.id}
          item={item}
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  );
});

const MemoizedItem = memo(({ item, onUpdate }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison function if needed
  return prevProps.item.id === nextProps.item.id &&
         prevProps.item.lastModified === nextProps.item.lastModified;
});
```

#### Virtual Scrolling
```typescript
// ✅ Good: Virtual scrolling for large datasets
const VirtualizedTransactionList = ({ transactions }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const itemHeight = 60; // Estimated item height
      const containerHeight = container.clientHeight;
      
      const start = Math.floor(scrollTop / itemHeight);
      const end = Math.min(
        start + Math.ceil(containerHeight / itemHeight) + 5,
        transactions.length
      );
      
      setVisibleRange({ start, end });
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [transactions.length]);
  
  const visibleTransactions = transactions.slice(
    visibleRange.start, 
    visibleRange.end
  );
  
  return (
    <div ref={containerRef} className="h-96 overflow-y-auto">
      <div style={{ height: visibleRange.start * 60 }} />
      {visibleTransactions.map(tx => (
        <TransactionItem key={tx.signature} transaction={tx} />
      ))}
      <div style={{ 
        height: (transactions.length - visibleRange.end) * 60 
      }} />
    </div>
  );
};
```

### Data Fetching Optimization

#### Caching Strategy
```typescript
// ✅ Good: Intelligent caching with TTL
class DataCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; ttl: number }>();
  
  set(key: string, data: T, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Usage in service
const transactionCache = new DataCache<TransactionData>();

async function fetchTransactionWithCache(signature: string): Promise<TransactionData> {
  const cached = transactionCache.get(signature);
  if (cached) return cached;
  
  const data = await fetchTransaction(signature);
  transactionCache.set(signature, data);
  
  return data;
}
```

#### Request Batching
```typescript
// ✅ Good: Batch multiple requests
class RequestBatcher {
  private batches = new Map<string, Promise<any>>();
  private batchSize = 100;
  private batchDelay = 50; // ms
  
  async batchRequest<T>(
    key: string,
    items: string[],
    fetcher: (batch: string[]) => Promise<T[]>
  ): Promise<T[]> {
    const existingBatch = this.batches.get(key);
    if (existingBatch) {
      return existingBatch;
    }
    
    const batchPromise = this.createBatch(items, fetcher);
    this.batches.set(key, batchPromise);
    
    // Clean up after batch completes
    batchPromise.finally(() => {
      this.batches.delete(key);
    });
    
    return batchPromise;
  }
  
  private async createBatch<T>(
    items: string[],
    fetcher: (batch: string[]) => Promise<T[]>
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      const batchResults = await fetcher(batch);
      results.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming the API
      if (i + this.batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }
    
    return results;
  }
}
```

## Testing Guidelines

### Unit Testing Best Practices

#### Component Testing
```typescript
// ✅ Good: Comprehensive component testing
describe('TransactionTable', () => {
  const mockTransactions = [
    { signature: 'abc123', slot: 1000, status: 'confirmed' },
    { signature: 'def456', slot: 1001, status: 'failed' }
  ];
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders transactions correctly', () => {
    render(
      <TransactionTable 
        transactions={mockTransactions}
        onSort={jest.fn()}
        onRowClick={jest.fn()}
      />
    );
    
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('def456')).toBeInTheDocument();
  });
  
  it('handles sorting when column header is clicked', () => {
    const onSort = jest.fn();
    
    render(
      <TransactionTable 
        transactions={mockTransactions}
        onSort={onSort}
        onRowClick={jest.fn()}
      />
    );
    
    fireEvent.click(screen.getByText('Signature'));
    
    expect(onSort).toHaveBeenCalledWith('signature', 'asc');
  });
  
  it('calls onRowClick when row is clicked', () => {
    const onRowClick = jest.fn();
    
    render(
      <TransactionTable 
        transactions={mockTransactions}
        onSort={jest.fn()}
        onRowClick={onRowClick}
      />
    );
    
    fireEvent.click(screen.getByText('abc123'));
    
    expect(onRowClick).toHaveBeenCalledWith(mockTransactions[0]);
  });
});
```

#### Service Testing
```typescript
// ✅ Good: Service layer testing with mocks
describe('SolanaService', () => {
  let service: SolanaService;
  let mockConnection: jest.Mocked<Connection>;
  
  beforeEach(() => {
    mockConnection = {
      getAccountInfo: jest.fn(),
      getTransaction: jest.fn(),
      // ... other methods
    } as any;
    
    service = new SolanaService(mockConnection);
  });
  
  describe('getAccountData', () => {
    it('returns account data for valid address', async () => {
      const mockAccountInfo = {
        lamports: 1000000,
        owner: new PublicKey('11111111111111111111111111111111'),
        executable: false,
        data: Buffer.from([])
      };
      
      mockConnection.getAccountInfo.mockResolvedValue(mockAccountInfo);
      
      const result = await service.getAccountData('valid-address');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lamports).toBe(1000000);
      }
    });
    
    it('handles errors gracefully', async () => {
      mockConnection.getAccountInfo.mockRejectedValue(
        new Error('Network error')
      );
      
      const result = await service.getAccountData('invalid-address');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Network error');
      }
    });
  });
});
```

### Integration Testing

#### API Route Testing
```typescript
// ✅ Good: API route integration testing
describe('/api/solana-rpc', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });
  
  it('returns account data for valid request', async () => {
    const request = new NextRequest('http://localhost:3000/api/solana-rpc', {
      method: 'POST',
      body: JSON.stringify({
        method: 'getAccountInfo',
        params: ['valid-address']
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.result).toBeDefined();
  });
  
  it('handles invalid requests', async () => {
    const request = new NextRequest('http://localhost:3000/api/solana-rpc', {
      method: 'POST',
      body: JSON.stringify({
        method: 'invalidMethod',
        params: []
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});
```

## Security Guidelines

### Input Validation
```typescript
// ✅ Good: Comprehensive input validation
import { z } from 'zod';

const AddressSchema = z.string()
  .min(32, 'Address too short')
  .max(44, 'Address too long')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid Base58 format');

const TransactionSignatureSchema = z.string()
  .length(88, 'Invalid signature length')
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid Base58 format');

// Validation middleware
export function validateInput<T>(schema: z.ZodSchema<T>) {
  return (input: unknown): T => {
    try {
      return schema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid input',
          error.errors.map(e => e.message).join(', ')
        );
      }
      throw error;
    }
  };
}

// Usage in API routes
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const address = validateInput(AddressSchema)(url.searchParams.get('address'));
    
    // Process validated input
    const accountData = await getAccountData(address);
    
    return NextResponse.json(accountData);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Error Handling
```typescript
// ✅ Good: Secure error handling
class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends AppError {
  constructor(message: string, public readonly details?: string) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

// Error handler middleware
export function handleError(error: Error): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { 
        error: error.message,
        ...(error instanceof ValidationError && { details: error.details })
      },
      { status: error.statusCode }
    );
  }
  
  // Log unexpected errors but don't expose details
  console.error('Unexpected error:', error);
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

## Documentation Standards

### Code Documentation
```typescript
/**
 * Fetches and processes transaction data from Solana blockchain
 * 
 * This function retrieves transaction information, validates the data,
 * and transforms it into a standardized format for the application.
 * 
 * @param signature - Base58 encoded transaction signature
 * @param options - Optional configuration for data fetching
 * @returns Promise resolving to processed transaction data
 * 
 * @throws {ValidationError} When signature format is invalid
 * @throws {NotFoundError} When transaction is not found
 * @throws {SolanaRPCError} When RPC request fails
 * 
 * @example
 * ```typescript
 * const transaction = await fetchTransactionData(
 *   'abc123...',
 *   { includeInnerInstructions: true }
 * );
 * 
 * console.log(transaction.signature); // 'abc123...'
 * console.log(transaction.slot); // 12345
 * ```
 * 
 * @see docs/architecture/system-overview.md#blockchain-integration-layer
 * @see docs/architecture/data-flow.md#transaction-processing
 */
async function fetchTransactionData(
  signature: string,
  options: FetchOptions = {}
): Promise<TransactionData> {
  // Implementation...
}
```

### README Documentation
```markdown
# Component Name

Brief description of what this component does.

## Usage

```typescript
import { ComponentName } from './ComponentName';

<ComponentName 
  prop1="value1"
  prop2={value2}
  onAction={handleAction}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `prop1` | `string` | Yes | Description of prop1 |
| `prop2` | `number` | No | Description of prop2 |

## Architecture

This component follows the [Component Architecture](../../docs/architecture/components.md) patterns.

## Testing

Run tests with:
```bash
npm test ComponentName
```
```

---

*These development guidelines should be followed for all new code and used as a reference when refactoring existing code.*