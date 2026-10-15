import { describe, it, expect } from "vitest";
import { initialState } from "../models/schema";
import type {
  AppState,
  StudyPlan,
  StudySession,
  Topic,
} from "../models/schema";
import {
  generateSchedule,
  planProgress,
  sessionConflict,
  toMinute,
} from "./planner";
import {
  completeStudy,
  createTimer,
  timerElapsed,
  timerStudySeconds,
  recoverTimer,
  advanceTimer,
} from "./study";
const NOW = new Date("2026-10-15T13:00:00Z"); // Thursday, 08:00 in Lima.
function fixture(): AppState {
  const d = initialState();
  d.studyPreferences = {
    ...d.studyPreferences,
    availability: [60, 60, 60, 60, 60, 60, 60],
    dayStart: "09:00",
    dayEnd: "20:00",
    activityReserveMinutes: 30,
  };
  d.units = [
    {
      id: "u",
      courseId: "course-1",
      name: "Mecánica",
      description: "",
      order: 0,
    },
  ];
  d.topics = [topic("t1"), topic("t2")];
  d.plans = [plan("p1", ["t1"])];
  return d;
}
function topic(id: string): Topic {
  return {
    id,
    unitId: "u",
    parentId: null,
    name: id,
    description: "",
    difficulty: 3,
    mastery: 0,
    completed: false,
    order: 0,
    lastStudyDate: null,
    lastReviewDate: null,
    nextReviewDate: null,
    reviewCount: 0,
  };
}
function plan(id: string, topicIds: string[]): StudyPlan {
  return {
    id,
    courseId: "course-1",
    name: id,
    goal: "Preparar examen",
    startDate: "2026-10-15",
    targetDate: "2026-10-19",
    topicIds,
    availability: [60, 60, 60, 60, 60, 60, 60],
    sessionMinutes: 30,
    priority: "alta",
    reviewPercent: 20,
    status: "active",
    createdAt: NOW.toISOString(),
  };
}
function session(): StudySession {
  return {
    id: "fixed",
    courseId: "course-1",
    topicId: "t1",
    planId: "p1",
    title: "t1",
    date: "2026-10-15",
    time: "09:00",
    minutes: 30,
    kind: "study",
    status: "completed",
    manual: false,
    reason: "Estudio",
  };
}
describe("Planificación con disponibilidad compartida", () => {
  it("nunca multiplica la disponibilidad cuando compiten varios planes", () => {
    const d = fixture();
    d.plans.push(plan("p2", ["t2"]));
    const result = generateSchedule(d, NOW);
    const days = new Map<string, number>();
    for (const s of result.sessions) {
      days.set(s.date, (days.get(s.date) ?? 0) + s.minutes);
      expect(s.date <= "2026-10-19").toBe(true);
    }
    for (const total of days.values()) expect(total).toBeLessThanOrEqual(60);
    expect(result.unscheduledMinutes).toBeGreaterThan(0);
    expect(result.sessions.some((s) => s.planId === "p1")).toBe(true);
    expect(result.sessions.some((s) => s.planId === "p2")).toBe(true);
  });
  it("respeta días de descanso, límites por plan y actividades con hora", () => {
    const d = fixture();
    d.studyPreferences.availability = [60, 60, 60, 0, 60, 60, 60];
    d.plans[0].availability = [25, 25, 25, 25, 25, 25, 25];
    d.events.push({
      id: "event",
      title: "Actividad",
      courseId: "course-1",
      type: "practica",
      description: "",
      date: "2026-10-16",
      time: "09:00",
      createdAt: NOW.toISOString(),
    });
    const result = generateSchedule(d, NOW);
    expect(result.sessions.some((s) => s.date === "2026-10-15")).toBe(false);
    for (const s of result.sessions.filter((s) => s.date === "2026-10-16"))
      expect(toMinute(s.time)).toBeGreaterThanOrEqual(570);
    for (const day of new Set(result.sessions.map((s) => s.date)))
      expect(
        result.sessions
          .filter((s) => s.date === day)
          .reduce((n, s) => n + s.minutes, 0),
      ).toBeLessThanOrEqual(25);
  });
  it("no programa después del objetivo ni en horas pasadas y avisa si no cabe", () => {
    const d = fixture();
    d.plans[0].targetDate = "2026-10-15";
    const now = new Date("2026-10-16T01:00:00Z");
    const result = generateSchedule(d, now);
    expect(result.sessions).toHaveLength(0);
    expect(result.unscheduledMinutes).toBeGreaterThan(0);
    d.plans[0].targetDate = "2026-10-14";
    const past = generateSchedule(d, NOW);
    expect(past.sessions).toHaveLength(0);
    expect(past.warnings.join("")).toContain("ya pasó");
  });
  it("da primero los huecos disponibles al examen más cercano", () => {
    const d = fixture();
    const urgent = plan("p2", ["t2"]);
    urgent.targetDate = "2026-10-16";
    urgent.priority = "baja";
    d.plans[0].priority = "urgente";
    d.plans.push(urgent);
    const result = generateSchedule(d, NOW);
    expect(result.sessions[0].planId).toBe("p2");
  });
  it("es determinista, no duplica al regenerar y no cambia tareas existentes", () => {
    const d = fixture();
    d.tasks.push({
      id: "task",
      title: "Entrega",
      description: "",
      courseId: "course-1",
      type: "tarea",
      dueDate: "2026-10-15",
      time: "",
      priority: "media",
      status: "pendiente",
      createdAt: NOW.toISOString(),
      completedAt: null,
    });
    const snapshot = structuredClone(d);
    const first = generateSchedule(d, NOW);
    expect(d).toEqual(snapshot);
    expect(generateSchedule(d, NOW).sessions).toEqual(first.sessions);
    d.scheduledSessions = first.sessions;
    const second = generateSchedule(d, NOW);
    expect(second.sessions).toEqual(first.sessions);
    expect(new Set(second.sessions.map((s) => s.id)).size).toBe(
      second.sessions.length,
    );
    expect(d.tasks).toEqual(snapshot.tasks);
  });
  it("conserva sesiones completadas y manuales y cuenta su tiempo compartido", () => {
    const d = fixture();
    const done = session();
    const manual = {
      ...done,
      id: "manual",
      status: "pending" as const,
      manual: true,
      date: "2026-10-16",
    };
    d.scheduledSessions = [done, manual];
    completeStudy(
      { ...d, scheduledSessions: [{ ...done, status: "pending" }] },
      { sessionId: "fixed", seconds: 1800, notes: "", mastery: 1 },
      NOW,
    );
    d.studyLogs = [
      {
        id: "log",
        sessionId: "fixed",
        courseId: "course-1",
        topicId: "t1",
        planId: "p1",
        topicName: "t1",
        date: "2026-10-15",
        seconds: 1800,
        notes: "",
        mastery: 1,
        kind: "study",
        status: "completed",
        createdAt: NOW.toISOString(),
      },
    ];
    const result = generateSchedule(d, NOW);
    expect(result.sessions.find((s) => s.id === "fixed")).toEqual(done);
    expect(result.sessions.find((s) => s.id === "manual")).toEqual(manual);
    expect(
      result.sessions
        .filter((s) => s.date === "2026-10-15")
        .reduce((n, s) => n + s.minutes, 0),
    ).toBeLessThanOrEqual(60);
  });
  it("evita dos repasos iguales para un tema y fecha", () => {
    const d = fixture();
    d.plans.push(plan("p2", ["t1"]));
    const result = generateSchedule(d, NOW);
    const keys = result.sessions
      .filter((s) => s.kind === "review")
      .map((s) => `${s.topicId}-${s.date}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("mantiene el temporizador activo al regenerar y detecta reprogramaciones inválidas", () => {
    const d = fixture();
    const active = { ...session(), status: "pending" as const };
    d.scheduledSessions = [active];
    d.activeTimer = createTimer(
      d,
      {
        courseId: "course-1",
        topicId: "t1",
        planId: "p1",
        sessionId: "fixed",
        minutes: 30,
        mode: "continuous",
      },
      NOW.valueOf(),
    );
    const result = generateSchedule(d, NOW);
    expect(result.sessions.find((s) => s.id === "fixed")).toEqual(active);
    expect(
      sessionConflict(
        d,
        { ...active, id: "other", time: "09:15" },
        undefined,
        NOW,
      ),
    ).toContain("coincide");
    expect(
      sessionConflict(d, { ...active, date: "2026-10-20" }, "fixed", NOW),
    ).toContain("fuera");
  });
});
describe("Tiempo real, comprensión y repasos", () => {
  it("calcula el tiempo por timestamps, admite pausas y no suma una ausencia tras recuperación", () => {
    const d = fixture();
    const t = createTimer(
      d,
      {
        courseId: "course-1",
        topicId: "t1",
        planId: "p1",
        minutes: 25,
        mode: "continuous",
      },
      100000,
    );
    expect(timerElapsed(t, 220000)).toBe(120);
    const paused = { ...t, elapsedSeconds: 120, runningSince: null };
    expect(timerElapsed(paused, 999999)).toBe(120);
    const resumed = { ...paused, runningSince: 300000, lastSeenAt: 360000 };
    expect(timerElapsed(resumed, 420000)).toBe(240);
    const recovered = recoverTimer(resumed, 9999999);
    expect(recovered.runningSince).toBeNull();
    expect(recovered.elapsedSeconds).toBe(180);
    expect(timerStudySeconds(recovered)).toBe(180);
    expect(d.studyLogs).toHaveLength(0);
  });
  it("aplica descanso largo cada cuatro bloques y excluye los descansos del tiempo de estudio", () => {
    const d = fixture();
    const t = createTimer(
      d,
      {
        courseId: "course-1",
        topicId: "t1",
        planId: "p1",
        minutes: 25,
        mode: "pomodoro",
      },
      0,
    );
    d.activeTimer = {
      ...t,
      block: 4,
      elapsedSeconds: 1500,
      runningSince: null,
    };
    const rest = advanceTimer(d, 1000)!;
    expect(rest.phase).toBe("long");
    expect(rest.targetSeconds).toBe(900);
    expect(rest.studySeconds).toBe(1500);
    expect(timerStudySeconds(rest, 5000)).toBe(1500);
    d.activeTimer = rest;
    expect(advanceTimer(d, 901000)?.phase).toBe("focus");
    expect(advanceTimer(d, 901000)?.block).toBe(5);
  });
  it("solo la autoevaluación determina dominio y el intervalo; completar no completa el tema", () => {
    const d = fixture();
    d.scheduledSessions = [{ ...session(), status: "pending" }];
    completeStudy(
      d,
      {
        sessionId: "fixed",
        seconds: 1200,
        notes: "Necesito practicar",
        mastery: 1,
      },
      NOW,
    );
    expect(d.topics[0].mastery).toBe(1);
    expect(d.topics[0].completed).toBe(false);
    expect(d.topics[0].nextReviewDate).toBe("2026-10-17");
    expect(d.studyLogs[0].seconds).toBe(1200);
    expect(d.scheduledSessions[0].status).toBe("completed");
    expect(planProgress(d, d.plans[0])).toBeGreaterThan(0);
    expect(planProgress(d, d.plans[0])).toBeLessThan(100);
    expect(() =>
      completeStudy(
        d,
        { sessionId: "fixed", seconds: 1200, notes: "", mastery: 3 },
        NOW,
      ),
    ).toThrow();
  });
  it("registra historial de repaso e impide finalizar un tema sin autoevaluación", () => {
    const d = fixture();
    d.scheduledSessions = [{ ...session(), status: "pending", kind: "review" }];
    expect(() =>
      completeStudy(
        d,
        { sessionId: "fixed", seconds: 600, notes: "", mastery: null },
        NOW,
      ),
    ).toThrow();
    completeStudy(
      d,
      { sessionId: "fixed", seconds: 600, notes: "Repaso", mastery: 3 },
      NOW,
    );
    expect(d.topics[0].reviewCount).toBe(1);
    expect(d.reviewHistory).toHaveLength(1);
    expect(d.topics[0].nextReviewDate).toBe("2026-10-29");
  });
});
describe("Revisiones tras completar la cuota inicial", () => {
  it("programa un nuevo repaso espaciado cuando vence, aunque el plan ya tenga minutos de repaso registrados", () => {
    const d = fixture();
    d.topics[0].mastery = 3;
    d.topics[0].lastStudyDate = "2026-10-13";
    d.topics[0].nextReviewDate = "2026-10-15";
    d.studyLogs = [
      {
        id: "credit-study",
        sessionId: null,
        courseId: "course-1",
        topicId: "t1",
        planId: "p1",
        topicName: "t1",
        date: "2026-10-13",
        seconds: 9000,
        notes: "",
        mastery: 3,
        kind: "study",
        status: "completed",
        createdAt: "2026-10-13T18:00:00Z",
      },
      {
        id: "credit-review",
        sessionId: null,
        courseId: "course-1",
        topicId: "t1",
        planId: "p1",
        topicName: "t1",
        date: "2026-10-13",
        seconds: 3000,
        notes: "",
        mastery: 3,
        kind: "review",
        status: "completed",
        createdAt: "2026-10-13T19:00:00Z",
      },
    ];
    const result = generateSchedule(d, NOW);
    expect(
      result.sessions.some(
        (s) =>
          s.topicId === "t1" &&
          s.kind === "review" &&
          s.date >= "2026-10-15" &&
          s.planId === "p1",
      ),
    ).toBe(true);
  });
  it("reserva parte del presupuesto diario para repaso cuando quedan trabajos de repaso por ubicar", () => {
    const d = fixture();
    const result = generateSchedule(d, NOW);
    for (const day of new Set(result.sessions.map((s) => s.date))) {
      const study = result.sessions
        .filter((s) => s.date === day && s.kind === "study")
        .reduce((n, s) => n + s.minutes, 0);
      expect(study).toBeLessThanOrEqual(45);
    }
  });
});
