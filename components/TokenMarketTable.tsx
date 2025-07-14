'use client';

import { useEffect, useRef } from 'react';
import * as VTable from '@visactor/vtable';
import type { ListTableConstructorOptions, ColumnDefine } from '@visactor/vtable';
import type { TokenMarketData, TokenGainerData, NewTokenData } from '@/types/token-market';
import { formatNumber, formatCurrency, formatPercentage } from '@/utils/format';

interface TokenMarketTableProps {
  tokens: TokenMarketData[];
  type: 'all' | 'gainers' | 'new';
  onTokenClick: (address: string) => void;
  isLoading?: boolean;
}

export default function TokenMarketTable({ tokens, type, onTokenClick, isLoading }: TokenMarketTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !tokens.length || isLoading) return undefined;

    const getColumns = (): ColumnDefine[] => {
      const baseColumns: ColumnDefine[] = [
        {
          field: 'rank',
          title: '#',
          width: 50,
          cellType: 'text',
          style: {
            textAlign: 'center',
            fontWeight: 'bold',
            color: 'var(--muted-foreground)'
          }
        },
        {
          field: 'icon',
          title: '',
          width: 40,
          cellType: 'image',
          style: {
            padding: [2, 2, 2, 2]
          },
          formatCell: (value: string | undefined) => ({
            src: value || '/images/token-default.png',
            width: 24,
            height: 24,
            shape: 'circle',
            style: {
              border: '1px solid var(--border)'
            }
          })
        },
        {
          field: 'name',
          title: 'Token',
          width: 200,
          showSort: true,
          style: {
            fontWeight: '500'
          },
          formatCell: (value: string, row: TokenMarketData) => {
            return `${value}\n${row.symbol.toUpperCase()}`;
          }
        },
        {
          field: 'price',
          title: 'Price',
          width: 120,
          showSort: true,
          style: {
            textAlign: 'right'
          },
          formatCell: (value: number) => {
            return value ? formatCurrency(value) : '-';
          }
        }
      ];

      if (type === 'gainers') {
        baseColumns.push(
          {
            field: 'priceChange24h',
            title: '24h Change',
            width: 120,
            showSort: true,
            style: {
              textAlign: 'right'
            },
            formatCell: (value: number, row: TokenGainerData) => {
              const changePercent = row.priceChangePercentage24h || 0;
              const color = changePercent >= 0 ? '#22c55e' : '#ef4444';
              return `${formatCurrency(value)}\n${formatPercentage(changePercent)}`;
            },
            style: (value: number, row: TokenGainerData) => {
              const changePercent = row.priceChangePercentage24h || 0;
              return {
                textAlign: 'right',
                color: changePercent >= 0 ? '#22c55e' : '#ef4444'
              };
            }
          }
        );
      } else if (type === 'new') {
        baseColumns.push(
          {
            field: 'createdAt',
            title: 'Listed',
            width: 120,
            showSort: true,
            formatCell: (value: string, row: NewTokenData) => {
              const daysOld = row.daysOld || 0;
              return daysOld === 0 ? 'Today' : `${daysOld}d ago`;
            }
          }
        );
      } else {
        baseColumns.push(
          {
            field: 'priceChangePercentage24h',
            title: '24h %',
            width: 100,
            showSort: true,
            style: {
              textAlign: 'right'
            },
            formatCell: (value: number) => {
              return formatPercentage(value);
            },
            style: (value: number) => {
              return {
                textAlign: 'right',
                color: value >= 0 ? '#22c55e' : '#ef4444'
              };
            }
          }
        );
      }

      baseColumns.push(
        {
          field: 'marketCap',
          title: 'Market Cap',
          width: 120,
          showSort: true,
          style: {
            textAlign: 'right'
          },
          formatCell: (value: number) => {
            return value ? formatCurrency(value, true) : '-';
          }
        },
        {
          field: 'volume24h',
          title: '24h Volume',
          width: 120,
          showSort: true,
          style: {
            textAlign: 'right'
          },
          formatCell: (value: number) => {
            return value ? formatCurrency(value, true) : '-';
          }
        }
      );

      return baseColumns;
    };

    // Create VTable instance
    const option: ListTableConstructorOptions = {
      records: tokens.map((token, index) => ({ ...token, rank: index + 1 })),
      columns: getColumns(),
      widthMode: 'standard' as const,
      heightMode: 'standard' as const,
      defaultRowHeight: 50,
      hover: {
        highlightMode: 'row' as const,
        disableHover: false
      },
      theme: VTable.themes.DEFAULT.extends({
        defaultStyle: {
          hover: {
            cellBgColor: 'var(--muted)',
            inlineRowBgColor: 'var(--muted)'
          },
          borderLineWidth: 1,
          borderColor: 'var(--border)',
          color: 'var(--foreground)',
          bgColor: 'var(--background)',
          fontSize: 14,
          fontFamily: 'inherit'
        },
        headerStyle: {
          bgColor: 'var(--muted)',
          color: 'var(--foreground)',
          fontWeight: 600,
          fontSize: 14,
          borderLineWidth: 1,
          borderColor: 'var(--border)'
        },
        frameStyle: {
          borderColor: 'var(--border)',
          borderLineWidth: 1
        },
        underlayBackgroundColor: 'var(--background)'
      })
    };

    // Initialize table
    if (containerRef.current) {
      tableInstanceRef.current = new VTable.ListTable({
        ...option,
        container: containerRef.current,
        defaultRowHeight: 50,
        defaultHeaderRowHeight: 45,
        widthMode: 'standard' as const,
        heightMode: 'standard' as const
      });

      // Add click handler
      tableInstanceRef.current.on('click_cell', (args: any) => {
        const rowData = tokens[args.row];
        if (rowData) {
          onTokenClick(rowData.address);
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && tableInstanceRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          tableInstanceRef.current.resize(rect.width, rect.height);
        }
      });

      resizeObserver.observe(containerRef.current);

      // Cleanup
      return () => {
        resizeObserver.disconnect();
        if (tableInstanceRef.current) {
          tableInstanceRef.current.dispose();
        }
      };
    }
    return undefined;
  }, [tokens, type, onTokenClick, isLoading]);

  if (isLoading) {
    return (
      <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-muted-foreground">Loading tokens...</span>
        </div>
      </div>
    );
  }

  if (!tokens.length) {
    return (
      <div className="w-full border border-border rounded-lg overflow-hidden bg-background">
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">No tokens found</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full border border-border rounded-lg overflow-hidden bg-background"
      style={{ 
        height: Math.min(tokens.length * 50 + 45, 600), // 50px per row + header, max 600px
        minHeight: 200 // Minimum height
      }}
    />
  );
}