'use client';

import { useState, useRef, useEffect } from 'react';
import { type BaseTransactionInfo } from '@/lib/solana';
import * as VTable from '@visactor/vtable';
import type { ListTableConstructorOptions, ColumnDefine } from '@visactor/vtable';

interface TransactionTableProps {
  transactions: BaseTransactionInfo[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function TransactionTable({ transactions, isLoading, hasMore, onLoadMore }: TransactionTableProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const tableInstanceRef = useRef<any>(null);

  const [columnDefs] = useState<ColumnDefine[]>([
    { 
      field: 'signature', 
      title: 'Signature', 
      width: 200,
      customRender: (args: any) => ({
        type: 'text',
        value: `${args.value.slice(0, 4)}...${args.value.slice(-4)}`,
        expectedHeight: 40,
        expectedWidth: 200,
        elements: []
      })
    },
    { field: 'type', title: 'Type', width: 100 },
    { 
      field: 'amount', 
      title: 'Amount', 
      width: 150,
      customRender: (args: any) => ({
        type: 'text',
        value: args.row.amount === undefined ? '-' : 
          `${args.row.amount} ${args.row.type === 'sol' ? 'SOL' : args.row.symbol || ''}`,
        expectedHeight: 40,
        expectedWidth: 150,
        elements: []
      })
    },
    { 
      field: 'success', 
      title: 'Status', 
      width: 100,
      customRender: (args: any) => ({
        type: 'text',
        value: args.value ? 'Success' : 'Failed',
        expectedHeight: 40,
        expectedWidth: 100,
        elements: []
      })
    }
  ]);

  useEffect(() => {
    if (!tableRef.current || !transactions.length) return undefined;

    const option: ListTableConstructorOptions = {
      records: transactions,
      columns: columnDefs,
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
    if (!tableRef.current) return undefined;
    
    {
      tableInstanceRef.current = new VTable.ListTable({
        ...option,
        container: tableRef.current,
        defaultRowHeight: 40,
        defaultHeaderRowHeight: 40,
        widthMode: 'standard' as const,
        heightMode: 'standard' as const
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (tableRef.current && tableInstanceRef.current) {
          const newRect = tableRef.current.getBoundingClientRect();
          tableInstanceRef.current.resize(newRect.width, newRect.height);
        }
      });

      resizeObserver.observe(tableRef.current);

      // Cleanup
      return () => {
        resizeObserver.disconnect();
        if (tableInstanceRef.current) {
          tableInstanceRef.current.dispose();
        }
      };
    }
  }, [transactions, columnDefs]);

  return (
    <div className="w-full">
      <div 
        ref={tableRef} 
        style={{ 
          width: '100%',
          height: Math.min(transactions.length * 40 + 40, 400), // 40px per row + header, max 400px
          minHeight: 80 // Minimum height for header + one row
        }} 
      />
      
      {hasMore && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
