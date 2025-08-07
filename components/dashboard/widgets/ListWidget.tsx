'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus, X, Check } from 'lucide-react';

interface ListItem {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
  date?: string;
}

interface ListWidgetProps {
  config: {
    title: string;
    listType?: 'simple' | 'todo' | 'status' | 'priority';
    items?: ListItem[];
    allowAdd?: boolean;
    allowEdit?: boolean;
    searchable?: boolean;
    showPriority?: boolean;
    showStatus?: boolean;
    maxItems?: number;
  };
  data?: ListItem[];
  size: { w: number; h: number };
}

export function ListWidget({ config, data, size }: ListWidgetProps) {
  const {
    title,
    listType = 'simple',
    items,
    allowAdd = false,
    allowEdit = false,
    searchable = true,
    showPriority = true,
    showStatus = true,
    maxItems = 20,
  } = config;

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [listItems, setListItems] = useState<ListItem[]>(
    data || items || [
      {
        id: '1',
        title: 'Review blockchain analytics report',
        description: 'Analyze Q4 performance metrics',
        status: 'in-progress',
        priority: 'high',
        completed: false,
        date: '2024-01-15',
      },
      {
        id: '2',
        title: 'Update dashboard widgets',
        description: 'Add new chart components',
        status: 'pending',
        priority: 'medium',
        completed: false,
        date: '2024-01-14',
      },
      {
        id: '3',
        title: 'Setup monitoring alerts',
        description: 'Configure threshold notifications',
        status: 'completed',
        priority: 'high',
        completed: true,
        date: '2024-01-13',
      },
      {
        id: '4',
        title: 'Database optimization',
        description: 'Improve query performance',
        status: 'pending',
        priority: 'low',
        completed: false,
        date: '2024-01-12',
      },
      {
        id: '5',
        title: 'User feedback review',
        description: 'Process customer suggestions',
        status: 'in-progress',
        priority: 'medium',
        completed: false,
        date: '2024-01-11',
      },
    ]
  );

  const filteredItems = listItems.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
  ).slice(0, maxItems);

  const handleToggleComplete = (id: string) => {
    if (listType === 'todo') {
      setListItems(prev => prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ));
    }
  };

  const handleAddItem = () => {
    if (newItemTitle.trim()) {
      const newItem: ListItem = {
        id: Date.now().toString(),
        title: newItemTitle.trim(),
        status: 'pending',
        priority: 'medium',
        completed: false,
        date: new Date().toISOString().split('T')[0],
      };
      setListItems(prev => [newItem, ...prev]);
      setNewItemTitle('');
      setIsAddingItem(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    setListItems(prev => prev.filter(item => item.id !== id));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in-progress': return 'secondary';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const isCompact = size.h <= 3;
  const showDescriptions = !isCompact && size.h > 2;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          <div className="flex items-center space-x-2">
            {allowAdd && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsAddingItem(true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            {searchable && !isCompact && (
              <div className="relative w-32">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-6 text-xs"
                />
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 flex-1 overflow-hidden">
        <div className="h-full overflow-auto space-y-2">
          {isAddingItem && (
            <div className="flex items-center space-x-2 p-2 bg-accent/50 rounded">
              <Input
                placeholder="New item..."
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                className="flex-1 h-6 text-xs"
                onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleAddItem}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => {
                  setIsAddingItem(false);
                  setNewItemTitle('');
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`group flex items-start space-x-3 p-2 rounded hover:bg-accent/30 transition-colors ${
                item.completed ? 'opacity-60' : ''
              }`}
            >
              {listType === 'todo' && (
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => handleToggleComplete(item.id)}
                  className="mt-0.5"
                />
              )}
              
              {showPriority && item.priority && (
                <div
                  className={`w-2 h-2 rounded-full mt-1 ${getPriorityColor(item.priority)}`}
                  title={`${item.priority} priority`}
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p
                    className={`text-xs font-medium truncate ${
                      item.completed ? 'line-through' : ''
                    }`}
                  >
                    {item.title}
                  </p>
                  
                  {allowEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {showDescriptions && item.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-1">
                  {showStatus && item.status && (
                    <Badge
                      variant={getStatusVariant(item.status)}
                      className="text-xs h-4"
                    >
                      {item.status.replace('-', ' ')}
                    </Badge>
                  )}
                  
                  {item.date && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-xs">No items found</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Also export as default for backwards compatibility
export default ListWidget;