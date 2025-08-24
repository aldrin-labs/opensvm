# Accessibility Implementation Details

This document provides detailed technical specifications for implementing accessibility improvements in the OpenSVM explorer.

## Audit and Analysis

### Automated Testing Tools
- **Axe DevTools**: For automated accessibility testing
- **Lighthouse**: For overall accessibility scoring
- **WAVE**: For visual identification of accessibility issues

### Manual Testing Procedures
- Screen reader testing with NVDA (Windows) and VoiceOver (macOS)
- Keyboard navigation testing
- Color contrast analysis
- Focus management verification

## Component-Specific Implementation Guidelines

### Base UI Components

#### Button Component (`/components/ui/button.tsx`)

Current issues:
- Missing proper ARIA roles
- Insufficient focus states
- No keyboard event handling for custom buttons

Implementation:
```tsx
// Add proper ARIA attributes and keyboard support
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    // Ensure proper role attribute
    const roleAttribute = asChild ? { role: "button" } : {};
    
    // Add keyboard event handling
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.currentTarget.click();
      }
      
      // Call original onKeyDown if provided
      props.onKeyDown?.(e);
    };
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...roleAttribute}
        onKeyDown={handleKeyDown}
        tabIndex={props.disabled ? -1 : 0}
        aria-disabled={props.disabled}
        {...props}
      />
    );
  }
);
```

#### Input Component (`/components/ui/input.tsx`)

Current issues:
- Missing label associations
- No error states for screen readers
- Missing ARIA attributes

Implementation:
```tsx
// Add proper label associations and ARIA attributes
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, id, error, label, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    
    return (
      <div className="input-wrapper">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium mb-1"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus-visible:ring-red-500",
            className
          )}
          ref={ref}
          id={inputId}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <div 
            id={`${inputId}-error`}
            className="text-red-500 text-sm mt-1"
            role="alert"
          >
            {error}
          </div>
        )}
      </div>
    );
  }
);
```

#### Dropdown Menu Component (`/components/ui/dropdown-menu.tsx`)

Current issues:
- Insufficient keyboard navigation
- Missing ARIA attributes
- No screen reader announcements

Implementation:
```tsx
// Add keyboard navigation and ARIA attributes
const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      // Add ARIA attributes for better screen reader support
      aria-orientation="vertical"
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
```

### Complex Visualization Components

#### Transaction Graph (`/components/transaction-graph/TransactionGraph.tsx`)

Current issues:
- No keyboard navigation for graph elements
- Missing alternative text for visual elements
- No screen reader announcements for data changes

Implementation approach:
1. Add keyboard navigation for nodes and edges
2. Provide text alternatives for graph visualization
3. Implement ARIA live regions for dynamic updates
4. Add focus management for interactive elements

Example implementation for keyboard navigation:
```tsx
// Add keyboard navigation to graph
const handleKeyDown = (e: React.KeyboardEvent, nodeId: string) => {
  const nodes = graphData.nodes;
  const currentIndex = nodes.findIndex(node => node.id === nodeId);
  
  switch (e.key) {
    case 'ArrowRight':
      // Navigate to next node
      if (currentIndex < nodes.length - 1) {
        setFocusedNode(nodes[currentIndex + 1].id);
      }
      break;
    case 'ArrowLeft':
      // Navigate to previous node
      if (currentIndex > 0) {
        setFocusedNode(nodes[currentIndex - 1].id);
      }
      break;
    case 'Enter':
      // Select node
      handleNodeClick(nodes[currentIndex]);
      break;
  }
};

// Add to node rendering
<Node 
  {...nodeProps} 
  tabIndex={0}
  onKeyDown={(e) => handleKeyDown(e, node.id)}
  aria-label={`${node.type} node: ${node.label}`}
/>
```

Example implementation for screen reader announcements:
```tsx
// Add ARIA live region for graph updates
<div 
  className="sr-only" 
  aria-live="polite"
  ref={announcementRef}
>
  {graphAnnouncement}
</div>

// Update announcement when graph changes
useEffect(() => {
  if (graphData.nodes.length > 0) {
    setGraphAnnouncement(
      `Graph updated with ${graphData.nodes.length} nodes and ${graphData.edges.length} connections.`
    );
  }
}, [graphData]);
```

## Testing and Validation

### Automated Testing Implementation

Create accessibility testing utilities in `/utils/a11y/`:

```tsx
// /utils/a11y/testing.ts
import { axe, toHaveNoViolations } from 'jest-axe';

// Add jest-axe custom matcher
expect.extend(toHaveNoViolations);

// Helper function to test component accessibility
export const testAccessibility = async (html: string) => {
  const results = await axe(html);
  expect(results).toHaveNoViolations();
};

// Helper for keyboard navigation testing
export const simulateKeyboardNavigation = async (element: HTMLElement, keys: string[]) => {
  for (const key of keys) {
    const event = new KeyboardEvent('keydown', { key });
    element.dispatchEvent(event);
    // Wait for any effects
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
```

### Jest Test Examples

```tsx
// Example test for button component
import { render, screen } from '@testing-library/react';
import { testAccessibility } from '@/utils/a11y/testing';
import { Button } from '@/components/ui/button';

describe('Button accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Button>Test Button</Button>);
    await testAccessibility(container.innerHTML);
  });
  
  it('should be focusable and activatable with keyboard', async () => {
    const onClickMock = jest.fn();
    render(<Button onClick={onClickMock}>Test Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Test Button' });
    
    // Test focus
    button.focus();
    expect(document.activeElement).toBe(button);
    
    // Test keyboard activation
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onClickMock).toHaveBeenCalled();
  });
});
```

## Documentation Guidelines

### Component Documentation Template

```md
# Component Name

## Accessibility Features

- **Keyboard Support**: Describe how keyboard users can interact with this component
- **Screen Reader Support**: Describe what screen readers will announce
- **ARIA Attributes**: List the ARIA attributes used and their purpose
- **Focus Management**: Describe how focus is handled

## Usage Guidelines

- Provide examples of accessible usage
- Document any required props for accessibility
- Highlight common accessibility pitfalls

## Testing

- Document how to test this component for accessibility
```

## Implementation Checklist

- [ ] Conduct comprehensive accessibility audit
- [ ] Update base UI components with ARIA attributes
- [ ] Implement keyboard navigation for all interactive elements
- [ ] Add screen reader support for visual elements
- [ ] Create accessible alternatives for complex visualizations
- [ ] Implement focus management
- [ ] Add accessibility testing utilities
- [ ] Create documentation for accessibility features
- [ ] Validate against WCAG 2.1 AA standards