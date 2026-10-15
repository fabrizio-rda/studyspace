import type {
  ActiveTimer,
  AppState,
  StudyLog,
  StudySession,
  Topic,
} from "../models/schema";
import { todayIn, plusDays } from "./dates";
export function timerElapsed(timer: ActiveTimer, now = Date.now()) {
  return Math.min(
    timer.targetSeconds,
    timer.elapsedSeconds +
      (timer.runningSince === null
        ? 0
        : Math.max(0, (now - timer.runningSince) / 1000)),
  );
}
export function timerStudySeconds(timer: ActiveTimer, now = Date.now()) {
  return (
    timer.studySeconds +
    (timer.phase === "focus" ? timerElapsed(timer, now) : 0)
  );
}
export function recoverTimer(
  timer: ActiveTimer,
  now = Date.now(),
): ActiveTimer {
  return {
    ...timer,
    elapsedSeconds: timerElapsed(timer, Math.min(timer.lastSeenAt, now)),
    runningSince: null,
    lastSeenAt: now,
  };
}
export function createTimer(
  data: AppState,
  input: {
    courseId: string | null;
    topicId: string | null;
    planId: string | null;
    sessionId?: string | null;
    minutes: number;
    mode: "continuous" | "pomodoro";
    kind?: "study" | "review";
  },
  now = Date.now(),
): ActiveTimer {
  const topic = data.topics.find((t) => t.id === input.topicId);
  return {
    id: crypto.randomUUID(),
    sessionId: input.sessionId ?? null,
    courseId: input.courseId,
    topicId: input.topicId,
    planId: input.planId,
    topicName: topic?.name ?? "Estudio libre",
    kind: input.kind ?? "study",
    mode: input.mode,
    phase: "focus",
    block: 1,
    targetSeconds:
      (input.mode === "pomodoro"
        ? data.studyPreferences.pomodoroMinutes
        : input.minutes) * 60,
    elapsedSeconds: 0,
    studySeconds: 0,
    runningSince: now,
    lastSeenAt: now,
    startedAt: new Date(now).toISOString(),
  };
}
export function advanceTimer(
  data: AppState,
  now = Date.now(),
): ActiveTimer | null {
  const t = data.activeTimer;
  if (!t) return null;
  const elapsed = timerElapsed(t, now);
  if (t.mode !== "pomodoro")
    return { ...t, runningSince: null, elapsedSeconds: elapsed };
  if (t.phase === "focus") {
    const long = t.block % data.studyPreferences.longBreakEvery === 0;
    return {
      ...t,
      studySeconds: t.studySeconds + elapsed,
      phase: long ? "long" : "short",
      targetSeconds:
        (long
          ? data.studyPreferences.longBreakMinutes
          : data.studyPreferences.shortBreakMinutes) * 60,
      elapsedSeconds: 0,
      runningSince: now,
      lastSeenAt: now,
    };
  }
  return {
    ...t,
    phase: "focus",
    block: t.block + 1,
    targetSeconds: data.studyPreferences.pomodoroMinutes * 60,
    elapsedSeconds: 0,
    runningSince: now,
    lastSeenAt: now,
  };
}
export function completeStudy(
  data: AppState,
  input: {
    sessionId?: string | null;
    timer?: ActiveTimer | null;
    seconds: number;
    notes: string;
    mastery: number | null;
    status?: StudyLog["status"];
    courseId?: string | null;
    topicId?: string | null;
    planId?: string | null;
    kind?: "study" | "review";
  },
  now = new Date(),
) {
  const session = data.scheduledSessions.find((s) => s.id === input.sessionId);
  if (session && session.status !== "pending")
    throw new Error("Esta sesión ya fue completada o cancelada.");
  if (
    input.sessionId &&
    data.studyLogs.some(
      (l) => l.sessionId === input.sessionId && l.status === "completed",
    )
  )
    throw new Error("Esta sesión ya tiene un registro.");
  const timer = input.timer;
  const topicId = session?.topicId ?? timer?.topicId ?? input.topicId ?? null;
  const topic = data.topics.find((t) => t.id === topicId);
  if (topic && input.mastery === null)
    throw new Error("Indica qué tan bien entendiste el tema.");
  const date = todayIn(data.settings.timezone, now);
  const status = input.status ?? "completed";
  const kind = session?.kind ?? timer?.kind ?? input.kind ?? "study";
  const log: StudyLog = {
    id: crypto.randomUUID(),
    sessionId: session?.id ?? null,
    courseId: session?.courseId ?? timer?.courseId ?? input.courseId ?? null,
    topicId,
    planId: session?.planId ?? timer?.planId ?? input.planId ?? null,
    topicName:
      topic?.name ?? timer?.topicName ?? session?.title ?? "Estudio libre",
    date,
    seconds: Math.max(0, Math.round(input.seconds)),
    notes: input.notes,
    mastery: input.mastery,
    kind,
    status,
    createdAt: now.toISOString(),
  };
  data.studyLogs.push(log);
  if (session && status === "completed") session.status = "completed";
  if (topic && status === "completed" && input.mastery !== null) {
    topic.mastery = input.mastery;
    topic.lastStudyDate = date;
    topic.nextReviewDate = plusDays(
      date,
      data.studyPreferences.reviewIntervals[input.mastery],
    );
    if (kind === "review") {
      topic.lastReviewDate = date;
      topic.reviewCount++;
      data.reviewHistory.push({
        id: crypto.randomUUID(),
        topicId: topic.id,
        logId: log.id,
        date,
        mastery: input.mastery,
        nextDate: topic.nextReviewDate,
      });
    }
  }
  if (timer && data.activeTimer?.id === timer.id) data.activeTimer = null;
  return log;
}
export function removeContent(data: AppState, topicIds: string[]) {
  const ids = new Set(topicIds);
  for (const doc of data.documents)
    if (doc.topicId && ids.has(doc.topicId)) doc.topicId = null;
  data.topics = data.topics.filter((t) => !ids.has(t.id));
  for (const p of data.plans)
    p.topicIds = p.topicIds.filter((id) => !ids.has(id));
  for (const s of data.scheduledSessions)
    if (s.topicId && ids.has(s.topicId)) {
      s.topicId = null;
      if (s.status === "pending") s.status = "cancelled";
    }
  for (const l of data.studyLogs)
    if (l.topicId && ids.has(l.topicId)) l.topicId = null;
  for (const h of data.reviewHistory)
    if (h.topicId && ids.has(h.topicId)) h.topicId = null;
  if (data.activeTimer?.topicId && ids.has(data.activeTimer.topicId)) {
    data.activeTimer.topicId = null;
    data.activeTimer.topicName += " (tema eliminado)";
  }
}
export function remainingReviews(data: AppState, today: string) {
  return data.topics.filter(
    (t) => t.nextReviewDate && t.nextReviewDate <= today,
  );
}
export function pendingForToday(data: AppState, today: string) {
  return data.scheduledSessions
    .filter((s) => s.status === "pending" && s.date === today)
    .sort((a, b) => a.time.localeCompare(b.time));
}
export function courseTopics(data: AppState, courseId: string | null): Topic[] {
  const ids = new Set(
    data.units.filter((u) => u.courseId === courseId).map((u) => u.id),
  );
  return data.topics.filter((t) => ids.has(t.unitId));
}
export function sessionLabel(s: StudySession) {
  return s.kind === "review" ? "Repaso" : "Estudio";
}
