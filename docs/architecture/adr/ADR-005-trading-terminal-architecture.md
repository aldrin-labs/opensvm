# ADR-005: Trading Terminal Architecture

**Status:** Accepted  
**Date:** 2025-01-08  
**Deciders:** Development Team  
**Related:** Trading Terminal Feature, AI Chat Widget

## Context

OpenSVM requires a professional trading terminal for Solana DEX trading with:
- Real-time market data visualization
- AI-powered natural language trading interface
- Multiple widget layout system (12 widgets total)
- Keyboard shortcuts for professional traders
- Wallet integration with Phantom
- Responsive design across all screen sizes

The initial implementation embedded all business logic directly in the `TradingTerminalView` component, resulting in:
- 918-line monolithic component
- 8 state variables managed in one place
- No separation of concerns
- Difficult to test individual features
- Hard to reuse logic across components
- Missing error boundaries and proper cleanup

## Decision

We will refactor the trading terminal to follow OpenSVM's modular architecture patterns:

### 1. Modular Hook Extraction

Extract business logic into specialized hooks in `/components/hooks/trading/`:

- **`useTradingTerminal`**: Main state management (tiles, sections, market selection, trade execution)
- **`useKeyboardShortcuts`**: Keyboard navigation and quick actions
- **`useMarketData`**: Real-time market data with WebSocket integration
- **`useWalletConnection`**: Solana wallet connection and balance tracking
- **`useTransactionVisualization`**: Integration with existing transaction-graph hooks

### 2. WebSocket Infrastructure

Create a dedicated WebSocket client class at `/lib/websocket/trading.ts`:

- EventEmitter-based architecture for message handling
- Auto-reconnect with exponential backoff (5 attempts, max 30s delay)
- Ping/pong heartbeat mechanism
- Intentional close detection
- Message parsing and error handling
- State management (connected, reconnecting, error)

### 3. Component Responsibilities

- **TradingTerminalView**: UI rendering, widget layout, dynamic imports
- **Hooks**: Business logic, state management, side effects
- **WebSocket**: Real-time data connection management
- **ErrorBoundary**: Graceful error handling (already exists at `/components/ErrorBoundary.tsx`)

### 4. Integration with Existing Patterns

Follow patterns from the transaction-graph component:
- Modular hooks in `/components/hooks/`
- Utility functions in `/lib/`
- Comprehensive documentation in `/docs/`
- TypeScript strict typing with exported interfaces

## Implementation Details

### Hook Structure

```typescript
// useTradingTerminal.ts
export interface UseTradingTerminalReturn {
  // State
  selectedMarket: string;
  sections: Section[];
  maximizedTile: TileId | null;
  // ...
  
  // Actions
  toggleSection: (id: string) => void;
  toggleMaximize: (tileId: TileId) => void;
  handleTradeExecute: (command: TradeCommand) => void;
  // ...
}
```

### WebSocket Client

```typescript
// trading.ts
export class TradingWebSocket extends EventEmitter {
  connect(): void;
  disconnect(): void;
  send(data: unknown): boolean;
  isConnected(): boolean;
  getState(): Readonly<WebSocketState>;
}
```

### Component Usage

```typescript
// TradingTerminalView.tsx
const terminal = useTradingTerminal('SOL/USDC');
const marketData = useMarketData(terminal.selectedMarket);
const wallet = useWalletConnection();

useKeyboardShortcuts({
  maximizedTile: terminal.maximizedTile,
  toggleMaximize: terminal.toggleMaximize,
  // ...
});
```

## Consequences

### Positive

1. **Modularity**: Each hook has a single responsibility
2. **Testability**: Hooks can be unit tested independently
3. **Reusability**: Hooks can be used in other components (e.g., mobile trading view)
4. **Maintainability**: Smaller, focused code units
5. **Type Safety**: Strong TypeScript interfaces for all hooks
6. **Error Handling**: Proper cleanup and error boundaries
7. **Performance**: Event listener cleanup prevents memory leaks
8. **Professional UX**: Keyboard shortcuts, WebSocket real-time data

### Negative

1. **Complexity**: More files to navigate (6 new hooks + WebSocket class)
2. **Learning Curve**: Developers need to understand hook composition
3. **Initial Effort**: Refactoring existing component takes time
4. **WebSocket Management**: Need to handle reconnection, state sync
5. **Testing Overhead**: More units to test individually

### Neutral

1. **Bundle Size**: ~500 lines of new hook code, negligible impact
2. **Migration Path**: Can refactor incrementally, component-by-component
3. **Documentation**: Need comprehensive hook usage examples

## Future Considerations

1. **Real DEX Integration**: Replace mock data with actual Solana DEX calls
2. **WebSocket Providers**: Support multiple DEX WebSocket APIs (Jupiter, Orca, Raydium)
3. **State Persistence**: Save terminal layout and preferences to localStorage
4. **Multi-Market**: Support multiple simultaneous market connections
5. **Advanced Orders**: Stop-loss, take-profit, OCO orders
6. **Mobile View**: Responsive hooks for mobile trading interface
7. **Performance Monitoring**: Track WebSocket latency, render performance
8. **Error Recovery**: Automatic retry for failed trades

## Implementation Checklist

- [x] Create `/components/hooks/trading/` directory
- [x] Implement `useTradingTerminal` hook
- [x] Implement `useKeyboardShortcuts` hook
- [x] Implement `useMarketData` hook
- [x] Implement `useWalletConnection` hook
- [x] Create `TradingWebSocket` class
- [ ] Refactor `TradingTerminalView` to use hooks
- [ ] Create `useTransactionVisualization` integration hook
- [ ] Write unit tests for hooks
- [ ] Update documentation with usage examples
- [ ] Add integration guide for new developers

## References

- [Trading Terminal User Guide](/AI_CHAT_USER_GUIDE.md)
- [AI Chat Implementation](/AI_CHAT_TRADING_WIDGET_IMPLEMENTATION.md)
- [Transaction Graph README](/components/transaction-graph/README.md)
- [OpenSVM Architecture](/docs/architecture/README.md)
- [React Hooks Best Practices](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## Approval

This ADR has been reviewed and accepted by the development team on 2025-01-08.

**Accepted by:** Development Team  
**Review Date:** 2025-01-08  
**Implementation Target:** Q1 2025
