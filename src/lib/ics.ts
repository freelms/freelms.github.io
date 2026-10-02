import type { ScheduleEntry } from '../types';

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
};

/** Next occurrence of a weekday as YYYYMMDD for calendar links. */
function nextDateFor(day: string): string {
  const idx = DAY_INDEX[day.trim().toLowerCase()] ?? 1;
  const d = new Date();
  let diff = (idx - d.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseTime(e: ScheduleEntry): { start: string; end: string } {
  // Accept "18:00", "18:00-19:00", "6pm". Default 1h duration.
  const m = (e.time ?? '').match(/(\d{1,2}):?(\d{2})?/);
  const h = m ? parseInt(m[1], 10) : 18;
  const min = m?.[2] ? parseInt(m[2], 10) : 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { start: `${pad(h)}${pad(min)}`, end: `${pad((h + 1) % 24)}${pad(min)}` };
}

/** Google Calendar event template link */
export function googleCalendarUrl(e: ScheduleEntry, courseTitle: string): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const text = encodeURIComponent(`${courseTitle}: ${e.topic}`);
  const details = encodeURIComponent(`${e.day} ${e.time} ${e.link ?? ''}`);
  const date = nextDateFor(e.day);
  const { start, end } = parseTime(e);
  return `${base}&text=${text}&dates=${date}T${start}00/${date}T${end}00&details=${details}`;
}

/** Export weekly schedule as .ics with DTSTART + weekly recurrence. */
export function downloadICS(entries: ScheduleEntry[], courseTitle: string) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LearnHub//Schedule//EN'
  ];
  entries.forEach((e, i) => {
    const date = nextDateFor(e.day);
    const { start, end } = parseTime(e);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${Date.now()}-${i}@learnhub`,
      `DTSTAMP:${date}T000000Z`,
      `DTSTART:${date}T${start}00`,
      `DTEND:${date}T${end}00`,
      `SUMMARY:${courseTitle}: ${e.topic}`,
      `DESCRIPTION:${e.day} ${e.time} ${e.link ?? ''}`,
      'RRULE:FREQ=WEEKLY',
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'schedule.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}
