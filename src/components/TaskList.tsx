import { ClassroomSource } from "./ClassroomSource";
import { Check, Pencil, Trash2, Clock3 } from "lucide-react";
import { useStore } from "../services/store";
import type { Task } from "../models/schema";
import { PRIORITIES, STATUSES, TYPES } from "../models/schema";
import { displayDate, todayIn } from "../services/dates";
export function TaskList({
  tasks,
  onEdit,
  small = false,
}: {
  tasks: Task[];
  onEdit: (task: Task) => void;
  small?: boolean;
}) {
  const { data, toggleTask, commit } = useStore();
  const today = todayIn(data.settings.timezone);
  return (
    <div className={`task-list ${small ? "small" : ""}`}>
      {tasks.map((t) => {
        const course = data.courses.find((c) => c.id === t.courseId);
        const overdue =
          t.status !== "completada" && !!t.dueDate && t.dueDate < today;
        return (
          <article
            key={t.id}
            className={`task-row ${t.status === "completada" ? "done" : ""}`}
          >
            <button
              className="check-btn"
              aria-label={`${t.status === "completada" ? "Reabrir" : "Completar"} ${t.title}`}
              aria-pressed={t.status === "completada"}
              onClick={() => toggleTask(t.id)}
            >
              {t.status === "completada" && <Check size={14} />}
            </button>
            <div className="task-info">
              <button className="task-title" onClick={() => onEdit(t)}>
                {t.title}
              </button>
              <div className="task-meta">
                <span
                  className="course-dot"
                  style={{ background: course?.color ?? "#B7ADB8" }}
                />
                {course?.name ?? "Sin curso"}
                {!small && <span>· {TYPES[t.type]}</span>}
              </div>
              {!small && <ClassroomSource taskId={t.id} />}
              {!small && t.description && (
                <p className="task-description">{t.description}</p>
              )}
            </div>
            <div className="task-side">
              <span className={`task-date ${overdue ? "overdue" : ""}`}>
                <Clock3 size={12} />
                {small
                  ? t.time || "Todo el día"
                  : `${displayDate(t.dueDate)}${t.time ? ` · ${t.time}` : ""}`}
                {overdue && " · Vencida"}
              </span>
              {!small && (
                <span className={`badge priority-${t.priority}`}>
                  {PRIORITIES[t.priority]}
                </span>
              )}
            </div>
            {!small && (
              <>
                <select
                  aria-label={`Estado de ${t.title}`}
                  className="status-select"
                  value={t.status}
                  onChange={(e) =>
                    commit((d) => {
                      const item = d.tasks.find((x) => x.id === t.id)!;
                      item.status = e.target.value as Task["status"];
                      item.completedAt =
                        item.status === "completada"
                          ? new Date().toISOString()
                          : null;
                    }, "Estado actualizado")
                  }
                >
                  {Object.entries(STATUSES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="row-actions">
                  <button
                    className="icon-btn"
                    onClick={() => onEdit(t)}
                    aria-label={`Editar ${t.title}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-btn danger-icon"
                    aria-label={`Eliminar ${t.title}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Eliminar «${t.title}»? Esta acción no se puede deshacer.`,
                        )
                      )
                        commit((d) => {
                          d.tasks = d.tasks.filter((x) => x.id !== t.id);
                          d.classroomItems = d.classroomItems.filter(
                            (i) => i.taskId !== t.id,
                          );
                          for (const p of d.plans)
                            if (p.targetTaskId === t.id) p.targetTaskId = null;
                        }, "Tarea eliminada");
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
