import CalendarPanel from '@/components/dashboard/CalendarPanel';
import TodoPanel from '@/components/dashboard/TodoPanel';
import NotesPanel from '@/components/dashboard/NotesPanel';
import { format } from 'date-fns';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background p-4 flex flex-col gap-4">
      {/* Top date bar */}
      <div className="shrink-0">
        <h1 className="text-xl font-semibold text-foreground">{format(new Date(), 'EEEE')}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM d, yyyy')}</p>
      </div>

      {/* Calendar — top, full width */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden shrink-0" style={{ minHeight: '380px', maxHeight: '52vh' }}>
        <CalendarPanel />
      </div>

      {/* Bottom row — Todos left, Notes right */}
      <div className="flex gap-4 flex-1 min-h-0" style={{ minHeight: '300px', flex: '1 1 0' }}>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ width: '45%' }}>
          <TodoPanel />
        </div>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col" style={{ flex: 1 }}>
          <NotesPanel />
        </div>
      </div>
    </div>
  );
}