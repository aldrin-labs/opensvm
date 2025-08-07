'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

interface TableWidgetProps {
  config: {
    title: string;
    columns?: Array<{
      key: string;
      label: string;
      type?: 'text' | 'number' | 'date' | 'badge' | 'currency';
      sortable?: boolean;
      width?: string;
    }>;
    dataSource?: any[];
    pagination?: boolean;
    searchable?: boolean;
    pageSize?: number;
  };
  data?: any[];
  size: { w: number; h: number };
}

export function TableWidget({ config, data, size }: TableWidgetProps) {
  const {
    title,
    columns = [
      { key: 'name', label: 'Name', type: 'text', sortable: true },
      { key: 'value', label: 'Value', type: 'currency', sortable: true },
      { key: 'status', label: 'Status', type: 'badge', sortable: false },
      { key: 'date', label: 'Date', type: 'date', sortable: true },
    ],
    dataSource,
    pagination = true,
    searchable = true,
    pageSize = 10,
  } = config;

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Mock data
  const mockData = data || dataSource || [
    { name: 'Bitcoin', value: 45000, status: 'active', date: '2024-01-15' },
    { name: 'Ethereum', value: 3200, status: 'active', date: '2024-01-14' },
    { name: 'Cardano', value: 1.2, status: 'inactive', date: '2024-01-13' },
    { name: 'Polkadot', value: 25, status: 'pending', date: '2024-01-12' },
    { name: 'Chainlink', value: 15, status: 'active', date: '2024-01-11' },
    { name: 'Litecoin', value: 150, status: 'active', date: '2024-01-10' },
    { name: 'Ripple', value: 0.6, status: 'inactive', date: '2024-01-09' },
    { name: 'Stellar', value: 0.3, status: 'pending', date: '2024-01-08' },
  ];

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  const formatCellValue = (value: any, type: string) => {
    switch (type) {
      case 'currency':
        return typeof value === 'number' 
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: value < 1 ? 4 : 2,
            }).format(value)
          : value;
      
      case 'date':
        return typeof value === 'string'
          ? new Date(value).toLocaleDateString()
          : value;
      
      case 'badge':
        const variant = value === 'active' ? 'default' : value === 'pending' ? 'secondary' : 'outline';
        return <Badge variant={variant} className="text-xs">{value}</Badge>;
      
      case 'number':
        return typeof value === 'number' 
          ? new Intl.NumberFormat().format(value)
          : value;
      
      default:
        return value;
    }
  };

  // Filter and sort data
  let processedData = [...mockData];

  if (searchTerm) {
    processedData = processedData.filter(item =>
      Object.values(item).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }

  if (sortConfig) {
    processedData.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = pagination 
    ? processedData.slice(startIndex, endIndex)
    : processedData.slice(0, pageSize);

  const isCompact = size.h <= 3;
  const visibleColumns = isCompact ? columns.slice(0, 2) : columns;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          {searchable && !isCompact && (
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs"
              />
            </div>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0 flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                {visibleColumns.map((column) => (
                  <th
                    key={column.key}
                    className={`text-left p-1 font-medium ${
                      column.sortable ? 'cursor-pointer hover:bg-accent/50' : ''
                    }`}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.label}</span>
                      {column.sortable && sortConfig?.key === column.key && (
                        sortConfig.direction === 'asc' 
                          ? <ChevronUp className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, index) => (
                <tr key={index} className="border-b hover:bg-accent/30 transition-colors">
                  {visibleColumns.map((column) => (
                    <td key={column.key} className="p-1">
                      {formatCellValue(row[column.key], column.type || 'text')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination && totalPages > 1 && !isCompact && (
          <div className="flex items-center justify-between pt-2 mt-2 border-t flex-shrink-0">
            <div className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Also export as default for backwards compatibility
export default TableWidget;