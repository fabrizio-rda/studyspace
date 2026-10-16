import { expect, it } from "vitest";
import { taskWindows } from "./task-windows";
import type { Task } from "../models/schema";
const task = (
  id: string,
  dueDate: string,
  status: Task["status"] = "pendiente",
): Task => ({
  id,
  title: id,
  dueDate,
  status,
  description: "",
  courseId: null,
  type: "tarea",
  time: "",
  priority: "media",
  createdAt: "2026-10-01T12:00:00.000Z",
  completedAt: null,
});
it("calcula hoy y mañana en Lima al cruzar mes y año sin duplicar tareas", () => {
  const tasks = [
    task("hoy", "2026-12-31"),
    task("mañana", "2027-01-01"),
    task("sin fecha", ""),
  ];
  const w = taskWindows(
    tasks,
    "America/Lima",
    new Date("2027-01-01T02:00:00Z"),
  );
  expect(w.today).toBe("2026-12-31");
  expect(w.tomorrow).toBe("2027-01-01");
  expect(w.days.map((g) => g.tasks.map((t) => t.id))).toEqual([
    ["hoy"],
    ["mañana"],
  ]);
});
it("usa lunes a domingo e incluye estados completados sin considerar tareas sin fecha", () => {
  const tasks = [
    task("lunes", "2026-10-12"),
    task("domingo", "2026-10-18", "completada"),
    task("siguiente", "2026-10-19"),
    task("sin fecha", ""),
  ];
  const w = taskWindows(
    tasks,
    "America/Lima",
    new Date("2026-10-19T02:00:00Z"),
  );
  expect(w.week.map((t) => t.id)).toEqual(["lunes", "domingo"]);
  expect(w.start).toBe("2026-10-12");
  expect(w.end).toBe("2026-10-18");
});
