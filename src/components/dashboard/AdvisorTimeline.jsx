import { useMemo } from 'react';
import { addMonths, differenceInDays, parseISO, isValid } from 'date-fns';

// Given an advisor and project deadline, compute timeline segments
export function computeSegments(advisor, projectDeadline) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const elStart = parseISO(advisor.el_start_date);
  if (!isValid(elStart)) return null;

  const elEnd = addMonths(elStart, advisor.duration_months || 0);
  const deadline = projectDeadline ? parseISO(projectDeadline) : null;

  const hasPause =
    advisor.pause_start_date && advisor.pause_resume_date &&
    isValid(parseISO(advisor.pause_start_date)) &&
    isValid(parseISO(advisor.pause_resume_date));

  const pauseStart = hasPause ? parseISO(advisor.pause_start_date) : null;
  const pauseResume = hasPause ? parseISO(advisor.pause_resume_date) : null;

  // The effective end = elEnd + pause duration (if any, pause extends the green zone)
  const pauseDays = hasPause ? differenceInDays(pauseResume, pauseStart) : 0;
  const effectiveEnd = hasPause ? addMonths(elStart, advisor.duration_months) : elEnd;
  // After pause, green continues from resume for the remaining original duration
  const preGreenEnd = hasPause ? pauseStart : elEnd;

  // Timeline span: from elStart to max(effectiveEnd, deadline, today)
  let timelineEnd = effectiveEnd;
  if (deadline && deadline > timelineEnd) timelineEnd = deadline;
  if (today > timelineEnd) timelineEnd = today;
  // Add a small buffer
  const totalDays = differenceInDays(timelineEnd, elStart) + 30;

  const toPercent = (date) => Math.min(100, Math.max(0, (differenceInDays(date, elStart) / totalDays) * 100));

  const segments = [];

  if (hasPause) {
    // Green: elStart → pauseStart
    segments.push({ type: 'green', start: toPercent(elStart), end: toPercent(preGreenEnd) });
    // Yellow: pauseStart → pauseResume
    segments.push({ type: 'yellow', start: toPercent(pauseStart), end: toPercent(pauseResume) });
    // Green continues: pauseResume → (pauseResume + remaining original days after pause)
    const daysBeforePause = differenceInDays(pauseStart, elStart);
    const remainingDays = differenceInDays(elEnd, elStart) - daysBeforePause;
    const postGreenEnd = new Date(pauseResume.getTime() + remainingDays * 86400000);
    segments.push({ type: 'green', start: toPercent(pauseResume), end: toPercent(postGreenEnd) });

    // Red: postGreenEnd → deadline (if deadline > postGreenEnd)
    if (deadline && deadline > postGreenEnd) {
      segments.push({ type: 'red', start: toPercent(postGreenEnd), end: toPercent(deadline) });
    }
  } else {
    // Green: elStart → elEnd
    segments.push({ type: 'green', start: toPercent(elStart), end: toPercent(elEnd) });
    // Red: elEnd → deadline (if deadline > elEnd)
    if (deadline && deadline > elEnd) {
      segments.push({ type: 'red', start: toPercent(elEnd), end: toPercent(deadline) });
    }
  }

  const todayPercent = toPercent(today);

  return { segments, todayPercent, totalDays, elStart, timelineEnd, toPercent };
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
    <div className="relative h-5 w-full rounded-full overflow-hidden bg-secondary">
      {segments.map((seg, i) => (
        <div
          key={i}
          className={`absolute top-0 bottom-0 ${segmentColors[seg.type]} opacity-80`}
          style={{ left: `${seg.start}%`, width: `${seg.end - seg.start}%` }}
        />
      ))}
      {/* Today marker */}
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