import { z } from "zod";
export const COLORS = [
  "#A18BE0",
  "#ECA6C8",
  "#F4B58A",
  "#83A8EB",
  "#B3DFF5",
  "#A7C6AE",
] as const;
export const ICONS = [
  "atom",
  "flask",
  "calculator",
  "book",
  "briefcase",
  "languages",
  "globe",
  "brain",
  "heart",
  "rocket",
  "graduation",
] as const;
export const TYPES = {
  tarea: "Tarea",
  examen: "Examen",
  practica: "Práctica",
  proyecto: "Proyecto",
  lectura: "Control de lectura",
} as const;
export const PRIORITIES = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
} as const;
export const STATUSES = {
  pendiente: "Pendiente",
  progreso: "En progreso",
  completada: "Completada",
} as const;
export function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("es", { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00`);
    return (
      !Number.isNaN(d.valueOf()) &&
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` ===
        v
    );
  }, "Fecha inválida");
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .or(z.literal(""));
const id = z.string().min(1).max(100);
const courseSchema = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  description: z.string().max(5000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.enum(ICONS),
  archived: z.boolean(),
  order: z.number().int().nonnegative(),
});
const taskSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10000),
    courseId: id.nullable(),
    type: z.enum(["tarea", "examen", "practica", "proyecto", "lectura"]),
    dueDate: dateSchema,
    time: timeSchema,
    priority: z.enum(["baja", "media", "alta", "urgente"]),
    status: z.enum(["pendiente", "progreso", "completada"]),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .refine(
    (t) =>
      t.status === "completada" ? !!t.completedAt : t.completedAt === null,
    "Estado y fecha de finalización incompatibles",
  );
const eventSchema = z.object({
  id,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000),
  courseId: id.nullable(),
  type: z.enum(["tarea", "examen", "practica", "proyecto", "lectura"]),
  date: dateSchema,
  time: timeSchema,
  createdAt: z.string().datetime(),
});
export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  timezone: z.string().refine(validTimezone, "Zona horaria inválida"),
  compact: z.boolean(),
  showArchived: z.boolean(),
  sidebarCollapsed: z.boolean(),
  taskView: z.enum(["list", "kanban"]),
});
export type Course = z.infer<typeof courseSchema>;
export type Task = z.infer<typeof taskSchema>;
export type AcademicEvent = z.infer<typeof eventSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export type TaskType = Task["type"];
const initialCourses: [string, Course["icon"]][] = [
  ["Física IB", "atom"],
  ["AP Physics C: Mechanics", "rocket"],
  ["Química IB", "flask"],
  ["Matemáticas", "calculator"],
  ["Literatura", "book"],
  ["Gestión Empresarial", "briefcase"],
  ["Inglés", "languages"],
  ["Cambridge C1 Advanced", "graduation"],
  ["Historia", "globe"],
  ["Teoría del Conocimiento", "brain"],
  ["CAS", "heart"],
];
export function initialState(): AppState {
  return {
    schemaVersion: 2,
    courses: initialCourses.map(([name, icon], order) => ({
      id: `course-${order + 1}`,
      name,
      icon,
      order,
      color: COLORS[order % COLORS.length],
      description: "",
      archived: false,
    })),
    tasks: [],
    events: [],
    units: [],
    topics: [],
    plans: [],
    scheduledSessions: [],
    studyLogs: [],
    reviewHistory: [],
    activeTimer: null,
    studyPreferences: defaultStudyPreferences(),
    settings: {
      name: "Fabrizio",
      timezone: "America/Lima",
      compact: false,
      showArchived: false,
      sidebarCollapsed: false,
      taskView: "list",
    },
  };
}

export const MASTERY = [
  "No lo entiendo",
  "Necesito practicar",
  "Lo entiendo",
  "Lo domino",
] as const;
export const DIFFICULTY = { 1: "Baja", 2: "Media", 3: "Alta" } as const;
export const WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
const minutes = z.number().int().min(0).max(720);
const weekly = z.array(minutes).length(7);
export function defaultStudyPreferences() {
  return {
    availability: [60, 60, 60, 60, 60, 90, 90],
    preferredMinutes: 25,
    pomodoroMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    reviewIntervals: [1, 2, 5, 14],
    dayStart: "16:00",
    dayEnd: "22:00",
    activityReserveMinutes: 30,
    reviewPercent: 20,
  };
}
export const studyPreferencesSchema = z
  .object({
    availability: weekly,
    preferredMinutes: z.number().int().min(5).max(180),
    pomodoroMinutes: z.number().int().min(1).max(180),
    shortBreakMinutes: z.number().int().min(1).max(60),
    longBreakMinutes: z.number().int().min(1).max(120),
    longBreakEvery: z.number().int().min(1).max(12),
    reviewIntervals: z.array(z.number().int().min(1).max(365)).length(4),
    dayStart: timeSchema.refine((v) => !!v),
    dayEnd: timeSchema.refine((v) => !!v),
    activityReserveMinutes: z.number().int().min(0).max(240),
    reviewPercent: z.number().int().min(0).max(50),
  })
  .refine(
    (p) => p.dayEnd > p.dayStart,
    "El fin del día debe ser posterior al inicio.",
  );
const unitSchema = z.object({
  id,
  courseId: id.nullable(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  order: z.number().int().nonnegative(),
});
const topicSchema = z.object({
  id,
  unitId: id,
  parentId: id.nullable(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000),
  order: z.number().int().nonnegative(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  mastery: z.number().int().min(0).max(3),
  completed: z.boolean(),
  lastStudyDate: dateSchema.nullable(),
  lastReviewDate: dateSchema.nullable(),
  nextReviewDate: dateSchema.nullable(),
  reviewCount: z.number().int().nonnegative(),
});
const planSchema = z
  .object({
    id,
    courseId: id.nullable(),
    name: z.string().trim().min(1).max(200),
    goal: z.string().max(5000),
    startDate: dateSchema,
    targetDate: dateSchema,
    topicIds: z.array(id).max(10000),
    availability: weekly,
    sessionMinutes: z.number().int().min(5).max(180),
    priority: z.enum(["baja", "media", "alta", "urgente"]),
    reviewPercent: z.number().int().min(0).max(50),
    status: z.enum(["active", "paused", "completed"]),
    createdAt: z.string().datetime(),
  })
  .refine(
    (p) => p.targetDate >= p.startDate,
    "La fecha objetivo debe ser posterior al inicio.",
  )
  .refine(
    (p) => new Set(p.topicIds).size === p.topicIds.length,
    "Hay temas repetidos.",
  );
const scheduledSchema = z.object({
  id,
  courseId: id.nullable(),
  topicId: id.nullable(),
  planId: id.nullable(),
  title: z.string().min(1).max(300),
  date: dateSchema,
  time: timeSchema.refine((v) => !!v),
  minutes: z.number().int().min(1).max(720),
  kind: z.enum(["study", "review"]),
  status: z.enum(["pending", "completed", "cancelled"]),
  manual: z.boolean(),
  reason: z.string().max(1000),
});
const logSchema = z.object({
  id,
  sessionId: id.nullable(),
  courseId: id.nullable(),
  topicId: id.nullable(),
  planId: id.nullable(),
  topicName: z.string().max(300),
  date: dateSchema,
  seconds: z.number().min(0).max(86400),
  notes: z.string().max(10000),
  mastery: z.number().int().min(0).max(3).nullable(),
  kind: z.enum(["study", "review"]),
  status: z.enum(["completed", "interrupted"]),
  createdAt: z.string().datetime(),
});
const reviewSchema = z.object({
  id,
  topicId: id.nullable(),
  logId: id,
  date: dateSchema,
  mastery: z.number().int().min(0).max(3),
  nextDate: dateSchema,
});
const timerSchema = z.object({
  id,
  sessionId: id.nullable(),
  courseId: id.nullable(),
  topicId: id.nullable(),
  planId: id.nullable(),
  topicName: z.string().max(300),
  kind: z.enum(["study", "review"]),
  mode: z.enum(["continuous", "pomodoro"]),
  phase: z.enum(["focus", "short", "long"]),
  block: z.number().int().min(1).max(1000),
  targetSeconds: z.number().min(1).max(43200),
  elapsedSeconds: z.number().min(0).max(86400),
  studySeconds: z.number().min(0).max(86400),
  runningSince: z.number().nullable(),
  lastSeenAt: z.number(),
  startedAt: z.string().datetime(),
});
const legacyShape = z.object({
  schemaVersion: z.literal(1),
  courses: z.array(courseSchema).max(1000),
  tasks: z.array(taskSchema).max(50000),
  events: z.array(eventSchema).max(50000),
  settings: settingsSchema,
});
export const legacyStateSchema = legacyShape.superRefine((data, ctx) => {
  const courses = new Set(data.courses.map((c) => c.id));
  for (const list of [data.courses, data.tasks, data.events])
    if (new Set(list.map((x) => x.id)).size !== list.length)
      ctx.addIssue({ code: "custom", message: "IDs duplicados" });
  for (const a of [...data.tasks, ...data.events])
    if (a.courseId && !courses.has(a.courseId))
      ctx.addIssue({ code: "custom", message: "Curso inexistente" });
});
export const stateSchema = z
  .object({
    schemaVersion: z.literal(2),
    courses: z.array(courseSchema).max(1000),
    tasks: z.array(taskSchema).max(50000),
    events: z.array(eventSchema).max(50000),
    settings: settingsSchema,
    units: z.array(unitSchema).max(10000),
    topics: z.array(topicSchema).max(20000),
    plans: z.array(planSchema).max(1000),
    scheduledSessions: z.array(scheduledSchema).max(50000),
    studyLogs: z.array(logSchema).max(50000),
    reviewHistory: z.array(reviewSchema).max(50000),
    studyPreferences: studyPreferencesSchema,
    activeTimer: timerSchema.nullable(),
  })
  .superRefine((d, ctx) => {
    const courses = new Set(d.courses.map((c) => c.id)),
      units = new Map(d.units.map((u) => [u.id, u])),
      topics = new Map(d.topics.map((t) => [t.id, t])),
      plans = new Map(d.plans.map((p) => [p.id, p])),
      sessions = new Set(d.scheduledSessions.map((s) => s.id)),
      logs = new Set(d.studyLogs.map((l) => l.id));
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    for (const list of [
      d.courses,
      d.tasks,
      d.events,
      d.units,
      d.topics,
      d.plans,
      d.scheduledSessions,
      d.studyLogs,
      d.reviewHistory,
    ])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        fail("Identificadores duplicados.");
    for (const a of [
      ...d.tasks,
      ...d.events,
      ...d.units,
      ...d.plans,
      ...d.scheduledSessions,
      ...d.studyLogs,
      ...(d.activeTimer ? [d.activeTimer] : []),
    ])
      if (a.courseId && !courses.has(a.courseId)) fail("Curso inexistente.");
    for (const t of d.topics) {
      if (!units.has(t.unitId)) fail("Unidad inexistente.");
      if (t.parentId) {
        const parent = topics.get(t.parentId);
        if (
          !parent ||
          parent.parentId ||
          parent.id === t.id ||
          parent.unitId !== t.unitId
        )
          fail("Jerarquía de temas inválida.");
      }
    }
    for (const p of d.plans)
      for (const tid of p.topicIds) {
        const t = topics.get(tid);
        if (!t || units.get(t.unitId)?.courseId !== p.courseId)
          fail("Tema incompatible con el curso del plan.");
      }
    for (const a of [
      ...d.scheduledSessions,
      ...d.studyLogs,
      ...(d.activeTimer ? [d.activeTimer] : []),
    ]) {
      if (a.topicId && !topics.has(a.topicId)) fail("Tema inexistente.");
      if (a.planId && !plans.has(a.planId)) fail("Plan inexistente.");
      if (
        a.topicId &&
        units.get(topics.get(a.topicId)!.unitId)?.courseId !== a.courseId
      )
        fail("Curso y tema incompatibles.");
      if (a.planId && plans.get(a.planId)!.courseId !== a.courseId)
        fail("Curso y plan incompatibles.");
    }
    for (const l of [...d.studyLogs, ...(d.activeTimer ? [d.activeTimer] : [])])
      if (l.sessionId && !sessions.has(l.sessionId))
        fail("Sesión programada inexistente.");
    for (const r of d.reviewHistory)
      if (!logs.has(r.logId) || (r.topicId && !topics.has(r.topicId)))
        fail("Historial de repaso inválido.");
    const finished = d.studyLogs.filter(
      (l) => l.sessionId && l.status === "completed",
    );
    if (new Set(finished.map((l) => l.sessionId)).size !== finished.length)
      fail("Una sesión no puede completarse dos veces.");
  });
export type AppState = z.infer<typeof stateSchema>;
export type StudyPreferences = z.infer<typeof studyPreferencesSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type StudyPlan = z.infer<typeof planSchema>;
export type StudySession = z.infer<typeof scheduledSchema>;
export type StudyLog = z.infer<typeof logSchema>;
export type ActiveTimer = z.infer<typeof timerSchema>;
