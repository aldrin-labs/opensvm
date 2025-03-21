'use client';

import cytoscape from 'cytoscape';

// Cache for tooltip content to avoid redundant DOM operations
const tooltipContentCache = new Map<string, string>();

// Track if tooltip is currently visible to avoid unnecessary DOM operations
let tooltipVisible = false;
// Cache the tooltip element to avoid repeated DOM lookups
let tooltipCache: HTMLElement | null = null;
// Track the last element ID to avoid updating tooltip for the same element
let lastElementId = '';

// Throttle function to limit tooltip updates
const throttle = (func: Function, limit: number): Function => {
  let inThrottle: boolean;
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number;
  
  return function(this: any, ...args: any[]) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      lastRan = Date.now();
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
};

/**
 * Create a tooltip element for displaying node/edge details
 * @returns HTML element for tooltip
 */
export const createTooltip = (): HTMLElement => {
  // Use cached tooltip if available
  if (tooltipCache) return tooltipCache;
  
  // Check if tooltip already exists in DOM
  let tooltip = document.getElementById('graph-tooltip');
  
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'graph-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.zIndex = '10';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.15s ease-in-out'; // Faster transition
    tooltip.style.maxWidth = '250px'; // Reduced from 300px
    tooltip.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'; // Lighter shadow
    document.body.appendChild(tooltip);
  }
  
  // Cache the tooltip element
  tooltipCache = tooltip;
  
  return tooltip;
};

/**
 * Generate tooltip content based on element type
 * @param element Cytoscape element
 * @returns HTML content string
 */
const generateTooltipContent = (element: cytoscape.SingularElementReturnValue): string => {
  // Use element ID as cache key
  const cacheKey = element.id();
  
  // Return cached content if available
  if (tooltipContentCache.has(cacheKey)) {
    return tooltipContentCache.get(cacheKey)!;
  }
  
  let content = '';
  
  if (element.isNode()) {
    const type = element.data('type');
    
    if (type === 'transaction') {
      // Simplified transaction tooltip
      content = `
        <div style="font-weight: bold; margin-bottom: 4px;">Transaction</div>
        <div style="word-break: break-all; max-height: 40px; overflow: hidden; text-overflow: ellipsis;">${element.data('fullSignature') || element.id()}</div>
        ${element.data('timestamp') ? `<div style="margin-top: 4px;">Time: ${element.data('formattedTime')}</div>` : ''}
        ${element.data('success') !== undefined ? `<div style="margin-top: 4px;">Status: ${element.data('success') ? 'Success' : 'Error'}</div>` : ''}
        <div style="margin-top: 8px; font-size: 10px;">Click to expand</div>
      `;
    } else if (type === 'account') {
      // Simplified account tooltip
      content = `
        <div style="font-weight: bold; margin-bottom: 4px;">Account</div>
        <div style="word-break: break-all; max-height: 40px; overflow: hidden; text-overflow: ellipsis;">${element.data('fullAddress') || element.id()}</div>
        <div style="margin-top: 8px; font-size: 10px;">Click to explore transactions</div>
      `;
    }
  } else if (element.isEdge()) {
    const type = element.data('type');
    
    if (type === 'transfer') {
      // Simplified transfer tooltip
      content = `
        <div style="font-weight: bold; margin-bottom: 4px;">Token Transfer</div>
        <div>Amount: ${element.data('label')}</div>
        <div style="margin-top: 4px;">From: ${element.source().data('label')}</div>
        <div>To: ${element.target().data('label')}</div>
      `;
    } else {
      // Simplified connection tooltip
      content = `
        <div style="font-weight: bold; margin-bottom: 4px;">Connection</div>
        <div>From: ${element.source().data('label')}</div>
        <div>To: ${element.target().data('label')}</div>
      `;
    }
  }
  
  // Cache the content
  tooltipContentCache.set(cacheKey, content);
  
  return content;
};

/**
 * Show tooltip with element details - throttled for performance
 */
export const showTooltip = throttle(
  (
    event: MouseEvent,
    element: cytoscape.SingularElementReturnValue,
    containerRef: React.RefObject<HTMLDivElement>
  ): void => {
    const elementId = element.id();
    
    // Skip if showing tooltip for the same element
    if (tooltipVisible && elementId === lastElementId) return;
    
    lastElementId = elementId;
    
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    
    const tooltip = createTooltip();
    
    // Position tooltip near the mouse but not directly under it
    const x = event.clientX - containerRect.left + 10;
    const y = event.clientY - containerRect.top - 10;
    
    // Generate tooltip content
    const content = generateTooltipContent(element);
    
    // Only update DOM if content changed
    if (tooltip.innerHTML !== content) {
      tooltip.innerHTML = content;
    }
    
    // Update position
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    
    // Show tooltip if not already visible
    if (!tooltipVisible) {
      tooltip.style.opacity = '1';
      tooltipVisible = true;
    }
  },
  50 // Throttle to 50ms for better performance
);

/**
 * Hide tooltip - throttled for performance
 */
export const hideTooltip = throttle(
  (): void => {
    if (!tooltipVisible) return;
    
    const tooltip = tooltipCache || document.getElementById('graph-tooltip');
    if (tooltip) {
      tooltip.style.opacity = '0';
      tooltipVisible = false;
      lastElementId = '';
    }
  },
  50 // Throttle to 50ms for better performance
);

/**
 * Clear tooltip cache when graph is reset
 */
export const clearTooltipCache = (): void => {
  tooltipContentCache.clear();
  tooltipVisible = false;
  lastElementId = '';
};

/**
 * Clean up function to remove tooltip when component unmounts
 */
export const cleanupTooltip = (): void => {
  const tooltip = document.getElementById('graph-tooltip');
  if (tooltip && tooltip.parentNode) {
    tooltip.parentNode.removeChild(tooltip);
    tooltipCache = null;
    tooltipVisible = false;
    lastElementId = '';
  }
};