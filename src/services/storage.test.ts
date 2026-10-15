import { describe, it, expect, beforeEach, vi } from "vitest";
import { initialState } from "../models/schema";
import {
  loadState,
  saveState,
  parseBackup,
  serializeBackup,
  STORAGE_KEY,
} from "./storage";
import { todayIn, plusDays, daysUntil } from "./dates";
describe("Persistencia y protección de datos", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it("inicia sin tareas inventadas y con once cursos estables", () => {
    const one = loadState();
    const two = loadState();
    expect(one.data.courses).toHaveLength(11);
    expect(one.data.tasks).toEqual([]);
    expect(one.data.events).toEqual([]);
    expect(one.data.courses).toEqual(two.data.courses);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
  it("conserva todas las entidades y preferencias al cargar y exportar", () => {
    const data = initialState();
    data.settings.name = "Fabrizio R.";
    data.tasks.push({
      id: "task-test",
      title: "Revisar energía",
      description: "Trabajo y energía",
      courseId: "course-1",
      type: "examen",
      dueDate: "2026-10-19",
      time: "09:30",
      priority: "alta",
      status: "completada",
      createdAt: "2026-10-15T15:00:00.000Z",
      completedAt: "2026-10-15T16:00:00.000Z",
    });
    data.events.push({
      id: "event-test",
      title: "Sesión",
      description: "Repaso",
      courseId: null,
      type: "practica",
      date: "2026-10-19",
      time: "",
      createdAt: "2026-10-15T15:00:00.000Z",
    });
    saveState(data);
    expect(loadState().data).toEqual(data);
    expect(parseBackup(serializeBackup(data))).toEqual(data);
  });
  it("preserva el contenido corrupto y avisa sin sobrescribirlo", () => {
    localStorage.setItem(STORAGE_KEY, "corrupto");
    expect(loadState().error).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("corrupto");
  });
  it("rechaza versiones futuras, fechas inválidas y referencias huérfanas", () => {
    const data = initialState();
    expect(() =>
      parseBackup(JSON.stringify({ ...data, schemaVersion: 99 })),
    ).toThrow();
    expect(() => parseBackup("{no json")).toThrow();
    data.events.push({
      id: "e",
      title: "Evento",
      description: "",
      courseId: "inexistente",
      type: "tarea",
      date: "2026-10-19",
      time: "",
      createdAt: new Date().toISOString(),
    });
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
    data.events[0].courseId = null;
    data.events[0].date = "2026-02-30";
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
    data.events[0].date = "2026-10-19";
    data.events.push({ ...data.events[0] });
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
  });
  it("no comunica éxito si el navegador rechaza la escritura", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveState(initialState())).toThrow("No se pudo guardar");
  });
});
describe("Fechas académicas", () => {
  it("usa la fecha de Lima en los límites de medianoche UTC", () => {
    const instant = new Date("2026-10-16T02:00:00Z");
    expect(todayIn("America/Lima", instant)).toBe("2026-10-15");
    expect(todayIn("Europe/Madrid", instant)).toBe("2026-10-16");
  });
  it("mantiene fechas de día completo e intervalos entre meses", () => {
    expect(plusDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(daysUntil("2026-10-19", "2026-10-15")).toBe(4);
    expect(daysUntil("2026-10-14", "2026-10-15")).toBe(-1);
  });
});
