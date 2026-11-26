import { WEEKDAYS, WEEKDAY_LABELS, type StoreLocation, type Weekday } from "./types";

export interface StockholmClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  isoDate: string;
  minutes: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export function stockholmNow(date = new Date()): StockholmClock {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  const minute = Number(parts.minute);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
    isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    minutes: hour * 60 + minute,
  };
}

/** Build an absolute Date that reads as the given wall time in Europe/Stockholm. */
export function dateInStockholm(year: number, month: number, day: number, hour: number, minute: number): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const shown = stockholmNow(new Date(utcGuess));
  const got = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute);
  const want = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(utcGuess + (want - got));
}

function parseMinutes(value: string): number {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  return hour * 60 + (minute || 0);
}

function addDays(clock: StockholmClock, days: number): { isoDate: string; weekday: number } {
  const utc = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + days, 12, 0, 0));
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return {
    isoDate: `${year}-${month}-${day}`,
    weekday: (clock.weekday + days) % 7,
  };
}

export interface StoreStatus {
  open: boolean;
  label: string;
  todayHours: string;
}

/**
 * Public status in Europe/Stockholm.
 * Open now, otherwise the next opening time. The word "stängt" is never used.
 */
export function storeStatus(store: StoreLocation, now = new Date()): StoreStatus {
  const clock = stockholmNow(now);
  const closed = new Set(store.closedDates);
  const weekday = WEEKDAYS[clock.weekday] as Weekday;
  const today = store.hours[weekday];
  const todayHours = today ? `${today.open}–${today.close}` : "Ingen öppettid";
  const blockedToday = closed.has(clock.isoDate) || !today;

  if (!blockedToday && today) {
    const opens = parseMinutes(today.open);
    const closes = parseMinutes(today.close);
    if (clock.minutes >= opens && clock.minutes < closes) {
      return { open: true, label: "Öppen nu", todayHours };
    }
    if (clock.minutes < opens) {
      return { open: false, label: `Öppnar kl ${today.open}`, todayHours };
    }
  }

  for (let offset = 1; offset <= 14; offset += 1) {
    const next = addDays(clock, offset);
    if (closed.has(next.isoDate)) continue;
    const hours = store.hours[WEEKDAYS[next.weekday] as Weekday];
    if (!hours) continue;
    const dayName = WEEKDAY_LABELS[WEEKDAYS[next.weekday] as Weekday].toLowerCase();
    return { open: false, label: `Öppnar ${dayName} kl ${hours.open}`, todayHours };
  }

  return { open: false, label: "Öppnar snart", todayHours };
}

export function mapsDirectionsUrl(query: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}
