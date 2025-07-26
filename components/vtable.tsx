import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { ListTable } from '@visactor/vtable';
import * as VTable from '@visactor/vtable';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';


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
  
  // If it's space-separated values (like "240 100 20"), assume HSL without %
  if (value.includes(' ') && !value.includes('#') && !value.includes('rgb')) {
    const parts = value.split(/\s+/);
    if (parts.length >= 3) {
      const hslString = `hsl(${parts[0]}, ${parts[1]}%, ${parts[2]}%)`;
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
  // const mutedForeground = getCSSVariableAsHex('--muted-foreground'); // unused
  const border = getCSSVariableAsHex('--border');
  // const card = getCSSVariableAsHex('--card'); // unused

  console.log('VTable theme colors:', { background, foreground, muted, border });

  return {
    defaultStyle: {
      borderLineWidth: 1,
      bgColor: background // Force default background
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
        // Force alternating row colors to use theme background
        if (args.row % 2 === 1) {
          return muted;
        }
        return background;
      }
    },
    // Add containerStyle to force overall background
    containerStyle: {
      bgColor: background
    },
    // Force frame styles
    frameStyle: {
      bgColor: background,
      borderColor: border
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
  onCellContextMenu?: (value: any, record: any) => void; // New callback for right-click
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
  onCellContextMenu, // Destructure new prop
  pinnedRowIds = new Set(),
  onLoadMore
}: VTableProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  // const pathname = usePathname(); // unused
  const { theme } = useTheme();

  // Client-side navigation handler
  const handleNavigation = useCallback((href: string) => {
    if (href && typeof href === 'string') {
      router.push(href, { scroll: false });
    }
  }, [router]);

  // Handle row click for selection
  const handleRowClick = useCallback((rowData: any) => {
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

          // Calculate dynamic column width to fill container
          const totalWidth = containerRef.current.clientWidth;
          const dynamicWidth = Math.floor(totalWidth / columns.length);
          const colsConfig = columns.map(col => ({
            ...col,
            width: col.width ?? dynamicWidth
          }));
          // Get the dynamic theme name
          const vtableThemeName = getVTableThemeName();
          
          console.log('Creating VTable with dynamic theme:', vtableThemeName, 'for OpenSVM theme:', theme);

          // Create table configuration with dynamic theme
          const tableConfig = {
            container: containerRef.current,
            records: processedData,
            theme: vtableThemeName as any,
            defaultRowHeight: 48,
            defaultHeaderRowHeight: 48,
            overscrollBehavior: 'none',
            // Force background color in the table configuration
            bgColor: getCSSVariableAsHex('--background'),
            // Removing explicit width to allow responsive auto-sizing
            // width: containerRef.current.clientWidth,
            columns: colsConfig.map(col => ({
              field: col.field,
              title: col.header || col.title,
              width: col.width,
              sortable: !!col.sortable,
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
          // Casting to any to satisfy ListTableConstructorOptions typings
          const table = new ListTable(tableConfig as any);

          // Force background color after table creation
          setTimeout(() => {
            if (containerRef.current) {
              const canvasElements = containerRef.current.querySelectorAll('canvas');
              const bgColor = getCSSVariableAsHex('--background');
              console.log('Forcing VTable background color to:', bgColor);
              
              canvasElements.forEach(canvas => {
                canvas.style.background = bgColor;
                canvas.style.backgroundColor = bgColor;
                // Also set it as an attribute to prevent VTable from overriding
                canvas.setAttribute('data-bg-color', bgColor);
              });
              
              // Also set container background
              const vtableElement = containerRef.current.querySelector('.vtable');
              if (vtableElement) {
                (vtableElement as HTMLElement).style.background = bgColor;
                (vtableElement as HTMLElement).style.backgroundColor = bgColor;
              }

              // Set up a MutationObserver to watch for canvas changes
              const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                  if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                      if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;
                        if (element.tagName === 'CANVAS') {
                          (element as HTMLCanvasElement).style.background = bgColor;
                          (element as HTMLCanvasElement).style.backgroundColor = bgColor;
                        }
                        // Also check for canvas children
                        const canvases = element.querySelectorAll('canvas');
                        canvases.forEach(canvas => {
                          canvas.style.background = bgColor;
                          canvas.style.backgroundColor = bgColor;
                        });
                      }
                    });
                  }
                });
              });

              observer.observe(containerRef.current, {
                childList: true,
                subtree: true
              });

              // Clean up observer when component unmounts
              return () => observer.disconnect();
            }
          }, 50);

          // Also set up a periodic check to ensure background stays correct
          const intervalId = setInterval(() => {
            if (containerRef.current) {
              const canvasElements = containerRef.current.querySelectorAll('canvas');
              const bgColor = getCSSVariableAsHex('--background');
              canvasElements.forEach(canvas => {
                if (canvas.style.backgroundColor !== bgColor) {
                  console.log('VTable background was reset, forcing it back to:', bgColor);
                  canvas.style.background = bgColor;
                  canvas.style.backgroundColor = bgColor;
                }
              });
            }
          }, 500); // Check every 500ms

          // Add click handler for copy on single click
          (table as any).on('click_cell', (args: any) => {
            try {
              const raw = args.value?.html ?? args.value;
              const tmp = document.createElement('div');
              tmp.innerHTML = raw;
              const text = tmp.textContent || tmp.innerText || String(args.value);
              if (text) navigator.clipboard.writeText(text);
            } catch (_e) {
              // ignore
            }
            // existing row selection
            if (onRowSelect) {
              const rowId = args.cellKey?.rowKey;
              const record = data.find(r => rowKey(r) === rowId);
              if (record) onRowSelect(rowId);
            }
          });

          // Double click to open account or transaction
          (table as any).on('dblclick_cell', (args: any) => {
            const val = args.value?.text ?? args.value;
            if (typeof val === 'string') {
              let url: string | null = null;
              if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val)) url = `/account/${val}`;
              else if (/^[A-Za-z0-9]{50,}$/.test(val)) url = `/tx/${val}`;
              if (url) window.open(window.location.origin + url, '_blank');
            }
          });

          // Right click for context menu callback
          (table as any).on('contextmenu_cell', (args: any) => {
            args.domEvent.preventDefault();
            const rowId = args.cellKey?.rowKey;
            const record = data.find(r => rowKey(r) === rowId);
            const val = args.value?.text ?? args.value;
            if (record && onCellContextMenu) onCellContextMenu(val, record);
          });

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
                handleRowClick(rowData);
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

          // Store cleanup functions
          let bgCheckInterval: NodeJS.Timeout | null = null;
          let bgObserver: MutationObserver | null = null;

          // Force background color after table creation
          setTimeout(() => {
            if (containerRef.current) {
              const canvasElements = containerRef.current.querySelectorAll('canvas');
              const bgColor = getCSSVariableAsHex('--background');
              console.log('Forcing VTable background color to:', bgColor);
              
              canvasElements.forEach(canvas => {
                canvas.style.background = bgColor;
                canvas.style.backgroundColor = bgColor;
                // Also set it as an attribute to prevent VTable from overriding
                canvas.setAttribute('data-bg-color', bgColor);
              });
              
              // Also set container background
              const vtableElement = containerRef.current.querySelector('.vtable');
              if (vtableElement) {
                (vtableElement as HTMLElement).style.background = bgColor;
                (vtableElement as HTMLElement).style.backgroundColor = bgColor;
              }

              // Set up a MutationObserver to watch for canvas changes
              bgObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                  if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                      if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;
                        if (element.tagName === 'CANVAS') {
                          (element as HTMLCanvasElement).style.background = bgColor;
                          (element as HTMLCanvasElement).style.backgroundColor = bgColor;
                        }
                        // Also check for canvas children
                        const canvases = element.querySelectorAll('canvas');
                        canvases.forEach(canvas => {
                          canvas.style.background = bgColor;
                          canvas.style.backgroundColor = bgColor;
                        });
                      }
                    });
                  }
                });
              });

              bgObserver.observe(containerRef.current, {
                childList: true,
                subtree: true
              });
            }
          }, 50);

          // Also set up a periodic check to ensure background stays correct
          bgCheckInterval = setInterval(() => {
            if (containerRef.current) {
              const canvasElements = containerRef.current.querySelectorAll('canvas');
              const bgColor = getCSSVariableAsHex('--background');
              canvasElements.forEach(canvas => {
                if (canvas.style.backgroundColor !== bgColor) {
                  console.log('VTable background was reset, forcing it back to:', bgColor);
                  canvas.style.background = bgColor;
                  canvas.style.backgroundColor = bgColor;
                }
              });
            }
          }, 500); // Check every 500ms

          // Store cleanup functions on the table ref for later cleanup
          (table as any).__cleanupBgFunctions = () => {
            if (bgCheckInterval) {
              clearInterval(bgCheckInterval);
              bgCheckInterval = null;
            }
            if (bgObserver) {
              bgObserver.disconnect();
              bgObserver = null;
            }
          };
        });
      } catch (err) {
        console.error('Failed to initialize table:', err);
      }
    };

    // Initialize table with delay to ensure container is ready
    const timer = setTimeout(initTable, 100);
    // Rebuild table on window resize to adjust column widths
    window.addEventListener('resize', initTable);

    // Cleanup
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', initTable);
      if (tableRef.current) {
        try {
          // Clean up background forcing functions
          if ((tableRef.current as any).__cleanupBgFunctions) {
            (tableRef.current as any).__cleanupBgFunctions();
          }
          tableRef.current.dispose();
          tableRef.current = null;
        } catch (err) {
          console.error('Failed to dispose table:', err);
        }
      }
    };
  }, [columns, data, mounted, onLoadMore, onSort, onRowSelect, rowKey, onCellContextMenu, theme]);

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
    <div className="vtable-container relative" style={{ width: '100%', height: '100%' }} key={`vtable-${theme}`}>
      {/* Table wrapper fills container; horizontal scroll only if necessary */}
      <div className="w-full h-full">
        <div
          className="vtable w-full"
          ref={containerRef}
          style={{ width: '100%', height: '100%' }}
           data-selected-row={selectedRowId || ''}
           data-theme={theme}
        />
      </div>
      
      {renderFloatingButton()}
    </div>
  );
}
