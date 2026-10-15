import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, stateSchema } from "../models/schema";
import {
  parseBackup,
  loadState,
  saveState,
  STORAGE_KEY,
  LEGACY_BACKUP_KEY,
  serializeBackup,
} from "./storage";
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
function legacy() {
  const d = initialState();
  return {
    schemaVersion: 1,
    courses: d.courses,
    tasks: [
      {
        id: "original-task",
        title: "Tarea del usuario",
        description: "No perder",
        courseId: "course-1",
        type: "examen",
        dueDate: "2026-10-19",
        time: "",
        priority: "alta",
        status: "pendiente",
        createdAt: "2026-10-15T13:00:00.000Z",
        completedAt: null,
      },
    ],
    events: [
      {
        id: "original-event",
        title: "Actividad original",
        description: "",
        courseId: "course-2",
        type: "practica",
        date: "2026-10-16",
        time: "11:30",
        createdAt: "2026-10-15T13:00:00.000Z",
      },
    ],
    settings: {
      ...d.settings,
      name: "Nombre original",
      timezone: "America/Lima",
    },
  };
}
describe("Migración compatible de fase 1 a fase 2", () => {
  it("migra en memoria sin modificar una sola entidad anterior ni la clave de almacenamiento", () => {
    const old = legacy();
    const raw = JSON.stringify(old);
    localStorage.setItem(STORAGE_KEY, raw);
    const result = loadState();
    expect(result.error).toBeNull();
    expect(result.data.schemaVersion).toBe(2);
    expect(result.data.courses).toEqual(old.courses);
    expect(result.data.tasks).toEqual(old.tasks);
    expect(result.data.events).toEqual(old.events);
    expect(result.data.settings).toEqual(old.settings);
    expect(result.data.plans).toEqual([]);
    expect(result.data.topics).toEqual([]);
    expect(result.data.studyLogs).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it("guarda una copia byte por byte de fase 1 antes de la primera escritura y no la reemplaza después", () => {
    const raw = JSON.stringify(legacy(), null, 2);
    localStorage.setItem(STORAGE_KEY, raw);
    const d = loadState().data;
    d.settings.compact = true;
    saveState(d);
    expect(localStorage.getItem(LEGACY_BACKUP_KEY)).toBe(raw);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).schemaVersion).toBe(
      2,
    );
    saveState(d);
    expect(localStorage.getItem(LEGACY_BACKUP_KEY)).toBe(raw);
  });
  it("rechaza una migración si no puede guardar su copia, preservando el original", () => {
    const raw = JSON.stringify(legacy());
    localStorage.setItem(STORAGE_KEY, raw);
    const set = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === LEGACY_BACKUP_KEY) throw new Error("quota");
      return set.call(this, key, value);
    });
    expect(() => saveState(loadState().data)).toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it("importa copias antiguas y exporta todos los campos v2 sin reiniciar la información", () => {
    const migrated = parseBackup(JSON.stringify(legacy()));
    migrated.units.push({
      id: "u",
      courseId: "course-1",
      name: "Unidad propia",
      description: "",
      order: 0,
    });
    const result = parseBackup(serializeBackup(migrated));
    expect(result).toEqual(migrated);
    expect(result.tasks[0].title).toBe("Tarea del usuario");
    expect(stateSchema.safeParse(result).success).toBe(true);
  });
  it("rechaza jerarquías cíclicas y registros v2 con relaciones rotas", () => {
    const d = initialState();
    d.units.push({
      id: "u",
      courseId: "course-1",
      name: "Unidad",
      description: "",
      order: 0,
    });
    d.topics.push({
      id: "t",
      unitId: "u",
      parentId: "t",
      name: "Tema",
      description: "",
      order: 0,
      difficulty: 1,
      mastery: 0,
      completed: false,
      lastStudyDate: null,
      lastReviewDate: null,
      nextReviewDate: null,
      reviewCount: 0,
    });
    expect(() => parseBackup(JSON.stringify(d))).toThrow();
  });
});
it("exporta e importa el temario, plan, programación, registro, historial de repaso y temporizador recuperable", () => {
  const d = initialState();
  d.units = [
    {
      id: "u",
      courseId: "course-1",
      name: "Unidad",
      description: "",
      order: 0,
    },
  ];
  d.topics = [
    {
      id: "t",
      unitId: "u",
      parentId: null,
      name: "Tema",
      description: "",
      order: 0,
      difficulty: 2,
      mastery: 2,
      completed: false,
      lastStudyDate: "2026-10-15",
      lastReviewDate: "2026-10-15",
      nextReviewDate: "2026-10-20",
      reviewCount: 1,
    },
  ];
  d.plans = [
    {
      id: "p",
      courseId: "course-1",
      name: "Plan",
      goal: "",
      startDate: "2026-10-15",
      targetDate: "2026-10-30",
      topicIds: ["t"],
      availability: [60, 60, 60, 60, 60, 60, 60],
      sessionMinutes: 25,
      priority: "media",
      reviewPercent: 20,
      status: "active",
      createdAt: "2026-10-15T15:00:00Z",
    },
  ];
  d.scheduledSessions = [
    {
      id: "s",
      courseId: "course-1",
      topicId: "t",
      planId: "p",
      title: "Tema",
      date: "2026-10-15",
      time: "16:00",
      minutes: 25,
      kind: "review",
      status: "completed",
      manual: false,
      reason: "Repaso",
    },
  ];
  d.studyLogs = [
    {
      id: "l",
      sessionId: "s",
      courseId: "course-1",
      topicId: "t",
      planId: "p",
      topicName: "Tema",
      date: "2026-10-15",
      seconds: 1500,
      notes: "Notas reales",
      mastery: 2,
      kind: "review",
      status: "completed",
      createdAt: "2026-10-15T21:00:00Z",
    },
  ];
  d.reviewHistory = [
    {
      id: "r",
      topicId: "t",
      logId: "l",
      date: "2026-10-15",
      mastery: 2,
      nextDate: "2026-10-20",
    },
  ];
  d.activeTimer = {
    id: "timer",
    sessionId: null,
    courseId: "course-1",
    topicId: "t",
    planId: "p",
    topicName: "Tema",
    kind: "study",
    mode: "continuous",
    phase: "focus",
    block: 1,
    targetSeconds: 1500,
    elapsedSeconds: 100,
    studySeconds: 0,
    runningSince: null,
    lastSeenAt: 12345,
    startedAt: "2026-10-15T21:00:00Z",
  };
  expect(parseBackup(serializeBackup(d))).toEqual(d);
});
