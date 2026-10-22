import { beforeEach, describe, expect, it } from "vitest";
import { accountState, claimLocal, canUseLocal } from "./accounts";
import { initialState, stateSchema } from "../models/schema";
import { parseBackup } from "./storage";
import { inViewerTimezone, sharedEventSchema, sharingError } from "./sharing";
import type { SharedEvent } from "./sharing";
const peer: SharedEvent = {
  id: "opaque",
  ownerId: "20000000-0000-4000-8000-000000000002",
  ownerName: "Catalina",
  ownerAccent: "pink",
  sourceTimezone: "America/Lima",
  date: "2026-10-19",
  time: "23:30",
  minutes: null,
  title: "Biology",
  courseName: "Biology",
  courseColor: "#83A8EB",
  type: "examen",
  kind: "event",
  visibility: "details",
  own: false,
};
beforeEach(() => localStorage.clear());
describe("Cuentas y calendario autorizado", () => {
  it("inicializa los diez cursos de Catalina sin actividades, Física, Química ni AP Physics", () => {
    const d = accountState("Catalina", "catalina");
    expect(d.courses.map((c) => c.name)).toEqual([
      "English HL",
      "Literatura HL",
      "Matemática NM",
      "Gestión Empresarial",
      "Historia",
      "TOK / Teoría del Conocimiento",
      "CAS",
      "Cambridge C1 Advanced",
      "Biology",
      "Psicología",
    ]);
    expect(d.settings).toMatchObject({
      name: "Catalina",
      timezone: "America/Lima",
      calendarDefaultVisibility: "details",
      calendarAccent: "pink",
    });
    for (const list of [
      d.tasks,
      d.events,
      d.plans,
      d.units,
      d.topics,
      d.studyLogs,
      d.documents,
      d.reviewHistory,
    ])
      expect(list).toEqual([]);
    expect(stateSchema.safeParse(d).success).toBe(true);
  });
  it("mantiene cursos comunes separados y Cambridge independiente de English; no altera datos existentes", () => {
    const f = accountState("Fabrizio", "fabrizio"),
      c = accountState("Catalina", "catalina");
    expect(f.courses).toHaveLength(11);
    expect(
      f.courses.find((x) => x.name === "Cambridge C1 Advanced")?.id,
    ).not.toBe(c.courses.find((x) => x.name === "Cambridge C1 Advanced")?.id);
    expect(c.courses.find((x) => x.name === "English HL")?.id).not.toBe(
      c.courses.find((x) => x.name === "Cambridge C1 Advanced")?.id,
    );
    const original = initialState();
    expect(parseBackup(JSON.stringify(original))).toEqual(original);
    expect(original.settings.calendarDefaultVisibility).toBeUndefined();
  });
  it("convierte horarios entre zonas con cambio de día, y conserva las fechas de día completo", () => {
    expect(inViewerTimezone(peer, "Europe/Madrid")).toMatchObject({
      date: "2026-10-20",
      time: "06:30",
    });
    expect(
      inViewerTimezone({ ...peer, time: "" }, "Europe/Madrid"),
    ).toMatchObject({ date: "2026-10-19", time: "" });
    expect(
      inViewerTimezone(
        {
          ...peer,
          sourceTimezone: "America/New_York",
          date: "2026-06-15",
          time: "12:00",
        },
        "UTC",
      ),
    ).toMatchObject({ date: "2026-06-15", time: "16:00" });
  });
  it("rechaza registros privados ajenos y cualquier campo o detalle extra en disponibilidad", () => {
    expect(
      sharedEventSchema.safeParse({ ...peer, visibility: "private" }).success,
    ).toBe(false);
    const busy = {
      ...peer,
      visibility: "busy",
      title: "Ocupado",
      courseName: null,
      courseColor: null,
      type: "busy",
      kind: "busy",
    };
    expect(sharedEventSchema.safeParse(busy).success).toBe(true);
    expect(
      sharedEventSchema.safeParse({ ...busy, title: "Título oculto" }).success,
    ).toBe(false);
    expect(
      sharedEventSchema.safeParse({ ...busy, description: "Privada" }).success,
    ).toBe(false);
    expect(
      sharedEventSchema.safeParse({ ...peer, own: true, visibility: "private" })
        .success,
    ).toBe(true);
  });
  it("protege la copia local asociada a una cuenta sin cambiar sus datos", () => {
    claimLocal("fabrizio", "https://demo.supabase.co");
    expect(canUseLocal(null, "https://demo.supabase.co")).toBe(false);
    expect(canUseLocal("catalina", "https://demo.supabase.co")).toBe(false);
    expect(canUseLocal("fabrizio", "https://demo.supabase.co")).toBe(true);
    expect(() => claimLocal("catalina", "https://demo.supabase.co")).toThrow(
      "otra cuenta",
    );
  });
  it("explica migraciones y autorizaciones pendientes sin simular una conexión", () => {
    expect(sharingError("INVITE_NOT_AVAILABLE")).toContain("esta cuenta");
    expect(
      sharingError(
        "Could not find function studyspace_calendar_status in schema cache",
      ),
    ).toContain("migración");
    expect(sharingError("ALREADY_LINKED")).toContain("vinculado");
  });
});
