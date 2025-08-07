'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useDashboard, DashboardLayout } from '@/lib/dashboard';
import { defaultWidgetTemplates, widgetCategories, getWidgetsByCategory } from './widgets';
import { DashboardGrid } from './DashboardGrid';
import { 
  Plus, 
  Settings, 
  Copy, 
  Trash2, 
  Download, 
  Upload, 
  Eye, 
  EyeOff,
  Grid3X3,
  Layout,
  Palette,
  Share
} from 'lucide-react';

interface DashboardManagerProps {
  className?: string;
}

export function DashboardManager({ className }: DashboardManagerProps) {
  const {
    dashboards,
    currentDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    switchDashboard,
    duplicateDashboard,
    addWidget,
    removeWidget,
    updateWidget,
    exportDashboard,
    importDashboard,
  } = useDashboard();

  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [isAddingWidget, setIsAddingWidget] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [newDashboard, setNewDashboard] = useState({
    name: '',
    description: '',
    isPublic: false,
    theme: 'default',
    layout: 'grid' as const,
  });

  const filteredWidgets = getWidgetsByCategory(selectedCategory).filter(widget =>
    widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    widget.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    widget.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateDashboard = async () => {
    if (!newDashboard.name.trim()) return;

    const dashboard: Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'> = {
      name: newDashboard.name,
      description: newDashboard.description,
      widgets: [],
      settings: {
        theme: newDashboard.theme,
        layout: newDashboard.layout,
        isPublic: newDashboard.isPublic,
        showGrid: true,
        snapToGrid: true,
        gridSize: 20,
        backgroundColor: '#ffffff',
        padding: 16,
      },
      metadata: {
        tags: [],
        category: 'Custom',
        author: 'User',
        version: '1.0.0',
      },
    };

    await createDashboard(dashboard);
    setNewDashboard({ name: '', description: '', isPublic: false, theme: 'default', layout: 'grid' });
    setIsCreatingDashboard(false);
  };

  const handleAddWidget = (templateType: string) => {
    const template = defaultWidgetTemplates.find(t => t.type === templateType);
    if (!template || !currentDashboard) return;

    const widget = {
      id: `widget-${Date.now()}`,
      type: templateType,
      title: template.name,
      config: { ...template.defaultConfig },
      position: template.defaultPosition,
      size: template.defaultSize,
      locked: false,
      visible: true,
    };

    addWidget(currentDashboard.id, widget);
    setIsAddingWidget(false);
  };

  const handleExportDashboard = () => {
    if (!currentDashboard) return;
    
    const dataStr = JSON.stringify(currentDashboard, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentDashboard.name.replace(/\s+/g, '-').toLowerCase()}-dashboard.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDashboard = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dashboard = JSON.parse(e.target?.result as string);
        importDashboard(dashboard);
      } catch (error) {
        console.error('Failed to import dashboard:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Dashboard Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold">Dashboard Manager</h1>
          {currentDashboard && (
            <div className="flex items-center space-x-2">
              <Badge variant="outline">{currentDashboard.name}</Badge>
              <Badge variant="secondary">
                {currentDashboard.widgets.length} widgets
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Add Widget Button */}
          <Dialog open={isAddingWidget} onOpenChange={setIsAddingWidget}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!currentDashboard}>
                <Plus className="h-4 w-4 mr-2" />
                Add Widget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Add Widget</DialogTitle>
                <DialogDescription>
                  Choose a widget to add to your dashboard
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Search and Filter */}
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search widgets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="w-48">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {widgetCategories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Widget Grid */}
                <ScrollArea className="h-96">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                    {filteredWidgets.map(widget => (
                      <Card
                        key={widget.type}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleAddWidget(widget.type)}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center space-x-2">
                            {widget.icon}
                            <span>{widget.name}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground mb-2">
                            {widget.description}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {widget.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dashboard Actions */}
          <Button variant="outline" size="sm" onClick={handleExportDashboard} disabled={!currentDashboard}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          <Button variant="outline" size="sm" asChild>
            <label>
              <Upload className="h-4 w-4 mr-2" />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImportDashboard}
                className="hidden"
              />
            </label>
          </Button>

          {/* Create Dashboard */}
          <Dialog open={isCreatingDashboard} onOpenChange={setIsCreatingDashboard}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Dashboard
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Dashboard</DialogTitle>
                <DialogDescription>
                  Set up your new dashboard configuration
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Dashboard Name</Label>
                  <Input
                    id="name"
                    value={newDashboard.name}
                    onChange={(e) => setNewDashboard(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Awesome Dashboard"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newDashboard.description}
                    onChange={(e) => setNewDashboard(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this dashboard is for..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="theme">Theme</Label>
                    <Select value={newDashboard.theme} onValueChange={(theme) => setNewDashboard(prev => ({ ...prev, theme }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="blue">Blue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="layout">Layout</Label>
                    <Select value={newDashboard.layout} onValueChange={(layout) => setNewDashboard(prev => ({ ...prev, layout: layout as 'grid' | 'free' }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Grid Layout</SelectItem>
                        <SelectItem value="free">Free Layout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="public"
                    checked={newDashboard.isPublic}
                    onCheckedChange={(isPublic) => setNewDashboard(prev => ({ ...prev, isPublic }))}
                  />
                  <Label htmlFor="public">Make this dashboard public</Label>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreatingDashboard(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateDashboard} disabled={!newDashboard.name.trim()}>
                    Create Dashboard
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-hidden">
        {currentDashboard ? (
          <Tabs defaultValue="dashboard" className="h-full flex flex-col">
            <TabsList className="grid w-full max-w-md grid-cols-3 mx-4 mt-4">
              <TabsTrigger value="dashboard">
                <Layout className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="dashboards">
                <Grid3X3 className="h-4 w-4 mr-2" />
                All Dashboards
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="flex-1 mt-0">
              <DashboardGrid dashboard={currentDashboard} />
            </TabsContent>

            <TabsContent value="dashboards" className="flex-1 mt-4 px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboards.map(dashboard => (
                  <Card
                    key={dashboard.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      currentDashboard?.id === dashboard.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => switchDashboard(dashboard.id)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        {dashboard.name}
                        <div className="flex items-center space-x-1">
                          {dashboard.settings.isPublic && (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateDashboard(dashboard.id);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDashboard(dashboard.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardTitle>
                      {dashboard.description && (
                        <p className="text-sm text-muted-foreground">
                          {dashboard.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <span>{dashboard.widgets.length} widgets</span>
                        <Badge variant="outline">{dashboard.metadata?.category || 'Custom'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 mt-4 px-4">
              <Card>
                <CardHeader>
                  <CardTitle>Dashboard Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Grid Size</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="20px" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10px</SelectItem>
                          <SelectItem value="20">20px</SelectItem>
                          <SelectItem value="30">30px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Background</Label>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Palette className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">Default</Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch id="grid" defaultChecked />
                      <Label htmlFor="grid">Show Grid</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="snap" defaultChecked />
                      <Label htmlFor="snap">Snap to Grid</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="public" />
                      <Label htmlFor="public">Public Dashboard</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Layout className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Dashboard Selected</h2>
              <p className="text-muted-foreground mb-4">
                Create a new dashboard or select an existing one to get started
              </p>
              <Button onClick={() => setIsCreatingDashboard(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardManager;