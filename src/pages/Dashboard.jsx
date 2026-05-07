import { useState, useCallback } from 'react';
import CalendarPanel from '@/components/dashboard/CalendarPanel';
import TodoPanel from '@/components/dashboard/TodoPanel';
import NotesPanel from '@/components/dashboard/NotesPanel';
import { format } from 'date-fns';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import dragState from '@/lib/dragState';

function ResizeHandle({ direction = 'horizontal' }) {
  return (
    <PanelResizeHandle className={`group flex items-center justify-center ${direction === 'horizontal' ? 'w-2 mx-0.5' : 'h-2 my-0.5'}`}>
      <div className={`bg-border group-hover:bg-primary group-data-[resize-handle-active]:bg-primary rounded-full transition-colors ${direction === 'horizontal' ? 'w-1 h-12' : 'h-1 w-12'}`} />
    </PanelResizeHandle>
  );
}

export default function Dashboard() {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => setIsDragging(true), []);
  const handleDragEnd = useCallback(() => setIsDragging(false), []);

  const handleOverlayDragOver = useCallback((e) => e.preventDefault(), []);

  const handleOverlayDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (dragState.dropHandler && dragState.task) {
      dragState.dropHandler(e.clientX, e.clientY);
      dragState.task = null;
    }
  }, []);

  return (
    <div className="h-screen bg-background p-4 flex flex-col gap-2 overflow-hidden">
      {/* Full-screen overlay during drag — captures drop across panel boundaries */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50"
          onDragOver={handleOverlayDragOver}
          onDrop={handleOverlayDrop}
        />
      )}

      {/* Top date bar */}
      <div className="shrink-0">
        <h1 className="text-xl font-semibold text-foreground">{format(new Date(), 'EEEE')}</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM d, yyyy')}</p>
      </div>

      {/* Resizable layout */}
      <PanelGroup direction="vertical" className="flex-1 min-h-0">
        {/* Calendar panel */}
        <Panel defaultSize={50} minSize={20}>
          <div className="h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <CalendarPanel isDragging={isDragging} />
          </div>
        </Panel>

        <ResizeHandle direction="vertical" />

        {/* Bottom row */}
        <Panel defaultSize={50} minSize={20}>
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={45} minSize={20}>
              <div className="h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <TodoPanel onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
              </div>
            </Panel>

            <ResizeHandle direction="horizontal" />

            <Panel defaultSize={55} minSize={20}>
              <div className="h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <NotesPanel />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  );
}
