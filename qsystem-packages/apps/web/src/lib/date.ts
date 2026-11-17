const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const MS_PER_DAY = 86_400_000;

interface YmdParts {
  year: number;
  month: number;
  day: number;
}

/** Returns the active IANA timezone of the user's runtime, defaulting to `Asia/Ho_Chi_Minh`. */
export function getUserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.trim().length > 0 ? tz : DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function isValidCalendarYmd(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900 ||
    year > 2100
  ) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() + 1 === month &&
    probe.getUTCDate() === day
  );
}

function getDatePartsInTimeZone(date: Date, timeZone: string): YmdParts {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      calendar: 'iso8601',
    });
    const parts = formatter.formatToParts(safeDate);
    let year = Number.NaN;
    let month = Number.NaN;
    let day = Number.NaN;
    for (const part of parts) {
      if (part.type === 'year') year = Number(part.value);
      else if (part.type === 'month') month = Number(part.value);
      else if (part.type === 'day') day = Number(part.value);
    }
    if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)) {
      return { year, month, day };
    }
  } catch {
    // Fall back to runtime local getters when an unsupported timezone is passed.
  }
  return {
    year: safeDate.getFullYear(),
    month: safeDate.getMonth() + 1,
    day: safeDate.getDate(),
  };
}

function formatYmd({ year, month, day }: YmdParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseIsoYmd(iso: string): YmdParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidCalendarYmd(year, month, day) ? { year, month, day } : null;
}

/** Strict `dd/mm/yyyy` validator that rejects calendar rollovers (e.g. `31/02/2026`). */
export function parseCalendarDateDdMmYyyy(raw: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidCalendarYmd(year, month, day)) {
    return null;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function resolveCalendarIso(isoOrDate: string | Date, timeZone: string): string | null {
  if (isoOrDate instanceof Date) {
    if (Number.isNaN(isoOrDate.getTime())) return null;
    return getLocalDateIso(isoOrDate, timeZone);
  }
  if (typeof isoOrDate !== 'string') return null;
  const trimmed = isoOrDate.trim();
  if (!trimmed) return null;

  // Treat pure YYYY-MM-DD strings as calendar dates without UTC-midnight shift.
  const pureIso = parseIsoYmd(trimmed);
  if (pureIso) return formatYmd(pureIso);

  const dmyIso = parseCalendarDateDdMmYyyy(trimmed);
  if (dmyIso) return dmyIso;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateIso(parsed, timeZone);
}

/** Returns `'YYYY-MM-DD'` in the user's local timezone (or explicit `timeZone`). */
export function getLocalDateIso(
  date: Date = new Date(),
  timeZone: string = getUserTimeZone(),
): string {
  return formatYmd(getDatePartsInTimeZone(date, timeZone));
}

/** Shifts the calendar date of `baseDate` in `timeZone` by `offsetDays` and returns `'YYYY-MM-DD'`. */
export function addLocalDaysIso(
  offsetDays: number,
  baseDate: Date = new Date(),
  timeZone: string = getUserTimeZone(),
): string {
  const { year, month, day } = getDatePartsInTimeZone(baseDate, timeZone);
  const safeOffset = Number.isFinite(offsetDays) ? Math.trunc(offsetDays) : 0;
  const shifted = new Date(Date.UTC(year, month - 1, day + safeOffset));
  return formatYmd({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/** Formats a date or ISO string as `'DD/MM/YYYY'` in `timeZone`. */
export function formatDdMmYyyy(
  isoOrDate: string | Date,
  timeZone: string = getUserTimeZone(),
): string {
  const iso = resolveCalendarIso(isoOrDate, timeZone);
  if (!iso) {
    return typeof isoOrDate === 'string' ? isoOrDate : '';
  }
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Computes signed whole calendar days from `baseDate` (today in `timeZone`) to `targetIso`:
 * `0` = hôm nay, `1` = ngày mai, `-1` = hôm qua, `< 0` = quá hạn.
 */
export function diffCalendarDays(
  targetIso: string | Date,
  baseDate: Date = new Date(),
  timeZone: string = getUserTimeZone(),
): number {
  const resolvedTarget = resolveCalendarIso(targetIso, timeZone);
  if (!resolvedTarget) return Number.NaN;
  const targetParts = parseIsoYmd(resolvedTarget);
  if (!targetParts) return Number.NaN;

  const baseParts = getDatePartsInTimeZone(baseDate, timeZone);
  const targetUtc = Date.UTC(targetParts.year, targetParts.month - 1, targetParts.day);
  const baseUtc = Date.UTC(baseParts.year, baseParts.month - 1, baseParts.day);
  return Math.round((targetUtc - baseUtc) / MS_PER_DAY);
}

/** Formats a date relative to `baseDate` in `timeZone`: `'Hôm nay'`, `'Ngày mai'`, `'Hôm qua'`, or `'DD/MM/YYYY'`. */
export function formatRelativeViDate(
  isoOrDate: string | Date,
  baseDate: Date = new Date(),
  timeZone: string = getUserTimeZone(),
): string {
  const resolvedTarget = resolveCalendarIso(isoOrDate, timeZone);
  if (!resolvedTarget) {
    return typeof isoOrDate === 'string' ? isoOrDate : '';
  }
  const diff = diffCalendarDays(resolvedTarget, baseDate, timeZone);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  if (diff === -1) return 'Hôm qua';
  return formatDdMmYyyy(resolvedTarget, timeZone);
}

/** Returns ISO weekday (`1` = Monday .. `7` = Sunday) in `timeZone`. */
export function getLocalIsoWeekday(
  date: Date = new Date(),
  timeZone: string = getUserTimeZone(),
): number {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

/** Formats local `HH:mm` in `timeZone`. */
export function formatLocalTimeHm(
  date: Date = new Date(),
  timeZone: string = getUserTimeZone(),
): string {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(safeDate);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    if (hour && minute) {
      return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
  } catch {
    // Fall back to runtime local getters.
  }
  return `${String(safeDate.getHours()).padStart(2, '0')}:${String(safeDate.getMinutes()).padStart(2, '0')}`;
}
