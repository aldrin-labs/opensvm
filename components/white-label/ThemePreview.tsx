'use client';

import React from 'react';
import { useWhiteLabel, BrandedLogo, BrandedText } from '@/lib/white-label';
import { Bell, Search, Settings, User, TrendingUp, Activity, DollarSign, Users } from 'lucide-react';

export function ThemePreview() {
  const { config } = useWhiteLabel();

  return (
    <div className="space-y-6">
      {/* Header Preview */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="bg-primary text-primary-foreground p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BrandedLogo size="sm" />
              <BrandedText className="text-lg font-semibold" />
            </div>
            
            <div className="flex items-center space-x-3">
              <Search className="w-5 h-5 opacity-75" />
              <Bell className="w-5 h-5 opacity-75" />
              <User className="w-5 h-5 opacity-75" />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="bg-secondary/50 px-4 py-2 border-b border-border">
          <nav className="flex space-x-6">
            <a href="#" className="text-sm font-medium text-foreground hover:text-primary">
              Dashboard
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Analytics
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Transactions
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Settings
            </a>
          </nav>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6">
          {/* Welcome Message */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {config.content.welcomeMessage || 'Welcome to OpenSVM'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Your blockchain analytics dashboard
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Volume</p>
                  <p className="text-2xl font-bold text-foreground">$24,567</p>
                </div>
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold text-foreground">1,234</p>
                </div>
                <Users className="w-8 h-8 text-secondary" />
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-2xl font-bold text-foreground">89,234</p>
                </div>
                <Activity className="w-8 h-8 text-accent" />
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Growth</p>
                  <p className="text-2xl font-bold text-foreground">+12.5%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>

          {/* Sample Chart */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Transaction Volume
            </h3>
            <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Chart would render here</p>
            </div>
          </div>

          {/* Sample Table */}
          <div className="bg-card border border-border rounded-lg">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">
                Recent Transactions
              </h3>
            </div>
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-primary-foreground text-sm font-medium">
                        {i}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Transaction #{i}234567890
                      </p>
                      <p className="text-sm text-muted-foreground">
                        2 minutes ago
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      $1,{i}23.45
                    </p>
                    <p className="text-sm text-green-600">
                      Confirmed
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/50 px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              {config.content.footerText || 'Powered by OpenSVM'}
            </p>
            <p className="text-muted-foreground">
              {config.content.copyrightText || `© ${new Date().getFullYear()} OpenSVM. All rights reserved.`}
            </p>
          </div>
        </div>
      </div>

      {/* Component Showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Buttons */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Buttons
          </h3>
          <div className="space-y-3">
            <button className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
              Primary Button
            </button>
            <button className="w-full bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors">
              Secondary Button
            </button>
            <button className="w-full border border-border text-foreground px-4 py-2 rounded-md hover:bg-muted transition-colors">
              Outline Button
            </button>
          </div>
        </div>

        {/* Form Elements */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Form Elements
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Text input"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <select className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent">
              <option>Select option</option>
              <option>Option 1</option>
              <option>Option 2</option>
            </select>
            <textarea
              placeholder="Textarea"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Typography */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Typography
          </h3>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              Heading 1
            </h1>
            <h2 className="text-2xl font-semibold text-foreground">
              Heading 2
            </h2>
            <h3 className="text-lg font-medium text-foreground">
              Heading 3
            </h3>
            <p className="text-base text-foreground">
              Regular paragraph text with normal weight.
            </p>
            <p className="text-sm text-muted-foreground">
              Small muted text for captions and secondary information.
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Status Indicators
          </h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-foreground">Online</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-foreground">Pending</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-foreground">Error</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-foreground">Inactive</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThemePreview;