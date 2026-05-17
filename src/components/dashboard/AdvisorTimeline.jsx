import { useMemo } from 'react';
import { addMonths, addDays, differenceInDays, parseISO, isValid } from 'date-fns';

// Given an advisor and project deadline, compute timeline segments
export function computeSegments(advisor, projectDeadline) {
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

  // Timeline span: from elStart to max(effectiveElEnd, deadline, today)
  // Always use deadline as the right edge if available, so the bar fills to the deadline
  let timelineEnd = effectiveElEnd;
  if (deadline && deadline > timelineEnd) timelineEnd = deadline;
  if (today > timelineEnd) timelineEnd = today;
  const totalDays = differenceInDays(timelineEnd, elStart);

  const toPercent = (date) => Math.min(100, Math.max(0, (differenceInDays(date, elStart) / totalDays) * 100));

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

  return { segments, todayPercent, totalDays, elStart, timelineEnd, toPercent, effectiveElEnd, baseElEnd };
}

export default function AdvisorTimeline({ advisor, projectDeadline }) {
  const result = useMemo(() => computeSegments(advisor, projectDeadline), [advisor, projectDeadline]);

  if (!result) return <div className="text-xs text-muted-foreground">Invalid date</div>;

  const { segments, todayPercent } = result;

  const segmentColors = {
    green: 'bg-emerald-400',
    yellow: 'bg-yellow-400',
    red: 'bg-red-400',
  };

  return (
    <div className="relative h-5 w-full">
      {/* Bar with segments */}
      <div className="absolute inset-0 rounded-full overflow-hidden bg-secondary">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`absolute top-0 bottom-0 ${segmentColors[seg.type]} opacity-80`}
            style={{ left: `${seg.start}%`, width: `${seg.end - seg.start}%` }}
          />
        ))}
      </div>
      {/* Today marker — outside overflow-hidden so it isn't clipped */}
      {todayPercent >= 0 && todayPercent <= 100 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
          style={{ left: `${todayPercent}%` }}
          title="Today"
        />
      )}
    </div>
  );
}