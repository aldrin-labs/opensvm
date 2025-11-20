import React, { useEffect, useRef } from 'react';
import * as VTable from '@visactor/vtable';
import type { ListTableConstructorOptions, ColumnDefine } from '@visactor/vtable';
import type { TokenAccount } from '@/lib/solana/solana';

interface TokenTableProps {
  tokens: TokenAccount[];
  onTokenClick: (address: string) => void;
}

export default function TokenTable({ tokens, onTokenClick }: TokenTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !tokens.length) return undefined;

    // Create VTable instance
    const option: ListTableConstructorOptions = {
      records: tokens,
      columns: ([
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
          field: 'symbol',
          title: 'Token',
          width: 100,
          showSort: true
        },
        {
          field: 'uiAmount',
          title: 'Amount',
          width: 150,
          showSort: true,
          formatCell: (value: number, row: TokenAccount) => {
            return `${Number(value || 0).toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: row.decimals
            })} ${row.symbol}`;
          }
        },
        {
          field: 'usdValue',
          title: 'Value',
          width: 100,
          showSort: true,
          formatCell: (value: number) => {
            return value > 0 ? `$${value.toFixed(2)}` : '-';
          }
        }
      ] as ColumnDefine[]),
      widthMode: 'standard' as const,
      heightMode: 'standard' as const,
      defaultRowHeight: 40,
      hover: {
        highlightMode: 'row' as const,
        disableHover: false
      },
      theme: VTable.themes.DEFAULT.extends({
        defaultStyle: {
          hover: {
            cellBgColor: 'hsl(var(--muted))',
            inlineRowBgColor: 'hsl(var(--muted))'
          },
          borderLineWidth: 1,
          borderColor: 'hsl(var(--border))',
          color: 'hsl(var(--foreground))',
          bgColor: 'hsl(var(--background))',
          fontSize: 14,
          fontFamily: 'inherit'
        },
        headerStyle: {
          bgColor: 'hsl(var(--muted))',
          color: 'hsl(var(--foreground))',
          fontWeight: 500,
          fontSize: 14,
          borderLineWidth: 1,
          borderColor: 'hsl(var(--border))'
        },
        frameStyle: {
          borderColor: 'hsl(var(--border))',
          borderLineWidth: 1
        },
        underlayBackgroundColor: 'hsl(var(--background))'
      })
    };

    // Initialize table
    if (containerRef.current) {
      tableInstanceRef.current = new VTable.ListTable({
        ...option,
        container: containerRef.current,
        defaultRowHeight: 40,
        defaultHeaderRowHeight: 40,
        widthMode: 'standard' as const,
        heightMode: 'standard' as const
      });

      // Add click handler
      tableInstanceRef.current.on('click_cell', (args: any) => {
        const rowData = tokens[args.row];
        if (rowData) {
          onTokenClick(rowData.address || '');
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && tableInstanceRef.current) {
          const newRect = containerRef.current.getBoundingClientRect();
          tableInstanceRef.current.resize(newRect.width, newRect.height);
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
  }, [tokens, onTokenClick]);

  return (
    <div 
      ref={containerRef} 
      className="w-full border border-border rounded-lg overflow-hidden bg-background"
      style={{ 
        height: Math.min(tokens.length * 40 + 40, 400), // 40px per row + header, max 400px
        minHeight: 80 // Minimum height for header + one row
      }}
    />
  );
}
