'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useErrorHandling } from '@/lib/error-handling';
import { useAccessibility } from '@/lib/accessibility';
import { useI18n } from '@/lib/i18n';

// Dashboard types
export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type WidgetType = 
  | 'chart-line' 
  | 'chart-bar' 
  | 'chart-pie' 
  | 'chart-area'
  | 'metrics-card'
  | 'table'
  | 'list'
  | 'calendar'
  | 'news'
  | 'weather'
  | 'notes'
  | 'iframe'
  | 'custom';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: Record<string, any>;
  position: WidgetPosition;
  size: WidgetSize;
  locked: boolean;
  visible: boolean;
  minSize?: { w: number; h: number };
  maxSize?: { w: number; h: number };
  resizable: boolean;
  draggable: boolean;
  component?: React.ComponentType<any>;
  data?: any;
  refreshInterval?: number;
  lastUpdated?: number;
  error?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout: {
    cols: number;
    rows: number;
    gap: number;
    padding: number;
  };
  theme?: string;
  isDefault: boolean;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface DragState {
  isDragging: boolean;
  draggedWidget?: Widget;
  dragOffset?: { x: number; y: number };
  dropZone?: { x: number; y: number; w: number; h: number };
}

export interface WidgetTemplate {
  type: WidgetType;
  name: string;
  description: string;
  icon: React.ReactNode;
  defaultSize: WidgetSize;
  defaultPosition: Partial<WidgetPosition>;
  defaultConfig: Record<string, any>;
  category: string;
  tags: string[];
  component: React.ComponentType<any>;
}

// Dashboard context
interface DashboardContextType {
  // Current dashboard
  currentDashboard: Dashboard | null;
  dashboards: Dashboard[];
  
  // Dashboard management
  createDashboard: (dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Dashboard>;
  updateDashboard: (id: string, updates: Partial<Dashboard>) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  setCurrentDashboard: (id: string) => void;
  duplicateDashboard: (id: string, name: string) => Promise<Dashboard>;
  
  // Widget management
  addWidget: (widget: Omit<Widget, 'id'>) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, position: WidgetPosition) => void;
  resizeWidget: (id: string, size: { w: number; h: number }) => void;
  
  // Drag and drop
  dragState: DragState;
  startDrag: (widget: Widget, offset: { x: number; y: number }) => void;
  updateDrag: (position: { x: number; y: number }) => void;
  endDrag: (dropPosition?: WidgetPosition) => void;
  
  // Layout
  isEditMode: boolean;
  setEditMode: (enabled: boolean) => void;
  gridSize: { cols: number; rows: number };
  setGridSize: (size: { cols: number; rows: number }) => void;
  
  // Widget templates
  widgetTemplates: WidgetTemplate[];
  registerWidgetTemplate: (template: WidgetTemplate) => void;
  
  // Export/Import
  exportDashboard: (id: string) => string;
  importDashboard: (data: string) => Promise<Dashboard>;
  
  // Auto-save
  autoSave: boolean;
  setAutoSave: (enabled: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Dashboard provider
export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [dashboards, setDashboards] = useLocalStorage<Dashboard[]>('opensvm-dashboards', []);
  const [currentDashboardId, setCurrentDashboardId] = useLocalStorage<string>('opensvm-current-dashboard', '');
  const [isEditMode, setEditMode] = useState(false);
  const [dragState, setDragState] = useState<DragState>({ isDragging: false });
  const [gridSize, setGridSize] = useState({ cols: 12, rows: 8 });
  const [widgetTemplates, setWidgetTemplates] = useState<WidgetTemplate[]>([]);
  const [autoSave, setAutoSave] = useState(true);
  
  const { reportError } = useErrorHandling();
  const { announceToScreenReader } = useAccessibility();
  const { t } = useI18n();
  
  const autoSaveTimer = useRef<NodeJS.Timeout>();

  const currentDashboard = dashboards.find(d => d.id === currentDashboardId) || null;

  const generateId = () => `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const scheduleAutoSave = useCallback(() => {
    if (!autoSave) return;
    
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    
    autoSaveTimer.current = setTimeout(() => {
      announceToScreenReader('Dashboard auto-saved', 'polite');
    }, 2000);
  }, [autoSave, announceToScreenReader]);

  const createDashboard = useCallback(async (
    dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Dashboard> => {
    const now = Date.now();
    const newDashboard: Dashboard = {
      ...dashboardData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    setDashboards(prev => [...prev, newDashboard]);
    announceToScreenReader(`Dashboard "${newDashboard.name}" created`, 'polite');
    
    return newDashboard;
  }, [setDashboards, announceToScreenReader]);

  const updateDashboard = useCallback(async (
    id: string, 
    updates: Partial<Dashboard>
  ): Promise<void> => {
    setDashboards(prev => prev.map(dashboard => 
      dashboard.id === id 
        ? { ...dashboard, ...updates, updatedAt: Date.now() }
        : dashboard
    ));
    
    scheduleAutoSave();
  }, [setDashboards, scheduleAutoSave]);

  const deleteDashboard = useCallback(async (id: string): Promise<void> => {
    const dashboard = dashboards.find(d => d.id === id);
    if (!dashboard) return;

    setDashboards(prev => prev.filter(d => d.id !== id));
    
    if (currentDashboardId === id) {
      const remainingDashboards = dashboards.filter(d => d.id !== id);
      setCurrentDashboardId(remainingDashboards[0]?.id || '');
    }
    
    announceToScreenReader(`Dashboard "${dashboard.name}" deleted`, 'polite');
  }, [dashboards, currentDashboardId, setDashboards, setCurrentDashboardId, announceToScreenReader]);

  const setCurrentDashboard = useCallback((id: string) => {
    const dashboard = dashboards.find(d => d.id === id);
    if (dashboard) {
      setCurrentDashboardId(id);
      announceToScreenReader(`Switched to dashboard "${dashboard.name}"`, 'polite');
    }
  }, [dashboards, setCurrentDashboardId, announceToScreenReader]);

  const duplicateDashboard = useCallback(async (
    id: string, 
    name: string
  ): Promise<Dashboard> => {
    const original = dashboards.find(d => d.id === id);
    if (!original) throw new Error('Dashboard not found');

    const duplicate = await createDashboard({
      ...original,
      name,
      isDefault: false,
      widgets: original.widgets.map(widget => ({
        ...widget,
        id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      })),
    });

    return duplicate;
  }, [dashboards, createDashboard]);

  const addWidget = useCallback((widgetData: Omit<Widget, 'id'>) => {
    if (!currentDashboard) return;

    const newWidget: Widget = {
      ...widgetData,
      id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    updateDashboard(currentDashboard.id, {
      widgets: [...currentDashboard.widgets, newWidget]
    });

    announceToScreenReader(`Widget "${newWidget.title}" added to dashboard`, 'polite');
  }, [currentDashboard, updateDashboard, announceToScreenReader]);

  const updateWidget = useCallback((id: string, updates: Partial<Widget>) => {
    if (!currentDashboard) return;

    const updatedWidgets = currentDashboard.widgets.map(widget =>
      widget.id === id ? { ...widget, ...updates } : widget
    );

    updateDashboard(currentDashboard.id, { widgets: updatedWidgets });
  }, [currentDashboard, updateDashboard]);

  const removeWidget = useCallback((id: string) => {
    if (!currentDashboard) return;

    const widget = currentDashboard.widgets.find(w => w.id === id);
    const updatedWidgets = currentDashboard.widgets.filter(w => w.id !== id);

    updateDashboard(currentDashboard.id, { widgets: updatedWidgets });
    
    if (widget) {
      announceToScreenReader(`Widget "${widget.title}" removed from dashboard`, 'polite');
    }
  }, [currentDashboard, updateDashboard, announceToScreenReader]);

  const moveWidget = useCallback((id: string, position: WidgetPosition) => {
    updateWidget(id, { position });
  }, [updateWidget]);

  const resizeWidget = useCallback((id: string, size: { w: number; h: number }) => {
    updateWidget(id, { 
      position: { 
        ...currentDashboard?.widgets.find(w => w.id === id)?.position || { x: 0, y: 0 },
        w: size.w, 
        h: size.h 
      } 
    });
  }, [currentDashboard, updateWidget]);

  const startDrag = useCallback((widget: Widget, offset: { x: number; y: number }) => {
    setDragState({
      isDragging: true,
      draggedWidget: widget,
      dragOffset: offset,
    });
    
    announceToScreenReader(`Started dragging widget "${widget.title}"`, 'polite');
  }, [announceToScreenReader]);

  const updateDrag = useCallback((position: { x: number; y: number }) => {
    setDragState(prev => ({
      ...prev,
      dropZone: prev.draggedWidget ? {
        x: Math.round((position.x - (prev.dragOffset?.x || 0)) / 100),
        y: Math.round((position.y - (prev.dragOffset?.y || 0)) / 100),
        w: prev.draggedWidget.position.w,
        h: prev.draggedWidget.position.h,
      } : undefined,
    }));
  }, []);

  const endDrag = useCallback((dropPosition?: WidgetPosition) => {
    if (dragState.draggedWidget && dropPosition) {
      moveWidget(dragState.draggedWidget.id, dropPosition);
      announceToScreenReader(
        `Widget "${dragState.draggedWidget.title}" moved to position ${dropPosition.x}, ${dropPosition.y}`, 
        'polite'
      );
    }

    setDragState({ isDragging: false });
  }, [dragState.draggedWidget, moveWidget, announceToScreenReader]);

  const registerWidgetTemplate = useCallback((template: WidgetTemplate) => {
    setWidgetTemplates(prev => {
      const existing = prev.findIndex(t => t.type === template.type);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = template;
        return updated;
      }
      return [...prev, template];
    });
  }, []);

  const exportDashboard = useCallback((id: string): string => {
    const dashboard = dashboards.find(d => d.id === id);
    if (!dashboard) throw new Error('Dashboard not found');

    return JSON.stringify({
      version: '1.0.0',
      dashboard,
      exportedAt: Date.now(),
    }, null, 2);
  }, [dashboards]);

  const importDashboard = useCallback(async (data: string): Promise<Dashboard> => {
    try {
      const parsed = JSON.parse(data);
      const dashboard = parsed.dashboard as Dashboard;
      
      // Generate new IDs to avoid conflicts
      const importedDashboard = {
        ...dashboard,
        id: generateId(),
        name: `${dashboard.name} (Imported)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        widgets: dashboard.widgets.map(widget => ({
          ...widget,
          id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        })),
      };

      setDashboards(prev => [...prev, importedDashboard]);
      announceToScreenReader(`Dashboard "${importedDashboard.name}" imported successfully`, 'polite');
      
      return importedDashboard;
    } catch (error) {
      reportError(error as Error, { component: 'DashboardProvider', operation: 'import' });
      throw new Error('Failed to import dashboard');
    }
  }, [setDashboards, announceToScreenReader, reportError]);

  const contextValue: DashboardContextType = {
    currentDashboard,
    dashboards,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    setCurrentDashboard,
    duplicateDashboard,
    addWidget,
    updateWidget,
    removeWidget,
    moveWidget,
    resizeWidget,
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    isEditMode,
    setEditMode,
    gridSize,
    setGridSize,
    widgetTemplates,
    registerWidgetTemplate,
    exportDashboard,
    importDashboard,
    autoSave,
    setAutoSave,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

export default DashboardProvider;