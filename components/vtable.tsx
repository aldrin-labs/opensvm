import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { ListTable } from '@visactor/vtable';
import * as VTable from '@visactor/vtable';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme';

type Theme = 'paper' | 'high-contrast' | 'dos-blue' | 'cyberpunk' | 'solarized';

// Utility function to convert HSL to hex color
function hslToHex(hsl: string): string {
  const hslMatch = hsl.match(/hsl\((\d+(?:\.\d+)?),?\s*(\d+(?:\.\d+)?)%,?\s*(\d+(?:\.\d+)?)%\)/);
  if (!hslMatch) {
    // If it's already a hex color or other format, return as is
    return hsl.startsWith('#') ? hsl : '#000000';
  }

  const h = parseFloat(hslMatch[1]) / 360;
  const s = parseFloat(hslMatch[2]) / 100;
  const l = parseFloat(hslMatch[3]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Get computed CSS variable value and convert to hex
function getCSSVariableAsHex(variable: string): string {
  if (typeof window === 'undefined') return '#000000';
  
  const computedStyle = getComputedStyle(document.documentElement);
  const value = computedStyle.getPropertyValue(variable).trim();
  
  if (!value) return '#000000';
  
  // If it's HSL format (like "240 100% 20%"), convert to proper HSL string
  if (value.includes('%')) {
    const parts = value.split(/\s+/);
    if (parts.length >= 3) {
      const hslString = `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
      return hslToHex(hslString);
    }
  }
  
  // If it's already hex or other format, return as is
  return value.startsWith('#') ? value : '#000000';
}

// Create VTable theme from current CSS variables
function createVTableThemeFromCSS(): any {
  const background = getCSSVariableAsHex('--background');
  const foreground = getCSSVariableAsHex('--foreground');
  const muted = getCSSVariableAsHex('--muted');
  const mutedForeground = getCSSVariableAsHex('--muted-foreground');
  const border = getCSSVariableAsHex('--border');
  const card = getCSSVariableAsHex('--card');

  return {
    defaultStyle: {
      borderLineWidth: 1
    },
    headerStyle: {
      bgColor: muted,
      borderColor: border,
      fontWeight: 'bold',
      color: foreground,
      fontSize: 14,
      fontFamily: 'ui-sans-serif, system-ui, sans-serif'
    },
    rowHeaderStyle: {
      bgColor: muted,
      borderColor: border,
      borderLineWidth: 1,
      fontWeight: 'normal',
      color: foreground
    },
    cornerHeaderStyle: {
      bgColor: muted,
      fontWeight: 'bold',
      color: foreground
    },
    bodyStyle: {
      borderColor: border,
      borderLineWidth: 1,
      color: foreground,
      fontSize: 14,
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      bgColor: (args: any) => {
        if (args.row % 2 === 1) {
          return muted;
        }
        return background;
      }
    }
  };
}

// Register a single dynamic VTable theme that uses current CSS variables
function registerDynamicVTableTheme() {
  if (typeof window === 'undefined') return;
  
  const themeConfig = createVTableThemeFromCSS();
  console.log('Registering dynamic VTable theme with config:', themeConfig);
  
  // Register/re-register the theme with current CSS values
  VTable.register.theme('opensvm-dynamic', themeConfig);
}

// Get the dynamic theme name
function getVTableThemeName(): string {
  return 'opensvm-dynamic';
}

interface Column {
  field: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, record: any) => React.ReactNode;
  sortable?: boolean;
  onSort?: () => void;
  key?: string;
  header?: string;
}

interface VTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  error?: string;
  onSort?: (field: string, order: 'asc' | 'desc' | null) => void;
  selectedRowId?: string | null;
  onRowSelect?: (rowId: string) => void;
  renderRowAction?: (rowId: string) => ReactNode;
  rowKey?: (record: any) => string;
  pinnedRowIds?: Set<string>;
  onLoadMore?: () => void;
}

export function VTableWrapper({
  columns,
  data,
  loading,
  error,
  selectedRowId = null,
  onRowSelect,
  renderRowAction,
  rowKey = row => row.id,
  onSort,
  pinnedRowIds = new Set(),
  onLoadMore
}: VTableProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();

  // Client-side navigation handler
  const handleNavigation = useCallback((href: string) => {
    if (href && typeof href === 'string') {
      router.push(href, { scroll: false });
    }
  }, [router]);

  // Handle row click for selection
  const handleRowClick = useCallback((rowData: any, e: any) => {
    if (onRowSelect && rowData) {
      const id = rowKey(rowData);
      onRowSelect(id);
    }
  }, [onRowSelect, rowKey]);

  // Register dynamic theme and set mounted state
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || !data.length) { return; }

    const initTable = () => {
      if (!containerRef.current) { return; }

      try {
        // Dispose existing table if any
        if (tableRef.current) {
          tableRef.current.dispose();
          tableRef.current = null;
        }

        // Clear the container to ensure fresh start
        containerRef.current.innerHTML = '';
        
        // Register/update dynamic theme with current CSS values
        registerDynamicVTableTheme();
        
        // Wait for the next frame to ensure DOM is updated
        requestAnimationFrame(() => {
          if (!containerRef.current) { return; }
          
          // Process data to add selection state
          const processedData = data.map(row => {
            const rowId = rowKey(row);
            const isSelected = selectedRowId === rowId;
            const isPinned = pinnedRowIds.has(rowId);
            
            return {
              ...row,
              __vtableRowId: rowId,
              __isSelected: isSelected,
              __isPinned: isPinned
            };
          });

          // Get the dynamic theme name
          const vtableThemeName = getVTableThemeName();
          
          console.log('Creating VTable with dynamic theme:', vtableThemeName, 'for OpenSVM theme:', theme);
          
          // Create table configuration with dynamic theme
          const tableConfig = {
            container: containerRef.current,
            records: processedData,
            theme: vtableThemeName, // Use the dynamic theme name
            defaultRowHeight: 48,
            defaultHeaderRowHeight: 48,
            overscrollBehavior: 'none',
            columns: columns.map(col => ({
            field: col.field,
            title: col.header || col.title,
            width: col.width || 150,
            sortable: !!col.sortable, // Ensure boolean to fix TypeScript error
            ...(col.align && { textAlign: col.align }),
            render: (args: any) => {
              try {
                // Ensure the value is properly extracted from the row data
                const cellValue = args.row[col.field];
                
              // Skip for internal fields used for selection/state
                if (col.field.startsWith('__')) {
                  return '';
                }

                // Add row styling based on selection/pinned status
                if (col.field === columns[0].field) {
                  const isSelected = args.row.__isSelected;
                  const isPinned = args.row.__isPinned;
                  let bgClass = '';
                  
                  if (isPinned) {
                    bgClass = 'bg-yellow-50 dark:bg-yellow-900/20';
                  } else if (isSelected) {
                    bgClass = 'bg-blue-50 dark:bg-blue-900/20';
                  }
                  
                  if (bgClass) {
                    return {
                      html: `<div class="${bgClass}" style="position:absolute;left:0;top:0;width:100%;height:100%;z-index:-1;"></div>${
                        col.render ? '' : (cellValue ?? '')
                      }`,
                    };
                  }
                }

                // Extract value with proper fallback to ensure something is always displayed
                const rendered = col.render?.(cellValue ?? null, args.row) ?? cellValue;

                // Handle React elements
                if (rendered && typeof rendered === 'object' && 'type' in rendered) {
                  // Handle Next.js Link components
                  if (rendered.type?.displayName === 'Link' || rendered.type === 'a') {
                    const { href, children: content } = rendered.props;
                    
                    // Extract the text to display in the cell
                    const text = typeof content === 'string' ? content : 
                      (content && typeof content === 'object' && 'props' in content) ? content.props.children : cellValue ?? '';
                    
                    return {
                      html: `<a href="javascript:void(0)" data-href="${href || '#'}" class="text-blue-500 hover:text-blue-600 hover:underline">${text}</a>`,
                      action: () => handleNavigation(href)
                    };
                  }

                  // Handle divs with content (commonly used for cell formatting)
                  if (rendered.type === 'div') {
                    const className = rendered.props.className || '';
                    let divContent = rendered.props.children;
                    
                    // Handle different types of children content
                    let textContent = '';
                    
                    if (typeof divContent === 'string') {
                      textContent = divContent;
                    } else if (Array.isArray(divContent)) {
                      // Join array content with spaces
                      textContent = divContent.map(item => 
                        typeof item === 'string' ? item : 
                        (item && typeof item === 'object' && 'props' in item) ? item.props.children || '' : ''
                      ).join(' ');
                    } else if (divContent && typeof divContent === 'object') {
                      // Extract from React element if possible
                      textContent = 'props' in divContent ? (divContent.props?.children || '') : 
                        (JSON.stringify(divContent) !== '{}' ? JSON.stringify(divContent) : '');
                    } else {
                      // Fallback to cell value
                      textContent = cellValue ?? '';
                    }
                    
                    return {
                      html: `<div class="${className}">${textContent}</div>`
                    };
                  }

                  // Handle span elements
                  if (rendered.type === 'span') {
                    const className = rendered.props.className || '';
                    return {
                      html: `<span class="${className}">${rendered.props.children}</span>`
                    };
                  }
                  
                  // Default to children content
                  return rendered.props?.children ?? cellValue ?? '';
                }

                // Handle plain values
                return rendered ?? (cellValue ?? '');
              } catch (err) {
                console.error('Cell render error:', err);
                return '';
              }
            }
          })),
        };

          // Create the table with the configuration
          const table = new ListTable(tableConfig);

          // Log theme application for debugging
          console.log('VTable created successfully with dynamic theme:', vtableThemeName, 'Table instance:', table);

          if (onLoadMore) {
            (table as any).on('scroll', (args: any) => {
              const { scrollTop, scrollHeight, clientHeight } = args;
              if (scrollHeight - scrollTop <= clientHeight * 1.5) {
                onLoadMore();
              }
            });
          }
          
          // Add click handler for cell interactions
          (table as any).on('click_cell', (args: any) => {
            // First check if we have a cell action (link click)
            const cellValue = args.value ?? {};
            const cellAction = cellValue.action || args.cellActionOption?.action;
            
            if (typeof cellAction === 'function') {
              cellAction();
              return; // Don't trigger row selection if we clicked a link
            }
            
            // If no cell action, handle row selection
            if (onRowSelect) {
              const rowData = args.cellKey?.rowKey ? 
                processedData.find(r => r.__vtableRowId === args.cellKey.rowKey) : 
                null;
              
              if (rowData) {
                handleRowClick(rowData, args);
              }
            }
          });

          if (onSort) {
            // Use any to bypass type checking for now
            (table as any).on('sortClick', (args: any) => {
              const { field, order } = args;
              onSort(field, order);
            });
          }

          tableRef.current = table;
        });
      } catch (err) {
        console.error('Failed to initialize table:', err);
      }
    };

    // Initialize table with delay to ensure container is ready
    const timer = setTimeout(initTable, 100);

    // Cleanup
    return () => {
      clearTimeout(timer);
      if (tableRef.current) {
        try {
          tableRef.current.dispose();
          tableRef.current = null;
        } catch (err) {
          console.error('Failed to dispose table:', err);
        }
      }
    };
  }, [columns, data, mounted, onLoadMore, onSort, handleNavigation, selectedRowId, pinnedRowIds, rowKey, onRowSelect, handleRowClick, theme]);

  if (error) {
    return (
      <div className="vtable-error">
        {error}
      </div>
    );
  }

  if (loading && !data.length) {
    return (
      <div className="vtable-loading">
        <div className="vtable-loading-spinner" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="vtable-empty">
        No data available
      </div>
    );
  }
  
  // Render the floating pin button for selected row
  const renderFloatingButton = () => {
    if (!selectedRowId || !renderRowAction) {
      return null;
    }
    
    return (
      <div className="vtable-floating-action">
        {renderRowAction(selectedRowId)}
      </div>
    );
  };

  return (
    <div className="vtable-container relative" style={{ height: '100%' }} key={`vtable-${theme}`}>
      <div 
        className="vtable" 
        ref={containerRef} 
        style={{ width: '100%', height: '100%' }}
        data-selected-row={selectedRowId || ''}
        data-theme={theme}
      />
      
      {renderFloatingButton()}
    </div>
  );
}
