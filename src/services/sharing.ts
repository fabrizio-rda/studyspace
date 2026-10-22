import { z } from "zod";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { cloudRpc } from "./cloud";
import { dateSchema, validTimezone, visibilitySchema } from "../models/schema";
import type { AppState } from "../models/schema";
const accent = z.enum(["blue", "pink"]);
const invite = z
  .object({
    id: z.string().uuid(),
    email: z.string(),
    status: z.enum(["pending", "accepted", "revoked", "rejected", "expired"]),
    expiresAt: z.string(),
  })
  .strict();
export const sharingStatusSchema = z
  .object({
    connection: z
      .object({
        id: z.string().uuid(),
        peerId: z.string().uuid(),
        peerName: z.string(),
        peerEmail: z.string().email(),
        peerAccent: accent,
      })
      .strict()
      .nullable(),
    outgoing: z.array(invite),
    incoming: z.array(
      z
        .object({
          id: z.string().uuid(),
          fromName: z.string(),
          fromEmail: z.string().email(),
          expiresAt: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export type SharingStatus = z.infer<typeof sharingStatusSchema>;
export const emptySharing: SharingStatus = {
  connection: null,
  outgoing: [],
  incoming: [],
};
export const sharedEventSchema = z
  .object({
    id: z.string().min(1),
    ownerId: z.string().uuid(),
    ownerName: z.string().max(60),
    ownerAccent: accent,
    sourceTimezone: z.string().refine(validTimezone),
    date: dateSchema,
    time: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
    minutes: z.number().int().min(0).max(720).nullable(),
    title: z.string().max(300),
    courseName: z.string().max(100).nullable(),
    courseColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .nullable(),
    type: z.string(),
    kind: z.enum(["task", "event", "session", "busy"]),
    visibility: visibilitySchema,
    own: z.boolean(),
  })
  .strict()
  .refine(
    (event) => event.own || event.visibility !== "private",
    "Actividad ajena no autorizada",
  )
  .refine(
    (event) =>
      event.visibility !== "busy" ||
      event.own ||
      (event.title === "Ocupado" &&
        event.courseName === null &&
        event.courseColor === null &&
        event.kind === "busy" &&
        event.type === "busy"),
    "La disponibilidad no debe contener detalles",
  );
export type SharedEvent = z.infer<typeof sharedEventSchema>;

// Generate the signed-in student's calendar directly from their current state.
// The other student's records are still loaded only through the authorized RPC.
export function ownCalendarEvents(
  data: AppState,
  ownerId: string,
  start: string,
  end: string,
): SharedEvent[] {
  const courses = new Map(data.courses.map((course) => [course.id, course]));
  const accent = data.settings.calendarAccent === "pink" ? "pink" : "blue";
  const ownerName = data.settings.name;
  function make(
    kind: "task" | "event" | "session",
    id: string,
    date: string,
    time: string,
    title: string,
    type: string,
    courseId: string | null,
    minutes: number | null,
  ): SharedEvent | null {
    if (!date || date < start || date > end) return null;
    const course = courseId ? courses.get(courseId) : undefined;
    return {
      id: `${ownerId}:${kind}:${id}`,
      ownerId,
      ownerName,
      ownerAccent: accent,
      sourceTimezone: data.settings.timezone,
      date,
      time: time || "",
      minutes,
      title,
      courseName: course?.name ?? null,
      courseColor: course?.color ?? null,
      type,
      kind,
      visibility: "details",
      own: true,
    };
  }
  return [
    ...data.tasks.map((task) =>
      make(
        "task",
        task.id,
        task.dueDate,
        task.time,
        task.title,
        task.type,
        task.courseId,
        null,
      ),
    ),
    ...data.events.map((event) =>
      make(
        "event",
        event.id,
        event.date,
        event.time,
        event.title,
        event.type,
        event.courseId,
        null,
      ),
    ),
    ...data.scheduledSessions
      .filter((session) => session.status !== "cancelled")
      .map((session) =>
        make(
          "session",
          session.id,
          session.date,
          session.time,
          session.title,
          session.kind === "review" ? "review" : "study",
          session.courseId,
          session.minutes,
        ),
      ),
  ]
    .filter((event): event is SharedEvent => event !== null)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.title.localeCompare(b.title),
    );
}
const feedSchema = z
  .object({
    connected: z.boolean(),
    events: z.array(sharedEventSchema).max(50000),
  })
  .strict();
export function sharingError(message: string) {
  const errors: Record<string, string> = {
    AUTH_REQUIRED: "Inicia sesión para consultar el calendario compartido.",
    VERIFIED_EMAIL_REQUIRED: "Confirma tu email mediante el código de acceso.",
    INITIALIZE_ACCOUNT_FIRST:
      "Configura tu cuenta antes de vincular el calendario.",
    INVALID_RECIPIENT:
      "Escribe el email real de la otra persona; debe ser distinto al tuyo.",
    ALREADY_LINKED:
      "Una de las cuentas ya tiene un calendario vinculado. Revoca la vinculación anterior antes de continuar.",
    INVITE_NOT_AVAILABLE:
      "La invitación no está disponible para esta cuenta, venció o fue cancelada.",
    INVITE_LIMIT:
      "Tienes cinco invitaciones pendientes. Cancela alguna antes de crear otra.",
    INVALID_RANGE: "Selecciona un periodo de hasta tres meses.",
  };
  if (errors[message]) return errors[message];
  if (
    message.includes("studyspace_calendar_") &&
    (message.includes("function") || message.includes("schema cache"))
  )
    return "Falta aplicar la migración de calendario compartido en Supabase. Consulta la guía.";
  return message;
}
function fail(error: { message: string } | null) {
  if (error) throw new Error(sharingError(error.message));
}
export async function sharingStatus() {
  const { data, error } = await cloudRpc("studyspace_calendar_status");
  fail(error);
  return sharingStatusSchema.parse(data);
}
export async function inviteCalendar(email: string) {
  const { data, error } = await cloudRpc("studyspace_calendar_invite", {
    p_email: email.trim(),
  });
  fail(error);
  return z.object({ id: z.string().uuid() }).parse(data);
}
export async function acceptCalendar(id: string) {
  const { data, error } = await cloudRpc("studyspace_calendar_accept", {
    p_invite_id: id,
  });
  fail(error);
  return sharingStatusSchema.parse(data);
}
export async function cancelCalendar(id: string) {
  const { data, error } = await cloudRpc("studyspace_calendar_cancel", {
    p_invite_id: id,
  });
  fail(error);
  return sharingStatusSchema.parse(data);
}
export async function revokeCalendar() {
  const { data, error } = await cloudRpc("studyspace_calendar_revoke");
  fail(error);
  return sharingStatusSchema.parse(data);
}
export function inViewerTimezone(
  event: SharedEvent,
  timezone: string,
): SharedEvent {
  if (!event.time || timezone === event.sourceTimezone) return event;
  const instant = fromZonedTime(
    `${event.date}T${event.time}:00`,
    event.sourceTimezone,
  );
  return {
    ...event,
    date: formatInTimeZone(instant, timezone, "yyyy-MM-dd"),
    time: formatInTimeZone(instant, timezone, "HH:mm"),
  };
}
export async function calendarFeed(
  start: string,
  end: string,
  timezone: string,
) {
  const { data, error } = await cloudRpc("studyspace_calendar_feed", {
    p_start: start,
    p_end: end,
  });
  fail(error);
  const result = feedSchema.parse(data);
  const unique = new Map<string, SharedEvent>();
  for (const item of result.events) {
    const event = inViewerTimezone(item, timezone);
    if (event.date >= start && event.date <= end) unique.set(event.id, event);
  }
  return {
    ...result,
    events: [...unique.values()].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.ownerName.localeCompare(b.ownerName),
    ),
  };
}
