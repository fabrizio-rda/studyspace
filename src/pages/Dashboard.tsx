import { UpcomingTasks, WeeklyTasks } from "../components/DashboardTasks";
import TodayPlan from "../components/TodayPlan";
import { weekStart as studyWeekStart } from "../services/dates";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  Hourglass,
  ListChecks,
  TrendingUp,
} from "lucide-react";
import { useStore } from "../services/store";
import {
  daysUntil,
  displayDate,
  hourIn,
  todayIn,
  weekStart,
} from "../services/dates";
import { ArrowButton, Card, Empty } from "../components/ui";
import { CompactCalendar } from "../components/CompactCalendar";
import { useEditor } from "../components/AppContext";
export default function Dashboard() {
  const { data, cloud } = useStore();
  const open = useEditor();
  const navigate = useNavigate();
  const today = todayIn(data.settings.timezone);
  const hour = hourIn(data.settings.timezone);
  const pending = data.tasks.filter((t) => t.status !== "completada");
  const completed = data.tasks.filter((t) => t.status === "completada");
  const week = weekStart(today);
  const completedWeek = completed.filter(
    (t) =>
      t.completedAt &&
      todayIn(data.settings.timezone, new Date(t.completedAt)) >= week &&
      todayIn(data.settings.timezone, new Date(t.completedAt)) <= today,
  );
  const percent = data.tasks.length
    ? Math.round((completed.length / data.tasks.length) * 100)
    : 0;
  const exams = [
    ...data.tasks
      .filter(
        (t) =>
          t.type === "examen" &&
          t.status !== "completada" &&
          t.dueDate >= today,
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        date: t.dueDate,
        courseId: t.courseId,
        edit: () => open({ kind: "task", item: t }),
      })),
    ...data.events
      .filter((e) => e.type === "examen" && e.date >= today)
      .map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        courseId: e.courseId,
        edit: () => open({ kind: "event", item: e }),
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="dashboard">
      <section className="welcome">
        <div className="welcome-copy">
          <h1>
            {hour < 12
              ? "Buenos días"
              : hour < 19
                ? "Buenas tardes"
                : "Buenas noches"}
            ,<br />
            {data.settings.name}
          </h1>
          <p>Cursos, tareas y evaluaciones.</p>
          <div className="welcome-bottom">
            <span className="date-pill">
              <CalendarDays size={14} />
              {displayDate(today, "d MMMM, yyyy")}
            </span>
            <span>
              {pending.length
                ? `${pending.length} ${pending.length === 1 ? "tarea pendiente" : "tareas pendientes"}`
                : "Sin tareas pendientes"}
            </span>
          </div>
        </div>
        <section className="welcome-summary" aria-label="Resumen de tareas">
          <span className="welcome-summary-title">Tus tareas</span>
          <dl>
            <div>
              <dt>Total</dt>
              <dd>{data.tasks.length}</dd>
            </div>
            <div>
              <dt>Pendientes</dt>
              <dd>{pending.length}</dd>
            </div>
            <div>
              <dt>Completadas</dt>
              <dd>{completed.length}</dd>
            </div>
          </dl>
          <div
            className="welcome-summary-progress"
            role="progressbar"
            aria-label="Tareas completadas"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <span className="welcome-summary-percent">{percent}% completado</span>
        </section>
      </section>
      <UpcomingTasks />
      <Card
        title="Esta semana"
        className="week-card"
        action={<TrendingUp size={19} />}
      >
        <div className="big-number">
          {completedWeek.length}
          <span>tareas completadas</span>
        </div>
        <div
          className="week-bars"
          aria-label={`${completedWeek.length} tareas completadas esta semana`}
        >
          {Array.from({ length: 7 }, (_, i) => {
            const date = new Date(`${week}T12:00:00`);
            date.setDate(date.getDate() + i);
            const k = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
            const n = completedWeek.filter(
              (t) =>
                t.completedAt &&
                todayIn(data.settings.timezone, new Date(t.completedAt)) === k,
            ).length;
            const max = Math.max(
              1,
              ...Array.from({ length: 7 }, (_, j) => {
                const d = new Date(`${week}T12:00:00`);
                d.setDate(d.getDate() + j);
                return completedWeek.filter(
                  (t) =>
                    t.completedAt &&
                    todayIn(data.settings.timezone, new Date(t.completedAt)) ===
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                ).length;
              }),
            );
            return (
              <div
                key={i}
                className="bar-column"
                title={`${["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i]}: ${n}`}
              >
                <span className="bar-track">
                  <span style={{ height: `${(n / max) * 100}%` }} />
                </span>
                <small>{["L", "M", "X", "J", "V", "S", "D"][i]}</small>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Tu progreso" className="progress-card">
        <div
          className="progress-ring"
          role="img"
          aria-label={`${percent}% de tareas completadas`}
          style={{
            background: `conic-gradient(var(--ui-progress, #83A8EB) ${percent}%, var(--ui-soft, #DFEAF6) 0)`,
          }}
        >
          <div>
            <strong>
              {percent}
              <small>%</small>
            </strong>
            <span>completado</span>
          </div>
        </div>
        <div className="progress-legend">
          <span>
            <i /> {completed.length} completadas
          </span>
          <span>{pending.length} pendientes</span>
        </div>
      </Card>
      <Card title="Accesos rápidos" className="quick-card">
        <div className="quick-grid">
          {[
            {
              label: "Nueva tarea",
              icon: ListChecks,
              cls: "purple",
              run: () => open({ kind: "task" }),
            },
            {
              label: "Nuevo examen",
              icon: CalendarDays,
              cls: "pink",
              run: () => open({ kind: "task", type: "examen" }),
            },
            {
              label: "Calendario",
              icon: CalendarDays,
              cls: "blue",
              run: () => navigate("/calendario"),
            },
            {
              label: "Mis cursos",
              icon: BookOpen,
              cls: "peach",
              run: () => navigate("/cursos"),
            },
          ].map((a) => (
            <button key={a.label} onClick={a.run}>
              <span className={`quick-icon ${a.cls}`}>
                <a.icon size={23} strokeWidth={1.6} />
              </span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </Card>
      <CompactCalendar />
      <Card
        title="Próximas evaluaciones"
        className="exams-card"
        action={
          <ArrowButton
            label="Ver evaluaciones en calendario"
            onClick={() => navigate("/calendario")}
          />
        }
      >
        {exams.length ? (
          <div className="exam-list">
            {exams.slice(0, 3).map((e) => (
              <button key={e.id} className="exam-item" onClick={e.edit}>
                <span className="exam-date">
                  <small>{displayDate(e.date, "MMM")}</small>
                  <strong>{displayDate(e.date, "d")}</strong>
                </span>
                <span className="exam-info">
                  <strong>{e.title}</strong>
                  <small>
                    {data.courses.find((c) => c.id === e.courseId)?.name ??
                      "Sin curso"}
                  </small>
                </span>
                <span className="exam-countdown">
                  {daysUntil(e.date, today) === 0
                    ? "Hoy"
                    : `En ${daysUntil(e.date, today)} días`}
                  <ArrowUpRight size={15} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title="Sin evaluaciones próximas"
            description="Los exámenes con fecha aparecerán aquí."
            action={
              <button
                className="text-btn"
                onClick={() => open({ kind: "task", type: "examen" })}
              >
                Añadir evaluación <ArrowUpRight size={14} />
              </button>
            }
          />
        )}
        <div className="exam-total">
          <CalendarDays size={14} /> {exams.length} próximas evaluaciones
        </div>
      </Card>
      <TodayPlan />
      <section className="timer-card dashboard-timer-link">
        <div>
          <h2>Sesiones de estudio</h2>
          <p>
            {Math.round(
              data.studyLogs
                .filter((l) => l.date === today)
                .reduce((n, l) => n + l.seconds / 60, 0),
            )}{" "}
            min hoy ·{" "}
            {Math.round(
              data.studyLogs
                .filter(
                  (l) => l.date >= studyWeekStart(today) && l.date <= today,
                )
                .reduce((n, l) => n + l.seconds / 3600, 0) * 10,
            ) / 10}{" "}
            h esta semana
          </p>
        </div>
        <button
          className="btn soft small-btn"
          onClick={() => navigate("/sesiones")}
        >
          <Hourglass size={17} />
          Abrir temporizador
        </button>
      </section>
      <WeeklyTasks />
      <div className="dashboard-footer">
        <Check size={13} />{" "}
        {cloud.mode === "cloud"
          ? "Tus cambios se sincronizan con tu cuenta."
          : "Tus cambios se guardan en este navegador."}
      </div>
    </div>
  );
}
