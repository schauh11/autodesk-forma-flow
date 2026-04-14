const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [0, 6];

export function formatCron(cron: string | null): string {
  if (!cron) return 'No schedule';

  const parts = cron.trim().split(/\s+/);
  if (parts.length < 2) return cron;

  const [minuteStr, hourStr, dowStr] = parts;
  const minute = parseInt(minuteStr!, 10);
  const hour = parseInt(hourStr!, 10);

  if (isNaN(minute) || isNaN(hour)) return cron;

  // Format time as 12-hour with AM/PM
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const time = `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;

  // Format days
  if (!dowStr || dowStr === '*') {
    return `Daily at ${time}`;
  }

  const days = dowStr.split(',').map((d) => parseInt(d, 10)).sort();

  // Check for weekday/weekend patterns
  if (days.length === 5 && WEEKDAYS.every((d) => days.includes(d))) {
    return `Weekdays at ${time}`;
  }
  if (days.length === 2 && WEEKEND.every((d) => days.includes(d))) {
    return `Weekends at ${time}`;
  }
  if (days.length === 7) {
    return `Daily at ${time}`;
  }

  const dayNames = days.map((d) => DAY_NAMES[d] || String(d));
  return `${dayNames.join(', ')} at ${time}`;
}
