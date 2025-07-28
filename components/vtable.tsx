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
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
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

  const computedStyle = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const value = computedStyle.getPropertyValue(variable).trim();

  if (!value) {
    return '#000000';
  }

  // Handle HSL format from CSS variables (e.g., "300 89% 5%")
  if (value.includes(' ')) {
    const parts = value.split(/\s+/).filter(p => p);

    if (parts.length >= 3) {
      let h = parts[0];
      let s = parts[1];
      let l = parts[2];

      // Ensure percentages
      if (!s.includes('%')) s += '%';
      if (!l.includes('%')) l += '%';

      const hslString = `hsl(${h}, ${s}, ${l})`;
      const hex = hslToHex(hslString);
      return hex;
    }
  }

  // If it's already hex
  if (value.startsWith('#')) {
    return value;
  }

  // If it's a color name or other format, try to parse
  if (value.startsWith('rgb')) {
    return value; // Browser should handle this
  }

  return '#000000';
}

// Create VTable theme from current CSS variables
function createVTableThemeFromCSS(): any {
  const background = getCSSVariableAsHex('--background');
  const foreground = getCSSVariableAsHex('--foreground');
  const muted = getCSSVariableAsHex('--muted');
  const border = getCSSVariableAsHex('--border');

  // Create a clean theme object without functions for bgColor
  const theme = {
    defaultStyle: {
      borderLineWidth: 1,
      bgColor: background,
      color: foreground
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
      bgColor: background, // Solid background color, not a function
    },
    // Add containerStyle to force overall background
    containerStyle: {
      bgColor: background,
      backgroundColor: background
    },
    // Force frame styles
    frameStyle: {
      bgColor: background,
      backgroundColor: background,
      borderColor: border,
      borderLineWidth: 1
    },
    // Force underlay background
    underlayBackgroundColor: background,
    // Add scrollbar style
    scrollStyle: {
      bgColor: background,
      scrollBarColor: border,
      scrollRailColor: muted
    }
  };

  return theme;
}

// Register a single dynamic VTable theme that uses current CSS variables
function registerDynamicVTableTheme() {
  if (typeof window === 'undefined') return;

  const themeConfig = createVTableThemeFromCSS();

  // Register/re-register the theme with current CSS values
  VTable.register.theme('opensvm-dynamic', themeConfig);

  // Also register theme variants for each OpenSVM theme
  const currentTheme = typeof document !== 'undefined' ?
    document.documentElement.className.match(/theme-(\w+)/)?.[1] || 'cyberpunk' :
    'cyberpunk';
  const themeSpecificName = `opensvm-${currentTheme}`;
  VTable.register.theme(themeSpecificName, themeConfig);
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
  // Responsive behavior options
  minColumnWidth?: number; // Minimum width for flexible columns (default: 100)
  autoResize?: boolean; // Enable automatic resizing (default: true)
  responsive?: boolean; // Enable responsive behavior (default: true)
  // Enhanced UX options
  infiniteScroll?: boolean; // Enable infinite scroll (default: false)
  virtualScrolling?: boolean; // Enable virtual scrolling for large datasets (default: true)
  maxRows?: number; // Maximum rows to load/display (default: 1000000)
  initialLoadSize?: number; // Initial number of rows to load (default: 10000)
  scrollThreshold?: number; // Pixels from bottom to trigger load more (default: 200)
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
  onLoadMore,
  minColumnWidth = 100,
  autoResize = true,
  responsive = true,
  infiniteScroll = false,
  virtualScrolling = true,
  maxRows = 1000000,
  initialLoadSize = 10000,
  scrollThreshold = 200
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

          // Calculate dynamic column width to fill container responsively
          const containerWidth = containerRef.current.clientWidth;

          // Separate columns with fixed widths from flexible ones
          const fixedColumns = columns.filter(col => col.width);
          const flexibleColumns = columns.filter(col => !col.width);

          // Calculate remaining width for flexible columns
          const fixedWidth = fixedColumns.reduce((sum, col) => sum + (col.width || 0), 0);
          const availableWidth = Math.max(containerWidth - fixedWidth, 0);
          const flexColumnWidth = flexibleColumns.length > 0
            ? Math.floor(availableWidth / flexibleColumns.length)
            : 0;

          // Ensure minimum column width for readability
          const finalFlexWidth = Math.max(flexColumnWidth, minColumnWidth);

          const colsConfig = columns.map(col => ({
            ...col,
            width: col.width ?? finalFlexWidth
          }));
          // Get the dynamic theme name
          const vtableThemeName = getVTableThemeName();

          // Create table configuration with dynamic theme and responsive sizing
          const tableConfig = {
            container: containerRef.current,
            records: processedData,
            theme: vtableThemeName as any,
            defaultRowHeight: 48,
            defaultHeaderRowHeight: 48,
            overscrollBehavior: 'none',
            // Force background color in the table configuration
            bgColor: getCSSVariableAsHex('--background'),
            backgroundColor: getCSSVariableAsHex('--background'),
            // Set width to container width for responsive behavior
            width: containerWidth,
            // Auto-resize on container changes
            autoWidth: true,
            autoHeight: false,
            // Performance optimizations for large datasets (up to 1M rows)
            enableVirtualScroll: virtualScrolling,
            rowSeriesNumber: {
              enable: data.length > 1000, // Show row numbers for large datasets
              width: 60,
              headerStyle: {
                bgColor: getCSSVariableAsHex('--muted'),
                color: getCSSVariableAsHex('--muted-foreground'),
              }
            },
            // Advanced performance settings for handling up to 1M rows
            performance: {
              renderOptimization: true,
              enableAsyncRender: data.length > 50000,
              batchSize: Math.min(500, Math.max(100, Math.floor(initialLoadSize / 20))),
            },
            // Smooth scrolling and rendering
            scrollStyle: {
              scrollRatioY: data.length > 100000 ? 0.1 : 1, // Faster scroll for very large datasets
            },
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
                        html: `<div class="${bgClass}" style="position:absolute;left:0;top:0;width:100%;height:100%;z-index:-1;"></div>${col.render ? '' : (cellValue ?? '')
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
              if (typeof document !== 'undefined' && typeof navigator !== 'undefined') {
                const tmp = document.createElement('div');
                tmp.innerHTML = raw;
                const text = tmp.textContent || tmp.innerText || String(args.value);
                if (text && typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(text);
                }
              }
            } catch (_e) {
              // ignore
            }
            // existing row selection
            try {
              if (onRowSelect) {
                const rowId = args.cellKey?.rowKey;
                const record = data.find(r => rowKey(r) === rowId);
                if (record) onRowSelect(rowId);
              }
            } catch (_e) {
              // ignore selection errors
            }
          });

          // Double click to open account or transaction
          (table as any).on('dblclick_cell', (args: any) => {
            const val = args.value?.text ?? args.value;
            if (typeof val === 'string') {
              let url: string | null = null;
              if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val)) url = `/account/${val}`;
              else if (/^[A-Za-z0-9]{50,}$/.test(val)) url = `/tx/${val}`;
              if (url && typeof window !== 'undefined') {
                if (typeof window !== 'undefined') {
                  window.open(window.location.origin + url, '_blank');
                }
              }
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

          // Enhanced scroll handling for infinite scroll and load more
          if (onLoadMore) {
            if (infiniteScroll) {
              // Infinite scroll: load more when approaching bottom
              (table as any).on('scroll', (args: any) => {
                const { scrollTop, scrollHeight, clientHeight } = args;
                const bottomDistance = scrollHeight - scrollTop - clientHeight;

                if (bottomDistance <= scrollThreshold && data.length < maxRows) {
                  onLoadMore();
                }
              });
            } else {
              // Traditional load more: less aggressive triggering
              (table as any).on('scroll', (args: any) => {
                const { scrollTop, scrollHeight, clientHeight } = args;
                if (scrollHeight - scrollTop <= clientHeight * 1.2) {
                  onLoadMore();
                }
              });
            }
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
          let bgObserver: MutationObserver | null = null;

          // Force background color after table creation
          setTimeout(() => {
            if (containerRef.current) {
              const canvasElements = containerRef.current.querySelectorAll('canvas');
              const bgColor = getCSSVariableAsHex('--background');

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

          // Store cleanup function on the table ref for later cleanup
          (table as any).__cleanupBgFunctions = () => {
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

    // Set up ResizeObserver for responsive behavior
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && 'ResizeObserver' in window && responsive && autoResize) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width } = entry.contentRect;
          if (width > 0 && tableRef.current) {
            // Debounce resize to avoid excessive re-renders
            clearTimeout(timer);
            setTimeout(() => {
              if (tableRef.current && containerRef.current) {
                // Update table width
                tableRef.current.setWidth(width);

                // Recalculate column widths for responsive behavior
                const fixedColumns = columns.filter(col => col.width);
                const flexibleColumns = columns.filter(col => !col.width);
                const fixedWidth = fixedColumns.reduce((sum, col) => sum + (col.width || 0), 0);
                const availableWidth = Math.max(width - fixedWidth, 0);
                const flexColumnWidth = flexibleColumns.length > 0
                  ? Math.floor(availableWidth / flexibleColumns.length)
                  : 0;
                const finalFlexWidth = Math.max(flexColumnWidth, minColumnWidth);

                // Update column widths
                columns.forEach((col, index) => {
                  const newWidth = col.width ?? finalFlexWidth;
                  if (tableRef.current) {
                    tableRef.current.setColumnWidth(col.field, newWidth);
                  }
                });
              }
            }, 150); // 150ms debounce
          }
        }
      });

      resizeObserver.observe(containerRef.current);
    }

    // Rebuild table on window resize as fallback
    if (typeof window !== 'undefined') {
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', initTable);
      }
    }

    // Cleanup
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', initTable);
        }
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
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
  }, [
    columns,
    data,
    mounted,
    onLoadMore,
    onSort,
    onRowSelect,
    rowKey,
    onCellContextMenu,
    theme,
    autoResize,
    handleNavigation,
    handleRowClick,
    infiniteScroll,
    initialLoadSize,
    maxRows,
    minColumnWidth,
    pinnedRowIds,
    responsive,
    scrollThreshold,
    selectedRowId,
    virtualScrolling
  ]);

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
        <div>Loading data...</div>
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

  // Get the current background color for inline styles
  const bgColorHex = getCSSVariableAsHex('--background');

  return (
    <div className={`vtable-container vtable-full-width relative ${loading ? 'vtable-loading' : ''}`} style={{ width: '100%', height: '100%', backgroundColor: bgColorHex }} key={`vtable-${theme}`}>
      {/* Inject style tag to force background colors */}
      <style jsx>{`
        .vtable-container canvas {
          background: ${bgColorHex} !important;
          background-color: ${bgColorHex} !important;
        }
        .vtable-container .vtable {
          background: ${bgColorHex} !important;
          background-color: ${bgColorHex} !important;
        }
      `}</style>

      {/* Performance indicator */}
      {data.length > 1000 && (
        <div className="vtable-performance-indicator">
          {data.length.toLocaleString()} rows
          {virtualScrolling && ' • Virtual'}
          {infiniteScroll && ' • Infinite'}
        </div>
      )}

      {/* Table wrapper fills container responsively */}
      <div className="w-full h-full">
        <div
          className="vtable vtable-full-width"
          ref={containerRef}
          style={{ width: '100%', height: '100%' }}
          data-selected-row={selectedRowId || ''}
          data-theme={theme}
        />
      </div>

      {/* Infinite scroll loading indicator */}
      {loading && data.length > 0 && infiniteScroll && (
        <div className="vtable-infinite-loading">
          <div className="spinner" />
          Loading more rows...
        </div>
      )}

      {renderFloatingButton()}
    </div>
  );
}
