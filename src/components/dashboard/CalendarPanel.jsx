import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { format, addDays, subDays, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import dragState from '@/lib/dragState';

const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const GRID_HEIGHT = 1152; // px — matches the time grid div

function toLocal(dateTimeStr, timeZone) {
  if (!dateTimeStr) return new Date();
  const hasOffset = dateTimeStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateTimeStr);
  if (!hasOffset && timeZone === 'UTC') return new Date(dateTimeStr + 'Z');
  return new Date(dateTimeStr);
}

function hourToLabel(h) {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${min.toString().padStart(2, '0')} ${ampm}`;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ── Outlook calendar event block ──────────────────────────────────────────────

function getEventStyle(event) {
  const start = toLocal(event.start.dateTime || event.start.date, event.start.timeZone);
  const end = toLocal(event.end.dateTime || event.end.date, event.end.timeZone);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  const top = (Math.max(startHour, 0) / 24) * 100;
  const height = (Math.min(endHour, 24) - Math.max(startHour, 0)) / 24 * 100;
  return { top: `${top}%`, height: `${Math.max(height, 1.5)}%` };
}

function EventBlock({ event }) {
  const start = toLocal(event.start.dateTime || event.start.date, event.start.timeZone);
  const end = toLocal(event.end.dateTime || event.end.date, event.end.timeZone);
  const style = getEventStyle(event);
  const isShort = (end - start) / 60000 <= 30;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute left-0 right-0 mx-1 rounded-md bg-primary/90 text-primary-foreground px-2 py-1 overflow-hidden cursor-default group hover:bg-primary transition-colors shadow-sm"
      style={style}
      title={event.subject}
    >
      <p className={`font-medium leading-tight truncate ${isShort ? 'text-[10px]' : 'text-xs'}`}>
        {event.subject}
      </p>
      {!isShort && (
        <p className="text-[10px] opacity-80 truncate">
          {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
        </p>
      )}
      {event.location?.displayName && !isShort && (
        <p className="text-[10px] opacity-70 truncate flex items-center gap-0.5 mt-0.5">
          <MapPin className="w-2.5 h-2.5" />
          {event.location.displayName}
        </p>
      )}
    </motion.div>
  );
}

// ── Dropped task event block ──────────────────────────────────────────────────

function TaskEventBlock({ event, onRemove, onStartResize }) {
  const endHour = event.startHour + event.durationHours;
  const top = (event.startHour / 24) * 100;
  const height = (event.durationHours / 24) * 100;
  const isShort = event.durationHours <= 0.5;

  return (
    <div
      className="absolute left-0 right-0 mx-1 rounded-md px-2 py-1 overflow-hidden cursor-default group shadow-sm select-none"
      style={{ top: `${top}%`, height: `${Math.max(height, 1.5)}%`, backgroundColor: event.color, color: '#fff' }}
    >
      <button
        onClick={() => onRemove(event.id)}
        className="absolute top-0.5 right-1 text-white/60 hover:text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove"
      >
        ✕
      </button>
      <p className={`font-medium leading-tight truncate pr-4 ${isShort ? 'text-[10px]' : 'text-xs'}`}>
        {event.text}
      </p>
      {!isShort && (
        <p className="text-[10px] opacity-80">
          {hourToLabel(event.startHour)} – {hourToLabel(endHour)}
        </p>
      )}
      {/* Resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onStartResize(event.id, e.clientY); }}
      >
        <div className="w-8 h-0.5 rounded-full bg-white/60" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CalendarPanel({ isDragging }) {
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [taskEvents, setTaskEvents] = useState([]);
  const scrollRef = useRef(null);
  const resizeRef = useRef(null); // { eventId, startClientY }

  const fetchEvents = useCallback(async (d) => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = format(d, 'yyyy-MM-dd');
      const res = await base44.functions.invoke('getEvents', { date: dateStr, timezone: USER_TZ });
      setEvents(res.data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(date); }, [date, fetchEvents]);

  // Auto-scroll to current time
  useEffect(() => {
    if (scrollRef.current && isToday(date)) {
      const now = new Date();
      const percent = (now.getHours() + now.getMinutes() / 60) / 24;
      const scrollPos = scrollRef.current.scrollHeight * percent - scrollRef.current.clientHeight / 2;
      scrollRef.current.scrollTop = Math.max(0, scrollPos);
    }
  }, [date, loading]);

  // Register drop handler so Dashboard overlay can call it
  useEffect(() => {
    dragState.dropHandler = (clientX, clientY) => {
      if (!scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      // Only accept drops over the calendar scroll area
      if (clientY < rect.top || clientY > rect.bottom) return;
      const relativeY = (clientY - rect.top) + scrollRef.current.scrollTop;
      const hourRaw = (relativeY / GRID_HEIGHT) * 24;
      // Snap to 15-min increments
      const startHour = Math.max(0, Math.min(23.75, Math.round(hourRaw * 4) / 4));
      if (!dragState.task) return;
      setTaskEvents((prev) => [
        ...prev,
        { id: Date.now(), text: dragState.task.text, color: dragState.task.color, startHour, durationHours: 0.5 },
      ]);
    };
    return () => { dragState.dropHandler = null; };
  }, []);

  // Mouse-based resize
  const startResize = useCallback((eventId, startClientY) => {
    resizeRef.current = { eventId, startClientY };

    const onMouseMove = (e) => {
      if (!resizeRef.current) return;
      const { eventId, startClientY } = resizeRef.current;
      const deltaHours = ((e.clientY - startClientY) / GRID_HEIGHT) * 24;
      setTaskEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== eventId) return ev;
          const newDuration = Math.max(0.25, Math.round((ev.durationHours + deltaHours) * 4) / 4);
          return { ...ev, durationHours: newDuration };
        })
      );
      resizeRef.current.startClientY = e.clientY;
    };

    const onMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const removeTaskEvent = useCallback((id) => {
    setTaskEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const now = new Date();
  const currentTimePercent = isToday(date)
    ? ((now.getHours() + now.getMinutes() / 60) / 24) * 100
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm text-foreground">Calendar</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDate((d) => subDays(d, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <button
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              isToday(date) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setDate(new Date())}
          >
            {isToday(date) ? 'Today' : format(date, 'MMM d')}
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={() => fetchEvents(date)}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="px-4 pt-1 pb-1 shrink-0">
        <p className="text-xs font-medium text-muted-foreground">
          {format(date, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Time grid */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-4 pb-4 transition-colors ${isDragging ? 'bg-primary/5' : ''}`}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={() => fetchEvents(date)}>Retry</Button>
          </div>
        ) : (
          <div className="relative" style={{ height: `${GRID_HEIGHT}px` }}>
            {/* Hour lines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full flex items-start"
                style={{ top: `${(hour / 24) * 100}%` }}
              >
                <span className="text-[10px] text-muted-foreground w-9 shrink-0 -mt-2 select-none">
                  {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                </span>
                <div className="flex-1 border-t border-border/60" />
              </div>
            ))}

            {/* Events area */}
            <div className="absolute left-9 right-0 top-0 bottom-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <AnimatePresence>
                  {events.map((event) => (
                    <EventBlock key={event.id} event={event} />
                  ))}
                  {events.length === 0 && taskEvents.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center h-full"
                    >
                      <p className="text-xs text-muted-foreground">No events today</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* Dropped task events */}
              {taskEvents.map((ev) => (
                <TaskEventBlock
                  key={ev.id}
                  event={ev}
                  onRemove={removeTaskEvent}
                  onStartResize={startResize}
                />
              ))}

              {/* Current time indicator */}
              {currentTimePercent !== null && currentTimePercent >= 0 && currentTimePercent <= 100 && (
                <div
                  className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
                  style={{ top: `${currentTimePercent}%` }}
                >
                  <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                  <div className="flex-1 h-px bg-destructive" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
