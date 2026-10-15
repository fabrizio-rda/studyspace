import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  BookOpen,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useStore } from "../services/store";
import { MASTERY } from "../models/schema";
import type { ActiveTimer } from "../models/schema";
import {
  createTimer,
  advanceTimer,
  timerElapsed,
  timerStudySeconds,
  courseTopics,
} from "../services/study";
import { todayIn, weekStart, displayDate } from "../services/dates";
import { Card, Empty } from "../components/ui";
import { CompleteSessionDialog } from "../components/StudyDialogs";
import SessionCards from "../components/SessionCards";
import Reviews from "../components/Reviews";
const clockText = (seconds: number) =>
  `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;
export default function StudySessions() {
  const { data, commit, notify } = useStore();
  const [courseId, setCourseId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [planId, setPlanId] = useState("");
  const [minutes, setMinutes] = useState(
    data.studyPreferences.preferredMinutes,
  );
  const [mode, setMode] = useState<"continuous" | "pomodoro">("continuous");
  const [tick, setTick] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("pending");
  const [courseFilter, setCourseFilter] = useState("");
  const timer = data.activeTimer;
  const today = todayIn(data.settings.timezone);
  const week = weekStart(today);
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const elapsed = timer ? timerElapsed(timer, tick) : 0;
  const remaining = timer
    ? Math.max(0, timer.targetSeconds - elapsed)
    : minutes * 60;
  const finished = !!timer && remaining === 0;
  const topics = courseTopics(data, courseId || null);
  const records = data.studyLogs.filter(
    (l) => !courseFilter || l.courseId === courseFilter,
  );
  const todayMinutes = data.studyLogs
    .filter((l) => l.date === today)
    .reduce((n, l) => n + l.seconds / 60, 0);
  const weekHours = data.studyLogs
    .filter((l) => l.date >= week && l.date <= today)
    .reduce((n, l) => n + l.seconds / 3600, 0);
  function updateTimer(fn: (t: ActiveTimer) => void, message: string) {
    commit((d) => {
      if (!d.activeTimer || d.activeTimer.id !== timer?.id)
        throw new Error("El temporizador ya cambió en otra pestaña.");
      fn(d.activeTimer);
    }, message);
  }
  function start(e: FormEvent) {
    e.preventDefault();
    const ok = commit((d) => {
      if (d.activeTimer) throw new Error("Ya hay un temporizador activo.");
      const topic = d.topics.find((t) => t.id === topicId);
      if (
        planId &&
        !d.plans.find((p) => p.id === planId)?.topicIds.includes(topicId)
      )
        throw new Error("El tema no pertenece al plan seleccionado.");
      d.activeTimer = createTimer(d, {
        courseId: courseId || null,
        topicId: topic?.id ?? null,
        planId: planId || null,
        minutes,
        mode,
      });
    }, "Temporizador iniciado");
    if (ok) setTick(Date.now());
  }
  return (
    <div className="page study-sessions-page">
      <div className="page-heading">
        <div>
          <h1>Sesiones de estudio</h1>
          <p>
            Temporizador, registros y repasos. Aquí se cuenta el tiempo real.
          </p>
        </div>
      </div>
      <div className="study-stats">
        <div>
          <strong>{Math.round(todayMinutes * 10) / 10}</strong>
          <span>min estudiados hoy</span>
        </div>
        <div>
          <strong>{Math.round(weekHours * 10) / 10}</strong>
          <span>horas esta semana</span>
        </div>
        <div>
          <strong>
            {data.studyLogs.filter((l) => l.status === "completed").length}
          </strong>
          <span>sesiones completadas</span>
        </div>
        <div>
          <strong>
            {
              data.scheduledSessions.filter((s) => s.status === "pending")
                .length
            }
          </strong>
          <span>sesiones pendientes</span>
        </div>
      </div>
      <div className="timer-layout">
        <Card
          title={timer ? "Temporizador activo" : "Iniciar sesión"}
          className="timer-panel"
        >
          <div className="timer-mode-label">
            {timer
              ? timer.mode === "pomodoro"
                ? `Pomodoro · Bloque ${timer.block} · ${timer.phase === "focus" ? "Estudio" : timer.phase === "short" ? "Descanso corto" : "Descanso largo"}`
                : "Estudio continuo"
              : "Configura el temporizador"}
          </div>
          <div
            className={`study-clock ${timer?.phase !== "focus" && timer ? "break-phase" : ""}`}
            style={{
              background: `conic-gradient(#83A8EB ${timer ? Math.min(100, (elapsed / timer.targetSeconds) * 100) : 0}%, #DFEBF5 0)`,
            }}
          >
            <div>
              {timer?.phase !== "focus" && timer ? (
                <Coffee size={23} />
              ) : (
                <BookOpen size={23} />
              )}
              <strong role="timer" aria-label="Tiempo restante">
                {clockText(remaining)}
              </strong>
              <small>
                {timer
                  ? finished
                    ? "Bloque terminado"
                    : timer.runningSince === null
                      ? "Pausado · Recuperable"
                      : "En curso"
                  : "Listo para iniciar"}
              </small>
            </div>
          </div>
          {timer ? (
            <>
              <h3 className="timer-topic">{timer.topicName}</h3>
              <p className="form-help timer-summary">
                {data.courses.find((c) => c.id === timer.courseId)?.name ??
                  "Sin curso"}{" "}
                · Estudio acumulado: {clockText(timerStudySeconds(timer, tick))}
              </p>
              <div className="timer-buttons">
                {!finished && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      updateTimer(
                        (t) => {
                          t.elapsedSeconds = timerElapsed(t);
                          t.runningSince =
                            t.runningSince === null ? Date.now() : null;
                          t.lastSeenAt = Date.now();
                        },
                        timer.runningSince === null
                          ? "Temporizador reanudado"
                          : "Temporizador pausado",
                      )
                    }
                  >
                    {timer.runningSince === null ? (
                      <Play size={16} />
                    ) : (
                      <Pause size={16} />
                    )}{" "}
                    {timer.runningSince === null ? "Reanudar" : "Pausar"}
                  </button>
                )}
                {timer.mode === "pomodoro" && finished && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      commit(
                        (d) => {
                          if (d.activeTimer?.id !== timer.id)
                            throw new Error("El temporizador cambió.");
                          d.activeTimer = advanceTimer(d);
                        },
                        timer.phase === "focus"
                          ? "Descanso iniciado"
                          : "Nuevo bloque iniciado",
                      )
                    }
                  >
                    {timer.phase === "focus"
                      ? "Iniciar descanso"
                      : "Siguiente bloque"}
                  </button>
                )}
                <button
                  className="btn soft"
                  onClick={() => {
                    if (
                      window.confirm(
                        "¿Reiniciar el bloque actual? Se perderá solo su tiempo sin guardar; los bloques anteriores se conservan.",
                      )
                    )
                      updateTimer((t) => {
                        t.elapsedSeconds = 0;
                        t.runningSince = null;
                        t.lastSeenAt = Date.now();
                      }, "Bloque reiniciado");
                  }}
                >
                  <RotateCcw size={15} />
                  Reiniciar
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    if (timerStudySeconds(timer) <= 0) {
                      notify(
                        "Todavía no hay tiempo de estudio para registrar.",
                      );
                      return;
                    }
                    updateTimer((t) => {
                      t.elapsedSeconds = timerElapsed(t);
                      t.runningSince = null;
                      t.lastSeenAt = Date.now();
                    }, "Temporizador pausado para registrar");
                    setSaving(true);
                  }}
                >
                  <Save size={15} />
                  Finalizar y guardar
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        "¿Descartar el temporizador y su tiempo sin registrar? La sesión programada seguirá pendiente.",
                      )
                    )
                      commit((d) => {
                        if (d.activeTimer?.id === timer.id)
                          d.activeTimer = null;
                      }, "Temporizador descartado");
                  }}
                >
                  <X size={15} />
                  Descartar
                </button>
              </div>
              <p className="form-help">
                Puedes dejar la pestaña en segundo plano: el cálculo usa marcas
                de tiempo. Al volver a abrir la página se recupera pausado hasta
                la última marca guardada; no se registra una sesión completa
                automáticamente.
              </p>
            </>
          ) : (
            <form className="editor-form" onSubmit={start}>
              <div className="form-grid">
                <label>
                  Modo
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as typeof mode)}
                  >
                    <option value="continuous">Estudio continuo</option>
                    <option value="pomodoro">Pomodoro</option>
                  </select>
                </label>
                <label>
                  Duración prevista (min)
                  <input
                    type="number"
                    min={1}
                    max={180}
                    required
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                  />
                </label>
                <label>
                  Curso
                  <select
                    value={courseId}
                    onChange={(e) => {
                      setCourseId(e.target.value);
                      setTopicId("");
                      setPlanId("");
                    }}
                  >
                    <option value="">Estudio libre</option>
                    {data.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tema
                  <select
                    value={topicId}
                    onChange={(e) => {
                      setTopicId(e.target.value);
                      setPlanId("");
                    }}
                  >
                    <option value="">Sin tema</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Plan relacionado
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                  >
                    <option value="">Sin plan</option>
                    {data.plans
                      .filter(
                        (p) =>
                          p.courseId === (courseId || null) &&
                          p.topicIds.includes(topicId) &&
                          p.status === "active",
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              {mode === "pomodoro" && (
                <p className="form-help">
                  Bloques de {data.studyPreferences.pomodoroMinutes} min,
                  descansos de {data.studyPreferences.shortBreakMinutes} /{" "}
                  {data.studyPreferences.longBreakMinutes} min. Descanso largo
                  cada {data.studyPreferences.longBreakEvery} bloques. Ajusta
                  estas duraciones en Configuración. La duración prevista
                  orienta la sesión; cada bloque usa la duración Pomodoro
                  configurada.
                </p>
              )}
              <button className="btn primary" type="submit">
                <Play size={16} />
                Iniciar temporizador
              </button>
            </form>
          )}
        </Card>
        <Reviews compact />
      </div>
      <Card
        title="Programación e historial"
        action={
          <select
            aria-label="Curso de sesiones"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">Todos los cursos</option>
            {data.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        }
      >
        <div className="tabs study-tabs">
          {[
            ["pending", "Pendientes"],
            ["completed", "Completadas"],
            ["logs", "Registros reales"],
            ["cancelled", "Canceladas"],
          ].map(([k, v]) => (
            <button
              key={k}
              className={tab === k ? "active" : ""}
              onClick={() => setTab(k)}
            >
              {v}
            </button>
          ))}
        </div>
        {tab === "logs" ? (
          records.length ? (
            <div className="study-history">
              {[...records]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((l) => (
                  <article key={l.id}>
                    <strong>{l.topicName}</strong>
                    <p>
                      {displayDate(l.date, "d MMM yyyy")} ·{" "}
                      {Math.round((l.seconds / 60) * 100) / 100} min reales ·{" "}
                      {l.status === "completed" ? "Completada" : "Interrumpida"}
                    </p>
                    {l.mastery !== null && (
                      <span className={`badge mastery-${l.mastery}`}>
                        {MASTERY[l.mastery]}
                      </span>
                    )}
                    {l.notes && <p>{l.notes}</p>}
                  </article>
                ))}
            </div>
          ) : (
            <Empty title="No hay tiempo de estudio registrado" />
          )
        ) : (
          <>
            <SessionCards
              sessions={data.scheduledSessions
                .filter(
                  (s) =>
                    s.status === tab &&
                    (!courseFilter || s.courseId === courseFilter),
                )
                .sort(
                  (a, b) =>
                    a.date.localeCompare(b.date) ||
                    a.time.localeCompare(b.time),
                )}
            />
            {!data.scheduledSessions.some(
              (s) =>
                s.status === tab &&
                (!courseFilter || s.courseId === courseFilter),
            ) && <Empty title="No hay sesiones en esta vista" />}
          </>
        )}
      </Card>
      {saving && data.activeTimer && (
        <CompleteSessionDialog
          timer={data.activeTimer}
          onClose={() => setSaving(false)}
        />
      )}
    </div>
  );
}
