import { useRef, useState } from 'react';

const GRID_HEIGHT = 1152; // px for 24h

export default function TaskEventBlock({ taskEvent, onMove, onResize, onRemove }) {
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
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);

    const startY = e.clientY;
    const startHour = taskEvent.startHour;

    const onMove_ = (me) => {
      const dy = me.clientY - startY;
      const deltaHours = (dy / GRID_HEIGHT) * 24;
      const snapped = Math.round((startHour + deltaHours) * 4) / 4;
      const newStart = Math.max(0, Math.min(snapped, 24 - taskEvent.durationHours));
      onMove(taskEvent.id, newStart);
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
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);

    const startY = e.clientY;
    const startDuration = taskEvent.durationHours;

    const onMove_ = (me) => {
      const dy = me.clientY - startY;
      const deltaHours = (dy / GRID_HEIGHT) * 24;
      const snapped = Math.round((startDuration + deltaHours) * 4) / 4;
      const newDuration = Math.max(0.25, Math.min(snapped, 24 - taskEvent.startHour));
      onResize(taskEvent.id, newDuration);
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
  const isShort = taskEvent.durationHours <= 0.4;

  return (
    <div
      className="absolute left-0 right-0 mx-1 rounded-md overflow-hidden shadow-md group select-none"
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        backgroundColor: taskEvent.color,
        opacity: dragging ? 0.75 : 0.9,
        zIndex: dragging || resizing ? 30 : 20,
        minHeight: '18px',
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleBodyMouseDown}
    >
      <div className="px-2 py-1 h-full flex flex-col justify-between pointer-events-none">
        <div className="flex items-start justify-between gap-1">
          <p className={`font-semibold text-white leading-tight truncate flex-1 ${isShort ? 'text-[9px]' : 'text-[11px]'}`}>
            {taskEvent.text}
          </p>
          <button
            className="text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[10px] leading-none pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(taskEvent.id)}
          >
            ✕
          </button>
        </div>
        {!isShort && (
          <p className="text-[9px] text-white/80">{formatHour(taskEvent.startHour)} – {formatHour(endHour)}</p>
        )}
      </div>

      {/* Resize handle — bottom strip */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center pointer-events-auto"
        style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
      >
        <div className="w-8 h-0.5 rounded-full bg-white/50" />
      </div>
    </div>
  );
}
