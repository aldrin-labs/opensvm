/**
 * Phase 3.2.3: Collapsible Table Integration
 * Provides smart table rendering with virtualization for large datasets
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { track } from '../../../lib/ai/telemetry';

interface TableColumn {
    key: string;
    header: string;
    width?: number;
    sortable?: boolean;
    type?: 'text' | 'number' | 'date' | 'boolean';
}

interface TableData {
    [key: string]: string | number | boolean | Date;
}

interface CollapsibleTableProps {
    data: TableData[];
    columns?: TableColumn[];
    className?: string;
    maxRows?: number; // For collapsing large tables
    maxHeight?: number; // For virtualization
    sortable?: boolean;
    searchable?: boolean;
}

interface SortConfig {
    key: string;
    direction: 'asc' | 'desc';
}

// Auto-detect column types from data
function detectColumnType(values: (string | number | boolean | Date)[]): TableColumn['type'] {
    const nonNullValues = values.filter(v => v !== null && v !== undefined);

    if (nonNullValues.length === 0) return 'text';

    // Check if all values are boolean
    if (nonNullValues.every(v => typeof v === 'boolean')) return 'boolean';

    // Check if all values are numbers
    if (nonNullValues.every(v => typeof v === 'number' || !isNaN(Number(v)))) return 'number';

    // Check if all values look like dates
    if (nonNullValues.every(v => !isNaN(Date.parse(String(v))))) return 'date';

    return 'text';
}

// Auto-generate columns from data
function generateColumns(data: TableData[]): TableColumn[] {
    if (data.length === 0) return [];

    const keys = Object.keys(data[0]);

    return keys.map(key => {
        const values = data.map(row => row[key]);
        const type = detectColumnType(values);

        return {
            key,
            header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
            sortable: true,
            type
        };
    });
}

// Parse CSV/TSV text into table data
export function parseTableText(text: string): { data: TableData[], columns: TableColumn[] } {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return { data: [], columns: [] };

    // Detect separator (CSV vs TSV)
    const firstLine = lines[0];
    const separator = firstLine.includes('\t') ? '\t' : ',';

    // Parse headers
    const headers = firstLine.split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));

    // Parse data rows
    const data: TableData[] = lines.slice(1).map((line) => {
        const values = line.split(separator).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const row: TableData = {};

        headers.forEach((header, i) => {
            const value = values[i] || '';

            // Try to parse as number
            if (!isNaN(Number(value)) && value !== '') {
                row[header] = Number(value);
            }
            // Try to parse as boolean
            else if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
                row[header] = value.toLowerCase() === 'true';
            }
            // Keep as string
            else {
                row[header] = value;
            }
        });

        return row;
    }).filter(row => Object.values(row).some(v => v !== '')); // Remove empty rows

    const columns = generateColumns(data);

    return { data, columns };
}

// Check if text looks like a table
export function isTableContent(content: string): boolean {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return false;

    // Check for CSV/TSV patterns
    const firstLine = lines[0];
    const hasCommas = firstLine.includes(',');
    const hasTabs = firstLine.includes('\t');

    if (hasCommas || hasTabs) {
        const separator = hasTabs ? '\t' : ',';
        const expectedColumns = firstLine.split(separator).length;

        // Check if most lines have the same number of columns
        const consistentRows = lines.slice(1).filter(line =>
            line.split(separator).length === expectedColumns
        ).length;

        return consistentRows >= Math.floor(lines.length * 0.7); // 70% consistency
    }

    // Check for markdown table patterns
    const hasMarkdownTable = lines.some(line =>
        line.includes('|') && line.split('|').length >= 3
    );

    if (hasMarkdownTable) {
        // Look for header separator (|---|---|)
        return lines.some(line =>
            /^\s*\|[\s\-\|:]+\|\s*$/.test(line)
        );
    }

    return false;
}

export function CollapsibleTable({
    data,
    columns: propColumns,
    className = '',
    maxRows = 50,
    maxHeight = 400,
    sortable = true,
    searchable = true
}: CollapsibleTableProps) {
    const [isCollapsed, setIsCollapsed] = useState(data.length > maxRows);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [virtualizedStart, setVirtualizedStart] = useState(0);
    const [virtualizedEnd, setVirtualizedEnd] = useState(20);
    const tableRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLTableSectionElement>(null);

    // Generate columns if not provided
    const columns = propColumns || generateColumns(data);

    // Filter data based on search
    const filteredData = useMemo(() => {
        if (!searchTerm) return data;

        const term = searchTerm.toLowerCase();
        return data.filter(row =>
            Object.values(row).some(value =>
                String(value).toLowerCase().includes(term)
            )
        );
    }, [data, searchTerm]);

    // Sort data
    const sortedData = useMemo(() => {
        if (!sortConfig) return filteredData;

        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal === bVal) return 0;

            const multiplier = sortConfig.direction === 'asc' ? 1 : -1;

            // Handle null/undefined
            if (aVal == null) return multiplier;
            if (bVal == null) return -multiplier;

            // Type-specific comparison
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return (aVal - bVal) * multiplier;
            }

            return String(aVal).localeCompare(String(bVal)) * multiplier;
        });
    }, [filteredData, sortConfig]);

    // Display data (considering collapse state)
    const displayData = isCollapsed ? sortedData.slice(0, 10) : sortedData;
    const shouldVirtualize = displayData.length > 100;
    const visibleData = shouldVirtualize
        ? displayData.slice(virtualizedStart, virtualizedEnd)
        : displayData;

    // Virtualization scroll handler
    useEffect(() => {
        if (!shouldVirtualize || !tableRef.current) return;

        const handleScroll = () => {
            const container = tableRef.current;
            if (!container) return;

            const scrollTop = container.scrollTop;
            const rowHeight = 40; // Estimated row height
            const containerHeight = container.clientHeight;

            const start = Math.floor(scrollTop / rowHeight);
            const visibleCount = Math.ceil(containerHeight / rowHeight) + 5; // Overscan

            setVirtualizedStart(Math.max(0, start));
            setVirtualizedEnd(Math.min(displayData.length, start + visibleCount));
        };

        tableRef.current.addEventListener('scroll', handleScroll);
        return () => tableRef.current?.removeEventListener('scroll', handleScroll);
    }, [shouldVirtualize, displayData.length]);

    const handleSort = (key: string) => {
        if (!sortable) return;

        setSortConfig(prev => ({
            key,
            direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));

        track('table_sorted', {
            column: key,
            direction: sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc',
            rows: data.length
        });
    };

    const formatCellValue = (value: any, type: TableColumn['type']) => {
        if (value == null) return '';

        switch (type) {
            case 'boolean':
                return value ? '✓' : '✗';
            case 'number':
                return typeof value === 'number' ? value.toLocaleString() : value;
            case 'date':
                return new Date(value).toLocaleDateString();
            default:
                return String(value);
        }
    };

    return (
        <div
            className={`bg-gray-900 border border-gray-700 rounded-lg overflow-hidden ${className}`}
            data-ai-table="collapsible"
            data-ai-table-rows={data.length}
            data-ai-table-collapsed={isCollapsed}
            data-ai-table-virtualized={shouldVirtualize}
            data-testid="collapsible-table"
        >
            {/* Header with controls */}
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center space-x-4">
                    <span className="text-xs text-gray-400 font-mono">
                        Table ({filteredData.length} {filteredData.length === 1 ? 'row' : 'rows'})
                    </span>

                    {searchable && (
                        <input
                            type="text"
                            placeholder="Search table..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                track('table_searched', {
                                    query_length: e.target.value.length,
                                    total_rows: data.length
                                });
                            }}
                            className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            data-ai-search="table"
                        />
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    {data.length > maxRows && (
                        <button
                            onClick={() => {
                                setIsCollapsed(!isCollapsed);
                                track('table_toggle', {
                                    expanded: isCollapsed,
                                    total_rows: data.length,
                                    visible_rows: displayData.length
                                });
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1"
                            data-ai-action="toggle-table-collapse"
                            data-testid="table-collapse-button"
                        >
                            {isCollapsed ? `Show all ${filteredData.length} rows` : 'Collapse'}
                        </button>
                    )}
                </div>
            </div>

            {/* Table content */}
            <div
                ref={tableRef}
                className="overflow-auto"
                style={{ maxHeight: maxHeight }}
            >
                <table className="w-full text-sm">
                    <thead ref={headerRef} className="bg-gray-800 sticky top-0">
                        <tr>
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={`px-4 py-2 text-left text-gray-300 font-medium ${sortable && column.sortable ? 'cursor-pointer hover:text-white' : ''
                                        }`}
                                    onClick={() => column.sortable && handleSort(column.key)}
                                    style={{ width: column.width }}
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>{column.header}</span>
                                        {sortable && column.sortable && sortConfig?.key === column.key && (
                                            <span className="text-blue-400">
                                                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {shouldVirtualize && virtualizedStart > 0 && (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    style={{ height: virtualizedStart * 40 }}
                                    className="bg-gray-850"
                                />
                            </tr>
                        )}

                        {visibleData.map((row, index) => (
                            <tr
                                key={virtualizedStart + index}
                                className="border-b border-gray-700 hover:bg-gray-800/50"
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        className="px-4 py-2 text-gray-300"
                                    >
                                        {formatCellValue(row[column.key], column.type)}
                                    </td>
                                ))}
                            </tr>
                        ))}

                        {shouldVirtualize && virtualizedEnd < displayData.length && (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    style={{ height: (displayData.length - virtualizedEnd) * 40 }}
                                    className="bg-gray-850"
                                />
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isCollapsed && data.length > maxRows && (
                <div className="p-3 text-center border-t border-gray-700 bg-gray-800/50">
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="text-sm text-blue-400 hover:text-blue-300"
                    >
                        Show {filteredData.length - 10} more rows
                    </button>
                </div>
            )}
        </div>
    );
}

// Auto-detect and render tables in markdown
export function AutoTableBlock({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLElement> & { children: string }) {
    if (isTableContent(children)) {
        const { data, columns } = parseTableText(children);

        if (data.length > 0) {
            return (
                <CollapsibleTable
                    data={data}
                    columns={columns}
                    className="my-4"
                    {...props}
                />
            );
        }
    }

    // Fallback to regular pre block
    return (
        <pre className={`bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto ${className}`}>
            {children}
        </pre>
    );
}
