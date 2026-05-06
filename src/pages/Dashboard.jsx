import { useState } from 'react';
import CalendarPanel from '@/components/dashboard/CalendarPanel';
import TodoPanel from '@/components/dashboard/TodoPanel';
import MonthlyCalendarPanel from '@/components/dashboard/MonthlyCalendarPanel';
import AdvisorPanel from '@/components/dashboard/AdvisorPanel';
import { format } from 'date-fns';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

function ResizeHandle({ direction = 'horizontal' }) {
  return (
    <PanelResizeHandle className={`group flex items-center justify-center ${direction === 'horizontal' ? 'w-2 mx-0.5' : 'h-2 my-0.5'}`}>
      <div className={`bg-border group-hover:bg-primary group-data-[resize-handle-active]:bg-primary rounded-full transition-colors ${direction === 'horizontal' ? 'w-1 h-12' : 'h-1 w-12'}`} />
    </PanelResizeHandle>
  );
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <div className="bg-background p-4 flex flex-col gap-2" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Top date bar */}
      <div className="shrink-0">
        <h1 className="text-xl font-semibold text-foreground">{format(new Date(), 'EEEE')}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM d, yyyy')}</p>
      </div>

      {/* Outer vertical resizable: [Top: Calendar] | [Middle: Todo+Monthly] | [Bottom: Advisor] */}
      <PanelGroup direction="vertical" className="flex-1 min-h-0">

        {/* Top: Calendar */}
        <Panel defaultSize={35} minSize={10}>
          <div className="h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <CalendarPanel selectedDate={selectedDate} onDateChange={setSelectedDate} />
          </div>
        </Panel>

        <ResizeHandle direction="vertical" />

        {/* Middle: Todo + Monthly Calendar (horizontal resize) */}
        <Panel defaultSize={30} minSize={10}>
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={45} minSize={15}>
              <div className="h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <TodoPanel />
              </div>
            </Panel>
            <ResizeHandle direction="horizontal" />
            <Panel defaultSize={55} minSize={15}>
              <div className="h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <MonthlyCalendarPanel selectedDate={selectedDate} onDateSelect={setSelectedDate} />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <ResizeHandle direction="vertical" />

        {/* Bottom: Advisor Tracking */}
        <Panel defaultSize={35} minSize={10}>
          <div className="h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <AdvisorPanel />
          </div>
        </Panel>

      </PanelGroup>
    </div>
  );
}