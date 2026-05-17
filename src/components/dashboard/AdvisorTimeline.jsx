import { useMemo } from 'react';
import { addMonths, addDays, differenceInDays, parseISO, isValid, format } from 'date-fns';

// Given an advisor and project deadline, compute timeline segments
// sharedRange: optional { start: Date, end: Date } to normalize all advisors to the same scale
export function computeSegments(advisor, projectDeadline, sharedRange) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const elStart = parseISO(advisor.el_start_date);
  if (!isValid(elStart)) return null;

  const deadline = projectDeadline ? parseISO(projectDeadline) : null;

  const hasPause =
    advisor.pause_start_date && advisor.pause_resume_date &&
    isValid(parseISO(advisor.pause_start_date)) &&
    isValid(parseISO(advisor.pause_resume_date));

  const pauseStart = hasPause ? parseISO(advisor.pause_start_date) : null;
  const pauseResume = hasPause ? parseISO(advisor.pause_resume_date) : null;

  // Base EL end = elStart + duration_months
  const baseElEnd = addMonths(elStart, advisor.duration_months || 0);

  // Effective EL end = base EL end + pause duration (pause extends the paid window)
  const pauseDays = hasPause ? differenceInDays(pauseResume, pauseStart) : 0;
  const effectiveElEnd = addDays(baseElEnd, pauseDays);

  // Use shared range if provided, otherwise compute per-advisor range
  let rangeStart, rangeEnd;
  if (sharedRange) {
    rangeStart = sharedRange.start;
    rangeEnd = sharedRange.end;
  } else {
    rangeStart = elStart;
    rangeEnd = effectiveElEnd;
    if (deadline && deadline > rangeEnd) rangeEnd = deadline;
    if (today > rangeEnd) rangeEnd = today;
  }
  const totalDays = differenceInDays(rangeEnd, rangeStart);

  const toPercent = (date) => Math.min(100, Math.max(0, (differenceInDays(date, rangeStart) / totalDays) * 100));

  const segments = [];

  if (hasPause) {
    // Green: elStart → pauseStart (active paid time before pause)
    segments.push({ type: 'green', start: toPercent(elStart), end: toPercent(pauseStart) });
    // Yellow: pauseStart → pauseResume (pause period)
    segments.push({ type: 'yellow', start: toPercent(pauseStart), end: toPercent(pauseResume) });
    // Green: pauseResume → effectiveElEnd (remaining paid time after pause)
    segments.push({ type: 'green', start: toPercent(pauseResume), end: toPercent(effectiveElEnd) });
    // Red: effectiveElEnd → deadline (overage)
    if (deadline && deadline > effectiveElEnd) {
      segments.push({ type: 'red', start: toPercent(effectiveElEnd), end: toPercent(deadline) });
    }
  } else {
    // Green: elStart → baseElEnd (active paid time)
    segments.push({ type: 'green', start: toPercent(elStart), end: toPercent(baseElEnd) });
    // Red: baseElEnd → deadline (overage)
    if (deadline && deadline > baseElEnd) {
      segments.push({ type: 'red', start: toPercent(baseElEnd), end: toPercent(deadline) });
    }
  }

  const todayPercent = toPercent(today);

  return { segments, todayPercent, totalDays, elStart, timelineEnd: rangeEnd, toPercent, effectiveElEnd, baseElEnd };
}

export default function AdvisorTimeline({ advisor, projectDeadline, sharedRange }) {
  const result = useMemo(() => computeSegments(advisor, projectDeadline, sharedRange), [advisor, projectDeadline, sharedRange]);

  if (!result) return <div className="text-xs text-muted-foreground">Invalid date</div>;

  const { segments, todayPercent, toPercent, elStart, effectiveElEnd, baseElEnd } = result;

  const hasPause =
    advisor.pause_start_date && advisor.pause_resume_date &&
    isValid(parseISO(advisor.pause_start_date)) &&
    isValid(parseISO(advisor.pause_resume_date));

  const deadline = projectDeadline && isValid(parseISO(projectDeadline)) ? parseISO(projectDeadline) : null;
  const elEndDate = hasPause ? effectiveElEnd : baseElEnd;

  const segmentColors = {
    green: 'bg-emerald-400',
    yellow: 'bg-yellow-400',
    red: 'bg-red-400',
  };

  const elEndPercent = toPercent(elEndDate);


  // Detect if EL-end label and Deadline label are too close (within 20%) — if so, suppress EL-end label
  const showElEnd = !deadline || Math.abs(elEndPercent - 100) > 20;

  return (
    <div className="w-full">
      {/* Bar */}
      <div className="relative h-5 w-full">
        <div className="absolute inset-0 rounded-full overflow-hidden bg-secondary">
          {segments.map((seg, i) => (
            <div
              key={i}
              className={`absolute top-0 bottom-0 ${segmentColors[seg.type]} opacity-80`}
              style={{ left: `${seg.start}%`, width: `${seg.end - seg.start}%` }}
            />
          ))}
        </div>
        {/* Today marker */}
        {todayPercent >= 0 && todayPercent <= 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
            style={{ left: `${todayPercent}%` }}
            title="Today"
          />
        )}
      </div>

      {/* Labels row — all absolutely pinned at correct percentages */}
      <div className="relative w-full" style={{ height: '14px', marginTop: '2px' }}>
        {/* Start date — left-anchored */}
        <span className="absolute text-[9px] text-muted-foreground whitespace-nowrap" style={{ left: '0%' }}>
          {format(elStart, 'MMM yyyy')}
        </span>

        {/* EL ends — center-anchored, only if not too close to deadline */}
        {showElEnd && (
          <span
            className="absolute text-[9px] text-muted-foreground whitespace-nowrap"
            style={{ left: `${elEndPercent}%`, transform: 'translateX(-50%)' }}
          >
            {`EL ends ${format(elEndDate, 'MMM d, yyyy')}`}
          </span>
        )}

        {/* Deadline — right-anchored at 100% */}
        {deadline && (
          <span className="absolute text-[9px] text-muted-foreground whitespace-nowrap" style={{ right: '0%' }}>
            {`Deadline: ${format(deadline, 'MMM d, yyyy')}`}
          </span>
        )}

        {/* Today label — center-anchored under marker, only if not near edges */}
        {todayPercent > 8 && todayPercent < 92 && (
          <span
            className="absolute text-[9px] font-medium text-foreground whitespace-nowrap"
            style={{ left: `${todayPercent}%`, transform: 'translateX(-50%)' }}
          >
            Today
          </span>
        )}
      </div>
    </div>
  );
}