import { useState } from "react";
import type { FormEvent } from "react";
import { COLORS, ICONS, PRIORITIES, STATUSES, TYPES } from "../models/schema";
import type { Task, AcademicEvent, TaskType, Course } from "../models/schema";
import { useStore } from "../services/store";
import { todayIn } from "../services/dates";
import { ClassroomSource } from "./ClassroomSource";
import ColorPicker from "./ColorPicker";
import { CourseIcon, Modal } from "./ui";
export type EditorState =
  | {
      kind: "task";
      item?: Task;
      date?: string;
      courseId?: string;
      type?: TaskType;
    }
  | { kind: "event"; item?: AcademicEvent; date?: string; courseId?: string }
  | { kind: "course"; item?: Course };
export function Editors({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  return editor.kind === "course" ? (
    <CourseEditor item={editor.item} onClose={onClose} />
  ) : (
    <ActivityEditor editor={editor} onClose={onClose} />
  );
}
function ActivityEditor({
  editor,
  onClose,
}: {
  editor: Exclude<EditorState, { kind: "course" }>;
  onClose: () => void;
}) {
  const { data, saveTask, saveEvent } = useStore();
  const item = editor.item;
  const event = editor.kind === "event";
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [courseId, setCourseId] = useState(
    item?.courseId ?? editor.courseId ?? "",
  );
  const [type, setType] = useState<TaskType>(
    item?.type ?? (editor.kind === "task" ? editor.type : undefined) ?? "tarea",
  );
  const [date, setDate] = useState(
    (item && ("dueDate" in item ? item.dueDate : item.date)) ??
      editor.date ??
      todayIn(data.settings.timezone),
  );
  const [time, setTime] = useState(item?.time ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(
    item && "priority" in item ? item.priority : "media",
  );
  const [status, setStatus] = useState<Task["status"]>(
    item && "status" in item ? item.status : "pendiente",
  );
  const [personalNotes, setPersonalNotes] = useState(
    item && "personalNotes" in item ? (item.personalNotes ?? "") : "",
  );
  const [estimate, setEstimate] = useState(
    item && "estimatedMinutes" in item ? (item.estimatedMinutes ?? 0) : 0,
  );
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Escribe un título.");
      return;
    }
    const base = {
      ...item,
      id: item?.id ?? crypto.randomUUID(),
      title: title.trim(),
      description,
      courseId: courseId || null,
      type,
      time,
      createdAt: item?.createdAt ?? new Date().toISOString(),
    };
    const ok = event
      ? saveEvent({ ...base, date })
      : saveTask({
          ...base,
          dueDate: date,
          priority,
          personalNotes,
          estimatedMinutes: estimate,
          status,
          completedAt:
            status === "completada"
              ? item && "completedAt" in item && item.completedAt
                ? item.completedAt
                : new Date().toISOString()
              : null,
        });
    if (ok) onClose();
  }
  return (
    <Modal
      title={
        item
          ? event
            ? "Editar actividad"
            : "Editar tarea"
          : event
            ? "Nueva actividad"
            : type === "examen"
              ? "Nuevo examen"
              : "Nueva tarea"
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="editor-form">
        <label>
          Título
          <input
            autoFocus
            required
            maxLength={200}
            placeholder="Título de la actividad"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Curso
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Sin curso</option>
              {data.courses
                .filter((c) => !c.archived || c.id === courseId)
                .sort((a, b) => a.order - b.order)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.archived ? " (archivado)" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Tipo
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TaskType)}
            >
              {Object.entries(TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha{!event ? " límite" : ""}
            <input
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              required={event || !item}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Hora <span className="optional">(opcional)</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          {!event && (
            <>
              <label>
                Prioridad
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as Task["priority"])
                  }
                >
                  {Object.entries(PRIORITIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Task["status"])}
                >
                  {Object.entries(STATUSES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <label>
          Descripción <span className="optional">(opcional)</span>
          <textarea
            rows={3}
            maxLength={10000}
            placeholder="Detalles, indicaciones o un recordatorio…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {!event && (
          <div className="form-grid">
            <label>
              Notas personales
              <textarea
                maxLength={10000}
                value={personalNotes}
                onChange={(e) => setPersonalNotes(e.target.value)}
              />
            </label>
            <label>
              Tiempo estimado (min)
              <input
                type="number"
                min="0"
                max="10000"
                value={estimate}
                onChange={(e) => setEstimate(Number(e.target.value))}
              />
            </label>
          </div>
        )}
        {item && !event && <ClassroomSource taskId={item.id} />}
        {event && (
          <p className="form-help">
            Esta actividad aparecerá solo en el calendario. Para darle
            seguimiento con estados y prioridad, créala como tarea.
          </p>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn primary">
            {item
              ? "Guardar cambios"
              : event
                ? "Crear actividad"
                : "Crear tarea"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function CourseEditor({
  item,
  onClose,
}: {
  item?: Course;
  onClose: () => void;
}) {
  const { data, saveCourse } = useStore();
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [color, setColor] = useState(item?.color ?? COLORS[0]);
  const [icon, setIcon] = useState<Course["icon"]>(item?.icon ?? "book");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (
      saveCourse({
        id: item?.id ?? crypto.randomUUID(),
        name: name.trim(),
        description,
        color,
        icon,
        archived: item?.archived ?? false,
        order:
          item?.order ?? Math.max(-1, ...data.courses.map((c) => c.order)) + 1,
      })
    )
      onClose();
  }
  return (
    <Modal title={item ? "Editar curso" : "Nuevo curso"} onClose={onClose}>
      <form className="editor-form" onSubmit={submit}>
        <label>
          Nombre del curso
          <input
            autoFocus
            required
            maxLength={100}
            placeholder="Por ejemplo, Física IB"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Descripción
          <textarea
            rows={3}
            maxLength={5000}
            placeholder="Descripción del curso (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <ColorPicker value={color} onChange={setColor} />
        <div
          className="course-live-preview"
          style={{
            background: `linear-gradient(130deg,${color}55,${color}18)`,
            borderColor: color,
          }}
          aria-label="Vista previa del curso"
        >
          <CourseIcon course={{ color, icon }} />
          <strong>{name || "Nombre del curso"}</strong>
          <span style={{ background: color }} />
        </div>
        <fieldset>
          <legend>Icono</legend>
          <div className="icon-options">
            {ICONS.map((i) => (
              <button
                type="button"
                key={i}
                className={icon === i ? "chosen" : ""}
                onClick={() => setIcon(i)}
                aria-label={`Icono ${i}`}
                aria-pressed={icon === i}
              >
                <CourseIcon course={{ color, icon: i }} />
              </button>
            ))}
          </div>
        </fieldset>
        <div className="modal-footer">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" type="submit">
            Guardar curso
          </button>
        </div>
      </form>
    </Modal>
  );
}
