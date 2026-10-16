import type { AppState, ClassroomItem } from "../models/schema";
import { googleGet } from "./google";
import { safeLink } from "./library";
export type ClassroomCourse = { id: string; name: string };
export type CourseWork = {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number; seconds?: number };
  alternateLink: string;
  updateTime?: string;
  materials?: {
    driveFile?: {
      driveFile?: { id: string; title: string; alternateLink?: string };
    };
    link?: { url: string; title?: string };
    youtubeVideo?: { alternateLink: string; title: string };
  }[];
};
export type ImportedWork = { work: CourseWork; submissionState: string };
async function pages<T>(url: string, key: string) {
  const result: T[] = [];
  let next = "";
  const seen = new Set();
  do {
    const u = new URL(url);
    if (next) u.searchParams.set("pageToken", next);
    const r = await googleGet<Record<string, unknown>>("classroom", u.href);
    result.push(...(Array.isArray(r[key]) ? (r[key] as T[]) : []));
    next = typeof r.nextPageToken === "string" ? r.nextPageToken : "";
    if (seen.has(next) && next)
      throw new Error(
        "Paginación de Classroom repetida. No se aplicó este curso.",
      );
    seen.add(next);
    if (result.length > 50000)
      throw new Error("El curso supera el límite de importación.");
  } while (next);
  return result;
}
export function fetchClassroomCourses() {
  return pages<ClassroomCourse>(
    "https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE&pageSize=100",
    "courses",
  );
}
export async function fetchCourseWork(course: string) {
  const base = `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(course)}/courseWork`;
  const works = await pages<CourseWork>(`${base}?pageSize=100`, "courseWork");
  const submissions = await pages<{ courseWorkId: string; state: string }>(
    `${base}/-/studentSubmissions?userId=me&pageSize=100`,
    "studentSubmissions",
  );
  const states = new Map(submissions.map((s) => [s.courseWorkId, s.state]));
  return works.map((work) => ({
    work,
    submissionState: states.get(work.id) ?? "UNKNOWN",
  }));
}
export function classroomDeadline(work: CourseWork, tz: string) {
  if (!work.dueDate) return { date: "", time: "" };
  const { year, month, day } = work.dueDate;
  const instant = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      work.dueTime?.hours ?? 0,
      work.dueTime?.minutes ?? 0,
      work.dueTime?.seconds ?? 0,
    ),
  );
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const p = (k: string) => parts.find((x) => x.type === k)?.value;
  return {
    date: `${p("year")}-${p("month")}-${p("day")}`,
    time: work.dueTime ? `${p("hour")}:${p("minute")}` : "",
  };
}
export function materialId(course: string, work: string, identity: string) {
  // FNV-1a 128-bit is a bounded, stable deduplication key, not an auth token.
  let hash = 0x6c62272e07bb014262b821756295c58dn;
  for (const byte of new TextEncoder().encode(
    JSON.stringify([course, work, identity]),
  ))
    hash =
      ((hash ^ BigInt(byte)) * 0x1000000000000000000013bn) &
      ((1n << 128n) - 1n);
  return `material:${hash.toString(16).padStart(32, "0")}`;
}
export function mergeClassroom(
  data: AppState,
  course: string,
  incoming: ImportedWork[],
  now = new Date().toISOString(),
) {
  const mapping = data.classroomLinks.find(
    (l) => l.externalCourseId === course,
  );
  if (!mapping?.courseId)
    throw new Error("Vincula este curso con un curso de StudySpace.");
  let added = 0,
    updated = 0;
  for (const { work, submissionState } of incoming) {
    if (!work.id || work.courseId !== course)
      throw new Error("Classroom devolvió una actividad de otro curso.");
    const link = safeLink(work.alternateLink);
    if (!link) throw new Error("Enlace Classroom inválido.");
    const due = classroomDeadline(work, data.settings.timezone);
    const title = work.title.slice(0, 200);
    const description = (work.description ?? "").slice(0, 10000);
    let ref = data.classroomItems.find(
      (i) => i.externalCourseId === course && i.externalWorkId === work.id,
    );
    let task = ref ? data.tasks.find((t) => t.id === ref!.taskId) : undefined;
    const remote = {
      remoteTitle: title,
      remoteDescription: description,
      remoteDueDate: due.date,
      remoteTime: due.time,
      url: link,
      submissionState,
      updatedAt: work.updateTime ?? "",
      syncedAt: now,
    };
    if (!ref) {
      task = {
        id: crypto.randomUUID(),
        title,
        description,
        courseId: mapping.courseId,
        type: "tarea",
        dueDate: due.date,
        time: due.time,
        priority: "media",
        visibility: data.settings.calendarDefaultVisibility ?? "private",
        status: "pendiente",
        createdAt: now,
        completedAt: null,
      };
      data.tasks.push(task);
      ref = {
        id: crypto.randomUUID(),
        externalCourseId: course,
        externalWorkId: work.id,
        taskId: task.id,
        ...remote,
      };
      data.classroomItems.push(ref);
      added++;
    } else if (task) {
      const changed =
        Object.keys(remote).some(
          (k) =>
            k !== "syncedAt" &&
            ref![k as keyof ClassroomItem] !== remote[k as keyof typeof remote],
        ) || task.courseId !== mapping.courseId;
      if (changed) {
        if (task.title === ref.remoteTitle) task.title = title;
        if (task.description === ref.remoteDescription)
          task.description = description;
        if (task.dueDate === ref.remoteDueDate) task.dueDate = due.date;
        if (task.time === ref.remoteTime) task.time = due.time;
        task.courseId = mapping.courseId;
        updated++;
      }
      if (ref.remoteDueDate !== due.date || ref.remoteTime !== due.time)
        for (const p of data.plans)
          if (p.targetTaskId === task.id)
            p.deadlineWarning = `Classroom cambió la entrega a ${due.date || "sin fecha"}${due.time ? " " + due.time : ""}. Revisa el objetivo y previsualiza la reprogramación.`;
      Object.assign(ref, remote);
    }
    for (const [index, m] of (work.materials ?? []).entries()) {
      const f = m.driveFile?.driveFile;
      const url = safeLink(
        f?.alternateLink ??
          (f?.id
            ? `https://drive.google.com/file/d/${encodeURIComponent(f.id)}/view`
            : (m.link?.url ?? m.youtubeVideo?.alternateLink ?? "")),
      );
      if (!url) continue;
      // Stable source identity; never bind a reference to its array position.
      // Full IDs are retained so long identifiers cannot collide by truncation.
      const identity = f?.id ? `drive:${f.id}` : `url:${url}`;
      const externalId = materialId(course, work.id, identity);
      const legacyId = `${course}:${work.id}:${index}`.slice(0, 300);
      const legacy = data.documents.find(
        (d) =>
          d.source === "classroom" &&
          d.externalId === legacyId &&
          d.url === url,
      );
      // Also recognize a legacy material moved to another index by its URL.
      const moved = data.documents.find(
        (d) =>
          d.source === "classroom" &&
          d.externalId?.startsWith(`${course}:${work.id}:`) &&
          d.url === url,
      );
      const existing = legacy ?? moved;
      if (existing) existing.externalId = externalId;
      const previous = data.documents.find(
        (d) => d.source === "classroom" && d.externalId === externalId,
      );
      if (!previous)
        data.documents.push({
          id: crypto.randomUUID(),
          name: (
            f?.title ??
            m.link?.title ??
            m.youtubeVideo?.title ??
            title
          ).slice(0, 300),
          url,
          source: "classroom",
          externalId,
          mimeType: "text/uri-list",
          folderId: null,
          courseId: mapping.courseId,
          topicId: null,
          tags: ["Classroom"],
          createdAt: now,
        });
      else {
        previous.url = url;
        previous.courseId = mapping.courseId;
      }
    }
  }
  return { added, updated };
}
