import { useState } from 'react';
import { Mail, Paperclip } from 'lucide-react';

const GRID_HEIGHT = 1152;
// snap to nearest 5-minute increment
const snap = (h) => Math.round(h * 12) / 12;
const MIN_DURATION = 1 / 12; // 5 minutes

export default function TaskEventBlock({ taskEvent, onComplete, onMove, onResize, onRemove }) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  const formatHour = (h) => {
    const totalMin = Math.round(h * 60);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    const ampm = hh < 12 ? 'AM' : 'PM';
    const displayH = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return `${displayH}:${mm.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleBodyMouseDown = (e) => {
    if (e.button !== 0 || taskEvent.completed) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    const startY = e.clientY;
    const startHour = taskEvent.startHour;
    const onMove_ = (me) => {
      const dy = me.clientY - startY;
      const deltaHours = (dy / GRID_HEIGHT) * 24;
      onMove(taskEvent.id, Math.max(0, Math.min(snap(startHour + deltaHours), 24 - taskEvent.durationHours)));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove_);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove_);
    window.addEventListener('mouseup', onUp);
  };

  const handleResizeMouseDown = (e) => {
    if (e.button !== 0 || taskEvent.completed) return;
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    const startY = e.clientY;
    const startDuration = taskEvent.durationHours;
    const onMove_ = (me) => {
      const dy = me.clientY - startY;
      const deltaHours = (dy / GRID_HEIGHT) * 24;
      onResize(taskEvent.id, Math.max(MIN_DURATION, Math.min(snap(startDuration + deltaHours), 24 - taskEvent.startHour)));
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove_);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove_);
    window.addEventListener('mouseup', onUp);
  };

  const topPct = (taskEvent.startHour / 24) * 100;
  const heightPct = (taskEvent.durationHours / 24) * 100;
  const endHour = taskEvent.startHour + taskEvent.durationHours;
  const done = taskEvent.completed;

  // Size tiers
  const isMicro = taskEvent.durationHours < 1 / 8;   // < 7.5 min
  const isTiny  = taskEvent.durationHours < 1 / 4;   // < 15 min
  const isShort = taskEvent.durationHours < 0.5;      // < 30 min

  const minHeight = isMicro ? '18px' : isTiny ? '26px' : isShort ? '34px' : '40px';

  return (
    <div
      className="absolute left-0 right-0 mx-1 rounded-md overflow-hidden group select-none"
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        backgroundColor: taskEvent.color,
        border: '1.5px solid rgba(0,0,0,0.22)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        opacity: done ? 0.55 : dragging ? 0.75 : 0.93,
        zIndex: dragging || resizing ? 30 : 20,
        minHeight,
        cursor: done ? 'default' : dragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleBodyMouseDown}
    >
      {isMicro ? (
        /* ── Micro: single-line strip, no checkbox ── */
        <div className="flex items-center h-full px-1.5 gap-1 pointer-events-none overflow-hidden">
          <p className={`text-[9px] font-semibold text-white leading-none truncate flex-1 ${done ? 'line-through opacity-60' : ''}`}>
            {taskEvent.text}
          </p>
          <button
            className="pointer-events-auto text-white/50 hover:text-white opacity-0 group-hover:opacity-100 text-[9px] leading-none shrink-0"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(taskEvent.id)}
          >✕</button>
        </div>
      ) : isTiny ? (
        /* ── Tiny: single line, mini checkbox + text ── */
        <div className="flex items-center h-full px-1.5 gap-1 pointer-events-none overflow-hidden">
          <button
            className="pointer-events-auto shrink-0 w-3 h-3 rounded border border-white/80 flex items-center justify-center transition-all hover:bg-white/20"
            style={{ backgroundColor: done ? 'rgba(255,255,255,0.75)' : 'transparent' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onComplete(taskEvent.id, taskEvent.todoId, !done)}
            title="Mark as done"
          >
            {done && (
              <svg viewBox="0 0 10 10" className="w-2 h-2" fill="none" stroke={taskEvent.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1.5,5 3.8,7.5 8.5,2" />
              </svg>
            )}
          </button>
          <p className={`text-[9px] font-semibold text-white leading-none truncate flex-1 ${done ? 'line-through opacity-60' : ''}`}>
            {taskEvent.text}
            {taskEvent.attachments?.length > 0 && (
              <span className="ml-1 inline-flex items-center gap-0.5 opacity-80">
                <Paperclip className="w-2 h-2 inline" />{taskEvent.attachments.length}
              </span>
            )}
          </p>
          <button
            className="pointer-events-auto text-white/50 hover:text-white opacity-0 group-hover:opacity-100 text-[9px] leading-none shrink-0"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(taskEvent.id)}
          >✕</button>
        </div>
      ) : (
        /* ── Short / Normal ── */
        <div className={`px-2 ${isShort ? 'pt-1 pb-3' : 'pt-1.5 pb-5'} flex flex-col gap-0.5 pointer-events-none`}>
          {/* Top row: checkbox + title + remove */}
          <div className="flex items-center gap-1.5">
            <button
              className="pointer-events-auto shrink-0 w-4 h-4 rounded border-2 border-white/80 flex items-center justify-center transition-all hover:border-white hover:bg-white/20"
              style={{ backgroundColor: done ? 'rgba(255,255,255,0.75)' : 'transparent' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onComplete(taskEvent.id, taskEvent.todoId, !done)}
              title="Mark as done"
            >
              {done && (
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke={taskEvent.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1.5,5 3.8,7.5 8.5,2" />
                </svg>
              )}
            </button>
            <p className={`font-semibold text-white leading-tight truncate flex-1 ${isShort ? 'text-[10px]' : 'text-[11px]'} ${done ? 'line-through opacity-60' : ''}`}>
              {taskEvent.text}
            </p>
            <button
              className="pointer-events-auto shrink-0 text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity text-[11px] leading-none"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onRemove(taskEvent.id)}
            >✕</button>
          </div>

          {/* Time row — only when >= 30 min */}
          {!isShort && (
            <p className={`text-[9px] text-white/75 pl-5 ${done ? 'opacity-50' : ''}`}>
              {formatHour(taskEvent.startHour)} – {formatHour(endHour)}
            </p>
          )}

          {/* Attachment chips — only if has attachments and not micro/tiny */}
          {!isMicro && !isTiny && taskEvent.attachments?.length > 0 && (
            <div className="pl-5 flex flex-wrap gap-0.5 mt-0.5">
              {taskEvent.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.webLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-0.5 bg-black/15 hover:bg-black/25 text-white rounded px-1 py-0.5 text-[9px] max-w-[120px] transition-colors pointer-events-auto"
                  title={att.subject}
                >
                  <Mail className="w-2 h-2 shrink-0" />
                  <span className="truncate">{att.subject}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resize handle */}
      {!done && !isMicro && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="pointer-events-auto absolute bottom-0 left-0 right-0 cursor-ns-resize flex items-center justify-center"
          style={{ height: isTiny ? '6px' : '10px', backgroundColor: 'rgba(0,0,0,0.15)' }}
        >
          <div className={`rounded-full bg-white/50 ${isTiny ? 'w-5 h-px' : 'w-8 h-0.5'}`} />
        </div>
      )}
    </div>
  );
}
