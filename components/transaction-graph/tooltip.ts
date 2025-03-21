'use client';

import cytoscape from 'cytoscape';

/**
 * Create a tooltip element for displaying node/edge details
 * @returns HTML element for tooltip
 */
export const createTooltip = (): HTMLElement => {
  // Check if tooltip already exists
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
    tooltip.style.transition = 'opacity 0.2s ease-in-out';
    tooltip.style.maxWidth = '300px';
    tooltip.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    tooltip.style.backdropFilter = 'blur(4px)';
    document.body.appendChild(tooltip);
  }
  
  return tooltip;
};

/**
 * Show tooltip with element details
 * @param event Mouse event
 * @param element Cytoscape element
 * @param containerRef Reference to container element
 */
export const showTooltip = (
  event: MouseEvent,
  element: cytoscape.SingularElementReturnValue,
  containerRef: React.RefObject<HTMLDivElement>
): void => {
  const tooltip = createTooltip();
  const containerRect = containerRef.current?.getBoundingClientRect();
  
  if (!containerRect) return;
  
  // Position tooltip near the mouse but not directly under it
  const x = event.clientX - containerRect.left + 10;
  const y = event.clientY - containerRect.top - 10;
  
  // Generate tooltip content based on element type
  let content = '';
  
  if (element.isNode()) {
    const type = element.data('type');
    
    if (type === 'transaction') {
      content = `
        <div style="font-weight: bold; margin-bottom: 4px;">Transaction</div>
        <div style="word-break: break-all;">${element.data('fullSignature') || element.id()}</div>
        ${element.data('timestamp') ? `<div style="margin-top: 4px;">Time: ${element.data('formattedTime')}</div>` : ''}
        ${element.data('success') !== undefined ? `<div style="margin-top: 4px;">Status: ${element.data('success') ? 'Success' : 'Error'}</div>` : ''}
        <div style="margin-top: 8px; font-size: 10px;">Click to expand</div>
      `;
    } else if (type === 'account') {
      content = `
        <div style="font-weight: bold; margin-bottom: 4px;">Account</div>
        <div style="word-break: break-all;">${element.data('fullAddress') || element.id()}</div>
        <div style="margin-top: 8px; font-size: 10px;">Click to explore transactions</div>
      `;
    }
  } else if (element.isEdge()) {
    const type = element.data('type');
    
    if (type === 'transfer') {
      content = `
        <div style="font-weight: bold; margin-bottom: 4px;">Token Transfer</div>
        <div>Amount: ${element.data('label')}</div>
        <div style="margin-top: 4px;">From: ${element.source().data('label')}</div>
        <div>To: ${element.target().data('label')}</div>
      `;
    } else {
      content = `
        <div style="font-weight: bold; margin-bottom: 4px;">Connection</div>
        <div>From: ${element.source().data('label')}</div>
        <div>To: ${element.target().data('label')}</div>
      `;
    }
  }
  
  tooltip.innerHTML = content;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  tooltip.style.opacity = '1';
};

/**
 * Hide tooltip
 */
export const hideTooltip = (): void => {
  const tooltip = document.getElementById('graph-tooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
  }
};