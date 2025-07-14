/**
 * User History Real-time Graph Component
 * Displays real-time visualization of user browsing activity
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { UserHistoryEntry, UserHistoryStats } from '@/types/user-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Play, 
  Pause, 
  RotateCcw,
  Zap,
  TrendingUp,
  Clock
} from 'lucide-react';

interface UserHistoryGraphProps {
  history: UserHistoryEntry[];
  stats: UserHistoryStats;
  walletAddress: string;
}

interface GraphPoint {
  timestamp: number;
  visits: number;
  pageType: string;
  path: string;
  title: string;
}

export function UserHistoryGraph({ history, stats, walletAddress }: UserHistoryGraphProps) {
  const [isRealtime, setIsRealtime] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<GraphPoint[]>([]);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [realtimeData, setRealtimeData] = useState<GraphPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const intervalRef = useRef<NodeJS.Timeout>();

  // Convert history to graph points
  const historyPoints: GraphPoint[] = history.map(entry => ({
    timestamp: entry.timestamp,
    visits: 1,
    pageType: entry.pageType,
    path: entry.path,
    title: entry.pageTitle
  }));

  // Aggregate points by hour for better visualization
  const aggregatedPoints = historyPoints.reduce((acc, point) => {
    const hourKey = Math.floor(point.timestamp / (1000 * 60 * 60));
    if (!acc[hourKey]) {
      acc[hourKey] = {
        timestamp: hourKey * 1000 * 60 * 60,
        visits: 0,
        pageType: point.pageType,
        path: point.path,
        title: `${point.pageType} activity`
      };
    }
    acc[hourKey].visits += 1;
    return acc;
  }, {} as Record<number, GraphPoint>);

  const graphPoints = Object.values(aggregatedPoints).sort((a, b) => a.timestamp - b.timestamp);

  // Draw the graph
  const drawGraph = (points: GraphPoint[], progress: number = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) return;

    // Set up canvas
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Calculate bounds
    const maxVisits = Math.max(...points.map(p => p.visits));
    const minTime = Math.min(...points.map(p => p.timestamp));
    const maxTime = Math.max(...points.map(p => p.timestamp));
    const timeRange = maxTime - minTime;

    // Drawing dimensions
    const padding = 40;
    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * graphHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= 6; i++) {
      const x = padding + (i * graphWidth) / 6;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw data points and line
    if (points.length > 0) {
      const visiblePoints = points.slice(0, Math.floor(points.length * progress));
      
      if (visiblePoints.length > 1) {
        // Draw line
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        visiblePoints.forEach((point, index) => {
          const x = padding + ((point.timestamp - minTime) / timeRange) * graphWidth;
          const y = height - padding - (point.visits / maxVisits) * graphHeight;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
      }

      // Draw points
      visiblePoints.forEach((point, index) => {
        const x = padding + ((point.timestamp - minTime) / timeRange) * graphWidth;
        const y = height - padding - (point.visits / maxVisits) * graphHeight;
        
        // Point circle
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Glow effect for active point
        if (index === visiblePoints.length - 1 && isRealtime) {
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    }

    // Draw labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    // Y-axis labels
    for (let i = 0; i <= 5; i++) {
      const value = (maxVisits * (5 - i)) / 5;
      const y = padding + (i * graphHeight) / 5;
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(value).toString(), padding - 10, y + 4);
    }
    
    // X-axis labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= 6; i++) {
      const time = minTime + (i * timeRange) / 6;
      const x = padding + (i * graphWidth) / 6;
      const date = new Date(time);
      const label = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit'
      });
      ctx.fillText(label, x, height - padding + 20);
    }
  };

  // Animation loop
  const animate = () => {
    setAnimationProgress(prev => {
      const newProgress = Math.min(1, prev + 0.02);
      drawGraph(currentPoints, newProgress);
      
      if (newProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
      
      return newProgress;
    });
  };

  // Start real-time simulation
  const startRealtime = () => {
    setIsRealtime(true);
    setCurrentPoints(graphPoints);
    setAnimationProgress(0);
    
    // Start animation
    animationRef.current = requestAnimationFrame(animate);
    
    // Simulate real-time data updates
    intervalRef.current = setInterval(() => {
      setRealtimeData(prev => {
        const newPoint: GraphPoint = {
          timestamp: Date.now(),
          visits: Math.floor(Math.random() * 5) + 1,
          pageType: 'other',
          path: '/simulated',
          title: 'Simulated Activity'
        };
        
        return [...prev, newPoint].slice(-100); // Keep last 100 points
      });
    }, 2000);
  };

  // Stop real-time simulation
  const stopRealtime = () => {
    setIsRealtime(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  // Reset graph
  const resetGraph = () => {
    stopRealtime();
    setCurrentPoints([]);
    setAnimationProgress(0);
    setRealtimeData([]);
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Initialize graph
  useEffect(() => {
    if (graphPoints.length > 0) {
      setCurrentPoints(graphPoints);
      drawGraph(graphPoints);
    }
  }, [graphPoints]);

  // Handle real-time data updates
  useEffect(() => {
    if (isRealtime && realtimeData.length > 0) {
      const combinedPoints = [...graphPoints, ...realtimeData];
      setCurrentPoints(combinedPoints);
      drawGraph(combinedPoints);
    }
  }, [realtimeData, isRealtime, graphPoints]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time Activity Graph
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={isRealtime ? "destructive" : "default"}
                size="sm"
                onClick={isRealtime ? stopRealtime : startRealtime}
                className="flex items-center gap-2"
              >
                {isRealtime ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Start Live
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetGraph}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Showing {currentPoints.length} data points</span>
            </div>
            {isRealtime && (
              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                <Zap className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Graph */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full h-96 border border-gray-200 dark:border-gray-700 rounded-lg"
              style={{ width: '100%', height: '384px' }}
            />
            
            {currentPoints.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No activity data to display
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Start browsing to see your activity graph
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Stats */}
      {isRealtime && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Live Points
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {realtimeData.length}
                  </p>
                </div>
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Points
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {currentPoints.length}
                  </p>
                </div>
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Animation Progress
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {Math.round(animationProgress * 100)}%
                  </p>
                </div>
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}