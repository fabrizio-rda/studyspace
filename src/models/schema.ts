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
export const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    courses: z.array(courseSchema).max(1000),
    tasks: z.array(taskSchema).max(50000),
    events: z.array(eventSchema).max(50000),
    settings: settingsSchema,
  })
  .superRefine((data, ctx) => {
    const courses = new Set(data.courses.map((c) => c.id));
    for (const collection of [data.courses, data.tasks, data.events])
      if (new Set(collection.map((x) => x.id)).size !== collection.length)
        ctx.addIssue({
          code: "custom",
          message: "Hay identificadores duplicados.",
        });
    for (const item of [...data.tasks, ...data.events])
      if (item.courseId && !courses.has(item.courseId))
        ctx.addIssue({
          code: "custom",
          message: "Una actividad referencia un curso inexistente.",
        });
  });
export type Course = z.infer<typeof courseSchema>;
export type Task = z.infer<typeof taskSchema>;
export type AcademicEvent = z.infer<typeof eventSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type AppState = z.infer<typeof stateSchema>;
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
    schemaVersion: 1,
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
