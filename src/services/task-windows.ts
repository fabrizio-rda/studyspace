import type { Task } from "../models/schema";
import { plusDays, todayIn, weekStart } from "./dates";
export function taskWindows(tasks: Task[], timezone: string, now = new Date()) {
  const today = todayIn(timezone, now),
    tomorrow = plusDays(today, 1);
  const start = weekStart(today),
    end = plusDays(start, 6);
  const sorted = [...tasks].sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.time.localeCompare(b.time) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
  return {
    today,
    tomorrow,
    start,
    end,
    days: [today, tomorrow].map((date) => ({
      date,
      tasks: sorted.filter((t) => t.dueDate === date),
    })),
    week: sorted.filter((t) => t.dueDate >= start && t.dueDate <= end),
  };
}
