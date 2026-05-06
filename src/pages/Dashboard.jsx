import { useState } from 'react';
import CalendarPanel from '@/components/dashboard/CalendarPanel';
import TodoPanel from '@/components/dashboard/TodoPanel';
import MonthlyCalendarPanel from '@/components/dashboard/MonthlyCalendarPanel';
import AdvisorPanel from '@/components/dashboard/AdvisorPanel';
import { format } from 'date-fns';

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col gap-3 overflow-y-auto">
      {/* Top date bar */}
      <div className="shrink-0">
        <h1 className="text-xl font-semibold text-foreground">{format(new Date(), 'EEEE')}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM d, yyyy')}</p>
      </div>

      {/* Calendar */}
      <div className="h-[500px] bg-card rounded-xl border border-border shadow-sm overflow-hidden shrink-0">
        <CalendarPanel selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </div>

      {/* Todo + Monthly Calendar */}
      <div className="flex gap-3 h-[380px] shrink-0">
        <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <TodoPanel />
        </div>
        <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <MonthlyCalendarPanel selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        </div>
      </div>

      {/* Advisor Tracking */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden shrink-0">
        <AdvisorPanel />
      </div>
    </div>
  );
}