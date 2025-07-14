'use client';

import { VTableWrapper } from '@/components/vtable';
import { useTheme } from '@/lib/theme';

// Mock data for testing
const mockData = [
  {
    id: '1',
    name: 'Test Item 1',
    value: 100,
    symbol: 'SOL',
    description: 'First test item'
  },
  {
    id: '2',
    name: 'Test Item 2',
    value: 250,
    symbol: 'USDC',
    description: 'Second test item'
  },
  {
    id: '3',
    name: 'Test Item 3',
    value: 75,
    symbol: 'USDT',
    description: 'Third test item'
  }
];

const columns = [
  {
    field: 'name',
    title: 'Name',
    width: 150,
    sortable: true,
  },
  {
    field: 'value',
    title: 'Value',
    width: 100,
    sortable: true,
  },
  {
    field: 'symbol',
    title: 'Symbol',
    width: 100,
    sortable: true,
  },
  {
    field: 'description',
    title: 'Description',
    width: 200,
    sortable: false,
  }
];

export default function TestVTable() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">VTable Theme Test</h1>
      
      <div className="flex gap-2">
        <span>Current theme: {theme}</span>
        <button 
          onClick={() => setTheme('paper')} 
          className="px-3 py-1 bg-gray-200 rounded"
        >
          Paper
        </button>
        <button 
          onClick={() => setTheme('high-contrast')} 
          className="px-3 py-1 bg-gray-200 rounded"
        >
          High Contrast
        </button>
        <button 
          onClick={() => setTheme('dos-blue')} 
          className="px-3 py-1 bg-gray-200 rounded"
        >
          DOS Blue
        </button>
        <button 
          onClick={() => setTheme('cyberpunk')} 
          className="px-3 py-1 bg-gray-200 rounded"
        >
          Cyberpunk
        </button>
        <button 
          onClick={() => setTheme('solarized')} 
          className="px-3 py-1 bg-gray-200 rounded"
        >
          Solarized
        </button>
      </div>
      
      <div className="border rounded-lg h-96">
        <VTableWrapper
          columns={columns}
          data={mockData}
          rowKey={(row) => row.id}
          loading={false}
        />
      </div>
    </div>
  );
}