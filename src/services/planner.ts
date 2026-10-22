import type {
  AppState,
  StudyPlan,
  StudySession,
  Topic,
} from "../models/schema";
import { MASTERY } from "../models/schema";
import { todayIn, parseDay, plusDays, daysUntil } from "./dates";
export const toMinute = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function weekday(date: string) {
  return (parseDay(date).getDay() + 6) % 7;
}
export function nowMinute(timezone: string, now = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return (
    Number(p.find((x) => x.type === "hour")?.value) * 60 +
    Number(p.find((x) => x.type === "minute")?.value)
  );
}
export function topicCourse(data: AppState, t: Topic) {
  return data.units.find((u) => u.id === t.unitId)?.courseId ?? null;
}
export function estimatedMinutes(topic: Topic) {
  return Math.max(
    10,
    Math.ceil(
      (topic.difficulty * 30 * [1.5, 1.2, 0.8, 0.5][topic.mastery]) / 5,
    ) * 5,
  );
}
const priorityWeight = { urgente: 4, alta: 3, media: 2, baja: 1 };
export function planProgress(data: AppState, plan: StudyPlan) {
  let total = 0,
    done = 0;
  for (const t of data.topics.filter((t) => plan.topicIds.includes(t.id))) {
    const study = estimatedMinutes(t),
      review = plan.reviewPercent
        ? Math.max(
            5,
            Math.ceil(
              (study * plan.reviewPercent) / (100 - plan.reviewPercent) / 5,
            ) * 5,
          )
        : 0;
    total += study + review;
    for (const kind of ["study", "review"] as const) {
      const actual = data.studyLogs
        .filter(
          (l) =>
            l.planId === plan.id &&
            l.topicId === t.id &&
            l.kind === kind &&
            l.status === "completed",
        )
        .reduce((n, l) => n + l.seconds / 60, 0);
      done += Math.min(kind === "study" ? study : review, actual);
    }
  }
  return total ? Math.min(100, Math.floor((done / total) * 100)) : 0;
}
export function topicProgress(data: AppState, courseId: string) {
  const topics = data.topics.filter((t) => topicCourse(data, t) === courseId);
  return {
    total: topics.length,
    completed: topics.filter((t) => t.completed).length,
    mastered: topics.filter((t) => t.mastery === 3).length,
  };
}
export function recommendationReason(
  topic: Topic,
  plan: StudyPlan | undefined,
  today: string,
  kind: "study" | "review",
) {
  const reason: string[] = [];
  if (plan)
    reason.push(
      daysUntil(plan.targetDate, today) === 0
        ? "La fecha objetivo es hoy."
        : `La fecha objetivo es en ${daysUntil(plan.targetDate, today)} días.`,
    );
  if (kind === "review" && topic.nextReviewDate)
    reason.push(`Repaso recomendado desde el ${topic.nextReviewDate}.`);
  else if (topic.mastery < 2)
    reason.push(`Dominio registrado: ${MASTERY[topic.mastery].toLowerCase()}.`);
  else
    reason.push(
      `Dificultad ${topic.difficulty}/3; práctica prevista en el plan.`,
    );
  return reason.join(" ");
}
function reservations(
  data: AppState,
  sessions: StudySession[],
  date: string,
  now: Date,
) {
  const pref = data.studyPreferences;
  const today = todayIn(data.settings.timezone, now);
  const intervals: [number, number][] = [];
  let used = 0;
  const perPlan = new Map<string, number>();
  for (const s of sessions.filter(
    (s) => s.date === date && s.status !== "cancelled",
  )) {
    const actual = data.studyLogs.find(
      (l) => l.sessionId === s.id && l.status === "completed",
    );
    used += Math.max(s.minutes, actual ? Math.ceil(actual.seconds / 60) : 0);
    intervals.push([toMinute(s.time), toMinute(s.time) + s.minutes]);
    if (s.planId)
      perPlan.set(s.planId, (perPlan.get(s.planId) ?? 0) + s.minutes);
  }
  for (const l of data.studyLogs.filter((l) => l.date === date && !l.sessionId))
    used += Math.ceil(l.seconds / 60);
  for (const a of [
    ...data.tasks
      .filter((t) => t.dueDate === date)
      .map((t) => ({ time: t.time })),
    ...data.events.filter((e) => e.date === date),
  ]) {
    used += pref.activityReserveMinutes;
    if (a.time)
      intervals.push([
        toMinute(a.time),
        toMinute(a.time) + pref.activityReserveMinutes,
      ]);
  }
  const start = Math.max(
    toMinute(pref.dayStart),
    date === today
      ? Math.ceil((nowMinute(data.settings.timezone, now) + 1) / 5) * 5
      : 0,
  );
  return {
    intervals,
    used,
    perPlan,
    start,
    end: toMinute(pref.dayEnd),
    cap: pref.availability[weekday(date)],
  };
}
export function sessionConflict(
  data: AppState,
  session: StudySession,
  ignoreId?: string,
  now = new Date(),
): string | null {
  const today = todayIn(data.settings.timezone, now);
  if (
    session.date < today ||
    (session.date === today &&
      toMinute(session.time) < nowMinute(data.settings.timezone, now))
  )
    return "La sesión debe comenzar en una fecha y hora futuras.";
  const plan = data.plans.find((p) => p.id === session.planId);
  if (plan && (session.date < plan.startDate || session.date > plan.targetDate))
    return "La sesión queda fuera de las fechas del plan.";
  const r = reservations(
    data,
    data.scheduledSessions.filter((s) => s.id !== ignoreId),
    session.date,
    now,
  );
  const start = toMinute(session.time),
    end = start + session.minutes;
  if (start < toMinute(data.studyPreferences.dayStart) || end > r.end)
    return "La sesión queda fuera de tu horario de estudio.";
  if (r.used + session.minutes > r.cap)
    return "Se superaría tu disponibilidad total para ese día.";
  if (
    plan &&
    (r.perPlan.get(plan.id) ?? 0) + session.minutes >
      plan.availability[weekday(session.date)]
  )
    return "Se superaría el límite diario de este plan.";
  if (r.intervals.some(([a, b]) => start < b && end > a))
    return "La sesión coincide con otra sesión o actividad reservada.";
  if (
    session.kind === "review" &&
    session.topicId &&
    data.scheduledSessions.some(
      (s) =>
        s.id !== ignoreId &&
        s.status !== "cancelled" &&
        s.topicId === session.topicId &&
        s.kind === "review" &&
        s.date === session.date,
    )
  )
    return "Ya existe un repaso de este tema en esa fecha.";
  return null;
}
export interface SchedulePreview {
  sessions: StudySession[];
  warnings: string[];
  created: number;
  replaced: number;
  unscheduledMinutes: number;
  fingerprint: string;
}
export function planningFingerprint(data: AppState) {
  return JSON.stringify([
    data.plans,
    data.topics,
    data.units,
    data.studyPreferences,
    data.scheduledSessions,
    data.studyLogs,
    data.tasks,
    data.events,
    data.activeTimer?.sessionId,
    data.settings.timezone,
  ]);
}
export function generateSchedule(
  data: AppState,
  now = new Date(),
): SchedulePreview {
  const today = todayIn(data.settings.timezone, now);
  const preserved = data.scheduledSessions.filter(
    (s) =>
      s.status !== "pending" ||
      s.manual ||
      s.id === data.activeTimer?.sessionId,
  );
  const result = [...preserved];
  const warnings: string[] = [];
  let unscheduledMinutes = 0;
  const plans = data.plans
    .filter((p) => p.status === "active")
    .sort(
      (a, b) =>
        a.targetDate.localeCompare(b.targetDate) ||
        priorityWeight[b.priority] - priorityWeight[a.priority] ||
        a.id.localeCompare(b.id),
    );
  type Job = {
    plan?: StudyPlan;
    topic: Topic;
    kind: "study" | "review";
    remaining: number;
    from: string;
    until: string;
    sequence: number;
  };
  const jobs: Job[] = [];
  for (const p of plans) {
    if (p.targetDate < today) {
      warnings.push(`${p.name}: la fecha objetivo ya pasó.`);
      continue;
    }
    if (!p.topicIds.length) {
      warnings.push(`${p.name}: no tiene temas seleccionados.`);
      continue;
    }
    const until =
      daysUntil(p.targetDate, today) > 730
        ? plusDays(today, 730)
        : p.targetDate;
    if (until !== p.targetDate)
      warnings.push(
        `${p.name}: se muestran como máximo 730 días de preparación.`,
      );
    const topics = data.topics
      .filter((t) => p.topicIds.includes(t.id))
      .sort(
        (a, b) =>
          b.difficulty * (4 - b.mastery) - a.difficulty * (4 - a.mastery) ||
          a.order - b.order ||
          a.id.localeCompare(b.id),
      );
    for (const t of topics) {
      const estimated = estimatedMinutes(t);
      const credit = (kind: "study" | "review") =>
        data.studyLogs
          .filter(
            (l) =>
              l.planId === p.id &&
              l.topicId === t.id &&
              l.kind === kind &&
              l.status === "completed",
          )
          .reduce((n, l) => n + l.seconds / 60, 0) +
        preserved
          .filter(
            (s) =>
              s.planId === p.id &&
              s.topicId === t.id &&
              s.kind === kind &&
              s.status === "pending" &&
              s.date >= today,
          )
          .reduce((n, s) => n + s.minutes, 0);
      const studyNeed = Math.max(
        0,
        Math.ceil((estimated - credit("study")) / 5) * 5,
      );
      const reviewEstimate = p.reviewPercent
        ? Math.max(
            5,
            Math.ceil(
              (estimated * p.reviewPercent) / (100 - p.reviewPercent) / 5,
            ) * 5,
          )
        : 0;
      const reviewNeed = Math.max(
        0,
        Math.ceil((reviewEstimate - credit("review")) / 5) * 5,
      );
      const from = p.startDate > today ? p.startDate : today;
      if (studyNeed)
        jobs.push({
          plan: p,
          topic: t,
          kind: "study",
          remaining: studyNeed,
          from,
          until,
          sequence: 0,
        });
      if (reviewNeed)
        jobs.push({
          plan: p,
          topic: t,
          kind: "review",
          remaining: reviewNeed,
          from,
          until,
          sequence: 0,
        });
    }
  }
  // A due spaced review remains relevant even when the plan's initial review quota was already completed.
  for (const t of data.topics.filter(
    (t) => t.nextReviewDate && t.nextReviewDate <= plusDays(today, 30),
  )) {
    if (
      result.some(
        (s) =>
          s.topicId === t.id && s.kind === "review" && s.status === "pending",
      )
    )
      continue;
    const from = t.nextReviewDate! > today ? t.nextReviewDate! : today;
    const existing = jobs.find(
      (j) => j.topic.id === t.id && j.kind === "review" && j.remaining > 0,
    );
    if (existing) {
      if (from > existing.from) existing.from = from;
      continue;
    }
    const related = plans.find(
      (p) => p.topicIds.includes(t.id) && p.targetDate >= from,
    );
    jobs.push({
      plan: related,
      topic: t,
      kind: "review",
      remaining: Math.min(20, data.studyPreferences.preferredMinutes),
      from,
      until: related?.targetDate ?? plusDays(from, 14),
      sequence: 0,
    });
  }
  const lastStudy = new Map<string, string>();
  for (const s of preserved)
    if (
      s.kind === "study" &&
      s.topicId &&
      (!lastStudy.has(s.topicId) || s.date > lastStudy.get(s.topicId)!)
    )
      lastStudy.set(s.topicId, s.date);
  // Each round allocates at most one block per plan/topic. Urgent deadlines get the first available shared slots.
  let guard = 0;
  while (jobs.some((j) => j.remaining > 0) && guard++ < 20000) {
    let allocated = false;
    for (const job of jobs) {
      if (job.remaining <= 0) continue;
      const { plan, topic } = job;
      if (
        job.kind === "review" &&
        jobs.some(
          (j) =>
            j.plan?.id === plan?.id &&
            j.topic.id === topic.id &&
            j.kind === "study" &&
            j.remaining > 0,
        )
      )
        continue;
      let from = job.from;
      if (job.kind === "review" && lastStudy.has(topic.id)) {
        const next = plusDays(lastStudy.get(topic.id)!, 1);
        if (next > from) from = next;
      }
      for (let date = from; date <= job.until; date = plusDays(date, 1)) {
        const r = reservations(data, result, date, now);
        const quota = plan
          ? plan.availability[weekday(date)] - (r.perPlan.get(plan.id) ?? 0)
          : Infinity;
        let budget = Math.min(r.cap - r.used, quota);
        if (
          job.kind === "study" &&
          jobs.some((j) => j.kind === "review" && j.remaining > 0)
        ) {
          const reserve = Math.max(
            ...jobs
              .filter((j) => j.kind === "review" && j.remaining > 0)
              .map(
                (j) =>
                  j.plan?.reviewPercent ?? data.studyPreferences.reviewPercent,
              ),
            0,
          );
          const activityUsed =
            (data.tasks.filter((t) => t.dueDate === date).length +
              data.events.filter((e) => e.date === date).length) *
            data.studyPreferences.activityReserveMinutes;
          const studyUsed =
            result
              .filter(
                (s) =>
                  s.date === date &&
                  s.status !== "cancelled" &&
                  s.kind === "study",
              )
              .reduce(
                (n, s) =>
                  n +
                  Math.max(
                    s.minutes,
                    ...data.studyLogs
                      .filter((l) => l.sessionId === s.id)
                      .map((l) => Math.ceil(l.seconds / 60)),
                  ),
                0,
              ) +
            data.studyLogs
              .filter(
                (l) => l.date === date && !l.sessionId && l.kind === "study",
              )
              .reduce((n, l) => n + Math.ceil(l.seconds / 60), 0);
          budget = Math.min(
            budget,
            Math.floor(
              (Math.max(0, r.cap - activityUsed) * (100 - reserve)) / 100 / 5,
            ) *
              5 -
              studyUsed,
          );
        }
        if (budget < 5) continue;
        if (
          job.kind === "review" &&
          result.some(
            (s) =>
              s.status !== "cancelled" &&
              s.kind === "review" &&
              s.topicId === topic.id &&
              s.date === date,
          )
        )
          continue;
        let duration = Math.min(
          job.remaining,
          plan?.sessionMinutes ?? data.studyPreferences.preferredMinutes,
          Math.floor(budget / 5) * 5,
        );
        let slot = -1;
        for (let m = r.start; m + 5 <= r.end; m += 5) {
          const nextBlocked = r.intervals
            .filter(([, b]) => b > m)
            .sort((a, b) => a[0] - b[0])[0];
          const freeUntil = nextBlocked
            ? Math.min(r.end, nextBlocked[0])
            : r.end;
          if (nextBlocked && m >= nextBlocked[0]) continue;
          const fit = Math.floor((freeUntil - m) / 5) * 5;
          if (fit >= 5) {
            duration = Math.min(duration, fit);
            slot = m;
            break;
          }
        }
        if (slot < 0) continue;
        const session: StudySession = {
          id: `auto-${plan?.id ?? "review"}-${topic.id}-${job.kind}-${job.sequence++}-${date}-${slot}`,
          courseId: plan?.courseId ?? topicCourse(data, topic),
          topicId: topic.id,
          planId: plan?.id ?? null,
          title: topic.name,
          date,
          time: toTime(slot),
          minutes: duration,
          kind: job.kind,
          status: "pending",
          manual: false,
          visibility: "details",
          reason: recommendationReason(topic, plan, today, job.kind),
        };
        if (!result.some((s) => s.id === session.id)) result.push(session);
        job.remaining -= duration;
        if (job.kind === "study") lastStudy.set(topic.id, date);
        allocated = true;
        break;
      }
    }
    if (!allocated) break;
  }
  for (const job of jobs)
    if (job.remaining) {
      unscheduledMinutes += job.remaining;
      warnings.push(
        `${job.plan?.name ?? "Repasos"} · ${job.topic.name}: faltan ${job.remaining} min de ${job.kind === "review" ? "repaso" : "estudio"} por ubicar antes del ${job.until}.`,
      );
    }
  if (preserved.some((s) => s.status === "pending" && s.date < today))
    warnings.push(
      "Hay sesiones manuales atrasadas. Se conservan y debes reprogramarlas o cancelarlas.",
    );
  return {
    sessions: result,
    warnings,
    created: result.length - preserved.length,
    replaced: data.scheduledSessions.filter(
      (s) =>
        s.status === "pending" &&
        !s.manual &&
        s.id !== data.activeTimer?.sessionId,
    ).length,
    unscheduledMinutes,
    fingerprint: planningFingerprint(data),
  };
}
