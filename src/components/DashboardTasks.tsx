import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useStore } from "../services/store";
import { taskWindows } from "../services/task-windows";
import { displayDate } from "../services/dates";
import { useEditor } from "./AppContext";
import { Card } from "./ui";
import { TaskList } from "./TaskList";
const pending = (tasks: { status: string }[]) =>
  tasks.filter((t) => t.status !== "completada").length;
const pendingLabel = (count: number) =>
  `${count} ${count === 1 ? "pendiente" : "pendientes"}`;
export function UpcomingTasks() {
  const { data } = useStore(),
    open = useEditor(),
    navigate = useNavigate();
  const window = taskWindows(data.tasks, data.settings.timezone);
  return (
    <Card
      title="Tareas próximas"
      className="today-card upcoming-card"
      action={
        <span className="count-pill">
          {pending(window.days.flatMap((d) => d.tasks))}
        </span>
      }
    >
      {window.days.map(({ date, tasks }, index) => (
        <section
          className="upcoming-group"
          key={date}
          aria-label={index ? "Tareas de mañana" : "Tareas de hoy"}
        >
          <div className="upcoming-heading">
            <h3>{index ? "Mañana" : "Hoy"}</h3>
            <span>{pendingLabel(pending(tasks))}</span>
            <button
              className="icon-btn"
              aria-label={
                index ? "Añadir tarea para mañana" : "Añadir tarea para hoy"
              }
              onClick={() => open({ kind: "task", date })}
            >
              <Plus size={18} />
            </button>
          </div>
          <p className="task-group-date">{displayDate(date, "EEEE, d MMM")}</p>
          {tasks.length ? (
            <TaskList
              small
              tasks={tasks.slice(0, 3)}
              onEdit={(item) => open({ kind: "task", item })}
            />
          ) : (
            <p className="compact-empty">
              Sin tareas {index ? "para mañana" : "para hoy"}.
            </p>
          )}
          {tasks.length > 3 && (
            <button
              className="text-btn"
              onClick={() => navigate(`/tareas?date=${date}`)}
            >
              Ver las {tasks.length} tareas
            </button>
          )}
        </section>
      ))}
    </Card>
  );
}
export function WeeklyTasks() {
  const { data } = useStore(),
    open = useEditor();
  const { week, start, end } = taskWindows(data.tasks, data.settings.timezone);
  const [limit, setLimit] = useState(6);
  const shown = week.slice(0, limit),
    dates = [...new Set(shown.map((t) => t.dueDate))];
  return (
    <Card
      title="Tareas de esta semana"
      className="weekly-tasks"
      eyebrow={`${displayDate(start)} – ${displayDate(end)}`}
      action={<span className="count-pill">{pendingLabel(pending(week))}</span>}
    >
      {week.length ? (
        <div className="weekly-task-scroll">
          {dates.map((date) => (
            <section key={date}>
              <h3>{displayDate(date, "EEEE, d MMM")}</h3>
              <TaskList
                small
                tasks={shown.filter((t) => t.dueDate === date)}
                onEdit={(item) => open({ kind: "task", item })}
              />
            </section>
          ))}
        </div>
      ) : (
        <p className="compact-empty">No hay tareas esta semana.</p>
      )}
      {week.length > limit && (
        <button className="btn soft" onClick={() => setLimit((n) => n + 6)}>
          Mostrar más ({week.length - limit})
        </button>
      )}
      {limit > 6 && week.length > 6 && (
        <button className="text-btn" onClick={() => setLimit(6)}>
          Mostrar menos
        </button>
      )}
    </Card>
  );
}
