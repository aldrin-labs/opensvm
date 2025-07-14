# ADR-004: Data Visualization Library Selection

## Status
Accepted

## Context
OpenSVM requires sophisticated data visualization capabilities to display blockchain data effectively. The system needs to:
- Render complex transaction flow graphs with hundreds of nodes
- Display real-time network metrics and charts
- Support interactive visualizations with zoom, pan, and node selection
- Handle large datasets efficiently
- Integrate well with React and TypeScript
- Provide customizable styling and themes

## Decision
We will use D3.js as the primary data visualization library, with support for additional specialized libraries like Three.js for 3D visualizations and Chart.js for standard charts.

## Consequences

### Positive
- **Flexibility**: D3.js provides complete control over visualization appearance and behavior
- **Performance**: Efficient handling of large datasets with SVG and Canvas rendering
- **Ecosystem**: Large ecosystem of D3.js plugins and extensions
- **Customization**: Full control over styling, animations, and interactions
- **React Integration**: Good integration patterns with React components
- **Community**: Strong community support and extensive documentation

### Negative
- **Learning Curve**: Steep learning curve for developers new to D3.js
- **Development Time**: More time-intensive than using pre-built chart libraries
- **Maintenance**: More complex code to maintain compared to simpler alternatives
- **Bundle Size**: Larger bundle size when including multiple D3.js modules

## Alternatives Considered

### Chart.js
- **Pros**: Easy to use, good React integration, smaller learning curve
- **Cons**: Limited customization, not suitable for complex graph visualizations
- **Rejection Reason**: Insufficient for complex transaction flow graphs

### Recharts
- **Pros**: React-native, good TypeScript support, easy to use
- **Cons**: Limited to standard chart types, no support for custom graph layouts
- **Rejection Reason**: Cannot handle complex network visualizations

### Cytoscape.js
- **Pros**: Excellent for graph visualization, good performance
- **Cons**: Limited to graph visualizations, separate learning curve
- **Rejection Reason**: Too specialized, prefer unified solution

### Plotly.js
- **Pros**: Feature-rich, good performance, web-based
- **Cons**: Large bundle size, less customization control
- **Rejection Reason**: Overkill for our specific use cases

## Implementation Details

### D3.js Integration Pattern
```typescript
/**
 * D3.js integration with React components
 * @see docs/architecture/components.md#transaction-components
 */

interface TransactionGraphProps {
  data: TransactionData;
  onNodeClick: (node: Node) => void;
}

const TransactionGraph: React.FC<TransactionGraphProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    
    // D3.js visualization logic
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));
    
    // Render nodes and links
    const node = svg.selectAll('.node')
      .data(nodes)
      .enter().append('circle')
      .attr('class', 'node')
      .attr('r', 8)
      .on('click', (event, d) => onNodeClick(d));
    
    // Update positions on simulation tick
    simulation.on('tick', () => {
      node.attr('cx', d => d.x).attr('cy', d => d.y);
    });
    
  }, [data, onNodeClick]);
  
  return (
    <svg ref={svgRef} width={800} height={600}>
      {/* D3.js will populate this SVG */}
    </svg>
  );
};
```

### Modular D3.js Usage
```typescript
// Import only needed D3.js modules to reduce bundle size
import { select } from 'd3-selection';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';

// Custom D3.js utilities
export const d3Utils = {
  createForceSimulation: (nodes: Node[], links: Link[]) => {
    return forceSimulation(nodes)
      .force('link', forceLink(links).id(d => d.id))
      .force('charge', forceManyBody().strength(-300))
      .force('center', forceCenter(400, 300));
  },
  
  createColorScale: (categories: string[]) => {
    return scaleOrdinal(schemeCategory10).domain(categories);
  }
};
```

### Performance Optimizations
```typescript
// Canvas rendering for large datasets
const CanvasTransactionGraph = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    
    // Use D3.js with Canvas instead of SVG for better performance
    const simulation = d3.forceSimulation(nodes)
      .on('tick', () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw links
        links.forEach(link => {
          context.beginPath();
          context.moveTo(link.source.x, link.source.y);
          context.lineTo(link.target.x, link.target.y);
          context.stroke();
        });
        
        // Draw nodes
        nodes.forEach(node => {
          context.beginPath();
          context.arc(node.x, node.y, 8, 0, 2 * Math.PI);
          context.fill();
        });
      });
    
  }, [data]);
  
  return <canvas ref={canvasRef} width={800} height={600} />;
};
```

### Specialized Visualization Libraries

#### Three.js for 3D Visualizations
```typescript
// 3D transaction visualization
const Transaction3DGraph = ({ data }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!mountRef.current) return;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 800/600, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    
    renderer.setSize(800, 600);
    mountRef.current.appendChild(renderer.domElement);
    
    // Create 3D visualization
    // ... Three.js implementation
    
  }, [data]);
  
  return <div ref={mountRef} />;
};
```

#### Chart.js for Standard Charts
```typescript
// Standard charts for metrics
const NetworkMetricsChart = ({ data }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!chartRef.current) return;
    
    const chart = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'TPS',
          data: data.tps,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
    
    return () => chart.destroy();
  }, [data]);
  
  return <canvas ref={chartRef} />;
};
```

## Integration Considerations

### React Integration Patterns
- **Ref-based Integration**: Use React refs to access DOM elements for D3.js manipulation
- **State Synchronization**: Sync React state with D3.js visualization state
- **Event Handling**: Bridge D3.js events to React event handlers
- **Component Lifecycle**: Properly clean up D3.js resources on component unmount

### TypeScript Integration
- **Type Definitions**: Use @types/d3 for complete type safety
- **Custom Types**: Define custom types for visualization data structures
- **Generic Components**: Create reusable, type-safe visualization components

### Performance Considerations
- **Selective Updates**: Only update parts of the visualization that have changed
- **Debouncing**: Debounce expensive operations like layout calculations
- **Virtual Scrolling**: For large datasets, implement virtual scrolling
- **Canvas Fallback**: Use Canvas rendering for datasets with >1000 elements

## Testing Strategy

### Unit Testing
```typescript
// Test D3.js utilities
describe('d3Utils', () => {
  it('creates force simulation with correct forces', () => {
    const nodes = [{ id: '1' }, { id: '2' }];
    const links = [{ source: '1', target: '2' }];
    
    const simulation = d3Utils.createForceSimulation(nodes, links);
    
    expect(simulation.nodes()).toEqual(nodes);
    expect(simulation.force('link')).toBeDefined();
    expect(simulation.force('charge')).toBeDefined();
    expect(simulation.force('center')).toBeDefined();
  });
});
```

### Integration Testing
```typescript
// Test React-D3.js integration
describe('TransactionGraph', () => {
  it('renders nodes and links correctly', () => {
    const mockData = {
      nodes: [{ id: '1' }, { id: '2' }],
      links: [{ source: '1', target: '2' }]
    };
    
    render(<TransactionGraph data={mockData} onNodeClick={jest.fn()} />);
    
    // Test that D3.js elements are created
    expect(document.querySelectorAll('.node')).toHaveLength(2);
    expect(document.querySelectorAll('.link')).toHaveLength(1);
  });
});
```

## Future Enhancements

### Planned Improvements
- **WebGL Rendering**: For extremely large datasets
- **Progressive Enhancement**: Graceful degradation for older browsers
- **Accessibility**: Better screen reader support for visualizations
- **Mobile Optimization**: Touch-friendly interactions for mobile devices

### Advanced Features
- **Collaborative Editing**: Real-time collaborative visualization editing
- **Export Functionality**: Export visualizations as images or interactive HTML
- **Animation Library**: Custom animation library for smooth transitions
- **VR/AR Support**: Virtual and augmented reality visualization modes

## References
- [D3.js Documentation](https://d3js.org/)
- [React + D3.js Integration Patterns](https://2019.wattenberger.com/blog/react-and-d3)
- [Three.js Documentation](https://threejs.org/docs/)
- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [Performance Best Practices](../performance.md)

---

*Last Updated: 2024-01-XX*
*Next Review: 2024-06-XX*