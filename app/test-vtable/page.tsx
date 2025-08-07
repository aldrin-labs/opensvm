"use client";

export const dynamic = 'force-dynamic';

import NextDynamic from 'next/dynamic';
import { useSettings } from '@/app/providers/SettingsProvider';
import { useState } from 'react';

// Dynamic import to ensure client-side only
const VTableWrapper = NextDynamic(() => import('@/components/vtable').then(mod => ({ default: mod.VTableWrapper })), {
  ssr: false,
  loading: () => <div className="p-4">Loading VTable...</div>
});

const testData = [
  { id: 1, name: 'John Doe', age: 30, city: 'New York', email: 'john@example.com', phone: '+1-555-0123', address: '123 Main St', company: 'Tech Corp' },
  { id: 2, name: 'Jane Smith', age: 25, city: 'Los Angeles', email: 'jane@example.com', phone: '+1-555-0456', address: '456 Oak Ave', company: 'Design Inc' },
  { id: 3, name: 'Bob Johnson', age: 35, city: 'Chicago', email: 'bob@example.com', phone: '+1-555-0789', address: '789 Pine St', company: 'Finance Ltd' },
  { id: 4, name: 'Alice Brown', age: 28, city: 'Houston', email: 'alice@example.com', phone: '+1-555-0012', address: '012 Elm Dr', company: 'Health Plus' },
  { id: 5, name: 'Charlie Wilson', age: 32, city: 'Phoenix', email: 'charlie@example.com', phone: '+1-555-0345', address: '345 Maple Ln', company: 'Auto Works' },
];

export default function TestVTable() {
  const settings = useSettings();
  const [containerWidth, setContainerWidth] = useState('100%');
  const [showAllColumns, setShowAllColumns] = useState(false);

  const basicColumns = [
    { field: 'id', title: 'ID', width: 80, sortable: true },
    { field: 'name', title: 'Name', sortable: true },
    { field: 'age', title: 'Age', width: 100, sortable: true },
    { field: 'city', title: 'City', sortable: true },
  ];

  const allColumns = [
    { field: 'id', title: 'ID', width: 80, sortable: true },
    { field: 'name', title: 'Name', sortable: true },
    { field: 'age', title: 'Age', width: 100, sortable: true },
    { field: 'city', title: 'City', sortable: true },
    { field: 'email', title: 'Email', sortable: true },
    { field: 'phone', title: 'Phone', width: 150, sortable: true },
    { field: 'address', title: 'Address', sortable: true },
    { field: 'company', title: 'Company', sortable: true },
  ];

  const handleSort = (field: string, order: 'asc' | 'desc' | null) => {
    console.log('Sort:', field, order);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">VTable Responsive Test</h1>
        <p className="text-muted-foreground">
          Test VTable responsiveness with different container sizes and column configurations.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-card rounded-lg border">
        <div className="space-x-2">
          <label className="text-sm font-medium">Container Width:</label>
          <select
            value={containerWidth}
            onChange={(e) => setContainerWidth(e.target.value)}
            className="px-3 py-1 border rounded bg-background"
          >
            <option value="100%">100% (Full Width)</option>
            <option value="800px">800px (Large)</option>
            <option value="600px">600px (Medium)</option>
            <option value="400px">400px (Small)</option>
            <option value="300px">300px (Narrow)</option>
          </select>
        </div>

        <div className="space-x-2">
          <label className="text-sm font-medium">
            <input
              type="checkbox"
              checked={showAllColumns}
              onChange={(e) => setShowAllColumns(e.target.checked)}
              className="mr-2"
            />
            Show All Columns
          </label>
        </div>
      </div>

      {/* Responsive Container */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Responsive VTable</h2>
        <div
          className="border border-border rounded-lg overflow-hidden bg-card/50 mx-auto transition-all duration-300"
          style={{ width: containerWidth, height: '400px' }}
        >
          <VTableWrapper
            columns={showAllColumns ? allColumns : basicColumns}
            data={testData}
            onSort={handleSort}
            responsive={true}
            autoResize={true}
            minColumnWidth={120}
          />
        </div>
      </div>

      {/* Fixed Container Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Fixed Width Test</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border rounded-lg overflow-hidden bg-card/50" style={{ height: '300px' }}>
            <div className="p-2 bg-muted text-sm font-medium">Small Container (300px)</div>
            <div style={{ height: 'calc(100% - 40px)', width: '300px' }}>
              <VTableWrapper
                columns={basicColumns}
                data={testData.slice(0, 3)}
                responsive={true}
                minColumnWidth={80}
              />
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden bg-card/50" style={{ height: '300px' }}>
            <div className="p-2 bg-muted text-sm font-medium">Large Container (Full Width)</div>
            <div style={{ height: 'calc(100% - 40px)' }}>
              <VTableWrapper
                columns={allColumns}
                data={testData}
                responsive={true}
                minColumnWidth={100}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Performance Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Performance Test (Many Rows)</h2>
        <div className="border border-border rounded-lg overflow-hidden bg-card/50" style={{ height: '400px' }}>
          <VTableWrapper
            columns={basicColumns}
            data={Array.from({ length: 1000 }, (_, i) => ({
              id: i + 1,
              name: `User ${i + 1}`,
              age: Math.floor(Math.random() * 50) + 18,
              city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][i % 5],
            }))}
            responsive={true}
            autoResize={true}
          />
        </div>
      </div>

      {/* Theme Information */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Responsive Features:</h3>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• Automatic column width calculation based on container size</li>
          <li>• ResizeObserver for real-time container size changes</li>
          <li>• Configurable minimum column widths</li>
          <li>• Flexible columns expand to fill available space</li>
          <li>• Fixed-width columns maintain their specified size</li>
          <li>• Mobile-responsive with horizontal scrolling when needed</li>
          <li>• Theme-aware styling that adapts to OpenSVM themes</li>
        </ul>
      </div>
    </div>
  );
}