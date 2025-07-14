/**
 * User Activity Calendar Component
 * GitHub-style activity heatmap showing user's blockchain exploration activity
 */

'use client';

import { useMemo } from 'react';
import { UserHistoryEntry } from '@/types/user-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

interface UserActivityCalendarProps {
  history: UserHistoryEntry[];
}

export function UserActivityCalendar({ history }: UserActivityCalendarProps) {
  const activityData = useMemo(() => {
    // Group history by date
    const dailyActivity: Record<string, number> = {};
    
    history.forEach(entry => {
      const date = new Date(entry.timestamp).toISOString().split('T')[0];
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;
    });

    // Get last 365 days
    const days = [];
    const today = new Date();
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        count: dailyActivity[dateStr] || 0,
        day: date.getDay(),
        week: Math.floor(i / 7)
      });
    }

    return days;
  }, [history]);

  const maxActivity = Math.max(...activityData.map(d => d.count), 1);

  const getIntensity = (count: number) => {
    if (count === 0) return 0;
    const ratio = count / maxActivity;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  };

  const intensityColors = [
    'bg-muted',
    'bg-green-200 dark:bg-green-900',
    'bg-green-400 dark:bg-green-700',
    'bg-green-600 dark:bg-green-500',
    'bg-green-800 dark:bg-green-300'
  ];

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group by weeks
  const weeks: Record<number, typeof activityData> = {};
  activityData.forEach(day => {
    if (!weeks[day.week]) weeks[day.week] = [];
    weeks[day.week].push(day);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Activity Calendar
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Your blockchain exploration activity over the past year
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-flex gap-1">
            {/* Week day labels */}
            <div className="flex flex-col gap-1 mr-2">
              <div className="h-4" /> {/* Space for months */}
              {weekDays.map((day, i) => (
                <div
                  key={day}
                  className="h-3 w-8 text-[10px] text-muted-foreground flex items-center"
                  style={{ visibility: i % 2 === 0 ? 'visible' : 'hidden' }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {Object.entries(weeks).map(([weekNum, days]) => (
              <div key={weekNum} className="flex flex-col gap-1">
                {/* Month label */}
                <div className="h-4 text-[10px] text-muted-foreground">
                  {days[0] && new Date(days[0].date).getDate() <= 7 && 
                    months[new Date(days[0].date).getMonth()]}
                </div>
                {/* Day squares */}
                {[0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => {
                  const day = days.find(d => d.day === dayOfWeek);
                  if (!day) {
                    return <div key={dayOfWeek} className="h-3 w-3" />;
                  }
                  const intensity = getIntensity(day.count);
                  return (
                    <div
                      key={day.date}
                      className={`h-3 w-3 rounded-sm ${intensityColors[intensity]} border border-border`}
                      title={`${day.date}: ${day.count} visits`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <span>Less</span>
          {intensityColors.map((color, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-sm ${color} border border-border`}
            />
          ))}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
