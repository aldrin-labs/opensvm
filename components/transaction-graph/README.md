# Transaction Graph Component Structure

## Directory Organization

```
transaction-graph/
├── TransactionGraph.tsx          # Main graph component
├── GPUAcceleratedForceGraph.tsx  # GPU-accelerated graph renderer
├── TrackingStatsPanel.tsx        # Statistics panel for address tracking
├── hooks/                        # React hooks
│   ├── useAccountFetching.ts     # Account data fetching logic
│   ├── useAddressTracking.ts     # Address tracking functionality
│   ├── useCloudView.ts           # Cloud view state management
│   ├── useFullscreenMode.ts      # Fullscreen mode handling
│   ├── useGPUForceGraph.ts       # GPU graph rendering hooks
│   ├── useGPUGraphSync.ts        # GPU/Cytoscape sync logic
│   ├── useGraphInitialization.ts # Graph initialization logic
│   ├── useLayoutManager.ts       # Graph layout management
│   ├── useViewportNavigation.ts  # Viewport navigation controls
│   └── index.ts                  # Hook exports
├── types/                        # TypeScript type definitions
│   ├── cytoscape-dagre.d.ts     # Cytoscape plugin types
│   └── webgpu.d.ts               # WebGPU API types
├── data-fetching.ts              # API calls and data fetching
├── interaction-handlers.ts       # User interaction handlers
├── layout.ts                     # Layout algorithms
├── type-safe-utils.ts            # Type-safe utility functions
├── gpu-utils.ts                  # GPU rendering utilities
├── adaptive-rendering.ts         # Adaptive rendering logic
├── utils.ts                      # General utilities
├── types.ts                      # Component type definitions
└── index.ts                      # Main exports
```

## Component Responsibilities

### Main Components

- **TransactionGraph.tsx**: Main component that orchestrates the graph visualization
- **GPUAcceleratedForceGraph.tsx**: WebGL/GPU-based force graph renderer for performance
- **TrackingStatsPanel.tsx**: Shows statistics when tracking specific addresses

### Utility Modules

- **data-fetching.ts**: Handles API calls to fetch transaction and account data
- **interaction-handlers.ts**: Manages user interactions (clicks, zoom, pan)
- **layout.ts**: Graph layout algorithms (dagre, force-directed)
- **gpu-utils.ts**: GPU-specific rendering utilities
- **adaptive-rendering.ts**: Switches between rendering modes based on performance

### Hooks

All hooks are in the `hooks/` directory and handle specific functionality:
- Account fetching and caching
- Address tracking and monitoring
- Fullscreen mode
- GPU rendering synchronization
- Graph initialization
- Layout management
- Viewport navigation

### Types

- **types.ts**: Main component prop types and interfaces
- **type-safe-utils.ts**: Type-safe wrappers for browser APIs
- **types/**: Additional type definitions for external libraries

## Usage

```tsx
import TransactionGraph from '@/components/TransactionGraph';

<TransactionGraph
  initialSignature="..."
  onTransactionSelect={(sig) => console.log(sig)}
  maxDepth={2}
/>
```

## Related Components

- **TransactionGraphFilters.tsx**: Filter controls (separate component)
- **TransactionGraphClouds.tsx**: Cloud save/load functionality (separate component) 