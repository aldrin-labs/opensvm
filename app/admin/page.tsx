'use client';

export const dynamic = 'force-dynamic';

import { useSettings } from '@/lib/settings';

export default function AdminPage() {
  const settings = useSettings();
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* System Stats Card */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">System Stats</h2>
          <div className="space-y-2">
            <p>API Requests: 1,234</p>
            <p>Active Users: 567</p>
            <p>Server Load: 45%</p>
          </div>
        </div>

        {/* User Management Card */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">User Management</h2>
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            View Users
          </button>
        </div>

        {/* System Settings Card */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">System Settings</h2>
          <div className="space-y-2">
            <p>Theme: {settings.theme}</p>
            <p>RPC: {settings.rpcEndpoint.name}</p>
            <p>Font: {settings.fontFamily}</p>
          </div>
          <button className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded mt-2">
            Configure Settings
          </button>
        </div>
      </div>
    </div>
  );
}
