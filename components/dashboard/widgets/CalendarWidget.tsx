'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type?: 'meeting' | 'deadline' | 'reminder' | 'event';
  color?: string;
}

interface CalendarWidgetProps {
  config: {
    title: string;
    view?: 'month' | 'week' | 'agenda';
    events?: CalendarEvent[];
    allowAdd?: boolean;
    showWeekends?: boolean;
    highlightToday?: boolean;
  };
  data?: CalendarEvent[];
  size: { w: number; h: number };
}

export function CalendarWidget({ config, data, size }: CalendarWidgetProps) {
  const {
    title,
    view = 'month',
    events,
    allowAdd = false,
    showWeekends = true,
    highlightToday = true,
  } = config;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Mock events
  const mockEvents: CalendarEvent[] = data || events || [
    {
      id: '1',
      title: 'Team Meeting',
      date: '2024-01-15',
      time: '10:00',
      type: 'meeting',
      color: 'blue',
    },
    {
      id: '2',
      title: 'Project Deadline',
      date: '2024-01-20',
      time: '23:59',
      type: 'deadline',
      color: 'red',
    },
    {
      id: '3',
      title: 'Code Review',
      date: '2024-01-18',
      time: '14:00',
      type: 'meeting',
      color: 'green',
    },
    {
      id: '4',
      title: 'Client Call',
      date: '2024-01-22',
      time: '16:00',
      type: 'meeting',
      color: 'purple',
    },
    {
      id: '5',
      title: 'Release Notes',
      date: '2024-01-25',
      type: 'reminder',
      color: 'orange',
    },
  ];

  const today = new Date();
  const isCompact = size.h <= 3;

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventsForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return mockEvents.filter(event => event.date === dateString);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-info';
      case 'deadline': return 'bg-destructive';
      case 'reminder': return 'bg-warning';
      case 'event': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8" />);
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const events = getEventsForDate(date);
      const isToday = highlightToday && isSameDay(date, today);
      const isSelected = selectedDate && isSameDay(date, selectedDate);

      days.push(
        <div
          key={day}
          className={`h-8 p-1 text-xs cursor-pointer border rounded transition-colors ${
            isToday ? 'bg-primary text-primary-foreground' : ''
          } ${
            isSelected ? 'ring-2 ring-primary' : ''
          } hover:bg-accent`}
          onClick={() => setSelectedDate(date)}
        >
          <div className="font-medium">{day}</div>
          {events.length > 0 && !isCompact && (
            <div className="flex space-x-1 mt-0.5">
              {events.slice(0, 2).map(event => (
                <div
                  key={event.id}
                  className={`w-1.5 h-1.5 rounded-full ${getEventTypeColor(event.type || 'event')}`}
                  title={event.title}
                />
              ))}
              {events.length > 2 && (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" title={`+${events.length - 2} more`} />
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-xs font-medium text-center text-muted-foreground p-1">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const renderAgendaView = () => {
    const upcomingEvents = mockEvents
      .filter(event => new Date(event.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);

    return (
      <div className="space-y-2">
        {upcomingEvents.map(event => (
          <div key={event.id} className="flex items-center space-x-3 p-2 rounded hover:bg-accent/50">
            <div className={`w-2 h-2 rounded-full ${getEventTypeColor(event.type || 'event')}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(event.date).toLocaleDateString()}
                {event.time && ` at ${event.time}`}
              </p>
            </div>
            <Badge variant="outline" className="text-xs capitalize">
              {event.type || 'event'}
            </Badge>
          </div>
        ))}
        {upcomingEvents.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-xs">No upcoming events</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          <div className="flex items-center space-x-2">
            {allowAdd && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Plus className="h-3 w-3" />
              </Button>
            )}
            {view === 'month' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => navigateMonth('prev')}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs font-medium min-w-16 text-center">
                  {currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => navigateMonth('next')}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0 flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {view === 'month' ? renderMonthView() : renderAgendaView()}
        </div>
      </CardContent>
    </Card>
  );
}

// Also export as default for backwards compatibility
export default CalendarWidget;