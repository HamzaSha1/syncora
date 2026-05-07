import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { format, addDays, subDays, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import TaskEventBlock from './TaskEventBlock';

// Distinct task colors
const TASK_COLORS = [
  '#e05a77','#e0875a','#c4a020','#5ab85a','#5ab8c4','#5a7ae0','#a05ae0','#e05ab8',
  '#b84040','#40b870','#4070b8','#b840b8','#40b8b8','#b8a040','#7040b8','#b87040',
];
let colorIdx = 0;
function nextColor() {
  const c = TASK_COLORS[colorIdx % TASK_COLORS.length];
  colorIdx++;
  return c;
}

const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function toLocal(dateTimeStr, timeZone) {
  if (!dateTimeStr) return new Date();
  // Graph returns datetime strings without timezone suffix.
  // When timeZone is UTC we must append Z so JS parses as UTC (not local).
  const hasOffset = dateTimeStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateTimeStr);
  if (!hasOffset && timeZone === 'UTC') return new Date(dateTimeStr + 'Z');
  return new Date(dateTimeStr);
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0 to 23
const HALF_HOURS = Array.from({ length: 24 }, (_, i) => i + 0.5); // 0.5 to 23.5

function getEventStyle(event, allEvents) {
  const start = toLocal(event.start.dateTime || event.start.date, event.start.timeZone);
  const end = toLocal(event.end.dateTime || event.end.date, event.end.timeZone);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  const clampedStart = Math.max(startHour, 0);
  const clampedEnd = Math.min(endHour, 24);
  const top = ((clampedStart) / 24) * 100;
  const height = ((clampedEnd - clampedStart) / 24) * 100;
  return { top: `${top}%`, height: `${Math.max(height, 1.5)}%` };
}

function EventBlock({ event }) {
  const start = toLocal(event.start.dateTime || event.start.date, event.start.timeZone);
  const end = toLocal(event.end.dateTime || event.end.date, event.end.timeZone);
  const style = getEventStyle(event);
  const duration = (end - start) / 60000;
  const isShort = duration <= 30;

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

export default function CalendarPanel({ selectedDate, onDateChange }) {
  const [date, setDate] = useState(selectedDate || new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [taskEvents, setTaskEvents] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const scrollRef = useRef(null);
  const gridRef = useRef(null);

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

  useEffect(() => {
    fetchEvents(date);
  }, [date, fetchEvents]);

  // Auto-scroll to current time
  useEffect(() => {
    if (scrollRef.current && isToday(date)) {
      const now = new Date();
      const percent = (now.getHours() + now.getMinutes() / 60) / 24;
      const scrollPos = scrollRef.current.scrollHeight * percent - scrollRef.current.clientHeight / 2;
      scrollRef.current.scrollTop = Math.max(0, scrollPos);
    }
  }, [date, loading]);

  const goToDay = (d) => { setDate(d); onDateChange?.(d); };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const text = e.dataTransfer.getData('text/plain');
    if (!text || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    // scrollRef.current is the scrollable container; get its scrollTop
    const scrollTop = scrollRef.current ? scrollRef.current.scrollTop : 0;
    const relY = (e.clientY - rect.top) + scrollTop;
    const rawHour = (relY / 1152) * 24;
    // Snap to nearest 15 min
    const snappedHour = Math.round(rawHour * 4) / 4;
    const startHour = Math.max(0, Math.min(snappedHour, 23.75));

    setTaskEvents((prev) => [
      ...prev,
      { id: Date.now(), text, startHour, durationHours: 0.5, color: nextColor() },
    ]);
  };

  const handleResize = (id, newDuration) => {
    setTaskEvents((prev) => prev.map((te) => te.id === id ? { ...te, durationHours: newDuration } : te));
  };

  const handleRemove = (id) => {
    setTaskEvents((prev) => prev.filter((te) => te.id !== id));
  };

  // Sync when parent changes selected date
  useEffect(() => { if (selectedDate) setDate(selectedDate); }, [selectedDate]);

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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToDay(subDays(date, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <button
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              isToday(date) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => goToDay(new Date())}
          >
            {isToday(date) ? 'Today' : format(date, 'MMM d')}
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToDay(addDays(date, 1))}>
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={() => fetchEvents(date)}>Retry</Button>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="relative"
            style={{ height: '1152px', outline: isDragOver ? '2px dashed hsl(var(--primary))' : 'none', borderRadius: '8px' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Hour lines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full flex items-start"
                style={{ top: `${(hour / 24) * 100}%` }}
              >
                <span className="text-[10px] text-muted-foreground w-14 shrink-0 -mt-2 select-none whitespace-nowrap">
                  {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`}
                </span>
                <div className="flex-1 border-t border-border/60 mt-0" />
              </div>
            ))}
            {/* Half-hour lines */}
            {HALF_HOURS.map((slot) => {
              const h = Math.floor(slot);
              const label = h === 0 ? '12:30 AM' : h === 12 ? '12:30 PM' : h < 12 ? `${h}:30 AM` : `${h - 12}:30 PM`;
              return (
                <div
                  key={slot}
                  className="absolute w-full flex items-start"
                  style={{ top: `${(slot / 24) * 100}%` }}
                >
                  <span className="text-[9px] text-muted-foreground/50 w-14 shrink-0 -mt-1.5 select-none leading-none whitespace-nowrap">
                    {label}
                  </span>
                  <div className="flex-1 border-t border-border/30 border-dashed mt-0" />
                </div>
              );
            })}

            {/* Events area */}
            <div className="absolute left-14 right-0 top-0 bottom-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : (
                <AnimatePresence>
                  {events.map((event) => (
                    <EventBlock key={event.id} event={event} allEvents={events} />
                  ))}
                  {events.length === 0 && taskEvents.length === 0 && !loading && (
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
              {/* Task events dropped from todo list */}
              {taskEvents.map((te) => (
                <TaskEventBlock key={te.id} taskEvent={te} onResize={handleResize} onRemove={handleRemove} />
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