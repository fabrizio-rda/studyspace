import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutList, Columns3, Search, SlidersHorizontal } from "lucide-react";
import { useStore } from "../services/store";
import { todayIn, plusDays } from "../services/dates";
import { PRIORITIES, STATUSES, dateSchema } from "../models/schema";
import { AddButton, Empty } from "../components/ui";
import { TaskList } from "../components/TaskList";
import { useEditor } from "../components/AppContext";
export default function Tasks() {
  const { data, updateSettings } = useStore();
  const open = useEditor();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState(params.get("course") ?? "");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const selectedDate = dateSchema.safeParse(params.get("date")).success
    ? params.get("date")!
    : "";
  const [range, setRange] = useState(
    selectedDate ? "date" : (params.get("range") ?? "all"),
  );
  const [sort, setSort] = useState("asc");
  const today = todayIn(data.settings.timezone);
  const filtered = data.tasks
    .filter(
      (t) =>
        (!course || t.courseId === course) &&
        (!priority || t.priority === priority) &&
        (!status || t.status === status) &&
        (!search ||
          `${t.title} ${t.description}`
            .toLocaleLowerCase("es")
            .includes(search.toLocaleLowerCase("es"))) &&
        (range === "all" ||
          (range === "date" && t.dueDate === selectedDate) ||
          (range === "today" && t.dueDate === today) ||
          (range === "week" &&
            t.dueDate >= today &&
            t.dueDate <= plusDays(today, 6)) ||
          (range === "overdue" &&
            !!t.dueDate &&
            t.dueDate < today &&
            t.status !== "completada")),
    )
    .sort((a, b) =>
      sort === "asc"
        ? (a.dueDate || "9999-12-31").localeCompare(
            b.dueDate || "9999-12-31",
          ) || a.time.localeCompare(b.time)
        : (b.dueDate || "0000-01-01").localeCompare(
            a.dueDate || "0000-01-01",
          ) || b.time.localeCompare(a.time),
    );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Mis tareas</h1>
          <p>
            {data.tasks.filter((t) => t.status !== "completada").length}{" "}
            pendientes.
          </p>
        </div>
        <AddButton label="Nueva tarea" onClick={() => open({ kind: "task" })} />
      </div>
      {range === "date" && (
        <p className="form-help">
          Tareas del {selectedDate}. Selecciona Todas para ver el resto.
        </p>
      )}
      <div className="card task-workspace">
        <div className="task-toolbar">
          <div className="tabs">
            {[
              ["all", "Todas"],
              ["today", "Hoy"],
              ["week", "Próximos 7 días"],
              ["overdue", "Vencidas"],
            ].map(([k, v]) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={range === k ? "active" : ""}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="segmented">
            <button
              className={data.settings.taskView === "list" ? "selected" : ""}
              aria-label="Vista de lista"
              onClick={() => updateSettings({ taskView: "list" })}
            >
              <LayoutList size={18} />
            </button>
            <button
              className={data.settings.taskView === "kanban" ? "selected" : ""}
              aria-label="Vista Kanban"
              onClick={() => updateSettings({ taskView: "kanban" })}
            >
              <Columns3 size={18} />
            </button>
          </div>
        </div>
        <div className="filters">
          <label className="input-with-icon">
            <Search size={16} />
            <input
              placeholder="Buscar en mis tareas…"
              aria-label="Buscar tareas"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por curso"
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
          <select
            aria-label="Filtrar por prioridad"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">Prioridad</option>
            {Object.entries(PRIORITIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por estado"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Estado</option>
            {Object.entries(STATUSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Ordenar tareas"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="asc">Fecha ↑</option>
            <option value="desc">Fecha ↓</option>
          </select>
        </div>
        <div className="results-count">
          <SlidersHorizontal size={13} /> {filtered.length}{" "}
          {filtered.length === 1 ? "tarea" : "tareas"}
          {(search || course || priority || status || range !== "all") && (
            <button
              className="text-btn"
              onClick={() => {
                setSearch("");
                setCourse("");
                setPriority("");
                setStatus("");
                setRange("all");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
        {data.settings.taskView === "list" ? (
          filtered.length ? (
            <TaskList
              tasks={filtered}
              onEdit={(item) => open({ kind: "task", item })}
            />
          ) : (
            <Empty
              title={
                data.tasks.length ? "No hay coincidencias" : "No hay tareas"
              }
              description={
                data.tasks.length
                  ? "Prueba con otros filtros."
                  : "Crea una tarea para verla en esta lista."
              }
              action={
                <button
                  className="btn soft"
                  onClick={() => open({ kind: "task" })}
                >
                  Crear una tarea
                </button>
              }
            />
          )
        ) : (
          <div className="kanban">
            {Object.entries(STATUSES).map(([k, v]) => (
              <section className={`kanban-column column-${k}`} key={k}>
                <h2>
                  <span className="course-dot" />
                  {v}
                  <span className="count-pill">
                    {filtered.filter((t) => t.status === k).length}
                  </span>
                </h2>
                <TaskList
                  tasks={filtered.filter((t) => t.status === k)}
                  onEdit={(item) => open({ kind: "task", item })}
                />
                {!filtered.some((t) => t.status === k) && (
                  <p className="kanban-empty">Sin tareas</p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
