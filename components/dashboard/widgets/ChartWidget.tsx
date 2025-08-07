'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ChartWidgetProps {
  config: {
    title: string;
    chartType?: 'line' | 'bar' | 'pie' | 'area';
    dataSource?: any[];
    xAxis?: string;
    yAxis?: string;
    color?: string;
    showLegend?: boolean;
  };
  data?: any[];
  size: { w: number; h: number };
}

export function ChartWidget({ config, data, size }: ChartWidgetProps) {
  const {
    title,
    chartType = 'line',
    dataSource,
    color = 'blue',
    showLegend = true
  } = config;

  // Mock chart data
  const mockData = data || dataSource || [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 600 },
    { name: 'Apr', value: 800 },
    { name: 'May', value: 500 },
    { name: 'Jun', value: 700 },
  ];

  const renderMockChart = () => {
    const maxValue = Math.max(...mockData.map(d => d.value));
    
    if (chartType === 'pie') {
      const total = mockData.reduce((sum, d) => sum + d.value, 0);
      let currentAngle = 0;
      
      return (
        <div className="flex items-center justify-center h-full">
          <svg width="120" height="120" viewBox="0 0 120 120">
            {mockData.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const angle = (item.value / total) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;
              
              const x1 = 60 + 50 * Math.cos((startAngle - 90) * Math.PI / 180);
              const y1 = 60 + 50 * Math.sin((startAngle - 90) * Math.PI / 180);
              const x2 = 60 + 50 * Math.cos((endAngle - 90) * Math.PI / 180);
              const y2 = 60 + 50 * Math.sin((endAngle - 90) * Math.PI / 180);
              
              const largeArcFlag = angle > 180 ? 1 : 0;
              const pathData = `M 60 60 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
              
              currentAngle += angle;
              
              return (
                <path
                  key={index}
                  d={pathData}
                  fill={`hsl(${index * 60}, 70%, 50%)`}
                  className="hover:opacity-80 transition-opacity"
                />
              );
            })}
          </svg>
        </div>
      );
    }

    if (chartType === 'bar') {
      const barWidth = Math.max(20, (size.w * 30) / mockData.length);
      
      return (
        <div className="flex items-end justify-center space-x-2 h-full p-4">
          {mockData.map((item, index) => (
            <div key={index} className="flex flex-col items-center">
              <div
                className="bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                style={{
                  width: `${barWidth}px`,
                  height: `${(item.value / maxValue) * 100}%`,
                  minHeight: '10px'
                }}
              />
              <span className="text-xs mt-1 truncate">{item.name}</span>
            </div>
          ))}
        </div>
      );
    }

    // Line chart (default)
    const points = mockData.map((item, index) => {
      const x = (index / (mockData.length - 1)) * 200;
      const y = 100 - (item.value / maxValue) * 80;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="flex items-center justify-center h-full">
        <svg width="220" height="120" viewBox="0 0 220 120">
          <polyline
            fill="none"
            stroke="rgb(59, 130, 246)"
            strokeWidth="2"
            points={points}
          />
          {mockData.map((item, index) => {
            const x = (index / (mockData.length - 1)) * 200;
            const y = 100 - (item.value / maxValue) * 80;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="3"
                fill="rgb(59, 130, 246)"
                className="hover:r-4 transition-all"
              />
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          <Badge variant="outline" className="text-xs capitalize">
            {chartType}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 h-full">
        <div className="h-full flex flex-col">
          <div className="flex-1">
            {renderMockChart()}
          </div>
          
          {showLegend && size.h > 3 && (
            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t">
              {mockData.slice(0, 3).map((item, index) => (
                <div key={index} className="flex items-center space-x-1 text-xs">
                  <div
                    className="w-2 h-2 rounded"
                    style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                  />
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Also export as default for backwards compatibility
export default ChartWidget;