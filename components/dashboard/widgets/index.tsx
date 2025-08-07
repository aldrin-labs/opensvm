'use client';

import React from 'react';
import { WidgetTemplate } from '@/lib/dashboard';
import { 
  BarChart3, 
  LineChart, 
  PieChart, 
  Activity,
  Table,
  List,
  Calendar,
  FileText,
  Globe,
  StickyNote
} from 'lucide-react';

// Widget components
import { MetricsCard } from './MetricsCard';
import { ChartWidget } from './ChartWidget';
import { TableWidget } from './TableWidget';
import { ListWidget } from './ListWidget';
import { CalendarWidget } from './CalendarWidget';
import { NotesWidget } from './NotesWidget';
import { IFrameWidget } from './IFrameWidget';

// Widget templates registry
export const defaultWidgetTemplates: WidgetTemplate[] = [
  {
    type: 'metrics-card',
    name: 'Metrics Card',
    description: 'Display key performance indicators and metrics',
    icon: <Activity className="w-5 h-5" />,
    defaultSize: 'md',
    defaultPosition: { x: 0, y: 0, w: 2, h: 2 },
    defaultConfig: {
      title: 'New Metric',
      value: 0,
      unit: '',
      trend: null,
      color: 'blue'
    },
    category: 'Analytics',
    tags: ['metrics', 'kpi', 'analytics'],
    component: MetricsCard
  },
  {
    type: 'chart-line',
    name: 'Line Chart',
    description: 'Display data trends over time',
    icon: <LineChart className="w-5 h-5" />,
    defaultSize: 'lg',
    defaultPosition: { x: 0, y: 0, w: 4, h: 3 },
    defaultConfig: {
      title: 'Line Chart',
      dataSource: null,
      xAxis: 'time',
      yAxis: 'value',
      color: 'blue'
    },
    category: 'Charts',
    tags: ['chart', 'line', 'trend', 'analytics'],
    component: ChartWidget
  },
  {
    type: 'chart-bar',
    name: 'Bar Chart',
    description: 'Compare values across categories',
    icon: <BarChart3 className="w-5 h-5" />,
    defaultSize: 'lg',
    defaultPosition: { x: 0, y: 0, w: 4, h: 3 },
    defaultConfig: {
      title: 'Bar Chart',
      dataSource: null,
      xAxis: 'category',
      yAxis: 'value',
      color: 'green',
      orientation: 'vertical'
    },
    category: 'Charts',
    tags: ['chart', 'bar', 'comparison', 'analytics'],
    component: ChartWidget
  },
  {
    type: 'chart-pie',
    name: 'Pie Chart',
    description: 'Show proportional data distribution',
    icon: <PieChart className="w-5 h-5" />,
    defaultSize: 'md',
    defaultPosition: { x: 0, y: 0, w: 3, h: 3 },
    defaultConfig: {
      title: 'Pie Chart',
      dataSource: null,
      labelField: 'label',
      valueField: 'value',
      colors: ['blue', 'green', 'yellow', 'red']
    },
    category: 'Charts',
    tags: ['chart', 'pie', 'distribution', 'analytics'],
    component: ChartWidget
  },
  {
    type: 'table',
    name: 'Data Table',
    description: 'Display structured data in tabular format',
    icon: <Table className="w-5 h-5" />,
    defaultSize: 'lg',
    defaultPosition: { x: 0, y: 0, w: 6, h: 4 },
    defaultConfig: {
      title: 'Data Table',
      dataSource: null,
      columns: [],
      pageSize: 10,
      sortable: true,
      filterable: true
    },
    category: 'Data',
    tags: ['table', 'data', 'grid', 'list'],
    component: TableWidget
  },
  {
    type: 'list',
    name: 'List View',
    description: 'Display items in a vertical list',
    icon: <List className="w-5 h-5" />,
    defaultSize: 'md',
    defaultPosition: { x: 0, y: 0, w: 3, h: 4 },
    defaultConfig: {
      title: 'List',
      dataSource: null,
      itemTemplate: 'default',
      maxItems: 10
    },
    category: 'Data',
    tags: ['list', 'items', 'feed'],
    component: ListWidget
  },
  {
    type: 'calendar',
    name: 'Calendar',
    description: 'Display calendar and events',
    icon: <Calendar className="w-5 h-5" />,
    defaultSize: 'lg',
    defaultPosition: { x: 0, y: 0, w: 4, h: 4 },
    defaultConfig: {
      title: 'Calendar',
      view: 'month',
      showEvents: true,
      eventSource: null
    },
    category: 'Productivity',
    tags: ['calendar', 'events', 'schedule'],
    component: CalendarWidget
  },
  {
    type: 'notes',
    name: 'Notes',
    description: 'Add text notes and reminders',
    icon: <StickyNote className="w-5 h-5" />,
    defaultSize: 'md',
    defaultPosition: { x: 0, y: 0, w: 3, h: 3 },
    defaultConfig: {
      title: 'Notes',
      content: '',
      editable: true,
      markdown: false
    },
    category: 'Productivity',
    tags: ['notes', 'text', 'memo'],
    component: NotesWidget
  },
  {
    type: 'iframe',
    name: 'Web Content',
    description: 'Embed external web content',
    icon: <Globe className="w-5 h-5" />,
    defaultSize: 'lg',
    defaultPosition: { x: 0, y: 0, w: 6, h: 4 },
    defaultConfig: {
      title: 'Web Content',
      url: '',
      allowScripts: false,
      refreshInterval: 0
    },
    category: 'Content',
    tags: ['iframe', 'web', 'external'],
    component: IFrameWidget
  }
];

// Widget size presets
export const widgetSizePresets = {
  sm: { w: 2, h: 2 },
  md: { w: 3, h: 3 },
  lg: { w: 4, h: 3 },
  xl: { w: 6, h: 4 },
  full: { w: 12, h: 6 }
};

// Widget categories
export const widgetCategories = [
  'All',
  'Analytics',
  'Charts',
  'Data',
  'Productivity',
  'Content'
];

// Utility functions
export function getWidgetTemplate(type: string): WidgetTemplate | undefined {
  return defaultWidgetTemplates.find(template => template.type === type);
}

export function getWidgetsByCategory(category: string): WidgetTemplate[] {
  if (category === 'All') return defaultWidgetTemplates;
  return defaultWidgetTemplates.filter(template => template.category === category);
}

export function createWidgetFromTemplate(template: WidgetTemplate, position: { x: number; y: number }) {
  return {
    type: template.type,
    title: template.name,
    config: { ...template.defaultConfig },
    position: { 
      ...template.defaultPosition, 
      x: position.x, 
      y: position.y 
    },
    size: template.defaultSize,
    locked: false,
    visible: true,
    resizable: true,
    draggable: true,
    component: template.component,
    refreshInterval: 0,
    lastUpdated: Date.now()
  };
}

// Export all widget components
export * from './MetricsCard';
export * from './ChartWidget';
export * from './TableWidget';
export * from './ListWidget';
export * from './CalendarWidget';
export * from './NotesWidget';
export * from './IFrameWidget';

export default defaultWidgetTemplates;