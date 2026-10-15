import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialState, stateSchema, COURSE_PALETTE } from "../models/schema";
import { normalizeHex } from "../components/ColorPicker";
import {
  parseBackup,
  saveState,
  loadState,
  STORAGE_KEY,
  PHASE3_BACKUP_KEY,
} from "./storage";
import { removeFolder, safeLink } from "./library";
import { mergeClassroom, classroomDeadline } from "./classroom";
import type { CourseWork } from "./classroom";
import { saveConfig } from "./config";
const createdAt = "2026-10-15T12:00:00.000Z";
const work: CourseWork = {
  id: "work1",
  courseId: "remote-course",
  title: "Examen de física",
  description: "Indicaciones",
  alternateLink: "https://classroom.google.com/c/a/a/b/details",
  dueDate: { year: 2026, month: 10, day: 20 },
  dueTime: { hours: 2, minutes: 30 },
  materials: [
    { link: { url: "https://example.com/lectura", title: "Lectura" } },
  ],
};
function linked() {
  const d = initialState();
  d.classroomLinks.push({
    id: "link1",
    externalCourseId: work.courseId,
    externalName: "Física 10",
    courseId: d.courses[0].id,
  });
  return d;
}
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("Esquema 3, Biblioteca y Classroom", () => {
  it("ofrece 20 colores únicos y normaliza hexadecimales sin aceptar valores inválidos", () => {
    expect(COURSE_PALETTE).toHaveLength(20);
    expect(new Set(COURSE_PALETTE.map((c) => c[1])).size).toBe(20);
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("1234AB")).toBe("#1234AB");
    expect(normalizeHex("#gggggg")).toBeNull();
  });
  it("migra fase 2 conservando exactamente todos sus datos y verifica la copia antes de escribir", () => {
    const d = initialState();
    const {
      folders,
      documents,
      classroomLinks,
      classroomItems,
      integrationPreferences,
      ...old
    } = d;
    void folders;
    void documents;
    void classroomLinks;
    void classroomItems;
    void integrationPreferences;
    const raw = JSON.stringify({ ...old, schemaVersion: 2 });
    localStorage.setItem(STORAGE_KEY, raw);
    const next = loadState().data;
    expect(next.courses).toEqual(d.courses);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    saveState(next);
    expect(localStorage.getItem(PHASE3_BACKUP_KEY)).toBe(raw);
    expect(parseBackup(localStorage.getItem(PHASE3_BACKUP_KEY)!)).toEqual(next);
  });
  it("no sustituye fase 2 si el respaldo falla por cuota", () => {
    const old = { ...initialState(), schemaVersion: 2 };
    const raw = JSON.stringify(old);
    localStorage.setItem(STORAGE_KEY, raw);
    const setter = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      k,
      v,
    ) {
      if (k === PHASE3_BACKUP_KEY) throw Error("Quota");
      setter.call(this, k, v);
    });
    expect(() => saveState(loadState().data)).toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it("rechaza ciclos de carpetas y elimina carpetas conservando referencias y originales", () => {
    const d = initialState();
    d.folders = [
      {
        id: "a",
        name: "Raíz",
        parentId: null,
        courseId: d.courses[0].id,
        color: "#83A8EB",
        icon: "folder",
        createdAt,
      },
      {
        id: "b",
        name: "Hija",
        parentId: "a",
        courseId: null,
        color: "#B3DFF5",
        icon: "book",
        createdAt,
      },
    ];
    d.documents = [
      {
        id: "doc",
        name: "Apuntes",
        url: "https://docs.google.com/document/d/abc/edit",
        source: "manual",
        externalId: null,
        mimeType: "application/vnd.google-apps.document",
        folderId: "b",
        courseId: d.courses[0].id,
        topicId: null,
        tags: [],
        createdAt,
      },
    ];
    d.folders[0].parentId = "b";
    expect(stateSchema.safeParse(d).success).toBe(false);
    d.folders[0].parentId = null;
    const url = d.documents[0].url;
    removeFolder(d, "a");
    expect(d.folders).toEqual([]);
    expect(d.documents[0].folderId).toBeNull();
    expect(d.documents[0].url).toBe(url);
    expect(stateSchema.safeParse(d).success).toBe(true);
    expect(safeLink("javascript:alert(1)")).toBeNull();
  });
  it("convierte la entrega UTC a Lima con el cambio de día y admite actividades sin fecha", () => {
    expect(classroomDeadline(work, "America/Lima")).toEqual({
      date: "2026-10-19",
      time: "21:30",
    });
    expect(
      classroomDeadline(
        { ...work, dueDate: undefined, dueTime: undefined },
        "America/Lima",
      ),
    ).toEqual({ date: "", time: "" });
    const d = linked();
    mergeClassroom(d, work.courseId, [
      {
        work: { ...work, dueDate: undefined, dueTime: undefined },
        submissionState: "NEW",
      },
    ]);
    expect(stateSchema.safeParse(d).success).toBe(true);
    expect(d.tasks[0].dueDate).toBe("");
  });
  it("sincroniza cinco veces sin duplicar tareas ni materiales y mantiene los campos personales", () => {
    const d = linked();
    for (let n = 0; n < 5; n++)
      mergeClassroom(d, work.courseId, [
        { work, submissionState: "TURNED_IN" },
      ]);
    expect(d.tasks).toHaveLength(1);
    expect(d.documents).toHaveLength(1);
    expect(d.tasks[0].status).toBe("pendiente");
    const t = d.tasks[0];
    t.priority = "urgente";
    t.personalNotes = "Mis notas";
    t.estimatedMinutes = 45;
    t.description = "Descripción personalizada";
    t.status = "completada";
    t.completedAt = createdAt;
    const report = mergeClassroom(d, work.courseId, [
      {
        work: {
          ...work,
          title: "Título nuevo",
          description: "Nuevas indicaciones",
          dueDate: { year: 2026, month: 10, day: 22 },
        },
        submissionState: "RETURNED",
      },
    ]);
    expect(report).toEqual({ added: 0, updated: 1 });
    expect(t.title).toBe("Título nuevo");
    expect(t.description).toBe("Descripción personalizada");
    expect(t.dueDate).toBe("2026-10-21");
    expect(t.priority).toBe("urgente");
    expect(t.personalNotes).toBe("Mis notas");
    expect(t.estimatedMinutes).toBe(45);
    expect(t.status).toBe("completada");
    expect(d.classroomItems[0].submissionState).toBe("RETURNED");
    expect(stateSchema.safeParse(d).success).toBe(true);
  });
  it("avisa planes afectados y conserva sesiones completadas sin reprogramar automáticamente", () => {
    const d = linked();
    mergeClassroom(d, work.courseId, [{ work, submissionState: "NEW" }]);
    d.plans.push({
      id: "p",
      name: "Preparar",
      goal: "",
      courseId: d.courses[0].id,
      startDate: "2026-10-15",
      targetDate: "2026-10-19",
      targetTaskId: d.tasks[0].id,
      topicIds: [],
      availability: [60, 60, 60, 60, 60, 0, 0],
      sessionMinutes: 25,
      priority: "alta",
      reviewPercent: 20,
      status: "active",
      createdAt,
    });
    d.scheduledSessions.push({
      id: "s",
      courseId: d.courses[0].id,
      topicId: null,
      planId: "p",
      title: "Estudio",
      date: "2026-10-16",
      time: "16:00",
      minutes: 25,
      kind: "study",
      status: "completed",
      manual: false,
      reason: "",
    });
    const original = structuredClone(d.scheduledSessions);
    mergeClassroom(d, work.courseId, [
      {
        work: { ...work, dueDate: { year: 2026, month: 10, day: 23 } },
        submissionState: "NEW",
      },
    ]);
    expect(d.plans[0].deadlineWarning).toContain("2026-10-22");
    expect(d.plans[0].targetDate).toBe("2026-10-19");
    expect(d.scheduledSessions).toEqual(original);
  });
  it("rechaza secretos administrativos en la configuración pública", () => {
    expect(() =>
      saveConfig({
        supabaseUrl: "https://demo.supabase.co",
        supabaseKey: "sb_secret_never",
        googleClientId: "",
        googleApiKey: "",
        googleAppId: "",
      }),
    ).toThrow("secreta");
    expect(localStorage.getItem("studyspace:public-config:v1")).toBeNull();
  });
});
