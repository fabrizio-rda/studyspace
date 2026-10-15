import {
  addDays,
  format,
  startOfWeek,
  differenceInCalendarDays,
  parse,
} from "date-fns";
import { es } from "date-fns/locale";
export function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}
export function parseDay(key: string) {
  return parse(key, "yyyy-MM-dd", new Date(2000, 0, 1, 12));
}
export function todayIn(timezone: string, instant = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function hourIn(timezone: string) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
}
export function displayDate(key: string, pattern = "d MMM") {
  return format(parseDay(key), pattern, { locale: es });
}
export function daysUntil(key: string, today: string) {
  return differenceInCalendarDays(parseDay(key), parseDay(today));
}
export function weekStart(today: string) {
  return dateKey(startOfWeek(parseDay(today), { weekStartsOn: 1 }));
}
export function plusDays(key: string, days: number) {
  return dateKey(addDays(parseDay(key), days));
}
