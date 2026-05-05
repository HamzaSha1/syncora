import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Days order: Sun Mon Tue Wed Thu Fri Sat
// Friday = index 5, Saturday = index 6
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const OFF_DAYS = new Set([5, 6]); // Friday & Saturday

function buildCalendarDays(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = [];
  let d = start;
  while (d <= end) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

export default function MonthlyCalendarPanel() {
  const [month, setMonth] = useState(new Date());
  const days = buildCalendarDays(month);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm text-foreground">
            {format(month, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setMonth(new Date())}
          >
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 shrink-0 border-b border-border">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`py-1.5 text-center text-[11px] font-medium ${
              OFF_DAYS.has(i) ? 'text-destructive/70' : 'text-muted-foreground'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-hidden">
        {days.map((day, idx) => {
          const dayOfWeek = day.getDay(); // 0=Sun,6=Sat
          const isOff = OFF_DAYS.has(dayOfWeek);
          const isCurrentMonth = isSameMonth(day, month);
          const isTodayDay = isToday(day);

          return (
            <div
              key={idx}
              className={`border-r border-b border-border/40 p-1 flex flex-col ${
                isOff ? 'bg-destructive/5' : ''
              } ${!isCurrentMonth ? 'opacity-35' : ''}`}
            >
              <span
                className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  isTodayDay
                    ? 'bg-primary text-primary-foreground'
                    : isOff
                    ? 'text-destructive/80'
                    : 'text-foreground'
                }`}
              >
                {format(day, 'd')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-border shrink-0 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-destructive/15 border border-destructive/20" />
          <span className="text-[10px] text-muted-foreground">Off day (Fri & Sat)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-[10px] text-muted-foreground">Today</span>
        </div>
      </div>
    </div>
  );
}