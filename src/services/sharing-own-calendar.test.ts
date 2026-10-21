import { describe, expect, it } from "vitest";
import { initialState } from "../models/schema";
import { ownCalendarEvents } from "./sharing";

describe("calendario conjunto del usuario autenticado", () => {
  it("muestra tareas antiguas aunque estuvieran marcadas privadas", () => {
    const state = initialState();
    state.tasks.push({
      id: "task-one",
      title: "Examen de química",
      description: "Solo debe aparecer el título en el calendario",
      personalNotes: "Notas personales que no deben compartirse",
      courseId: state.courses[0].id,
      type: "examen",
      dueDate: "2026-10-21",
      time: "09:00",
      visibility: "private",
      priority: "alta",
      status: "pendiente",
      createdAt: "2026-10-20T10:00:00.000Z",
      completedAt: null,
    });
    const feed = ownCalendarEvents(
      state,
      "owner-fabrizio",
      "2026-10-01",
      "2026-10-31",
    );
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({
      title: "Examen de química",
      date: "2026-10-21",
      ownerId: "owner-fabrizio",
      kind: "task",
      own: true,
      visibility: "details",
    });
    expect(JSON.stringify(feed)).not.toContain("Notas personales");
  });

  it("incluye actividades y sesiones, pero no sesiones canceladas", () => {
    const state = initialState();
    state.events.push({
      id: "event-one",
      title: "Actividad CAS",
      description: "",
      courseId: null,
      type: "proyecto",
      date: "2026-10-22",
      time: "",
      visibility: "private",
      createdAt: "2026-10-20T10:00:00.000Z",
    });
    state.scheduledSessions.push({
      id: "session-one",
      courseId: null,
      topicId: null,
      planId: null,
      title: "Repaso",
      date: "2026-10-23",
      time: "17:00",
      minutes: 25,
      kind: "review",
      status: "pending",
      manual: true,
      reason: "",
      visibility: "private",
    }, {
      id: "session-cancelled",
      courseId: null,
      topicId: null,
      planId: null,
      title: "Cancelada",
      date: "2026-10-23",
      time: "18:00",
      minutes: 25,
      kind: "study",
      status: "cancelled",
      manual: true,
      reason: "",
      visibility: "details",
    });
    const feed = ownCalendarEvents(
      state,
      "owner-fabrizio",
      "2026-10-01",
      "2026-10-31",
    );
    expect(feed.map((item) => item.title)).toEqual(["Actividad CAS", "Repaso"]);
    expect(feed[1]).toMatchObject({ type: "review", minutes: 25 });
  });
});
