import SharedCalendar from "../components/SharedCalendar";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  addMonths,
  startOfMonth,
  startOfWeek,
  endOfMonth,
  endOfWeek,
  addDays,
} from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useStore } from "../services/store";
import { dateSchema, TYPES } from "../models/schema";
import { todayIn, parseDay, dateKey, displayDate } from "../services/dates";
import { useEditor } from "../components/AppContext";
import SessionCards from "../components/SessionCards";
import { AddButton, Empty, Modal } from "../components/ui";
function PersonalCalendar() {
  const { data, commit } = useStore();
  const open = useEditor();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const today = todayIn(data.settings.timezone);
  const [params] = useSearchParams();
  const [anchor, setAnchor] = useState(() =>
    dateSchema.safeParse(params.get("date")).success
      ? params.get("date")!
      : today,
  );
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [course, setCourse] = useState("");
  const [selected, setSelected] = useState(anchor);
  const d = parseDay(anchor);
  const start =
    view === "month"
      ? startOfWeek(startOfMonth(d), { weekStartsOn: 1 })
      : view === "week"
        ? startOfWeek(d, { weekStartsOn: 1 })
        : d;
  const end =
    view === "month"
      ? endOfWeek(endOfMonth(d), { weekStartsOn: 1 })
      : view === "week"
        ? addDays(start, 6)
        : d;
  const days: Date[] = [];
  for (let x = start; x <= end; x = addDays(x, 1)) days.push(x);
  const activities = [
    ...data.tasks.map((t) => ({
      key: `task-${t.id}`,
      id: t.id,
      title: t.title,
      date: t.dueDate,
      time: t.time,
      description: t.description,
      courseId: t.courseId,
      type: t.type,
      completed: t.status === "completada",
      kind: "task" as const,
      edit: () => open({ kind: "task", item: t }),
    })),
    ...data.scheduledSessions
      .filter((s) => s.status !== "cancelled")
      .map((s) => ({
        key: `session-${s.id}`,
        id: s.id,
        title: s.title,
        date: s.date,
        time: s.time,
        description: `${s.minutes} min · ${s.reason}`,
        courseId: s.courseId,
        type: "practica" as const,
        completed: s.status === "completed",
        kind: "session" as const,
        studyKind: s.kind,
        edit: () => setSelectedSession(s.id),
      })),
    ...data.events.map((e) => ({
      key: `event-${e.id}`,
      id: e.id,
      title: e.title,
      date: e.date,
      time: e.time,
      description: e.description,
      courseId: e.courseId,
      type: e.type,
      completed: false,
      kind: "event" as const,
      edit: () => open({ kind: "event", item: e }),
    })),
  ]
    .map((a) => ({
      ...a,
      label:
        a.kind === "session"
          ? a.studyKind === "review"
            ? "Repaso"
            : "Sesión de estudio"
          : TYPES[a.type],
    }))
    .filter((a) => !course || a.courseId === course)
    .sort(
      (a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title),
    );
  const selectedActivities = activities.filter(
    (a) => a.date === (view === "day" ? anchor : selected),
  );
  function move(step: number) {
    setAnchor(
      dateKey(
        view === "month"
          ? addMonths(d, step)
          : addDays(d, step * (view === "week" ? 7 : 1)),
      ),
    );
  }
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Mi calendario</h1>
          <p>
            Entregas, evaluaciones y planes. Una visión más clara de tus días.
          </p>
        </div>
        <AddButton
          label="Nueva actividad"
          onClick={() => open({ kind: "event", date: selected })}
        />
      </div>
      <div className="card calendar-workspace">
        <div className="calendar-toolbar">
          <div className="calendar-title">
            <button
              className="icon-btn"
              aria-label="Periodo anterior"
              onClick={() => move(-1)}
            >
              <ArrowLeft size={18} />
            </button>
            <h2>
              {displayDate(
                anchor,
                view === "day" ? "d MMMM yyyy" : "MMMM yyyy",
              )}
            </h2>
            <button
              className="icon-btn"
              aria-label="Periodo siguiente"
              onClick={() => move(1)}
            >
              <ArrowRight size={18} />
            </button>
            <button
              className="btn soft small-btn"
              onClick={() => {
                setAnchor(today);
                setSelected(today);
              }}
            >
              Hoy
            </button>
          </div>
          <div className="calendar-controls">
            <select
              aria-label="Curso en calendario"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              <option value="">Todos los cursos</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="segmented">
              {(
                [
                  ["month", "Mes"],
                  ["week", "Semana"],
                  ["day", "Día"],
                ] as const
              ).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setView(k)}
                  className={view === k ? "selected" : ""}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="calendar-legend">
          <span>▰ Tarea</span>
          <span>▣ Examen</span>
          <span>▱ E · Estudio</span>
          <span>◌ R · Repaso</span>
        </div>
        {view !== "day" ? (
          <div className="calendar-scroll">
            <div className={`calendar-grid view-${view}`}>
              <div className="weekday-row">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  ),
                )}
              </div>
              <div className="calendar-days">
                {days.map((day) => {
                  const key = dateKey(day);
                  const list = activities.filter((a) => a.date === key);
                  return (
                    <div
                      key={key}
                      className={`calendar-cell ${key === today ? "is-today" : ""} ${key === selected ? "is-selected" : ""} ${day.getMonth() !== d.getMonth() && view === "month" ? "outside" : ""}`}
                    >
                      <button
                        aria-label={`Añadir actividad el ${key}`}
                        className="calendar-day-number"
                        onClick={() => {
                          setSelected(key);
                          open({ kind: "event", date: key });
                        }}
                      >
                        <span>{day.getDate()}</span>
                        <Plus size={12} />
                      </button>
                      {list.slice(0, view === "month" ? 3 : 20).map((a) => (
                        <button
                          key={a.key}
                          onClick={a.edit}
                          className={`calendar-event ${a.completed ? "event-done" : ""} ${a.kind === "session" ? (a.studyKind === "review" ? "calendar-review" : "calendar-study") : a.type === "examen" ? "calendar-exam" : "calendar-task"}`}
                          style={{
                            borderLeftColor:
                              data.courses.find((c) => c.id === a.courseId)
                                ?.color ?? "#A18BE0",
                            background: `${data.courses.find((c) => c.id === a.courseId)?.color ?? "#A18BE0"}20`,
                          }}
                          title={`${a.title} · ${a.label} · ${a.time || "Todo el día"}`}
                        >
                          <span>
                            {a.time && <small>{a.time} </small>}
                            {a.kind === "session"
                              ? a.studyKind === "review"
                                ? "R · "
                                : "E · "
                              : a.type === "examen"
                                ? "Ex · "
                                : ""}
                            {a.title}
                          </span>
                        </button>
                      ))}
                      <button
                        className="calendar-day-details"
                        aria-label={`Ver actividades del ${key}`}
                        onClick={() => setSelected(key)}
                      >
                        {list.length > 3 && view === "month"
                          ? `+${list.length - 3} más`
                          : list.length
                            ? "Ver día"
                            : "Ver actividades"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
        <section className="selected-day">
          <div className="selected-heading">
            <h2>
              <CalendarDays size={18} />
              {displayDate(view === "day" ? anchor : selected, "EEEE, d MMMM")}
            </h2>
            <div className="row-actions">
              <button
                className="btn soft small-btn"
                onClick={() =>
                  open({
                    kind: "task",
                    date: view === "day" ? anchor : selected,
                  })
                }
              >
                + Tarea
              </button>
              <button
                className="btn soft small-btn"
                onClick={() =>
                  open({
                    kind: "event",
                    date: view === "day" ? anchor : selected,
                  })
                }
              >
                + Actividad
              </button>
            </div>
          </div>
          {selectedActivities.length ? (
            <div className="calendar-agenda">
              {selectedActivities.map((a) => (
                <article key={a.key}>
                  <span className="agenda-time">{a.time || "Todo el día"}</span>
                  <span
                    className="agenda-line"
                    style={{
                      background:
                        data.courses.find((c) => c.id === a.courseId)?.color ??
                        "#A18BE0",
                    }}
                  />
                  <button onClick={a.edit} className="agenda-content">
                    <strong>{a.title}</strong>
                    <small>
                      {data.courses.find((c) => c.id === a.courseId)?.name ??
                        "Sin curso"}{" "}
                      · {a.label} ·{" "}
                      {a.kind === "task"
                        ? "Tarea"
                        : a.kind === "session"
                          ? "Sesión programada"
                          : "Actividad independiente"}
                    </small>
                    {a.description && <p>{a.description}</p>}
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Editar ${a.title}`}
                    onClick={a.edit}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-btn danger-icon"
                    aria-label={`${a.kind === "session" ? "Cancelar sesión" : "Eliminar"} ${a.title}`}
                    disabled={a.kind === "session" && a.completed}
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar «${a.title}»? ${a.kind === "task" ? "También se quitará de Mis tareas." : ""}`,
                        )
                      )
                        commit((d) => {
                          if (a.kind === "task") {
                            d.tasks = d.tasks.filter((t) => t.id !== a.id);
                            d.classroomItems = d.classroomItems.filter(
                              (i) => i.taskId !== a.id,
                            );
                            for (const p of d.plans)
                              if (p.targetTaskId === a.id)
                                p.targetTaskId = null;
                          } else if (a.kind === "session") {
                            if (d.activeTimer?.sessionId === a.id)
                              throw new Error(
                                "Finaliza o descarta el temporizador primero.",
                              );
                            d.scheduledSessions.find(
                              (s) => s.id === a.id,
                            )!.status = "cancelled";
                          } else
                            d.events = d.events.filter((e) => e.id !== a.id);
                        }, "Actividad eliminada");
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Sin actividades"
              description="Haz clic en una fecha para añadir una actividad o crea una tarea con fecha límite."
            />
          )}
        </section>
        <p className="calendar-note">
          Zona horaria: {data.settings.timezone}. Cada tarea se muestra una sola
          vez; las actividades independientes no aparecen en Mis tareas.
        </p>
      </div>
      {selectedSession && (
        <Modal
          title="Sesión programada"
          onClose={() => setSelectedSession(null)}
          wide
        >
          <SessionCards
            sessions={data.scheduledSessions.filter(
              (s) => s.id === selectedSession,
            )}
          />
        </Modal>
      )}
    </div>
  );
}

export default function Calendar() {
  const [params] = useSearchParams();
  const [scope, setScope] = useState(
    params.get("compartido") === "1" ? "shared" : "mine",
  );
  useEffect(
    () => setScope(params.get("compartido") === "1" ? "shared" : "mine"),
    [params],
  );
  const initial = params.get("date");
  return (
    <>
      <div className="calendar-scope">
        <div className="tabs" aria-label="Seleccionar calendario">
          <button
            className={scope === "mine" ? "active" : ""}
            onClick={() => setScope("mine")}
          >
            Mi calendario
          </button>
          <button
            className={scope === "shared" ? "active" : ""}
            onClick={() => setScope("shared")}
          >
            Calendario compartido
          </button>
        </div>
      </div>
      {scope === "mine" ? (
        <PersonalCalendar />
      ) : (
        <SharedCalendar
          initialDate={
            dateSchema.safeParse(initial).success ? initial! : undefined
          }
        />
      )}
    </>
  );
}
