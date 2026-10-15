import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CirclePlus,
  Coffee,
  Hourglass,
  ListChecks,
  Sparkles,
  TrendingUp,
  WandSparkles,
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
import { TaskList } from "../components/TaskList";
import { CompactCalendar } from "../components/CompactCalendar";
import { useEditor } from "../components/AppContext";
export default function Dashboard() {
  const { data } = useStore();
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
  const todays = data.tasks
    .filter((t) => t.dueDate === today)
    .sort((a, b) => a.time.localeCompare(b.time));
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
          <span className="welcome-tag">
            <Sparkles size={13} /> UN POCO DE ORDEN, MÁS ESPACIO PARA TI
          </span>
          <h1>
            {hour < 12
              ? "Buenos días"
              : hour < 19
                ? "Buenas tardes"
                : "Buenas noches"}
            ,<br />
            {data.settings.name}
            <span className="hello-star">✦</span>
          </h1>
          <p>Este es tu espacio para organizar tus estudios.</p>
          <div className="welcome-bottom">
            <span className="date-pill">
              <CalendarDays size={14} />
              {displayDate(today, "d MMMM, yyyy")}
            </span>
            <span>
              {pending.length
                ? `${pending.length} ${pending.length === 1 ? "tarea pendiente" : "tareas pendientes"}`
                : "Todo comienza con un pequeño paso"}
            </span>
          </div>
        </div>
        <div className="study-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-star star-one">✦</div>
          <div className="art-star star-two">✧</div>
          <div className="book-stack">
            <div className="book-book blue-book" />
            <div className="book-book pink-book" />
            <div className="book-book purple-book" />
            <div className="book-pages" />
            <div className="book-cover">
              <BookOpen size={51} strokeWidth={1} />
            </div>
          </div>
          <div className="little-cup">
            <Coffee size={36} strokeWidth={1.7} />
          </div>
        </div>
      </section>
      <Card
        title="Tareas de hoy"
        eyebrow={displayDate(today, "EEEE, d MMMM")}
        className="today-card"
        action={<span className="count-pill">{todays.length}</span>}
      >
        {todays.length ? (
          <TaskList
            tasks={todays.slice(0, 5)}
            onEdit={(item) => open({ kind: "task", item })}
            small
          />
        ) : (
          <Empty
            title="Hoy, una página en blanco"
            description="Añade tu primera tarea y dale un lugar en tu día."
          />
        )}
        <button
          className="dashed-add"
          onClick={() => open({ kind: "task", date: today })}
        >
          <CirclePlus size={17} /> Añadir tarea para hoy
        </button>
        {todays.length > 5 && (
          <button
            className="text-btn"
            onClick={() => navigate("/tareas?range=today")}
          >
            Ver las {todays.length} tareas
          </button>
        )}
        <div className="tiny-note">
          <span>✧</span> Un paso a la vez también es avanzar.
        </div>
      </Card>
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
        <p className="card-footnote">Pequeñas victorias que sí cuentan.</p>
      </Card>
      <Card title="Tu progreso" className="progress-card">
        <div
          className="progress-ring"
          role="img"
          aria-label={`${percent}% de tareas completadas`}
          style={{
            background: `conic-gradient(#A18BE0 ${percent}%, #EEE5F2 0)`,
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
      <Card
        title="Un atajo para cada idea"
        className="quick-card"
        action={
          <span className="muted">
            <Sparkles size={17} />
          </span>
        }
      >
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
            title="Todo despejado por aquí"
            description="Cuando añadas un examen, lo encontrarás aquí."
            action={
              <button
                className="text-btn"
                onClick={() => open({ kind: "task", type: "examen" })}
              >
                Añadir mi primera evaluación <ArrowUpRight size={14} />
              </button>
            }
          />
        )}
        <div className="exam-total">
          <CalendarDays size={14} /> {exams.length} próximas evaluaciones
        </div>
      </Card>
      <section className="plan-card">
        <span className="plan-symbol">
          <WandSparkles size={24} />
        </span>
        <div>
          <div className="plan-heading">
            <h2>Tu plan de estudio</h2>
            <span className="badge">FASE 2</span>
          </div>
          <p>
            Un plan que se adapte a ti. La planificación inteligente llegará en
            la siguiente fase.
          </p>
        </div>
      </section>
      <section className="timer-card">
        <div>
          <span className="eyebrow">ESPACIO PARA CONCENTRARTE</span>
          <h2>Una cosa a la vez</h2>
          <p>Sesiones Pomodoro · Fase 2</p>
        </div>
        <div className="timer-preview">
          <Hourglass size={23} strokeWidth={1.4} />
          <span>25:00</span>
        </div>
      </section>
      <div className="dashboard-footer">
        <Check size={13} /> Tus cambios se guardan en este navegador.
      </div>
    </div>
  );
}
