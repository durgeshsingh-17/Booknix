/**
 * All salons in this product are India-based, so wall-clock times ("09:00")
 * are always interpreted as IST (UTC+5:30, no DST) rather than pulling in a
 * full timezone library. If the product later expands outside India, this is
 * the single place to swap in per-salon timezone support.
 */
export const IST_OFFSET_MINUTES = 5 * 60 + 30;

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const SLOT_GRANULARITY_MINUTES = 15;

export function timeStrToMinutes(time: string): number {
  const parts = time.split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  return h * 60 + m;
}

export function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Combines a "YYYY-MM-DD" date and "HH:mm" time (both IST wall-clock) into a UTC Date. */
export function combineISTDateAndMinutes(dateStr: string, minutesFromMidnight: number): Date {
  const parts = dateStr.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  // Midnight IST expressed in UTC epoch millis, then add the offset within the day.
  const utcMillisAtMidnightIST = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMillisAtMidnightIST + minutesFromMidnight * 60 * 1000);
}

/** Returns the IST day-of-week key for a UTC Date instant. */
export function getISTDayKey(date: Date): DayKey {
  const istMillis = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const istDate = new Date(istMillis);
  return DAY_KEYS[istDate.getUTCDay()] as DayKey;
}

/** Returns minutes-from-midnight (IST) for a UTC Date instant. */
export function getISTMinutesOfDay(date: Date): number {
  const istMillis = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const istDate = new Date(istMillis);
  return istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
}

export function floorToSlotGranularity(minutes: number): number {
  return Math.floor(minutes / SLOT_GRANULARITY_MINUTES) * SLOT_GRANULARITY_MINUTES;
}
