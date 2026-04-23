/**
 * Pragmatic parser for the OSM `opening_hours` tag.
 * Handles the ~70% of simple real-world patterns:
 *   - 24/7
 *   - "08:00-19:00" (every day)
 *   - "Mo-Fr 08:00-19:00; Sa 09:00-18:00; Su off"
 *   - "Mo-Su 12:00-14:00,19:00-22:00"
 *   - Day lists: "Mo,We,Fr 09:00-18:00"
 *   - Midnight crossing: "Mo-Su 18:00-02:00"
 * Returns null on unparseable input (complex patterns with month rules,
 * public holidays, SH, easter etc.) — display the raw string then.
 */

interface DayRange {
  days: Set<number>;
  ranges: Array<[number, number]>;
}

const DAY_INDEX: Record<string, number> = {
  Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6,
};

function parseDays(token: string): number[] | null {
  const days: number[] = [];
  for (const part of token.split(',').map((s) => s.trim())) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((s) => s.trim());
      if (!(a in DAY_INDEX) || !(b in DAY_INDEX)) return null;
      let i = DAY_INDEX[a];
      const end = DAY_INDEX[b];
      for (let guard = 0; guard < 8; guard++) {
        days.push(i);
        if (i === end) break;
        i = (i + 1) % 7;
      }
    } else {
      if (!(part in DAY_INDEX)) return null;
      days.push(DAY_INDEX[part]);
    }
  }
  return days;
}

function parseRanges(str: string): Array<[number, number]> | null {
  const out: Array<[number, number]> = [];
  for (const r of str.split(',').map((s) => s.trim())) {
    const m = r.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const endRaw = Number(m[3]) * 60 + Number(m[4]);
    // OSM uses "24:00" to mean midnight next day.
    const end = Number(m[3]) === 24 ? 24 * 60 : endRaw;
    out.push([start, end]);
  }
  return out.length > 0 ? out : null;
}

export function parseOpeningHours(str: string): DayRange[] | null {
  if (!str) return null;
  const trimmed = str.trim();
  if (trimmed === '24/7') {
    return [{ days: new Set([0, 1, 2, 3, 4, 5, 6]), ranges: [[0, 24 * 60]] }];
  }

  const result: DayRange[] = [];
  for (const partRaw of trimmed.split(';').map((s) => s.trim())) {
    if (!partRaw) continue;
    if (/\boff\b/i.test(partRaw) || /\bclosed\b/i.test(partRaw)) continue;

    // Match "Mo-Fr 08:00-19:00" or "08:00-19:00"
    const m = partRaw.match(/^(?:([A-Za-z,\-]+)\s+)?(\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}-\d{1,2}:\d{2})*)$/);
    if (!m) return null;

    const dayStr = (m[1] ?? 'Mo-Su').trim();
    const daysArr = parseDays(dayStr);
    if (!daysArr) return null;
    const ranges = parseRanges(m[2]);
    if (!ranges) return null;
    result.push({ days: new Set(daysArr), ranges });
  }

  return result.length > 0 ? result : null;
}

export function isOpenAt(schedule: DayRange[], date: Date): boolean {
  const dayIdx = date.getDay();
  const minutes = date.getHours() * 60 + date.getMinutes();
  for (const r of schedule) {
    if (!r.days.has(dayIdx)) continue;
    for (const [start, end] of r.ranges) {
      if (end > start) {
        if (minutes >= start && minutes < end) return true;
      } else {
        // Midnight crossing, e.g., 22:00-02:00
        if (minutes >= start || minutes < end) return true;
      }
    }
  }
  return false;
}

/**
 * Convenience: parse + check "is open right now".
 * Returns true / false / null (null = couldn't parse).
 */
export function isOpenNow(opening_hours: string | null | undefined, now: Date = new Date()): boolean | null {
  if (!opening_hours) return null;
  const schedule = parseOpeningHours(opening_hours);
  if (!schedule) return null;
  return isOpenAt(schedule, now);
}
