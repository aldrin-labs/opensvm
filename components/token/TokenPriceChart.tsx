'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useRef, useState, useMemo } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, Brush
} from 'recharts';
import { format } from 'date-fns';
import { 
  TrendingUp, TrendingDown, Maximize2, Download, 
  RefreshCw, Settings, ChartBar, ChartLine, ChartArea
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  mint: string;
  data: any;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

const TIMEFRAMES = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1H', label: '1H' },
  { value: '4H', label: '4H' },
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
];

type ChartType = 'line' | 'candle' | 'area';

export function TokenPriceChart({ mint, data, timeframe, onTimeframeChange }: Props) {
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [showVolume, setShowVolume] = useState(true);
  const [showMA, setShowMA] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // Process chart data
  const chartData = useMemo(() => {
    if (!data?.data?.items) return [];
    
    return data.data.items.map((item: any) => ({
      time: item.unixTime * 1000,
      date: format(new Date(item.unixTime * 1000), 'MMM dd HH:mm'),
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
      ma7: data.indicators?.ma7?.[data.data.items.indexOf(item)] || null,
      ma25: data.indicators?.ma25?.[data.data.items.indexOf(item)] || null,
    }));
  }, [data]);

  // Calculate price change
  const priceChange = useMemo(() => {
    if (chartData.length < 2) return { value: 0, percentage: 0 };
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    const change = last.close - first.close;
    const percentage = (change / first.close) * 100;
    return { value: change, percentage };
  }, [chartData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-xs">Open:</span>
              <span className="text-xs font-medium">${data.open?.toFixed(6)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs">High:</span>
              <span className="text-xs font-medium text-green-500">${data.high?.toFixed(6)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs">Low:</span>
              <span className="text-xs font-medium text-red-500">${data.low?.toFixed(6)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs">Close:</span>
              <span className="text-xs font-medium">${data.close?.toFixed(6)}</span>
            </div>
            {showVolume && (
              <div className="flex justify-between gap-4">
                <span className="text-xs">Volume:</span>
                <span className="text-xs font-medium">${data.volume?.toFixed(2)}</span>
              </div>
            )}
            {showMA && data.ma7 && (
              <div className="flex justify-between gap-4">
                <span className="text-xs">MA7:</span>
                <span className="text-xs font-medium text-blue-500">${data.ma7?.toFixed(6)}</span>
              </div>
            )}
            {showMA && data.ma25 && (
              <div className="flex justify-between gap-4">
                <span className="text-xs">MA25:</span>
                <span className="text-xs font-medium text-purple-500">${data.ma25?.toFixed(6)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Render candlestick chart
  const renderCandlestickChart = () => {
    return (
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10 }}
          className="stroke-muted-foreground"
        />
        <YAxis 
          domain={['dataMin', 'dataMax']}
          tick={{ fontSize: 10 }}
          className="stroke-muted-foreground"
        />
        <Tooltip content={<CustomTooltip />} />
        
        {/* Moving Averages */}
        {showMA && (
          <>
            <Line 
              type="monotone" 
              dataKey="ma7" 
              className="stroke-blue-500" 
              strokeWidth={1}
              dot={false}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="ma25" 
              className="stroke-purple-500" 
              strokeWidth={1}
              dot={false}
              connectNulls
            />
          </>
        )}
        
        {/* Volume bars */}
        {showVolume && (
          <Bar 
            dataKey="volume" 
            className="fill-muted-foreground" 
            opacity={0.3}
            yAxisId="volume"
          />
        )}
        
        <YAxis 
          yAxisId="volume"
          orientation="right"
          tick={{ fontSize: 10 }}
          className="stroke-muted-foreground"
        />
      </ComposedChart>
    );
  };

  // Render line chart
  const renderLineChart = () => {
    return (
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10 }}
          className="stroke-muted-foreground"
        />
        <YAxis 
          domain={['dataMin', 'dataMax']}
          tick={{ fontSize: 10 }}
          className="stroke-muted-foreground"
        />
        <Tooltip content={<CustomTooltip />} />
        
        <Line 
          type="monotone" 
          dataKey="close" 
          className="stroke-green-500" 
          strokeWidth={2}
          dot={false}
        />
        
        {showMA && (
          <>
            <Line 
              type="monotone" 
              dataKey="ma7" 
              className="stroke-blue-500" 
              strokeWidth={1}
              dot={false}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="ma25" 
              className="stroke-purple-500" 
              strokeWidth={1}
              dot={false}
              connectNulls
            />
          </>
        )}
        
        {showVolume && (
          <Bar 
            dataKey="volume" 
            className="fill-muted-foreground" 
            opacity={0.3}
            yAxisId="volume"
          />
        )}
        
        <YAxis 
          yAxisId="volume"
          orientation="right"
          tick={{ fontSize: 10 }}
          className="stroke-muted-foreground"
        />
        
        <Brush 
          dataKey="date"
          height={30}
          className="stroke-muted-foreground"
        />
      </ComposedChart>
    );
  };

  // Render area chart
  const renderAreaChart = () => {
    return (
      <ComposedChart data={chartData}>
        <defs>
          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10 }}
          className="stroke-muted-foreground"
        />
        <YAxis 
          domain={['dataMin', 'dataMax']}
          tick={{ fontSize: 10 }}
          className="stroke-muted-foreground"
        />
        <Tooltip content={<CustomTooltip />} />
        
        <Area 
          type="monotone" 
          dataKey="close" 
          className="stroke-green-500" 
          fillOpacity={1}
          fill="url(#colorPrice)"
        />
        
        {showMA && (
          <>
            <Line 
              type="monotone" 
              dataKey="ma7" 
              className="stroke-blue-500" 
              strokeWidth={1}
              dot={false}
              connectNulls
            />
            <Line 
              type="monotone" 
              dataKey="ma25" 
              className="stroke-purple-500" 
              strokeWidth={1}
              dot={false}
              connectNulls
            />
          </>
        )}
        
        {showVolume && (
          <Bar 
            dataKey="volume" 
            className="fill-muted-foreground" 
            opacity={0.3}
            yAxisId="volume"
          />
        )}
        
        <YAxis 
          yAxisId="volume"
          orientation="right"
          tick={{ fontSize: 10 }}
          className="stroke-muted-foreground"
        />
      </ComposedChart>
    );
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <Card ref={chartRef} className={cn("overflow-hidden", isFullscreen && "fixed inset-0 z-50")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle>Price Chart</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={priceChange.percentage >= 0 ? "default" : "destructive"}>
                {priceChange.percentage >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {priceChange.percentage >= 0 ? '+' : ''}{priceChange.percentage.toFixed(2)}%
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Chart Type Selector */}
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                size="sm"
                variant={chartType === 'candle' ? 'default' : 'ghost'}
                onClick={() => setChartType('candle')}
                className="h-7 px-2"
              >
                <ChartBar className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={chartType === 'line' ? 'default' : 'ghost'}
                onClick={() => setChartType('line')}
                className="h-7 px-2"
              >
                <ChartLine className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={chartType === 'area' ? 'default' : 'ghost'}
                onClick={() => setChartType('area')}
                className="h-7 px-2"
              >
                <ChartArea className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Settings */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={showVolume ? 'default' : 'ghost'}
                onClick={() => setShowVolume(!showVolume)}
                className="h-7 px-2"
              >
                Vol
              </Button>
              <Button
                size="sm"
                variant={showMA ? 'default' : 'ghost'}
                onClick={() => setShowMA(!showMA)}
                className="h-7 px-2"
              >
                MA
              </Button>
            </div>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleFullscreen}
              className="h-7 w-7 p-0"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Timeframe Selector */}
        <div className="flex gap-1 mt-2">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf.value}
              size="sm"
              variant={timeframe === tf.value ? 'default' : 'ghost'}
              onClick={() => onTimeframeChange(tf.value)}
              className="h-7 px-2"
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="p-2">
        <ResponsiveContainer width="100%" height={isFullscreen ? window.innerHeight - 120 : 400}>
          {chartType === 'candle' ? renderCandlestickChart() : 
           chartType === 'line' ? renderLineChart() : 
           renderAreaChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
