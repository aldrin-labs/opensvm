'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useDashboard } from '@/lib/dashboard';
import { AnimatedContainer } from '@/components/ui/micro-interactions';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/lib/accessibility';
import { useAnimation } from '@/lib/animations';

interface DashboardGridProps {
  className?: string;
  cellSize?: number;
  gap?: number;
}

export function DashboardGrid({ 
  className, 
  cellSize = 100, 
  gap = 8 
}: DashboardGridProps) {
  const {
    currentDashboard,
    dragState,
    updateDrag,
    endDrag,
    isEditMode,
    gridSize
  } = useDashboard();
  
  const gridRef = useRef<HTMLDivElement>(null);
  const [showDropZone, setShowDropZone] = useState(false);
  const { announceToScreenReader } = useAccessibility();
  const { shouldAnimate } = useAnimation();

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    updateDrag({ x, y });
    setShowDropZone(true);
  }, [dragState.isDragging, updateDrag]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.dropZone) return;

    // Validate drop position
    const { dropZone } = dragState;
    if (
      dropZone.x >= 0 && 
      dropZone.x + dropZone.w <= gridSize.cols &&
      dropZone.y >= 0 && 
      dropZone.y + dropZone.h <= gridSize.rows
    ) {
      endDrag(dropZone);
      announceToScreenReader('Widget successfully moved', 'polite');
    } else {
      endDrag();
      announceToScreenReader('Invalid drop position, widget returned to original location', 'assertive');
    }

    setShowDropZone(false);
  }, [dragState, gridSize, endDrag, announceToScreenReader]);

  const handleMouseLeave = useCallback(() => {
    if (dragState.isDragging) {
      endDrag();
      setShowDropZone(false);
    }
  }, [dragState.isDragging, endDrag]);

  // Keyboard support for accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditMode || !dragState.draggedWidget) return;

      const widget = dragState.draggedWidget;
      let newPosition = { ...widget.position };

      switch (e.key) {
        case 'ArrowLeft':
          if (newPosition.x > 0) newPosition.x--;
          break;
        case 'ArrowRight':
          if (newPosition.x + newPosition.w < gridSize.cols) newPosition.x++;
          break;
        case 'ArrowUp':
          if (newPosition.y > 0) newPosition.y--;
          break;
        case 'ArrowDown':
          if (newPosition.y + newPosition.h < gridSize.rows) newPosition.y++;
          break;
        case 'Escape':
          endDrag();
          return;
        case 'Enter':
          endDrag(newPosition);
          return;
        default:
          return;
      }

      e.preventDefault();
      updateDrag({ 
        x: newPosition.x * (cellSize + gap), 
        y: newPosition.y * (cellSize + gap) 
      });
    };

    if (dragState.isDragging) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [dragState, isEditMode, gridSize, cellSize, gap, endDrag, updateDrag]);

  if (!currentDashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No dashboard selected</p>
      </div>
    );
  }

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridSize.cols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${gridSize.rows}, ${cellSize}px)`,
    gap: `${gap}px`,
    padding: `${gap}px`,
    position: 'relative' as const,
    minHeight: `${gridSize.rows * cellSize + (gridSize.rows + 1) * gap}px`,
  };

  return (
    <div className={cn('w-full overflow-auto', className)}>
      <div
        ref={gridRef}
        style={gridStyle}
        className={cn(
          'relative transition-all duration-200',
          isEditMode && 'bg-muted/20',
          dragState.isDragging && 'cursor-grabbing'
        )}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        role="grid"
        aria-label="Dashboard widget grid"
        tabIndex={isEditMode ? 0 : -1}
      >
        {/* Grid background pattern in edit mode */}
        {isEditMode && (
          <div 
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgb(0 0 0 / 0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgb(0 0 0 / 0.1) 1px, transparent 1px)
              `,
              backgroundSize: `${cellSize + gap}px ${cellSize + gap}px`,
            }}
          />
        )}

        {/* Drop zone indicator */}
        {showDropZone && dragState.dropZone && (
          <div
            className={cn(
              'absolute border-2 border-dashed border-primary bg-primary/10 rounded-lg z-10',
              shouldAnimate() && 'animate-pulse'
            )}
            style={{
              left: `${dragState.dropZone.x * (cellSize + gap)}px`,
              top: `${dragState.dropZone.y * (cellSize + gap)}px`,
              width: `${dragState.dropZone.w * cellSize + (dragState.dropZone.w - 1) * gap}px`,
              height: `${dragState.dropZone.h * cellSize + (dragState.dropZone.h - 1) * gap}px`,
            }}
            aria-label="Drop zone"
          />
        )}

        {/* Render widgets */}
        {currentDashboard.widgets
          .filter(widget => widget.visible)
          .map(widget => (
            <WidgetContainer
              key={widget.id}
              widget={widget}
              cellSize={cellSize}
              gap={gap}
              isDragging={dragState.draggedWidget?.id === widget.id}
            />
          ))}
      </div>
    </div>
  );
}

interface WidgetContainerProps {
  widget: any;
  cellSize: number;
  gap: number;
  isDragging: boolean;
}

function WidgetContainer({ widget, cellSize, gap, isDragging }: WidgetContainerProps) {
  const { startDrag, isEditMode, updateWidget, removeWidget } = useDashboard();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const { shouldAnimate } = useAnimation();

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isEditMode || widget.locked || !widget.draggable) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    startDrag(widget, offset);
    e.preventDefault();
  }, [isEditMode, widget, startDrag]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!isEditMode || widget.locked || !widget.resizable) return;

    setIsResizing(true);
    e.stopPropagation();

    const startSize = { w: widget.position.w, h: widget.position.h };
    const startMousePos = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.round((moveEvent.clientX - startMousePos.x) / (cellSize + gap));
      const deltaY = Math.round((moveEvent.clientY - startMousePos.y) / (cellSize + gap));

      const newW = Math.max(widget.minSize?.w || 1, startSize.w + deltaX);
      const newH = Math.max(widget.minSize?.h || 1, startSize.h + deltaY);

      updateWidget(widget.id, {
        position: {
          ...widget.position,
          w: Math.min(widget.maxSize?.w || 12, newW),
          h: Math.min(widget.maxSize?.h || 8, newH),
        }
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isEditMode, widget, cellSize, gap, updateWidget]);

  const widgetStyle = {
    gridColumnStart: widget.position.x + 1,
    gridColumnEnd: widget.position.x + widget.position.w + 1,
    gridRowStart: widget.position.y + 1,
    gridRowEnd: widget.position.y + widget.position.h + 1,
  };

  return (
    <AnimatedContainer
      animation="fadeIn"
      className={cn(
        'relative bg-card border border-border rounded-lg overflow-hidden shadow-sm',
        'transition-all duration-200',
        isEditMode && 'hover:shadow-md',
        isDragging && 'opacity-50 z-20',
        isResizing && 'z-10',
        !widget.draggable && 'cursor-default',
        widget.draggable && isEditMode && !widget.locked && 'cursor-grab active:cursor-grabbing',
        shouldAnimate() && 'hover:scale-[1.02]'
      )}
      style={widgetStyle}
    >
      <div
        ref={containerRef}
        className="h-full"
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        role="gridcell"
        tabIndex={isEditMode ? 0 : -1}
        aria-label={`Widget: ${widget.title}`}
      >
        {/* Widget controls */}
        {isEditMode && showControls && !widget.locked && (
          <div className="absolute top-2 right-2 z-10 flex space-x-1">
            <button
              onClick={() => updateWidget(widget.id, { visible: false })}
              className="p-1 bg-background/80 border rounded text-xs hover:bg-muted"
              aria-label="Hide widget"
            >
              ✕
            </button>
            {widget.resizable && (
              <div
                className="absolute bottom-0 right-0 w-3 h-3 cursor-nw-resize bg-primary/50"
                onMouseDown={handleResizeStart}
                aria-label="Resize widget"
              />
            )}
          </div>
        )}

        {/* Widget header */}
        <div className="p-3 border-b border-border">
          <h3 className="font-medium text-sm truncate">{widget.title}</h3>
          {widget.error && (
            <p className="text-xs text-destructive mt-1">Error loading widget</p>
          )}
        </div>

        {/* Widget content */}
        <div className="p-3 h-full overflow-auto">
          {widget.component ? (
            React.createElement(widget.component, { 
              config: widget.config,
              data: widget.data,
              size: { w: widget.position.w, h: widget.position.h }
            })
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">Widget type: {widget.type}</p>
            </div>
          )}
        </div>

        {/* Loading indicator */}
        {widget.refreshInterval && (
          <div className="absolute top-2 left-2 w-2 h-2 bg-success rounded-full animate-pulse" />
        )}
      </div>
    </AnimatedContainer>
  );
}

export default DashboardGrid;